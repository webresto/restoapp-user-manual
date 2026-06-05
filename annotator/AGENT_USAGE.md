# Agent Workflow for Screenshot Annotations

This document explains how an agent should create, tune, calibrate, save, verify, and rebuild screenshot annotations.

The important rule is simple: the config file is the source of truth. If the annotation needs to be changed, edit the config, re-render it, and visually calibrate it in the browser before considering it done.
The repository itself should keep clean screenshots plus annotation seed files. Browser-facing documentation renders the annotations on top of the clean image at runtime.

## File Convention

For every screenshot that needs annotations, keep these files together:

```text
docs/screenshots/<name>.png
docs/screenshots/<name>.annotate.yml
docs/screenshots/<name>.png.meta
```

Use `<name>.annotate.yml` for the committed annotation seed so both the annotator and the browser renderer use the same source of truth.

Example:

```text
docs/screenshots/stock_overview.png
docs/screenshots/stock_overview.annotate.yml
docs/screenshots/stock_overview.png.meta
```

## Config Format

The config paths are relative to the config file location.

```yaml
input: stock_overview.png
description: "Stock manager overview screen."
annotation_goal: "Show the category navigation that controls the product list."
crop:
  x: 280
  y: 320
  width: 1500
  height: 520
annotations:
  - type: spotlight
    description: "Highlight the category navigation row."
    target: "category navigation row"
    success_criteria: "The spotlight covers the row without hiding category names."
    x: 70
    y: 170
    width: 360
    height: 170
    label: "Навигация по категориям"
    opacity: 0.42
  - type: arrow
    from: [500, 220]
    to: [650, 120]
    label: "Кнопка настройки"
  - type: marker
    x: 400
    y: 300
    text: "1"
```

## Description Contract

Screenshot capture and primary annotation creation happen before this annotator calibration step. The mechanism that creates the screenshot and initial `*.annotate.yml` must also write factual descriptions into the seed file.

Required fields for calibration:

- `description` or `slide_description`: what the screenshot shows.
- `annotation_goal`: what the annotation should explain.
- `annotations[].description`: what this visual mark shows.
- `annotations[].target`: the UI element or area that the mark should align to.
- `annotations[].success_criteria`: the visual acceptance rule for this mark.

The renderer ignores these fields. They exist so the separate calibration agent can evaluate whether the visible annotation matches the intended target.

## Calibration Agent CLI

Use the calibration CLI only after the clean screenshot and initial annotation YAML already exist.

```bash
cd /prj/restoapp-user-manual/annotator
npm run calibrate -- ../docs/screenshots/stock_overview.annotate.yml --port 4177 --max-iterations 5
```

The command:

- validates that the YAML already contains factual description fields
- starts the existing annotator server for that one config
- starts a separate local Codex process with a narrow prompt for only this annotation file
- tells the calibration agent to inspect the browser/API preview, adjust YAML geometry, render again, and stop when the result is visually acceptable

Use `--prompt-only` to inspect the exact prompt without starting Codex:

```bash
node bin/calibrate.js ../docs/screenshots/stock_overview.annotate.yml --prompt-only
```

Use `--allow-missing-descriptions` only for manual debugging. Normal documentation work should keep descriptions mandatory.

## Crop

Use top-level `crop` when the screenshot should be reduced to a specific bounding box before annotations are drawn.

```yaml
crop:
  x: 300
  y: 180
  width: 900
  height: 520
```

The crop bounding box uses coordinates from the original screenshot. Keep annotation coordinates in the same original coordinate system. The annotator applies the crop first, then shifts every annotation into the cropped image before drawing blur, shapes, arrows, markers, labels, and spotlights.

## Annotation Choice

Choose the least noisy annotation that explains the screen.

- `spotlight`: use first when one main area should be emphasized and the rest of the UI should stay visible but quieter.
- `rect`: use for panels, cards, tables, buttons, or rectangular UI blocks.
- `oval`: use for tabs, small controls, status badges, icons, or rounded elements.
- `arrow`: use when the target is small or needs directional attention.
- `marker`: use for numbered steps in a workflow.
- `blur`: use only when private data was not masked in the browser before screenshot capture.

Do not over-annotate. A documentation screenshot is usually best with one to three visual marks.

## Browser Tuning Workflow

1. Start the annotator server for the screenshot config:

```bash
cd /prj/restoapp-user-manual/annotator
npm run serve -- --port 4177 ../docs/screenshots/stock_overview.annotate.yml
```

2. Open the UI:

```text
http://localhost:4177
```

3. Edit the YAML in the browser.

4. Click `Render` to preview without saving.

5. Inspect the preview in the browser. With Playwright, use the stable controls:

```text
data-testid="config-editor"
data-testid="render-button"
data-testid="save-render-button"
data-testid="preview-image"
```

6. Adjust coordinates and labels until the annotation is clear, aligned, and not covering important text.

7. Perform a calibration pass in the browser:

- check that each shape sits on the intended control, card, tab, or icon
- check that labels do not drift away from their target
- check that nothing important is obscured
- if anything looks shifted, edit the config and render again

Calibration is mandatory. Do not stop after the first acceptable render if the overlay still looks visually off.

8. Click `Save + Render` when the annotation is correct, then save the final result in the committed `*.annotate.yml` seed.

9. Confirm that:

- The `.annotate.yml` seed matches the final annotation geometry.
- The `.meta` file has an `Annotation` section matching the visible marks.
- If any masking was used, the `.meta` file has a `Masking` section.

## Script/API Workflow

The same server can be controlled by a script.

Render a temporary config without saving:

```bash
curl -X POST http://localhost:4177/api/render \
  -H 'Content-Type: application/json' \
  -d '{"configText":"input: stock_overview.png\nannotations:\n  - type: marker\n    x: 100\n    y: 100\n    text: \"1\"\n","save":false}'
```

Save the config and render:

```bash
curl -X POST http://localhost:4177/api/render \
  -H 'Content-Type: application/json' \
  -d '{"configText":"input: stock_overview.png\nannotations:\n  - type: marker\n    x: 100\n    y: 100\n    text: \"1\"\n","save":true}'
```

Useful endpoints:

- `GET /api/state`: current file paths and preview URLs.
- `GET /api/config`: current YAML or JSON config text.
- `PUT /api/config`: replace the config file and render.
- `POST /api/render`: render saved config or submitted `configText`.
- `GET /input.png`: original screenshot.
- `GET /output.png`: generated annotated screenshot.

## Rebuild All Annotations

To preview or regenerate annotated screenshots locally from saved configs:

```bash
cd /prj/restoapp-user-manual/annotator
npm run build:annotations
```

By default this scans:

```text
/prj/restoapp-user-manual/docs/screenshots
```

Custom root:

```bash
node bin/build-all.js --root ../docs/screenshots
```

Only files matching these names are rebuilt:

```text
*.annotate.yml
*.annotate.yaml
*.annotate.json
```

## CI and Container Build

CI should rebuild annotated screenshots before building or publishing the documentation image.

Recommended CI sequence:

```bash
cd annotator
npm ci
npm run build:annotations
cd ..
docker build .
```

This guarantees that browser-rendered annotations can be recreated from committed config files.

The same command can also run inside a Docker build. The expected behavior is:

1. Install annotator dependencies.
2. Run `npm run build:annotations`.
3. Build or serve MkDocs with the regenerated PNG files.

## Validation Checklist

Before finishing an annotation task, verify:

- The source screenshot is masked according to project rules.
- The annotation seed file is committed as the reproducible source.
- The visual marks match the `.meta` `Annotation` section.
- The annotation was previewed in a browser and calibrated, not only generated.
- Labels are readable and do not cover important UI.
- Red marks are used consistently.
- Running `npm run build:annotations` recreates the expected output.

## AI Notes

For every annotation task, create a separate `.ai-notes` file in English.

Include:

- Pages visited.
- Actions taken.
- Screenshots captured.
- Annotation config files created or edited.
- Calibration adjustments made after browser review.
- Masking applied.
- Verification steps and results.
