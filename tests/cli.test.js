"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const binPath = path.join(repoRoot, "bin", "combo-maestro.js");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "combo-maestro-"));
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [binPath, ...args], {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...options.env }
  });
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

test("install, verify and uninstall manage marked blocks idempotently", () => {
  const home = makeTempDir();
  const orq = path.join(home, ".orquestrador");
  fs.mkdirSync(orq, { recursive: true });

  const rulesFile = path.join(orq, "rules.md");
  const hooksFile = path.join(orq, "hooks.md");
  fs.writeFileSync(rulesFile, "# rules-base\n", "utf8");
  fs.writeFileSync(hooksFile, "# hooks-base\n", "utf8");

  let res = runCli(["install", "--home-path", home]);
  assert.equal(res.status, 0, res.stderr);

  const rulesOnce = read(rulesFile);
  const hooksOnce = read(hooksFile);
  assert.match(rulesOnce, /COMBO-MAESTRO:BEGIN/);
  assert.match(hooksOnce, /COMBO-MAESTRO:BEGIN/);
  assert.match(rulesOnce, /# rules-base/);
  assert.match(hooksOnce, /# hooks-base/);

  res = runCli(["install", "--home-path", home]);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(read(rulesFile), rulesOnce);
  assert.equal(read(hooksFile), hooksOnce);

  res = runCli(["verify", "--home-path", home]);
  assert.equal(res.status, 0, res.stderr);

  res = runCli(["uninstall", "--home-path", home]);
  assert.equal(res.status, 0, res.stderr);
  assert.doesNotMatch(read(rulesFile), /COMBO-MAESTRO:BEGIN/);
  assert.doesNotMatch(read(hooksFile), /COMBO-MAESTRO:BEGIN/);
  assert.match(read(rulesFile), /# rules-base/);
  assert.match(read(hooksFile), /# hooks-base/);
});

test("the injected hooks block stays inside the core 80-line budget", () => {
  const home = makeTempDir();
  const orq = path.join(home, ".orquestrador");
  fs.mkdirSync(orq, { recursive: true });

  const hooksFile = path.join(orq, "hooks.md");
  // Mirrors the real core hooks.md size so the COMBO block is measured against it.
  const coreHooks = Array.from({ length: 51 }, (_, i) => `linha ${i + 1}`).join("\n");
  fs.writeFileSync(path.join(orq, "rules.md"), "# rules-base\n", "utf8");
  fs.writeFileSync(hooksFile, `${coreHooks}\n`, "utf8");

  let res = runCli(["install", "--home-path", home]);
  assert.equal(res.status, 0, res.stderr);
  assert.doesNotMatch(res.stderr, /AVISO/);

  const lines = read(hooksFile).replace(/\n$/u, "").split("\n").length;
  assert.ok(lines <= 80, `hooks.md ficou com ${lines} linhas (limite 80 do nucleo)`);

  res = runCli(["verify", "--home-path", home]);
  assert.equal(res.status, 0, res.stderr);
});

test("verify fails when hooks.md exceeds the core line budget", () => {
  const home = makeTempDir();
  const orq = path.join(home, ".orquestrador");
  fs.mkdirSync(orq, { recursive: true });

  fs.writeFileSync(path.join(orq, "rules.md"), "# rules-base\n", "utf8");
  fs.writeFileSync(
    path.join(orq, "hooks.md"),
    `${Array.from({ length: 90 }, (_, i) => `linha ${i + 1}`).join("\n")}\n`,
    "utf8"
  );

  let res = runCli(["install", "--home-path", home]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stderr, /AVISO/);

  res = runCli(["verify", "--home-path", home]);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /limite 80 do nucleo/);
});

test("init-entrypoint delegates the DEV hierarchy to the core and keeps the AGENTS body", () => {
  const project = makeTempDir();
  const agentsFile = path.join(project, "AGENTS.md");
  fs.writeFileSync(agentsFile, "Projeto legado\n", "utf8");

  const res = runCli(["init-entrypoint", "--project-path", project]);

  // The core CLI owns the DEV/ schema now. Where it is unavailable (CI without
  // the core installed) the command must fail loudly pointing at the install,
  // never silently fall back to a schema the core gate would reject.
  if (res.status !== 0) {
    assert.match(res.stderr, /orquestrador-maestro/);
    return;
  }

  assert.match(res.stdout, /init-dev do nucleo/);
  assert.ok(fs.existsSync(path.join(project, "DEV", "HANDOFF.md")));

  const agents = read(agentsFile);
  assert.match(agents, /COMBO-MAESTRO:ENTRYPOINT:BEGIN/);
  assert.match(agents, /DEV\/HANDOFF\.md/);
  assert.match(agents, /Projeto legado/);
});

test("budget is retired and points at the core context brief", () => {
  const res = runCli(["budget", "--project-path", repoRoot]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /APOSENTADO/);
  assert.match(res.stderr, /context brief/);
});

test("shell arguments are quoted so a project path cannot inject a command", () => {
  const { shellQuote, shellSafeArgs } = require(path.join(repoRoot, "src", "lib.js"));

  const hostile = "C:\\tmp\\proj & calc.exe";
  const quoted = shellQuote(hostile);
  assert.ok(quoted.startsWith(process.platform === "win32" ? '"' : "'"));
  assert.ok(
    quoted.endsWith(process.platform === "win32" ? '"' : "'"),
    "the metacharacter must stay inside the quotes"
  );

  // Without a shell, argv is passed verbatim and quoting would corrupt it.
  assert.deepEqual(shellSafeArgs([hostile], false), [hostile]);
  assert.deepEqual(shellSafeArgs([hostile], true), [quoted]);

  // shell:true takes one pre-quoted line (DEP0190), so the metacharacter must
  // arrive wrapped rather than as a bare token cmd.exe would treat as a chain.
  const { shellCommandLine } = require(path.join(repoRoot, "src", "lib.js"));
  const line = shellCommandLine("some-cli", ["run", hostile]);
  assert.equal(line, `some-cli ${shellQuote("run")} ${quoted}`);
});

test("delegate blocks billed API mode unless explicitly allowed", () => {
  const res = runCli(["delegate", "tarefa de teste", "--cli", "mimo"]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /API COBRADA/);
  assert.match(res.stderr, /--allow-api/);
});

test("delegate redirects in-session brokers instead of shelling out", () => {
  const res = runCli(["delegate", "tarefa de teste", "--cli", "claude"]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /IN-SESSION/);
  assert.match(res.stderr, /Haiku/);
});

// --- memory harvest (bridge to core 0.2.0 native memory) ---------------------

test("memory harvest proposes signal turns, filters noise, and redacts", () => {
  const tdir = makeTempDir();
  const jsonl = [
    // real durable signal + a personal path to redact
    JSON.stringify({ type: "user", message: { role: "user", content: "na verdade sempre use o caminho C:\\Users\\alice\\projeto para o build" } }),
    // harness-injected content must be ignored
    JSON.stringify({ type: "user", message: { role: "user", content: "<system-reminder>faca isso</system-reminder>" } }),
    // short ack must be ignored
    JSON.stringify({ type: "user", message: { role: "user", content: "sim" } }),
    // no-signal turn must be ignored
    JSON.stringify({ type: "user", message: { role: "user", content: "abre o arquivo de config por favor agora" } }),
    // assistant is not a user turn
    JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "ok" }] } })
  ].join("\n");
  fs.writeFileSync(path.join(tdir, "s1.jsonl"), jsonl, "utf8");

  // No --apply: propose only, records nothing (so the core CLI is never called).
  let res = runCli(["memory", "harvest", "--transcripts", tdir, "--project", "proj"]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /Candidatas com sinal: 1/);
  assert.match(res.stdout, /na verdade sempre use/);
  assert.doesNotMatch(res.stdout, /system-reminder/);
  assert.doesNotMatch(res.stdout, /Users\\alice/); // personal path masked
  assert.match(res.stdout, /Nada gravado/);

  // Missing transcript dir aborts cleanly (exit 2), never throws.
  res = runCli(["memory", "harvest", "--transcripts", path.join(tdir, "nope"), "--project", "proj"]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /transcript nao encontrado/);
});

test("retired memory subcommands point at the core native memory", () => {
  for (const sub of ["index", "push", "recall", "link", "lint"]) {
    const res = runCli(["memory", sub]);
    assert.equal(res.status, 2, `${sub} should exit 2`);
    assert.match(res.stderr, /aposentado/);
    assert.match(res.stderr, /orquestrador-maestro memory/);
  }
});

test("memory redactSnippet masks home paths and token-shaped strings", () => {
  const memory = require(path.join(repoRoot, "src", "memory.js"));
  assert.match(memory.redactSnippet("veja C:\\Users\\bob\\x"), /~/);
  assert.doesNotMatch(memory.redactSnippet("veja C:\\Users\\bob\\x"), /bob/);
  assert.match(memory.redactSnippet("key sk-abcdefghijklmnop123"), /\[REDACTED\]/);
});

test("statusline renders the 5h/7d quota windows and colors by remaining", () => {
  const statusline = require(path.join(repoRoot, "src", "statusline.js"));
  const out = statusline.render({
    model: { display_name: "Opus" },
    rate_limits: { five_hour: { used_percentage: 60, resets_at: Math.floor(Date.now() / 1000) + 3600 }, seven_day: { used_percentage: 20 } },
    context_window: { used_percentage: 40 },
    cost: { total_cost_usd: 0.42 }
  });
  assert.match(out, /5h/);
  assert.match(out, /40% livre/); // 100 - 60 used
  assert.match(out, /7d/);
  assert.match(out, /reset 1h00/);
  assert.match(out, /\$0\.42/);

  // Missing rate_limits (older Claude Code) -> graceful, never throws.
  const legacy = statusline.render({ context_window: { used_percentage: 15 } });
  assert.match(legacy, /ctx 15%/);
  assert.doesNotMatch(statusline.render({}), /undefined/);

  // colorForRemaining thresholds: low remaining = red, high = green.
  assert.notEqual(statusline.colorForRemaining(5), statusline.colorForRemaining(80));
});

test("quota CLI runs and separates fresh tokens from cache-read", () => {
  const res = runCli(["quota", "--days", "1"]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /uso por provider/);
  assert.match(res.stdout, /cache-read/);
  assert.doesNotMatch(res.stdout, /\$\d/); // no dollar amount without --cost
  const withCost = runCli(["quota", "--days", "1", "--cost"]);
  assert.match(withCost.stdout, /~\$ ref/);
});

test("quota fmtTokens is compact and deterministic", () => {
  const quota = require(path.join(repoRoot, "src", "quota.js"));
  assert.equal(quota.fmtTokens(500), "500");
  assert.equal(quota.fmtTokens(1500), "1.5k");
  assert.equal(quota.fmtTokens(2_000_000), "2.00M");
  assert.equal(quota.fmtTokens(3_000_000_000), "3.00B");
});

test("statusline CLI reads JSON on stdin", () => {
  const payload = JSON.stringify({ rate_limits: { five_hour: { used_percentage: 90 } } });
  const res = spawnSync(process.execPath, [binPath, "statusline"], { input: payload, encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /5h/);
  assert.match(res.stdout, /10% livre/);
});

test("memory classifyHarvest maps only to valid core observation types", () => {
  const memory = require(path.join(repoRoot, "src", "memory.js"));
  for (const text of ["na verdade prefiro assim", "vamos usar o codex", "o build passou verde", "cuidado tem risco aqui"]) {
    assert.ok(memory.CORE_TYPES.includes(memory.classifyHarvest(text)), `${text} -> valid type`);
  }
  assert.equal(memory.classifyHarvest("vamos decidir isso"), "decision");
  assert.equal(memory.classifyHarvest("tem risco de perder dados"), "risk");
});
