// Seed: Settings Manager
// Inserts demo app settings with different types and values.
import { createClient } from './db.js';

const now = Date.now();

const settings = [
  { key: 'SITE_NAME',          name: 'Название сайта',           value: 'RestoApp Demo',  type: 'string',  module: 'core',     description: 'Отображаемое имя ресторана на витрине.' },
  { key: 'TZ',                 name: 'Часовой пояс',              value: 'Europe/Moscow',  type: 'string',  module: 'core',     description: 'Временная зона для расчёта времени работы и доставки.' },
  { key: 'CURRENCY',           name: 'Валюта',                   value: 'RUB',            type: 'string',  module: 'core',     description: 'ISO-код валюты для отображения цен.' },
  { key: 'MIN_ORDER_AMOUNT',   name: 'Минимальная сумма заказа', value: 500,              type: 'number',  module: 'orders',   description: 'Минимальная сумма заказа для оформления доставки.' },
  { key: 'DELIVERY_RADIUS_KM', name: 'Радиус доставки (км)',     value: 10,               type: 'number',  module: 'delivery', description: 'Максимальный радиус доставки от центра ресторана.' },
  { key: 'ONLINE_PAYMENT',     name: 'Онлайн-оплата',            value: true,             type: 'boolean', module: 'payments', description: 'Включить приём онлайн-платежей.' },
  { key: 'CASH_PAYMENT',       name: 'Оплата наличными',         value: true,             type: 'boolean', module: 'payments', description: 'Разрешить оплату наличными курьеру.' },
  { key: 'PROMO_BANNER_TEXT',  name: 'Текст промо-баннера',      value: 'Доставка бесплатно при заказе от 1000 ₽', type: 'string', module: 'marketing', description: 'Текст акционного баннера на главной странице.' },
  { key: 'MAX_ITEMS_IN_CART',  name: 'Макс. позиций в корзине',  value: 20,               type: 'number',  module: 'orders',   description: 'Максимальное количество уникальных позиций в одном заказе.' },
  { key: 'UUID_NAMESPACE',     name: 'UUID Namespace',           value: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', type: 'string', module: 'core', description: 'Пространство имён UUID для генерации идентификаторов.' },
];

const client = createClient();
await client.connect();

// Check table columns
const cols = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='settings' ORDER BY ordinal_position`
);
const colNames = cols.rows.map(r => r.column_name);

for (const s of settings) {
  const valueJson = JSON.stringify(s.value);
  if (colNames.includes('module')) {
    await client.query(
      `INSERT INTO settings (key, name, description, value, type, module, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
       ON CONFLICT (key) DO UPDATE SET value=$4, "updatedAt"=$7`,
      [s.key, s.name, s.description, valueJson, s.type, s.module, now]
    );
  } else {
    await client.query(
      `INSERT INTO settings (key, name, description, value, type, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$6)
       ON CONFLICT (key) DO UPDATE SET value=$4, "updatedAt"=$6`,
      [s.key, s.name, s.description, valueJson, s.type, now]
    );
  }
}

console.log(`Seeded ${settings.length} settings`);
await client.end();
