"use strict";

// combo-maestro memory layer.
// Replicates the low-cost parts of ai-memory (akitaonrails) in pure Node:
// OKF-like pages on disk, full-text search (BM25), typed edges and temporal
// (as_of) filtering. No external dependency, no daemon, no billed API.
//
// Design invariants (see DEV/SPECS/ACTIVE.md):
// - DEV/ stays the source of truth; this store is derived. No write-back to DEV/.
// - The INDEX.json lives on disk and is read by THIS CLI, never emitted into the
//   model context. Only bounded recall output (top-N + char cap) reaches a model,
//   so a global store never inflates session tokens.
// - Recall is namespaced by project to avoid leaking one client's context into
//   another session.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { readUtf8, estimateTokens } = require("./lib.js");

const INDEX_NAME = "INDEX.json";
const EDGE_TYPES = ["causes", "fixes", "contradicts"];
const PAGE_TYPES = ["fact", "fix", "decision", "reference"];

// Small PT+EN stopword set. Deterministic, keeps the index lean.
const STOPWORDS = new Set([
  "a", "o", "e", "de", "da", "do", "das", "dos", "que", "com", "para", "por",
  "no", "na", "nos", "nas", "um", "uma", "os", "as", "se", "em", "ao", "aos",
  "the", "and", "of", "to", "in", "on", "for", "is", "are", "was", "were", "it",
  "this", "that", "with", "as", "at", "by", "an", "be", "or", "from"
]);

function memoryDir(orquestrador) {
  return path.join(orquestrador, "memory");
}

function resolveOrquestrador(options) {
  const home = path.resolve(options.homePath || os.homedir());
  return path.join(home, ".orquestrador");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "page";
}

// --- tokenizer ---------------------------------------------------------------

function tokenize(text) {
  const out = [];
  for (const raw of String(text).toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 2) continue;
    const term = raw.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (STOPWORDS.has(term)) continue;
    out.push(term);
  }
  return out;
}

// --- frontmatter -------------------------------------------------------------

function parseFrontmatter(content) {
  const text = content.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) {
    return { meta: {}, body: text.trim() };
  }
  const end = text.indexOf("\n---", 4);
  if (end === -1) {
    return { meta: {}, body: text.trim() };
  }
  const head = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\n+/, "").trim();
  const meta = {};
  for (const line of head.split("\n")) {
    const m = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    meta[key] = value;
  }
  return { meta, body };
}

function serializePage(meta, body) {
  const links = Array.isArray(meta.links) ? meta.links : [];
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  const head = [
    "---",
    `id: ${meta.id}`,
    `type: ${meta.type || "fact"}`,
    `project: ${meta.project || "global"}`,
    `created: ${meta.created || todayISO()}`,
    `links: [${links.join(", ")}]`,
    `tags: [${tags.join(", ")}]`,
    "---",
    ""
  ].join("\n");
  return `${head}\n${String(body).trim()}\n`;
}

// --- store I/O ---------------------------------------------------------------

function listPages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(dir, f));
}

function loadPage(file) {
  const { meta, body } = parseFrontmatter(readUtf8(file));
  const id = meta.id || path.basename(file, ".md");
  return {
    id,
    file,
    type: meta.type || "fact",
    project: meta.project || "global",
    created: meta.created || "",
    links: Array.isArray(meta.links) ? meta.links : [],
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    body
  };
}

// --- index (BM25) ------------------------------------------------------------

function buildIndex(dir) {
  const pages = listPages(dir).map(loadPage);
  const df = Object.create(null);
  const docs = [];
  for (const p of pages) {
    const terms = tokenize(`${p.body} ${p.tags.join(" ")}`);
    const tf = Object.create(null);
    for (const t of terms) tf[t] = (tf[t] || 0) + 1;
    for (const t of Object.keys(tf)) df[t] = (df[t] || 0) + 1;
    docs.push({
      id: p.id,
      file: path.basename(p.file),
      type: p.type,
      project: p.project,
      created: p.created,
      links: p.links,
      tags: p.tags,
      len: terms.length,
      tf
    });
  }
  const totalLen = docs.reduce((s, d) => s + d.len, 0);
  return {
    version: 1,
    built: new Date().toISOString(),
    N: docs.length,
    avgdl: docs.length ? totalLen / docs.length : 0,
    df,
    docs
  };
}

function writeIndex(dir, index) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, INDEX_NAME), JSON.stringify(index, null, 2), "utf8");
}

function readIndex(dir) {
  const file = path.join(dir, INDEX_NAME);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(readUtf8(file));
  } catch {
    return null;
  }
}

function bm25Score(queryTerms, doc, index, k1 = 1.5, b = 0.75) {
  let score = 0;
  for (const t of queryTerms) {
    const f = doc.tf[t];
    if (!f) continue;
    const n = index.df[t] || 0;
    const idf = Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
    const denom = f + k1 * (1 - b + (b * doc.len) / (index.avgdl || 1));
    score += idf * ((f * (k1 + 1)) / denom);
  }
  return score;
}

// --- commands ----------------------------------------------------------------

function cmdIndex(dir) {
  const index = buildIndex(dir);
  writeIndex(dir, index);
  console.log(`memory index: ${index.N} paginas em ${dir}`);
  console.log(`INDEX.json escrito (${Object.keys(index.df).length} termos).`);
}

function pickSnippet(body, queryTerms) {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  let best = lines[0];
  let bestHits = -1;
  const qset = new Set(queryTerms);
  for (const line of lines) {
    const hits = tokenize(line).filter((t) => qset.has(t)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = line;
    }
  }
  return best.length > 240 ? `${best.slice(0, 237)}...` : best;
}

function cmdRecall(dir, options) {
  const query = options.query || options._[0] || "";
  if (!query.trim()) {
    throw new Error('memory recall precisa de uma query: memory recall "<termos>"');
  }
  const index = readIndex(dir);
  if (!index || index.N === 0) {
    // Graceful degradation: no store -> empty, session continues.
    console.log("memory recall: store vazio ou sem indice. Nada a recuperar.");
    return;
  }
  const top = Number.parseInt(options.top, 10) > 0 ? Number.parseInt(options.top, 10) : 5;
  const maxChars = Number.parseInt(options.maxChars, 10) > 0 ? Number.parseInt(options.maxChars, 10) : 1200;
  const asOf = options.asOf || null;
  const projectFilter = options.project || null;
  const typeFilter = options.type || null;
  const queryTerms = tokenize(query);

  let candidates = index.docs.filter((d) => {
    if (projectFilter && d.project !== projectFilter) return false;
    if (typeFilter && d.type !== typeFilter) return false;
    if (asOf && d.created && d.created > asOf) return false;
    return true;
  });

  const ranked = candidates
    .map((d) => ({ doc: d, score: bm25Score(queryTerms, d, index) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, top);

  if (ranked.length === 0) {
    console.log(`memory recall: nada casou "${query}"` + (projectFilter ? ` (project=${projectFilter})` : ""));
    return;
  }

  const header = `memory recall "${query}" — top ${ranked.length} (cap ${maxChars} chars)\n`;
  let out = "";
  for (const r of ranked) {
    const page = loadPage(path.join(dir, r.doc.file));
    const snippet = pickSnippet(page.body, queryTerms);
    const block =
      `- [${r.doc.type}] ${r.doc.id} (${r.doc.project}, ${r.doc.created || "s/data"}, score ${r.score.toFixed(2)})\n` +
      `  ${snippet}\n`;
    if (out.length + block.length > maxChars && out.length > 0) break;
    out += block;
  }
  process.stdout.write(header + out);
}

function cmdLink(dir, options) {
  const [idA, rel, idB] = options._;
  if (!idA || !rel || !idB) {
    throw new Error("memory link <id-a> <causes|fixes|contradicts> <id-b>");
  }
  if (!EDGE_TYPES.includes(rel)) {
    throw new Error(`edge invalido: ${rel}. Use um de: ${EDGE_TYPES.join(", ")}`);
  }
  const fileA = path.join(dir, `${idA}.md`);
  const fileB = path.join(dir, `${idB}.md`);
  if (!fs.existsSync(fileA)) throw new Error(`pagina nao existe: ${idA}`);
  if (!fs.existsSync(fileB)) throw new Error(`pagina alvo nao existe: ${idB}`);

  const page = loadPage(fileA);
  const edge = `${rel}:${idB}`;
  if (page.links.includes(edge)) {
    console.log(`edge ja existe: ${idA} ${edge}`);
    return;
  }
  page.links.push(edge);
  fs.writeFileSync(
    fileA,
    serializePage(
      { id: page.id, type: page.type, project: page.project, created: page.created, links: page.links, tags: page.tags },
      page.body
    ),
    "utf8"
  );
  writeIndex(dir, buildIndex(dir));
  console.log(`edge gravado: ${idA} ${edge}. Indice atualizado.`);
}

// push: derive candidate pages from the WORKLOG "gray" bucket (old but
// substantive) + VERIFY, reusing curate's classifier. Human-in-the-loop:
// default only proposes; --apply writes; --pick writes a subset.
function inferType(raw) {
  if (/(^|\n)-\s*Security\s*:/i.test(raw) || /\bfix\b|corrig|corre[cç]/i.test(raw)) return "fix";
  if (/decis|decid|aposent|escolh/i.test(raw)) return "decision";
  return "fact";
}

function cmdPush(dir, options) {
  const curate = require("./curate.js");
  const projectRoot = path.resolve(options.projectPath || process.cwd());
  const worklogPath = path.join(projectRoot, "DEV", "WORKLOG.md");
  if (!fs.existsSync(worklogPath)) {
    throw new Error(`WORKLOG nao encontrado: ${worklogPath}`);
  }
  // Reuse curate's internals via its exported parser/classifier.
  const { parseEntries, classify } = curate;
  const parsed = parseEntries(readUtf8(worklogPath));
  const keep = Number.parseInt(options.keep, 10) > 0 ? Number.parseInt(options.keep, 10) : 12;
  const classified = classify(parsed.entries, keep);
  const gray = classified.filter((e) => e.bucket === "gray");
  const project = options.project || path.basename(projectRoot);

  if (gray.length === 0) {
    console.log("memory push: nenhuma entrada CINZA no WORKLOG. Nada a propor.");
    return;
  }

  const candidates = gray.map((e) => {
    const title = e.header.replace(/^##\s*/, "").replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/, "");
    const dateMatch = /(\d{4}-\d{2}-\d{2})/.exec(e.header);
    const id = slugify(title);
    return {
      id,
      type: inferType(e.raw),
      project,
      created: dateMatch ? dateMatch[1] : todayISO(),
      tags: [],
      links: [],
      body: e.raw.replace(/^##\s*/, "").trim()
    };
  });

  const pick = options.pick ? new Set(String(options.pick).split(",").map((s) => s.trim())) : null;
  const selected = pick ? candidates.filter((c) => pick.has(c.id)) : candidates;
  const apply = Boolean(options.apply);

  console.log("memory push (human-in-the-loop)");
  console.log(`Project: ${project}`);
  console.log(`Candidatas (balde CINZA do WORKLOG): ${candidates.length}\n`);
  for (const c of candidates) {
    const on = !pick || pick.has(c.id);
    console.log(`  ${on ? "[x]" : "[ ]"} ${c.id}  (type=${c.type}, created=${c.created})`);
  }

  if (!apply) {
    console.log(
      "\nNada escrito. Regra dura: sistema PROPOE, voce APROVA.\n" +
      "Escrever TODAS as candidatas como paginas:\n" +
      `  combo-maestro memory push --project-path "${projectRoot}" --apply\n` +
      "Ou escolher um subconjunto por id:\n" +
      `  combo-maestro memory push --project-path "${projectRoot}" --pick id1,id2 --apply`
    );
    return;
  }

  fs.mkdirSync(dir, { recursive: true });
  let written = 0;
  for (const c of selected) {
    const file = path.join(dir, `${c.id}.md`);
    fs.writeFileSync(file, serializePage(c, c.body), "utf8");
    written += 1;
  }
  writeIndex(dir, buildIndex(dir));
  console.log(`\nEscritas ${written} paginas em ${dir}. Indice reconstruido.`);
  console.log(`(~${estimateTokens(selected.map((c) => c.body).join(""))}t de corpo total; recall e sempre bounded.)`);
}

// lint: whole-store integrity pass. Catches edges pointing at missing pages,
// invalid relation types, duplicate ids, and lists pending `contradicts` edges
// for human attention. Exit 1 on any error so it can gate.
function cmdLint(dir) {
  const files = listPages(dir);
  if (files.length === 0) {
    console.log("memory lint: store vazio. Nada a checar.");
    return;
  }
  const pages = files.map(loadPage);
  const idToFiles = new Map();
  for (const p of pages) {
    const list = idToFiles.get(p.id) || [];
    list.push(path.basename(p.file));
    idToFiles.set(p.id, list);
  }
  const ids = new Set(pages.map((p) => p.id));

  const errors = [];
  const warnings = [];

  for (const [id, fileList] of idToFiles) {
    if (fileList.length > 1) {
      errors.push(`id duplicado "${id}" em ${fileList.join(", ")}`);
    }
  }

  for (const p of pages) {
    for (const edge of p.links) {
      const idx = edge.indexOf(":");
      const rel = idx === -1 ? edge : edge.slice(0, idx);
      const target = idx === -1 ? "" : edge.slice(idx + 1);
      if (!EDGE_TYPES.includes(rel)) {
        errors.push(`${p.id}: edge invalido "${edge}" (use ${EDGE_TYPES.join("|")})`);
        continue;
      }
      if (!target || !ids.has(target)) {
        errors.push(`${p.id}: edge quebrado "${edge}" (alvo inexistente)`);
        continue;
      }
      if (rel === "contradicts") {
        warnings.push(`${p.id} contradicts ${target} (contradiction pendente - revise)`);
      }
    }
    if (!PAGE_TYPES.includes(p.type)) {
      warnings.push(`${p.id}: type "${p.type}" fora de ${PAGE_TYPES.join("|")}`);
    }
  }

  console.log(`memory lint: ${pages.length} paginas`);
  for (const e of errors) console.log(`  ERRO: ${e}`);
  for (const w of warnings) console.log(`  AVISO: ${w}`);
  console.log(`Resultado: ${errors.length} erros, ${warnings.length} avisos`);
  if (errors.length > 0) {
    process.exit(1);
  }
}

// harvest: cross-session synthesis (ai-memory parity, lexical). Reads the last N
// Claude Code session transcripts for a project, extracts user turns that carry
// durable-knowledge SIGNALS (corrections, decisions, confirmed fixes, repeats),
// and PROPOSES them as memory pages. Read-only over transcripts; never writes a
// page without --apply/--pick. Honest limits: lexical only (no model), so it is
// noisier and shallower than an embedding-based synthesis, and transcripts carry
// everything, so it emits only short snippets and stays human-in-the-loop.

const HARVEST_SIGNALS = [
  // correction / preference / durable rule
  /\bna verdade\b/i, /\berrado\b/i, /\bnao (e|eh|é)\b/i, /\bcorrig/i, /\blembr/i,
  /\bsempre\b/i, /\bnunca\b/i, /\bprefiro\b/i, /\bnao quero\b/i, /\bcuidado\b/i,
  /\bactually\b/i, /\bwrong\b/i, /\bremember\b/i, /\balways\b/i, /\bnever\b/i,
  // decision
  /\bvamos (de|fazer|usar)\b/i, /\bdecid/i, /\bescolh/i, /\boptar|opcao|opção\b/i,
  /\baposent/i, /\bvou usar\b/i,
  // confirmed fix
  /\bfunciona\b/i, /\bresolv/i, /\bfix\b/i, /\bpassou\b/i, /\bverde\b/i
];

// Transcripts carry everything. Before a harvested snippet is even proposed,
// mask the obvious leaks: the user's home/username in a path, and token-shaped
// strings. This is a safety net, not a substitute for the human review.
function redactSnippet(text) {
  let out = String(text);
  const home = os.homedir();
  if (home) out = out.split(home).join("~");
  out = out
    .replace(/[A-Za-z]:\\Users\\[^\\\/\s]+/gi, "~")
    .replace(/\/(?:home|Users)\/[^\/\s]+/g, "~")
    .replace(/\b(sk-|xai-|ghp_|gho_|AKIA)[A-Za-z0-9_-]{10,}/g, "[REDACTED]")
    .replace(/\b[0-9a-f]{32,}\b/gi, "[REDACTED]");
  return out;
}

function classifyHarvest(text) {
  if (/\bcorrig|na verdade|errado|prefiro|sempre|nunca|remember|lembr/i.test(text)) return "fact";
  if (/\bdecid|escolh|vamos (de|fazer|usar)|aposent|opcao|opção/i.test(text)) return "decision";
  if (/\bfix|resolv|funciona|passou|verde/i.test(text)) return "fix";
  return "fact";
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
    // Drop harness-injected content (system-reminder/hook/ci blocks), slash
    // commands, and short acks -> only real, substantive user input remains.
    if (!text || text.startsWith("<") || text.startsWith("/")) continue;
    if (text.split(/\s+/).length < 4) continue;
    turns.push(text);
  }
  return turns;
}

function cmdHarvest(dir, options) {
  const projectRoot = path.resolve(options.projectPath || process.cwd());
  const tdir = options.transcripts ? path.resolve(options.transcripts) : transcriptDir(projectRoot);
  const project = options.project || path.basename(projectRoot);
  const last = Number.parseInt(options.last, 10) > 0 ? Number.parseInt(options.last, 10) : 5;

  if (!fs.existsSync(tdir)) {
    console.error(
      `harvest: diretorio de transcript nao encontrado: ${tdir}\n` +
      "Passe --transcripts <dir> se o slug do projeto for diferente."
    );
    process.exit(2);
  }

  const files = fs
    .readdirSync(tdir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(tdir, f))
    .map((f) => ({ f, mtime: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, last)
    .map((x) => x.f);

  if (files.length === 0) {
    console.log(`harvest: nenhuma sessao .jsonl em ${tdir}`);
    return;
  }

  // Collect signal-bearing turns; dedup by normalized text across sessions
  // (repetition is itself a signal but we keep one candidate per unique turn).
  const seen = new Set();
  const existing = new Set(listPages(dir).map((f) => path.basename(f, ".md")));
  const candidates = [];
  for (const file of files) {
    for (const text of userTurnsFromTranscript(file)) {
      const hits = HARVEST_SIGNALS.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
      if (hits === 0) continue;
      const norm = text.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
      if (seen.has(norm)) continue;
      seen.add(norm);
      const clean = redactSnippet(text.replace(/\s+/g, " "));
      const snippet = clean.slice(0, 200);
      const id = slugify(clean.split(/\s+/).slice(0, 7).join(" "));
      if (existing.has(id)) continue; // already a page
      candidates.push({
        id,
        type: classifyHarvest(text),
        project,
        created: todayISO(),
        tags: [],
        links: [],
        hits,
        body: snippet
      });
    }
  }

  candidates.sort((a, b) => b.hits - a.hits);

  console.log("memory harvest (human-in-the-loop, lexical)");
  console.log(`Project: ${project}`);
  console.log(`Transcripts: ${files.length} sessao(oes) em ${tdir}`);
  console.log(`Candidatas com sinal: ${candidates.length}\n`);
  if (candidates.length === 0) {
    console.log("Nada com sinal durable nas sessoes lidas. (push manual segue disponivel.)");
    return;
  }

  const pick = options.pick ? new Set(String(options.pick).split(",").map((s) => s.trim())) : null;
  for (const c of candidates) {
    const on = !pick || pick.has(c.id);
    console.log(`  ${on ? "[x]" : "[ ]"} ${c.id}  (type=${c.type}, sinais=${c.hits})`);
    console.log(`      "${c.body}"`);
  }

  const apply = Boolean(options.apply);
  if (!apply) {
    console.log(
      "\nNada escrito. Regra dura: sistema PROPOE, voce APROVA.\n" +
      "Lexical = ruidoso; revise o TEXTO LITERAL acima antes de gravar.\n" +
      `  combo-maestro memory harvest --project-path "${projectRoot}" --apply\n` +
      `  combo-maestro memory harvest --project-path "${projectRoot}" --pick id1,id2 --apply`
    );
    return;
  }

  const selected = pick ? candidates.filter((c) => pick.has(c.id)) : candidates;
  fs.mkdirSync(dir, { recursive: true });
  let written = 0;
  for (const c of selected) {
    fs.writeFileSync(path.join(dir, `${c.id}.md`), serializePage(c, c.body), "utf8");
    written += 1;
  }
  writeIndex(dir, buildIndex(dir));
  console.log(`\nEscritas ${written} paginas em ${dir}. Indice reconstruido.`);
}

module.exports = function memory(sub, options) {
  const orquestrador = resolveOrquestrador(options);
  const dir = memoryDir(orquestrador);

  switch (sub) {
    case "index":
      cmdIndex(dir);
      return;
    case "recall":
      cmdRecall(dir, options);
      return;
    case "push":
      cmdPush(dir, options);
      return;
    case "link":
      cmdLink(dir, options);
      return;
    case "lint":
      cmdLint(dir);
      return;
    case "harvest":
      cmdHarvest(dir, options);
      return;
    default:
      throw new Error(
        `subcomando memory desconhecido: ${sub || "(vazio)"}. ` +
        "Use: index | push | recall | link | lint | harvest"
      );
  }
};

// Exposed for tests.
module.exports.tokenize = tokenize;
module.exports.parseFrontmatter = parseFrontmatter;
module.exports.serializePage = serializePage;
module.exports.buildIndex = buildIndex;
module.exports.bm25Score = bm25Score;
module.exports.slugify = slugify;
module.exports.memoryDir = memoryDir;
module.exports.redactSnippet = redactSnippet;
