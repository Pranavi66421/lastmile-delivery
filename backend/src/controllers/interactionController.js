const { get, all, run } = require('../config/db');

exports.getMessages = async (req, res) => {
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (req.user.role === 'agent' && order.agent_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const list = await all('SELECT * FROM chat_messages WHERE order_id = ? ORDER BY id ASC', [req.params.id]);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendMessage = async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message content required' });
  try {
    const result = await run(
      'INSERT INTO chat_messages (order_id, sender_id, sender_name, message) VALUES (?, ?, ?, ?)',
      [req.params.id, req.user.id, req.user.username, message]
    );
    
    // Auto-reply logic for customer message
    const orderObj = await get('SELECT status, agent_name FROM orders WHERE id = ?', [req.params.id]);
    if (orderObj && req.user.role === 'customer') {
      setTimeout(async () => {
        let replyText = "Got it! I am currently handling your delivery.";
        if (orderObj.status === 'Assigned') replyText = `Hello! I have been assigned. Heading to pickup now.`;
        else if (orderObj.status === 'Picked Up') replyText = `Package is picked up! Starting transit.`;
        else if (orderObj.status === 'Out for Delivery') replyText = `I am nearby your drop address, arriving in a few minutes.`;
        
        await run(
          'INSERT INTO chat_messages (order_id, sender_id, sender_name, message) VALUES (?, 0, ?, ?)',
          [req.params.id, orderObj.agent_name || 'Rider', replyText]
        );
      }, 1000);
    }

    res.status(201).json({ id: result.id, order_id: parseInt(req.params.id), sender_id: req.user.id, sender_name: req.user.username, message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    let logs;
    if (req.user.role === 'admin') {
      logs = await all('SELECT * FROM notification_logs ORDER BY id DESC LIMIT 40');
    } else if (req.user.role === 'customer') {
      logs = await all(
        `SELECT n.* FROM notification_logs n
         JOIN orders o ON n.order_id = o.id
         WHERE o.customer_id = ?
         ORDER BY n.id DESC LIMIT 40`,
        [req.user.id]
      );
    } else {
      return res.status(403).json({ error: 'Access denied.' });
    }
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
