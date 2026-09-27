#!/usr/bin/env node
// Static, read-only check of a Ward Flow drawing against the owner's written rules.
// Usage: node scripts/ward-flow/check-drawing-rules.mjs <drawing.html> [...]
// Rules and sources: docs/ward-flow/plans/2026-09-16-drawings-new-look-with-rules.md, Global Constraints.
// It reads copy from text, from title/aria-label/placeholder/alt/value attributes, and from string
// literals inside scripts, because these drawings build much of their copy with JavaScript.
// It cannot judge names, reconciliation or looks: those stay with a person.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

export const SHELL_EXEMPT = new Set([
  "sign-in-third-edition.html",
  "design-system-third-edition.html",
  "CONTACT-SHEET.html",
  "ward-flow-digest.html",
]);
// Must equal the engine's registered set of selectable legal form codes —
// src/components/ward-management/ward-legal-forms.ts:38 (SELECTABLE_LEGAL_FORMS, {code, kind}[]).
// Copied here as bare codes because this file is import-free (a .mjs script must not depend on
// the TypeScript source tree), so the two lists are kept in step by hand.
export const SELECTABLE_LEGAL_FORMS = ["1A", "3B", "3D", "4A", "4C"];
export const ACTIVITY_LINE = "Invented figures, reconciled with each other, as at";
export const RAIL_NOTE_TITLE = "Every ward state, movement, referral, clock and figure on this screen is invented.";
export const PROTOTYPE_TOOLTIP =
  "Every figure and name on this screen is invented. Not a medical device and not clinical decision support.";
// Selectors allowed a bar: the three brass "you are here" places only. Filled in Task 2 Step 5.
export const EDGE_BAR_ALLOWED = [];

const spaces = (s) => s.replace(/[^\n]/g, " ");

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, spaces).replace(/\/\*[\s\S]*?\*\//g, spaces);
}

function keepStringLiterals(code) {
  let out = "";
  let i = 0;
  let q = null;
  while (i < code.length) {
    const c = code[i];
    if (q) {
      if (c === "\\" && i + 1 < code.length) {
        out += code[i + 1] === "\n" ? " \n" : "  ";
        i += 2;
        continue;
      }
      if (c === q) {
        q = null;
        out += " ";
        i++;
        continue;
      }
      if (q === "`" && c === "$" && code[i + 1] === "{") {
        let depth = 0;
        while (i < code.length) {
          const d = code[i];
          if (d === "{") depth++;
          if (d === "}" && --depth === 0) {
            out += " ";
            i++;
            break;
          }
          out += d === "\n" ? "\n" : " ";
          i++;
        }
        continue;
      }
      out += c;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      q = c;
      out += " ";
      i++;
      continue;
    }
    if (c === "/" && code[i + 1] === "/") {
      while (i < code.length && code[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    out += c === "\n" ? "\n" : " ";
    i++;
  }
  return out;
}

function blankTagsKeepCopyAttributes(s) {
  return s.replace(/<[^>]*>/g, (tag) => {
    let out = spaces(tag);
    for (const m of tag.matchAll(/\b(?:title|aria-label|placeholder|alt|value)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const val = m[1] ?? m[2];
      const start = m.index + m[0].indexOf(val);
      out = out.slice(0, start) + val + out.slice(start + val.length);
    }
    return out;
  });
}

// Copy the reader sees: text, copy attributes and script string literals, positions preserved.
export function copyText(html) {
  let s = stripComments(html);
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, spaces);
  s = s.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (whole, body) => {
    const open = whole.slice(0, whole.indexOf(">") + 1);
    return spaces(open) + keepStringLiterals(body) + spaces("</script>");
  });
  return blankTagsKeepCopyAttributes(s);
}

// Copy written directly in the markup only (scripts and styles blanked), with entities blanked.
function markupText(html) {
  let s = stripComments(html);
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, spaces).replace(/<script\b[\s\S]*?<\/script>/gi, spaces);
  s = blankTagsKeepCopyAttributes(s);
  return s.replace(/&(?!mdash;|ndash;|rarr;|larr;)[a-zA-Z0-9#]+;/g, spaces);
}

function styleOnly(html) {
  const s = stripComments(html);
  let out = spaces(s);
  for (const m of s.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const start = m.index + m[0].indexOf(m[1]);
    out = out.slice(0, start) + m[1] + out.slice(start + m[1].length);
  }
  return out;
}

const lineAt = (text, index) => text.slice(0, index).split("\n").length;

function scan(text, re, rule, message) {
  return [...text.matchAll(re)].map((m) => ({
    rule,
    line: lineAt(text, m.index),
    excerpt: m[0].trim().slice(0, 80),
    message,
  }));
}

function selectorAt(css, index) {
  const open = css.lastIndexOf("{", index);
  const prevClose = css.lastIndexOf("}", open);
  return css.slice(prevClose + 1, open).trim();
}

/**
 * @param {string} html
 * @param {string} fileName
 * @returns {{rule: string, line: number, excerpt: string, message: string}[]}
 */
export function checkDrawing(html, fileName) {
  if (!/<(?:body|main|nav)\b/i.test(html)) {
    return [{ rule: "R0", line: 1, excerpt: fileName, message: "Not a drawing: no body, main or nav element" }];
  }
  const copy = copyText(html);
  const markup = markupText(html);
  const css = styleOnly(html);
  const code = stripComments(html);
  const f = [];

  f.push(...scan(copy, /(?<![A-Za-z])[Rr]eleas(?:e|ed|es|ing)\b/g, "R1", 'The third bed stage is "discharged", never "released" (owner, 30 August 2026)'));
  f.push(...scan(copy, /QA 100\/100|PERFECTED|\breal[- ]time\b|(?<![-\w])live\b/gi, "R2", "No liveness or self-graded claims on invented figures (owner, 9 to 10 September 2026)"));
  f.push(...scan(copy, /\bnot invented\b/gi, "R3", "Never the negated form of the disclosure"));
  f.push(...scan(copy, /(?:\(0[2-9]\)|\b0[2-9])\s?\d{4}\s?\d{4}\b|\b(?:direct|tel|phone|ph)\.?:?\s*\d{4}\s?\d{4}\b|\bpager\s*#?\s*\d+|\bext\.?\s*\d{3,}\b|\bspeed dial\b/gi, "R4", "No phone, pager or extension numbers. Use ext 01 placeholders"));
  f.push(...scan(copy, /\bAHPRA\s+[A-Z]{3}\d+|\b[A-Z]{3}\d{8,}\b|\bstaff id\s*#?\s*\d+|#[A-Z]{2,}-\d+|\bDOB\b/gi, "R5", "No registration numbers, staff IDs, invented record numbers or dates of birth"));
  f.push(...scan(copy, /\bDr\.?\s+[A-Z]/g, "R6", "Clinicians are a role, never a name"));
  f.push(...scan(code, /\balert\s*\(/g, "R7", "No alert(). An unwired control says: Not wired in this prototype."));
  for (const m of copy.matchAll(/\bForm\s+(\d{1,2}[A-Z])\b/g)) {
    if (!SELECTABLE_LEGAL_FORMS.includes(m[1])) {
      f.push({ rule: "R8", line: lineAt(copy, m.index), excerpt: m[0], message: `Form ${m[1]} is not in the engine's form set (${SELECTABLE_LEGAL_FORMS.join(", ")})` });
    }
  }
  f.push(...scan(markup, /[;—–→←]|&mdash;|&ndash;|&rarr;|&larr;/g, "R9", "No semicolons, dashes or arrows in copy. A middle dot separates facts"));

  const name = basename(fileName);
  if (!SHELL_EXEMPT.has(name)) {
    const required = [
      [ACTIVITY_LINE, "the Activity line"],
      [RAIL_NOTE_TITLE, "the rail foot disclosure"],
      [PROTOTYPE_TOOLTIP, "the prototype mark tooltip"],
      ['id="railCheck"', "the reconciliation line"],
      ['id="rail"', "the shared rail"],
    ];
    for (const [needle, what] of required) {
      if (!html.includes(needle)) f.push({ rule: "R10", line: 1, excerpt: needle.slice(0, 80), message: `Missing ${what}` });
    }
  }
  if (name === "sign-in-third-edition.html") {
    f.push(...scan(code, /<(?:input|select|textarea)\b/gi, "R11", "Sign in contains no input element of any kind"));
    f.push(...scan(copy, /\bsigned in\b/gi, "R11", "Nothing on Sign in may claim a session exists"));
  }
  for (const m of css.matchAll(/font(?:-size)?\s*:[^;{}]*?(\d+(?:\.\d+)?)px/g)) {
    if (Number(m[1]) < 12) f.push({ rule: "R12", line: lineAt(css, m.index), excerpt: m[0].slice(0, 80), message: "Nothing below 12px" });
  }
  for (const m of css.matchAll(/border-(?:left|top|right|bottom)(?:-width)?\s*:\s*(?:[2-9]|\d{2,})px|box-shadow\s*:\s*inset\s+-?[2-9]px/g)) {
    const selector = selectorAt(css, m.index);
    if (!EDGE_BAR_ALLOWED.includes(selector)) {
      f.push({ rule: "R13", line: lineAt(css, m.index), excerpt: `${selector} { ${m[0]} }`.slice(0, 80), message: "No coloured bar along an edge, no top highlight (owner, 9 September 2026)" });
    }
  }
  return f;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node scripts/ward-flow/check-drawing-rules.mjs <drawing.html> [...]");
    process.exit(2);
  }
  let total = 0;
  for (const file of files) {
    const findings = checkDrawing(readFileSync(file, "utf8"), file);
    total += findings.length;
    console.log(`${basename(file)}: ${findings.length === 0 ? "clean" : `${findings.length} finding(s)`}`);
    for (const x of findings) console.log(`  ${x.rule} line ${x.line}: ${x.excerpt}  (${x.message})`);
  }
  console.log(`checked ${files.length} file(s), ${total} finding(s)`);
  process.exit(total === 0 ? 0 : 1);
}
