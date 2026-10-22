import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import todo from "./ward-invented-figures-todo.json";

/**
 * NO INVENTED FIGURES ON A WARD FLOW SCREEN (Josh, overnight plan item 2, 26 Sept 2026).
 *
 * Refuses, in every production file under `src/components/ward-management/**`:
 *   1. the word "breach" (breaches, breached, breaching) in any text a screen can show;
 *   2. a typed hour window in shown text ("24h", "4-hour", "Within 1 hour", ">24h");
 *   3. a typed percentage in shown text ("100% Rostered Capacity", "90.0% Benchmark Target");
 *   4. a typed hour or minute limit declared as a constant (`const X_MINUTES = 480`).
 *
 * Why: the 26 Sept invented-figures sweep and the classification of this guard's first run found
 * invented figures typed into screens with no named source, several called a "breach" as if
 * statutory. Legal times come from the typed form under the "Not legally checked" notice.
 *
 * HOW IT RATCHETS. `ward-invented-figures-todo.json` lists every offender still on screen, one line
 * each with its owner. A hit not on that list fails (nothing new may appear); a list entry that no
 * longer matches any hit fails too (remove the line when the figure goes), so the list only shrinks.
 * "Breach" may never be on the list: Josh ruled it comes out everywhere. The list is a to-do list,
 * not an approval: no entry is ever added to make this pass.
 *
 * WHAT IS NOT A HIT. Only patterns that are not figure claims, each described by a precise rule with
 * its reason (EXCLUSIONS below), and only what Josh ruled on (RULED_ON). Classification of every
 * first-run hit: ward-flow-logs/drafts/invented-figures-guard-classification-2026-09-26.md.
 */

const WARD_DIR = resolve(process.cwd(), "src/components/ward-management");

/**
 * The list can never grow past this. Lower it when entries go; never raise it.
 * Raised once, 9 to 12 (v10 build pass 2, 10 Oct 2026, at the build coordinator's instruction): the
 * v10 mockups introduced three invented windows (tier targets, bed-count freshness, stale downtime
 * pack) that are listed as to-do, the tier targets marked pending clinical sign-off.
 * Lowered to 9 (15 Oct 2026): the bed-count freshness and stale-pack windows moved into
 * `ward-clinical-values.ts` as synthetic values with "No decision recorded" as their source.
 */
const MAX_TODO = 9;

/** Files Josh ruled on (rule 4 only), relative to WARD_DIR, and the ruling. */
const RULED_ON: ReadonlyArray<{ file: string; name: RegExp; ruling: string }> = [
  {
    file: "ward-model.ts",
    name: /^MORNING_ROLLUP_TIME(?:_RANGE)?_MINUTES$/,
    ruling: "D-17 (25 Sept): the 09:30 roll-up, adjustable 08:00 to 11:00, is Josh's own default.",
  },
  {
    file: "ward-model.ts",
    name: /^(?:ED_ACCESS_TARGET_MINUTES|PULL_HOLD_MINUTES|EXTRA_TRAVEL_HOLD_MINUTES|ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS)$/,
    ruling:
      "Owner-sourced, recorded in tests/ward-legal-figure-guard.test.ts MODEL_CONSTANT_PROVENANCE: ED access " +
      "target (22 Aug), pull hold (answer 35, 17 Sept), extra-travel hold (D-72, 21 Oct), ED medical " +
      "bed-release threshold (FD-19, 30 Aug).",
  },
  {
    file: "ward-operational-defaults.ts",
    name: /./,
    ruling:
      "The named-defaults module (Remove invented data, Branch B): operational times labelled on screen as " +
      "Josh's defaults, not legal limits (sweep question 1, recommended answer taken overnight 26 Sept). " +
      "Its shown text is still scanned; only its declared constants are waived.",
  },
];

/**
 * Files whose shown hour periods Josh ruled on (rule 2 only), relative to WARD_DIR. Empty: the one
 * entry, the D-29 Act period demo table, was removed with the demo on 20 Oct 2026 (D-70).
 */
const RULED_ON_HOUR_PERIODS: ReadonlyArray<{ file: string; ruling: string }> = [];

type Exclusion = { id: string; why: string; whole?: RegExp; strip?: RegExp };

/** Legitimate labels that make no figure claim. A whole-string rule exempts the text; a strip rule
 *  removes only the matched words and re-tests the rest, so another figure in the text is still caught. */
const EXCLUSIONS: readonly Exclusion[] = [
  {
    id: "svg-path",
    why: 'SVG icon path data ("11H2" is a coordinate, not hours).',
    whole: /^[Mm][\d\s.,+eE-]*(?:[MmLlHhVvCcSsQqTtAaZz][\d\s.,+eE-]*)+$/,
  },
  { id: "format-hint", why: "Tells the user how to type a time; not a limit.", strip: /\(24-hour, HH:MM\)/g },
  {
    id: "clock-time",
    why: "A time of day written HHMM hrs, not a window.",
    strip: /\b(?:[01]\d|2[0-3])[0-5]\d hrs\b/g,
  },
  {
    id: "bare-duration",
    why: "A choice, step button, preset or axis tick; the claim would sit in the words beside it, which stay caught.",
    whole: /^(?:[+-]?\d+\s?(?:h|hours?)\+?|NOW \(\+0h\)|(?:Add|Subtract) \d+ hours?|\d+h reference)$/,
  },
  {
    id: "elapsed-band",
    why: "Histogram and filter bands that sort recorded waits; no target, breach or standard is named.",
    whole:
      /^(?:(?:Under|Over) \d+ hours?|\d+ to \d+ hours|\d+ hours or more|Past \d+ hours|Waiting > \d+h|Sort by over \d+ hours|No open movement here has waited (?:under |over )?\d+(?: to \d+)? hours\.)$/,
    strip: /\$\{\w+\} past \d+ hours/g,
  },
  {
    id: "reporting-window",
    why: "The period a count or chart covers, and the code filters on that period.",
    whole:
      /^(?:(?:Discharged|Departures finalized) · 24h|24-hour arrivals vs dispositions curve|48-Hour (?:Bed )?Movement (?:Horizon )?Timeline|48-Hour Bed Movement Horizon · Click any event bar to select in worklist|Expiring next 8h|Nothing expires in the next 8h)$/,
    strip: /\blast 24 hours\b/g,
  },
  { id: "gauge-end", why: "The two ends of a 0 to 100% scale.", whole: /^(?:0|100)%$/ },
  {
    id: "long-wait-default",
    why: 'Josh, 26 Sept (D-24): "waiting over 24 hours" is his named long-wait default (LONG_WAIT_MINUTES), shown neutral, never a breach.',
    strip: /\bwaiting over 24 hours\b/gi,
  },
  {
    id: "internal-name",
    why:
      "A CSS class, element id, test id or state key: an identifier with a hyphen, underscore or inner capital, " +
      'or a single lower-case word (a union value such as "breached"); shown labels are capitalised or sentences.',
    whole: /^(?:(?=[A-Za-z][\w:-]*$)(?=.*(?:[-_:]|[a-z][A-Z]))[\w:-]+|[a-z]+)$/,
  },
];

/** Rule 4 only: constants that are not limits. */
const CONSTANT_EXCLUSIONS: ReadonlyArray<{ id: string; why: string; file?: RegExp; name?: RegExp }> = [
  { id: "seed-data", why: "Seed files build made-up records; their times are data, not limits.", file: /-seed\.ts$/ },
  {
    id: "chart-and-day-part",
    why: "Chart spacing, and the midday and 16:00 day-part bins the screen names in its own labels.",
    name: /^(?:CHART_\w+|MIDDAY_MINUTES|LATE_AFTERNOON_MINUTES)$/,
  },
  {
    id: "perth-utc-offset",
    why: "Western Australia's fixed UTC+8 offset (12 Oct 2026 site review, L7): a time-zone fact used to anchor day 0, not a clinical limit.",
    file: /^ward-clock\.ts$/,
    name: /^PERTH_UTC_OFFSET_MINUTES$/,
  },
  {
    id: "typing-pause",
    why: "The referral draft's autosave pause (9 Oct 2026): how long typing rests before tab memory is updated; never shown, not a limit.",
    file: /^referrals\/referral-draft-cache\.ts$/,
    name: /^REFERRAL_DRAFT_AUTOSAVE_MS$/,
  },
  {
    id: "restore-notice-pause",
    why: "How long the routine restored-save notice stays before it hides itself (simplification A3, 19 Oct 2026); a UI pause, not a limit.",
    file: /^shell\/ward-recovery-notice\.tsx$/,
    name: /^ROUTINE_NOTICE_MS$/,
  },
  {
    id: "snapshot-feedback-pause",
    why: 'How long the downtime pack shows "Taking snapshot" before the new time (v10, 10 Oct 2026); a UI pause, not a limit.',
    file: /^reports\/downtime-pack-screen\.tsx$/,
    name: /^TAKING_MS$/,
  },
  {
    id: "early-header-tap",
    why: "Early header tap replay (11 Oct 2026): how old a pre-hydration tap may be and how long React gets to replay it first; never shown, not a limit.",
    file: /^shell\/ward-early-tap\.ts$/,
    name: /^(?:EARLY_TAP_MAX_AGE_MS|SETTLE_MS)$/,
  },
  {
    id: "shared-full-read-pace",
    why: "Shared mode (audit F-04, 19 Oct 2026): how often a desk re-reads its whole part of the workspace between lean polls; network pacing, never shown, not a limit.",
    file: /^ward-shared-client\.ts$/,
    name: /^FULL_READ_EVERY_MS$/,
  },
  {
    id: "tour-find-wait",
    why: "The role tour (22 Oct 2026): how long it waits for a step's control to draw before showing the card in the middle, and how often the spotlight re-measures; never shown, not limits.",
    file: /^help\/ward-tour\.tsx$/,
    name: /^(?:FIND_TIMEOUT_MS|REMEASURE_MS)$/,
  },
];

export const BREACH = /\bbreach(?:es|ed|ing)?\b/i;
export const HOUR_WINDOW = /(?:^|[^\w.-])[<>]?\s*\d+(?:\.\d+)?\s*-?\s*(?:h|hrs?|hours?)\b/i;
/** In JSX text any typed percentage; in a string only one followed by words, so CSS ("100%") is not read. */
export const PERCENT_JSX = /(?:^|[^\w.])\d{1,3}(?:\.\d+)?\s*%/;
export const PERCENT_STRING = /(?:^|[^\w.])\d{1,3}(?:\.\d+)?\s*%\s+[A-Za-z]{2,}/;
export const TIME_CONSTANT = /\b(?:const|let)\s+([A-Z][A-Z0-9_]*(?:MINUTES|HOURS|_MS)[A-Z0-9_]*)\b[^=\n]*=\s*[\d(]/;

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (extname(entry) === ".ts" || extname(entry) === ".tsx") out.push(full);
  }
  return out;
}

/** Strips comments; `://` inside a string is kept so a URL is not read as a comment. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

// `&gt;` and `&lt;` decode to look-alike characters so a decoded ">24h" does not end the JSX text it sits in.
const ENTITIES: Record<string, string> = {
  gt: "＞",
  lt: "＜",
  amp: "&",
  mdash: "—",
  ndash: "–",
  middot: "·",
  nbsp: " ",
};
function decodeEntities(text: string): string {
  return text.replace(/&(\w+);/g, (whole, name: string) => ENTITIES[name] ?? whole);
}

/** Text a screen could show, read from the TypeScript syntax tree so comments, code and the quote
 *  characters inside templates can never be mistaken for text: string literals, the literal parts of
 *  template strings (expressions removed), and JSX text with HTML entities decoded. */
function shownText(file: string, source: string): { strings: string[]; jsxText: string[] } {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const root = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, kind);
  const strings: string[] = [];
  const jsxText: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) strings.push(node.text);
    else if (ts.isTemplateExpression(node))
      strings.push([node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" "));
    else if (ts.isJsxText(node) && /[A-Za-z%]/.test(node.text)) jsxText.push(decodeEntities(node.text));
    else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer))
      strings.push(decodeEntities(node.initializer.text));
    if (!(ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)))
      ts.forEachChild(node, visit);
  };
  visit(root);
  return { strings, jsxText };
}

function afterExclusions(text: string): string {
  let rest = text.trim();
  for (const rule of EXCLUSIONS) {
    if (rule.whole?.test(rest)) return "";
    if (rule.strip) rest = rest.replace(rule.strip, "").trim();
  }
  return rest;
}

export type Offence = { file: string; rule: string; text: string };
const clip = (text: string) => text.trim().replace(/\s+/g, " ").slice(0, 80);

export function offencesIn(file: string, source: string): Offence[] {
  const out: Offence[] = [];
  const { strings, jsxText } = shownText(file, source);
  for (const raw of [...strings, ...jsxText]) {
    const text = afterExclusions(raw);
    if (!text) continue;
    if (BREACH.test(text)) out.push({ file, rule: "breach", text: clip(raw) });
    if (HOUR_WINDOW.test(text) && !RULED_ON_HOUR_PERIODS.some((entry) => entry.file === file))
      out.push({ file, rule: "hour window", text: clip(raw) });
  }
  for (const raw of strings) {
    const text = afterExclusions(raw);
    if (text && PERCENT_STRING.test(text)) out.push({ file, rule: "typed percentage", text: clip(raw) });
  }
  for (const raw of jsxText) {
    const text = afterExclusions(raw);
    if (text && PERCENT_JSX.test(text)) out.push({ file, rule: "typed percentage", text: clip(raw) });
  }
  for (const line of withoutComments(source).split("\n")) {
    const name = TIME_CONSTANT.exec(line)?.[1];
    if (!name) continue;
    if (RULED_ON.some((entry) => entry.file === file && entry.name.test(name))) continue;
    // A rule with both a file and a name applies only to that name in that file.
    if (
      CONSTANT_EXCLUSIONS.some(
        (rule) =>
          (rule.file !== undefined || rule.name !== undefined) &&
          (rule.file === undefined || rule.file.test(file)) &&
          (rule.name === undefined || rule.name.test(name)),
      )
    )
      continue;
    out.push({ file, rule: "time constant", text: clip(line) });
  }
  return out;
}

const key = (o: Offence) => `${o.file} | ${o.rule} | ${o.text}`;

describe("no invented figures on a Ward Flow screen", () => {
  it("each detector catches the sweep's own examples, including through entities (anti-vacuity)", () => {
    const planted = [
      'export const A = () => <p title="Access Target Breach">24h</p>;',
      "export const B = () => <span>Breaching (&gt;24h)</span>;",
      'export const C = { label: "90.0% Benchmark Target" };',
      "export const D = () => <p>100% Rostered Capacity {x}</p>;",
      "const WA_ED_EXTENDED_WAIT_MINUTES = 480;",
    ].join("\n");
    // A's bare "24h" is an excluded axis-style duration; its title's "Breach" is not.
    expect(
      offencesIn("planted.tsx", planted)
        .map((o) => o.rule)
        .sort(),
    ).toEqual(["breach", "breach", "hour window", "time constant", "typed percentage", "typed percentage"]);
  });

  it("does not read comments, identifiers, CSS or the excluded labels", () => {
    const clean = [
      "// a breach at 24h",
      "const isBreachLike = breachCount;",
      'const style = { width: "100%" };',
      'const cls = "ward-breach-badge";',
      "export const E = () => <p>Estimated time (24-hour, HH:MM)</p>;",
      'const bands = ["Under 4 hours", "12 to 24 hours"];',
    ].join("\n");
    expect(offencesIn("clean.tsx", clean)).toEqual([]);
  });

  it("excludes only the relocated technical autosave timer, not clinical constants or shown claims", () => {
    const file = "referrals/referral-draft-cache.ts";
    const timer = "export const REFERRAL_DRAFT_AUTOSAVE_MS = 500;";
    expect(offencesIn(file, timer)).toEqual([]);
    expect(offencesIn("referrals/referral-draft-store.ts", timer).map((hit) => hit.rule)).toEqual(["time constant"]);
    expect(offencesIn(file, "const CLINICAL_WAIT_MINUTES = 480;").map((hit) => hit.rule)).toEqual(["time constant"]);
    expect(offencesIn(file, 'export const claim = "Target within 24 hours";').map((hit) => hit.rule)).toEqual([
      "hour window",
    ]);
  });

  it("keeps the to-do list honest: no breach entries, and it never grows", () => {
    expect(todo.filter((entry) => entry.rule === "breach")).toEqual([]);
    expect(todo.length).toBeLessThanOrEqual(MAX_TODO);
    for (const entry of todo) expect(entry.owner, key(entry)).toBeTruthy();
  });

  it("finds no invented figure that is not already on the to-do list, and no stale to-do line", () => {
    const found = collect(WARD_DIR).flatMap((full) =>
      offencesIn(relative(WARD_DIR, full).replaceAll("\\", "/"), readFileSync(full, "utf8")),
    );
    const listed = new Set(todo.map(key));
    const foundKeys = new Set(found.map(key));
    expect(
      [...foundKeys].filter((k) => !listed.has(k)).sort(),
      "A new invented figure is on a Ward Flow screen. Remove it or derive it from the record; never add it to the to-do list.",
    ).toEqual([]);
    expect(
      [...listed].filter((k) => !foundKeys.has(k)).sort(),
      "A to-do line no longer matches any hit: the figure has gone, so delete the line (the list only shrinks).",
    ).toEqual([]);
  });
});
