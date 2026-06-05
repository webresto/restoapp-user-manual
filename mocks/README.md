# Mocks

Seed scripts for populating local RestoApp with demo data used in documentation screenshots.

## Requirements

- Node.js 18+
- PostgreSQL running locally (`postgres:postgres@127.0.0.1:5432/postgres`)
- RestoApp lifted with `DB_MIGRATE=drop` at least once (tables must exist)

## Usage

```bash
# Seed all sections at once
node mocks/seed-all.js

# Or seed individual sections
node mocks/seed-notifications.js
node mocks/seed-settings.js
node mocks/seed-orders-report.js

# Wipe all mock data
node mocks/reset.js
```

## Sections covered

| Script | Section | Screenshot |
|--------|---------|------------|
| seed-notifications.js | Notifications Manager | notifications_list.png, notifications_detail.png |
| seed-settings.js | Settings Manager | settings_list.png |
| seed-orders-report.js | Orders Report | orders_report.png |
