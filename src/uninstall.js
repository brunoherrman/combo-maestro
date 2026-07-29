"use strict";

const path = require("node:path");
const { resolveHome, removeBlock } = require("./lib.js");

module.exports = function uninstall(options) {
  const { orquestrador } = resolveHome(options.homePath);
  const dryRun = Boolean(options.dryRun);

  const files = [
    path.join(orquestrador, "rules.md"),
    path.join(orquestrador, "hooks.md")
  ];

  console.log(`combo-maestro uninstall ${dryRun ? "(dry-run)" : ""}`);
  for (const file of files) {
    const action = removeBlock(file, { dryRun });
    console.log(`- ${path.basename(file)}: ${action}`);
  }
  console.log("\nBlocos COMBO removidos. Os arquivos do Orquestrador ficaram intactos no resto.");
};
