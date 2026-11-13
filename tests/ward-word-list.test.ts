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

/** `skip`: files a rule does not read, such as the approved mock-up copies kept as drawn (D-91). */
type Banned = { id: string; pattern: RegExp; instead: string; skip?: RegExp };

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
  // D-198 (13 Nov 2026): a bed kept for an incoming patient is pulled, never "reserved".
  { id: "reserved bed", pattern: /\breserved bed\b/i, instead: "Pulled" },
  { id: "ready vacant", pattern: /\bready vacant\b/i, instead: "Ready" },
  // "Waitlist" as a noun or label, not only "the waitlist" (H-0847). Capitalised anywhere, or
  // lowercase next to a space; code values such as "waitlist" or `ward-waitlist-…` never count.
  {
    id: "the waitlist",
    pattern: /(?<![-_\w])Waitlists?(?![-_\w])|(?<=\s)waitlists?(?![-_\w])|(?<![-_\w])waitlists?(?=\s)/,
    instead: "the waiting list",
  },
  // Wording audit, 26 Oct 2026 (D-85 and plain words).
  { id: "beds held by blockers", pattern: /\bbeds held by blockers?\b/i, instead: "Discharges held up" },
  { id: "was held until", pattern: /\bwas held until\b/i, instead: "the pull time limit passed at" },
  { id: "not held", pattern: /^\s*not held\s*$/i, instead: "Not recorded" },
  { id: "involuntary-capable", pattern: /\binvoluntary-capable\b/i, instead: "Authorised hospital" },
  { id: "real-time ETA", pattern: /\breal-time ETA\b/i, instead: "Expected arrival (as recorded)" },
  { id: "live capacity telemetry", pattern: /\blive capacity telemetry\b/i, instead: "Ward capacity" },
  { id: "active statewide directive", pattern: /\bactive statewide directive\b/i, instead: "Current broadcast" },
  { id: "log in", pattern: /\blog in\b/i, instead: "Sign in" },
  { id: "log out", pattern: /\blog out\b/i, instead: "sign out" },
  // One word for each thing (DESIGN-SYSTEM §6; design audit 2, 5 Nov 2026). Josh's cards: "Secure
  // bed" is "Locked bed" everywhere (card 7); the drawer is Alerts on every desk.
  { id: "Stays and discharges", pattern: /\bStays and discharges\b/i, instead: "Bed board" },
  { id: "Raise a referral", pattern: /\bRaise a referral\b/i, instead: "New referral" },
  { id: "New patient", pattern: /\bNew patient\b/, instead: "Add patient" },
  { id: "mock numbers", pattern: /\bmock numbers?\b/i, instead: "synthetic numbers" },
  { id: "secure bed", pattern: /\bsecure beds?\b/i, instead: "Locked bed" },
  { id: "Open, close or hold", pattern: /\bOpen, close or hold\b/i, instead: "Open or close a bed" },
  { id: "due out", pattern: /\bdue out\b/i, instead: "Discharge due" },
  { id: "on Command", pattern: /\bon Command\b/, instead: "on Home" },
  {
    id: "Tasks, for Alerts",
    pattern: /\bTasks drawer\b|\bAlerts or Tasks\b|\bTasks and alerts\b|\bcalled Tasks\b|\bAlerts, Tasks\b/i,
    instead: "Alerts",
  },
  { id: "Journey, as a label", pattern: /^\s*Journey\s*$/, instead: "Movement" },
  { id: "bed pull expired", pattern: /\bbed pulls? expired\b/i, instead: "Pull expired, bed still pulled" },
  { id: "held-up releases", pattern: /\bheld-up releases?\b/i, instead: "held-up discharges" },
  { id: "blockers", pattern: /\bblockers\b/i, instead: "Held up" },
  { id: "Stand Down", pattern: /\bStand Down\b/, instead: "Stand down" },
  { id: "minutes for a long duration", pattern: /\b\d{3} minutes\b/, instead: "4h" },
  { id: "demo night", pattern: /\bdemo night\b/i, instead: "on the board" },
  // #1476 review (5 Nov 2026): the §6 "Nobody, not No one" rule, now kept by this test.
  // The ED board mock-up copies under ward-redesign/ stay as drawn (D-91), so this rule skips them.
  { id: "No one", pattern: /\bNo one\b/, instead: "Nobody", skip: /^src\/components\/ward-redesign\// },
  // D-192 (Josh, 13 Nov 2026): the ED wait step's label. Only the label: the steps themselves are
  // unchanged. The approved mock-up copies under ward-redesign/ stay as drawn (D-91).
  {
    id: "Suggested next step",
    pattern: /\bSuggested next step\b/,
    instead: "Next escalation step",
    skip: /^src\/components\/ward-redesign\//,
  },
  // Australian spelling.
  {
    id: "US spelling",
    pattern: /\b(?:stabiliz|utiliz|organiz|prioritiz|summariz|behavior|canceled|favorite)\w*/i,
    instead: "Australian spelling",
  },
];

/** Exact counts of banned phrases left in files other work owns (24 Oct and 5 Nov 2026). Lower only. */
const KNOWN_LEFTOVERS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  // Mock-up viewer copies (D-91): approved drawings, kept as drawn; never edited or moved from here.
  "src/app/mockups/ward-flow-redesign/_preview/build-notes.ts": { "Tasks, for Alerts": 1, "demo night": 1 },
  "src/app/mockups/ward-flow-redesign/_preview/screens.ts": { "Stays and discharges": 1 },
  "src/components/ward-redesign/pop-alerts/alerts-drawer.tsx": { "mock numbers": 2 },
  "src/components/ward-redesign/pop-menu/menu-sheets.tsx": { "Open, close or hold": 1 },
  "src/components/ward-redesign/pop-shortcuts/shortcuts-sheet.tsx": { "Tasks, for Alerts": 1 },
  "src/components/ward-redesign/pop-tour/tour-steps.ts": { "Raise a referral": 2, "due out": 2 },
  // "FSH Adult Secure bed 03": Secure inside a ward name, which §6 keeps.
  "src/components/ward-management/community/community-screen-drawer.tsx": { "secure bed": 1 },
  // A demo broadcast's own range ("90–120 minutes late"); restating it in hours trips the invented-figure guard.
  "src/components/ward-management/alerts/ward-broadcast-model.ts": { "minutes for a long duration": 1 },
  // The On-call footer's synthetic notice, which the design audit's "Do not do" list keeps as it is.
  "src/components/ward-management/on-call/on-call-screen.tsx": { "mock numbers": 1 },
  // A statistics claim naming the `averageWaitlistWaitMinutes` field, not a patient-facing label.
  "src/components/ward-management/statistics/statistics-claims-other-surfaces.ts": { "the waitlist": 2 },
  // Source evidence quoted word for word from ward-model.ts, not a screen label (H-0847, 27 Oct 2026).
  "src/components/ward-management/statistics/statistics-claims-shared.ts": {
    blockers: 1,
    "secure bed": 2,
    "the waitlist": 1,
  },
  // Source evidence quoted word for word from the record model, not a screen label.
  "src/components/ward-management/statistics/statistics-claims-statistics-screen.ts": { blockers: 1 },
  // "Waitlist" as a verb in a refusal, which the word list allows; another branch owns the file.
  "src/components/ward-management/ward-flow-referral-answer-events.ts": { "the waitlist": 1 },
  // D-198: the ED medical-deterioration safety line keeps its words until the clinical sitting rules on them.
  "src/components/ward-management/ed/ed-medical-placement-controls.tsx": { "reserved bed": 1 },
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

/**
 * Each banned pattern compiled once, with the global flag for counting. Building a fresh RegExp for
 * every text of every file made this walk the slowest part of the file and timed it out on hosted
 * CI at 30 s once the redesign mock-ups doubled the text it reads. The same patterns, the same
 * texts, the same counts: only the compiling moved out of the loop.
 */
const BANNED_COUNTERS = BANNED.map((banned) => ({
  banned,
  counter: new RegExp(banned.pattern.source, `${banned.pattern.flags}g`),
}));

function bannedCounts(): Map<string, Map<string, number>> {
  const found = new Map<string, Map<string, number>>();
  for (const path of sourceFiles(SOURCE_ROOT)) {
    const file = path.split("\\").join("/");
    for (const text of visibleText(path)) {
      const words = text.replace(/\s+/g, " ");
      for (const { banned, counter } of BANNED_COUNTERS) {
        // `match` with a global pattern resets `lastIndex` itself, so reusing one is safe.
        if (banned.skip?.test(file)) continue;
        const hits = words.match(counter)?.length ?? 0;
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

  // Parses every source file under src/, about 1,700 since the redesign mock-up copies arrived
  // (D-89, D-91). About 5 s alone, but it timed out at the 30 s default on hosted CI under load, so
  // it gets the same explicit allowance as the other whole-tree walks (architecture-boundaries).
  it("shows no banned phrase in visible text, except the exact known leftovers", { timeout: 90_000 }, () => {
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

/**
 * Clinical check pack E1 (Josh, 13 Nov 2026): the Criminal Law (Mental Impairment) Act 2023 is always
 * written in full, never shortened. Unlike the banned phrases above this reads every code line (not
 * only visible text), so no constant, label or key carries the short form either. Comments may still
 * explain the history. Moved here from `tests/ward-fix-D-wording-and-wait-step.test.ts` so the one
 * whole-tree wording scan stays in one file.
 */
describe("the Criminal Law (Mental Impairment) Act is never shortened (E1)", () => {
  it("names no CLMA, CLMI, CLMIA or CLMI Act on any code line in the ward tree", () => {
    const files = sourceFiles(join(SOURCE_ROOT, "components", "ward-management"));
    expect(files.length).toBeGreaterThan(200);
    const offenders = files.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((code, index) => ({ line: index + 1, code }))
        .filter(({ code }) => !/^\s*(?:\/\/|\/?\*|\{\s*\/\*)/.test(code))
        .filter(({ code }) => /\bCLM(?:A|I|IA)\b|CLMI Act/u.test(code))
        .map(({ line, code }) => `${file}:${line}: ${code.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
