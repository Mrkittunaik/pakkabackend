const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/deliveryBoyController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, requireRole('owner', 'admin', 'manager'), ctrl.list);
router.get('/me', requireAuth, requireRole('delivery'), ctrl.me);
router.get('/me/stats', requireAuth, requireRole('delivery'), ctrl.myStats);
router.patch('/me/location', requireAuth, requireRole('delivery'), ctrl.updateMyLocation);
router.patch('/me/offline', requireAuth, requireRole('delivery'), ctrl.goOffline);
router.get('/:id', requireAuth, requireRole('owner', 'admin', 'manager'), ctrl.getOne);
router.patch('/:id/status', requireAuth, requireRole('owner', 'admin', 'manager'), ctrl.setStatus);
router.put('/:id', requireAuth, requireRole('owner', 'admin', 'manager'), ctrl.update);
router.patch('/:id/password', requireAuth, requireRole('owner', 'admin'), ctrl.changePassword);

module.exports = router;
