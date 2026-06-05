# Screenshot Annotator

Small CLI and local browser UI for authoring screenshot annotations from YAML or JSON configs.
The repository keeps clean screenshots plus committed `*.annotate.yml` seed files, while the documentation renders the overlay in the browser at runtime.

## Install

```bash
cd annotator
npm install
```

## Run

```bash
npm run annotate
```

Or:

```bash
node bin/annotate.js examples/screen.annotate.yml
```

## Calibration Agent CLI

The annotator does not create screenshots or initial annotations. Another mechanism should create the clean screenshot and the factual `*.annotate.yml` seed first, including the picture intent and per-annotation descriptions.

Then run a local Codex calibration agent against that existing YAML:

```bash
cd annotator
npm run calibrate -- ../docs/screenshots/stock_overview.annotate.yml --port 4177 --max-iterations 5
```

Equivalent direct command:

```bash
node bin/calibrate.js ../docs/screenshots/stock_overview.annotate.yml \
  --port 4177 \
  --codex-command codex \
  --codex-args "exec -" \
  --max-iterations 5
```

The command starts the existing annotator server, passes the editor and output URLs to a separate local Codex process, and asks that agent to adjust only the YAML for this one annotation file.

Use this to inspect the generated prompt without starting the server or Codex:

```bash
node bin/calibrate.js ../docs/screenshots/stock_overview.annotate.yml --prompt-only
```

## Browser UI

Start the local web server:

```bash
npm run serve
```

Open:

```text
http://localhost:4177
```

The browser UI lets an agent edit YAML directly, render the output, save the config, and inspect the annotated screenshot with Playwright.

Custom config and port:

```bash
node bin/serve.js examples/screen.annotate.yml --port 4177
```

Agent workflow documentation:

- [AGENT_USAGE.md](AGENT_USAGE.md)

Useful HTTP endpoints:

- `GET /api/state`: current input/output paths and preview URLs.
- `GET /api/config`: current YAML or JSON config text.
- `PUT /api/config`: replace the config file and render.
- `POST /api/render`: render either the saved config or a submitted `configText`.
- `GET /input.png`: original image.
- `GET /output.png`: annotated image.

Example script request:

```bash
curl -X POST http://localhost:4177/api/render \
  -H 'Content-Type: application/json' \
  -d '{"configText":"input: screen.png\noutput: screen.annotated.png\nannotations:\n  - type: marker\n    x: 100\n    y: 100\n    text: \"1\"\n","save":false}'
```

## Config Example

```yaml
input: screen.png
output: screen.annotated.png
description: "Example application screen used to demonstrate annotation rendering."
annotation_goal: "Show the main highlighted UI areas and one masked private-data region."
crop:
  x: 0
  y: 0
  width: 1024
  height: 640
annotations:
  - type: rect
    description: "Highlight the new orders block."
    target: "new orders block"
    success_criteria: "The rectangle surrounds the block without covering nearby controls."
    x: 120
    y: 80
    width: 300
    height: 90
    label: "Новый блок заказов"
  - type: arrow
    from: [500, 220]
    to: [650, 120]
    label: "Кнопка настройки"
  - type: marker
    x: 400
    y: 300
    text: "1"
  - type: blur
    x: 760
    y: 120
    width: 180
    height: 42
    radius: 14
  - type: spotlight
    x: 70
    y: 170
    width: 360
    height: 170
    label: "Основная область"
    opacity: 0.42
```

## Description Fields

Calibration expects the seed file to already contain factual descriptions:

- `description` or `slide_description`: what the whole picture shows.
- `annotation_goal`: why this picture is being annotated.
- `annotations[].description`: what this specific mark shows.
- `annotations[].target`: the UI element or area the mark should align to.
- `annotations[].success_criteria`: when the mark is visually acceptable.

These fields are not rendered. They are the contract for the separate calibration agent.

## Crop

Use top-level `crop` to crop the source screenshot before any annotations are applied.
The bounding box is expressed in the original screenshot coordinate system:

```yaml
crop:
  x: 300
  y: 180
  width: 900
  height: 520
```

Annotation coordinates should still be written against the original screenshot. The annotator crops first, then shifts every annotation into the cropped output.

## Annotation Types

- `rect`: red rectangle highlight.
- `oval`: red oval highlight.
- `arrow`: red arrow from one point to another.
- `marker`: numbered red circle.
- `blur`: raster blur for private data.
- `spotlight`: darkens the screenshot except for one highlighted area.

Use `blur` for masking only when browser-side DOM replacement is not possible before taking the screenshot.

## Rebuild Saved Annotations

Saved annotation configs may use `*.annotate.yml` or `*.annotate.json`, but this repository should commit `*.annotate.yml` as the single source of truth.

```bash
npm run build:annotations
```

This scans `../docs/screenshots` and rebuilds every matching annotated PNG.
