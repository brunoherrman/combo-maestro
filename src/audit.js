"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function logFile() {
  const orqRoot = path.join(os.homedir(), ".orquestrador");
  const base = fs.existsSync(orqRoot)
    ? path.join(orqRoot, "logs")
    : path.join(os.homedir(), ".combo-maestro", "logs");
  fs.mkdirSync(base, { recursive: true });
  return path.join(base, "combo-delegate.log");
}

function snippet(task) {
  return String(task || "").replace(/\s+/g, " ").trim().slice(0, 70);
}

// Append one TSV line per delegate invocation. status examples:
// exit0 / exit2 / blocked-api / redirect-in-session
function logDelegation({ cli, mode, model, status, task }) {
  const line = [
    new Date().toISOString(),
    cli,
    mode || "-",
    model || "-",
    status,
    snippet(task)
  ].join("\t");
  try {
    fs.appendFileSync(logFile(), line + "\n", "utf8");
  } catch {
    /* logging must never break delegation */
  }
}

function showLog(options) {
  const file = logFile();
  const lines = Number.parseInt(options.lines, 10) > 0 ? Number.parseInt(options.lines, 10) : 20;

  if (!fs.existsSync(file)) {
    console.log(`Sem log ainda: ${file}`);
    console.log("Nenhuma delegacao via combo-maestro delegate foi registrada.");
    return;
  }

  const all = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n").filter(Boolean);
  const tail = all.slice(-lines);

  console.log(`combo-maestro log (ultimas ${tail.length} de ${all.length}) - ${file}\n`);
  console.log(
    `${pad("quando", 20)}  ${pad("cli", 6)}  ${pad("modo", 16)}  ${pad("modelo", 14)}  ${pad("status", 20)}  tarefa`
  );
  console.log("-".repeat(120));
  for (const row of tail) {
    const [ts, cli, mode, model, status, task] = row.split("\t");
    const when = (ts || "").replace("T", " ").slice(0, 19);
    console.log(
      `${pad(when, 20)}  ${pad(cli, 6)}  ${pad(mode, 16)}  ${pad(model, 14)}  ${pad(status, 20)}  ${task || ""}`
    );
  }

  // quick tally
  const counts = {};
  for (const row of all) {
    const status = row.split("\t")[4] || "?";
    counts[status] = (counts[status] || 0) + 1;
  }
  console.log("\nTotais por status: " + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join("  "));
  console.log("Nota: so captura Modo B (codex/mimo via delegate). Modo A in-session (Haiku/Flash) nao passa por aqui.");
}

function pad(value, width) {
  const str = String(value === undefined || value === null ? "" : value);
  return str.length >= width ? str.slice(0, width) : str + " ".repeat(width - str.length);
}

function fmtTokens(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

// Unified TEAM overview from everything the combo actually records: per-agent
// activity + token usage (from local logs), the delegate tally, and the core
// memory count. AionUI's own runs live in its private DB and are not read here.
function teamAudit(options) {
  const { spawnSync } = require("node:child_process");
  const { shellCommandLine } = require("./lib.js");
  const quota = require("./quota.js");
  const days = Number.parseInt(options.days, 10) > 0 ? Number.parseInt(options.days, 10) : 7;
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const projectRoot = path.resolve(options.projectPath || process.cwd());

  console.log(`combo-maestro audit — visao do TEAM (ultimos ${days}d)\n`);

  // 1) Atividade + uso por agente (logs locais).
  const claude = quota.scanClaude(sinceMs);
  const codex = quota.scanCodex(sinceMs);
  console.log("Atividade por agente (uso, dos logs locais):");
  console.log(`  ${pad("agente", 10)}${pad("sessoes", 9)}tokens`);
  console.log(`  ${pad("claude", 10)}${pad(claude.sessions, 9)}${fmtTokens(claude.tokens)}`);
  console.log(`  ${pad("codex", 10)}${pad(codex.sessions, 9)}${fmtTokens(codex.tokens)}`);

  // 2) Delegacoes (Modo B) registradas.
  const file = logFile();
  let delegations = 0;
  const counts = {};
  if (fs.existsSync(file)) {
    for (const row of fs.readFileSync(file, "utf8").split("\n").filter(Boolean)) {
      const ts = row.split("\t")[0];
      if (ts && Date.parse(ts) >= sinceMs) {
        delegations += 1;
        const st = row.split("\t")[4] || "?";
        counts[st] = (counts[st] || 0) + 1;
      }
    }
  }
  console.log(`\nDelegacoes via 'delegate' (Modo B, no periodo): ${delegations}`);
  if (delegations) console.log("  por status: " + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join("  "));

  // 3) Memory do core (observacoes deste projeto).
  // shell:true needs one pre-quoted line (DEP0190), not an args array.
  const line = shellCommandLine("orquestrador-maestro", ["memory", "stats", "--project", projectRoot]);
  const res = spawnSync(line, { shell: true, encoding: "utf8" });
  let mem = "indisponivel";
  try {
    const j = JSON.parse(res.stdout);
    mem = `${j.total} observacoes (verified=${j.verified || 0})`;
  } catch {
    /* core memory optional */
  }
  console.log(`\nMemory do core (projeto): ${mem}`);

  console.log(
    "\nNota: uso e das sessoes que logam token em arquivo (Claude, Codex)." +
    " Modo A in-session (Haiku/Flash) e runs do AionUI (SQLite proprio) nao entram aqui."
  );
}

module.exports = { logDelegation, showLog, logFile, teamAudit };
