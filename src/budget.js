"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { readUtf8, estimateTokens } = require("./lib.js");

const WORKLOG_WARN_TOKENS = 3000;

function sizeOf(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const text = readUtf8(filePath);
  return { chars: text.length, tokens: estimateTokens(text) };
}

module.exports = function budget(options) {
  const projectRoot = path.resolve(options.projectPath || process.cwd());
  const dev = path.join(projectRoot, "DEV");

  const items = [
    ["WORKLOG", path.join(dev, "WORKLOG.md")],
    ["HANDOFF", path.join(dev, "HANDOFF.md")],
    ["CONTEXT", path.join(dev, "CONTEXT.md")],
    ["SPEC", path.join(dev, "SPECS", "ACTIVE.md")]
  ];

  console.log("combo-maestro budget");
  console.log(`Project: ${projectRoot}`);

  let worklogTokens = 0;
  const cells = [];
  for (const [label, file] of items) {
    const size = sizeOf(file);
    if (!size) {
      cells.push(`${label}: ausente`);
      continue;
    }
    cells.push(`${label}: ~${size.tokens}t (${size.chars}c)`);
    if (label === "WORKLOG") {
      worklogTokens = size.tokens;
    }
  }

  console.log(cells.join("  |  "));

  if (worklogTokens > WORKLOG_WARN_TOKENS) {
    console.log(
      `\n[!] WORKLOG passou de ${WORKLOG_WARN_TOKENS}t (~${worklogTokens}t). ` +
      `Considere: combo-maestro curate --project-path "${projectRoot}"`
    );
  }
};
