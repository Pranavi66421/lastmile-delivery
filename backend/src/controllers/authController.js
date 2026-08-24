const { get, run } = require('../config/db');
const { hashPassword, signToken } = require('../utils/auth');

exports.register = async (req, res) => {
  const { username, password, email, phone } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  try {
    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(409).json({ error: 'Username already taken.' });
    const result = await run(
      'INSERT INTO users (username, password, role, email, phone) VALUES (?, ?, \'customer\', ?, ?)',
      [username.trim().toLowerCase(), hashPassword(password), email || null, phone || null]
    );
    const newUser = { id: result.id, username, role: 'customer', email, phone, rating: 5.0, points: 0 };
    const token = signToken(newUser);
    res.status(201).json({ token, user: newUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  try {
    const user = await get(
      'SELECT id, username, password, role, email, phone, current_lat, current_lng, rating, points, status FROM users WHERE username = ?',
      [username.trim().toLowerCase()]
    );
    if (!user || user.password !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Your account has been deactivated. Contact support.' });
    }
    const payload = { id: user.id, username: user.username, role: user.role, email: user.email, phone: user.phone, current_lat: user.current_lat, current_lng: user.current_lng, rating: user.rating, points: user.points };
    const token = signToken(payload);
    res.json({ token, user: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await get(
      'SELECT id, username, role, email, phone, current_lat, current_lng, rating, points FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.adminProvisionUser = async (req, res) => {
  const { username, password, role, email, phone } = req.body;
  if (!username || !password || !['agent', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'username, password, and role (agent|admin) are required.' });
  }
  try {
    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(409).json({ error: 'Username already taken.' });
    let lat = null, lng = null;
    if (role === 'agent') {
      lat = 40.75 + (Math.random() - 0.5) * 0.05;
      lng = -73.98 + (Math.random() - 0.5) * 0.05;
    }
    const result = await run(
      'INSERT INTO users (username, password, role, email, phone, current_lat, current_lng) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hashPassword(password), role, email || null, phone || null, lat, lng]
    );
    res.status(201).json({ id: result.id, username, role, email, phone, current_lat: lat, current_lng: lng });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAgents = async (req, res) => {
  try {
    const { all } = require('../config/db'); // require inside to avoid circular dep if needed, but it's safe at top too
    const dbAll = require('../config/db').all;
    const dbGet = require('../config/db').get;
    
    const list = await dbAll('SELECT id, username, current_lat, current_lng, rating, points, status FROM users WHERE role = \'agent\'');
    const enriched = await Promise.all(list.map(async agent => {
      const activeObj = await dbGet("SELECT COUNT(*) as count FROM orders WHERE agent_id = ? AND status NOT IN ('Delivered', 'Failed')", [agent.id]);
      return {
        ...agent,
        active_jobs: activeObj ? activeObj.count : 0
      };
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const { all } = require('../config/db');
    const list = await all('SELECT id, username, email, phone FROM users WHERE role = \'customer\'');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
