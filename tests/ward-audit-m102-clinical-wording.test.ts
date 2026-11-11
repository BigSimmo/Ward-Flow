// M102 (master audit list, 10 Nov 2026): clinical wording.
//
// `docs/ward-flow/word-list.md` is the live word list and `tests/ward-word-list.test.ts` enforces its
// "Do not say" column on screen text. That test checks one way only: every phrase it bans is on the
// list. This file checks the other two things M102 asks for, without changing a single screen word:
//
// 1. Every "Do not say" phrase on the list is enforced by a pattern in the word-list test, or sits in
//    UNENFORCED below with the reason it cannot be a plain text match. A new "Do not say" row with no
//    pattern and no reason fails here.
// 2. Every abbreviation the screens show is spelt out in the Help glossary, or sits in NOT_GLOSSED
//    below. NOT_GLOSSED is a ratchet for Josh to rule on: adding a clinical abbreviation's meaning is a
//    wording decision, so this test reports the gap and never writes a definition.
//
// Reads source with `readFileSync`, so `npm run test:focused` cannot select it. Run it by name.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { GLOSSARY } from "@/components/ward-management/help/ward-help-content";

const WORD_LIST = readFileSync("docs/ward-flow/word-list.md", "utf8");
const WORD_LIST_TEST = "tests/ward-word-list.test.ts";

/** Each "Do not say" cell, split at semicolons, with notes in brackets and quote marks taken off. */
function doNotSayPhrases(): string[] {
  const phrases: string[] = [];
  let column = -1;
  for (const line of WORD_LIST.split("\n")) {
    if (!line.startsWith("|")) {
      column = -1;
      continue;
    }
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
    if (cells.includes("Do not say")) {
      column = cells.indexOf("Do not say");
      continue;
    }
    if (column < 0 || /^[-\s|]+$/.test(line) || !cells[column]) continue;
    for (const part of cells[column]!.split(";")) {
      const phrase = part
        .replace(/\([^)]*\)/g, "")
        .replace(/["“”]/g, "")
        .trim();
      if (phrase) phrases.push(phrase);
    }
  }
  return phrases;
}

/** The `pattern:` regular expressions of the word-list test's BANNED table, read with the parser. */
function bannedPatterns(): RegExp[] {
  const source = ts.createSourceFile(WORD_LIST_TEST, readFileSync(WORD_LIST_TEST, "utf8"), ts.ScriptTarget.Latest);
  const patterns: RegExp[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "pattern" &&
      ts.isRegularExpressionLiteral(node.initializer)
    ) {
      const literal = node.initializer.text;
      const end = literal.lastIndexOf("/");
      patterns.push(new RegExp(literal.slice(1, end), literal.slice(end + 1)));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return patterns;
}

/**
 * "Do not say" phrases the word-list test does not match, each with why. Exact: a phrase that gains a
 * pattern must come off, and a new unmatched phrase must be added with its reason (or given a pattern
 * in the word-list test). Reported to Josh as M102 mismatches on 10 Nov 2026.
 */
const UNENFORCED: Readonly<Record<string, string>> = {
  // Words that are right in one sense and wrong in another: plain text cannot tell them apart.
  "bed held, held bed or hold for an incoming patient":
    "Held bed is the right word for a leave bed (D-85); only the incoming-patient sense is wrong.",
  "Inbound as a bed status": "Inbound is a fine word elsewhere; only its use as a bed state is wrong.",
  "pulled, for a leave bed": "Pulled is right for an incoming patient's bed; only the leave-bed sense is wrong.",
  journey: "Lower-case journey in running text. Only the bare label is enforced ('Journey, as a label').",
  "rejected, refused": "Wrong only for a ward's answer; a patient can refuse, and declines keep their reasons.",
  "held , queued": "Held is right for a leave bed (D-85), and queued is also a code value.",
  barrier: "Discharge barriers keep the word on Discharges; only some uses are wrong.",
  "Release bed": "Wrong only for a pulled bed.",
  "Review the board before trying again alone": "Wrong only when nothing follows it; needs the whole message (M101).",
  // Rows whose words describe the banned use rather than quote it; the pattern matches the quoted forms.
  "Tasks, for Alerts": "Described use; the pattern matches the quoted forms (Tasks drawer, Alerts or Tasks).",
  "Journey, as a label": "Described use; the pattern matches a label that is only the word Journey.",
  "minutes for a long duration": "Described use; the pattern matches three-digit minute counts such as 240 minutes.",
  // No pattern yet. Each is a candidate for a new BANNED line once Josh agrees (reported 10 Nov 2026).
  "failed to persist, error saving": "No pattern in the word-list test yet.",
  "resubmit, reload the page": "No pattern yet; reload also appears in correct recovery steps.",
  "review the workflow requirements": "No pattern in the word-list test yet.",
  "Add a patient": "No pattern yet; the 'New patient' line covers only that phrase.",
  dossier: "No pattern in the word-list test yet.",
  Digest: "Banned only for an error's reference; Handover's Digest tab and sheet use the word on purpose.",
};

describe("M102: every 'Do not say' phrase is enforced or has a reason", () => {
  const phrases = doNotSayPhrases();
  const patterns = bannedPatterns();

  it("reads the word list and the word-list test's patterns", () => {
    expect(phrases.length).toBeGreaterThan(30);
    expect(patterns.length).toBeGreaterThan(30);
  });

  it("finds a pattern for each phrase, or a recorded reason", () => {
    const unmatched = phrases.filter((phrase) => !patterns.some((pattern) => pattern.test(phrase)));
    const unexplained = unmatched.filter((phrase) => !(phrase in UNENFORCED));
    expect(unexplained, "give these a pattern in tests/ward-word-list.test.ts, or a reason in UNENFORCED").toEqual([]);
    const stale = Object.keys(UNENFORCED).filter((phrase) => !unmatched.includes(phrase));
    expect(stale, "these now have a pattern or left the list: take them out of UNENFORCED").toEqual([]);
  });
});

/** Upper-case words on screen that are not abbreviations: shouted labels, units and file kinds. */
const NOT_ABBREVIATIONS = new Set([
  "ACTION",
  "NEXT",
  "NOT",
  "NOW",
  "REAL",
  "RECORD",
  "REVIEW",
  "SAMPLE",
  "KB",
  "PDF",
  "TV",
  "WA",
  "MP",
  "SD",
]);

/**
 * Abbreviations shown on screen with no Help glossary entry. The 18 found on 10 Nov 2026 were glossed
 * the same day (audit M102); a new abbreviation on screen must be glossed or added here for Josh.
 */
const NOT_GLOSSED: readonly string[] = [];

function screenFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return /mockups|ward-redesign/.test(path) ? [] : screenFiles(path);
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [path] : [];
  });
}

/** Upper-case words in JSX text, the words a person reads on a screen. */
function screenAbbreviations(): Set<string> {
  const found = new Set<string>();
  for (const path of [...screenFiles("src/components/ward-management"), ...screenFiles("src/app")]) {
    const source = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.TSX,
    );
    const visit = (node: ts.Node): void => {
      if (ts.isJsxText(node)) for (const match of node.text.matchAll(/\b([A-Z]{2,6})s?\b/g)) found.add(match[1]!);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

describe("M102: every on-screen abbreviation is in the Help glossary", () => {
  const glossed = new Set(GLOSSARY.map((entry) => entry.term.split(" ")[0]!));
  const onScreen = screenAbbreviations();

  it("sees abbreviations it already knows are glossed (positive control)", () => {
    for (const known of ["ED", "UMRN", "AWST", "CTO"]) expect(onScreen.has(known), known).toBe(true);
  });

  it("glosses each one, or lists it for Josh in NOT_GLOSSED", () => {
    const missing = [...onScreen]
      .filter((word) => !glossed.has(word) && !NOT_ABBREVIATIONS.has(word))
      .toSorted((a, b) => a.localeCompare(b));
    expect(missing, "spell these out in the Help glossary, or list them in NOT_GLOSSED for Josh").toEqual(
      [...NOT_GLOSSED].toSorted((a, b) => a.localeCompare(b)),
    );
  });
});
