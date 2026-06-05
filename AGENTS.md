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
<name>.annotate.yml
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
2. Generate annotation seed if annotations exist
3. Ensure clean screenshots stay unmodified in the repository
4. Calibrate annotations in the browser until they visually align with the intended UI elements

Detailed annotator CLI workflow: `annotator/AGENT_USAGE.md`.

---

## MCP Tool CLI

When the RestoApp MCP endpoint is available, use the local CLI instead of
hand-written `curl` commands:

```bash
bin/resto-mcp-tool.js --url http://localhost:1337/mcp list
bin/resto-mcp-tool.js --url http://localhost:1337/mcp describe <tool>
bin/resto-mcp-tool.js --url http://localhost:1337/mcp schema <tool>
bin/resto-mcp-tool.js --url http://localhost:1337/mcp call <tool> '{"param":"value"}'
```

The CLI reads `RESTO_MCP_URL` or `MCP_URL` for the endpoint and
`MCP_ADMIN_KEY` for protected methods. Use `describe` or `schema` before
calling unfamiliar tools so the request matches the method description and
JSON schema.

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
  * Generate `<name>.annotate.yml`

---

### 3. Browser Annotation Rendering

If annotations exist:

* Keep the original screenshot unchanged
* Store visual marks (arrows, circles, text) in a separate annotation seed file
* Render annotations in the browser on top of the clean screenshot
* Open the rendered result in a browser and visually verify alignment
* Adjust coordinates, sizes, and labels until the overlay is clean, accurate, and not visibly shifted
* Save the seed as:

```
<name>.annotate.yml
```

---

### 4. Annotation Style

* Red color for highlights
* Use:

  * Oval / circle
  * Arrow
  * Text labels
* Match descriptions from `.meta`
* Do not accept the first render by default; calibration is required whenever an annotation looks offset, noisy, or covers important content

---

### 5. Annotation Calibration (REQUIRED when annotations exist)

If a screenshot has annotations:

* The screenshot/annotation creation mechanism must create the initial `<name>.annotate.yml`
* The initial seed must include factual description fields for the whole image and each annotation
* Run the annotator calibration CLI when local agent calibration is needed:

```
cd annotator
npm run calibrate -- ../docs/screenshots/<name>.annotate.yml --port 4177 --max-iterations 5
```

* The agent must preview the result in a browser
* The agent must compare each mark against the intended UI target
* The agent must iterate until the annotation is visually aligned and readable
* If labels or shapes overlap important text or controls, they must be repositioned
* A seed file is not considered complete until this visual calibration pass is finished

---

### 6. Anonymization (Personal Data Protection)

ALWAYS blur or obscure personal data (names, logins, emails, phone numbers, UUIDs) in screenshots. 
**CRITICAL**: Do this directly in the browser by modifying the DOM via JavaScript **BEFORE** taking the screenshot.

- **Names**: Replace with "Имя Клиента" or "Имя Фамилия".
- **Phone Numbers**: Replace with "+7 (999) 000-00-00".
- **Logins/Emails**: Replace with "79990000000" or "email@example.com".
- **UUIDs/Sensitive IDs**: Replace with "UUID-MASKED" or similar.

Use CSS filters (blur) or pixelation only if DOM modification is impossible.

---

### 7. Masking Metadata (REQUIRED if masking is applied)

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
* Every annotation is reproducible from `<name>.annotate.yml`
* Every annotation is browser-calibrated before the task is finished
* `.meta` fully describes navigation, annotations, and masking
