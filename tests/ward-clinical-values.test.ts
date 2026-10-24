import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { TIER_TARGETS_NOTE } from "../src/components/ward-management/coordinator/priority-queue";
import { BED_ALERT_THRESHOLD_PERCENT } from "../src/components/ward-management/shell/ward-service-bed-alerts";
import {
  CLINICAL_VALUES,
  clinicalValueStatusText,
  formatClinicalFigure,
  allClinicalValuesSigned,
} from "../src/components/ward-management/ward-clinical-values";
import {
  CLINICAL_VALUE_LIST,
  clinicalValuesMarkdownTable,
  unsignedClinicalValueCount,
} from "../src/components/ward-management/ward-clinical-value-notes";
import { ED_ACCESS_TARGET_MINUTES, PULL_HOLD_MINUTES } from "../src/components/ward-management/ward-model";
import {
  DUE_SOON_MINUTES,
  DUE_SOON_URGENT_MINUTES,
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
  OCCUPANCY_ALERT_PERCENT,
  OVERDUE_AFTER_ANY_TIER_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
  PULL_NOW_ANSWER_MINUTES,
} from "../src/components/ward-management/ward-operational-defaults";

/**
 * ONE FILE OF CLINICAL VALUES (Josh, 15 Oct 2026, item 6). `ward-clinical-values.ts` holds every
 * threshold and timing that flags, colours or escalates a patient, referral or bed, each marked
 * synthetic or signed. This file pins three things:
 *   1. every entry is complete, and a signed entry names who signed it and when;
 *   2. no threshold constant is typed as a number anywhere else in the ward directory;
 *   3. `docs/ward-flow/clinical-values.md` is the list, not a hand-kept copy of it.
 */

const WARD_DIR = resolve(process.cwd(), "src/components/ward-management");
const DOC_PATH = resolve(process.cwd(), "docs/ward-flow/clinical-values.md");
const DOC_START = "<!-- clinical-values:start -->";
const DOC_END = "<!-- clinical-values:end -->";

describe("clinical values file", () => {
  it("gives every value a name, a source, a unit and a status", () => {
    const names = new Set<string>();
    for (const entry of CLINICAL_VALUE_LIST) {
      expect(entry.name.trim().length, entry.id).toBeGreaterThan(10);
      expect(names.has(entry.name), `${entry.id} repeats another value's name`).toBe(false);
      names.add(entry.name);
      expect(entry.source.trim().length, `${entry.id} has no source`).toBeGreaterThan(5);
      expect(Number.isFinite(entry.value) && entry.value > 0, entry.id).toBe(true);
      expect(["synthetic", "signed"]).toContain(entry.status);
      if (entry.status === "signed") {
        expect(entry.signedBy.trim().length, `${entry.id} is signed by nobody`).toBeGreaterThan(2);
        expect(entry.signedOn, `${entry.id} is signed with no date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      for (const alternative of entry.alternatives ?? []) {
        expect(alternative.where.trim().length, entry.id).toBeGreaterThan(5);
      }
    }
  });

  it("holds the values the app ran on before the file existed, all synthetic until signed", () => {
    // A changed figure here is a clinical change: it needs Josh's sign-off and a source, not an edit
    // to make this pass. Signing a value changes its status, not this list.
    expect(Object.fromEntries(CLINICAL_VALUE_LIST.map((entry) => [entry.id, entry.value]))).toEqual({
      tierOneOverdue: 60,
      tierTwoOverdue: 240,
      tierThreeOverdue: 1440,
      anyTierOverdue: 4320,
      edElevatedPressure: 180,
      edSeverePressure: 480,
      longWait: 1440,
      veryLongWait: 2880,
      edAccessTarget: 1440,
      edMedicalBedRelease: 24,
      bedAlertLine: 85,
      occupancyAmber: 90,
      occupancySurge: 95,
      occupancyCritical: 98,
      dueSoonUrgent: 60,
      dueSoon: 180,
      pullNowAnswer: 15,
      pullNowLive: 240,
      pullHold: 240,
      extraTravelHold: 60,
      bedHoldReview: 120,
      bedCountFresh: 60,
      downtimePackStale: 60,
      preparingBedStale: 61,
      lateArrivalGrace: 60,
      silentWardFirstReminder: 120,
      silentWardSecondReminder: 240,
      missedRequestWindow: 120,
      wardAnswerTarget: 120,
      transferAcceptanceTarget: 240,
      transportBookedTarget: 60,
      expectFlagVoluntary: 2880,
      expectFlagInvoluntary: 10080,
      expectReconsider: 4320,
      dischargePrepWindow: 1440,
      dischargeCriteriaValidity: 1440,
      leaveOpenWarning: 1440,
      awolBedHoldWarning: 240,
      ctoFollowUpWindow: 7,
      longStayPrompt: 7,
      delayedDischargeEscalation: 72,
      readmissionWindow: 28,
      // Role access plan (Josh, 15 Oct 2026): new synthetic access and privacy values.
      breakGlassWindow: 60,
      breakGlassPerShift: 3,
      breakGlassShift: 12,
      edHandoffWindow: 24,
      wardHandoffWindow: 7,
      idleLock: 15,
      smallNumberHidden: 5,
      // Role access later pass (Josh, 16 Oct 2026): cover, step-up sign-in and the access review.
      coverLength: 12,
      sessionLimit: 12,
      sessionWarning: 10,
      stepUpWindow: 10,
      accessExpiringSoon: 14,
      accessUnused: 45,
      // Role access plan v2 (Josh, 23 Oct 2026, D-80): the longest a role may be granted for.
      accessMaxTerm: 365,
      // Observation levels (Josh, 21 Oct 2026): fix plan item 10.
      observationIntermittentShort: 15,
      observationIntermittentLong: 30,
    });
    expect(unsignedClinicalValueCount()).toBe(
      CLINICAL_VALUE_LIST.filter((entry) => entry.status === "synthetic").length,
    );
    const tiersSigned = allClinicalValuesSigned([
      "tierOneOverdue",
      "tierTwoOverdue",
      "tierThreeOverdue",
      "anyTierOverdue",
    ]);
    expect(TIER_TARGETS_NOTE).toBe(
      `Overdue after T1 1h, T2 4h, T3 24h, ${tiersSigned ? "signed for the prototype" : "pending clinical sign-off"}`,
    );
  });

  it("is what the screens' constants read", () => {
    expect(OVERDUE_AFTER_MINUTES_BY_TIER).toEqual({
      1: CLINICAL_VALUES.tierOneOverdue.value,
      2: CLINICAL_VALUES.tierTwoOverdue.value,
      3: CLINICAL_VALUES.tierThreeOverdue.value,
    });
    expect(OVERDUE_AFTER_ANY_TIER_MINUTES).toBe(CLINICAL_VALUES.anyTierOverdue.value);
    expect(BED_ALERT_THRESHOLD_PERCENT).toBe(CLINICAL_VALUES.bedAlertLine.value);
    expect(OCCUPANCY_ALERT_PERCENT).toBe(CLINICAL_VALUES.occupancyAmber.value);
    expect(PULL_NOW_ANSWER_MINUTES).toBe(CLINICAL_VALUES.pullNowAnswer.value);
    expect(DUE_SOON_MINUTES).toBe(CLINICAL_VALUES.dueSoon.value);
    expect(DUE_SOON_URGENT_MINUTES).toBe(CLINICAL_VALUES.dueSoonUrgent.value);
    expect(LONG_WAIT_MINUTES).toBe(CLINICAL_VALUES.longWait.value);
    expect(ED_SEVERE_PRESSURE_WAIT_MINUTES).toBe(CLINICAL_VALUES.edSeverePressure.value);
    expect(PULL_HOLD_MINUTES).toBe(CLINICAL_VALUES.pullHold.value);
    expect(ED_ACCESS_TARGET_MINUTES).toBe(CLINICAL_VALUES.edAccessTarget.value);
  });

  it("formats each figure in its own unit and names the status", () => {
    expect(formatClinicalFigure(15, "minutes")).toBe("15 minutes");
    expect(formatClinicalFigure(60, "minutes")).toBe("1 hour");
    expect(formatClinicalFigure(4320, "minutes")).toBe("72 hours");
    expect(formatClinicalFigure(10080, "minutes")).toBe("7 days");
    expect(formatClinicalFigure(85, "percent")).toBe("85%");
    expect(formatClinicalFigure(1, "days")).toBe("1 day");
    expect(clinicalValueStatusText({ status: "synthetic" })).toBe("Synthetic value");
    expect(clinicalValueStatusText({ status: "signed", signedBy: "Dr A Example", signedOn: "2026-11-01" })).toBe(
      "Signed for the prototype by Dr A Example, 2026-11-01",
    );
  });
});

// ---- No threshold typed anywhere else -----------------------------------------------------------

/** A SCREAMING_SNAKE name that reads as a threshold or timing. */
const THRESHOLD_NAME = /^[A-Z][A-Z0-9_]*(?:MINUTES|HOURS|DAYS|PERCENT|THRESHOLD)[A-Z0-9_]*$/;
/** Unit factors an initializer may multiply by and still be a typed number. */
const UNIT_FACTORS = new Set(["MINUTES_PER_HOUR", "MINUTES_PER_DAY", "HOURS_PER_DAY"]);

function isTypedNumber(node: ts.Expression): boolean {
  if (ts.isNumericLiteral(node)) return true;
  if (ts.isParenthesizedExpression(node)) return isTypedNumber(node.expression);
  if (ts.isPrefixUnaryExpression(node)) return isTypedNumber(node.operand);
  if (ts.isBinaryExpression(node)) {
    const leaves = [node.left, node.right];
    return (
      leaves.every((leaf) => isTypedNumber(leaf) || (ts.isIdentifier(leaf) && UNIT_FACTORS.has(leaf.text))) &&
      leaves.some((leaf) => isTypedNumber(leaf))
    );
  }
  return false;
}

/** Every `const NAME = <typed number>` whose name reads as a threshold. */
function typedThresholdsIn(file: string, source: string): string[] {
  const root = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      THRESHOLD_NAME.test(node.name.text) &&
      node.initializer !== undefined &&
      isTypedNumber(node.initializer)
    )
      found.push(node.name.text);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

/**
 * Typed numbers that are not clinical thresholds, each with its reason. A new entry needs a reason a
 * reviewer would accept; a figure that flags, colours or escalates a patient, referral or bed goes
 * in `ward-clinical-values.ts` instead.
 */
const NOT_CLINICAL: ReadonlyArray<{ file: string; name: string; why: string }> = [
  {
    file: "ward-role-alerts.ts",
    name: "ROLE_ALERT_WINDOW_MINUTES",
    why: "how long a phone alert id stays live for a retried delivery (D-80); never shown",
  },
  { file: "ward-model.ts", name: "PULL_HOLD_MINUTES", why: "legal figure guard provenance; listed as pullHold" },
  {
    file: "ward-model.ts",
    name: "EXTRA_TRAVEL_HOLD_MINUTES",
    why: "legal figure guard provenance; listed as extraTravelHold",
  },
  {
    file: "ward-model.ts",
    name: "ED_ACCESS_TARGET_MINUTES",
    why: "legal figure guard provenance; listed as edAccessTarget",
  },
  {
    file: "ward-model.ts",
    name: "ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS",
    why: "legal figure guard provenance; listed as edMedicalBedRelease",
  },
  {
    file: "ward-model.ts",
    name: "MORNING_ROLLUP_TIME_MINUTES",
    why: "a clock time for the roll-up (D-17), not a threshold",
  },
  { file: "ward-clock.ts", name: "PERTH_UTC_OFFSET_MINUTES", why: "the WA time zone offset" },
  { file: "ward-operational-defaults.ts", name: "UNDO_WINDOW_MINUTES", why: "software undo window" },
  { file: "ward-operational-defaults.ts", name: "ED_TREND_SPAN_MINUTES", why: "chart window" },
  { file: "ward-operational-defaults.ts", name: "ED_TREND_STEP_MINUTES", why: "chart step" },
  { file: "ward-operational-defaults.ts", name: "RED_ROW_SNOOZE_CAP_MINUTES", why: "software snooze cap" },
  { file: "ward-operational-defaults.ts", name: "SNOOZE_MAX_MINUTES", why: "software snooze bound" },
  {
    file: "ward-operational-defaults.ts",
    name: "SUPPORT_NOTIFICATION_TASK_LOOKBACK_MINUTES",
    why: "how long a task list looks back, to keep it short",
  },
  { file: "ward-operational-defaults.ts", name: "WAIT_FILTER_SHORT_MINUTES", why: "a search filter band" },
  { file: "ward-operational-defaults.ts", name: "AFTER_HOURS_START_HOUR", why: "a clock time" },
  { file: "ward-operational-defaults.ts", name: "AFTER_HOURS_END_HOUR", why: "a clock time" },
  { file: "ward-operational-defaults.ts", name: "MORNING_HANDOVER_MINUTES", why: "a clock time" },
  { file: "ward-operational-defaults.ts", name: "BED_MEETING_MINUTES", why: "a clock time" },
  { file: "ward-operational-defaults.ts", name: "READY_AT_AHEAD_LIMIT_MINUTES", why: "input bound on a typed time" },
  {
    file: "ward-operational-defaults.ts",
    name: "DEFAULT_BROADCAST_DURATION_MINUTES",
    why: "how long a broadcast shows",
  },
  {
    file: "ward-operational-defaults.ts",
    name: "DEFAULT_BROADCAST_EXTENSION_MINUTES",
    why: "broadcast extension step",
  },
  { file: "delays/delays-board-model.ts", name: "CHART_BIN_MINUTES", why: "chart bin width" },
  { file: "discharges/discharge-board.tsx", name: "CHART_DAYS_AHEAD", why: "chart window" },
  { file: "legal-forms/legal-forms-screen.tsx", name: "CHART_WINDOW_MINUTES", why: "chart window" },
  { file: "on-call/on-call-directory.ts", name: "CHECK_DUE_DAYS", why: "when a directory entry is re-checked" },
  { file: "ward-admissions.ts", name: "PLANNED_ADMISSION_MAX_STAY_DAYS", why: "input bound on a typed date" },
  { file: "ward-admissions.ts", name: "PLANNED_ADMISSION_WINDOW_DAYS", why: "how far ahead the planned list looks" },
  { file: "ward-bed-availability.ts", name: "MIDDAY_MINUTES", why: "a day-part bin" },
  { file: "ward-bed-availability.ts", name: "LATE_AFTERNOON_MINUTES", why: "a day-part bin" },
  { file: "ward-board-derivations.ts", name: "ARROW_HORIZON_DAYS", why: "how far ahead the board draws" },
  { file: "forecast/ed-access-risk.ts", name: "RELEASE_LOOKAHEAD_DAYS", why: "how far ahead the ED risk card looks" },
  {
    file: "ward-operational-defaults.ts",
    name: "FORECAST_ED_RISK_LEAD_MINUTES",
    why: "forecast alert lead time, set in Settings",
  },
];

/** Synthetic fixtures build made-up records; their times are data, not thresholds. */
const FIXTURE_FILE = /(?:-seed\.ts|^ward-movements\.ts)$/;
const VALUES_FILE = "ward-clinical-values.ts";

function wardFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return wardFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("no clinical threshold typed outside the values file", () => {
  it("catches the shapes it looks for (anti-vacuity)", () => {
    const planted = [
      "export const TV_BED_ALERT_PERCENT = 85;",
      "const AWOL_REVIEW_MINUTES = 4 * MINUTES_PER_HOUR;",
      "const STAY_DAYS = (7);",
      "const BED_COUNT_LIMIT = 3;",
      "const LONG_WAIT_MINUTES = CLINICAL_VALUES.longWait.value;",
      "const HALF_MINUTES = LONG_WAIT_MINUTES / 2;",
    ].join("\n");
    expect(typedThresholdsIn("planted.ts", planted)).toEqual([
      "TV_BED_ALERT_PERCENT",
      "AWOL_REVIEW_MINUTES",
      "STAY_DAYS",
    ]);
  });

  it("finds every threshold constant reading the values file, or on the not-clinical list", () => {
    const found = wardFiles(WARD_DIR).flatMap((full) => {
      const file = relative(WARD_DIR, full).replaceAll("\\", "/");
      if (file === VALUES_FILE || FIXTURE_FILE.test(file)) return [];
      return typedThresholdsIn(file, readFileSync(full, "utf8")).map((name) => `${file} | ${name}`);
    });
    const allowed = new Set(NOT_CLINICAL.map((entry) => `${entry.file} | ${entry.name}`));
    expect(
      found.filter((key) => !allowed.has(key)),
      "A threshold is typed as a number. Add it to ward-clinical-values.ts with its status and source, and read it from there.",
    ).toEqual([]);
    expect(
      [...allowed].filter((key) => !found.includes(key)),
      "A not-clinical entry no longer matches a typed number: delete the line.",
    ).toEqual([]);
    for (const entry of NOT_CLINICAL) expect(entry.why.length, entry.name).toBeGreaterThan(5);
  });
});

/**
 * Inline comparisons that once carried a registry value as a bare number (Codex review, 15 Oct 2026).
 * Each shape names the rule it stands for, so a match says which value to read instead.
 */
const INLINE_SHAPES: ReadonlyArray<{ rule: string; shape: RegExp }> = [
  { rule: "lateArrivalGrace", shape: /(?:\beta|estimatedArrivalAt)\s*\+\s*\d/ },
  { rule: "longStayPrompt", shape: /\.days\s*>=?\s*\d|daysInBed\([^)]*\)\s*\?\?\s*0\)\s*>=?\s*\d/ },
  { rule: "longWait", shape: /openedAt\s*>=?\s*\d{3,}/ },
  { rule: "silentWardFirstReminder or silentWardSecondReminder", shape: /elapsedMinutes\s*[<>]=?\s*\d{2,}/ },
  { rule: "dueSoonUrgent (useDueSoonThresholds)", shape: /dueAt\s*-\s*now\s*<=?\s*\d|\bremaining\s*<=?\s*\d{2,}/ },
];

function inlineThresholdsIn(source: string): string[] {
  return source.split("\n").flatMap((line, index) => {
    if (/^\s*(?:\/\/|\*)/.test(line)) return [];
    return INLINE_SHAPES.filter(({ shape }) => shape.test(line)).map(({ rule }) => `line ${index + 1}: ${rule}`);
  });
}

describe("no clinical threshold compared inline", () => {
  it("catches the shapes it looks for (anti-vacuity)", () => {
    const planted = [
      "return now > eta + 60;",
      "occupant.days >= 7 &&",
      "(daysInBed(admission, now) ?? 0) >= 7",
      "now - movement.openedAt >= 1440,",
      "if (elapsedMinutes < 120) continue;",
      "dueAt - now < 60;",
      "tone: remaining <= 60 ? 1 : 2,",
      "// a comment saying eta + 60 is fine",
      "return now > eta + LATE_ARRIVAL_GRACE_MINUTES;",
    ].join("\n");
    expect(inlineThresholdsIn(planted).map((hit) => hit.split(": ")[0])).toEqual([
      "line 1",
      "line 2",
      "line 3",
      "line 4",
      "line 5",
      "line 6",
      "line 7",
    ]);
  });

  it("finds none in the ward directory", () => {
    const found = wardFiles(WARD_DIR).flatMap((full) => {
      const file = relative(WARD_DIR, full).replaceAll("\\", "/");
      if (file === VALUES_FILE || FIXTURE_FILE.test(file)) return [];
      return inlineThresholdsIn(readFileSync(full, "utf8")).map((hit) => `${file} ${hit}`);
    });
    expect(found, "A clinical value is compared as a bare number. Read it from ward-clinical-values.ts.").toEqual([]);
  });
});

// ---- The doc is the list --------------------------------------------------------------------

describe("docs/ward-flow/clinical-values.md", () => {
  it("carries the table built from the values file", () => {
    const doc = readFileSync(DOC_PATH, "utf8");
    const start = doc.indexOf(DOC_START);
    const end = doc.indexOf(DOC_END);
    expect(start, "the doc lost its start marker").toBeGreaterThan(-1);
    expect(end, "the doc lost its end marker").toBeGreaterThan(start);
    const expected = `${DOC_START}\n\n${clinicalValuesMarkdownTable()}\n\n${DOC_END}`;
    const actual = doc.slice(start, end + DOC_END.length);
    if (process.env.UPDATE_CLINICAL_VALUES_DOC === "1" && actual !== expected) {
      writeFileSync(DOC_PATH, doc.slice(0, start) + expected + doc.slice(end + DOC_END.length));
      return;
    }
    expect(actual, "Run this test with UPDATE_CLINICAL_VALUES_DOC=1 to rewrite the table.").toBe(expected);
  });
});
