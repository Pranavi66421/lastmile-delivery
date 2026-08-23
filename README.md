# Enterprise Last-Mile Delivery Tracker & Route Optimizer

A premium, interactive delivery management dashboard built to solve vehicle routing challenges, dynamic zone rates, and automated courier dispatches. 

---

## Key Differentiators (What makes this project unique)
- **Unified Role Simulation View**: Test the entire delivery lifecycle side-by-side: place an order as a **Customer**, assign couriers or calculate vehicle routes as an **Admin**, and simulate GPS courier movement towards destinations on a **Courier mobile device**.
- **Interactive Leaflet Map**: Visualize dynamic operational zones (circles), pickup/drop lines, active riders, and optimal multi-stop route paths.
- **Dynamic Environmental Pricing**: Surcharges apply automatically during peak traffic or storm weather conditions.
- **Geofenced Verification**: Couriers are prevented from completing deliveries unless they are within 150 meters of the drop location.
- **XP Leaderboard**: Performance-based gamification tracks XP points (earned through successful geofenced drop-offs) and courier ratings.
- **Co-Routing Rescheduling Heatmap**: Reschedule failed deliveries using suggested green slots where couriers are already scheduled to pass near, reducing transit distance.

---

## Tech Stack
- **Backend**: Node.js, Express, SQLite3 (zero-configuration database, seeds default data automatically).
- **Frontend**: React, Vite, Leaflet, React-Leaflet, Lucide Icons, Recharts.
- **Styling**: Modern dark glassmorphic CSS.

---

## Quick Start Guide

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### Setup & Run
1. Clone the project and navigate into the workspace.
2. Install all dependencies for both directories:
   ```bash
   npm run install:all
   ```
3. Initialize the environment configuration:
   ```bash
   copy .env.example .env
   ```
4. Start both the Express API server and Vite React app concurrently:
   ```bash
   npm run dev
   ```
5. Open your browser to `http://localhost:3000` to interact with the dashboard. (The backend runs on `http://localhost:5000`).

*Note: The SQLite database file `database.db` is automatically created on startup inside the `backend` folder and seeded with sample zones, rate cards, and mock users.*

---

## Seed Accounts (For login and testing)
| Username | Password | Role | Operational Coordinates / Details |
| :--- | :--- | :--- | :--- |
| **admin** | `admin123` | Admin | Access rate management, zones, routing optimizer |
| **customer1** | `cust123` | Customer | Places orders, tracking timeline, rescheduling |
| **agent_soho** | `agent123` | Agent | Manhattan rider (Soho coordinates) |
| **agent_midtown**| `agent123` | Agent | Manhattan rider (Midtown coordinates) |
| **agent_brooklyn**| `agent123` | Agent | Brooklyn rider (Brooklyn Heights coordinates) |

---

## Database Schemas & Data Model

### 1. `users`
Tracks registered accounts (customers, admins, and active couriers with coordinate locations).
```sql
CREATE TABLE users (
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
);
```

### 2. `zones`
Tracks logistics boundaries modeled as circles.
```sql
CREATE TABLE zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  radius_km REAL NOT NULL
);
```

### 3. `rate_cards`
Maintains pricing variables for SLA contracts.
```sql
CREATE TABLE rate_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_type TEXT CHECK(order_type IN ('B2B', 'B2C')) UNIQUE NOT NULL,
  base_weight_kg REAL NOT NULL,
  base_rate REAL NOT NULL,
  intra_zone_rate_per_kg REAL NOT NULL,
  inter_zone_rate_per_kg REAL NOT NULL,
  cod_surcharge_flat REAL NOT NULL
);
```

### 4. `orders`
Primary order records.
```sql
CREATE TABLE orders (
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
  status TEXT DEFAULT 'Created',
  reschedule_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(customer_id) REFERENCES users(id),
  FOREIGN KEY(agent_id) REFERENCES users(id)
);
```

### 5. `order_history`
Immutable tracking logs for security compliance audits.
```sql
CREATE TABLE order_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  updated_by_id INTEGER NOT NULL,
  updated_by_username TEXT NOT NULL,
  remarks TEXT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);
```

---

## Primary API Endpoints

### Authentication
- `POST /api/auth/register` - Create a new customer, admin, or agent profile.
- `POST /api/auth/login` - Validate password credentials and return user profile.
- `GET /api/auth/me` - Read session profile.

### Operations
- `GET /api/zones` - List defined circular operational zones.
- `POST /api/zones` - Define a new zone circle (lat, lng, radius in km).
- `GET /api/rates` - Get active rate cards.
- `PUT /api/rates/:id` - Modify rate variables.

### Logistics & Routing
- `POST /api/orders/calculate` - Estimate charge breakdown for package coordinates.
- `POST /api/orders` - Place a delivery order. Auto-detects zones and writes to history.
- `GET /api/orders` - List orders (filtered by client role).
- `POST /api/orders/:id/auto-assign` - Dispatches the closest active agent based on quality score:
  $$S = \text{Distance} \times \left(1.3 - \frac{\text{Courier Rating}}{5.0}\right)$$
- `POST /api/orders/:id/status` - Transition status (guards geofence constraints).
- `POST /api/routing/optimize` - Solves Vehicle Routing (TSP) using Nearest-Neighbor construction with 2-Opt local refinement.
