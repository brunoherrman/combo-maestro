"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const FINGERPRINT_FILE = ".combo-fingerprint";
const DEFAULT_IGNORE = new Set([
  "node_modules", ".git", "dist", "build", "out", "coverage",
  ".orquestrador", "DEV", ".combo-fingerprint"
]);
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".py", ".go", ".rs"]);

function walk(dir, ignore, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignore.has(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, ignore, acc);
    } else if (SOURCE_EXT.has(path.extname(entry.name))) {
      acc.push(full);
    }
  }
  return acc;
}

function fingerprint(watchDir) {
  const files = walk(watchDir, DEFAULT_IGNORE, []).sort();
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update(fs.readFileSync(file));
  }
  return { digest: hash.digest("hex"), count: files.length };
}

module.exports = function staleCheck(options) {
  const projectRoot = path.resolve(options.projectPath || process.cwd());
  const watchDir = path.resolve(projectRoot, options.watch || "core");
  const fpPath = path.join(projectRoot, FINGERPRINT_FILE);

  if (!fs.existsSync(watchDir)) {
    throw new Error(`Pasta vigiada nao existe: ${watchDir} (use --watch DIR)`);
  }

  const current = fingerprint(watchDir);

  if (options.update) {
    fs.writeFileSync(fpPath, JSON.stringify({ digest: current.digest, watch: options.watch || "core", at: new Date().toISOString() }, null, 2));
    console.log(`Fingerprint gravado (${current.count} arquivos): ${fpPath}`);
    console.log("Rode isso logo apos (re)iniciar o processo que carrega a fonte.");
    return;
  }

  if (!fs.existsSync(fpPath)) {
    console.error(
      `Sem fingerprint. O processo rodando pode estar velho e voce nao tem baseline.\n` +
      `Apos reiniciar o processo, rode: combo-maestro stale-check --watch ${options.watch || "core"} --update`
    );
    process.exit(1);
  }

  const stored = JSON.parse(fs.readFileSync(fpPath, "utf8"));
  if (stored.digest !== current.digest) {
    console.error(
      `[STALE] A fonte em ${watchDir} mudou desde o ultimo start do processo.\n` +
      `O processo/servidor rodando esta VELHO. Reinicie antes de gerar/testar.\n` +
      `Depois de reiniciar: combo-maestro stale-check --watch ${stored.watch} --update`
    );
    process.exit(1);
  }

  console.log(`OK: processo fresco (fonte bate com o fingerprint, ${current.count} arquivos).`);
};
