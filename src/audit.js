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

module.exports = { logDelegation, showLog, logFile };
