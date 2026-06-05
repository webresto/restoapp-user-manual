Task: Add a CLI for generating annotated screenshots

Pages visited:
- Local repository files only; no external web pages were opened.

Actions taken:
- Added a standalone Node.js package in annotator/.
- Added bin/annotate.js to read YAML or JSON configs, apply raster blur regions, render an SVG overlay, and composite the result with sharp.
- Added a local browser UI and HTTP API so an agent can edit configs and verify annotated screenshots through Playwright.
- Added an example config and copied an existing local screenshot as the example input image.
- Added annotator documentation.
- Verified CLI rendering with npm run annotate.
- Verified the HTTP server with GET /, GET /api/state, and POST /api/render.
- Verified the browser UI with Playwright by opening the local server, reading the page snapshot, and clicking Render.
- Added agent usage documentation describing browser tuning, YAML as the source of truth, rebuild validation, and CI/container expectations.
- Added a batch annotation builder for saved *.annotate.yml/json files.
- Updated Docker and GitHub Actions so saved annotation configs are rebuilt during container/CI workflows.
- Verified Docker image build locally; the annotation-builder stage ran npm run build:annotations successfully.

Screenshots captured:
- None from the browser.
- Planned/generated local annotation output: annotator/examples/screen.annotated.png.

Annotations or masking applied:
- Example config includes rect, arrow, marker, blur, and spotlight annotations.
- Blur is implemented as a raster effect in sharp.
- Web preview renders the generated annotated PNG and can switch to the original input image.
