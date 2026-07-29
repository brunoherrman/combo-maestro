"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { resolveHome, readUtf8, templatePath, injectBlock, checkHooksBudget } = require("./lib.js");

module.exports = function install(options) {
  const { orquestrador } = resolveHome(options.homePath);
  const dryRun = Boolean(options.dryRun);

  if (!fs.existsSync(orquestrador)) {
    throw new Error(
      `.orquestrador nao encontrado em ${orquestrador}.\n` +
      `Instale o nucleo primeiro: npm i -g @iapro/orquestrador-maestro-cli && orquestrador-maestro install`
    );
  }

  const targets = [
    { file: path.join(orquestrador, "rules.md"), template: "bracal-delegation.rules.md" },
    { file: path.join(orquestrador, "hooks.md"), template: "bracal-curation.hooks.md" }
  ];

  console.log(`combo-maestro install ${dryRun ? "(dry-run)" : ""}`);
  console.log(`Orquestrador: ${orquestrador}`);

  for (const target of targets) {
    const body = readUtf8(templatePath(target.template));
    const action = injectBlock(target.file, body, { dryRun });
    console.log(`- ${path.basename(target.file)}: bloco COMBO ${action}`);
  }

  if (!dryRun) {
    const budget = checkHooksBudget(path.join(orquestrador, "hooks.md"));
    if (budget) {
      console.warn(
        `\nAVISO: hooks.md ficou com ${budget.lines} linhas (limite ${budget.max} do nucleo). ` +
        `'orquestrador-maestro verify' vai falhar ate o bloco COMBO encurtar.`
      );
    }
  }

  console.log(
    dryRun
      ? "\nNenhum arquivo alterado (dry-run)."
      : "\nPronto. Reinicie as ferramentas de IA abertas para recarregarem as regras."
  );
};
