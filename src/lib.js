"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BEGIN = "<!-- COMBO-MAESTRO:BEGIN -->";
const END = "<!-- COMBO-MAESTRO:END -->";

function resolveHome(homePathOption) {
  const home = path.resolve(homePathOption || os.homedir());
  const orquestrador = path.join(home, ".orquestrador");
  return { home, orquestrador };
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function templatePath(name) {
  return path.join(__dirname, "..", "templates", name);
}

function blockRegex() {
  // matches the whole marked block, including surrounding blank lines
  return new RegExp(`\\n*${escapeRegex(BEGIN)}[\\s\\S]*?${escapeRegex(END)}\\n*`, "g");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasBlock(content) {
  return content.includes(BEGIN) && content.includes(END);
}

function wrapBlock(body) {
  return `${BEGIN}\n${body.trim()}\n${END}`;
}

// Inject (or replace) the marked block at the end of a file. Idempotent.
function injectBlock(filePath, body, { dryRun = false } = {}) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo alvo nao existe (Orquestrador instalado?): ${filePath}`);
  }
  const original = readUtf8(filePath);
  const block = wrapBlock(body);
  let next;
  let action;
  if (hasBlock(original)) {
    next = original.replace(blockRegex(), `\n\n${block}\n`);
    action = "atualizado";
  } else {
    next = `${original.replace(/\s+$/u, "")}\n\n${block}\n`;
    action = "injetado";
  }
  if (!dryRun) {
    fs.writeFileSync(filePath, next, "utf8");
  }
  return action;
}

function removeBlock(filePath, { dryRun = false } = {}) {
  if (!fs.existsSync(filePath)) {
    return "ausente";
  }
  const original = readUtf8(filePath);
  if (!hasBlock(original)) {
    return "nada";
  }
  const next = `${original.replace(blockRegex(), "\n").replace(/\s+$/u, "")}\n`;
  if (!dryRun) {
    fs.writeFileSync(filePath, next, "utf8");
  }
  return "removido";
}

// rough token estimate; deterministic, no external deps
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// Node refuses to spawn a Windows .cmd shim (npm installs CLIs as .cmd) without
// shell:true, and with shell:true it concatenates argv instead of escaping it.
// So we quote here: an unquoted `&` or `|` in a task string or project path
// would otherwise run as a second command.
function shellQuote(value) {
  const text = String(value);
  if (process.platform === "win32") {
    // Inside cmd.exe double quotes, &, |, <, > and spaces lose their meaning.
    return `"${text.replace(/"/g, '""')}"`;
  }
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

// Only quote when the shell is actually involved; otherwise argv is passed
// through verbatim and quoting would become part of the argument.
function shellSafeArgs(args, useShell) {
  return useShell ? args.map(shellQuote) : args;
}

// Node deprecates (DEP0190) passing an args array alongside shell:true, because
// it concatenates without escaping. The supported shape is one pre-quoted
// command line, which is what this returns for the shell case.
function shellCommandLine(cmd, args) {
  return [cmd, ...args.map(shellQuote)].join(" ");
}

// The core verifier (>=0.1.12) rejects a hooks.md over this many lines. The COMBO
// block shares that budget, so keep it small enough for core `verify` to pass.
const HOOKS_MAX_LINES = 80;

function countLines(content) {
  return content.replace(/\n$/u, "").split("\n").length;
}

// Returns null when the file is absent or within budget; otherwise a report.
function checkHooksBudget(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const lines = countLines(readUtf8(filePath));
  if (lines <= HOOKS_MAX_LINES) {
    return null;
  }
  return { lines, max: HOOKS_MAX_LINES };
}

module.exports = {
  BEGIN,
  END,
  resolveHome,
  readUtf8,
  templatePath,
  hasBlock,
  injectBlock,
  removeBlock,
  estimateTokens,
  escapeRegex,
  HOOKS_MAX_LINES,
  countLines,
  checkHooksBudget,
  shellQuote,
  shellSafeArgs,
  shellCommandLine
};
