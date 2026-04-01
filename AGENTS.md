Here’s a clean, unified version with masking explicitly reflected in the `.meta`:

---

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

---

## Access

To retrieve images, access the website using credentials provided in GNV:

```
url=https://....
login=admin
password=*******
```

Navigate through the interface to reach the required screen before taking the screenshot.

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

Masking:
- <what was masked>
- <how it was masked>
```

---

## Rules

### 1. Metadata

* Always create `.meta`
* Must include URL, Path, Description

---

### 2. Annotations

* Optional
* If present:

  * Add `Annotation` block in `.meta`
  * Generate `<name>_annotated.png`

---

### 3. Annotated Screenshot

If annotations exist:

* Create a copy of the original screenshot
* Add visual marks (arrows, circles, text)
* Save as:

```
<name>_annotated.png
```

---

### 4. Annotation Style

* Red color for highlights
* Use:

  * Oval / circle
  * Arrow
  * Text labels
* Match descriptions from `.meta`

---

### 5. Anonymization (Personal Data Protection)

ALWAYS blur or obscure personal data (names, logins, emails, phone numbers, UUIDs) in screenshots. 
**CRITICAL**: Do this directly in the browser by modifying the DOM via JavaScript **BEFORE** taking the screenshot.

- **Names**: Replace with "Имя Клиента" or "Имя Фамилия".
- **Phone Numbers**: Replace with "+7 (999) 000-00-00".
- **Logins/Emails**: Replace with "79990000000" or "email@example.com".
- **UUIDs/Sensitive IDs**: Replace with "UUID-MASKED" or similar.

Use CSS filters (blur) or pixelation only if DOM modification is impossible.

---

### 6. Masking Metadata (REQUIRED if masking is applied)

If any data was altered or hidden:

* Add a `Masking` section in `.meta`
* Clearly specify:

  * What fields were modified (e.g., names, surnames, phone numbers)
  * How they were masked (e.g., DOM replacement, blur, pixelation)

Example:

```
Masking:
- User names replaced with "John Doe" via DOM
- Phone numbers blurred
```

---

AI Notes
For each task, create a separate log file in the `.ai-notes` folder
Write all notes in English
Use these files as a step-by-step journal of actions performed

Each note should include:

What pages were visited
What actions were taken
What screenshots were captured
What annotations or masking were applied

Goal of AI Notes:

Provide full transparency of the workflow
Allow reproducibility of the process
Serve as a debugging and audit trail

## Goal

* Every screenshot is reproducible
* Every annotation is visible in `_annotated.png`
* `.meta` fully describes navigation, annotations, and masking
