Task: Investigate whether the screenshot annotator can carry textual annotation descriptions and run a local Codex loop until annotations match the description.

Pages visited:
- No application pages were visited.
- Repository files inspected:
  - annotator/lib/annotator.js
  - annotator/lib/server.js
  - annotator/public/app.js
  - annotator/public/all.js
  - annotator/README.md
  - annotator/AGENT_USAGE.md
  - docs/screenshots/*.annotate.yml

Actions taken:
- Reviewed the existing annotation YAML format.
- Reviewed the Sharp-based renderer and browser preview server.
- Checked how all screenshot manifests are loaded for the preview-all page.
- Checked whether unknown annotation fields would break rendering.
- Evaluated where a local Codex subprocess loop could be added.

Screenshots captured:
- None.

Annotations or masking applied:
- None.

Findings:
- The current renderer ignores unknown annotation fields, so textual fields such as description and intent can be added to annotation objects without affecting output.
- The current server can render candidate configs through POST /api/render, which is enough for an external loop to iterate on YAML.
- A robust local Codex loop should be implemented as a separate CLI command instead of as implicit server behavior.
- Browser-level verification is still needed because the current renderer has no semantic understanding of whether a shape targets the intended UI element.

Verification:
- This was a static code investigation only. No code was changed and no annotation render was run.
