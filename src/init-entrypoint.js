"use strict";

// init-entrypoint: prepara um projeto para que QUALQUER cold start (Codex,
// Claude, OpenCode/deepseek) entre lendo o contrato compacto, sem o usuário
// lembrar de comando nenhum por sessão.

const fs = require("node:fs");
const path = require("node:path");
const { EP_BEGIN, EP_END } = require("./entrypoint.js");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeIfMissing(file, content) {
  if (fs.existsSync(file)) return "ja-existe";
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, "utf8");
  return "criado";
}

function pointerBlock() {
  return (
    `${EP_BEGIN}\n` +
    "# ENTRYPOINT (lido no cold start)\n\n" +
    "NÃO leia o README inteiro. NÃO pergunte se deve ler: leia e aja.\n\n" +
    "1. `DEV/SPECS/ACTIVE.md` — escopo + critérios de aceitação (gate)\n" +
    "2. `DEV/HANDOFF.md` — estado atual + próximo passo\n" +
    "3. `DEV/INDEX.md` — mapa; puxe referência (AGENTS corpo / README) só sob demanda\n\n" +
    "Travas de custo: read-once por sessão, job longo = dispara-e-sai (sem poll), batch.\n" +
    "EXCEÇÃO: ação destrutiva ou irreversível ainda exige confirmação.\n" +
    `${EP_END}`
  );
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

function esc(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const INDEX_SKELETON =
  "# DEV Index\n\n" +
  "Mapa dos docs de controle. Leia os compactos primeiro; carregue o resto sob demanda.\n\n" +
  "## Ordem de leitura\n\n" +
  "1. `SPECS/ACTIVE.md` — escopo + gate **[ler 1x]**\n" +
  "2. `HANDOFF.md` — estado / próximo passo\n" +
  "3. `VERIFY.md` — última verificação\n\n" +
  "## Referência (sob demanda)\n\n" +
  "- `../AGENTS.md` (corpo técnico) · `../README.md` · `WORKLOG.md`\n\n" +
  "## Regra de custo\n\n" +
  "READ-ONCE por sessão · ANTI-POLL em job longo · BATCH de itens.\n";

const ACTIVE_SKELETON =
  "# SPEC ATIVA\n\n" +
  "Status: rascunho\n\n" +
  "> Arquivo de controle compacto. Leia ESTE 1x por sessão.\n\n" +
  "## Objetivo\n\n(descreva o objetivo atual)\n\n" +
  "## Escopo\n\n- entrada:\n- saída:\n\n" +
  "## Critérios de aceitação (gate)\n\n- [ ] (defina o que torna a tarefa DONE)\n\n" +
  "## Fora de escopo\n\n- \n";

const HANDOFF_SKELETON =
  "# HANDOFF\n\n" +
  "Estado atual compacto do projeto.\n\n" +
  "## Situação\n\n" +
  "- status: inicial\n" +
  "- foco: preencher este handoff\n\n" +
  "## Próximo passo\n\n" +
  "- descrever a próxima ação concreta\n";

const VERIFY_SKELETON =
  "# VERIFY\n\n" +
  "Última verificação executada no projeto.\n\n" +
  "## Última execução\n\n" +
  "- status: pendente\n" +
  "- comandos: definir\n" +
  "- observações: definir\n";

module.exports = function initEntrypoint(options) {
  const root = path.resolve(options.projectPath || ".");
  const dryRun = !!options.dryRun;

  if (!fs.existsSync(root)) {
    throw new Error(`Projeto nao existe: ${root}`);
  }

  const results = [];
  const indexFile = path.join(root, "DEV", "INDEX.md");
  const activeFile = path.join(root, "DEV", "SPECS", "ACTIVE.md");
  const handoffFile = path.join(root, "DEV", "HANDOFF.md");
  const verifyFile = path.join(root, "DEV", "VERIFY.md");
  const agentsFile = path.join(root, "AGENTS.md");

  if (dryRun) {
    results.push(["DEV/INDEX.md", fs.existsSync(indexFile) ? "ja-existe" : "criaria"]);
    results.push(["DEV/SPECS/ACTIVE.md", fs.existsSync(activeFile) ? "ja-existe" : "criaria"]);
    results.push(["DEV/HANDOFF.md", fs.existsSync(handoffFile) ? "ja-existe" : "criaria"]);
    results.push(["DEV/VERIFY.md", fs.existsSync(verifyFile) ? "ja-existe" : "criaria"]);
    results.push(["AGENTS.md (ponteiro topo)", "injetaria/atualizaria"]);
  } else {
    results.push(["DEV/INDEX.md", writeIfMissing(indexFile, INDEX_SKELETON)]);
    results.push(["DEV/SPECS/ACTIVE.md", writeIfMissing(activeFile, ACTIVE_SKELETON)]);
    results.push(["DEV/HANDOFF.md", writeIfMissing(handoffFile, HANDOFF_SKELETON)]);
    results.push(["DEV/VERIFY.md", writeIfMissing(verifyFile, VERIFY_SKELETON)]);
    results.push(["AGENTS.md (ponteiro topo)", injectPointerTop(agentsFile, dryRun)]);
  }

  console.log(`combo-maestro init-entrypoint${dryRun ? " (dry-run)" : ""}`);
  console.log(`Projeto: ${root}\n`);
  for (const [name, action] of results) {
    console.log(`  ${action.padEnd(22)} ${name}`);
  }
  console.log(
    "\nAditivo e nao-destrutivo: skeletons so criados se faltavam; o corpo do AGENTS.md\n" +
    "nao foi tocado (so o ponteiro entre marcadores ENTRYPOINT). Edite os skeletons a mao."
  );
};
