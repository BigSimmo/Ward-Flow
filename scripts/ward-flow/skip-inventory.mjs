#!/usr/bin/env node
// Lists every skipped, to-do, fixme or conditional test site with its reason (M137, M91).
//   node scripts/ward-flow/skip-inventory.mjs           print the report (Markdown)
//   node scripts/ward-flow/skip-inventory.mjs --json    print the sites as JSON
//   node scripts/ward-flow/skip-inventory.mjs --check   exit 1 if a site has no reason or a test
//                                                       carries a @quarantine tag
// A reason is one of: a string argument after a runtime condition (Playwright
// `test.skip(cond, "why")`), the condition itself for skipIf/runIf, or a comment on the same line
// or within the three lines above. Sites written inside strings or comments are ignored.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const ROOTS = ["tests", "backend/ward-flow"];
const SKIP_DIRS = new Set(["node_modules", "dist", "test-results", "visual-baselines", ".next"]);
const TEST_FILE = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/u;

export function listTestFiles(root = repoRoot) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const path = join(dir, name);
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else if (TEST_FILE.test(name)) out.push(relative(root, path).split("\\").join("/"));
    }
  };
  for (const top of ROOTS) walk(join(root, top));
  return out.sort();
}

function regexCanStart(before) {
  let end = before.length;
  while (end > 0 && /\s/u.test(before[end - 1])) end -= 1;
  if (end === 0) return true;
  const trimmed = before.slice(Math.max(0, end - 12), end);
  const last = trimmed[trimmed.length - 1];
  if ("(,=:[!&|?{};+-*%<>~^".includes(last)) return true;
  return /\b(?:return|typeof|case|in|of|delete|void|throw|new|else|do|yield|await)$/u.test(trimmed);
}

/** Same-length copy of `source` with comments and string/template contents blanked. */
export function blankCommentsAndStrings(source) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < source.length) {
    const c = source[i];
    const n = source[i + 1];
    if (state === "code") {
      if (c === "/" && n === "/") state = "line";
      else if (c === "/" && n === "*") state = "block";
      else if (c === "'") state = "single";
      else if (c === '"') state = "double";
      else if (c === "`") state = "template";
      if (state === "line" || state === "block") {
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "/" && regexCanStart(out)) {
        // Regular-expression literal: blank its body so quotes inside it do not open a string.
        let j = i + 1;
        let inClass = false;
        while (j < source.length && source[j] !== "\n") {
          if (source[j] === "\\") j += 2;
          else if (source[j] === "[") {
            inClass = true;
            j += 1;
          } else if (source[j] === "]") {
            inClass = false;
            j += 1;
          } else if (source[j] === "/" && !inClass) break;
          else j += 1;
        }
        if (j < source.length && source[j] === "/") {
          out += `/${" ".repeat(j - i - 1)}/`;
          i = j + 1;
          continue;
        }
      }
      out += c;
      i += 1;
      continue;
    }
    if (state === "line") {
      if (c === "\n") {
        state = "code";
        out += "\n";
      } else out += " ";
      i += 1;
      continue;
    }
    if (state === "block") {
      if (c === "*" && n === "/") {
        state = "code";
        out += "  ";
        i += 2;
        continue;
      }
      out += c === "\n" ? "\n" : " ";
      i += 1;
      continue;
    }
    if (c === "\\") {
      out += n === "\n" ? " \n" : "  ";
      i += 2;
      continue;
    }
    if ((state === "single" && c === "'") || (state === "double" && c === '"') || (state === "template" && c === "`")) {
      state = "code";
      out += c;
      i += 1;
      continue;
    }
    out += c === "\n" ? "\n" : " ";
    i += 1;
  }
  return out;
}

const SITE =
  /\b(?:it|test|describe)(?:\.describe)?(?:\.(?:concurrent|sequential|serial|parallel|only))?\.(skip|skipIf|runIf|fixme|todo)\b/gu;

function callArguments(raw, blank, openIndex) {
  // openIndex points at "(". Returns the raw text between the parentheses and the top-level commas.
  let depth = 0;
  const commas = [];
  for (let i = openIndex; i < blank.length; i += 1) {
    const ch = blank[i];
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const parts = [];
        let start = openIndex + 1;
        for (const comma of [...commas, i]) {
          parts.push(raw.slice(start, comma).trim());
          start = comma + 1;
        }
        return parts.filter((part) => part !== "");
      }
    } else if (ch === "," && depth === 1) commas.push(i);
  }
  return [];
}

// A to-do or skip title that already says why it is parked counts as its reason.
const REASON_IN_TITLE =
  /\b(?:Josh|M\d+|defect|needs?|blocked|waits?|waiting|until|gap|retired|ruling|issue|PR\s*#?\d+|D-\d+|Q\d+)\b|#\d{2,}/iu;

const isStringLiteral = (text) => /^(?:"[^"]*"|'[^']*'|`[\s\S]*`)$/u.test(text.trim());
/** A title written as one string literal or several joined with `+`. */
const joinedLiteral = (text) => {
  const parts = text.split(/\s*\+\s*(?=["'`])/u);
  return parts.every((part) => isStringLiteral(part)) ? parts.map(unquote).join("") : null;
};
const unquote = (text) => text.trim().slice(1, -1).replace(/\s+/gu, " ").trim();

const SITE_LINE = /^(?:it|test|describe)(?:\.describe)?\.(?:todo|skip|fixme)\(/u;

function nearbyComment(lines, lineIndex) {
  const same = lines[lineIndex].match(/\/\/\s*(.+)$|\/\*\s*(.+?)\s*\*\//u);
  if (same) return (same[1] ?? same[2]).trim();
  // Look up to three lines above; a run of parked tests shares the comment that heads it.
  let budget = 3;
  for (let back = 1; budget > 0 && lineIndex - back >= 0; back += 1) {
    const text = lines[lineIndex - back].trim();
    if (/^(?:\/\/|\*|\/\*)/u.test(text)) {
      const body = text
        .replace(/^(?:\/\/+|\/\*+|\*+\/?)\s*/u, "")
        .replace(/\*\/$/u, "")
        .trim();
      if (body.length >= 8) return body;
      budget -= 1;
      continue;
    }
    if (SITE_LINE.test(text) || /^["'`].*["'`],?$|^\);?$/u.test(text)) continue;
    budget -= 1;
    if (text !== "" && !/^[)}\],;]*$/u.test(text)) break;
  }
  return null;
}

/** Every skip-like site in one file. */
export function skipSites(file, raw) {
  const blank = blankCommentsAndStrings(raw);
  const lines = raw.split("\n");
  const sites = [];
  let match;
  SITE.lastIndex = 0;
  while ((match = SITE.exec(blank)) !== null) {
    const kind = match[1];
    const line = blank.slice(0, match.index).split("\n").length;
    const after = blank.slice(SITE.lastIndex);
    const offset = after.search(/\S/u);
    const callOpen = offset >= 0 && after[offset] === "(" ? SITE.lastIndex + offset : -1;
    const args = callOpen >= 0 ? callArguments(raw, blank, callOpen) : [];
    let title = null;
    let reason = null;
    let source = null;
    if (kind === "skipIf" || kind === "runIf") {
      reason = `${kind}(${(args[0] ?? "").replace(/\s+/gu, " ")})`;
      source = "condition";
      // The titled call follows: `it.skipIf(cond)("title", fn)`.
      const closeText = blank.slice(callOpen);
      let depth = 0;
      let end = callOpen;
      for (let i = 0; i < closeText.length; i += 1) {
        if (closeText[i] === "(") depth += 1;
        else if (closeText[i] === ")") {
          depth -= 1;
          if (depth === 0) {
            end = callOpen + i + 1;
            break;
          }
        }
      }
      const second = blank.slice(end).search(/\S/u);
      if (second >= 0 && blank[end + second] === "(") {
        const inner = callArguments(raw, blank, end + second);
        if (inner[0] && isStringLiteral(inner[0])) title = unquote(inner[0]);
      }
    } else if (args.length > 0 && joinedLiteral(args[0]) !== null) {
      // Titled form: it.skip("title", fn), it.todo("title"), test.fixme("title", fn).
      title = joinedLiteral(args[0]);
    } else if (args.length >= 2 && isStringLiteral(args[1])) {
      // Runtime form: test.skip(condition, "reason").
      reason = unquote(args[1]);
      source = "argument";
    }
    if (reason === null && title !== null && (REASON_IN_TITLE.test(title) || /\([^)]{8,}\)$/u.test(title))) {
      reason = title;
      source = "title";
    }
    if (reason === null) {
      const comment = nearbyComment(lines, line - 1);
      if (comment) {
        reason = comment;
        source = "comment";
      }
    }
    if (callOpen < 0) {
      // A bare reference such as `(options.skip ? it.skip : it)` forwards a skip decided elsewhere
      // (the option form below); it is listed but carries no decision of its own.
      reason = reason ?? "forwards a skip option decided at the call site";
      source = source ?? "forwarder";
    }
    sites.push({ file, line, kind, title, reason, source, called: callOpen >= 0 });
  }
  // node:test and wrapper option form: test("title", { skip: condition }, fn).
  // Only option bags passed as a test's second argument, found by a flat pattern (no nesting).
  const option = /[{,]\s*(skip|todo):\s*([^,}\n]+)/gu;
  while ((match = option.exec(blank)) !== null) {
    const line = blank.slice(0, match.index).split("\n").length;
    // Only an option bag passed to a test call: the call opens on this line or up to three above.
    const window = lines.slice(Math.max(0, line - 4), line).join("\n");
    if (!/\b(?:test|it|describe)\(\s*(?:["'`]|$)/mu.test(window)) continue;
    const start = match.index + match[0].length - match[2].length;
    const condition = raw.slice(start, start + match[2].length).trim();
    if (/^(?:false|undefined|null)$/u.test(condition)) continue;
    const literal = /^(?:true|["'`].*)$/su.test(condition);
    let reason = literal && condition !== "true" ? condition : literal ? null : `${match[1]}: ${condition}`;
    let source = reason ? (literal ? "argument" : "condition") : null;
    if (reason === null) {
      const comment = nearbyComment(lines, line - 1);
      if (comment) {
        reason = comment;
        source = "comment";
      }
    }
    sites.push({ file, line, kind: `${match[1]}-option`, title: null, reason, source, called: true });
  }
  sites.sort((a, b) => a.line - b.line);
  return sites;
}

/** `@quarantine` used as a tag in real code (titles or tag options), not in prose. */
export function quarantineTags(file, raw) {
  const hits = [];
  const blank = blankCommentsAndStrings(raw);
  const pattern = /@quarantine\b/gu;
  let match;
  while ((match = pattern.exec(raw)) !== null) {
    const before = blank[match.index];
    // In real code the string's contents are blanked, so a tag inside a string literal shows as
    // a space here; check whether the string is a test title or tag, not a grep pattern.
    const lineStart = raw.lastIndexOf("\n", match.index) + 1;
    const lineEnd = raw.indexOf("\n", match.index);
    const lineText = raw.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    const isComment = /^\s*(?:\/\/|\*|\/\*)/u.test(lineText);
    // Judge the call shape on the blanked line, so a fixture written inside a string is not a use.
    const blankLine = blank.slice(lineStart, match.index);
    const isTagUse =
      /\b(?:test|it|describe)(?:\.describe)?(?:\.\w+)?\(\s*["'`]\s*$/u.test(blankLine) ||
      /tag:\s*(?:\[[^\]]*)?["'`]\s*$/u.test(blankLine);
    if (!isComment && before === " " && isTagUse) {
      hits.push({ file, line: raw.slice(0, match.index).split("\n").length, text: lineText.trim() });
    }
  }
  return hits;
}

export function collect(root = repoRoot) {
  const sites = [];
  const quarantine = [];
  for (const file of listTestFiles(root)) {
    const raw = readFileSync(join(root, file), "utf8");
    sites.push(...skipSites(file, raw));
    quarantine.push(...quarantineTags(file, raw));
  }
  return { sites, quarantine };
}

function report({ sites, quarantine }) {
  const lines = [
    "# Skipped and conditional tests",
    "",
    `Generated by \`node scripts/ward-flow/skip-inventory.mjs\`. ${sites.length} sites; ` +
      `${sites.filter((s) => s.reason === null).length} without a reason; ${quarantine.length} quarantine tags.`,
    "",
    "| File | Line | Kind | Test | Reason |",
    "| --- | --- | --- | --- | --- |",
  ];
  const cell = (text) => (text ?? "").replace(/\\/gu, "\\\\").replace(/\|/gu, "\\|").slice(0, 160);
  for (const s of sites) {
    lines.push(
      `| ${s.file} | ${s.line} | ${s.kind} | ${cell(s.title)} | ${s.reason ? cell(s.reason) : "**NO REASON**"} |`,
    );
  }
  return lines.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const data = collect();
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  } else if (process.argv.includes("--check")) {
    const missing = data.sites.filter((s) => s.reason === null);
    for (const s of missing) console.error(`${s.file}:${s.line} ${s.kind} has no reason`);
    for (const q of data.quarantine) console.error(`${q.file}:${q.line} carries a @quarantine tag`);
    if (missing.length > 0 || data.quarantine.length > 0) process.exit(1);
    console.log(`${data.sites.length} skip sites, all with a reason; no quarantine tags.`);
  } else {
    process.stdout.write(`${report(data)}\n`);
  }
}
