const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const yaml = require("js-yaml");
const {
  findAnnotationConfigs,
  generateAnnotatedImage,
  generateFromConfigFile,
  loadConfigFile,
} = require("./annotator");

const PUBLIC_DIR = path.resolve(__dirname, "../public");
const CLIENT_DIST_DIR = path.resolve(__dirname, "../dist");
const CLIENT_SOURCE_DIR = path.resolve(__dirname, "../src");
const CLIENT_ENTRY = path.resolve(__dirname, "../index.html");
// Selectable agent engines. Defaults are hardcoded to a middle-tier model with
// medium reasoning effort; each can be overridden with the matching env vars.
const AGENT_ENGINES = {
  codex: {
    command: process.env.ANNOTATOR_AGENT_COMMAND || process.env.ANNOTATOR_CODEX_COMMAND || "codex",
    args:
      process.env.ANNOTATOR_AGENT_ARGS ||
      process.env.ANNOTATOR_CODEX_ARGS ||
      // gpt-5 = middle model; model_reasoning_effort=medium
      `exec --cd ${projectRoot()} --sandbox danger-full-access --skip-git-repo-check --color never -m gpt-5 -c model_reasoning_effort="medium" -`,
  },
  claude: {
    command: process.env.ANNOTATOR_CLAUDE_COMMAND || "claude",
    args:
      process.env.ANNOTATOR_CLAUDE_ARGS ||
      // sonnet = middle model (claude CLI has no separate reasoning-effort flag)
      `-p --permission-mode bypassPermissions --model sonnet`,
  },
};
const DEFAULT_AGENT_ENGINE = process.env.ANNOTATOR_AGENT_ENGINE || "codex";
const DEFAULT_AGENT_TIMEOUT_MS = Number(process.env.ANNOTATOR_AGENT_TIMEOUT_MS || 10 * 60 * 1000);

async function startServer({ configPath, port }) {
  const resolvedConfigPath = path.resolve(configPath);
  ensureClientBuild();
  await generateFromConfigFile(resolvedConfigPath);
  const agentJobs = new Map();
  let nextAgentJobId = 1;

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, "http://localhost");
      const clientDir = fs.existsSync(path.join(CLIENT_DIST_DIR, "index.html")) ? CLIENT_DIST_DIR : PUBLIC_DIR;

      if (req.method === "GET" && requestUrl.pathname === "/") {
        return sendFile(res, path.join(clientDir, "index.html"), "text/html; charset=utf-8");
      }

      if (req.method === "GET" && requestUrl.pathname === "/all") {
        return sendFile(res, path.join(clientDir, fs.existsSync(path.join(clientDir, "all.html")) ? "all.html" : "index.html"), "text/html; charset=utf-8");
      }

      if (req.method === "GET" && requestUrl.pathname.startsWith("/assets/")) {
        const assetPath = path.resolve(clientDir, `.${requestUrl.pathname}`);
        if (!assetPath.startsWith(clientDir + path.sep)) {
          return sendJson(res, { error: "Invalid asset path" }, 400);
        }
        return sendFile(res, assetPath, guessContentType(assetPath));
      }

      if (req.method === "GET" && requestUrl.pathname === "/app.js") {
        return sendFile(res, path.join(PUBLIC_DIR, "app.js"), "text/javascript; charset=utf-8");
      }

      if (req.method === "GET" && requestUrl.pathname === "/all.js") {
        return sendFile(res, path.join(PUBLIC_DIR, "all.js"), "text/javascript; charset=utf-8");
      }

      if (req.method === "GET" && requestUrl.pathname === "/styles.css") {
        return sendFile(res, path.join(PUBLIC_DIR, "styles.css"), "text/css; charset=utf-8");
      }

      if (req.method === "GET" && requestUrl.pathname === "/favicon.ico") {
        res.writeHead(204, { "Cache-Control": "no-store" });
        return res.end();
      }

      if (req.method === "GET" && requestUrl.pathname === "/api/state") {
        const targetConfigPath = resolveRequestedConfigPath(resolvedConfigPath, requestUrl);
        const virtualConfig = getVirtualConfigFromRequest(targetConfigPath, requestUrl);
        return sendJson(res, getState(targetConfigPath, virtualConfig));
      }

      if (req.method === "GET" && requestUrl.pathname === "/api/all-annotations") {
        return sendJson(res, getAllAnnotationsState(resolvedConfigPath));
      }

      if (req.method === "GET" && requestUrl.pathname === "/api/config") {
        const targetConfigPath = resolveRequestedConfigPath(resolvedConfigPath, requestUrl);
        if (fs.existsSync(targetConfigPath)) {
          return sendText(res, fs.readFileSync(targetConfigPath, "utf8"), configContentType(targetConfigPath));
        }

        const virtualConfig = getVirtualConfigFromRequest(targetConfigPath, requestUrl);
        if (!virtualConfig) {
          throw new Error(`Config not found: ${targetConfigPath}`);
        }

        return sendText(
          res,
          configContentType(targetConfigPath).includes("json")
            ? `${JSON.stringify(virtualConfig, null, 2)}\n`
            : yaml.dump(virtualConfig, { lineWidth: 100, noRefs: true }),
          configContentType(targetConfigPath),
        );
      }

      if (req.method === "PUT" && requestUrl.pathname === "/api/config") {
        const targetConfigPath = resolveRequestedConfigPath(resolvedConfigPath, requestUrl);
        const body = await readBody(req);
        parseConfigText(targetConfigPath, body);
        fs.writeFileSync(targetConfigPath, body, "utf8");
        await generateFromConfigFile(targetConfigPath);
        return sendJson(res, getState(targetConfigPath));
      }

      if (req.method === "POST" && requestUrl.pathname === "/api/render") {
        const targetConfigPath = resolveRequestedConfigPath(resolvedConfigPath, requestUrl);
        const body = await readJson(req);
        const state = await renderRequest(targetConfigPath, body);
        return sendJson(res, state);
      }

      if (req.method === "POST" && requestUrl.pathname === "/api/agent") {
        const targetConfigPath = resolveRequestedConfigPath(resolvedConfigPath, requestUrl);
        const body = await readJson(req);
        const serverUrl = `http://localhost:${server.address().port}`;
        const job = await startAgentJob({
          jobs: agentJobs,
          id: nextAgentJobId++,
          configPath: targetConfigPath,
          serverUrl,
          body,
        });
        return sendJson(res, jobSnapshot(job));
      }

      if (req.method === "POST" && /^\/api\/agent\/\d+\/stop$/.test(requestUrl.pathname)) {
        const id = Number(requestUrl.pathname.split("/").at(-2));
        const job = agentJobs.get(id);
        if (!job) {
          return sendJson(res, { error: `Agent job not found: ${id}` }, 404);
        }
        stopAgentJob(job);
        return sendJson(res, jobSnapshot(job));
      }

      if (req.method === "GET" && requestUrl.pathname.startsWith("/api/agent/")) {
        const id = Number(requestUrl.pathname.split("/").pop());
        const job = agentJobs.get(id);
        if (!job) {
          return sendJson(res, { error: `Agent job not found: ${id}` }, 404);
        }
        return sendJson(res, jobSnapshot(job));
      }

      if (req.method === "GET" && requestUrl.pathname === "/input.png") {
        const targetConfigPath = resolveRequestedConfigPath(resolvedConfigPath, requestUrl);
        const config = fs.existsSync(targetConfigPath)
          ? loadConfigFile(targetConfigPath)
          : getVirtualConfigFromRequest(targetConfigPath, requestUrl);
        return sendFile(res, path.resolve(path.dirname(targetConfigPath), config.input), "image/png");
      }

      if (req.method === "GET" && requestUrl.pathname === "/output.png") {
        const targetConfigPath = resolveRequestedConfigPath(resolvedConfigPath, requestUrl);
        if (!fs.existsSync(targetConfigPath)) {
          return sendJson(res, { error: `Output is not available until the config is saved: ${targetConfigPath}` }, 404);
        }
        const config = loadConfigFile(targetConfigPath);
        return sendFile(res, path.resolve(path.dirname(targetConfigPath), config.output || "annotated.png"), "image/png");
      }

      if (req.method === "GET" && requestUrl.pathname === "/asset") {
        const assetPath = requestUrl.searchParams.get("path");
        if (!assetPath) {
          return sendJson(res, { error: "Missing path query parameter" }, 400);
        }

        return sendFile(res, assetPath, guessContentType(assetPath));
      }

      sendJson(res, { error: "Not found" }, 404);
    } catch (error) {
      sendJson(res, { error: error.message }, 500);
    }
  });

  await new Promise((resolve) => server.listen(port, resolve));

  return {
    close: () => new Promise((resolve) => server.close(resolve)),
    port: server.address().port,
  };
}

async function renderRequest(configPath, body) {
  if (body && typeof body.configText === "string") {
    const config = parseConfigText(configPath, body.configText);

    if (body.save) {
      fs.writeFileSync(configPath, body.configText, "utf8");
    }

    await generateAnnotatedImage({ config, baseDir: path.dirname(configPath) });
    return getState(configPath, config);
  }

  await generateFromConfigFile(configPath);
  return getState(configPath);
}

async function startAgentJob({ jobs, id, configPath, serverUrl, body }) {
  const mode = body?.mode === "calibrate" ? "calibrate" : "chat";
  const userMessage = String(body?.message || "").trim();
  const engineName = AGENT_ENGINES[body?.agent] ? body.agent : DEFAULT_AGENT_ENGINE;
  const engine = AGENT_ENGINES[engineName] || AGENT_ENGINES.codex;

  if (mode === "chat" && !userMessage) {
    throw new Error("Agent message is required.");
  }

  if (body && typeof body.configText === "string") {
    parseConfigText(configPath, body.configText);
    fs.writeFileSync(configPath, body.configText, "utf8");
    await generateFromConfigFile(configPath);
  }

  const job = {
    id,
    mode,
    engine: engineName,
    status: "running",
    configPath,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    log: [],
    state: null,
    timeoutMs: DEFAULT_AGENT_TIMEOUT_MS,
  };

  jobs.set(id, job);
  appendJobLog(job, "system", `Started ${mode === "calibrate" ? "calibration" : "agent"} job for ${configPath} using ${engineName}`);

  const prompt = buildAgentPrompt({ configPath, serverUrl, mode, userMessage });
  const child = spawn(engine.command, splitCommandArgs(engine.args), {
    cwd: projectRoot(),
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });
  job.child = child;
  job.timeout = setTimeout(() => {
    if (job.status !== "running") {
      return;
    }

    job.status = "timed_out";
    appendJobLog(job, "system", `Job exceeded ${Math.round(job.timeoutMs / 1000)} seconds; stopping process.`);
    child.kill("SIGTERM");
    job.killTimeout = setTimeout(() => child.kill("SIGKILL"), 5000);
  }, job.timeoutMs);

  child.stdin.end(prompt);
  child.stdout.on("data", (chunk) => appendJobLog(job, "stdout", chunk.toString("utf8")));
  child.stderr.on("data", (chunk) => appendJobLog(job, "stderr", chunk.toString("utf8")));
  child.on("error", (error) => {
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    appendJobLog(job, "error", error.message);
  });
  child.on("close", async (code) => {
    clearTimeout(job.timeout);
    clearTimeout(job.killTimeout);
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();

    try {
      await generateFromConfigFile(configPath);
      job.state = getState(configPath);
    } catch (error) {
      appendJobLog(job, "error", `Render after agent failed: ${error.message}`);
    }

    if (job.status === "running") {
      job.status = code === 0 ? "finished" : "failed";
    }
    appendJobLog(job, "system", `Job ${job.status} with exit code ${code}`);
  });

  return job;
}

function stopAgentJob(job) {
  if (job.status !== "running") {
    return;
  }

  job.status = "cancelled";
  appendJobLog(job, "system", "Stop requested from annotator UI.");
  clearTimeout(job.timeout);
  job.child?.kill("SIGTERM");
  job.killTimeout = setTimeout(() => job.child?.kill("SIGKILL"), 5000);
}

function buildAgentPrompt({ configPath, serverUrl, mode, userMessage }) {
  if (mode === "calibrate") {
    const { buildCodexCalibrationPrompt, validateCalibrationConfig } = require("./calibrator");
    const config = loadConfigFile(configPath);
    const validation = validateCalibrationConfig(config, { allowMissingDescriptions: true });
    return buildCodexCalibrationPrompt({
      configPath,
      serverUrl,
      maxIterations: 5,
      instruction: userMessage || "Run calibration for the current annotation file from the annotator UI button.",
      validation,
    });
  }

  return `
You are a local screenshot annotation editing agent for exactly one annotation file.

Scope:
- Work only on this file: ${configPath}
- Use the already running annotator server: ${serverUrl}
- Editor URL: ${serverUrl}/?config=${encodeURIComponent(configPath)}
- Rendered output URL: ${serverUrl}/output.png?config=${encodeURIComponent(configPath)}
- Do not edit unrelated files.
- Do not modify the clean source screenshot.
- Keep factual description fields unless the user's request explicitly requires a wording fix.
- If you change annotation geometry, render and inspect the result through the annotator server.
- Explain observable actions and results in stdout, but do not print hidden private reasoning.

Cropping:
- To reduce the screenshot to a region, set a top-level \`crop\` block with \`x\`, \`y\`, \`width\`, \`height\` in pixels of the original screenshot.
- Example:
  crop:
    x: 120
    y: 80
    width: 1024
    height: 640
- Always express crop and every annotation coordinate in the ORIGINAL screenshot coordinate system. The annotator crops first, then automatically shifts all annotations into the cropped output, so do not pre-subtract the crop offset yourself.
- Keep the crop box inside the image bounds and large enough to contain the annotations the user wants visible.
- To remove cropping, delete the entire \`crop\` block.

Current user request:
${userMessage}

Acceptance criteria:
- The YAML remains valid.
- The screenshot preview renders successfully.
- Changes are limited to the current annotation file and its generated annotated output.
- The final response concisely lists what changed and any remaining issue.
`.trim();
}

function appendJobLog(job, stream, text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n");
  if (!normalized) {
    return;
  }

  job.log.push({
    stream,
    text: normalized,
    at: new Date().toISOString(),
  });
}

function jobSnapshot(job) {
  return {
    id: job.id,
    mode: job.mode,
    engine: job.engine,
    status: job.status,
    configPath: job.configPath,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode,
    timeoutMs: job.timeoutMs,
    log: job.log,
    state: job.state,
  };
}

function getState(configPath, loadedConfig) {
  const config = loadedConfig || loadConfigFile(configPath);
  const baseDir = path.dirname(configPath);
  const inputPath = path.resolve(baseDir, config.input);
  const outputPath = path.resolve(baseDir, config.output || "annotated.png");
  const outputExists = fs.existsSync(configPath) && fs.existsSync(outputPath);

  return {
    configPath,
    inputPath,
    outputPath,
    outputExists,
    inputUrl: withConfigQuery(`/input.png?t=${mtime(inputPath)}`, configPath),
    outputUrl: outputExists ? withConfigQuery(`/output.png?t=${mtime(outputPath)}`, configPath) : null,
    annotationCount: Array.isArray(config.annotations) ? config.annotations.length : 0,
  };
}

function getAllAnnotationsState(configPath) {
  const rootDir = path.dirname(configPath);
  const manifestPaths = findScreenshotManifestPaths(rootDir);

  return {
    rootDir,
    languages: manifestPaths.map((manifestPath) => {
      const manifest = yaml.load(fs.readFileSync(manifestPath, "utf8")) || {};
      const language = manifest.language || inferLanguageFromManifestPath(manifestPath);
      const items = Array.isArray(manifest.items) ? manifest.items : [];

      return {
        language,
        manifestPath,
        items: items.map((item) => buildManifestPreviewItem(rootDir, item)),
      };
    }),
  };
}

function buildManifestPreviewItem(rootDir, item) {
  const inputPath = path.resolve(rootDir, item.image);
  const configPath = path.resolve(rootDir, item.config || defaultConfigNameForImage(item.image));
  const config = configPath && fs.existsSync(configPath) ? loadConfigFile(configPath) : null;

  return {
    title: item.title || path.basename(item.image || ""),
    page: item.page || "",
    image: item.image || "",
    name: path.basename(configPath),
    configPath,
    editorUrl: config
      ? `/?config=${encodeURIComponent(configPath)}`
      : `/?config=${encodeURIComponent(configPath)}&image=${encodeURIComponent(item.image || "")}`,
    inputPath,
    inputUrl: `/asset?path=${encodeURIComponent(inputPath)}&t=${mtime(inputPath)}`,
    width: config?.width || null,
    height: config?.height || null,
    crop: config?.crop || null,
    annotations: Array.isArray(config?.annotations) ? config.annotations : [],
  };
}

function findScreenshotManifestPaths(rootDir) {
  return fs
    .readdirSync(rootDir)
    .filter((name) => /^screenshots\.[^.]+\.(ya?ml)$/i.test(name))
    .map((name) => path.join(rootDir, name))
    .sort();
}

function inferLanguageFromManifestPath(manifestPath) {
  const match = path.basename(manifestPath).match(/^screenshots\.([^.]+)\.ya?ml$/i);
  return match ? match[1] : "unknown";
}

function parseConfigText(configPath, text) {
  const config = configPath.endsWith(".json") ? JSON.parse(text) : yaml.load(text);

  if (!config || !config.input) {
    throw new Error("Config must include an input image path.");
  }

  return config;
}

function resolveRequestedConfigPath(defaultConfigPath, requestUrl) {
  const requestedPath = requestUrl.searchParams.get("config");

  if (!requestedPath) {
    return defaultConfigPath;
  }

  const resolvedPath = path.resolve(requestedPath);
  return resolvedPath;
}

function getVirtualConfigFromRequest(configPath, requestUrl) {
  if (fs.existsSync(configPath)) {
    return null;
  }

  const imageName = requestUrl.searchParams.get("image");
  if (!imageName) {
    return null;
  }

  return {
    input: imageName,
    annotations: [],
  };
}

function defaultConfigNameForImage(imageName) {
  return String(imageName || "").replace(/\.(png|jpe?g|webp)$/i, ".annotate.yml");
}

function withConfigQuery(urlPath, configPath) {
  const separator = urlPath.includes("?") ? "&" : "?";
  return `${urlPath}${separator}config=${encodeURIComponent(configPath)}`;
}

function configContentType(configPath) {
  return configPath.endsWith(".json")
    ? "application/json; charset=utf-8"
    : "application/x-yaml; charset=utf-8";
}

function guessContentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function mtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return Date.now();
  }
}

function sendFile(res, filePath, contentType) {
  if (!fs.existsSync(filePath)) {
    return sendJson(res, { error: `File not found: ${filePath}` }, 404);
  }

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

function sendText(res, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function sendJson(res, value, statusCode = 200) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

async function readJson(req) {
  const body = await readBody(req);
  return body ? JSON.parse(body) : {};
}

function splitCommandArgs(argsText) {
  if (Array.isArray(argsText)) {
    return argsText;
  }

  return String(argsText || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function projectRoot() {
  return path.resolve(__dirname, "../..");
}

function ensureClientBuild() {
  if (!fs.existsSync(CLIENT_ENTRY) || !fs.existsSync(CLIENT_SOURCE_DIR)) {
    return;
  }

  const outputEntry = path.join(CLIENT_DIST_DIR, "index.html");
  const outputMtime = latestMtime(CLIENT_DIST_DIR);
  const sourceMtime = Math.max(latestMtime(CLIENT_SOURCE_DIR), mtime(CLIENT_ENTRY), mtime(path.resolve(__dirname, "../vite.config.js")));

  if (fs.existsSync(outputEntry) && outputMtime >= sourceMtime) {
    return;
  }

  const result = spawnSync("npm", ["run", "build"], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Client build failed${output ? `:\n${output}` : "."}`);
  }
}

function latestMtime(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    return stat.mtimeMs;
  }

  return fs.readdirSync(targetPath).reduce((latest, name) => {
    return Math.max(latest, latestMtime(path.join(targetPath, name)));
  }, stat.mtimeMs);
}

module.exports = { startServer };
