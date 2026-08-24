const { get, all, run } = require('../config/db');
const { calculateOrderCharge } = require('../services/pricingService');
const { triggerOrderStatusNotifications } = require('../services/notificationService');
const { autoAssignAgent } = require('../services/dispatchService');
const { verifyGeofence } = require('../services/geoService');

exports.calculate = async (req, res) => {
  try {
    const breakdown = await calculateOrderCharge(req.body);
    res.json(breakdown);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.createOrder = async (req, res) => {
  const { pickup_address, pickup_lat, pickup_lng, drop_address, drop_lat, drop_lng, dimensions, actual_weight, order_type, payment_type, weather, traffic } = req.body;
  
  if (!pickup_address || !drop_address) return res.status(400).json({ error: 'Pickup and drop address descriptions are required.' });
  const pLat = parseFloat(pickup_lat);
  const pLng = parseFloat(pickup_lng);
  const dLat = parseFloat(drop_lat);
  const dLng = parseFloat(drop_lng);
  const actWt = parseFloat(actual_weight);
  
  if (isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) {
    return res.status(400).json({ error: 'Pickup and drop coordinates must be valid numbers.' });
  }
  if (isNaN(actWt) || actWt <= 0) {
    return res.status(400).json({ error: 'Actual weight must be a positive number.' });
  }
  if (!dimensions || typeof dimensions !== 'string' || !dimensions.toLowerCase().includes('x')) {
    return res.status(400).json({ error: 'Dimensions must be formatted as LxWxH (e.g. 30x20x15).' });
  }
  if (!['B2B', 'B2C'].includes(order_type)) {
    return res.status(400).json({ error: 'Order type must be B2B or B2C.' });
  }
  if (!['Prepaid', 'COD'].includes(payment_type)) {
    return res.status(400).json({ error: 'Payment type must be Prepaid or COD.' });
  }

  try {
    const pricing = await calculateOrderCharge({ pickup_lat, pickup_lng, drop_lat, drop_lng, dimensions, actual_weight, order_type, payment_type, weather, traffic });
    
    let customerId = req.user.id;
    let customerName = req.user.username;
    
    if (req.user.role === 'admin' && req.body.customer_id) {
      customerId = parseInt(req.body.customer_id);
      const custUser = await get('SELECT username FROM users WHERE id = ?', [customerId]);
      if (custUser) customerName = custUser.username;
    }

    const result = await run(
      `INSERT INTO orders (customer_id, customer_name, pickup_address, pickup_lat, pickup_lng, drop_address, drop_lat, drop_lng, pickup_zone_id, drop_zone_id, dimensions, actual_weight, volumetric_weight, billing_weight, order_type, payment_type, base_charge, zone_charge, cod_surcharge, weather_premium, traffic_premium, total_charge) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, customerName, pickup_address, pickup_lat, pickup_lng, drop_address, drop_lat, drop_lng, pricing.pickup_zone_id, pricing.drop_zone_id, dimensions, actual_weight, pricing.volumetric_weight, pricing.billing_weight, order_type, payment_type, pricing.base_charge, pricing.zone_charge, pricing.cod_surcharge, pricing.weather_premium, pricing.traffic_premium, pricing.total_charge]
    );

    const orderId = result.id;
    await run('INSERT INTO order_history (order_id, from_status, to_status, updated_by_id, updated_by_username, remarks) VALUES (?, NULL, \'Created\', ?, ?, \'Order created\')', [orderId, req.user.id, req.user.username]);

    const orderObj = await get('SELECT o.*, u.email as customer_email, u.phone as customer_phone FROM orders o JOIN users u ON o.customer_id = u.id WHERE o.id = ?', [orderId]);
    await triggerOrderStatusNotifications(orderObj, 'Created');
    res.status(201).json(orderObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    let list;
    if (req.user.role === 'customer') {
      list = await all(
        `SELECT o.*, oh.to_status as latest_status FROM orders o
         LEFT JOIN (SELECT order_id, MAX(id) as max_id FROM order_history GROUP BY order_id) lh ON o.id = lh.order_id
         LEFT JOIN order_history oh ON oh.id = lh.max_id
         WHERE o.customer_id = ? ORDER BY o.id DESC`,
        [req.user.id]
      );
    } else if (req.user.role === 'agent') {
      list = await all('SELECT * FROM orders WHERE agent_id = ? ORDER BY id DESC', [req.user.id]);
    } else if (req.user.role === 'admin') {
      list = await all('SELECT * FROM orders ORDER BY id DESC');
    } else {
      return res.status(403).json({ error: 'Access denied.' });
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. This is not your order.' });
    }
    if (req.user.role === 'agent' && order.agent_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. This order is not assigned to you.' });
    }
    const history = await all('SELECT * FROM order_history WHERE order_id = ? ORDER BY id ASC', [req.params.id]);
    res.json({ ...order, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.autoAssign = async (req, res) => {
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const agent = await autoAssignAgent(order);
    if (!agent) return res.status(404).json({ error: 'No active delivery riders found in operational range' });

    const fromStatus = order.status;
    await run('UPDATE orders SET agent_id = ?, agent_name = ?, status = \'Assigned\' WHERE id = ?', [agent.id, agent.username, order.id]);

    const actorId = req.user ? req.user.id : 1;
    const actorName = req.user ? req.user.username : 'admin';
    await run('INSERT INTO order_history (order_id, from_status, to_status, updated_by_id, updated_by_username, remarks) VALUES (?, ?, \'Assigned\', ?, ?, ?)', [order.id, fromStatus, actorId, actorName, `Auto-dispatched nearest rider: ${agent.username}`]);

    const updated = await get('SELECT o.*, u.email as customer_email, u.phone as customer_phone, a.rating as agent_rating FROM orders o JOIN users u ON o.customer_id = u.id JOIN users a ON o.agent_id = a.id WHERE o.id = ?', [order.id]);
    await triggerOrderStatusNotifications(updated, 'Assigned');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  const { status, remarks } = req.body;
  const VALID_STATUSES = ['Assigned', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed'];
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (req.user.role === 'agent' && order.agent_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. This order is not assigned to you.' });
    }
    const fromStatus = order.status;
    const actorId = req.user.id;
    const actorName = req.user.username;

    // Geofencing checks
    if (status === 'Delivered') {
      const agent = await get('SELECT current_lat, current_lng FROM users WHERE id = ?', [order.agent_id]);
      if (agent && agent.current_lat !== null && agent.current_lng !== null) {
        const isNear = verifyGeofence(agent.current_lat, agent.current_lng, order.drop_lat, order.drop_lng, 150);
        if (!isNear) {
          await run('INSERT INTO order_history (order_id, from_status, to_status, updated_by_id, updated_by_username, remarks) VALUES (?, ?, ?, ?, ?, ?)', [order.id, fromStatus, fromStatus, actorId, actorName, 'SECURITY ALERT: Geofence mismatch blocked completion.']);
          return res.status(400).json({ error: 'Geofence Guard Alert: You must be within 150m of drop coordinate to complete delivery.' });
        }
      }
    }

    // Award Points
    if (status === 'Delivered' && fromStatus !== 'Delivered') {
      await run('UPDATE users SET points = points + 15 WHERE id = ?', [order.agent_id]);
    }

    await run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, order.id]);
    await run('INSERT INTO order_history (order_id, from_status, to_status, updated_by_id, updated_by_username, remarks) VALUES (?, ?, ?, ?, ?, ?)', [order.id, fromStatus, status, actorId, actorName, remarks || `Status set to ${status}`]);

    const updated = await get('SELECT o.*, u.email as customer_email, u.phone as customer_phone FROM orders o JOIN users u ON o.customer_id = u.id WHERE o.id = ?', [order.id]);
    await triggerOrderStatusNotifications(updated, status, remarks);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.rateOrder = async (req, res) => {
  const { rating } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order || order.customer_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    if (order.status !== 'Delivered') return res.status(400).json({ error: 'Can only rate delivered orders' });
    
    await run('INSERT INTO ratings (order_id, agent_id, rating) VALUES (?, ?, ?)', [order.id, order.agent_id, rating]);
    const avgObj = await get('SELECT AVG(rating) as avg FROM ratings WHERE agent_id = ?', [order.agent_id]);
    const newAvg = avgObj.avg ? Number(avgObj.avg.toFixed(1)) : 5.0;
    await run('UPDATE users SET rating = ? WHERE id = ?', [newAvg, order.agent_id]);
    
    res.json({ success: true, newRating: newAvg });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'You have already rated this rider for this order' });
    res.status(500).json({ error: err.message });
  }
};

exports.getRescheduleSlots = async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date parameter required' });
  
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    
    const zoneId = order.pickup_zone_id || order.drop_zone_id;
    let count = 0;
    if (zoneId) {
      const result = await get(
        `SELECT COUNT(*) as count FROM orders 
         WHERE (pickup_zone_id = ? OR drop_zone_id = ?) 
           AND (reschedule_date = ? OR (reschedule_date IS NULL AND date(created_at) = ?))`,
        [zoneId, zoneId, date, date]
      );
      count = result ? result.count : 0;
    }
    
    const hasCoRoute = count > 0;
    res.json({
      date,
      count,
      slots: [
        { name: 'morning', label: '9 AM - 12 PM', efficiency: hasCoRoute ? 92 : 30, coRouteFound: hasCoRoute },
        { name: 'afternoon', label: '12 PM - 3 PM', efficiency: hasCoRoute ? 88 : 35, coRouteFound: hasCoRoute },
        { name: 'evening', label: '3 PM - 6 PM', efficiency: hasCoRoute ? 45 : 20, coRouteFound: hasCoRoute }
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.rescheduleOrder = async (req, res) => {
  const { reschedule_date, reschedule_slot } = req.body;
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (order.status !== 'Failed') return res.status(400).json({ error: 'Order must be in Failed state to reschedule.' });

    const fromStatus = order.status;
    const actorId = req.user ? req.user.id : order.customer_id;
    const actorName = req.user ? req.user.username : (order.customer_name || 'customer');
    const previousAgentId = order.agent_id;

    const zoneId = order.pickup_zone_id || order.drop_zone_id;
    let count = 0;
    if (zoneId && reschedule_date) {
      const result = await get(
        `SELECT COUNT(*) as count FROM orders 
         WHERE (pickup_zone_id = ? OR drop_zone_id = ?) 
           AND (reschedule_date = ? OR (reschedule_date IS NULL AND date(created_at) = ?))`,
        [zoneId, zoneId, reschedule_date, reschedule_date]
      );
      count = result ? result.count : 0;
    }

    const hasCoRouteDiscount = count > 0;
    let newTotalCharge = order.total_charge;
    let discountApplied = 0;
    let remarks = `Rescheduled for ${reschedule_date} (${reschedule_slot || 'Standard Slot'}).`;

    if (hasCoRouteDiscount && order.discount_applied === 0) {
      discountApplied = 1;
      newTotalCharge = Number((order.total_charge * 0.9).toFixed(2));
      remarks += ` 10% Green Co-Routing discount applied! Saved $${(order.total_charge - newTotalCharge).toFixed(2)}.`;
    }

    await run(
      "UPDATE orders SET status = 'Created', agent_id = NULL, agent_name = NULL, reschedule_date = ?, reschedule_slot = ?, discount_applied = ?, total_charge = ? WHERE id = ?",
      [reschedule_date, reschedule_slot || null, discountApplied || order.discount_applied, newTotalCharge, order.id]
    );
    await run('INSERT INTO order_history (order_id, from_status, to_status, updated_by_id, updated_by_username, remarks) VALUES (?, ?, \'Created\', ?, ?, ?)', [order.id, fromStatus, actorId, actorName, remarks]);

    const updated = await get('SELECT * FROM orders WHERE id = ?', [order.id]);
    const bestAgent = await autoAssignAgent(updated, previousAgentId);
    if (bestAgent) {
      await run('UPDATE orders SET agent_id = ?, agent_name = ?, status = \'Assigned\' WHERE id = ?', [bestAgent.id, bestAgent.username, order.id]);
      await run('INSERT INTO order_history (order_id, from_status, to_status, updated_by_id, updated_by_username, remarks) VALUES (?, \'Created\', \'Assigned\', 1, \'system\', ?)', [order.id, `Re-assigned closest rider ${bestAgent.username}.`]);
    }

    const finalObj = await get('SELECT o.*, u.email as customer_email, u.phone as customer_phone FROM orders o JOIN users u ON o.customer_id = u.id WHERE o.id = ?', [order.id]);
    res.json(finalObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
