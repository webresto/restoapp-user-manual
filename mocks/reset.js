// Wipe all mock data inserted by seed scripts
import { createClient } from './db.js';

const client = createClient();
await client.connect();

await client.query(`DELETE FROM notification WHERE "notificationTypeKey" IN (
  'order_ready','order_accepted','courier_dispatched','promo',
  'order_feedback','new_order','cart_reminder'
)`);

await client.query(`DELETE FROM settings WHERE key IN (
  'SITE_NAME','TZ','CURRENCY','MIN_ORDER_AMOUNT','DELIVERY_RADIUS_KM',
  'ONLINE_PAYMENT','CASH_PAYMENT','PROMO_BANNER_TEXT','MAX_ITEMS_IN_CART','UUID_NAMESPACE'
)`);

await client.query(`DELETE FROM "order" WHERE address::text LIKE '%Примерная%'`);

console.log('All mock data removed');
await client.end();
