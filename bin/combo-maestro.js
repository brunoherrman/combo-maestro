#!/usr/bin/env node
"use strict";

const install = require("../src/install.js");
const uninstall = require("../src/uninstall.js");
const verify = require("../src/verify.js");
const budgetRetired = require("../src/budget-retired.js");
const staleCheck = require("../src/stale-check.js");
const curate = require("../src/curate.js");
const delegate = require("../src/delegate.js");
const setupBracal = require("../src/setup-bracal.js");
const initEntrypoint = require("../src/init-entrypoint.js");
const { showLog } = require("../src/audit.js");

const VERSION = require("../package.json").version;

function printHelp() {
  console.log(`combo-maestro ${VERSION} - complemento do Orquestrador Maestro

Cobre apenas o que o nucleo (0.1.19) ainda nao faz:
  - delegacao de bracal cheap-tier (regra injetada)
  - curadoria de worklog human-in-the-loop (mostra o cru, voce aprova)
  - stale-process gate (fingerprint fonte vs processo rodando)
  - travas de custo por turno (read-once, batch, anti-poll em job longo)

Aposentado (o nucleo absorveu):
  - budget -> orquestrador-maestro context brief

Uso:
  combo-maestro install   [--home-path PATH] [--dry-run]
  combo-maestro uninstall [--home-path PATH]
  combo-maestro verify    [--home-path PATH]
  combo-maestro stale-check [--project-path PATH] [--watch DIR] [--update]
  combo-maestro curate    [--project-path PATH] [--keep N]
  combo-maestro setup-bracal [--cli codex] [--model gpt-5.4-mini]
  combo-maestro delegate  "<tarefa>" [--cli codex|claude|mimo|gemini|grok] [--model MODEL] [--allow-api] [--no-context]
  combo-maestro init-entrypoint [--project-path PATH] [--dry-run]
  combo-maestro log       [--lines N]
  combo-maestro version

Delegacao de bracal (ASSINATURA, nunca API):
  MODO A (in-session, preferido): o agente delega ao proprio subagent tier-barato.
    claude -> Task tool com subagent Haiku (assinatura)   [nao ha shell-out; regra em rules.md]
    gemini -> tier Flash na propria sessao
    grok   -> tier grok-code-fast-1 na propria sessao Grok (xAI e metrado por API;
              fica in-session pra nao abrir 2o processo cobrado)
  MODO B (shell-out por assinatura):
    codex  -> codex exec -m gpt-5.4-mini   (login Codex = assinatura)
  delegate --cli claude|gemini|grok se recusa (seria API) -> usa MODO A.
  delegate --cli mimo: mimo so tem API; bloqueado por padrao,
    libera so com --allow-api (opt-in consciente, sem gasto surpresa).
  delegate injeta o entrypoint COMPACTO (DEV/INDEX+SPECS/ACTIVE+HANDOFF) no cold
    sub do MODO B, pra ele nao abrir cego. Sem DEV/ -> nada muda. --no-context desliga.
    Nunca injeta no modo API (mimo).

Cold start auto-suficiente (sem lembrar comando por sessao):
  init-entrypoint prepara o projeto. A hierarquia DEV/ vem do nucleo (delega a
    'orquestrador-maestro init-dev'), entao passa no 'check-dev-gates --strict'.
    O combo so acrescenta o ponteiro no topo do AGENTS.md (entre marcadores),
    SEM mover o corpo. Cold start de Codex/Claude/OpenCode passa a ler o
    contrato compacto.

Notas:
  - install e aditivo e idempotente. So escreve entre marcadores
    <!-- COMBO-MAESTRO:BEGIN --> ... <!-- COMBO-MAESTRO:END -->.
    Nunca toca no resto dos arquivos do Orquestrador.
  - curate NUNCA decide sozinho: propoe baldes, mostra o texto literal,
    e so aplica o que voce aprovar.
`);
}

function parseArgs(argv, allowed) {
  const options = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    let arg = argv[i];
    if (!arg.startsWith("--")) {
      options._.push(arg);
      continue;
    }
    let inlineValue;
    if (arg.includes("=")) {
      const idx = arg.indexOf("=");
      inlineValue = arg.slice(idx + 1);
      arg = arg.slice(0, idx);
    }
    const def = allowed[arg];
    if (!def) {
      throw new Error(`Parametro desconhecido: ${arg}`);
    }
    if (def.value) {
      const value = inlineValue !== undefined ? inlineValue : argv[++i];
      if (value === undefined) {
        throw new Error(`Parametro ${arg} precisa de um valor.`);
      }
      options[def.key] = value;
    } else {
      options[def.key] = true;
    }
  }
  return options;
}

const COMMON = {
  "--home-path": { key: "homePath", value: true },
  "--project-path": { key: "projectPath", value: true },
  "--watch": { key: "watch", value: true },
  "--keep": { key: "keep", value: true },
  "--max-entries": { key: "maxEntries", value: true },
  "--update": { key: "update", value: false },
  "--apply": { key: "apply", value: false },
  "--dry-run": { key: "dryRun", value: false },
  "--strict": { key: "strict", value: false },
  "--cli": { key: "cli", value: true },
  "--model": { key: "model", value: true },
  "--task": { key: "task", value: true },
  "--allow-api": { key: "allowApi", value: false },
  "--no-context": { key: "noContext", value: false },
  "--lines": { key: "lines", value: true }
};

function main() {
  const [command = "--help", ...rest] = process.argv.slice(2);

  if (command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }
  if (command === "version" || command === "--version" || command === "-v") {
    console.log(VERSION);
    return;
  }

  const options = parseArgs(rest, COMMON);

  switch (command) {
    case "install":
      install(options);
      return;
    case "uninstall":
      uninstall(options);
      return;
    case "verify":
      verify(options);
      return;
    case "budget":
      budgetRetired(options);
      return;
    case "stale-check":
      staleCheck(options);
      return;
    case "curate":
      curate(options);
      return;
    case "setup-bracal":
      setupBracal(options);
      return;
    case "init-entrypoint":
      initEntrypoint(options);
      return;
    case "delegate":
      if (!options.task && options._.length > 0) {
        options.task = options._[0];
      }
      delegate(options);
      return;
    case "log":
      showLog(options);
      return;
    default:
      throw new Error(`Comando desconhecido: ${command}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
