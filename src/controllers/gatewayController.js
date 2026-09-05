const crypto = require('crypto');
const emit = require('../sockets/emit');

let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  const Razorpay = require('razorpay');
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

// POST /api/payments/create-order { amount, currency }
// amount is expected in rupees; Razorpay needs paise (amount * 100).
exports.createOrder = async (req, res) => {
  const { amount, currency } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount is required' });

  if (!razorpay) {
    // dev fallback: no live keys configured yet
    const orderId = 'order_dev_' + crypto.randomBytes(8).toString('hex');
    return res.json({ orderId, amount, currency: currency || 'INR', keyId: null, dev: true });
  }

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: currency || 'INR',
      receipt: 'rcpt_' + Date.now()
    });
    res.json({ orderId: order.id, amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error('[razorpay] order creation failed:', err.message);
    res.status(502).json({ error: 'Payment gateway error, please try again' });
  }
};

// POST /api/payments/verify { orderId, paymentId, signature }
exports.verify = async (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ error: 'orderId, paymentId and signature are required' });
  }
  if (!process.env.RAZORPAY_KEY_ID) {
    // dev mode: accept anything
    return res.json({ ok: true, dev: true });
  }
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  if (expected !== signature) return res.status(400).json({ ok: false, error: 'Signature mismatch' });
  emit.paymentChanged({ customer: req.auth.id, orderId, paymentId, status: 'paid' }); // live "payment verified" push
  res.json({ ok: true });
};
