# Prompt: Routes & Actions Audit

You are a code audit agent. Read the application source code and produce a table of all routes with the actions available on each.

## Inputs

- Repository path of the application.
- User roles to check (e.g. admin, manager).

## What to do

1. Find all route definitions.
2. Find navigation config files (sidebar, menu, tabs) — use them as an additional source of screens.
3. Merge routes and navigation entries into one list.
4. For each entry, find the controller or handler.
5. From the controller, extract what actions the user can perform (create, edit, delete, filter, export, etc.).
6. Note which role or permission is required.

## Output

One table:

| Route | Screen name | Role | Actions |
|-------|-------------|------|---------|

Nothing else. No descriptions, no recommendations, no screenshots.

## AI Notes

Create `.ai-notes/YYYY-MM-DD-routes-audit.md`. List which files were read.
