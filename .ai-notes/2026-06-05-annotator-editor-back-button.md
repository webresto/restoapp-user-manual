Task: Add a back button to the annotator editing screen.

Pages visited:
- No browser pages were visited for this small UI change.

Actions taken:
- Added an icon-only back button to the editor header in `annotator/src/main.jsx`.
- The button calls `window.history.back()` when browser history exists.
- If there is no usable history, it navigates to `/all`.

Screenshots captured:
- None.

Annotations or masking:
- No screenshot annotation seed files were changed.
- No masking was applied.

Verification:
- Ran `npm run build` in `annotator`; the React/Tailwind client built successfully.
