"use strict";

const { spawnSync } = require("node:child_process");
const { readProfileModel } = require("./setup-bracal.js");
const { logDelegation } = require("./audit.js");
const { loadEntrypoint, withEntrypoint } = require("./entrypoint.js");
const { shellCommandLine } = require("./lib.js");

// Broker registry: cada CLI delega braçal para o tier barato do próprio
// ecossistema. A sessão principal fica no modelo caro; só o subprocesso usa o
// mini quando houver shell-out permitido.
const BROKERS = {
  codex: {
    mode: "shellout",
    cmd: "codex",
    defaultModel: "gpt-5.4-mini",
    profile: () => readProfileModel(),
    build: (model) => ["exec", "-m", model, "--sandbox", "read-only", "-"],
    stdin: true
  },
  mimo: {
    // mimo só opera via API cobrada. Permitido apenas com opt-in explícito
    // (--allow-api), porque é o único jeito de usar esse broker.
    mode: "api",
    cmd: "mimo",
    defaultModel: "xiaomi/mimo-v2.5",
    build: (model, task) => ["run", "-m", model, String(task)],
    stdin: false
  },
  claude: {
    mode: "in-session",
    nativeTier: "Haiku",
    how: "use a Task tool desta sessao com um subagent de modelo Haiku (assinatura, zero API)"
  },
  gemini: {
    mode: "in-session",
    nativeTier: "Gemini Flash",
    how: "delegue ao tier Flash dentro da propria sessao Gemini; o headless `gemini` usaria API"
  },
  grok: {
    // Grok CLI (xAI) e sempre metrado por XAI_API_KEY; nao ha caminho de
    // assinatura. Fica in-session: delegue o bracal ao tier barato dentro da
    // propria sessao Grok, sem shell-out para um segundo processo cobrado.
    mode: "in-session",
    nativeTier: "grok-code-fast-1",
    how: "delegue ao tier barato (grok-code-fast-1 / grok-4-fast) dentro da propria sessao Grok; o headless `grok` abriria um segundo processo cobrado"
  }
};

function detectCli() {
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE) return "claude";
  if (process.env.CODEX_HOME || process.env.CODEX_SANDBOX) return "codex";
  if (process.env.GROK_HOME || process.env.XAI_API_KEY) return "grok";
  return "codex";
}

module.exports = function delegate(options) {
  const cli = (options.cli || detectCli()).toLowerCase();
  const task = options.task;

  if (!task || !String(task).trim()) {
    throw new Error('Faltou a tarefa. Uso: combo-maestro delegate "<tarefa bracal>" [--cli codex|claude|mimo|gemini|grok]');
  }

  const broker = BROKERS[cli];
  if (!broker) {
    throw new Error(`CLI desconhecido: ${cli}. Suportados: ${Object.keys(BROKERS).join(", ")}.`);
  }

  if (broker.mode === "api") {
    if (!options.allowApi) {
      logDelegation({ cli, mode: "api", status: "blocked-api", task });
      console.error(
        `[combo-maestro] '${cli}' so opera via API COBRADA (sem caminho de assinatura).\n` +
        `  Bloqueado por padrao pra evitar gasto surpresa.\n` +
        `  Se voce quer mesmo usar ${cli} (e o unico jeito), confirme: --allow-api`
      );
      process.exit(2);
    }
    console.error(`[combo-maestro] AVISO: ${cli} via API COBRADA (voce autorizou com --allow-api).`);
  }

  if (broker.mode === "in-session") {
    logDelegation({ cli, mode: "in-session", status: "redirect-in-session", task });
    console.error(
      `[combo-maestro] '${cli}' usa delegacao IN-SESSION (assinatura, nao API).\n` +
      `  Nao ha shell-out: o headless deste CLI cairia em API cobrada.\n` +
      `  O agente em execucao deve delegar o bracal ao proprio tier-barato (${broker.nativeTier}):\n` +
      `    ${broker.how}.\n` +
      `  Isso e governado pela regra injetada em rules.md (combo-maestro install).`
    );
    process.exit(2);
  }

  const model = options.model || (broker.profile && broker.profile()) || broker.defaultModel;

  // O cold sub abre cego. Injetamos o entrypoint compacto (DEV/INDEX,
  // DEV/SPECS/ACTIVE e DEV/HANDOFF) com quatro guardas:
  //   1. sem DEV/ -> preamble vazio -> comportamento identico ao anterior;
  //   2. cap de tokens dentro de loadEntrypoint;
  //   3. nao injeta no modo API;
  //   4. --no-context desliga.
  let preamble = "";
  if (broker.mode !== "api" && !options.noContext) {
    preamble = loadEntrypoint(options.projectPath || ".");
    if (preamble) {
      console.error("[combo-maestro] contexto compacto injetado no cold sub (use --no-context pra desligar).");
    }
  }
  const taskForSub = withEntrypoint(task, preamble);

  const args = broker.build(model, taskForSub);
  console.error(`[combo-maestro] delegando bracal -> ${broker.cmd} (${cli}) modelo ${model}`);

  // On Windows the broker is an npm .cmd shim, which needs shell:true; with the
  // shell on, the task text goes through cmd.exe, so it must be quoted.
  const useShell = process.platform === "win32";
  const res = spawnSync(
    useShell ? shellCommandLine(broker.cmd, args) : broker.cmd,
    useShell ? undefined : args,
    {
      input: broker.stdin ? String(taskForSub) : undefined,
      stdio: [broker.stdin ? "pipe" : "ignore", "inherit", "inherit"],
      shell: useShell
    }
  );

  if (res.error) {
    logDelegation({ cli, mode: broker.mode, model, status: "spawn-error", task });
    throw new Error(`Falha ao chamar ${broker.cmd}: ${res.error.message}`);
  }

  logDelegation({ cli, mode: broker.mode, model, status: `exit${res.status}`, task });
  if (res.status !== 0) {
    console.error(`[combo-maestro] ${broker.cmd} saiu com codigo ${res.status}. Fallback: maestro assume inline.`);
    process.exit(res.status || 1);
  }
};
