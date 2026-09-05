require('dotenv').config();
const http = require('http');
const cron = require('node-cron');
const app = require('./app');
const connectDB = require('./config/db');
const sockets = require('./sockets/io');
const { generateOrdersForDate } = require('./utils/generateSubscriptionOrders');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  const server = http.createServer(app);
  sockets.init(server);
  server.listen(PORT, () => console.log(`[server] milk-backend (HTTP + WebSocket) running on port ${PORT}`));

  // Runs once a day at 4 AM server time — turns active subscriptions into
  // actual Order documents for that day, so the admin board and delivery
  // app's queue fill up automatically instead of subscriptions sitting inert.
  // Time is configurable via .env in case the dairy's packing schedule shifts.
  const cronTime = process.env.SUBSCRIPTION_ORDER_CRON || '0 4 * * *';
  cron.schedule(cronTime, async () => {
    console.log('[cron] generating subscription orders for today...');
    const result = await generateOrdersForDate(new Date());
    console.log('[cron] subscription orders:', result);
  });
});
