import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * M16 (master audit list, 10 Nov 2026): signed clinical values drift.
 *
 * `tests/ward-clinical-values.test.ts` already fails when a NAMED threshold constant is typed as a
 * number outside `ward-clinical-values.ts`, and it catches five inline comparison shapes. What it
 * cannot see is an unnamed hour, minute or day number written straight into an expression
 * (`waitMinutes >= 480`, `8 * 60`). That is how a signed value drifts: the values file changes and a
 * screen keeps its own copy.
 *
 * This scan walks every `.ts`/`.tsx` file in the ward directory with the TypeScript AST and finds:
 *
 *   - mul: a number of 2 or more multiplied by a time unit (60, 24, 1440, 60_000, 3_600_000,
 *     86_400_000, 1000, or a `*_PER_*` / `*_MS` unit name);
 *   - cmp: a number of 2 or more compared (<, <=, >, >=) with an expression whose last word is a
 *     time word (minutes, hours, days, wait, waited, elapsed, stay, overdue, remaining, duration,
 *     age), or a time-shaped number (60 or more and a multiple of 30) compared with anything that is
 *     not a length, width, height, offset or retry count.
 *
 * Every hit must be on an allowlist with a reason. An entry also pins how many times its expression
 * appears in its file, so a second copy of an allowed number is caught too. Hits that look like a
 * copy of a signed clinical value are listed separately under `SUSPECTED_DRIFT` and each one has an
 * `it.todo` below: they are clinical, so this test reports them and changes nothing (brief, 10 Nov
 * 2026). Josh decides whether each should read the values file.
 *
 * The 24 h versus 48 h question stays with the held clinical PR, and is not decided here.
 *
 * Limits, stated plainly: numbers inside strings, JSX text, CSS or comments are not seen; a number
 * reached through a local variable (`const n = 8; n * 60`) is not seen; universal shapes such as
 * `24 * 60` (minutes in a day) are allowed in any file, so a `24 * 60` used as the 24 h very long
 * wait is not told apart from a day length.
 */

const WARD_DIR = "src/components/ward-management";
const VALUES_FILE = "ward-clinical-values.ts";
/** The same fixture rule `tests/ward-clinical-values.test.ts` uses: synthetic records, not rules. */
const FIXTURE_FILE = /(?:-seed\.ts|^ward-movements(?:-referrals)?\.ts)$/;

/** Whole files whose time numbers are synthetic data, never a rule. */
const SYNTHETIC_DATA_FILES: Readonly<Record<string, string>> = {
  "ward-demo-network.ts": "synthetic demo network: invented waits and times for made-up records",
  "ward-demo-example-lists.ts": "synthetic example lists: invented discharge and stay times",
  "shell/ward-access-admin-store.ts": "synthetic access requests made a few hours before the demo clock",
  "live-build/ward-no-demo-data.ts": "the demo clock anchor (10:42), a made-up time",
};

/** Expressions allowed in any file, each with its reason. No count: they are unit facts or field bounds. */
const UNIVERSAL_SHAPES: Readonly<Record<string, string>> = {
  "24 * 60": "minutes in a day, a unit conversion",
  "60 * 60": "seconds or minutes in an hour, a unit conversion",
  "MINUTES_PER_DAY * 60_000": "milliseconds in a day, a unit conversion",
  "24 * MINUTES_PER_HOUR": "minutes in a day, a unit conversion",
  "7 * MINUTES_PER_DAY": "one week, a report or chart window",
  "7 * 24": "hours in a week, a chart window",
  "hours > 23": "bound on a typed clock time",
  "minutes > 59": "bound on a typed clock time",
  "hour > 23": "bound on a typed clock time",
  "minute > 59": "bound on a typed clock time",
  "day > 31": "bound on a typed date",
  "minutes < 60": "formatting: show minutes rather than hours",
  "hours < 24": "formatting or a typed-time bound: hours within one day",
};

type Allowed = { readonly file: string; readonly expr: string; readonly n: number; readonly why: string };

/** File-specific hits that are not clinical values, each with its reason and its count in the file. */
const ALLOWED: readonly Allowed[] = [
  {
    file: "alerts/alert-detail.tsx",
    expr: "booking.expectedArrivalAt - booking.bookedAt <= 720",
    n: 1,
    why: "drawing: a booking made within 12 h shows on the same track",
  },
  { file: "alerts/alerts-model.ts", expr: "value < 1440", n: 1, why: "formatting: hours and minutes under a day" },
  { file: "alerts/alerts-model.ts", expr: "value < 60", n: 1, why: "formatting: minutes under an hour" },
  { file: "alerts/alerts-today-band.tsx", expr: "2 * 60", n: 1, why: "drawing: the today band window" },
  { file: "alerts/alerts-today-band.tsx", expr: "3 * 60", n: 1, why: "drawing: the today band window" },
  { file: "alerts/alerts-today-band.tsx", expr: "6 * 60", n: 1, why: "drawing: the today band width" },
  {
    file: "capacity/capacity-road-time.tsx",
    expr: "minutes < 10",
    n: 1,
    why: "formatting: short road times in whole minutes",
  },
  { file: "community/community-elapsed.ts", expr: "days < 7", n: 1, why: "formatting: days rather than weeks" },
  { file: "community/team-2026/midland-dates.ts", expr: "12 * 60", n: 1, why: "noon, used to label a calendar day" },
  {
    file: "coordinator/priority-queue.tsx",
    expr: "toTarget < 60",
    n: 1,
    why: "formatting: minutes left under an hour",
  },
  {
    file: "coordinator/priority-queue.tsx",
    expr: "toTarget <= 60",
    n: 1,
    why: "wording: say 'due in' within the last hour; the target itself is a setting",
  },
  {
    file: "delays/delays-board.tsx",
    expr: "OVER_8H - row.waited <= 60",
    n: 1,
    why: "count of rows crossing the signed 8 h line within the next hour; a lookahead, the 8 h is read",
  },
  { file: "discharges/discharge-chart-days.ts", expr: "12 * 60", n: 1, why: "noon, used to label a chart day" },
  {
    file: "discharges/discharge-service-hours.ts",
    expr: "12 * 60",
    n: 1,
    why: "synthetic service-hours table (opening times)",
  },
  {
    file: "discharges/discharge-service-hours.ts",
    expr: "14 * 60",
    n: 1,
    why: "synthetic service-hours table (opening times)",
  },
  {
    file: "discharges/discharge-service-hours.ts",
    expr: "16 * 60",
    n: 1,
    why: "synthetic service-hours table (opening times)",
  },
  {
    file: "discharges/discharge-service-hours.ts",
    expr: "17 * 60",
    n: 2,
    why: "synthetic service-hours table (opening times)",
  },
  {
    file: "discharges/discharge-service-hours.ts",
    expr: "19 * 60",
    n: 1,
    why: "synthetic service-hours table (opening times)",
  },
  {
    file: "discharges/discharge-service-hours.ts",
    expr: "7 * 60",
    n: 1,
    why: "synthetic service-hours table (opening times)",
  },
  {
    file: "discharges/discharge-service-hours.ts",
    expr: "8 * 60",
    n: 4,
    why: "synthetic service-hours table (opening times)",
  },
  {
    file: "discharges/discharge-service-hours.ts",
    expr: "9 * 60",
    n: 1,
    why: "synthetic service-hours table (opening times)",
  },
  {
    file: "ed/ed-screen-derivations.ts",
    expr: "waiting <= 60",
    n: 1,
    why: "wording: 'Expected within the hour' says the 60 it uses",
  },
  {
    file: "forecast/use-forecast-model.ts",
    expr: "Date.now() - held.at < 120_000",
    n: 1,
    why: "software: reuse a forecast fetched in the last 2 minutes",
  },
  {
    file: "handover/handover-model.ts",
    expr: "8 * 60",
    n: 3,
    why: "the gap between handovers (a shift), a clock fact for 'new since'",
  },
  {
    file: "legal-forms/legal-forms-screen.tsx",
    expr: "8 * 60",
    n: 1,
    why: "chart window (CHART_WINDOW_MINUTES, already on the not-clinical list)",
  },
  { file: "legal-forms/legal-forms-view.ts", expr: "v < 60", n: 1, why: "formatting: minutes under an hour" },
  {
    file: "officer/officer-jobs.ts",
    expr: "12 * 60",
    n: 1,
    why: "how far back the officer screen lists cancellation notices; a view window",
  },
  {
    file: "on-call/on-call-directory.ts",
    expr: "left <= 60",
    n: 1,
    why: "directory: a cover window ending within the hour is marked soon",
  },
  {
    file: "on-call/on-call-directory.ts",
    expr: "step <= 60",
    n: 1,
    why: "directory: a cover change within the hour is marked soon",
  },
  {
    file: "patients/patient-now-records.ts",
    expr: "14 * 60",
    n: 1,
    why: "fallback handover clock time (14:00) for ordering a record line",
  },
  { file: "patients/patient-now-records.ts", expr: "min >= 1440", n: 1, why: "formatting: days rather than hours" },
  {
    file: "patients/patient-now-screen.tsx",
    expr: "14 * 60",
    n: 1,
    why: "handover clock time (14:00) passed to the record lines",
  },
  {
    file: "patients/patient-now-summary.tsx",
    expr: "6 * 1440",
    n: 1,
    why: "formatting: weekday name within six days, else a date",
  },
  {
    file: "referrals/use-ward-referral-drawer-state.ts",
    expr: "deltaY > 60",
    n: 1,
    why: "gesture: a 60 px swipe closes the phone drawer; pixels, not time",
  },
  {
    file: "search/search-filters.ts",
    expr: "hours < 6",
    n: 1,
    why: "search filter band; matches WAIT_FILTER_SHORT_MINUTES but does not read it (non-clinical)",
  },
  {
    file: "search/search-filters.ts",
    expr: "hours >= 6",
    n: 1,
    why: "search filter band; matches WAIT_FILTER_SHORT_MINUTES but does not read it (non-clinical)",
  },
  { file: "search/search-filters.ts", expr: "hours >= 24", n: 1, why: "search filter band 'over 24 hours'" },
  { file: "settings/access-log.tsx", expr: "minutes >= 60", n: 1, why: "formatting: hours rather than minutes" },
  { file: "settings/access-settings.tsx", expr: "minutes >= 60", n: 1, why: "formatting: hours rather than minutes" },
  {
    file: "shell-next/next-rail-body.tsx",
    expr: "shiftProgress.remainingMinutes <= 30",
    n: 1,
    why: "software prompt: offer the shift digest in the last 30 minutes (feature 15)",
  },
  {
    file: "shell/ward-alert-preferences.ts",
    expr: "21 * 60",
    n: 1,
    why: "quiet-hours choices, a personal alert preference",
  },
  {
    file: "shell/ward-alert-preferences.ts",
    expr: "22 * 60",
    n: 2,
    why: "quiet-hours choices, a personal alert preference",
  },
  {
    file: "shell/ward-alert-preferences.ts",
    expr: "23 * 60",
    n: 1,
    why: "quiet-hours choices, a personal alert preference",
  },
  {
    file: "shell/ward-alert-preferences.ts",
    expr: "6 * 60",
    n: 1,
    why: "quiet-hours choices, a personal alert preference",
  },
  {
    file: "shell/ward-alert-preferences.ts",
    expr: "7 * 60",
    n: 3,
    why: "quiet-hours choices, a personal alert preference",
  },
  {
    file: "statistics/statistics-map-view.tsx",
    expr: "48 * 60",
    n: 1,
    why: "drawing: the map ring is full at 48 h; a scale, flags nothing",
  },
  {
    file: "ward-bed-availability.ts",
    expr: "12 * 60",
    n: 1,
    why: "day-part bin (MIDDAY_MINUTES, already on the not-clinical list)",
  },
  {
    file: "ward-bed-availability.ts",
    expr: "16 * 60",
    n: 1,
    why: "day-part bin (LATE_AFTERNOON_MINUTES, already on the not-clinical list)",
  },
  {
    file: "ward-clinical-value-notes.ts",
    expr: "4 * MINUTES_PER_HOUR",
    n: 1,
    why: "an alternative figure listed for Josh to compare, not in use",
  },
  {
    file: "ward-clinical-value-notes.ts",
    expr: "72 * MINUTES_PER_HOUR",
    n: 1,
    why: "an alternative figure listed for Josh to compare, not in use",
  },
  {
    file: "ward-clinical-value-notes.ts",
    expr: "8 * MINUTES_PER_HOUR",
    n: 1,
    why: "an alternative figure listed for Josh to compare, not in use",
  },
  { file: "ward-clock.ts", expr: "8 * 60", n: 1, why: "the WA time zone offset (UTC+8, no daylight saving)" },
  {
    file: "ward-flow-scenario-file.ts",
    expr: "8 * 60",
    n: 1,
    why: "the WA time zone offset, for a saved file's Perth date",
  },
  {
    file: "ward-operational-defaults.ts",
    expr: "12 * MINUTES_PER_HOUR",
    n: 3,
    why: "chart span, a Settings range bound and the forecast lead (each on the not-clinical list)",
  },
  { file: "ward-operational-defaults.ts", expr: "15 * MINUTES_PER_HOUR", n: 2, why: "synthetic shift times (15:00)" },
  {
    file: "ward-operational-defaults.ts",
    expr: "2 * MINUTES_PER_HOUR",
    n: 2,
    why: "chart step and a Settings range bound",
  },
  { file: "ward-operational-defaults.ts", expr: "23 * MINUTES_PER_HOUR", n: 2, why: "synthetic shift times (23:00)" },
  {
    file: "ward-operational-defaults.ts",
    expr: "3 * MINUTES_PER_HOUR",
    n: 1,
    why: "Settings range bound for the due-soon urgent value",
  },
  {
    file: "ward-operational-defaults.ts",
    expr: "4 * MINUTES_PER_HOUR",
    n: 2,
    why: "ask-wards alert time and broadcast length (both on the not-clinical list)",
  },
  {
    file: "ward-operational-defaults.ts",
    expr: "6 * 24",
    n: 1,
    why: "input bound for the weekend review tick (on the not-clinical list)",
  },
  {
    file: "ward-operational-defaults.ts",
    expr: "6 * MINUTES_PER_HOUR",
    n: 1,
    why: "search filter band (WAIT_FILTER_SHORT_MINUTES, on the not-clinical list)",
  },
  { file: "ward-operational-defaults.ts", expr: "7 * MINUTES_PER_HOUR", n: 2, why: "synthetic shift times (07:00)" },
  {
    file: "ward-operational-defaults.ts",
    expr: "8 * MINUTES_PER_HOUR",
    n: 3,
    why: "Settings range bound, morning handover and bed meeting clock times",
  },
  {
    file: "ward-role-alerts.ts",
    expr: "12 * 60",
    n: 1,
    why: "phone alert id lifetime (ROLE_ALERT_WINDOW_MINUTES, on the not-clinical list)",
  },
  {
    file: "ward-shared-access.tsx",
    expr: "2 * SHARED_REFRESH_MS",
    n: 1,
    why: "software: shared data is stale after two missed refreshes",
  },
  {
    file: "ward-shared-save-status.tsx",
    expr: "5 * 60_000",
    n: 1,
    why: "software: a refresh late by 5 minutes shows the stale notice",
  },
  { file: "ward-sites.ts", expr: "10 * 60", n: 1, why: "the demo clock anchor (10:42), a made-up time" },
  {
    file: "ward/ward-beds-matrix.tsx",
    expr: "bed.expectedDays <= 2",
    n: 2,
    why: "display: beds due out within two days get the info tone; a board hint (review with M16 drift list)",
  },
];

type Drift = Allowed & { readonly signedValue: string };

/**
 * Hits that look like a copy of a signed clinical value, or an unsigned clinical rule typed inline.
 * DEFECTS for Josh: clinical, so they are reported and left as they are (no behaviour change).
 */
const SUSPECTED_DRIFT: readonly Drift[] = [
  {
    file: "bed-meeting/tv-clinical-derivations.ts",
    expr: "waitMinutes >= 480",
    n: 1,
    signedValue: "longWait (8 h)",
    why: "TV ED band 'eight' types 480 instead of reading the values file",
  },
  {
    file: "bed-meeting/tv-clinical-derivations.ts",
    expr: "12 * 60",
    n: 1,
    signedValue: "none (unsigned)",
    why: "TV shows a leave return due within 12 h; no signed value names this window",
  },
  {
    file: "ed/ed-handover-board.tsx",
    expr: "m >= 480",
    n: 1,
    signedValue: "longWait (8 h)",
    why: "ED handover board 8 h band types 480",
  },
  {
    file: "ed/ed-handover-board.tsx",
    expr: "minutes < 480",
    n: 1,
    signedValue: "longWait (8 h)",
    why: "ED handover board 'Under 8 hours' types 480",
  },
  {
    file: "ed/ed-lists-desktop.tsx",
    expr: "minutes >= 480",
    n: 1,
    signedValue: "longWait (8 h)",
    why: "ED list warning tone types 480",
  },
  {
    file: "ed/ed-screen-derivations.ts",
    expr: "waited > 60",
    n: 1,
    signedValue: "none (unsigned)",
    why: "'Referred and not yet seen' warning flag after 60 minutes is typed inline",
  },
  {
    file: "delays/delays-derivations.ts",
    expr: "8 * 60",
    n: 2,
    signedValue: "longWait (8 h)",
    why: "delays summary 'Under 8 hours' / '8 to 24 hours' types 8 * 60 beside LONG_WAIT_MINUTES",
  },
  {
    file: "delays/wait-bands.ts",
    expr: "8 * 60",
    n: 2,
    signedValue: "longWait (8 h)",
    why: "delays wait bands type 8 * 60 (and 24 * 60 for the very long wait)",
  },
  {
    file: "statistics/statistics-ed-waits.ts",
    expr: "4 * 60",
    n: 1,
    signedValue: "tierTwoOverdue / edAccessTarget (4 h)?",
    why: "statistics ED wait bands are typed, not read",
  },
  {
    file: "statistics/statistics-ed-waits.ts",
    expr: "8 * 60",
    n: 1,
    signedValue: "longWait (8 h)",
    why: "statistics ED wait bands are typed, not read",
  },
  {
    file: "statistics/statistics-ed-waits.ts",
    expr: "12 * 60",
    n: 1,
    signedValue: "none (unsigned)",
    why: "statistics ED wait bands are typed, not read",
  },
  {
    file: "ward/ward-bed-board.tsx",
    expr: "referral.waitedMinutes >= 240",
    n: 1,
    signedValue: "none (unsigned; 4 h)",
    why: "ward bed board referral chip turns warning at 4 h, typed inline",
  },
  {
    file: "referrals/referral-age-band.ts",
    expr: "age < 18",
    n: 1,
    signedValue: "none (age band rule)",
    why: "age band edges are typed here and again in ward-patients.ts (see M118)",
  },
  {
    file: "referrals/referral-age-band.ts",
    expr: "age >= 65",
    n: 1,
    signedValue: "none (age band rule)",
    why: "age band edges are typed here and again in ward-patients.ts (see M118)",
  },
  {
    file: "referrals/referral-age-band.ts",
    expr: "age <= 24",
    n: 1,
    signedValue: "none (youth note)",
    why: "the 'youth up to 24' note edge is typed inline",
  },
  {
    file: "ward-patients.ts",
    expr: "age < 18",
    n: 1,
    signedValue: "none (age band rule)",
    why: "second copy of the age band edges",
  },
  {
    file: "ward-patients.ts",
    expr: "age >= 65",
    n: 1,
    signedValue: "none (age band rule)",
    why: "second copy of the age band edges",
  },
];

// ---- The scanner ----------------------------------------------------------------------------------

const UNIT_NUMBERS = new Set([60, 24, 1000, 1440, 60_000, 3_600_000, 86_400_000]);
const UNIT_NAME = /^(?:[A-Z]+_PER_[A-Z]+|[A-Z_]*_MS)$/;
const TIME_WORDS = new Set([
  "minute",
  "minutes",
  "hour",
  "hours",
  "day",
  "days",
  "elapsed",
  "wait",
  "waited",
  "stay",
  "overdue",
  "remaining",
  "duration",
  "age",
]);
const NOT_TIME_WORDS = new Set(["length", "width", "height", "x", "y", "attempts", "size"]);
const COMPARISONS = new Set([
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
]);

function lastWord(name: string): string {
  const words = name.split(/_|(?=[A-Z][a-z])/).filter(Boolean);
  return (words.at(-1) ?? "").toLowerCase();
}

function nameOf(node: ts.Expression): string {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isCallExpression(node)) return nameOf(node.expression);
  if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) return nameOf(node.operand);
  if (ts.isParenthesizedExpression(node)) return nameOf(node.expression);
  return "";
}

function isUnit(node: ts.Expression): boolean {
  if (ts.isNumericLiteral(node)) return UNIT_NUMBERS.has(Number(node.text));
  if (ts.isIdentifier(node)) return UNIT_NAME.test(node.text);
  if (ts.isPropertyAccessExpression(node)) return UNIT_NAME.test(node.name.text);
  return false;
}

/** Every time-number expression in a file, as normalised source text. */
function timeNumbersIn(file: string, source: string): string[] {
  const root = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isBinaryExpression(node)) {
      const kind = node.operatorToken.kind;
      for (const [number, other] of [
        [node.left, node.right],
        [node.right, node.left],
      ] as const) {
        if (!ts.isNumericLiteral(number)) continue;
        const value = Number(number.text);
        if (value <= 1) continue;
        const otherName = nameOf(other);
        const hit =
          (kind === ts.SyntaxKind.AsteriskToken && isUnit(other)) ||
          (COMPARISONS.has(kind) &&
            (TIME_WORDS.has(lastWord(otherName)) ||
              (value >= 60 && value % 30 === 0 && !NOT_TIME_WORDS.has(lastWord(otherName)))));
        if (hit) found.push(node.getText(root).replace(/\s+/g, " "));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

function wardFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return wardFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** `file | expr` → count, for every hit outside the values file, fixtures and synthetic data files. */
function scanWardDirectory(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const full of wardFiles(WARD_DIR)) {
    const file = relative(WARD_DIR, full).replaceAll("\\", "/");
    if (file === VALUES_FILE || FIXTURE_FILE.test(file) || file in SYNTHETIC_DATA_FILES) continue;
    for (const expr of timeNumbersIn(file, readFileSync(full, "utf8"))) {
      if (expr in UNIVERSAL_SHAPES) continue;
      const key = `${file} | ${expr}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

const keyOf = (entry: Allowed) => `${entry.file} | ${entry.expr}`;

describe("M16: hour, minute and day numbers in the ward code", () => {
  it("catches the shapes it looks for (anti-vacuity)", () => {
    const planted = [
      "const a = waitMinutes >= 480 ? 1 : 2;",
      "const b = 8 * 60;",
      "const c = 4 * MINUTES_PER_HOUR;",
      "if (m >= 720) go();",
      "if (row.expectedDays <= 2) go();",
      "if (history.length > 180) clamp();",
      "const d = 1 * 60;",
      "// 8 * 60 in a comment",
      "const e = `8 * 60 in a string`;",
      "const f = waited >= LONG_WAIT_MINUTES;",
    ].join("\n");
    expect(timeNumbersIn("planted.ts", planted)).toEqual([
      "waitMinutes >= 480",
      "8 * 60",
      "4 * MINUTES_PER_HOUR",
      "m >= 720",
      "row.expectedDays <= 2",
    ]);
  });

  it("finds every hit on the allowlist or the suspected drift list, at its pinned count", () => {
    const counts = scanWardDirectory();
    const listed = new Map<string, number>([...ALLOWED, ...SUSPECTED_DRIFT].map((entry) => [keyOf(entry), entry.n]));
    const unlisted = [...counts.entries()]
      .filter(([key, count]) => listed.get(key) !== count)
      .map(([key, count]) => `${key} (found ${count}, listed ${listed.get(key) ?? 0})`);
    expect(
      unlisted,
      "A time number is typed in the ward code. Read it from ward-clinical-values.ts, or add it here with a reason a reviewer would accept.",
    ).toEqual([]);
    expect(
      [...listed.keys()].filter((key) => !counts.has(key)),
      "An allowlist entry no longer matches the code: delete the line.",
    ).toEqual([]);
  });

  it("gives every entry a reason, and no entry twice", () => {
    const all = [...ALLOWED, ...SUSPECTED_DRIFT];
    for (const entry of all) expect(entry.why.length, keyOf(entry)).toBeGreaterThan(10);
    for (const why of [...Object.values(UNIVERSAL_SHAPES), ...Object.values(SYNTHETIC_DATA_FILES)])
      expect(why.length).toBeGreaterThan(10);
    expect(new Set(all.map(keyOf)).size).toBe(all.length);
  });

  it("names a real file for every synthetic data exemption", () => {
    const files = new Set(wardFiles(WARD_DIR).map((full) => relative(WARD_DIR, full).replaceAll("\\", "/")));
    for (const file of Object.keys(SYNTHETIC_DATA_FILES)) expect(files.has(file), file).toBe(true);
  });

  // DEFECTS for Josh (clinical): each should read its value from ward-clinical-values.ts, or be signed.
  for (const drift of SUSPECTED_DRIFT) {
    it.todo(`M16 defect: ${drift.file} types \`${drift.expr}\` (${drift.signedValue}): ${drift.why}`);
  }
});
