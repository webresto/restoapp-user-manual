# Screenshot Metadata Agent

## Purpose

The agent generates `.meta` files and ensures annotated screenshots are created for each image.

---

## File Naming

For each screenshot:

```
<name>.png
<name>_annotated.png
<name>.meta
```

### Example

```
restoapp-doc/docs/screenshots/stock_product_actions.png
restoapp-doc/docs/screenshots/stock_product_actions_annotated.png
restoapp-doc/docs/screenshots/stock_product_actions.meta
```

---

## Responsibilities

The agent must:

1. Generate `.meta` file
2. Generate annotated screenshot if annotations exist
3. Ensure correct naming with `_annotated`

---

## .meta Format

```
URL: <url>
Path: <step1 -> step2 -> step3>
Description: <description>

Annotation:
- <annotation 1>
- <annotation 2>
```

---

## Rules

### 1. Metadata

* Always create `.meta`
* Must include URL, Path, Description

### 2. Annotations

* Optional
* If present:

  * Add `Annotation` block in `.meta`
  * Generate `<name>_annotated.png`

### 3. Annotated Screenshot

If annotations exist:

* Create a copy of the original screenshot
* Add visual marks (arrows, circles, text)
* Save as:

```
<name>_annotated.png
```

### 4. Annotation Style

* Red color for highlights
* Use:

  * Oval / circle
  * Arrow
  * Text labels
* Match descriptions from `.meta`

---

## Example

### Files

```
stock_product_actions.png
stock_product_actions_annotated.png
stock_product_actions.meta
```

### .meta

```
URL: https://restoapp.com/admin/stock-manager#out-of-stock
Path: Sidebar -> Stock Manager -> Click "Нет в наличии" tab
Description: Shows all items that are currently out of stock.

Annotation:
- Red oval around the "Нет в наличии" tab
- Arrow pointing to the tab
- Text "Стоп-лист из iiko"
```

---

## Goal

* Every screenshot is reproducible
* Every annotation is visible in `_annotated.png`
* `.meta` fully describes both navigation and visual highlights


----------

When we want to retrieve images, we need to access the website. The link must be provided in GNV in the following format (example), along with the login and password. Then, we need to navigate through the site to obtain the images.

```
url=https://....
login=admin
password=*******
```
