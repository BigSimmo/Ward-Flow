#!/usr/bin/env node
/**
 * doc-facts: keep a few changeable facts in one generated place, and stop docs restating old ones.
 *
 * WHY. On 15 October 2026 the database moved to Supabase, but many docs still described Azure. A
 * doc cannot promise to stay current, so the facts most likely to move are read from source here,
 * written once to docs/FACTS.md, and quoted elsewhere through markers that this script rewrites:
 *
 *   The database is <!-- fact:database-provider -->Supabase<!-- /fact -->.
 *
 * Three checks, all in one pass:
 *   1. docs/FACTS.md matches what the source says now.              (fails; fix with --write)
 *   2. Every fact marker in a tracked Markdown file holds the current value.  (fails; --write)
 *   3. Retired terms from docs/retired-terms.json in maintained docs.  Existing mentions warn.
 *      With --base, a mention on a line the branch adds fails, so the backlog can only shrink.
 *
 * Usage:
 *   node scripts/doc-facts.mjs                      check, warnings for retired terms
 *   node scripts/doc-facts.mjs --base origin/main   also fail retired terms on lines added since base
 *   node scripts/doc-facts.mjs --write              regenerate docs/FACTS.md and every marker
 *   node scripts/doc-facts.mjs --verbose            list every retired-term line
 *   node scripts/doc-facts.mjs --json               machine-readable report
 *
 * A fact that cannot be read from source fails loudly: the extractor below is out of date, which
 * is itself a stale document. Fix the extractor rather than hard-coding the value.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripHistoricalSections } from "./check-docs-script-refs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FACTS_DOC = "docs/FACTS.md";
export const RETIRED_TERMS = "docs/retired-terms.json";
const BACKEND = "backend/ward-flow";

const read = (root, rel) => readFileSync(path.join(root, rel), "utf8");

const PROVIDER_NAMES = { supabase: "Supabase", postgres: "PostgreSQL", azure: "Azure" };
const AUTH_NAMES = { supabase: "Supabase Auth", entra: "Microsoft Entra ID" };

/** The provider chosen when no environment variable names one. */
export function defaultProvider(configSource, constName, envName) {
  const exported = configSource.match(new RegExp(`export const ${constName}\\s*=\\s*["'](\\w+)["']`, "u"));
  if (exported) return exported[1];
  // Fallback for the pre-constant shape: env.X || (legacy ? "a" : "b"), or env.X || "b".
  const line = configSource.match(new RegExp(`env\\.${envName}\\s*\\|\\|\\s*([^;\\n]+)`, "u"));
  const quoted = line ? [...line[1].matchAll(/["'](\w+)["']/gu)].map((m) => m[1]) : [];
  if (quoted.length === 0) throw new Error(`cannot read the default for ${envName}`);
  return quoted.at(-1);
}

function countPages(dir) {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countPages(path.join(dir, entry.name));
    else if (entry.name === "page.tsx") count += 1;
  }
  return count;
}

/** Backend environment variable names read by the shipped backend modules (tests excluded). */
export function backendEnvNames(sources) {
  const names = new Set();
  for (const source of sources)
    for (const match of source.matchAll(/\benv\??\.([A-Za-z_][A-Za-z0-9_]*)/gu))
      if (/^(WARD_|AZURE|Azure|SUPABASE|PORT$)/u.test(match[1])) names.add(match[1]);
  return [...names].sort();
}

/** Each fact: a name, the value read from source now, how it reads in prose, and where it came from. */
export function collectFacts(root = ROOT) {
  const config = read(root, `${BACKEND}/config.mjs`);
  const database = defaultProvider(config, "DEFAULT_DATABASE_PROVIDER", "WARD_DATABASE_PROVIDER");
  const auth = defaultProvider(config, "DEFAULT_AUTH_PROVIDER", "WARD_AUTH_PROVIDER");

  const migrations = readdirSync(path.join(root, BACKEND, "migrations"))
    .filter((name) => /^\d+-.+\.sql$/u.test(name))
    .sort();
  if (migrations.length === 0) throw new Error("no numbered migrations found");

  const decisions = [...read(root, "docs/ward-flow/decisions.md").matchAll(/^## D-(\d+)\./gmu)].map((m) => +m[1]);
  if (decisions.length === 0) throw new Error("no D-n headings found in decisions.md");
  const lastDecision = Math.max(...decisions);

  const backendSources = readdirSync(path.join(root, BACKEND))
    .filter((name) => name.endsWith(".mjs") && !name.includes(".test") && !name.includes("test-support"))
    .map((name) => read(root, `${BACKEND}/${name}`));
  const envNames = backendEnvNames(backendSources);

  const pkg = JSON.parse(read(root, "package.json"));

  return [
    {
      name: "database-provider",
      value: PROVIDER_NAMES[database] ?? database,
      about: "Database used when `WARD_DATABASE_PROVIDER` is not set",
      source: `${BACKEND}/config.mjs`,
    },
    {
      name: "auth-provider",
      value: AUTH_NAMES[auth] ?? auth,
      about: "Sign-in service used when `WARD_AUTH_PROVIDER` is not set",
      source: `${BACKEND}/config.mjs`,
    },
    {
      name: "latest-migration",
      value: migrations.at(-1).replace(/\.sql$/u, ""),
      about: "Newest shared-workspace database migration",
      source: `${BACKEND}/migrations/`,
    },
    {
      name: "migration-count",
      value: String(migrations.length),
      about: "Numbered database migrations",
      source: `${BACKEND}/migrations/`,
    },
    {
      name: "ward-route-count",
      value: String(countPages(path.join(root, "src/app/mockups/ward-flow"))),
      about: "`page.tsx` routes under `/mockups/ward-flow`",
      source: "src/app/mockups/ward-flow/",
    },
    {
      name: "app-route-count",
      value: String(countPages(path.join(root, "src/app"))),
      about: "All `page.tsx` routes, including sign-in and digest",
      source: "src/app/",
    },
    {
      name: "latest-decision",
      value: `D-${lastDecision}`,
      about: "Newest entry in the decision log",
      source: "docs/ward-flow/decisions.md",
    },
    {
      name: "next-decision",
      value: `D-${lastDecision + 1}`,
      about: "Number to use for the next decision",
      source: "docs/ward-flow/decisions.md",
    },
    {
      name: "node-engine",
      value: pkg.engines?.node ?? "unset",
      about: "Supported Node.js range",
      source: "package.json",
    },
    {
      name: "backend-env-vars",
      value: envNames.map((name) => `\`${name}\``).join(", "),
      list: envNames,
      about: "Environment variables the shared backend reads",
      source: `${BACKEND}/*.mjs`,
    },
  ];
}

const escapeCell = (text) => String(text).replace(/\|/gu, "\\|");

export function renderFactsDoc(facts, terms) {
  const lines = [
    "# Current facts",
    "",
    "<!-- Generated by scripts/doc-facts.mjs. Do not edit by hand: run `npm run docs:facts:write`. -->",
    "",
    "The values below are read from source on every run, so this page is current whenever CI is",
    "green. Quote a fact instead of restating it, and it updates itself when the source changes.",
    "",
    "| Fact | Value | Meaning | Read from |",
    "| --- | --- | --- | --- |",
    ...facts.map((f) => {
      const value = f.list ? `${f.list.length} names, [listed below](#${f.name})` : escapeCell(f.value);
      return `| \`${f.name}\` | ${value} | ${escapeCell(f.about)} | \`${f.source}\` |`;
    }),
    "",
    ...facts
      .filter((f) => f.list)
      .flatMap((f) => [`## ${f.name}`, "", `${f.about}:`, "", ...f.list.map((item) => `- \`${item}\``), ""]),
    "## Quoting a fact",
    "",
    "Write the marker pair with any value between them, then run `npm run docs:facts:write`:",
    "",
    "```md",
    "Ward Flow stores its shared workspace in <!-- fact:database-provider -->Supabase<!-- /fact -->.",
    "```",
    "",
    "`npm run docs:facts` (and CI) fails when a marker or this page disagrees with the source.",
    "",
    "## Retired terms",
    "",
    `Listed in [\`retired-terms.json\`](retired-terms.json). Existing mentions in maintained docs warn;`,
    "a pull request that adds a new one fails. Archives, dated records and logs are never scanned.",
    "",
    "| Term | Retired | Why | Instead |",
    "| --- | --- | --- | --- |",
    ...terms.map(
      (t) =>
        `| \`${escapeCell(t.id)}\` | ${t.since} | ${escapeCell(t.why)} | ${escapeCell(t.instead.replace(/<!--[^>]*-->/gu, (m) => `\`${m}\``))} |`,
    ),
    "",
  ];
  return lines.join("\n");
}

// One line only: a stray opening tag must never reach a closing tag further down the file.
const MARKER = /<!-- fact:([a-z0-9-]+) -->([^\n]*?)<!-- \/fact -->/gu;

/** Rewrite every fact marker to the current value. Unknown names are returned, never guessed. */
export function applyMarkers(text, factsByName) {
  const unknown = [];
  const stale = [];
  const updated = text.replace(MARKER, (whole, name, current) => {
    if (!factsByName.has(name)) {
      unknown.push(name);
      return whole;
    }
    const value = factsByName.get(name);
    if (current !== value) stale.push({ name, current, value });
    return `<!-- fact:${name} -->${value}<!-- /fact -->`;
  });
  return { updated, unknown, stale };
}

export function loadRetiredConfig(root = ROOT) {
  const config = JSON.parse(read(root, RETIRED_TERMS));
  return {
    terms: config.terms.map((t) => ({ ...t, regex: new RegExp(t.pattern, `${t.flags ?? ""}g`.replace(/g+/u, "g")) })),
    historicalFiles: new Set(config.historicalFiles ?? []),
    historicalPatterns: (config.historicalPathPatterns ?? []).map((p) => new RegExp(p, "u")),
  };
}

export function isHistoricalPath(file, config) {
  return config.historicalFiles.has(file) || config.historicalPatterns.some((re) => re.test(file));
}

/** Retired-term hits in one maintained doc, ignoring fenced history and generated fact values. */
export function findRetiredTerms(file, text, config) {
  let current;
  try {
    current = stripHistoricalSections(text);
  } catch {
    current = text; // a malformed fence is reported by docs:check-scripts; scan everything here
  }
  current = current.replace(MARKER, (whole) => " ".repeat(whole.length));
  const hits = [];
  current.split("\n").forEach((line, index) => {
    for (const term of config.terms) {
      term.regex.lastIndex = 0;
      const match = term.regex.exec(line);
      if (match) hits.push({ file, line: index + 1, term: term.id, text: match[0] });
    }
  });
  return hits;
}

/** Line numbers each Markdown file gains between base and HEAD (zero-context diff). */
export function addedLines(diffText) {
  const added = new Map();
  let file = null;
  for (const line of diffText.split("\n")) {
    const header = line.match(/^\+\+\+ (?:b\/)?(.+)$/u);
    if (header) {
      file = header[1] === "/dev/null" ? null : header[1];
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/u);
    if (hunk && file) {
      const start = +hunk[1];
      const count = hunk[2] === undefined ? 1 : +hunk[2];
      const set = added.get(file) ?? new Set();
      for (let n = start; n < start + count; n += 1) set.add(n);
      added.set(file, set);
    }
  }
  return added;
}

function trackedMarkdown(root) {
  return execFileSync("git", ["ls-files", "-z", "--", "*.md"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter((file) => file && existsSync(path.join(root, file)));
}

function prettierWrite(root, files) {
  const bin = path.join(root, "node_modules/prettier/bin/prettier.cjs");
  if (files.length === 0 || !existsSync(bin)) return;
  spawnSync(process.execPath, [bin, "--write", "--log-level", "warn", "--", ...files], { cwd: root, stdio: "inherit" });
}

/** @param {{ root?: string, write?: boolean, base?: string | null }} [options] */
export function run({ root = ROOT, write = false, base = null } = {}) {
  const facts = collectFacts(root);
  const factsByName = new Map(facts.map((f) => [f.name, f.value]));
  const retired = loadRetiredConfig(root);
  const errors = [];
  const warnings = [];
  const written = [];

  const expectedDoc = renderFactsDoc(facts, retired.terms);
  const factsPath = path.join(root, FACTS_DOC);
  const actualDoc = existsSync(factsPath) ? readFileSync(factsPath, "utf8") : null;
  // Compare ignoring Prettier's table padding, so formatting the file never reads as drift.
  const normalise = (text) => text.replace(/ {2,}/gu, " ").replace(/^\|[ |-]+\|$/gmu, "|---|");
  if (actualDoc === null || normalise(actualDoc) !== normalise(expectedDoc)) {
    if (write) {
      writeFileSync(factsPath, expectedDoc);
      written.push(FACTS_DOC);
    } else errors.push(`${FACTS_DOC} is out of date with the source.`);
  }

  let added = null;
  if (base) {
    const diff = execFileSync("git", ["diff", "-U0", "--no-color", `${base}...HEAD`, "--", "*.md"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    });
    added = addedLines(diff);
  }

  for (const file of trackedMarkdown(root)) {
    if (file === FACTS_DOC) continue;
    const text = readFileSync(path.join(root, file), "utf8");
    if (text.includes("<!-- fact:")) {
      const { updated, unknown, stale } = applyMarkers(text, factsByName);
      for (const name of unknown) errors.push(`${file}: unknown fact "${name}" (see ${FACTS_DOC}).`);
      if (stale.length > 0) {
        if (write) {
          writeFileSync(path.join(root, file), updated);
          written.push(file);
        } else
          for (const s of stale)
            errors.push(`${file}: fact "${s.name}" says "${s.current}", source says "${s.value}".`);
      }
    }
    if (isHistoricalPath(file, retired)) continue;
    for (const hit of findRetiredTerms(file, text, retired)) {
      const isNew = added?.get(file)?.has(hit.line) ?? false;
      (isNew ? errors : warnings).push({ ...hit, isNew });
    }
  }
  if (write) prettierWrite(root, written);
  return { facts, errors, warnings, written, retired };
}

function report(result, { json, verbose }) {
  if (json) {
    console.log(JSON.stringify({ ...result, retired: undefined }, null, 2));
    return;
  }
  const inCi = process.env.GITHUB_ACTIONS === "true";
  const termsById = new Map(result.retired.terms.map((t) => [t.id, t]));
  const describe = (hit) => {
    const term = termsById.get(hit.term);
    return `retired term "${hit.text}". ${term.why} ${term.instead}`;
  };
  const byFile = new Map();
  for (const hit of result.warnings) byFile.set(hit.file, (byFile.get(hit.file) ?? 0) + 1);
  if (inCi)
    for (const hit of result.warnings) console.log(`::warning file=${hit.file},line=${hit.line}::${describe(hit)}`);
  if (byFile.size > 0) {
    console.log(`Retired terms still mentioned in ${byFile.size} maintained doc(s) (warning only):`);
    for (const [file, count] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`  ${count}\t${file}`);
    if (verbose) for (const hit of result.warnings) console.log(`  ${hit.file}:${hit.line}\t${hit.text}`);
    else console.log("  (add --verbose for each line)");
  }
  for (const file of result.written) console.log(`updated ${file}`);
  const errors = result.errors.map((e) => (typeof e === "string" ? e : `${e.file}:${e.line}: new ${describe(e)}`));
  if (inCi)
    for (const e of result.errors)
      if (typeof e !== "string") console.log(`::error file=${e.file},line=${e.line}::${describe(e)}`);
  if (errors.length > 0) {
    console.error(`\ndoc facts check FAILED (${errors.length}):`);
    for (const e of errors) console.error(`  ${e}`);
    if (result.errors.some((e) => typeof e === "string"))
      console.error("\nFix facts with: npm run docs:facts:write   (rewrites docs/FACTS.md and every fact marker)");
    if (result.errors.some((e) => typeof e !== "string"))
      console.error(
        "Fix new retired terms by rewording, quoting a fact marker, or fencing deliberate history in docs-script-refs:historical-start/end markers.",
      );
    return;
  }
  console.log(`doc facts check passed: ${result.facts.length} facts current.`);
}

export function parseArgs(argv) {
  const options = { write: false, json: false, verbose: false, base: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--write") options.write = true;
    else if (argv[i] === "--json") options.json = true;
    else if (argv[i] === "--verbose") options.verbose = true;
    else if (argv[i] === "--base") options.base = argv[++i] ?? null;
    else throw new Error(`Unknown argument: ${argv[i]}. Usage: [--write] [--base <ref>] [--json] [--verbose]`);
  }
  if (options.base === null && process.env.WARD_BASE_SHA) options.base = process.env.WARD_BASE_SHA;
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  const result = run(options);
  report(result, options);
  process.exit(result.errors.length > 0 ? 1 : 0);
}
