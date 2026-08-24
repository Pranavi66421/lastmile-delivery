require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./config/db');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Main API Routes
app.use('/api', routes);

// Start Express only if run directly, not when required by tests
if (require.main === module) {
  initDB().then(() => {
    app.listen(PORT, () => console.log(`Modular API running on http://localhost:${PORT}`));
  }).catch(e => console.error('Database setup failed:', e));
}

module.exports = app;
