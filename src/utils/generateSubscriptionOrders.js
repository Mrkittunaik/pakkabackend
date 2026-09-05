const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const { dateKey } = require('./subscriptionRules');
const emit = require('../sockets/emit');

// Maps a plan/custom-day qty code to a litre quantity used for pricing the
// auto-generated order line item.
const QTY_LITRES = { half: 0.5, one: 1, two: 2 };
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

async function nextOrderCode() {
  const last = await Order.findOne().sort({ createdAt: -1 });
  const lastNum = last ? parseInt(String(last.orderCode).replace(/\D/g, ''), 10) : 1040;
  return `PD${(lastNum || 1040) + 1}`;
}

// Decides whether a subscription should deliver on `date`, and what qty.
// - Plan-based subs deliver every day at the plan's qty.
// - Custom-schedule subs deliver only on days where that weekday's code isn't 'none'.
function resolveDelivery(sub, date) {
  if (sub.plan) {
    return { qtyCode: sub.plan.qty, unitPrice: sub.plan.price };
  }
  if (sub.custom) {
    const weekday = WEEKDAY_KEYS[new Date(date).getDay()];
    const qtyCode = sub.custom[weekday];
    if (!qtyCode || qtyCode === 'none') return null;
    // Custom schedules have no fixed plan price; fall back to a per-litre
    // rate set via env so admin can price ad-hoc schedules without a plan.
    const perLitre = Number(process.env.CUSTOM_SCHEDULE_RATE_PER_LITRE || 60);
    return { qtyCode, unitPrice: Math.round(perLitre * QTY_LITRES[qtyCode]) };
  }
  return null;
}

// Generates today's delivery orders for every active subscription that isn't
// skipped, hasn't already had an order created for the date, and whose start
// date has arrived. Meant to be called once per day (see server.js cron hook).
async function generateOrdersForDate(date = new Date()) {
  const key = dateKey(date);
  const subs = await Subscription.find({ active: true, startDate: { $lte: date } }).populate('plan');

  const results = { created: 0, skipped: 0, errors: 0 };

  for (const sub of subs) {
    try {
      if (sub.skippedDates.includes(key)) { results.skipped++; continue; }

      const already = await Order.findOne({ subscription: sub._id, createdAt: { $gte: new Date(key) } });
      if (already) { results.skipped++; continue; }

      const delivery = resolveDelivery(sub, date);
      if (!delivery) { results.skipped++; continue; }

      const litres = QTY_LITRES[delivery.qtyCode] || 1;
      const order = await Order.create({
        orderCode: await nextOrderCode(),
        customer: sub.customer,
        address: sub.address,
        items: [{ name: `Milk (${delivery.qtyCode}, ${sub.slot})`, qty: litres, price: delivery.unitPrice }],
        total: delivery.unitPrice,
        status: 'placed',
        paymentStatus: sub.paymentStatus === 'paid' ? 'paid' : 'cod',
        isSubscriptionDelivery: true,
        subscription: sub._id
      });

      emit.orderCreated(order); // -> admin board + assigned driver see today's subscription drops live
      results.created++;
    } catch (err) {
      console.error(`[subscription-orders] failed for sub ${sub._id}:`, err.message);
      results.errors++;
    }
  }

  return results;
}

module.exports = { generateOrdersForDate };
