Task: Rework the screenshot annotator UI into a React/Tailwind interface.

Pages visited:
- http://localhost:4187/
- http://localhost:4187/all
- http://localhost:4188/all

Actions taken:
- Inspected the existing annotator static UI in `annotator/public/index.html`, `annotator/public/app.js`, `annotator/public/all.html`, `annotator/public/all.js`, and `annotator/public/styles.css`.
- Added a Vite React app under `annotator/src`.
- Added Tailwind v4 styling through `@tailwindcss/vite`.
- Added Radix Tabs for the preview mode control.
- Added lucide icons and local shadcn-like Button, LinkButton, Badge, panel, status, and message components.
- Updated the annotator server to serve Vite `dist` assets and fall back to the legacy `public` assets when no build exists.
- Added automatic client build freshness checks before the annotator server starts.
- Preserved the existing API contract for config loading, rendering, agent jobs, input image, output image, and all-annotation previews.

Screenshots captured:
- Temporary Playwright screenshots were captured during verification and removed after review because they were not deliverable repository assets.

Verification:
- Ran `npm run build` successfully after adding the React/Tailwind app.
- Started `node bin/serve.js examples/screen.annotate.yml --port 4187`.
- Verified the editor page loads, shows config text, status, toolbar actions, preview tabs, the image preview, and the agent chat area.
- Opened the preview panel through the UI and captured the rendered state.
- Started `node bin/serve.js ../docs/screenshots/settings_list.annotate.yml --port 4188`.
- Verified `/all` loads documentation screenshot manifests and reports 25 screenshot previews.
- Adjusted the preview list layout after visual review to reduce wasted space.

Annotations or masking:
- No screenshot annotation seed files were changed.
- No masking was applied in this task.
