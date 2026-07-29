"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BEGIN = "# >>> combo-maestro bracal profile >>>";
const END = "# <<< combo-maestro bracal profile <<<";

// Writes/updates a [profiles.bracal] table in the active CLI config, marked + idempotent.
// Today: Codex (~/.codex/config.toml). Single source of truth for the cheap-tier model id.
module.exports = function setupBracal(options) {
  const cli = (options.cli || "codex").toLowerCase();
  const model = options.model || "gpt-5.4-mini";

  if (cli !== "codex") {
    throw new Error(`setup-bracal hoje so suporta --cli codex (pedido: ${cli}).`);
  }

  const cfgPath = path.join(os.homedir(), ".codex", "config.toml");
  if (!fs.existsSync(cfgPath)) {
    throw new Error(`config.toml do Codex nao encontrado: ${cfgPath}`);
  }

  const block = [
    BEGIN,
    "[profiles.bracal]",
    `model = "${model}"`,
    'model_reasoning_effort = "low"',
    END
  ].join("\n");

  const original = fs.readFileSync(cfgPath, "utf8");
  let next;
  const re = new RegExp(`${escape(BEGIN)}[\\s\\S]*?${escape(END)}`, "g");
  if (re.test(original)) {
    next = original.replace(re, block);
    console.log(`Profile 'bracal' atualizado (model=${model}) em ${cfgPath}`);
  } else {
    next = `${original.replace(/\s+$/u, "")}\n\n${block}\n`;
    console.log(`Profile 'bracal' criado (model=${model}) em ${cfgPath}`);
  }

  if (!options.dryRun) {
    fs.writeFileSync(cfgPath, next, "utf8");
  }
  console.log("Uso direto: codex exec -p bracal \"<tarefa>\"");
  console.log("Ou pelo broker: combo-maestro delegate \"<tarefa>\"");
};

function escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports.readProfileModel = function readProfileModel() {
  try {
    const cfgPath = path.join(os.homedir(), ".codex", "config.toml");
    const content = fs.readFileSync(cfgPath, "utf8");
    const m = content.match(/\[profiles\.bracal\][\s\S]*?model\s*=\s*"([^"]+)"/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
};
