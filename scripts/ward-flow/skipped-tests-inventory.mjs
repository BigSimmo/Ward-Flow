#!/usr/bin/env node
/**
 * Generates docs/skipped-tests-inventory.md from the test tree, so the list of skipped, conditional
 * and to-do tests cannot go stale by hand (audit F-54, 10 November 2026).
 *
 *     node scripts/ward-flow/skipped-tests-inventory.mjs           # write the inventory
 *     node scripts/ward-flow/skipped-tests-inventory.mjs --check   # fail if the committed copy is stale
 *
 * `tests/ward-skipped-tests-inventory.test.ts` runs `--check`, so a new or removed skip fails the unit
 * suite until the inventory is regenerated.
 *
 * It parses each file under `tests/` with the TypeScript compiler rather than a regex, so a
 * `describe.skip(` written inside a fixture string or a comment is not counted. It finds calls on
 * `it`, `test` or `describe` (including `test.describe`) to `skip`, `skipIf`, `runIf`, `todo` and
 * `fixme`, plus `xit`, `xtest` and `xdescribe`, and the indirect `(cond ? it.skip : it)(…)`. A plain
 * `test.skip(condition, "message")` inside a Playwright test body is a runtime skip and is listed with
 * the enclosing test's title, so two identical runtime skips in different tests stay distinguishable.
 *
 * Line numbers are deliberately left out: they move with every unrelated edit, and the list would go
 * stale for reasons that change nothing. Search the file for the title.
 */

import { existsSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as prettier from "prettier";
import ts from "typescript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TESTS_DIR = "tests";
const OUT = path.join("docs", "skipped-tests-inventory.md");
const MODIFIERS = new Set(["skip", "skipIf", "runIf", "todo", "fixme"]);
const BASES = new Set(["it", "test", "describe"]);
const X_FORMS = new Set(["xit", "xtest", "xdescribe"]);
const MAX_CELL = 110;

function listTestFiles(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(?:[cm]?[jt]sx?)$/.test(entry)) found.push(path.relative(root, full).replaceAll("\\", "/"));
    }
  };
  const start = path.join(root, TESTS_DIR);
  if (existsSync(start)) walk(start);
  return found.sort();
}

/** `it`, `test`, `describe` or `test.describe` as the receiver of the modifier. */
function isTestBase(node) {
  if (ts.isIdentifier(node)) return BASES.has(node.text);
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "test" &&
    node.name.text === "describe"
  );
}

function cell(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  const cut = flat.length > MAX_CELL ? `${flat.slice(0, MAX_CELL - 1)}…` : flat;
  return cut.replace(/\|/g, "\\|");
}

function argText(source, node) {
  if (!node) return "";
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return `\`${node.getText(source)}\``;
}

/** TypeScript or JavaScript, with or without JSX, from the file's extension. */
function scriptKind(file) {
  if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX;
  if (/\.[cm]?ts$/.test(file)) return ts.ScriptKind.TS;
  if (/\.jsx$/.test(file)) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

/** The function declaration or named function variable that holds `node`, if any. */
function enclosingFunction(node) {
  for (let at = node.parent; at; at = at.parent) {
    if (ts.isFunctionDeclaration(at) && at.name) return { node: at, name: at.name.text };
    if (
      (ts.isArrowFunction(at) || ts.isFunctionExpression(at)) &&
      ts.isVariableDeclaration(at.parent) &&
      ts.isIdentifier(at.parent.name)
    )
      return { node: at, name: at.parent.name.text };
  }
  return null;
}

/** The first argument of the nearest enclosing `it(...)`/`test(...)`/`describe(...)` call, as a locator. */
function enclosingTestTitle(source, node) {
  for (let at = node.parent; at; at = at.parent) {
    if (!ts.isCallExpression(at)) continue;
    const callee = at.expression;
    const named =
      (ts.isIdentifier(callee) && BASES.has(callee.text)) ||
      (ts.isPropertyAccessExpression(callee) && isTestBase(callee.expression) && callee.name.text !== "skip");
    if (named || (ts.isPropertyAccessExpression(callee) && isTestBase(callee))) {
      const first = at.arguments[0];
      if (first && !ts.isFunctionLike(first)) return argText(source, first);
    }
  }
  return "";
}

/**
 * Titles for a call. When the title is a parameter of the helper that wraps the call (for example
 * `function describeAvailableHook(name, body) { describe.skipIf(…)(name, body); }`), each call of
 * that helper in the same file gives its own title, so the row names the real suite and not `name`.
 * With `summarise`, used for `(options.skip ? it.skip : it)(name, …)` where only some calls skip,
 * the helper gets one row that counts its calls.
 */
function titlesFor(source, call, node, { summarise = false } = {}) {
  if (!node || !ts.isIdentifier(node)) return [argText(source, node)];
  const fn = enclosingFunction(call);
  const index = fn ? fn.node.parameters.findIndex((p) => ts.isIdentifier(p.name) && p.name.text === node.text) : -1;
  if (!fn || index < 0) return [argText(source, node)];
  const titles = [];
  const visit = (at) => {
    if (ts.isCallExpression(at) && ts.isIdentifier(at.expression) && at.expression.text === fn.name) {
      const arg = at.arguments[index];
      if (arg) titles.push(`${argText(source, arg)} (via ${fn.name})`);
    }
    ts.forEachChild(at, visit);
  };
  visit(source);
  // A helper whose skip depends on each call's own options: one row for the helper, not one per call.
  if (summarise && titles.length > 0)
    return [`\`${node.text}\` of each ${fn.name}(…) call (${titles.length} in this file)`];
  return titles.length > 0 ? titles : [`\`${node.text}\` (parameter of ${fn.name})`];
}

/** `it.skip`, `test.fixme`, `describe.todo`, `xit` and the like, used as a value rather than called. */
function skipLikeValue(node) {
  while (ts.isParenthesizedExpression(node)) node = node.expression;
  if (ts.isIdentifier(node) && X_FORMS.has(node.text)) return node.text;
  if (
    ts.isPropertyAccessExpression(node) &&
    ["skip", "todo", "fixme"].includes(node.name.text) &&
    isTestBase(node.expression)
  )
    return `${node.expression.getText()}.${node.name.text}`;
  return null;
}

export function findSkips(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  const found = [];
  const visit = (node) => {
    if (ts.isConditionalExpression(node)) {
      // An indirect registration: `(cond ? it.skip : it)("title", fn)`, or the same held in a name.
      const whenTrue = skipLikeValue(node.whenTrue);
      const whenFalse = skipLikeValue(node.whenFalse);
      if (whenTrue || whenFalse) {
        let outer = node;
        while (ts.isParenthesizedExpression(outer.parent) && outer.parent.expression === outer) outer = outer.parent;
        const call = ts.isCallExpression(outer.parent) && outer.parent.expression === outer ? outer.parent : null;
        const held =
          !call && ts.isVariableDeclaration(outer.parent) && ts.isIdentifier(outer.parent.name)
            ? `\`${outer.parent.name.text}\``
            : "";
        const condition = `\`${node.condition.getText(source)}\``;
        const titles = call ? titlesFor(source, call, call.arguments[0], { summarise: true }) : [held];
        for (const title of titles)
          found.push({
            file,
            kind: `${whenTrue ?? whenFalse} by condition`,
            title,
            reason: whenTrue ? `when ${condition}` : `unless ${condition}`,
          });
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && X_FORMS.has(callee.text)) {
        found.push({ file, kind: callee.text, title: argText(source, node.arguments[0]), reason: "" });
      } else if (
        ts.isPropertyAccessExpression(callee) &&
        MODIFIERS.has(callee.name.text) &&
        isTestBase(callee.expression)
      ) {
        const modifier = callee.name.text;
        const base = callee.expression.getText(source);
        if (modifier === "skipIf" || modifier === "runIf") {
          // `it.skipIf(cond)("title", fn)`: the title is on the outer call.
          const outer = ts.isCallExpression(node.parent) && node.parent.expression === node ? node.parent : null;
          const reason = `${modifier === "skipIf" ? "skipped when" : "runs only when"} \`${node.arguments[0]?.getText(source) ?? ""}\``;
          for (const title of outer ? titlesFor(source, outer, outer.arguments[0]) : [""])
            found.push({ file, kind: `${base}.${modifier}`, title, reason });
        } else {
          const [first, second] = node.arguments;
          // A runtime `test.skip(condition, "message")` (Playwright) or a bare `test.skip()`.
          const runtime =
            !first ||
            !(
              ts.isStringLiteral(first) ||
              ts.isNoSubstitutionTemplateLiteral(first) ||
              ts.isIdentifier(first) ||
              ts.isTemplateExpression(first)
            ) ||
            (second && !ts.isFunctionLike(second) && !ts.isObjectLiteralExpression(second));
          if (runtime && (modifier === "skip" || modifier === "fixme")) {
            // No title of its own: the enclosing test's title tells two identical skips apart.
            const fn = enclosingFunction(node);
            found.push({
              file,
              kind: `${base}.${modifier} at run time`,
              title: enclosingTestTitle(source, node) || (fn ? `in ${fn.name}` : ""),
              reason: `${first ? `when \`${first.getText(source)}\`` : "always"}${second ? `: ${argText(source, second)}` : ""}`,
            });
          } else {
            for (const title of titlesFor(source, node, first))
              found.push({ file, kind: `${base}.${modifier}`, title, reason: "" });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

export function render(entries) {
  const lines = [
    "# Skipped / todo / fixme test inventory",
    "",
    "> **Generated file. Do not edit by hand.** `node scripts/ward-flow/skipped-tests-inventory.mjs` writes it;",
    "> `tests/ward-skipped-tests-inventory.test.ts` fails when it is out of date.",
    "",
    "Every `skip`, `skipIf`, `runIf`, `todo` and `fixme` call (and `xit`, `xtest`, `xdescribe`) on `it`, `test`",
    "or `describe` in `tests/`, found by parsing each file, so calls inside strings and comments are not counted.",
    "Conditional gates (`skipIf`, `runIf`) and Playwright runtime skips are included. Line numbers are left out",
    "because they move with unrelated edits: search the file for the title. A runtime skip has no title of its",
    "own, so its row names the test it sits in; a title passed through a helper names each call of that helper.",
    "Indirect registrations such as `(cond ? it.skip : it)(…)` are listed by condition. The reason column is the",
    "skip's own condition or message; read the comment above the call for the why.",
    "",
    `Total: ${entries.length}`,
    "",
    "| Location | Kind | Title | Condition or message |",
    "| --- | --- | --- | --- |",
  ];
  for (const e of entries) {
    lines.push(`| \`${e.file}\` | ${e.kind} | ${cell(e.title) || "-"} | ${cell(e.reason) || "-"} |`);
  }
  return `${lines.join("\n")}\n`;
}

export function collect(root = repoRoot) {
  const entries = [];
  for (const file of listTestFiles(root)) entries.push(...findSkips(file, readFileSync(path.join(root, file), "utf8")));
  return entries;
}

async function main() {
  const out = path.join(repoRoot, OUT);
  // Formatted with the repository's Prettier settings, so `npm run format` and this generator agree.
  const text = await prettier.format(render(collect()), { ...(await prettier.resolveConfig(out)), filepath: out });
  if (process.argv.includes("--check")) {
    const current = existsSync(out) ? readFileSync(out, "utf8") : "";
    if (current.replace(/\r\n/g, "\n") === text) {
      console.log(`skipped-tests inventory is current (${text.match(/^Total: (\d+)/m)[1]} entries).`);
      return;
    }
    console.error(`${OUT} is stale. Run: node scripts/ward-flow/skipped-tests-inventory.mjs`);
    process.exitCode = 1;
    return;
  }
  writeFileSync(out, text, "utf8");
  console.log(`wrote ${OUT} (${text.match(/^Total: (\d+)/m)[1]} entries).`);
}

// realpath: Node resolves the entry module through symlinks, so compare real paths or `--check` could skip main().
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (invokedDirectly) await main();
