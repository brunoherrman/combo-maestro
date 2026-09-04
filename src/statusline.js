"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

// combo-maestro statusline: a Claude Code status line that surfaces the REAL
// usage quota — the 5-hour and 7-day rate-limit windows — plus context fill and
// session cost, and flags the 25/50/75/90% thresholds. No budget to configure:
// Claude Code already computes these and passes them on stdin as JSON.
//
// Wire it in ~/.claude/settings.json:
//   "statusLine": { "type": "command", "command": "combo-maestro statusline" }
//
// Schema (code.claude.com/docs/en/statusline):
//   rate_limits.five_hour.used_percentage / .resets_at (epoch seconds)
//   rate_limits.seven_day.used_percentage / .resets_at
//   context_window.used_percentage / .context_window_size
//   cost.total_cost_usd ; model.display_name

const RESET = "[0m";
const DIM = "[2m";
const GREEN = "[32m";
const YELLOW = "[33m";
const RED = "[31m";
const BOLD = "[1m";

// Color by REMAINING quota. The thresholds the maestro asked for: 25/50/75/90.
function colorForRemaining(remaining) {
  if (remaining <= 10) return RED + BOLD;
  if (remaining <= 25) return RED;
  if (remaining <= 50) return YELLOW;
  return GREEN;
}

function bar(usedPct, width = 10) {
  const used = Math.max(0, Math.min(100, Number(usedPct) || 0));
  const filled = Math.round((used / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function fmtReset(epochSeconds) {
  if (!epochSeconds) return "";
  const ms = Number(epochSeconds) * 1000 - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "reset ja";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `reset ${h}h${String(m).padStart(2, "0")}` : `reset ${m}min`;
}

// One quota window -> "5h ▓▓░░ 40% (reset 2h10)" colored by remaining.
function windowSegment(label, win) {
  if (!win || win.used_percentage == null) return null;
  const used = Math.round(Number(win.used_percentage));
  const remaining = 100 - used;
  const c = colorForRemaining(remaining);
  const reset = win.resets_at ? ` ${DIM}${fmtReset(win.resets_at)}${RESET}` : "";
  return `${c}${label} ${bar(used)} ${remaining}% livre${RESET}${reset}`;
}

// A loud, explicit WARNING when a window is nearly spent — so the maestro can
// summarize and save the task before the quota cuts it off. Not automatic: just
// the alert; the human decides. Escalates at 75% and 90% used.
function warningBanner(rl) {
  let worst = null;
  for (const [label, win] of [["5h", rl.five_hour], ["7d", rl.seven_day]]) {
    if (!win || win.used_percentage == null) continue;
    const used = Math.round(Number(win.used_percentage));
    if (used >= 75 && (!worst || used > worst.used)) worst = { label, used, win };
  }
  if (!worst) return null;
  const reset = worst.win.resets_at ? ` (${fmtReset(worst.win.resets_at)})` : "";
  if (worst.used >= 90) {
    return `${RED}${BOLD}⚠ JANELA ${worst.label} ${worst.used}% — SUMARIZE E SALVE O CONTEXTO JA${reset}${RESET}`;
  }
  return `${YELLOW}${BOLD}⚠ janela ${worst.label} ${worst.used}% — prepare handoff${reset}${RESET}`;
}

function render(input) {
  const parts = [];

  const rl = input.rate_limits || {};
  // Warning goes FIRST so it is impossible to miss at the threshold.
  const warn = warningBanner(rl);
  if (warn) parts.push(warn);

  const model = input.model && input.model.display_name;
  if (model) parts.push(`${DIM}[${model}]${RESET}`);

  const five = windowSegment("5h", rl.five_hour);
  const seven = windowSegment("7d", rl.seven_day);
  if (five) parts.push(five);
  if (seven) parts.push(seven);

  const ctx = input.context_window;
  if (ctx && ctx.used_percentage != null) {
    const usedCtx = Math.round(Number(ctx.used_percentage));
    const remCtx = 100 - usedCtx;
    parts.push(`${colorForRemaining(remCtx)}ctx ${usedCtx}%${RESET}`);
  }

  const cost = input.cost && input.cost.total_cost_usd;
  if (typeof cost === "number") parts.push(`${DIM}$${cost.toFixed(2)}${RESET}`);

  // Fallback when Claude Code passes no windows (older version): at least a hint.
  if (parts.length === 0 || (!five && !seven && !(ctx && ctx.used_percentage != null))) {
    parts.push(`${DIM}quota: sem dados de rate-limit nesta versao do Claude Code${RESET}`);
  }
  return parts.join(`  ${DIM}|${RESET}  `);
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => {
      data += c;
    });
    process.stdin.on("end", () => resolve(data));
    // Safety: if nothing arrives, don't hang the status line.
    setTimeout(() => resolve(data), 500);
  });
}

// Optional composition: if ~/.orquestrador/statusline-prepend holds a command,
// run it with the SAME session JSON on stdin and put its output first. Lets the
// combo quota line coexist with an existing status line (e.g. caveman) without
// clobbering it and without quoting a command inside settings.json.
function prependLine(raw) {
  const file = path.join(os.homedir(), ".orquestrador", "statusline-prepend");
  let cmd;
  try {
    cmd = fs.readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
  if (!cmd) return "";
  try {
    const res = spawnSync(cmd, { shell: true, input: raw, encoding: "utf8", timeout: 3000 });
    return (res.stdout || "").replace(/\n+$/, "");
  } catch {
    return "";
  }
}

module.exports = async function statusline() {
  const raw = await readStdin();
  let input = {};
  if (raw.trim()) {
    try {
      input = JSON.parse(raw);
    } catch {
      // Not JSON on stdin -> print nothing rather than an error in the status bar.
      process.stdout.write("");
      return;
    }
  }
  const before = prependLine(raw);
  const quota = render(input);
  process.stdout.write(before ? `${before}\n${quota}` : quota);
};

// Exposed for tests.
module.exports.render = render;
module.exports.fmtReset = fmtReset;
module.exports.bar = bar;
module.exports.colorForRemaining = colorForRemaining;
