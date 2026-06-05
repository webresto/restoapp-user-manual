# Annotator Preview Collapse And Pin

## Pages Visited

- `http://localhost:4177/?config=%2Fprj%2Frestoapp-user-manual%2Fdocs%2Fscreenshots%2Fsettings_edit.annotate.yml`

## Actions Taken

- Removed sticky behavior from the main header.
- Made the preview collapsed by default so it does not consume the screen.
- Added `Show Preview` / `Hide Preview` control.
- Added `Pin` / `Unpin` control so the preview is sticky only when explicitly pinned.
- Kept live preview refresh behavior during running jobs.
- Restarted the annotator server on port `4177`.

## Screenshots Captured

- No repository screenshot files were captured or modified.
- Playwright snapshots were used to verify UI behavior.

## Annotations Or Masking Applied

- No screenshot annotations were changed.
- No masking was applied.

## Verification

- Confirmed header CSS position is `static`.
- Confirmed preview is collapsed by default with `max-height: 42px`.
- Confirmed `Show Preview` opens the image preview to a compact height.
- Confirmed `Pin` changes the preview to sticky and button text changes to `Unpin`.
- Confirmed mobile width `390px` has no horizontal overflow.
- Confirmed no active `codex exec` child process remained.
