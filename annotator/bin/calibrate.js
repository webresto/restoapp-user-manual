#!/usr/bin/env node

const path = require("path");
const { Command } = require("commander");
const { runAnnotationCalibration } = require("../lib/calibrator");

const program = new Command();

program
  .name("calibrate-annotation")
  .description("Run a local Codex agent to calibrate an existing annotation YAML through the annotator server.")
  .argument("<config>", "Existing YAML/JSON annotation config file")
  .option("-p, --port <port>", "HTTP port for the temporary annotator server", "4177")
  .option("--codex-command <command>", "Local Codex command", process.env.ANNOTATOR_CODEX_COMMAND || "codex")
  .option("--codex-args <args>", "Extra arguments passed to the local Codex command", process.env.ANNOTATOR_CODEX_ARGS || "")
  .option("--max-iterations <count>", "Maximum calibration iterations requested from the Codex agent", "5")
  .option("--instruction <text>", "Additional one-off instruction for the calibration agent", "")
  .option("--allow-missing-descriptions", "Allow calibration even if factual description fields are missing")
  .option("--prompt-only", "Print the generated Codex prompt without starting the server or Codex")
  .action(async (configPath, options) => {
    const result = await runAnnotationCalibration({
      configPath: path.resolve(configPath),
      port: Number(options.port),
      codexCommand: options.codexCommand,
      codexArgs: options.codexArgs,
      maxIterations: Number(options.maxIterations),
      instruction: options.instruction,
      allowMissingDescriptions: Boolean(options.allowMissingDescriptions),
      promptOnly: Boolean(options.promptOnly),
    });

    if (options.promptOnly) {
      console.log(result.prompt);
      return;
    }

    console.log(`Config: ${result.configPath}`);
    console.log(`Output: ${result.outputPath}`);
    console.log(`Calibration server: ${result.serverUrl}`);
    console.log("Codex calibration agent finished.");

    if (result.codexStdout) {
      console.log(result.codexStdout.trim());
    }
  });

program.parse();
