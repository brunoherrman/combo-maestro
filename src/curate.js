"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { readUtf8, estimateTokens } = require("./lib.js");

// Minimal worklog parser: split into "## " entries (ignoring fenced code + Template).
function parseEntries(content) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const preamble = [];
  const entries = [];
  let inFence = false;
  let current = null;

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
    }
    const isHeader = !inFence && /^## /.test(line) && !/^## Template\b/i.test(line);
    if (isHeader) {
      if (current) entries.push(current);
      current = { header: line.trim(), lines: [line] };
      continue;
    }
    if (current) current.lines.push(line);
    else preamble.push(line);
  }
  if (current) entries.push(current);

  for (const e of entries) {
    e.raw = e.lines.join("\n").replace(/\s+$/u, "");
  }
  return { preamble: preamble.join("\n").trim(), entries };
}

const SUBSTANTIVE = /(^|\n)-\s*(Spec|Verified|Changed|Next context|Risks?)\s*:/i;

function classify(entries, keep) {
  const cutoff = Math.max(0, entries.length - keep);
  return entries.map((entry, idx) => {
    const recent = idx >= cutoff;
    const substantive = SUBSTANTIVE.test(entry.raw) || entry.raw.split("\n").length > 6;
    let bucket;
    if (recent) bucket = "keep";
    else if (substantive) bucket = "gray"; // old BUT looks important -> ask the human
    else bucket = "archive"; // old and thin -> safe to archive
    return { ...entry, bucket };
  });
}

module.exports = function curate(options) {
  const projectRoot = path.resolve(options.projectPath || process.cwd());
  const dev = path.join(projectRoot, "DEV");
  const worklogPath = path.join(dev, "WORKLOG.md");
  const archivePath = path.join(dev, "HANDOFFS", "WORKLOG_ARCHIVE.md");
  const keep = Number.parseInt(options.keep, 10) > 0 ? Number.parseInt(options.keep, 10) : 12;
  const apply = Boolean(options.apply);

  if (!fs.existsSync(worklogPath)) {
    throw new Error(`WORKLOG nao encontrado: ${worklogPath}`);
  }

  const parsed = parseEntries(readUtf8(worklogPath));
  const classified = classify(parsed.entries, keep);
  const keepList = classified.filter((e) => e.bucket === "keep");
  const grayList = classified.filter((e) => e.bucket === "gray");
  const archiveList = classified.filter((e) => e.bucket === "archive");

  console.log("combo-maestro curate (human-in-the-loop)");
  console.log(`Project: ${projectRoot}`);
  console.log(`Worklog: ${parsed.entries.length} entradas (~${estimateTokens(readUtf8(worklogPath))}t)\n`);

  console.log(`PROPOSTA (nada aplicado ainda):`);
  console.log(`  manter:   ${keepList.length} (recentes, ultimas ${keep})`);
  console.log(`  arquivar: ${archiveList.length} (antigas e magras)`);
  console.log(`  CINZA:    ${grayList.length} (antigas MAS substantivas -> voce decide)\n`);

  if (grayList.length > 0) {
    console.log("=".repeat(60));
    console.log("CINZAS - texto literal (decida manter ou arquivar):");
    console.log("=".repeat(60));
    for (const e of grayList) {
      console.log(`\n----- ${e.header} -----`);
      console.log(e.raw);
    }
    console.log("\n" + "=".repeat(60));
  }

  if (!apply) {
    console.log(
      "\nNada foi alterado. Regra dura: o sistema PROPOE, voce APROVA.\n" +
      "Para arquivar APENAS o balde 'arquivar' (cinzas NUNCA sao tocados):\n" +
      `  combo-maestro curate --project-path "${projectRoot}" --keep ${keep} --apply\n` +
      "Cinzas: mova a mao no WORKLOG.md o que voce decidir, ou suba o --keep."
    );
    return;
  }

  // --apply: archive ONLY the safe 'archive' bucket. keep + gray stay in the worklog.
  if (archiveList.length === 0) {
    console.log("\nNada no balde 'arquivar'. Worklog intacto.");
    return;
  }

  const retained = classified.filter((e) => e.bucket !== "archive").map((e) => e.raw).join("\n\n");
  const newWorklog = (parsed.preamble ? `${parsed.preamble}\n\n` : "") + retained + "\n";

  let archiveBody = "";
  if (fs.existsSync(archivePath)) {
    archiveBody = readUtf8(archivePath).replace(/\s+$/u, "") + "\n\n";
  } else {
    archiveBody =
      "# Worklog Archive\n\n" +
      "Entradas antigas e magras movidas por `combo-maestro curate`. Cinzas e recentes ficaram no WORKLOG.\n\n";
  }
  archiveBody += archiveList.map((e) => e.raw).join("\n\n") + "\n";

  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  fs.writeFileSync(archivePath, archiveBody, "utf8");
  fs.writeFileSync(worklogPath, newWorklog, "utf8");

  console.log(`\nAplicado: ${archiveList.length} entradas arquivadas em ${archivePath}.`);
  console.log(`Cinzas (${grayList.length}) e recentes (${keepList.length}) ficaram no WORKLOG.`);
};
