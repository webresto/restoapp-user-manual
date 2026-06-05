Task: Redesign the annotator UI using shadcn/Radix-oriented UI/UX patterns.

Pages visited:
- http://localhost:4194/
- http://localhost:4194/all

Actions taken:
- Reviewed current shadcn/ui guidance around dashboard/sidebar blocks, composable cards, and Radix Tabs.
- Reworked the editor screen into a three-pane workspace: YAML editor, live preview, and calibration agent.
- Made preview visible by default so the primary review workflow is immediately available.
- Updated the top toolbar into a compact action group with a clearer clean-source status badge.
- Converted panel headers to a more shadcn-like card header pattern with icon, title, subtitle, and action/status area.
- Moved the agent chat from a bottom drawer-like panel into a right-side work panel on desktop.
- Added explicit layout CSS classes for stable desktop/tablet/mobile behavior.
- Refined `/all` header and preview card styling to match the redesigned surface language.

Screenshots captured:
- Temporary Playwright screenshots were captured in `/tmp/restoapp-ui-check` for visual review.

Annotations or masking:
- No screenshot annotation seed files were changed.
- No masking was applied.

Verification:
- Ran `npm run build` in `annotator`; the React/Tailwind client built successfully.
- Started `node bin/serve.js examples/screen.annotate.yml --port 4194`.
- Verified the editor loads with YAML, preview, and agent panels visible.
- Verified `/all` loads without UI errors.
