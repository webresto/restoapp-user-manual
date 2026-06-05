# Annotator Agent Chat UI

## Pages Visited

- `http://localhost:4177`
- `http://localhost:4177/?config=%2Fprj%2Frestoapp-user-manual%2Fdocs%2Fscreenshots%2Fsettings_edit.annotate.yml`

## Actions Taken

- Added an agent chat panel to the single annotation editor.
- Added a `Calibrate` button that starts a local Codex calibration job scoped to the current annotation YAML.
- Added a `Stop` button and server-side stop endpoint for long-running agent jobs.
- Added a server-side timeout for agent jobs.
- Passed the current config path, preview URL, rendered output URL, and current YAML text into agent jobs.
- Kept clean screenshots unchanged.
- Restarted the annotator server on port `4177`.

## Screenshots Captured

- No repository screenshot files were captured or modified for this UI implementation.
- Playwright snapshots were used to verify the browser UI state.

## Annotations Or Masking Applied

- No screenshot annotations were changed.
- No masking was applied.

## Verification

- Clicked `Original` and `Annotated`; preview tab switching worked.
- Clicked `Render`; output rendered and status returned to ready.
- Clicked `Save + Render`; config saved and output rendered.
- Sent a chat request asking the agent to validate the current YAML without editing; Codex reported valid YAML with 3 annotations and a successful PNG render.
- Clicked `Calibrate`; calibration job started for `settings_edit.annotate.yml`.
- Clicked `Stop`; job stopped and UI status changed to `Cancelled`.
- Verified mobile viewport `390x844` had no horizontal overflow and the chat controls remained visible.
