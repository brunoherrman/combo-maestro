"use strict";

// Entrypoint helpers shared by `delegate` (inject context into a cold sub) and
// `init-entrypoint` (scaffold the compact entrypoint + redirect AGENTS.md).
//
// Princípio: o cold sub (codex exec / opencode run) abre frio e só vê o texto da
// tarefa. Sem isto ele NÃO lê o contrato do projeto. Injetamos o entrypoint
// COMPACTO (INDEX + SPECS/ACTIVE + HANDOFF), nunca o README inteiro, senão
// recria o problema de quota que estamos resolvendo.

const fs = require("node:fs");
const path = require("node:path");
const { estimateTokens } = require("./lib.js");

const EP_BEGIN = "<!-- COMBO-MAESTRO:ENTRYPOINT:BEGIN -->";
const EP_END = "<!-- COMBO-MAESTRO:ENTRYPOINT:END -->";

// Ordem canonica do nucleo (PERSISTENCE.md): INDEX -> HANDOFF -> CONTEXT -> SPECS/ACTIVE.
const ENTRY_FILES = [
  "DEV/INDEX.md",
  "DEV/HANDOFF.md",
  "DEV/CONTEXT.md",
  "DEV/SPECS/ACTIVE.md"
];

const DEFAULT_CAP_TOKENS = 1200;

function readIfExists(file) {
  try {
    return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  } catch {
    return null;
  }
}

function loadEntrypoint(projectPath, { capTokens = DEFAULT_CAP_TOKENS } = {}) {
  const root = path.resolve(projectPath || ".");
  const parts = [];
  let used = 0;

  for (const rel of ENTRY_FILES) {
    const body = readIfExists(path.join(root, rel));
    if (!body || !body.trim()) continue;

    let text = body.trim();
    const remaining = capTokens - used;
    if (remaining <= 0) break;
    if (estimateTokens(text) > remaining) {
      text = text.slice(0, remaining * 4).trimEnd() + "\n[...truncado pelo cap de contexto do combo-maestro...]";
    }
    used += estimateTokens(text);
    parts.push(`### ${rel}\n${text}`);
  }

  if (parts.length === 0) return "";

  return (
    "## CONTEXTO DO PROJETO (entrypoint compacto injetado pelo combo-maestro)\n" +
    "Leia isto antes da tarefa. NÃO peça para ler o README; o contrato relevante está abaixo.\n\n" +
    parts.join("\n\n")
  );
}

function withEntrypoint(task, preamble) {
  if (!preamble) return String(task);
  return `${preamble}\n\n## TAREFA\n${String(task)}`;
}

module.exports = {
  EP_BEGIN,
  EP_END,
  ENTRY_FILES,
  DEFAULT_CAP_TOKENS,
  loadEntrypoint,
  withEntrypoint
};
