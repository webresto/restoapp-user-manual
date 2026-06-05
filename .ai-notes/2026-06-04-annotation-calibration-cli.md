Task: Add an annotation-only calibration CLI that starts the existing annotator server and delegates visual tuning to a separate local Codex agent.

Pages visited:
- No application pages were visited.
- Repository files inspected:
  - annotator/lib/annotator.js
  - annotator/lib/server.js
  - annotator/README.md
  - annotator/AGENT_USAGE.md
  - AGENTS.md
  - annotator/package.json

Actions taken:
- Removed the previously drafted preparation pipeline approach because screenshot capture and primary annotation creation are handled by another mechanism.
- Added annotator/lib/calibrator.js for annotation-only calibration.
- Added annotator/bin/calibrate.js as the CLI entrypoint.
- Added the calibrate command to annotator/package.json.
- Updated annotator/examples/screen.annotate.yml with factual description fields.
- Documented the calibration CLI in annotator/README.md and annotator/AGENT_USAGE.md.
- Added a root AGENTS.md pointer to annotator/AGENT_USAGE.md and the calibration command.

Screenshots captured:
- None.

Annotations or masking applied:
- No screenshot annotations or masking were changed for documentation screenshots.
- The example seed gained description, annotation_goal, target, and success_criteria fields.

Verification:
- Ran node --check on annotator/lib/calibrator.js and annotator/bin/calibrate.js.
- Ran node annotator/bin/calibrate.js annotator/examples/screen.annotate.yml --prompt-only and verified the prompt scopes the second agent to one YAML file and forbids screenshot/initial annotation creation.
- Ran npm run calibrate -- examples/screen.annotate.yml --prompt-only from annotator and verified the documented npm command works.
- Ran node annotator/bin/calibrate.js docs/screenshots/stock_overview.annotate.yml --prompt-only and confirmed validation fails when factual description fields are missing.
- Ran package.json JSON parsing check.
- Marked annotator/bin/calibrate.js executable.
