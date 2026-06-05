#!/usr/bin/env node

const path = require("path");
const { Command } = require("commander");
const { generateFromConfigFile } = require("../lib/annotator");

const program = new Command();

program
  .name("annotate-image")
  .description("Generate an annotated screenshot from a YAML or JSON config.")
  .argument("<config>", "YAML/JSON config file")
  .action(async (configPath) => {
    const outputPath = await generateFromConfigFile(path.resolve(configPath));
    console.log(`Saved: ${outputPath}`);
  });

program.parse();
