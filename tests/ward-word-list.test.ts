import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { GLOSSARY } from "@/components/ward-management/help/ward-help-content";
import { siteDirectory } from "@/components/ward-management/ward-sites";

/**
 * One word per idea on screen (wording audit, 24 Oct 2026).
 *
 * `docs/ward-flow/word-list.md` is the single list of the words Ward Flow uses. This file keeps the
 * screens to it in two ways:
 *
 * 1. Words the list says not to use must not appear in any visible text under `src/`. Text is read
 *    with the TypeScript parser (string literals, template text and JSX text), so comments and code
 *    names never count. Code names such as `HOLD_BED` or `ward-bed-hold.ts` stay as they are.
 * 2. Every Ward Flow word in the in-app Help glossary must also be on the word list, so the two never
 *    drift apart.
 *
 * `KNOWN_LEFTOVERS` is a ratchet: the exact count of each banned phrase still sitting in a file
 * another piece of work owns. The count is exact, so a new use fails and a fixed use also fails until
 * the line is lowered or removed. Never raise a number to make this pass.
 *
 * Reads source with `readFileSync`, so `npm run test:focused` cannot select it; it runs in the full
 * suite.
 */

type Banned = { id: string; pattern: RegExp; instead: string };

/** Each id must appear in the "Do not say" column of docs/ward-flow/word-list.md. */
const BANNED: readonly Banned[] = [
  // D-81: a bed kept for an incoming patient is pulled. Held is only for leave or away beds.
  { id: "bed hold expired", pattern: /\bbed[- ]hold expired\b/i, instead: "Pull expired" },
  { id: "bed hold released", pattern: /\bbed[- ]hold released\b/i, instead: "Pulled bed released" },
  { id: "hold the bed", pattern: /\bhold the bed\b/i, instead: "Pull the bed" },
  { id: "hold time limit", pattern: /\bhold time limit\b/i, instead: "Pull time limit" },
  { id: "hold on the bed", pattern: /\bhold on the bed\b/i, instead: "the pull on the bed" },
  { id: "needs the bed held", pattern: /\bneeds the bed held\b/i, instead: "Needs the bed pulled" },
  {
    id: "held bed released after transport",
    pattern: /\bheld bed released after\b/i,
    instead: "Pulled bed released after ...",
  },
  { id: "reserved time", pattern: /\breserved time\b/i, instead: "Pull time limit" },
  { id: "ready vacant", pattern: /\bready vacant\b/i, instead: "Ready" },
  // "Waitlist" as a noun or label, not only "the waitlist" (H-0847). Capitalised anywhere, or
  // lowercase next to a space; code values such as "waitlist" or `ward-waitlist-…` never count.
  {
    id: "the waitlist",
    pattern: /(?<![-_\w])Waitlists?(?![-_\w])|(?<=\s)waitlists?(?![-_\w])|(?<![-_\w])waitlists?(?=\s)/,
    instead: "the waiting list",
  },
  // Wording audit, 26 Oct 2026 (D-85 and plain words).
  { id: "beds held by blockers", pattern: /\bbeds held by blockers?\b/i, instead: "Beds held up by a blocker" },
  { id: "was held until", pattern: /\bwas held until\b/i, instead: "the pull time limit passed at" },
  { id: "not held", pattern: /^\s*not held\s*$/i, instead: "Not recorded" },
  { id: "involuntary-capable", pattern: /\binvoluntary-capable\b/i, instead: "Authorised hospital" },
  { id: "real-time ETA", pattern: /\breal-time ETA\b/i, instead: "Expected arrival (as recorded)" },
  { id: "live capacity telemetry", pattern: /\blive capacity telemetry\b/i, instead: "Ward capacity" },
  { id: "active statewide directive", pattern: /\bactive statewide directive\b/i, instead: "Current broadcast" },
  { id: "log in", pattern: /\blog in\b/i, instead: "Sign in" },
  { id: "log out", pattern: /\blog out\b/i, instead: "sign out" },
  // Australian spelling.
  {
    id: "US spelling",
    pattern: /\b(?:stabiliz|utiliz|organiz|prioritiz|summariz|behavior|canceled|favorite)\w*/i,
    instead: "Australian spelling",
  },
];

/** Exact counts of banned phrases left in files other work owns on 24 Oct 2026. Lower only. */
const KNOWN_LEFTOVERS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  // A statistics claim naming the `averageWaitlistWaitMinutes` field, not a patient-facing label.
  "src/components/ward-management/statistics/statistics-claims-other-surfaces.ts": { "the waitlist": 2 },
  // Source evidence quoted word for word from ward-model.ts, not a screen label (H-0847, 27 Oct 2026).
  "src/components/ward-management/statistics/statistics-claims-shared.ts": { "the waitlist": 1 },
  // "Waitlist" as a verb in a refusal, which the word list allows; another branch owns the file.
  "src/components/ward-management/ward-flow-referral-answer-events.ts": { "the waitlist": 1 },
  // Help search input data, never shown: "favorite" is a word people type, read as "favourite" (P9).
  "src/components/ward-management/help/ward-help-synonyms.ts": { "US spelling": 1 },
};

const SOURCE_ROOT = "src";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** The text a person could read: string literals, template text and JSX text. Never comments. */
function visibleText(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    false,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const texts: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) {
      texts.push(node.text);
    } else if (ts.isTemplateExpression(node)) {
      texts.push([node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" … "));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return texts;
}

function bannedCounts(): Map<string, Map<string, number>> {
  const found = new Map<string, Map<string, number>>();
  for (const path of sourceFiles(SOURCE_ROOT)) {
    const file = path.split("\\").join("/");
    for (const text of visibleText(path)) {
      const words = text.replace(/\s+/g, " ");
      for (const banned of BANNED) {
        const hits = words.match(new RegExp(banned.pattern.source, `${banned.pattern.flags}g`))?.length ?? 0;
        if (hits === 0) continue;
        const perFile = found.get(file) ?? new Map<string, number>();
        perFile.set(banned.id, (perFile.get(banned.id) ?? 0) + hits);
        found.set(file, perFile);
      }
    }
  }
  return found;
}

const wordList = readFileSync("docs/ward-flow/word-list.md", "utf8");

describe("one word per idea on screen (docs/ward-flow/word-list.md)", () => {
  it("lists every banned phrase, and what to say instead, on the word list", () => {
    for (const banned of BANNED) {
      expect(wordList.toLowerCase(), `word-list.md must name "${banned.id}" as a word not to use`).toContain(
        banned.id.toLowerCase(),
      );
      expect(wordList, `word-list.md must give "${banned.instead}" for "${banned.id}"`).toContain(banned.instead);
    }
  });

  it("finds the parser works: a known word on screen is seen", () => {
    // Positive control: if text reading broke, every banned-phrase check below would pass vacuously.
    const texts = visibleText("src/components/ward-management/alerts/alerts-model.ts");
    expect(texts).toContain("Pull expired");
  });

  it("shows no banned phrase in visible text, except the exact known leftovers", () => {
    const found = bannedCounts();
    const actual: Record<string, Record<string, number>> = {};
    for (const [file, perFile] of [...found].toSorted(([a], [b]) => a.localeCompare(b))) {
      actual[file] = Object.fromEntries([...perFile].toSorted(([a], [b]) => a.localeCompare(b)));
    }
    const expected: Record<string, Record<string, number>> = {};
    for (const file of Object.keys(KNOWN_LEFTOVERS).toSorted((a, b) => a.localeCompare(b))) {
      expected[file] = { ...KNOWN_LEFTOVERS[file] };
    }
    expect(
      actual,
      "A banned phrase appeared, or a known leftover was fixed. Use the word list's wording; if you " +
        "fixed a leftover, lower or remove its KNOWN_LEFTOVERS line.",
    ).toEqual(expected);
  });

  it("has every Ward Flow word in the Help glossary on the word list", () => {
    const siteCodes = new Set(siteDirectory.map((site) => site.code));
    const missing = GLOSSARY.filter((entry) => !siteCodes.has(entry.term))
      .map((entry) => entry.term)
      .filter((term) => !wordList.includes(`**${term}**`));
    expect(missing, "add these Help glossary words to docs/ward-flow/word-list.md in bold").toEqual([]);
  });
});
