// Seed: Orders Report
// Inserts demo orders spread across the last 7 days.
import { randomUUID } from 'crypto';
import { createClient } from './db.js';

const now = Date.now();

function daysAgo(d) { return now - d * 24 * 60 * 60 * 1000; }

const states    = ['DONE', 'DONE', 'DONE', 'DONE', 'REJECT'];
const pmTitles  = ['Карта онлайн', 'Карта онлайн', 'Наличные', 'Карта онлайн', 'Наличные'];
const isDeliveries = [true, true, false, true, false];

const orders = [];
let idx = 0;
for (let day = 6; day >= 0; day--) {
  const count = 3 + Math.floor(Math.random() * 5); // 3-7 orders per day
  for (let i = 0; i < count; i++) {
    const amount = 400 + Math.floor(Math.random() * 2000);
    const isDelivery = isDeliveries[idx % isDeliveries.length];
    const ts = daysAgo(day) + Math.floor(Math.random() * 8 * 3600 * 1000);
    orders.push({
      id: randomUUID(),
      state: states[idx % states.length],
      paymentMethodTitle: pmTitles[idx % pmTitles.length],
      total: amount,
      deliveryCost: isDelivery ? 150 : 0,
      delivery: isDelivery,
      selfService: !isDelivery,
      address: JSON.stringify({ city: 'Москва', street: 'ул. Примерная', house: `${idx + 1}` }),
      orderedAt: Math.floor(ts / 1000),
      createdAt: ts,
      updatedAt: ts + 600000,
    });
    idx++;
  }
}

const client = createClient();
await client.connect();

// Clear mock orders (by address containing Примерная)
await client.query(`DELETE FROM "order" WHERE address::text LIKE '%Примерная%'`);

for (const o of orders) {
  await client.query(
    `INSERT INTO "order"
       (id, state, "paymentMethodTitle", total, "deliveryCost", delivery, "selfService", address, "orderedAt", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT DO NOTHING`,
    [o.id, o.state, o.paymentMethodTitle, o.total, o.deliveryCost,
     o.delivery, o.selfService, o.address, o.orderedAt, o.createdAt, o.updatedAt]
  );
}

console.log(`Seeded ${orders.length} orders`);
await client.end();
