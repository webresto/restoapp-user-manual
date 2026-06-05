Task: Review and improve the redesigned annotator UI for mobile.

Pages visited:
- http://localhost:4195/
- http://localhost:4195/all

Actions taken:
- Captured the editor at a 390x844 mobile viewport.
- Identified that the YAML editor appeared before the preview and pushed the main visual workflow below the fold.
- Updated mobile layout so the preview panel appears first, followed by the YAML editor and then the calibration agent.
- Changed the top toolbar to a two-column grid on mobile so actions fit cleanly.
- Verified `/all` at the same mobile viewport.

Screenshots captured:
- Temporary Playwright screenshots were captured in `/tmp/restoapp-ui-check` for visual review.

Annotations or masking:
- No screenshot annotation seed files were changed.
- No masking was applied.

Verification:
- Ran `npm run build` in `annotator`; the React/Tailwind client built successfully.
- Verified the mobile editor layout at 390x844.
- Verified the mobile `/all` page at 390x844.
