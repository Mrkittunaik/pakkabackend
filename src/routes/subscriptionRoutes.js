const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/subscriptionController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.post('/', requireAuth, requireRole('customer'), ctrl.create);
router.get('/', requireAuth, ctrl.list); // admin: all, customer: own
router.get('/:id', requireAuth, ctrl.getOne);
router.put('/:id', requireAuth, ctrl.update);
router.patch('/:id/pause', requireAuth, ctrl.pause);
router.patch('/:id/resume', requireAuth, ctrl.resume);
router.patch('/:id/cancel', requireAuth, ctrl.cancel);
router.patch('/:id/payment-status', requireAuth, requireRole('owner', 'admin', 'manager'), ctrl.setPaymentStatus);

// admin: manually re-run the daily subscription->order generator
router.post('/generate-orders', requireAuth, requireRole('owner', 'admin'), ctrl.runDailyGeneration);

// Skip / unskip a single delivery date, cutoff-verified server-side
router.get('/:id/skip-window', requireAuth, ctrl.skipWindow);
router.post('/:id/skip', requireAuth, requireRole('customer'), ctrl.skipDate);
router.delete('/:id/skip/:date', requireAuth, requireRole('customer'), ctrl.unskipDate);

module.exports = router;
