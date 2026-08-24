const { all, run } = require('../config/db');

exports.getZones = async (req, res) => {
  try {
    const zones = await all('SELECT * FROM zones');
    res.json(zones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createZone = async (req, res) => {
  const { name, center_lat, center_lng, radius_km } = req.body;
  if (!name || !center_lat || !center_lng || !radius_km) {
    return res.status(400).json({ error: 'All zone fields are required.' });
  }
  try {
    const result = await run(
      'INSERT INTO zones (name, center_lat, center_lng, radius_km) VALUES (?, ?, ?, ?)',
      [name, parseFloat(center_lat), parseFloat(center_lng), parseFloat(radius_km)]
    );
    res.status(201).json({ id: result.id, name, center_lat, center_lng, radius_km });
  } catch (err) {
    res.status(500).json({ error: 'Zone name must be unique.' });
  }
};

exports.deleteZone = async (req, res) => {
  try {
    await run('DELETE FROM zones WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRates = async (req, res) => {
  try {
    const rates = await all('SELECT * FROM rate_cards');
    res.json(rates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRate = async (req, res) => {
  const { base_weight_kg, base_rate, intra_zone_rate_per_kg, inter_zone_rate_per_kg, cod_surcharge_flat } = req.body;
  try {
    await run(
      'UPDATE rate_cards SET base_weight_kg = ?, base_rate = ?, intra_zone_rate_per_kg = ?, inter_zone_rate_per_kg = ?, cod_surcharge_flat = ? WHERE id = ?',
      [parseFloat(base_weight_kg), parseFloat(base_rate), parseFloat(intra_zone_rate_per_kg), parseFloat(inter_zone_rate_per_kg), parseFloat(cod_surcharge_flat), req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
