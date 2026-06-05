#!/usr/bin/env node

const path = require("path");
const { Command } = require("commander");
const { findAnnotationConfigs, generateFromConfigFile } = require("../lib/annotator");

const program = new Command();

program
  .name("build-annotations")
  .description("Rebuild annotated screenshots from saved *.annotate.yml/json configs.")
  .option("-r, --root <path>", "Directory to scan", "../docs/screenshots")
  .action(async (options) => {
    const root = path.resolve(options.root);
    const configs = findAnnotationConfigs(root);

    if (!configs.length) {
      console.log(`No annotation configs found in ${root}`);
      return;
    }

    for (const configPath of configs) {
      const outputPath = await generateFromConfigFile(configPath);
      console.log(`Built: ${outputPath}`);
    }

    console.log(`Done: ${configs.length} annotation config(s)`);
  });

program.parse();
