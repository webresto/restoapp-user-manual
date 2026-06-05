#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_URL = process.env.RESTO_MCP_URL || process.env.MCP_URL || "http://localhost:1337/mcp";
const DEFAULT_TIMEOUT_MS = 30000;

function printHelp() {
  console.log(`Usage:
  resto-mcp-tool [options] list
  resto-mcp-tool [options] describe <tool>
  resto-mcp-tool [options] schema <tool>
  resto-mcp-tool [options] call <tool> [json]

Options:
  --url <url>          MCP catalogue URL. Default: RESTO_MCP_URL, MCP_URL, or ${DEFAULT_URL}
  --key <key>          Admin key. Default: MCP_ADMIN_KEY
  --json               Print raw JSON for list/describe/schema
  --pretty             Pretty-print call result JSON. Default for call
  --params-file <file> Read call params JSON from a file
  --timeout <ms>       Request timeout in milliseconds. Default: ${DEFAULT_TIMEOUT_MS}
  -h, --help           Show this help

Examples:
  bin/resto-mcp-tool.js list
  bin/resto-mcp-tool.js describe menu
  bin/resto-mcp-tool.js schema dishes
  bin/resto-mcp-tool.js call health '{}'
  bin/resto-mcp-tool.js --url http://localhost:1337/mcp --key "$MCP_ADMIN_KEY" call modules-info '{}'
`);
}

function parseArgs(argv) {
  const options = {
    url: DEFAULT_URL,
    key: process.env.MCP_ADMIN_KEY || "",
    json: false,
    pretty: false,
    paramsFile: "",
    timeout: DEFAULT_TIMEOUT_MS,
  };
  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--url") {
      options.url = requireValue(argv, ++i, arg);
    } else if (arg === "--key") {
      options.key = requireValue(argv, ++i, arg);
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--pretty") {
      options.pretty = true;
    } else if (arg === "--params-file") {
      options.paramsFile = requireValue(argv, ++i, arg);
    } else if (arg === "--timeout") {
      options.timeout = Number(requireValue(argv, ++i, arg));
      if (!Number.isFinite(options.timeout) || options.timeout <= 0) {
        throw new Error("--timeout must be a positive number");
      }
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  return { options, positionals };
}

function requireValue(argv, index, optionName) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${optionName} requires a value`);
  }
  return value;
}

function normalizeMcpUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.pathname = url.pathname.replace(/\/+$/, "");
  if (!url.pathname.endsWith("/mcp")) {
    url.pathname = `${url.pathname}/mcp`.replace(/\/+/g, "/");
  }
  return url;
}

function buildHeaders(options, extra = {}) {
  return {
    ...(options.key ? { "X-Mcp-Key": options.key } : {}),
    ...extra,
  };
}

async function requestJson(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    const data = text ? parseJson(text, `Response from ${url}`) : null;

    if (!response.ok) {
      const message = data && data.error ? data.error : `${response.status} ${response.statusText}`;
      throw new Error(message);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

async function loadCatalogue(options) {
  const url = normalizeMcpUrl(options.url);
  return requestJson(url, { headers: buildHeaders(options) }, options.timeout);
}

function findTool(catalogue, toolName) {
  const tool = (catalogue.tools || []).find((entry) => entry.name === toolName);
  if (!tool) {
    const names = (catalogue.tools || []).map((entry) => entry.name).join(", ");
    throw new Error(`Tool '${toolName}' not found. Available tools: ${names || "none"}`);
  }
  return tool;
}

function getCallParams(jsonArg, options) {
  if (options.paramsFile) {
    const paramsPath = path.resolve(options.paramsFile);
    return parseJson(fs.readFileSync(paramsPath, "utf8"), paramsPath);
  }
  if (!jsonArg) return {};
  return parseJson(jsonArg, "Call params");
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printToolSummary(tool) {
  const required = Array.isArray(tool.schema && tool.schema.required)
    ? tool.schema.required
    : [];

  console.log(`${tool.name} (${tool.mode})`);
  console.log(tool.description || "No description.");

  const properties = tool.schema && tool.schema.properties ? tool.schema.properties : {};
  const names = Object.keys(properties);

  if (!names.length) {
    console.log("\nParameters: none");
  } else {
    console.log("\nParameters:");
    for (const name of names) {
      const property = properties[name] || {};
      const marker = required.includes(name) ? "required" : "optional";
      const type = property.format ? `${property.type || "any"}:${property.format}` : property.type || "any";
      const description = property.description ? ` - ${property.description}` : "";
      const example = property.example !== undefined ? ` Example: ${JSON.stringify(property.example)}` : "";
      console.log(`- ${name} (${type}, ${marker})${description}${example}`);
    }
  }

  if (tool.call && tool.call.example) {
    console.log(`\nExample:\n${tool.call.example}`);
  }
}

function printToolList(catalogue) {
  const tools = catalogue.tools || [];
  if (!tools.length) {
    console.log("No tools visible. If protected tools are expected, pass --key or set MCP_ADMIN_KEY.");
    return;
  }

  for (const tool of tools) {
    console.log(`${tool.name}\t${tool.mode}\t${tool.description || ""}`);
  }
}

async function main() {
  const { options, positionals } = parseArgs(process.argv.slice(2));

  if (options.help || positionals.length === 0) {
    printHelp();
    return;
  }

  const [command, toolName, jsonArg] = positionals;

  if (command === "list") {
    const catalogue = await loadCatalogue(options);
    options.json ? printJson(catalogue.tools || []) : printToolList(catalogue);
    return;
  }

  if (command === "describe" || command === "schema") {
    if (!toolName) throw new Error(`${command} requires a tool name`);
    const catalogue = await loadCatalogue(options);
    const tool = findTool(catalogue, toolName);
    if (command === "schema") {
      printJson(tool.schema || { type: "object", properties: {} });
    } else {
      options.json ? printJson(tool) : printToolSummary(tool);
    }
    return;
  }

  if (command === "call") {
    if (!toolName) throw new Error("call requires a tool name");
    const params = getCallParams(jsonArg, options);
    const baseUrl = normalizeMcpUrl(options.url);
    const callUrl = new URL(`${baseUrl.toString()}/call/${encodeURIComponent(toolName)}`);
    const result = await requestJson(
      callUrl,
      {
        method: "POST",
        headers: buildHeaders(options, { "Content-Type": "application/json" }),
        body: JSON.stringify(params),
      },
      options.timeout
    );

    printJson(options.pretty || !options.json ? result : result);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`resto-mcp-tool: ${error.message}`);
  process.exitCode = 1;
});
