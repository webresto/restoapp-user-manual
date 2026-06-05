const path = require("path");
const { spawnSync } = require("child_process");
const { generateFromConfigFile, loadConfigFile } = require("./annotator");
const { startServer } = require("./server");

const DEFAULT_CODEX_COMMAND = process.env.ANNOTATOR_CODEX_COMMAND || "codex";

async function runAnnotationCalibration({
  configPath,
  port = 4177,
  codexCommand = DEFAULT_CODEX_COMMAND,
  codexArgs = "",
  maxIterations = 5,
  instruction = "",
  allowMissingDescriptions = false,
  promptOnly = false,
} = {}) {
  if (!configPath) {
    throw new Error("Config path is required.");
  }

  const resolvedConfigPath = path.resolve(configPath);
  const config = loadConfigFile(resolvedConfigPath);
  const validation = validateCalibrationConfig(config, { allowMissingDescriptions });
  const serverUrl = `http://localhost:${Number(port)}`;
  const prompt = buildCodexCalibrationPrompt({
    configPath: resolvedConfigPath,
    serverUrl,
    maxIterations,
    instruction,
    validation,
  });

  if (promptOnly) {
    return {
      configPath: resolvedConfigPath,
      prompt,
      validation,
      codexRan: false,
      serverUrl,
    };
  }

  const server = await startServer({ configPath: resolvedConfigPath, port: Number(port) });

  try {
    const liveServerUrl = `http://localhost:${server.port}`;
    const livePrompt = buildCodexCalibrationPrompt({
      configPath: resolvedConfigPath,
      serverUrl: liveServerUrl,
      maxIterations,
      instruction,
      validation,
    });
    const result = runCodexCalibrationAgent({
      command: codexCommand,
      args: splitCommandArgs(codexArgs),
      prompt: livePrompt,
      cwd: projectRoot(),
    });

    if (result.status !== 0) {
      throw new Error(
        [
          `Codex calibration agent failed with status ${result.status}.`,
          result.stderr ? `stderr:\n${result.stderr}` : "",
          result.stdout ? `stdout:\n${result.stdout}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      );
    }

    return {
      configPath: resolvedConfigPath,
      outputPath: await generateFromConfigFile(resolvedConfigPath),
      validation,
      codexRan: true,
      codexStdout: result.stdout,
      codexStderr: result.stderr,
      serverUrl: liveServerUrl,
    };
  } finally {
    await server.close();
  }
}

function validateCalibrationConfig(config, { allowMissingDescriptions = false } = {}) {
  const annotations = Array.isArray(config.annotations) ? config.annotations : [];
  const missing = [];

  if (!firstNonEmpty(config.description, config.slide_description, config.annotation_goal)) {
    missing.push("description or slide_description or annotation_goal");
  }

  annotations.forEach((annotation, index) => {
    if (!firstNonEmpty(annotation.description, annotation.target, annotation.success_criteria)) {
      missing.push(`annotations[${index}].description/target/success_criteria`);
    }
  });

  if (missing.length && !allowMissingDescriptions) {
    throw new Error(
      [
        "Annotation calibration requires factual descriptions created before this step.",
        "Missing fields:",
        ...missing.map((item) => `- ${item}`),
        "Add these fields in the annotation YAML, or pass --allow-missing-descriptions for manual/debug runs.",
      ].join("\n"),
    );
  }

  return {
    annotationCount: annotations.length,
    missingDescriptions: missing,
  };
}

function buildCodexCalibrationPrompt({ configPath, serverUrl, maxIterations, instruction, validation }) {
  return `
You are a local screenshot annotation calibration agent for exactly one annotation file.

Scope:
- Work only on this file: ${configPath}
- Do not create screenshots.
- Do not create the initial annotation plan.
- Do not invent new documentation content.
- Do not edit unrelated files.
- Use the already running annotator server: ${serverUrl}
- Editor URL: ${serverUrl}/?config=${encodeURIComponent(configPath)}
- Rendered output URL: ${serverUrl}/output.png?config=${encodeURIComponent(configPath)}

Input contract:
- The YAML already contains factual annotation objects.
- Use top-level description, slide_description, and/or annotation_goal as the picture intent.
- Use annotations[].description, annotations[].target, and annotations[].success_criteria as the calibration criteria.
- There are ${validation.annotationCount} annotation object(s).

Task:
1. Read the YAML file.
2. Open the annotator UI or use POST /api/render on the server.
3. Inspect the rendered preview.
4. Adjust only annotation geometry, label placement/text, and crop if needed for visual alignment.
5. Preserve factual description fields unless a wording fix is directly needed to match the existing annotation.
6. Render after each adjustment.
7. Iterate up to ${Number(maxIterations) || 5} times.
8. Save the final YAML when the annotations are visually acceptable.

Acceptance criteria:
- Each mark aligns with its described target.
- Labels are readable and do not cover important UI text or controls.
- Red marks remain consistent with the annotator style.
- Clean source screenshots stay unchanged.
- If crop exists, it remains a pre-annotation crop; YAML coordinates stay in original screenshot coordinates.

${instruction ? `Additional instruction:\n${instruction}\n` : ""}
Return a concise final summary of what changed.
`.trim();
}

function runCodexCalibrationAgent({ command, args, prompt, cwd }) {
  return spawnSync(command, args, {
    cwd,
    input: prompt,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
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

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
}

function projectRoot() {
  return path.resolve(__dirname, "../..");
}

module.exports = {
  buildCodexCalibrationPrompt,
  runAnnotationCalibration,
  validateCalibrationConfig,
};
