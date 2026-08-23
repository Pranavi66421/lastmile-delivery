require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'lastmile_jwt_secret_change_in_prod_2026';
const JWT_EXPIRY = '12h';

// Password Hashing Helper using native pbkdf2
function hashPassword(password) {
  const salt = 'think_lastmile_salt_123';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ==========================================
// 1. DATABASE SCHEMA & INITIALIZATION
// ==========================================
const dbPath = path.resolve(__dirname, process.env.DATABASE_URL || 'database.db');

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

// Initialize schema and seed mock values on start
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

// ==========================================
// 2. GEOSPATIAL MATH SERVICES
// ==========================================
function getDistanceKM(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function detectZone(lat, lng) {
  const list = await all('SELECT * FROM zones');
  let closestZone = null;
  let minDistance = Infinity;

  for (const zone of list) {
    const dist = getDistanceKM(lat, lng, zone.center_lat, zone.center_lng);
    if (dist <= zone.radius_km) {
      if (dist < minDistance) {
        minDistance = dist;
        closestZone = zone;
      }
    }
  }
  return closestZone;
}

function verifyGeofence(agentLat, agentLng, dropLat, dropLng, thresholdMeters = 150) {
  const distKM = getDistanceKM(agentLat, agentLng, dropLat, dropLng);
  return (distKM * 1000) <= thresholdMeters;
}

// ==========================================
// 3. PRICING & VOLUME SERVICES
// ==========================================
function calculateVolumetricWeight(dimensions) {
  if (!dimensions || typeof dimensions !== 'string') return 0;
  const parts = dimensions.toLowerCase().split('x').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return 0;
  const [l, w, h] = parts;
  return (l * w * h) / 5000;
}

async function calculateOrderCharge(orderDetails) {
  const {
    pickup_lat, pickup_lng, drop_lat, drop_lng,
    dimensions, actual_weight, order_type, payment_type,
    weather = 'Sunny', traffic = 'Light'
  } = orderDetails;

  const pickupZone = await detectZone(pickup_lat, pickup_lng);
  const dropZone = await detectZone(drop_lat, drop_lng);

  const pickup_zone_id = pickupZone ? pickupZone.id : null;
  const drop_zone_id = dropZone ? dropZone.id : null;

  const volumetricWeight = calculateVolumetricWeight(dimensions);
  const billingWeight = Math.max(actual_weight, volumetricWeight);

  const rateCard = await get('SELECT * FROM rate_cards WHERE order_type = ?', [order_type]);
  if (!rateCard) throw new Error(`Rate card not found for: ${order_type}`);

  const isIntraZone = (pickup_zone_id !== null && drop_zone_id !== null && pickup_zone_id === drop_zone_id);
  const perKgRate = isIntraZone ? rateCard.intra_zone_rate_per_kg : rateCard.inter_zone_rate_per_kg;

  const baseCharge = rateCard.base_rate;
  const extraWeight = Math.max(0, billingWeight - rateCard.base_weight_kg);
  const zoneCharge = extraWeight * perKgRate;

  let codSurcharge = payment_type === 'COD' ? rateCard.cod_surcharge_flat : 0;
  const subtotal = baseCharge + zoneCharge + codSurcharge;

  let weatherPremiumPercent = weather === 'Rainy' ? 0.10 : (weather === 'Stormy' ? 0.20 : 0);
  let trafficPremiumPercent = traffic === 'Moderate' ? 0.08 : (traffic === 'Gridlock' ? 0.15 : 0);

  const weatherPremium = Number((subtotal * weatherPremiumPercent).toFixed(2));
  const trafficPremium = Number((subtotal * trafficPremiumPercent).toFixed(2));
  const totalCharge = Number((subtotal + weatherPremium + trafficPremium).toFixed(2));

  return {
    pickup_zone_id,
    drop_zone_id,
    pickup_zone_name: pickupZone ? pickupZone.name : 'Out of Mapped Area',
    drop_zone_name: dropZone ? dropZone.name : 'Out of Mapped Area',
    volumetric_weight: Number(volumetricWeight.toFixed(2)),
    billing_weight: Number(billingWeight.toFixed(2)),
    isIntraZone,
    base_charge: Number(baseCharge.toFixed(2)),
    zone_charge: Number(zoneCharge.toFixed(2)),
    cod_surcharge: Number(codSurcharge.toFixed(2)),
    weather_premium: weatherPremium,
    traffic_premium: trafficPremium,
    total_charge: totalCharge
  };
}

// ==========================================
// 4. ROUTE OPTIMIZATION SERVICES (VRP Heuristic)
// ==========================================
function optimizeRoute(startPoint, stops) {
  if (stops.length === 0) return { path: [startPoint], totalDistanceKM: 0 };

  const unvisited = [...stops];
  const path = [{ ...startPoint, label: 'Start (Agent)' }];
  let current = startPoint;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = getDistanceKM(current.lat, current.lng, unvisited[i].lat, unvisited[i].lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }

    current = unvisited[nearestIndex];
    path.push(current);
    unvisited.splice(nearestIndex, 1);
  }

  // 2-Opt refinement loop
  let improved = true;
  let bestDistance = calculatePathDistance(path);

  while (improved) {
    improved = false;
    for (let i = 1; i < path.length - 1; i++) {
      for (let j = i + 1; j < path.length; j++) {
        const newPath = [
          ...path.slice(0, i),
          ...path.slice(i, j + 1).reverse(),
          ...path.slice(j + 1)
        ];
        const newDistance = calculatePathDistance(newPath);
        if (newDistance < bestDistance - 0.001) {
          bestDistance = newDistance;
          for (let k = 0; k < path.length; k++) path[k] = newPath[k];
          improved = true;
        }
      }
    }
  }

  return { path, totalDistanceKM: Number(bestDistance.toFixed(2)) };
}

function calculatePathDistance(path) {
  let distance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    distance += getDistanceKM(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
  }
  return distance;
}

// ==========================================
// 5. AUTO DISPATCH AUTO-ASSIGNMENT SERVICE
// ==========================================
async function autoAssignAgent(order, excludeAgentId = null) {
  const { pickup_lat, pickup_lng } = order;
  let query = "SELECT id, username, current_lat, current_lng, rating, points FROM users WHERE role = 'agent' AND status = 'active'";
  const params = [];
  if (excludeAgentId) {
    query += " AND id != ?";
    params.push(excludeAgentId);
  }
  const agents = await all(query, params);
  
  if (agents.length === 0) return null;

  let bestAgent = null;
  let lowestScore = Infinity;

  for (const agent of agents) {
    if (agent.current_lat === null || agent.current_lng === null) continue;

    // Check active jobs count to enforce dynamic occupancy limits
    const activeLoad = await get("SELECT COUNT(*) as count FROM orders WHERE agent_id = ? AND status NOT IN ('Delivered', 'Failed')", [agent.id]);
    if (activeLoad && activeLoad.count >= 3) {
      continue; // Skip riders at max capacity (availability modeling)
    }

    const distKM = getDistanceKM(agent.current_lat, agent.current_lng, pickup_lat, pickup_lng);
    if (distKM > 25.0) continue; // max radius guard

    const ratingFactor = 1.3 - (agent.rating / 5.0); // suit score adjusted by gamification points
    const score = distKM * ratingFactor;

    if (score < lowestScore) {
      lowestScore = score;
      bestAgent = agent;
    }
  }
  return bestAgent;
}

// ==========================================
// 6. NOTIFICATION SYSTEM
// ==========================================
let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (err) {
    console.error('Failed to initialize Twilio client:', err);
  }
}

async function logNotification(orderId, type, recipient, message) {
  await run(
    'INSERT INTO notification_logs (order_id, type, recipient, message) VALUES (?, ?, ?, ?)',
    [orderId, type, recipient, message]
  );
}

function wrapEmail(orderId, title, contentHtml) {
  return `
    <div style="font-family: 'Outfit', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 25px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); max-width: 550px; margin: 15px auto; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; margin-bottom: 20px;">
        <span style="font-size: 1.15rem; font-weight: 700; color: #818cf8;">Think Last-Mile</span>
        <span style="font-size: 0.7rem; color: #cbd5e1; font-weight: 600; text-transform: uppercase; background-color: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99,102,241,0.25); padding: 2px 8px; border-radius: 12px;">Order #${orderId}</span>
      </div>
      <h2 style="font-size: 1.25rem; font-weight: 600; color: #ffffff; margin-top: 0; margin-bottom: 15px; border: none; padding: 0;">${title}</h2>
      <div style="font-size: 0.85rem; line-height: 1.6; color: #cbd5e1;">
        ${contentHtml}
      </div>
      <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 25px; font-size: 0.7rem; color: #94a3b8; text-align: center;">
        This is an automated notification from your Think Last-Mile logistics dashboard.
      </div>
    </div>
  `;
}

async function triggerOrderStatusNotifications(order, newStatus, remarks = '') {
  const customerEmail = order.customer_email || 'customer@example.com';
  const customerPhone = order.customer_phone || '+15550000';
  const orderId = order.id;

  let emailSubject = '';
  let emailHtml = '';
  let smsText = '';

  switch (newStatus) {
    case 'Created':
      emailSubject = `Order Created Successfully - Order #${orderId}`;
      emailHtml = wrapEmail(orderId, 'Order Placed Successfully', `
        <p>Your delivery request has been logged in our system. A courier will be assigned shortly.</p>
        <div style="background-color: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; margin: 15px 0;">
          <div style="margin-bottom: 6px;">📍 <strong>Pickup:</strong> ${order.pickup_address}</div>
          <div style="margin-bottom: 6px;">🎯 <strong>Drop-off:</strong> ${order.drop_address}</div>
          <div style="margin-bottom: 6px;">📦 <strong>SLA / Weight:</strong> ${order.order_type} | ${order.billing_weight} kg</div>
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin: 8px 0;" />
          <div style="display: flex; justify-content: space-between; font-weight: 700; color: #34d399; font-size: 0.95rem;">
            <span>Total Charge:</span>
            <span>$${order.total_charge.toFixed(2)}</span>
          </div>
        </div>
      `);
      smsText = `Order #${orderId} created successfully. Charge: $${order.total_charge.toFixed(2)}. We will notify you when a rider is assigned!`;
      break;

    case 'Assigned':
      emailSubject = `Courier Assigned to Order #${orderId}`;
      emailHtml = wrapEmail(orderId, 'Courier Dispatched', `
        <p>A delivery agent has been matched to your order and is currently heading to the pickup location.</p>
        <div style="background-color: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.15); border-radius: 8px; padding: 12px; margin: 15px 0;">
          <div style="font-weight: 600; color: #fff;">🏍️ Courier Assigned: <strong>${order.agent_name}</strong></div>
          <div style="font-size: 0.75rem; color: #fbbf24; margin-top: 4px;">Rider Rating: ⭐ ${order.agent_rating || '5.0'}</div>
        </div>
      `);
      smsText = `Rider ${order.agent_name} has been assigned to your order #${orderId} and is heading to pick up.`;
      break;

    case 'Picked Up':
      emailSubject = `Your Package Has Been Picked Up - Order #${orderId}`;
      emailHtml = wrapEmail(orderId, 'Package Picked Up', `
        <p>Our courier <strong>${order.agent_name}</strong> has picked up your package. The shipment is now on the move.</p>
        <div style="font-size: 0.8rem; color: #94a3b8; border-left: 2px solid #f59e0b; padding-left: 10px; margin: 15px 0;">
          Next step: Transit scanning and route dispatching.
        </div>
      `);
      smsText = `Rider ${order.agent_name} has picked up your package for order #${orderId}. It is now en route!`;
      break;

    case 'In Transit':
      emailSubject = `Transit Update - Order #${orderId}`;
      emailHtml = wrapEmail(orderId, 'Transit Update', `
        <p>Your order is currently in transit. Status update from route:</p>
        <div style="background-color: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; margin: 15px 0; font-style: italic;">
          "${remarks || 'Normal transit schedule'}"
        </div>
      `);
      smsText = `Order #${orderId} is en route. Status: ${remarks || 'Normal'}.`;
      break;

    case 'Out for Delivery':
      emailSubject = `Order Out for Delivery - Order #${orderId}`;
      emailHtml = wrapEmail(orderId, 'Out for Final Delivery', `
        <p>Get ready! Courier <strong>${order.agent_name}</strong> is out for the final delivery run to your address.</p>
        <div style="background-color: rgba(236, 72, 153, 0.05); border: 1px solid rgba(236, 72, 153, 0.15); border-radius: 8px; padding: 12px; margin: 15px 0;">
          📍 <strong>Drop Address:</strong> ${order.drop_address}
        </div>
      `);
      smsText = `Your package #${orderId} is out for final delivery with ${order.agent_name}.`;
      break;

    case 'Delivered':
      emailSubject = `Delivered! - Order #${orderId}`;
      emailHtml = wrapEmail(orderId, 'Order Delivered Successfully 🎉', `
        <p style="color: #34d399; font-weight: 600; font-size: 0.95rem; margin-top: 0;">Delivered!</p>
        <p>Your package has been successfully dropped off at the destination by courier <strong>${order.agent_name}</strong>.</p>
        <div style="background-color: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 8px; padding: 12px; margin: 15px 0;">
          Thank you for choosing Think Last-Mile logistics! Please rate your rider on your active dashboard view.
        </div>
      `);
      smsText = `Order #${orderId} has been successfully delivered. Rate your rider ${order.agent_name} on the app!`;
      break;

    case 'Failed':
      emailSubject = `Delivery Failed Attempt - Order #${orderId}`;
      emailHtml = wrapEmail(orderId, 'Delivery Attempt Unsuccessful ⚠️', `
        <p style="color: #f87171; font-weight: 600; font-size: 0.95rem; margin-top: 0;">Unsuccessful Attempt</p>
        <p>We attempted to deliver your order but were unsuccessful.</p>
        <div style="background-color: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 8px; padding: 12px; margin: 15px 0;">
          ❌ <strong>Reason for failure:</strong> ${remarks || 'Recipient unavailable'}<br/>
          📅 Please open your tracker dashboard to reschedule for a new date.
        </div>
      `);
      smsText = `Delivery attempt failed for order #${orderId} (Reason: ${remarks || 'Unsuccessful'}). Please reschedule on the dashboard.`;
      break;
  }

  if (emailSubject) {
    // Log SMS and Email to local sqlite audit
    await logNotification(orderId, 'Email', customerEmail, `Subject: ${emailSubject}\n\n${emailHtml}`);
    await logNotification(orderId, 'SMS', customerPhone, smsText);

    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'no-reply@thinklastmile.com',
          to: customerEmail,
          subject: emailSubject,
          html: emailHtml
        });
      } catch (err) {
        console.error('Nodemailer SMTP dispatch error:', err);
      }
    }

    if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
      try {
        await twilioClient.messages.create({
          body: smsText,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: customerPhone
        });
        console.log(`Twilio SMS sent to ${customerPhone}`);
      } catch (err) {
        console.error('Twilio SMS dispatch error:', err);
      }
    }
  }
}

// ==========================================
// 7. REST MIDDLEWARES & API ROUTING
// ==========================================

// JWT Auth Middleware — reads Bearer token from Authorization header
const authMiddleware = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, username: decoded.username, role: decoded.role };
  } catch (e) {
    req.user = null;
  }
  next();
};

// Role guard factory — call requireRole('admin') or requireRole('admin','agent') etc.
const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required. Please log in.' });
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}.` });
  }
  next();
};

app.use(authMiddleware);

// ---- AUTH ENDPOINTS ----

// Public registration: only customers can self-register.
// Agents and admins are provisioned by an admin.
app.post('/api/auth/register', async (req, res) => {
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
});

app.post('/api/auth/login', async (req, res) => {
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
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
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
});

// Admin-only: provision an agent or admin account
app.post('/api/admin/users', requireRole('admin'), async (req, res) => {
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
});

// ---- ZONE ENDPOINTS (admin-only writes, authenticated reads) ----
app.get('/api/zones', requireAuth, async (req, res) => {
  try {
    const zones = await all('SELECT * FROM zones');
    res.json(zones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/zones', requireRole('admin'), async (req, res) => {
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
});

app.delete('/api/zones/:id', requireRole('admin'), async (req, res) => {
  try {
    await run('DELETE FROM zones WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- RATE CARD ENDPOINTS (admin-only writes) ----
app.get('/api/rates', requireAuth, async (req, res) => {
  try {
    const rates = await all('SELECT * FROM rate_cards');
    res.json(rates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/rates/:id', requireRole('admin'), async (req, res) => {
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
});

// Orders Endpoints
app.post('/api/orders/calculate', async (req, res) => {
  try {
    const breakdown = await calculateOrderCharge(req.body);
    res.json(breakdown);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
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
});

// ---- ORDER ENDPOINTS ----
app.get('/api/orders', requireAuth, async (req, res) => {
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
});

app.get('/api/orders/:id', requireAuth, async (req, res) => {
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    // Ownership check: customers can only see their own orders
    if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. This is not your order.' });
    }
    // Agents can only see orders assigned to them
    if (req.user.role === 'agent' && order.agent_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. This order is not assigned to you.' });
    }
    const history = await all('SELECT * FROM order_history WHERE order_id = ? ORDER BY id ASC', [req.params.id]);
    res.json({ ...order, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/:id/assign', requireRole('admin'), async (req, res) => {
  const { agent_id } = req.body;
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    const agent = await get('SELECT id, username FROM users WHERE id = ? AND role = \'agent\'', [agent_id]);
    if (!order || !agent) return res.status(404).json({ error: 'Order or Rider not found' });

    const fromStatus = order.status;
    await run('UPDATE orders SET agent_id = ?, agent_name = ?, status = \'Assigned\' WHERE id = ?', [agent.id, agent.username, order.id]);
    await run('INSERT INTO order_history (order_id, from_status, to_status, updated_by_id, updated_by_username, remarks) VALUES (?, ?, \'Assigned\', ?, ?, ?)', [order.id, fromStatus, req.user.id, req.user.username, `Manual courier dispatch: ${agent.username}`]);

    const updated = await get('SELECT o.*, u.email as customer_email, u.phone as customer_phone, a.rating as agent_rating FROM orders o JOIN users u ON o.customer_id = u.id JOIN users a ON o.agent_id = a.id WHERE o.id = ?', [order.id]);
    await triggerOrderStatusNotifications(updated, 'Assigned');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/:id/auto-assign', requireRole('admin'), async (req, res) => {
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
});

app.post('/api/orders/:id/status', requireRole('agent', 'admin'), async (req, res) => {
  const { status, remarks } = req.body;
  const VALID_STATUSES = ['Assigned', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed'];
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    // Agents can only update orders assigned to them
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
});

// Reschedule Slots Efficiency Lookup (customer can only look up their own order)
app.get('/api/orders/:id/reschedule-slots', requireAuth, async (req, res) => {
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
      // Count existing orders in the same zone on that date
      const result = await get(
        `SELECT COUNT(*) as count FROM orders 
         WHERE (pickup_zone_id = ? OR drop_zone_id = ?) 
           AND (reschedule_date = ? OR (reschedule_date IS NULL AND date(created_at) = ?))`,
        [zoneId, zoneId, date, date]
      );
      count = result ? result.count : 0;
    }
    
    // Dynamic efficiency modeling based on zone order density
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
});

app.post('/api/orders/:id/reschedule', requireAuth, async (req, res) => {
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

    // Check if slot has co-routing potential (efficiency >= 70%)
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
    // Dispatch closest rider EXCLUDING the previous agent who failed
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
});

// Routing Optimization Endpoint (admin only)
app.post('/api/routing/optimize', requireRole('admin'), async (req, res) => {
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
});

// Logistics & Notifications Utilities
app.get('/api/agents', requireAuth, async (req, res) => {
  try {
    const list = await all('SELECT id, username, current_lat, current_lng, rating, points, status FROM users WHERE role = \'agent\'');
    const enriched = await Promise.all(list.map(async agent => {
      const activeObj = await get("SELECT COUNT(*) as count FROM orders WHERE agent_id = ? AND status NOT IN ('Delivered', 'Failed')", [agent.id]);
      return {
        ...agent,
        active_jobs: activeObj ? activeObj.count : 0
      };
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notifications', requireRole('admin'), async (req, res) => {
  try {
    const logs = await all('SELECT * FROM notification_logs ORDER BY id DESC LIMIT 40');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customers', requireRole('admin'), async (req, res) => {
  try {
    const list = await all('SELECT id, username, email, phone FROM users WHERE role = \'customer\'');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:id/messages', requireAuth, async (req, res) => {
  try {
    // Ownership check
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
});

app.post('/api/orders/:id/messages', async (req, res) => {
  const { message } = req.body;
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
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
});

// Reset Simulation Endpoint (admin only)
app.post('/api/simulation/reset', requireRole('admin'), async (req, res) => {
  try {
    await run('DROP TABLE IF EXISTS users');
    await run('DROP TABLE IF EXISTS zones');
    await run('DROP TABLE IF EXISTS rate_cards');
    await run('DROP TABLE IF EXISTS orders');
    await run('DROP TABLE IF EXISTS order_history');
    await run('DROP TABLE IF EXISTS notification_logs');
    await run('DROP TABLE IF EXISTS chat_messages');
    
    await initDB();
    res.json({ success: true, message: 'Database reset' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update agent coordinates during simulation drive (agent can only update their own GPS)
app.post('/api/simulation/agent-gps', requireRole('agent', 'admin'), async (req, res) => {
  // Agents can only update their own GPS; admins can update any
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
});

// Start Express only if run directly, not when required by tests
if (require.main === module) {
  initDB().then(() => {
    app.listen(PORT, () => console.log(`Consolidated API running on http://localhost:${PORT}`));
  }).catch(e => console.error('Database setup failed:', e));
}

module.exports = {
  getDistanceKM,
  verifyGeofence,
  calculateVolumetricWeight,
  optimizeRoute,
  calculateOrderCharge,
  autoAssignAgent,
  detectZone,
  initDB
};

