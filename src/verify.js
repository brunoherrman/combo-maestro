"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { resolveHome, readUtf8, hasBlock, checkHooksBudget } = require("./lib.js");

module.exports = function verify(options) {
  const { orquestrador } = resolveHome(options.homePath);
  const files = ["rules.md", "hooks.md"].map((name) => path.join(orquestrador, name));

  let ok = true;
  console.log("combo-maestro verify");
  console.log(`Orquestrador: ${orquestrador}`);

  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.error(`- ${path.basename(file)}: AUSENTE (nucleo nao instalado?)`);
      ok = false;
      continue;
    }
    if (hasBlock(readUtf8(file))) {
      console.log(`- ${path.basename(file)}: bloco COMBO presente`);
    } else {
      console.error(`- ${path.basename(file)}: bloco COMBO FALTANDO (rode combo-maestro install)`);
      ok = false;
    }
  }

  const budget = checkHooksBudget(path.join(orquestrador, "hooks.md"));
  if (budget) {
    console.error(
      `- hooks.md: ${budget.lines} linhas (limite ${budget.max} do nucleo). ` +
      `'orquestrador-maestro verify' vai falhar; encurte o bloco COMBO.`
    );
    ok = false;
  }

  if (!ok) {
    process.exit(1);
  }
  console.log("\nVerificacao passou.");
};
