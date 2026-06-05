Task: Migrate baked screenshot annotations to browser-rendered overlays

Pages visited:
- Local repository files only for the code audit.
- Local preview page: http://127.0.0.1:8010/output/playwright/annotation-preview.html

Actions taken:
- Audited the existing screenshot workflow in AGENTS.md, annotator docs, Dockerfile, MkDocs config, and the Stock Manager Russian page.
- Confirmed that the repository mixed clean screenshots with baked `_annotated.png` files and had no committed annotation seed files for those screens.
- Added a browser-side overlay renderer in `docs/assets/annotations.js` and matching styles in `docs/assets/annotations.css`.
- Wired MkDocs to load the annotation assets through `extra_css` and `extra_javascript`.
- Replaced direct `_annotated.png` usage in `docs/stock-manager.ru.md` with clean screenshots plus `data-annotation-config` wrappers.
- Created committed seed files:
  - `docs/screenshots/stock_out_of_stock.annotate.json`
  - `docs/screenshots/stock_overview.annotate.json`
  - `docs/screenshots/stock_product_actions.annotate.json`
- Updated matching `.meta` files so the `Annotation` section describes the new browser-rendered overlay behavior.
- Updated project guidance in `AGENTS.md`, `annotator/README.md`, `annotator/AGENT_USAGE.md`, `roadmap/codebase-interface-walkthrough-prompt.md`, and simplified the Dockerfile so the docs no longer depend on rebuilding baked annotated PNGs.
- Removed merged screenshot files:
  - `docs/screenshots/stock_out_of_stock_annotated.png`
  - `docs/screenshots/stock_overview_annotated.png`
  - `docs/screenshots/stock_product_actions_annotated.png`

Screenshots captured:
- Playwright verification screenshots:
  - `.playwright-cli/page-2026-06-03T13-32-15-505Z.png`
  - `.playwright-cli/page-2026-06-03T13-33-21-728Z.png`
  - `.playwright-cli/page-2026-06-03T13-34-04-233Z.png`
  - `.playwright-cli/page-2026-06-03T13-34-39-291Z.png`

Annotations or masking applied:
- No personal data masking was needed during this repository-only migration.
- Browser-rendered overlays were created from JSON seed files instead of committing merged annotated PNGs.

Verification:
- Served the repository locally with `python3 -m http.server 8010 --bind 127.0.0.1`.
- Opened the local preview page with the Playwright CLI skill.
- Confirmed that the browser overlay renders over clean screenshots.
- Corrected the `stock_out_of_stock` seed after the first browser check showed the annotation was anchored to the wrong area.
