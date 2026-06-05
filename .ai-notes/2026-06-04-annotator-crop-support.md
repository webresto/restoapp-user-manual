Task: Add crop support to the screenshot annotator so source images can be cropped by bounding box before annotations are applied.

Pages visited:
- No application pages were visited.
- Repository files inspected:
  - annotator/lib/annotator.js
  - annotator/lib/server.js
  - annotator/public/all.js
  - annotator/public/styles.css
  - annotator/README.md
  - annotator/AGENT_USAGE.md
  - docs/assets/annotations.js
  - docs/assets/annotations.css

Actions taken:
- Added top-level crop support to the Sharp renderer.
- The renderer now crops the source image first, shifts annotations into the cropped coordinate space, then applies blur and SVG annotations.
- Added crop support to browser-rendered documentation overlays so runtime documentation previews match generated PNG behavior.
- Added crop support to the annotator "Preview All" browser page.
- Documented the crop format in README.md and AGENT_USAGE.md.
- Added crop to the annotator example config.

Screenshots captured:
- None.

Annotations or masking applied:
- No new screenshot task annotations or masking were applied.
- The example annotated output was regenerated to verify crop behavior.

Verification:
- Ran npm run build:annotations from annotator.
- Ran node bin/annotate.js examples/screen.annotate.yml.
- Confirmed examples/screen.annotated.png was generated at 1024x640 from a 2560x1272 source image.
- Ran node --check for annotator/lib/annotator.js, annotator/lib/server.js, docs/assets/annotations.js, and annotator/public/all.js.
- Started the annotator server on http://localhost:4188 because port 4177 was already in use.
- Opened http://localhost:4188 with Playwright CLI and confirmed the editor loaded the crop config.
- Verified the preview image natural size was 1024x640 and pointed to output.png.
- Captured a Playwright viewport screenshot at .playwright-cli/page-2026-06-04T08-14-22-666Z.png.
- Stopped the local annotator server.

Notes:
- Existing docs screenshot configs without explicit output currently all build to docs/screenshots/annotated.png. This pre-existing behavior is separate from crop support and should be fixed later by defaulting output to <name>.annotated.png or requiring output in each config.
