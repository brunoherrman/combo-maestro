"use strict";

// combo-maestro memory bridge.
//
// Core 0.2.0 shipped a native per-repository memory subsystem
// (`orquestrador-maestro memory record|search|show|timeline|promote|...`), so
// the combo's own store/index/recall retired — duplicating it would be a second
// source of truth. What the core memory does NOT do is cross-session synthesis
// from Claude Code transcripts. So the combo keeps only that: `memory harvest`
// reads the last N session transcripts, extracts user turns carrying durable
// knowledge, and FEEDS them into the core's memory via `memory record`. Combo
// adds, never competes.
//
// Guarantees kept from the old layer: read-only over transcripts, propose-only
// (nothing recorded without --apply/--pick), and redaction of home/username and
// token-shaped strings before a candidate is even shown.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { shellCommandLine } = require("./lib.js");

// Core observation types (validated by `orquestrador-maestro memory record`).
const CORE_TYPES = ["decision", "discovery", "implementation", "risk"];

const HARVEST_SIGNALS = [
  /\bna verdade\b/i, /\berrado\b/i, /\bnao (e|eh|é)\b/i, /\bcorrig/i, /\blembr/i,
  /\bsempre\b/i, /\bnunca\b/i, /\bprefiro\b/i, /\bnao quero\b/i, /\bcuidado\b/i,
  /\bactually\b/i, /\bwrong\b/i, /\bremember\b/i, /\balways\b/i, /\bnever\b/i,
  /\bvamos (de|fazer|usar)\b/i, /\bdecid/i, /\bescolh/i, /\boptar|opcao|opção\b/i,
  /\baposent/i, /\bvou usar\b/i,
  /\bfunciona\b/i, /\bresolv/i, /\bfix\b/i, /\bpassou\b/i, /\bverde\b/i,
  /\brisco\b/i, /\bcuidado\b/i, /\bperigo\b/i
];

// Map a turn to one of the core's valid observation types.
function classifyHarvest(text) {
  if (/\brisco|perigo|cuidado\b/i.test(text)) return "risk";
  if (/\bdecid|escolh|vamos (de|fazer|usar)|aposent|opcao|opção|vou usar/i.test(text)) return "decision";
  if (/\bfix|resolv|funciona|passou|verde|implement/i.test(text)) return "implementation";
  return "discovery"; // corrections, preferences, learned facts
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Transcripts carry everything. Mask obvious leaks before a snippet is proposed
// or recorded: home/username in a path, and token-shaped strings.
function redactSnippet(text) {
  let out = String(text);
  const home = os.homedir();
  if (home) out = out.split(home).join("~");
  out = out
    .replace(/[A-Za-z]:\\Users\\[^\\/\s]+/gi, "~")
    .replace(/\/(?:home|Users)\/[^/\s]+/g, "~")
    .replace(/\b(sk-|xai-|ghp_|gho_|AKIA)[A-Za-z0-9_-]{10,}/g, "[REDACTED]")
    .replace(/\b[0-9a-f]{32,}\b/gi, "[REDACTED]");
  return out;
}

function transcriptDir(projectPath) {
  const slug = path.resolve(projectPath).replace(/[\\/:\s]/g, "-");
  return path.join(os.homedir(), ".claude", "projects", slug);
}

function userTurnsFromTranscript(file) {
  const turns = [];
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return turns;
  }
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue; // unknown/partial line -> skip, never throw
    }
    if (o.type !== "user" || !o.message) continue;
    const c = o.message.content;
    let text = typeof c === "string"
      ? c
      : Array.isArray(c)
        ? c.filter((x) => x && x.type === "text").map((x) => x.text).join(" ")
        : "";
    text = String(text).trim();
    // Drop harness-injected content (<...>), slash commands, and short acks.
    if (!text || text.startsWith("<") || text.startsWith("/")) continue;
    if (text.split(/\s+/).length < 4) continue;
    turns.push(text);
  }
  return turns;
}

// --- Codex source (cross-agent harvest) --------------------------------------

function collectJsonl(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collectJsonl(p, out);
    else if (e.name.endsWith(".jsonl")) out.push(p);
  }
}

// Recent Codex session files, newest first. Codex stores all sessions globally
// under ~/.codex/sessions/YYYY/MM/DD/ regardless of project, so the per-project
// filter happens in codexUserTurns via each session's recorded cwd.
function codexSessionFiles(last) {
  const dir = path.join(os.homedir(), ".codex", "sessions");
  const all = [];
  collectJsonl(dir, all);
  return all
    .map((f) => {
      try {
        return { f, mtime: fs.statSync(f).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, Math.max(last * 4, last))
    .map((x) => x.f);
}

// Codex line shape: { timestamp, ordinal, type, payload }. A user turn is a
// payload with role "user" whose content is [{ type:"input_text", text }].
// Returns [] when the session's cwd is not this project (no cross-project leak).
function codexUserTurns(file, projectRoot) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  let cwd = null;
  const turns = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const p = o.payload || o;
    if (p.cwd) cwd = p.cwd;
    if (p.role !== "user") continue;
    const content = p.content;
    let text = Array.isArray(content)
      ? content.filter((x) => x && (x.type === "input_text" || x.type === "text")).map((x) => x.text).join(" ")
      : typeof content === "string"
        ? content
        : "";
    text = String(text).trim();
    if (!text || text.startsWith("<") || text.startsWith("/") || text.startsWith("#")) continue;
    if (/AGENTS\.md instructions/i.test(text)) continue;
    if (text.split(/\s+/).length < 4) continue;
    turns.push(text);
  }
  if (projectRoot && cwd && path.resolve(cwd) !== path.resolve(projectRoot)) return [];
  return turns;
}

function recentJsonl(dir, last) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(dir, f))
    .map((f) => ({ f, mtime: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, last)
    .map((x) => x.f);
}

// Record one observation into the core memory. Returns true on success.
function recordToCore(projectRoot, type, summary) {
  const args = ["memory", "record", "--project", projectRoot, "--type", type, "--summary", summary];
  const line = shellCommandLine("orquestrador-maestro", args);
  const res = spawnSync(line, { shell: true, encoding: "utf8" });
  return res.status === 0;
}

function cmdHarvest(options) {
  const projectRoot = path.resolve(options.projectPath || process.cwd());
  const last = Number.parseInt(options.last, 10) > 0 ? Number.parseInt(options.last, 10) : 5;
  const agent = options.agent || "all"; // claude | codex | all

  // Build the list of (agent, files, turns-extractor) sources.
  const sources = [];
  const wantClaude = agent === "all" || agent === "claude";
  const wantCodex = agent === "all" || agent === "codex";

  if (options.transcripts) {
    // Explicit dir override -> treat as a Claude-style transcript folder.
    const tdir = path.resolve(options.transcripts);
    if (!fs.existsSync(tdir)) {
      console.error(`harvest: diretorio de transcript nao encontrado: ${tdir}`);
      process.exit(2);
    }
    sources.push({ agent: "claude", files: recentJsonl(tdir, last), turns: (f) => userTurnsFromTranscript(f) });
  } else {
    if (wantClaude) {
      const tdir = transcriptDir(projectRoot);
      if (fs.existsSync(tdir)) {
        sources.push({ agent: "claude", files: recentJsonl(tdir, last), turns: (f) => userTurnsFromTranscript(f) });
      }
    }
    if (wantCodex) {
      sources.push({ agent: "codex", files: codexSessionFiles(last), turns: (f) => codexUserTurns(f, projectRoot) });
    }
  }

  const totalFiles = sources.reduce((n, s) => n + s.files.length, 0);
  if (totalFiles === 0) {
    console.log(`harvest: nenhuma sessao encontrada (agente=${agent}, projeto=${projectRoot}).`);
    return;
  }

  const seen = new Set();
  const candidates = [];
  const perAgent = {};
  for (const src of sources) {
    for (const file of src.files) {
      for (const text of src.turns(file)) {
        const hits = HARVEST_SIGNALS.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
        if (hits === 0) continue;
        const norm = text.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
        if (seen.has(norm)) continue;
        seen.add(norm);
        const snippet = redactSnippet(text.replace(/\s+/g, " ")).slice(0, 200);
        candidates.push({ agent: src.agent, type: classifyHarvest(text), hits, summary: snippet });
        perAgent[src.agent] = (perAgent[src.agent] || 0) + 1;
      }
    }
  }
  candidates.sort((a, b) => b.hits - a.hits);

  const perAgentStr = Object.entries(perAgent).map(([a, n]) => `${a}:${n}`).join(", ") || "nenhum";
  console.log("memory harvest — bridge para o memory nativo do core (human-in-the-loop)");
  console.log(`Project: ${projectRoot}`);
  console.log(`Fontes: ${totalFiles} sessao(oes) [${sources.map((s) => s.agent).join("+")}]`);
  console.log(`Candidatas com sinal: ${candidates.length} (${perAgentStr})\n`);
  if (candidates.length === 0) {
    console.log("Nada com sinal durable nas sessoes lidas.");
    return;
  }

  const pick = options.pick
    ? new Set(String(options.pick).split(",").map((s) => Number.parseInt(s.trim(), 10)))
    : null;
  candidates.forEach((c, i) => {
    const n = i + 1;
    const on = !pick || pick.has(n);
    console.log(`  ${on ? "[x]" : "[ ]"} #${n} [${c.agent}/${c.type}] (sinais=${c.hits})`);
    console.log(`      "${c.summary}"`);
  });

  const apply = Boolean(options.apply);
  if (!apply) {
    console.log(
      "\nNada gravado. Regra dura: sistema PROPOE, voce APROVA.\n" +
      "Lexical = ruidoso; revise o TEXTO LITERAL acima antes de gravar.\n" +
      "Gravar TODAS no memory do core:\n" +
      `  combo-maestro memory harvest --project-path "${projectRoot}" --apply\n` +
      "Ou um subconjunto pelos numeros (#):\n" +
      `  combo-maestro memory harvest --project-path "${projectRoot}" --pick 1,3 --apply`
    );
    return;
  }

  const selected = pick ? candidates.filter((_, i) => pick.has(i + 1)) : candidates;
  let ok = 0;
  let fail = 0;
  for (const c of selected) {
    // Keep provenance: which agent's transcript the observation came from.
    if (recordToCore(projectRoot, c.type, `[${c.agent}] ${c.summary}`)) ok += 1;
    else fail += 1;
  }
  console.log(`\nGravadas ${ok} observacoes no memory do core via 'memory record'.` + (fail ? ` ${fail} falharam.` : ""));
  console.log("Confira com: orquestrador-maestro memory search --project . --unverified");
}

module.exports = function memory(sub, options) {
  switch (sub) {
    case "harvest":
      cmdHarvest(options);
      return;
    case "index":
    case "push":
    case "recall":
    case "link":
    case "lint":
      // Retired in favor of the core's native memory (0.2.0).
      console.error(
        `memory ${sub} foi aposentado: o core 0.2.0 traz memory nativo.\n` +
        "Use: orquestrador-maestro memory record|search|show|timeline|promote|stats\n" +
        "O combo mantem so 'memory harvest' (colheita de transcripts -> memory record do core)."
      );
      process.exit(2);
      return;
    default:
      throw new Error(
        `subcomando memory desconhecido: ${sub || "(vazio)"}. Use: harvest ` +
        "(record/search/... sao do core: orquestrador-maestro memory ...)"
      );
  }
};

// Exposed for tests.
module.exports.redactSnippet = redactSnippet;
module.exports.classifyHarvest = classifyHarvest;
module.exports.codexUserTurns = codexUserTurns;
module.exports.transcriptDir = transcriptDir;
module.exports.CORE_TYPES = CORE_TYPES;
module.exports.todayISO = todayISO;
