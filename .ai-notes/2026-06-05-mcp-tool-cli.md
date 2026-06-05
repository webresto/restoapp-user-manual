# MCP Tool CLI

## Pages Visited

- No browser pages were visited.
- Local MCP documentation was inspected in `../restoapp/docs/mcp.md`.
- Local MCP server implementation was inspected in `../restoapp/api/mcp/McpServer.js`.

## Actions Taken

- Added `bin/resto-mcp-tool.js`, a local CLI wrapper for the RestoApp MCP HTTP endpoint.
- Added commands for listing tools, describing a tool, printing a tool schema, and calling a tool with JSON parameters.
- Added support for `RESTO_MCP_URL`, `MCP_URL`, `MCP_ADMIN_KEY`, `--params-file`, and request timeouts.
- Updated `AGENTS.md` so future agents use the local CLI instead of repeated hand-written `curl` calls.

## Screenshots Captured

- No screenshots were captured or modified.

## Annotations Or Masking Applied

- No screenshot annotations were changed.
- No masking was applied.

## Verification

- Ran `node --check bin/resto-mcp-tool.js`.
- Ran `bin/resto-mcp-tool.js --help`.
- Ran `list`, `describe`, `schema`, and `call` against a temporary in-memory MCP-compatible HTTP server.
