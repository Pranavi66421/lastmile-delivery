const { get, all, run, initDB } = require('../config/db');
const { optimizeRoute } = require('../services/routingService');
const { getDistanceKM } = require('../services/geoService');

exports.optimizeRouting = async (req, res) => {
  const { agent_id, order_ids } = req.body;
  try {
    const agent = await get('SELECT id, username, current_lat, current_lng FROM users WHERE id = ?', [agent_id]);
    if (!agent || agent.current_lat === null || agent.current_lng === null) return res.status(400).json({ error: 'Rider is inactive or has invalid coordinates' });

    const startPoint = { lat: agent.current_lat, lng: agent.current_lng };
    const placeholders = order_ids.map(() => '?').join(',');
    const orders = await all(`SELECT id, pickup_address, pickup_lat, pickup_lng, drop_address, drop_lat, drop_lng FROM orders WHERE id IN (${placeholders})`, order_ids);

    const stops = [];
    orders.forEach(o => {
      stops.push({ id: o.id, address: o.pickup_address, lat: o.pickup_lat, lng: o.pickup_lng, label: `Pickup #${o.id}`, type: 'pickup' });
      stops.push({ id: o.id, address: o.drop_address, lat: o.drop_lat, lng: o.drop_lng, label: `Drop-off #${o.id}`, type: 'drop' });
    });

    const pathObj = optimizeRoute(startPoint, stops);
    res.json(pathObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateAgentGPS = async (req, res) => {
  const agent_id = req.user.role === 'admin' ? (req.body.agent_id || req.user.id) : req.user.id;
  const { lat, lng } = req.body;
  try {
    await run('UPDATE users SET current_lat = ?, current_lng = ? WHERE id = ?', [lat, lng, agent_id]);
    
    const assigned = await all('SELECT id, pickup_lat, pickup_lng, drop_lat, drop_lng, status FROM orders WHERE agent_id = ? AND status NOT IN (\'Delivered\', \'Failed\')', [agent_id]);
    let alertText = null;

    for (const order of assigned) {
      if (order.status === 'Assigned') {
        const dist = getDistanceKM(lat, lng, order.pickup_lat, order.pickup_lng) * 1000;
        if (dist <= 100) alertText = `Rider within ${Math.round(dist)}m of Pickup #${order.id}. Ready to transition status: "Picked Up".`;
      } else if (['In Transit', 'Out for Delivery'].includes(order.status)) {
        const dist = getDistanceKM(lat, lng, order.drop_lat, order.drop_lng) * 1000;
        if (dist <= 100) alertText = `Rider within ${Math.round(dist)}m of Drop-off #${order.id}. Geofence unlocked. Ready to: "Mark Delivered".`;
      }
    }
    res.json({ success: true, current_lat: lat, current_lng: lng, alert: alertText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resetSimulation = async (req, res) => {
  try {
    await run('DROP TABLE IF EXISTS users');
    await run('DROP TABLE IF EXISTS zones');
    await run('DROP TABLE IF EXISTS rate_cards');
    await run('DROP TABLE IF EXISTS orders');
    await run('DROP TABLE IF EXISTS order_history');
    await run('DROP TABLE IF EXISTS notification_logs');
    await run('DROP TABLE IF EXISTS chat_messages');
    await run('DROP TABLE IF EXISTS ratings');
    
    await initDB();
    res.json({ success: true, message: 'Database reset' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
