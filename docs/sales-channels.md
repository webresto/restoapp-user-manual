# 🛒 Sales Channels

A **sales channel** is any entry point that can create orders — your website, a Telegram or
LINE bot, a kiosk, a QR table-ordering page, a staff order-entry site, and so on. The
**Sales Channels** page is where you register those entry points, turn them on or off, and
decide which menu (concept) each one serves.

Path: **Sidebar → Sales Channels**

> A fresh backend starts with **no sales channels**. Until you create and enable at least
> one, orders have no known source. This page is the first-run home for setting that up —
> the [Setup Checklist](setup-checklist.md) links here too.

---

## Why channels matter

Every order records **where it came from**. Registering channels turns that source from a
free-text label into a managed list, which gives you:

- a catalogue of valid order sources (no more guessing what a value means);
- per-channel **enable / disable**;
- **concept binding** — which menu a channel may order from;
- clean grouping in reports (orders by channel, revenue by channel, …).

> **Channel type vs. channel instance.** A **type** is the reusable *kind* of channel
> (`web-storefront`, `telegram-bot`, `line-oa`, …), usually provided by a module. An
> **instance** is one configured channel you create here (e.g. *“Main website”*,
> *“Telegram delivery bot”*). You can have several instances of the same type.

---

## Page layout

<!-- TODO screenshot: sales_channels_overview.png -->

The page has three areas:

1. **Your sales channels** — the channels you have configured.
2. **Recommended for your country** — suggested types based on your project country.
3. **Add custom channel** — create a channel manually.

### Your sales channels

Each channel is shown as a card with:

- its **title**, **key**, and **type**;
- a **status badge** (see [Statuses](#statuses));
- the bound **concepts** and **countries** as tags (a channel with no concepts shows
  *All concepts*);
- an **Enabled / Disabled** toggle;
- **Open** (if a URL is set), **Edit**, and **Delete** actions.

If you have none yet, an empty state invites you to create your first channel or pick a
recommended one.

### Recommended for your country

<!-- TODO screenshot: sales_channels_recommended.png -->

RestoApp suggests channel types that fit your market (set in **Settings → `COUNTRY_ISO`**),
for example:

| Country | Suggested channels |
|---------|--------------------|
| Vietnam (VN) | Web storefront, Zalo OA, Facebook, QR table ordering |
| Thailand (TH) | Web storefront, LINE OA, QR table ordering |
| Russia (RU) | Web storefront, Telegram bot, VK mini app, MAX bot |
| *Any other* | Web storefront, Mobile app, QR table ordering |

These are **hints, not rules** — a card shows whether its provider module is installed, and
**Add channel** pre-fills the editor with that type. You can always create any channel,
regardless of country.

---

## Creating / editing a channel

<!-- TODO screenshot: sales_channels_editor.png -->

Use **Add custom channel**, or **Add channel** on a recommended card, or **Edit** on an
existing one. The editor fields:

| Field | Description |
|-------|-------------|
| **Title** *(required)* | Human-readable name, e.g. *Main website*. |
| **Channel key** | Stable slug written into each order’s source (`orderedOnPlatform`). Auto-derived from the title for new channels; must be unique. |
| **Type** | The channel type (from the installed/known catalogue). Defaults to *Custom channel*. |
| **URL / link** | Public URL or deep-link (storefront address, bot link). Powers the **Open** button. |
| **Countries** | ISO codes where this channel runs, comma-separated (e.g. `VN, TH`). |
| **Concepts** | Concept allowlist. **Leave empty to allow all concepts**; otherwise the channel only writes the selected ones. |
| **Default concept** | The concept this channel uses by default (must be one of the selected concepts). |
| **Allow concept switching** | Lets the storefront/bot offer a concept selector when several concepts are bound. |
| **Enabled** | Master switch. **Only enabled channels are valid order sources.** |

**Save channel** stores it; **Cancel** discards the draft.

> **Concept binding** is how one backend serves several menus from one set of operations —
> e.g. a website for `origin`, a separate storefront for `burgers`, a LINE channel only for
> `bangkok`. The channel says *where the order came from*; the concept says *which menu* the
> cart belongs to. The two are independent.

### Statuses

| Status | Meaning |
|--------|---------|
| **Draft** | Created, not yet enabled. |
| **Needs setup** | Enabled but missing required configuration. |
| **Ready** | Enabled and configured — a valid order source. |
| **Disabled** | Intentionally turned off. |
| **Error** | The provider/health check reported a problem. |

Toggling a channel on moves *Draft/Disabled* → *Ready*; toggling off sets *Disabled*.

---

## How channels relate to orders

- Each order stores its source in **`orderedOnPlatform`**, which should match a channel
  **key**.
- For backward compatibility this is **not strictly enforced**: an order with an unknown
  source is still accepted, and a warning is logged. This lets existing storefronts and bots
  keep working while you register their channels.
- On first start, RestoApp **backfills** channels from any order sources already present in
  the database (marked as type *legacy*, enabled), so your history and reports stay intact.
- **Deleting** a channel does not touch past orders — they keep their source string for
  reporting.

---

## Channel providers and modules

Channel **types** are supplied by modules (the *provider* of a type). A messenger or
storefront integration installs as a module that registers one or more types, which then
appear in the editor and in **Recommended for your country**. Until a provider is installed,
its recommended card shows *Provider not installed*.

The **staff order-entry website** (`admin-frontend`) is treated as a channel provider too:
it is no longer bundled by default and can be added as a recommended channel when you need a
staff ordering surface.

> **Secrets** (bot tokens, API keys, signing secrets) belong in **Settings**, not on the
> channel record. The channel only stores non-secret choices (name, URL, concepts, feature
> flags). The channel **key** is a public identifier, not a secret.

---

## 📱 Mobile

The page is responsive. On a phone the channel cards stack into a single column and the
editor opens full-width; use **Cancel** to return to the list.
