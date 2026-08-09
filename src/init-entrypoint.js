"use strict";

// init-entrypoint: prepara um projeto para que QUALQUER cold start (Codex,
// Claude, OpenCode/deepseek) entre lendo o contrato compacto, sem o usuário
// lembrar de comando nenhum por sessão.
//
// A hierarquia `DEV/` em si é do núcleo: desde o Orquestrador 0.1.18 existe um
// gate estrito (`check-dev-gates --strict`) que exige headings canônicos. Manter
// skeletons próprios aqui duplicava esse schema e produzia projetos que FALHAVAM
// o gate. Então delegamos a criação ao `init-dev` do núcleo e acrescentamos só o
// que é nosso: o ponteiro ENTRYPOINT no topo do `AGENTS.md`.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { EP_BEGIN, EP_END } = require("./entrypoint.js");
const { shellCommandLine } = require("./lib.js");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function pointerBlock() {
  return (
    `${EP_BEGIN}\n` +
    "# ENTRYPOINT (lido no cold start)\n\n" +
    "NÃO leia o README inteiro. NÃO pergunte se deve ler: leia e aja.\n\n" +
    "Ordem de leitura: `DEV/INDEX.md` -> `DEV/HANDOFF.md` -> `DEV/CONTEXT.md` -> `DEV/SPECS/ACTIVE.md`.\n" +
    "Se houver `~/.orquestrador/PERSISTENCE.md`, ele manda nessa ordem.\n\n" +
    "Travas de custo: read-once por sessão, job longo = dispara-e-sai (sem poll), batch.\n" +
    "EXCEÇÃO: ação destrutiva ou irreversível ainda exige confirmação.\n" +
    `${EP_END}`
  );
}

function esc(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function injectPointerTop(file, dryRun) {
  const block = pointerBlock();
  if (!fs.existsSync(file)) {
    if (!dryRun) {
      ensureDir(path.dirname(file));
      fs.writeFileSync(file, block + "\n", "utf8");
    }
    return "criado-com-ponteiro";
  }

  const original = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const re = new RegExp(`${esc(EP_BEGIN)}[\\s\\S]*?${esc(EP_END)}\\n*`, "g");
  let next;
  let action;

  if (re.test(original)) {
    next = original.replace(re, block + "\n");
    action = "ponteiro-atualizado";
  } else {
    next = block + "\n\n" + original.replace(/^\s+/, "");
    action = "ponteiro-adicionado";
  }

  if (!dryRun) fs.writeFileSync(file, next, "utf8");
  return action;
}

// O núcleo cria a hierarquia. Sempre passamos caminho ABSOLUTO: no 0.1.19 o
// `--project-path` relativo resolve contra o diretorio de instalacao da CLI.
function runCoreInitDev(root, dryRun) {
  if (dryRun) {
    return fs.existsSync(path.join(root, "DEV"))
      ? "ja-existe (init-dev nao rodaria)"
      : "init-dev do nucleo criaria";
  }

  // npm installs the core CLI as a .cmd shim on Windows, which Node will not
  // spawn without a shell; so we hand the shell one already-quoted line.
  const res = spawnSync(
    shellCommandLine("orquestrador-maestro", ["init-dev", "--project-path", root]),
    { encoding: "utf8", shell: true }
  );

  if (res.error || res.status !== 0) {
    const detail = (res.stderr || res.error?.message || "").trim().split("\n")[0];
    throw new Error(
      `Falhou ao rodar 'orquestrador-maestro init-dev'${detail ? `: ${detail}` : "."}\n` +
      "O nucleo cria a hierarquia DEV/. Instale-o primeiro:\n" +
      "  npm install -g @iapro/orquestrador-maestro-cli && orquestrador-maestro install"
    );
  }

  return "delegado ao init-dev do nucleo";
}

module.exports = function initEntrypoint(options) {
  const root = path.resolve(options.projectPath || ".");
  const dryRun = !!options.dryRun;

  if (!fs.existsSync(root)) {
    throw new Error(`Projeto nao existe: ${root}`);
  }

  console.log(`combo-maestro init-entrypoint${dryRun ? " (dry-run)" : ""}`);
  console.log(`Projeto: ${root}\n`);

  const results = [
    ["DEV/ (hierarquia canonica)", runCoreInitDev(root, dryRun)],
    ["AGENTS.md (ponteiro topo)", dryRun ? "injetaria/atualizaria" : injectPointerTop(root && path.join(root, "AGENTS.md"), dryRun)]
  ];

  for (const [name, action] of results) {
    console.log(`  ${String(action).padEnd(32)} ${name}`);
  }

  console.log(
    "\nA hierarquia DEV/ vem do nucleo, entao passa no 'check-dev-gates --strict'.\n" +
    "O combo so acrescenta o ponteiro entre marcadores ENTRYPOINT; o corpo do\n" +
    "AGENTS.md nao foi tocado."
  );
};
