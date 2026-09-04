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

// --- memory layer ------------------------------------------------------------

const WORKLOG_FIXTURE = `# WORKLOG

## 2026-07-16 - broker grok in-session

- Spec: adicionar broker grok cheap-tier
- Changed: delegate.js ganhou tier grok-code-fast-1 in-session para bracal
- Verified: npm test verde

## 2026-07-28 - gate de hooks de 80 linhas

- Spec: adaptar ao limite de hooks do nucleo
- Changed: bloco COMBO encurtado para caber no orcamento
- Verified: verify passou

## 2026-08-05 - camada memory FTS

- Spec: recall cross-projeto sem daemon
- Changed: memory.js com index/push/recall/link em BM25 puro
- Verified: smoke test manual verde
`;

function seedProject() {
  const project = makeTempDir();
  fs.mkdirSync(path.join(project, "DEV"), { recursive: true });
  fs.writeFileSync(path.join(project, "DEV", "WORKLOG.md"), WORKLOG_FIXTURE, "utf8");
  return project;
}

test("memory push proposes without writing, then --apply persists pages", () => {
  const home = makeTempDir();
  const project = seedProject();

  // keep=1 -> the older entry falls into the substantive "gray" bucket.
  let res = runCli(["memory", "push", "--project-path", project, "--home-path", home, "--keep", "1"]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /Nada escrito/);
  const store = path.join(home, ".orquestrador", "memory");
  assert.ok(!fs.existsSync(store) || fs.readdirSync(store).filter((f) => f.endsWith(".md")).length === 0);

  res = runCli(["memory", "push", "--project-path", project, "--home-path", home, "--keep", "1", "--apply"]);
  assert.equal(res.status, 0, res.stderr);
  const pages = fs.readdirSync(store).filter((f) => f.endsWith(".md"));
  assert.ok(pages.length >= 1, "at least one gray entry becomes a page");
  assert.ok(fs.existsSync(path.join(store, "INDEX.json")));
});

test("memory recall ranks by BM25, honors the char cap and the project namespace", () => {
  const home = makeTempDir();
  const project = seedProject();
  runCli(["memory", "push", "--project-path", project, "--home-path", home, "--keep", "1", "--apply"]);

  let res = runCli(["memory", "recall", "grok broker in-session", "--home-path", home, "--max-chars", "400"]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /grok/i);
  // Bounded output: header + at most a few short lines, never the whole store.
  assert.ok(res.stdout.length < 900, `recall output was ${res.stdout.length} chars`);

  // The seeded pages carry project = basename(project); a different project must
  // not leak them.
  res = runCli(["memory", "recall", "grok", "--home-path", home, "--project", "outro-cliente"]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /nada casou/);
});

test("memory recall filters by as_of date", () => {
  const home = makeTempDir();
  const project = seedProject();
  runCli(["memory", "push", "--project-path", project, "--home-path", home, "--keep", "1", "--apply"]);

  // Only the 2026-07-16 page is <= this date; the 07-28 page is excluded.
  const res = runCli(["memory", "recall", "hooks gate grok", "--home-path", home, "--as-of", "2026-07-20"]);
  assert.equal(res.status, 0, res.stderr);
  assert.doesNotMatch(res.stdout, /gate de hooks/);
});

test("memory recall degrades gracefully with no store", () => {
  const home = makeTempDir();
  const res = runCli(["memory", "recall", "qualquer coisa", "--home-path", home]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /store vazio|sem indice/i);
});

test("memory link writes a typed edge and rejects invalid relations", () => {
  const home = makeTempDir();
  const project = seedProject();
  runCli(["memory", "push", "--project-path", project, "--home-path", home, "--keep", "1", "--apply"]);
  const store = path.join(home, ".orquestrador", "memory");
  const ids = fs
    .readdirSync(store)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.basename(f, ".md"));
  assert.ok(ids.length >= 2, "need two pages to link");

  let res = runCli(["memory", "link", ids[0], "fixes", ids[1], "--home-path", home]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(read(path.join(store, `${ids[0]}.md`)), new RegExp(`fixes:${ids[1]}`));

  res = runCli(["memory", "link", ids[0], "foo", ids[1], "--home-path", home]);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /edge invalido/);
});

test("memory lint passes on a clean store and fails on broken edges", () => {
  const home = makeTempDir();
  const store = path.join(home, ".orquestrador", "memory");
  fs.mkdirSync(store, { recursive: true });
  const page = (id, links) =>
    `---\nid: ${id}\ntype: fact\nproject: p\ncreated: 2026-01-01\nlinks: [${links}]\ntags: []\n---\ncorpo ${id}\n`;
  fs.writeFileSync(path.join(store, "a.md"), page("a", "fixes:b"), "utf8");
  fs.writeFileSync(path.join(store, "b.md"), page("b", ""), "utf8");

  let res = runCli(["memory", "lint", "--home-path", home]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /0 erros/);

  // A dangling edge and an invalid relation must both be reported and fail.
  fs.writeFileSync(path.join(store, "c.md"), page("c", "fixes:naoexiste, foo:b"), "utf8");
  res = runCli(["memory", "lint", "--home-path", home]);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /edge quebrado/);
  assert.match(res.stdout, /edge invalido/);
});

test("memory BM25 and tokenizer behave deterministically", () => {
  const memory = require(path.join(repoRoot, "src", "memory.js"));
  assert.deepEqual(memory.tokenize("O núcleo e a HOOKS.md"), ["nucleo", "hooks", "md"]);
  assert.equal(memory.slugify("Núcleo 0.1.27 — gate!"), "nucleo-0-1-27-gate");

  const { meta, body } = memory.parseFrontmatter(
    "---\nid: x\ntype: fix\nlinks: [fixes:y, causes:z]\n---\ncorpo aqui\n"
  );
  assert.equal(meta.id, "x");
  assert.deepEqual(meta.links, ["fixes:y", "causes:z"]);
  assert.equal(body, "corpo aqui");
});
