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

test("init-entrypoint scaffolds compact DEV docs and preserves AGENTS body", () => {
  const project = makeTempDir();
  const agentsFile = path.join(project, "AGENTS.md");
  fs.writeFileSync(agentsFile, "Projeto legado\n", "utf8");

  const res = runCli(["init-entrypoint", "--project-path", project]);
  assert.equal(res.status, 0, res.stderr);

  const indexFile = path.join(project, "DEV", "INDEX.md");
  const activeFile = path.join(project, "DEV", "SPECS", "ACTIVE.md");
  const handoffFile = path.join(project, "DEV", "HANDOFF.md");
  const verifyFile = path.join(project, "DEV", "VERIFY.md");

  assert.ok(fs.existsSync(indexFile));
  assert.ok(fs.existsSync(activeFile));
  assert.ok(fs.existsSync(handoffFile));
  assert.ok(fs.existsSync(verifyFile));

  const agents = read(agentsFile);
  assert.match(agents, /COMBO-MAESTRO:ENTRYPOINT:BEGIN/);
  assert.match(agents, /DEV\/HANDOFF\.md/);
  assert.match(agents, /Projeto legado/);
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
