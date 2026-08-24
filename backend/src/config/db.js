const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { hashPassword } = require('../utils/auth');

const dbPath = path.resolve(__dirname, '../../', process.env.DATABASE_URL || 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('SQLite connection error:', err);
  else console.log(`Connected to SQLite database at ${dbPath}`);
});

// Promise-based helpers for database interactions
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const initDB = async () => {
  // Users Table
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'customer', 'agent')) NOT NULL,
    email TEXT,
    phone TEXT,
    current_lat REAL,
    current_lng REAL,
    status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
    rating REAL DEFAULT 5.0,
    points INTEGER DEFAULT 0
  )`);

  // Zones Table
  await run(`CREATE TABLE IF NOT EXISTS zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    center_lat REAL NOT NULL,
    center_lng REAL NOT NULL,
    radius_km REAL NOT NULL
  )`);

  // Rate Cards Table
  await run(`CREATE TABLE IF NOT EXISTS rate_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_type TEXT CHECK(order_type IN ('B2B', 'B2C')) UNIQUE NOT NULL,
    base_weight_kg REAL NOT NULL,
    base_rate REAL NOT NULL,
    intra_zone_rate_per_kg REAL NOT NULL,
    inter_zone_rate_per_kg REAL NOT NULL,
    cod_surcharge_flat REAL NOT NULL
  )`);

  // Orders Table
  await run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    customer_name TEXT,
    agent_id INTEGER,
    agent_name TEXT,
    pickup_address TEXT NOT NULL,
    pickup_lat REAL NOT NULL,
    pickup_lng REAL NOT NULL,
    drop_address TEXT NOT NULL,
    drop_lat REAL NOT NULL,
    drop_lng REAL NOT NULL,
    pickup_zone_id INTEGER,
    drop_zone_id INTEGER,
    dimensions TEXT NOT NULL,
    actual_weight REAL NOT NULL,
    volumetric_weight REAL NOT NULL,
    billing_weight REAL NOT NULL,
    order_type TEXT NOT NULL,
    payment_type TEXT NOT NULL,
    base_charge REAL NOT NULL,
    zone_charge REAL NOT NULL,
    cod_surcharge REAL NOT NULL,
    weather_premium REAL DEFAULT 0.0,
    traffic_premium REAL DEFAULT 0.0,
    total_charge REAL NOT NULL,
    status TEXT CHECK(status IN ('Created', 'Assigned', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed')) DEFAULT 'Created',
    reschedule_date TEXT,
    reschedule_slot TEXT,
    discount_applied INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES users(id),
    FOREIGN KEY(agent_id) REFERENCES users(id)
  )`);

  // Immutable Order Tracking History
  await run(`CREATE TABLE IF NOT EXISTS order_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    updated_by_id INTEGER NOT NULL,
    updated_by_username TEXT NOT NULL,
    remarks TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id)
  )`);

  // Notification Logs
  await run(`CREATE TABLE IF NOT EXISTS notification_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    type TEXT CHECK(type IN ('Email', 'SMS')) NOT NULL,
    recipient TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'Sent',
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Ratings Table
  await run(`CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL UNIQUE,
    agent_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Interactive Chat Messages
  await run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id)
  )`);

  // Migration checks for existing databases
  const orderColumns = await all("PRAGMA table_info(orders)");
  const hasRescheduleSlot = orderColumns.some(c => c.name === 'reschedule_slot');
  if (!hasRescheduleSlot) {
    await run("ALTER TABLE orders ADD COLUMN reschedule_slot TEXT");
    console.log("Migration: Added column reschedule_slot to orders table.");
  }
  const hasDiscountApplied = orderColumns.some(c => c.name === 'discount_applied');
  if (!hasDiscountApplied) {
    await run("ALTER TABLE orders ADD COLUMN discount_applied INTEGER DEFAULT 0");
    console.log("Migration: Added column discount_applied to orders table.");
  }

  // Seed sample values if the DB is brand new
  const countObj = await get('SELECT COUNT(*) as count FROM users');
  if (countObj.count === 0) {
    console.log('Seeding database with default mock resources...');
    
    // Seed logins with hashed passwords
    await run(`INSERT INTO users (username, password, role, email, phone) VALUES 
      ('admin', ?, 'admin', 'admin@thinklastmile.com', '+15550100'),
      ('customer1', ?, 'customer', 'customer1@gmail.com', '+15550101'),
      ('customer2', ?, 'customer', 'customer2@gmail.com', '+15550102')
    `, [hashPassword('admin123'), hashPassword('cust123'), hashPassword('cust123')]);

    // Seed agents around Manhattan/Brooklyn with hashed passwords
    await run(`INSERT INTO users (username, password, role, email, phone, current_lat, current_lng, rating, points) VALUES 
      ('agent_soho', ?, 'agent', 'soho_rider@delivery.com', '+15550201', 40.7250, -74.0100, 4.8, 120),
      ('agent_midtown', ?, 'agent', 'midtown_rider@delivery.com', '+15550202', 40.7500, -73.9900, 4.5, 80),
      ('agent_brooklyn', ?, 'agent', 'brooklyn_rider@delivery.com', '+15550203', 40.6920, -73.9880, 4.9, 210),
      ('agent_queens', ?, 'agent', 'queens_rider@delivery.com', '+15550204', 40.7420, -73.9490, 4.2, 50)
    `, [hashPassword('agent123'), hashPassword('agent123'), hashPassword('agent123'), hashPassword('agent123')]);

    // Seed zones
    await run(`INSERT INTO zones (name, center_lat, center_lng, radius_km) VALUES 
      ('Manhattan Core', 40.7589, -73.9851, 4.0),
      ('Brooklyn Heights', 40.6924, -73.9903, 3.0),
      ('Queens West', 40.7420, -73.9490, 3.5)
    `);

    // Seed rates dynamically from environmental variables
    const baseRateB2B = parseFloat(process.env.BASE_RATE_B2B || '20.0');
    const baseRateB2C = parseFloat(process.env.BASE_RATE_B2C || '15.0');
    const intraZoneB2B = parseFloat(process.env.INTRA_ZONE_RATE_KG_B2B || '5.0');
    const intraZoneB2C = parseFloat(process.env.INTRA_ZONE_RATE_KG_B2C || '4.0');
    const interZoneB2B = parseFloat(process.env.INTER_ZONE_RATE_KG_B2B || '10.0');
    const interZoneB2C = parseFloat(process.env.INTER_ZONE_RATE_KG_B2C || '8.0');
    const codB2B = parseFloat(process.env.COD_SURCHARGE_FLAT_B2B || '15.0');
    const codB2C = parseFloat(process.env.COD_SURCHARGE_FLAT_B2C || '10.0');

    await run(`INSERT INTO rate_cards (order_type, base_weight_kg, base_rate, intra_zone_rate_per_kg, inter_zone_rate_per_kg, cod_surcharge_flat) VALUES 
      ('B2B', 5.0, ?, ?, ?, ?),
      ('B2C', 2.0, ?, ?, ?, ?)
    `, [baseRateB2B, intraZoneB2B, interZoneB2B, codB2B, baseRateB2C, intraZoneB2C, interZoneB2C, codB2C]);

    console.log('Seeding completed.');
  }
};

module.exports = {
  db,
  run,
  get,
  all,
  initDB
};
