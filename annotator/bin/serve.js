#!/usr/bin/env node

const path = require("path");
const { Command } = require("commander");
const { startServer } = require("../lib/server");

const program = new Command();

program
  .name("annotator-server")
  .description("Start a browser UI for editing and previewing screenshot annotations.")
  .argument("[config]", "YAML/JSON config file", "examples/screen.annotate.yml")
  .option("-p, --port <port>", "HTTP port", "4177")
  .action(async (configPath, options) => {
    const resolvedConfigPath = path.resolve(configPath);
    const port = Number(options.port);
    const server = await startServer({ configPath: resolvedConfigPath, port });

    console.log(`Annotator UI: http://localhost:${server.port}`);
    console.log(`Config: ${resolvedConfigPath}`);
  });

program.parse();
