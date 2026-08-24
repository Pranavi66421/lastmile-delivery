const express = require('express');
const router = express.Router();

const { authMiddleware, requireAuth, requireRole } = require('../middlewares/authMiddleware');

const authController = require('../controllers/authController');
const orderController = require('../controllers/orderController');
const zoneRateController = require('../controllers/zoneRateController');
const interactionController = require('../controllers/interactionController');
const simulationController = require('../controllers/simulationController');

router.use(authMiddleware);

// Auth & Users
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/me', requireAuth, authController.getMe);
router.post('/admin/users', requireRole('admin'), authController.adminProvisionUser);
router.get('/agents', requireAuth, authController.getAgents);
router.get('/customers', requireRole('admin'), authController.getCustomers);

// Zones
router.get('/zones', requireAuth, zoneRateController.getZones);
router.post('/zones', requireRole('admin'), zoneRateController.createZone);
router.delete('/zones/:id', requireRole('admin'), zoneRateController.deleteZone);

// Rates
router.get('/rates', requireAuth, zoneRateController.getRates);
router.put('/rates/:id', requireRole('admin'), zoneRateController.updateRate);

// Orders
router.post('/orders/calculate', orderController.calculate);
router.post('/orders', requireAuth, orderController.createOrder);
router.get('/orders', requireAuth, orderController.getOrders);
router.get('/orders/:id', requireAuth, orderController.getOrderById);
router.post('/orders/:id/auto-assign', requireRole('admin'), orderController.autoAssign);
router.post('/orders/:id/status', requireRole('agent', 'admin'), orderController.updateStatus);
router.post('/orders/:id/rate', requireRole('customer'), orderController.rateOrder);

// Rescheduling
router.get('/orders/:id/reschedule-slots', requireAuth, orderController.getRescheduleSlots);
router.post('/orders/:id/reschedule', requireAuth, orderController.rescheduleOrder);

// Interactions (Chat & Notifications)
router.get('/orders/:id/messages', requireAuth, interactionController.getMessages);
router.post('/orders/:id/messages', requireAuth, interactionController.sendMessage);
router.get('/notifications', requireAuth, interactionController.getNotifications);

// Simulation & Routing
router.post('/routing/optimize', requireRole('admin'), simulationController.optimizeRouting);
router.post('/simulation/agent-gps', requireRole('agent', 'admin'), simulationController.updateAgentGPS);
router.post('/simulation/reset', requireRole('admin'), simulationController.resetSimulation);

module.exports = router;
