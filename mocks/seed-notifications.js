// Seed: Notifications Manager
// Inserts demo notifications covering statuses: sent, failed
// Personal data is already anonymised in the seed values.
import { randomUUID } from 'crypto';
import { createClient } from './db.js';

const now = Date.now();

const notifications = [
  {
    id: randomUUID(),
    title: 'Ваш заказ готов!',
    body: 'Заказ #10234 готов к выдаче. Ждём вас!',
    status: 'sent',
    groupTo: 'user',
    notificationTypeKey: 'order_ready',
    channels: [{ channel: 'firebase', status: 'sent', sentAt: now }],
    requestedChannels: ['firebase'],
    context: { orderId: '10234' },
    deliveryAttempts: 1,
    createdAt: now,
  },
  {
    id: randomUUID(),
    title: 'Заказ принят',
    body: 'Заказ #10233 принят в обработку. Готовим!',
    status: 'sent',
    groupTo: 'user',
    notificationTypeKey: 'order_accepted',
    channels: [{ channel: 'firebase', status: 'sent' }],
    requestedChannels: ['firebase'],
    context: { orderId: '10233' },
    deliveryAttempts: 1,
    createdAt: now - 5 * 60 * 1000,
  },
  {
    id: randomUUID(),
    title: 'Курьер выехал',
    body: 'Курьер едет к вам. Ориентировочное время — 25 минут.',
    status: 'sent',
    groupTo: 'user',
    notificationTypeKey: 'courier_dispatched',
    channels: [{ channel: 'firebase', status: 'sent' }],
    requestedChannels: ['firebase'],
    context: { orderId: '10232' },
    deliveryAttempts: 1,
    createdAt: now - 15 * 60 * 1000,
  },
  {
    id: randomUUID(),
    title: 'Акция «Пятничная пицца»',
    body: 'Скидка 20% на все пиццы только сегодня!',
    status: 'failed',
    groupTo: 'user',
    notificationTypeKey: 'promo',
    channels: [{ channel: 'firebase', status: 'failed', error: 'Device token expired' }],
    requestedChannels: ['firebase'],
    context: {},
    deliveryAttempts: 2,
    createdAt: now - 30 * 60 * 1000,
  },
  {
    id: randomUUID(),
    title: 'Спасибо за заказ!',
    body: 'Благодарим за выбор нашего ресторана. Ваш отзыв важен для нас.',
    status: 'sent',
    groupTo: 'user',
    notificationTypeKey: 'order_feedback',
    channels: [{ channel: 'email', status: 'sent' }],
    requestedChannels: ['email'],
    context: { orderId: '10231' },
    deliveryAttempts: 1,
    createdAt: now - 45 * 60 * 1000,
  },
  {
    id: randomUUID(),
    title: 'Новый заказ #10235',
    body: 'Новый заказ поступил на кухню. Сумма: 1 450 ₽',
    status: 'sent',
    groupTo: 'manager',
    notificationTypeKey: 'new_order',
    channels: [{ channel: 'firebase', status: 'sent' }],
    requestedChannels: ['firebase'],
    context: { orderId: '10235' },
    deliveryAttempts: 1,
    createdAt: now - 2 * 60 * 1000,
  },
  {
    id: randomUUID(),
    title: 'Напоминание: вы не завершили заказ',
    body: 'В корзине остались товары. Оформите заказ со скидкой 10%.',
    status: 'sent',
    groupTo: 'user',
    notificationTypeKey: 'cart_reminder',
    channels: [{ channel: 'firebase', status: 'sent' }],
    requestedChannels: ['firebase'],
    context: {},
    deliveryAttempts: 1,
    createdAt: now - 60 * 60 * 1000,
  },
];

const client = createClient();
await client.connect();

// Clear existing mock notifications (by known type keys)
const mockKeys = [...new Set(notifications.map(n => n.notificationTypeKey))];
await client.query(
  `DELETE FROM notification WHERE "notificationTypeKey" = ANY($1)`,
  [mockKeys]
);

for (const n of notifications) {
  await client.query(
    `INSERT INTO notification
       (id, title, body, status, "groupTo", "notificationTypeKey",
        channels, "requestedChannels", context, "spentCost",
        "deliveryAttempts", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$11)`,
    [
      n.id, n.title, n.body, n.status, n.groupTo, n.notificationTypeKey,
      JSON.stringify(n.channels), JSON.stringify(n.requestedChannels),
      JSON.stringify(n.context), n.deliveryAttempts,
      n.createdAt,
    ]
  );
}

console.log(`Seeded ${notifications.length} notifications`);
await client.end();
