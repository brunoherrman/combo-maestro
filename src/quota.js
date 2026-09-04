"use strict";

// combo-maestro quota: a usage ledger across the LLMs you actually run, read
// from what each tool ALREADY logs on disk — no API keys, no daemon, no budget.
//
// Honest scope: this reports TOKEN USAGE (and a rough list-price $ reference),
// not a rate-limit window %. The real 5h/7d window is Claude-Code-only and lives
// in `combo-maestro statusline`; AionUI shows the windows for its own agents.
// Sources that expose usage in a file:
//   - Claude Code transcripts: ~/.claude/projects/<slug>/*.jsonl (message.usage)
//   - Codex sessions:          ~/.codex/sessions/YYYY/MM/DD/*.jsonl (total_tokens)

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Rough list-price reference, USD per 1M tokens (blended). NOT your bill —
// especially on a subscription. Override with ~/.orquestrador/quota-rates.json
// ({ "claude": 5, "codex": 3, ... }).
const DEFAULT_RATES = { claude: 5, codex: 3, gemini: 1, grok: 2 };

function loadRates() {
  try {
    const f = path.join(os.homedir(), ".orquestrador", "quota-rates.json");
    return { ...DEFAULT_RATES, ...JSON.parse(fs.readFileSync(f, "utf8")) };
  } catch {
    return { ...DEFAULT_RATES };
  }
}

function walkJsonl(dir, sinceMs, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkJsonl(p, sinceMs, acc);
    } else if (e.name.endsWith(".jsonl")) {
      let st;
      try {
        st = fs.statSync(p);
      } catch {
        continue;
      }
      if (st.mtimeMs >= sinceMs) acc.push(p);
    }
  }
}

function scanClaude(sinceMs) {
  const base = path.join(os.homedir(), ".claude", "projects");
  const files = [];
  walkJsonl(base, sinceMs, files);
  let tokens = 0; // "fresh": input + cache creation + output (bills near full)
  let cacheRead = 0; // cached re-reads: huge and near-free, kept out of headline
  let sessions = 0;
  for (const f of files) {
    let raw;
    try {
      raw = fs.readFileSync(f, "utf8");
    } catch {
      continue;
    }
    let touched = false;
    for (const line of raw.split("\n")) {
      if (!line.includes("\"usage\"")) continue;
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      const u = o.message && o.message.usage;
      if (!u) continue;
      tokens += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.output_tokens || 0);
      cacheRead += u.cache_read_input_tokens || 0;
      touched = true;
    }
    if (touched) sessions += 1;
  }
  return { provider: "claude", tokens, cacheRead, sessions };
}

function scanCodex(sinceMs) {
  const base = path.join(os.homedir(), ".codex", "sessions");
  const files = [];
  walkJsonl(base, sinceMs, files);
  let tokens = 0;
  let sessions = 0;
  for (const f of files) {
    let raw;
    try {
      raw = fs.readFileSync(f, "utf8");
    } catch {
      continue;
    }
    // Codex logs cumulative usage per turn -> the session total is the max seen.
    let maxTotal = 0;
    for (const line of raw.split("\n")) {
      if (!line.includes("total_tokens")) continue;
      const m = /"total_tokens"\s*:\s*(\d+)/.exec(line);
      if (m) maxTotal = Math.max(maxTotal, Number(m[1]));
    }
    if (maxTotal > 0) {
      tokens += maxTotal;
      sessions += 1;
    }
  }
  return { provider: "codex", tokens, sessions };
}

function fmtTokens(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

module.exports = function quota(options) {
  const days = Number.parseInt(options.days, 10) > 0 ? Number.parseInt(options.days, 10) : 1;
  const sinceMs = options.since
    ? new Date(options.since).getTime()
    : Date.now() - days * 24 * 60 * 60 * 1000;
  const rates = loadRates();
  const providerFilter = options.provider || null;

  let rows = [scanClaude(sinceMs), scanCodex(sinceMs)];
  if (providerFilter) rows = rows.filter((r) => r.provider === providerFilter);

  const showCost = Boolean(options.cost); // opt-in: com cache, $ e enganoso
  const windowLabel = options.since ? `desde ${options.since}` : `ultimos ${days}d`;
  console.log(`combo-maestro quota — uso por provider (${windowLabel})`);
  console.log("tokens 'frescos' (input+cache-creation+output) dos logs locais; cache-read e re-leitura cacheada (quase de graca), fora do headline.");
  if (showCost) console.log("$ = referencia de preco de LISTA sobre os frescos, NAO sua fatura (assinatura nao cobra por token).");
  console.log("");

  let totalTokens = 0;
  let totalCache = 0;
  let totalCost = 0;
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`  ${pad("provider", 10)}${pad("sessoes", 9)}${pad("tokens", 10)}${pad("cache-read", 12)}${showCost ? "~$ ref" : ""}`);
  for (const r of rows) {
    totalTokens += r.tokens;
    totalCache += r.cacheRead || 0;
    const cost = (r.tokens / 1e6) * (rates[r.provider] || 0);
    totalCost += cost;
    const costStr = showCost ? `$${cost.toFixed(2)}` : "";
    const cacheStr = r.cacheRead != null ? fmtTokens(r.cacheRead) : "-";
    console.log(`  ${pad(r.provider, 10)}${pad(r.sessions, 9)}${pad(fmtTokens(r.tokens), 10)}${pad(cacheStr, 12)}${costStr}`);
  }
  console.log(`  ${pad("-".repeat(8), 10)}`);
  console.log(`  ${pad("TOTAL", 10)}${pad("", 9)}${pad(fmtTokens(totalTokens), 10)}${pad(fmtTokens(totalCache), 12)}${showCost ? `$${totalCost.toFixed(2)}` : ""}`);

  console.log(
    "\nWindow real de rate-limit: Claude no `combo-maestro statusline` (5h/7d);" +
    " outros providers, no app do AionUI. Gemini/Grok ainda nao logam token em arquivo lido aqui." +
    (showCost ? "" : " (Use --cost pra estimativa rustica de $ de lista.)")
  );
};

// Exposed for tests.
module.exports.scanClaude = scanClaude;
module.exports.scanCodex = scanCodex;
module.exports.fmtTokens = fmtTokens;
module.exports.DEFAULT_RATES = DEFAULT_RATES;
