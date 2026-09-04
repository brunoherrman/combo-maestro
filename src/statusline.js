"use strict";

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

function render(input) {
  const parts = [];

  const model = input.model && input.model.display_name;
  if (model) parts.push(`${DIM}[${model}]${RESET}`);

  const rl = input.rate_limits || {};
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
  process.stdout.write(render(input));
};

// Exposed for tests.
module.exports.render = render;
module.exports.fmtReset = fmtReset;
module.exports.bar = bar;
module.exports.colorForRemaining = colorForRemaining;
