"use strict";

// `budget` foi aposentado. O nucleo (Orquestrador 0.1.14, ampliado no 0.1.18)
// passou a trazer `context brief`, que faz mais: respeita um orcamento de
// caracteres, prioriza pela intencao do maestro e resume o estado de `DEV/`
// (fase, proxima acao, riscos). Duplicar isso so gastava linha no bloco de
// hooks, que divide o limite de 80 linhas com o nucleo.
//
// O comando continua existindo para nao quebrar hooks antigos em silencio:
// falha alto e aponta o substituto.

const path = require("node:path");

module.exports = function budgetRetired(options) {
  const projectRoot = path.resolve(options.projectPath || process.cwd());

  console.error("combo-maestro budget foi APOSENTADO.");
  console.error("");
  console.error("O nucleo absorveu esta peca e faz mais: mede dentro de um orcamento,");
  console.error("prioriza pela intencao do maestro e resume fase, proxima acao e riscos.");
  console.error("");
  console.error("Use:");
  console.error(`  orquestrador-maestro context brief --project-path "${projectRoot}" --max-chars 1200`);
  console.error("");
  console.error("Passe SEMPRE caminho absoluto: no nucleo 0.1.19 o --project-path");
  console.error("relativo resolve contra o diretorio de instalacao da CLI.");

  process.exit(2);
};
