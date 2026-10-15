import {
  ED_ACCESS_TARGET_MINUTES,
  ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS,
  PULL_HOLD_MINUTES,
} from "@/components/ward-management/ward-model";

/**
 * CLINICAL VALUES — the one list of every threshold and timing that flags, colours or escalates a
 * patient, a referral or a bed (Josh, 15 Oct 2026, item 6: "One file of signed clinical values, each
 * marked synthetic or signed, replacing the four conflicting sets of hours").
 *
 * Every value carries its status. **Synthetic** means a prototype default nobody has clinically
 * signed: it may be Josh's product default, or a figure an earlier build typed in with no decision
 * behind it (`source` says which). **Signed** means a named person signed it on a date, and the
 * type will not accept a signed value without both. On 15 Oct 2026 Josh signed every value with a
 * recorded source (D-56), and two more with a national source (D-58). The rest stay synthetic. Signing is for
 * the prototype: real patient use still needs formal clinical governance sign-off (D-54). No value
 * is a legal limit (D-22) and none comes from the Mental Health Act: Act periods live only in
 * `legal-forms/act-periods-demo.ts` (D-29).
 *
 * Where two screens used different figures for the same rule, the figure the main app runs on was
 * kept and the other is listed under `alternatives`, so Josh can sign one. The constants the screens
 * import (`ward-operational-defaults.ts`, `shell/ward-service-bed-alerts.ts`, the Top 25 features
 * and two v10 screens) now read their numbers from here. `tests/ward-clinical-values.test.ts`
 * fails if a threshold constant is typed as a number anywhere else in the ward directory, and pins
 * `docs/ward-flow/clinical-values.md` to this list.
 *
 * Three values stay written in `ward-model.ts`, where the legal figure guard keeps their provenance
 * (`MODEL_CONSTANT_PROVENANCE`): the ED access target, the pull hold and the ED medical bed release.
 * They are read in here so this list is complete, and their status lives here like every other.
 *
 * This module is pure data. It imports nothing but those three numbers.
 */

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

export type ClinicalValueUnit = "minutes" | "hours" | "days" | "percent" | "count";

/** A value is synthetic until a named person signs it for the prototype on a date (D-56). */
export type ClinicalValueSignature =
  | { readonly status: "synthetic" }
  | { readonly status: "signed"; readonly signedBy: string; readonly signedOn: string };

type ClinicalValueGroup =
  | "Referral tiers"
  | "Emergency department waits"
  | "Bed occupancy"
  | "Legal form warnings"
  | "Alerts and holds"
  | "Arrivals and answers"
  | "Discharge, leave and absence"
  | "Access and privacy";

/** Another figure some screen used, or a document named, for the same rule. */
interface ClinicalValueAlternative {
  readonly value: number;
  readonly where: string;
}

export type ClinicalValueEntry = ClinicalValueSignature & {
  /** What the rule does, in the words Settings lists it under. */
  readonly name: string;
  readonly group: ClinicalValueGroup;
  readonly value: number;
  readonly unit: ClinicalValueUnit;
  /** Where the figure came from: a decisions.md id, an owner answer, or "No decision recorded". */
  readonly source: string;
  /** True when a coordinator can change it in Settings; the value here is then the default. */
  readonly adjustable?: boolean;
  readonly alternatives?: readonly ClinicalValueAlternative[];
};

const SYNTHETIC = { status: "synthetic" } as const;
/** Josh signed every value with a recorded source on 15 Oct 2026 (D-56), and two with a national source (D-58). */
const SIGNED_BY_JOSH = { status: "signed", signedBy: "Josh (product owner)", signedOn: "2026-10-15" } as const;
const NO_DECISION = "No decision recorded";

/**
 * Every clinical value, keyed for typed reads (`CLINICAL_VALUES.tierOneOverdue.value`). The order
 * is the order Settings and the doc list them in.
 */
export const CLINICAL_VALUES = {
  // ---- Referral tiers ----------------------------------------------------------------------
  tierOneOverdue: {
    ...SIGNED_BY_JOSH,
    name: "Tier 1 referral shown as overdue after",
    group: "Referral tiers",
    value: 1 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "D-54 (10 Oct 2026); one rule since the L4 site review, 12 Oct 2026",
    alternatives: [{ value: 8 * MINUTES_PER_HOUR, where: "Home queue before 12 Oct 2026" }],
  },
  tierTwoOverdue: {
    ...SIGNED_BY_JOSH,
    name: "Tier 2 referral shown as overdue after",
    group: "Referral tiers",
    value: 4 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "D-54 (10 Oct 2026); one rule since the L4 site review, 12 Oct 2026",
    alternatives: [{ value: 24 * MINUTES_PER_HOUR, where: "Home queue before 12 Oct 2026" }],
  },
  tierThreeOverdue: {
    ...SIGNED_BY_JOSH,
    name: "Tier 3 referral shown as overdue after",
    group: "Referral tiers",
    value: 24 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "D-54 (10 Oct 2026); one rule since the L4 site review, 12 Oct 2026",
    alternatives: [{ value: 72 * MINUTES_PER_HOUR, where: "Home queue before 12 Oct 2026" }],
  },
  anyTierOverdue: {
    ...SIGNED_BY_JOSH,
    name: "Any referral shown as overdue after",
    group: "Referral tiers",
    value: 72 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "D-54 (10 Oct 2026)",
  },

  // ---- Emergency department waits -----------------------------------------------------------
  edElevatedPressure: {
    ...SIGNED_BY_JOSH,
    name: "ED pressure shown as elevated from a wait of",
    group: "Emergency department waits",
    value: 3 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "D-22 (26 Sep 2026), labelled default",
  },
  edSeverePressure: {
    ...SIGNED_BY_JOSH,
    name: "ED pressure shown as severe, and first escalation step, from a wait of",
    group: "Emergency department waits",
    value: 8 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "D-22 (26 Sep 2026), labelled default; the ACEM eight hour line came off screens under D-24",
  },
  longWait: {
    ...SIGNED_BY_JOSH,
    name: "Wait in hospital shown as long, and top escalation step, from",
    group: "Emergency department waits",
    value: 24 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "D-24 (26 Sep 2026), Josh's default, shown neutral",
  },
  veryLongWait: {
    ...SYNTHETIC,
    name: "Wait in hospital shown in the second, danger waiting band on statistics, from",
    group: "Emergency department waits",
    value: 48 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: `${NO_DECISION} (twice the long wait, statistics screens, 26 Sep 2026)`,
  },
  edAccessTarget: {
    ...SIGNED_BY_JOSH,
    name: "ED access target, counted from arrival",
    group: "Emergency department waits",
    value: ED_ACCESS_TARGET_MINUTES,
    unit: "minutes",
    source: "Owner ruling 22 Aug 2026 (ward-model.ts provenance)",
    adjustable: true,
    alternatives: [{ value: 4 * MINUTES_PER_HOUR, where: "the original spec, superseded 22 Aug 2026" }],
  },
  edMedicalBedRelease: {
    ...SIGNED_BY_JOSH,
    name: "Psychiatric bed released after a medical trip expected to last",
    group: "Emergency department waits",
    value: ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS,
    unit: "hours",
    source: "FD-19 (30 Aug 2026) (ward-model.ts provenance)",
  },

  // ---- Bed occupancy -------------------------------------------------------------------------
  bedAlertLine: {
    ...SIGNED_BY_JOSH,
    name: "Bed alert line on the rail, statistics and meters",
    group: "Bed occupancy",
    value: 85,
    unit: "percent",
    source: "Josh, v6 shell boards 02 and 03b, 7 Oct 2026; D-24 had taken the eighty five line off until sourced",
    alternatives: [
      { value: 90, where: "the occupancy colour band, and All wards before 11 Oct 2026" },
      { value: 90, where: "the WEAT target line removed under D-24" },
    ],
  },
  occupancyAmber: {
    ...SIGNED_BY_JOSH,
    name: "Service occupancy colour band, amber from",
    group: "Bed occupancy",
    value: 90,
    unit: "percent",
    source: "D-22 (26 Sep 2026), labelled default",
    alternatives: [{ value: 85, where: "the bed alert line" }],
  },
  occupancySurge: {
    ...SIGNED_BY_JOSH,
    name: "Service occupancy colour band, surge from",
    group: "Bed occupancy",
    value: 95,
    unit: "percent",
    source: "D-22 (26 Sep 2026), labelled default",
  },
  occupancyCritical: {
    ...SIGNED_BY_JOSH,
    name: "Service occupancy colour band, red from",
    group: "Bed occupancy",
    value: 98,
    unit: "percent",
    source: "D-22 (26 Sep 2026), labelled default",
  },

  // ---- Legal form warnings (before a typed due time; never a computed legal limit) -----------
  dueSoonUrgent: {
    ...SIGNED_BY_JOSH,
    name: "Typed legal due time, urgent warning before it",
    group: "Legal form warnings",
    value: 1 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "D-24 (26 Sep 2026), Josh's default",
    adjustable: true,
  },
  dueSoon: {
    ...SIGNED_BY_JOSH,
    name: "Typed legal due time, first warning before it",
    group: "Legal form warnings",
    value: 3 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "D-24 (26 Sep 2026), Josh's default",
    adjustable: true,
  },

  // ---- Alerts and holds ----------------------------------------------------------------------
  pullNowAnswer: {
    ...SIGNED_BY_JOSH,
    name: "Unanswered Pull now returns to the coordinator after",
    group: "Alerts and holds",
    value: 15,
    unit: "minutes",
    source: "Josh accepted, global alerts option A, 10 Oct 2026",
  },
  pullNowLive: {
    ...SIGNED_BY_JOSH,
    name: "Pull now stays live, if nobody pulls or stands it down, for",
    group: "Alerts and holds",
    value: 4 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "Global alerts option A, 10 Oct 2026",
  },
  pullHold: {
    ...SIGNED_BY_JOSH,
    name: "Pull hold on an accepting bed lasts",
    group: "Alerts and holds",
    value: PULL_HOLD_MINUTES,
    unit: "minutes",
    source: "Owner answer 35, 17 Sep 2026 (ward-model.ts provenance)",
    adjustable: true,
  },
  bedHoldReview: {
    ...SIGNED_BY_JOSH,
    name: "Bed hold without a confirmed dispatch flagged for review after",
    group: "Alerts and holds",
    value: 2 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "Josh, 26 Sep 2026, his default",
  },
  bedCountFresh: {
    ...SYNTHETIC,
    name: "Ward bed count named as not checked after",
    group: "Alerts and holds",
    value: 1 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: `${NO_DECISION} (v10 Home, 10 Oct 2026)`,
  },
  downtimePackStale: {
    ...SYNTHETIC,
    name: "Downtime pack shown as stale after",
    group: "Alerts and holds",
    value: 1 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: `${NO_DECISION} (v10 Downtime pack, 10 Oct 2026)`,
  },
  preparingBedStale: {
    ...SYNTHETIC,
    name: "Bed left as preparing or cleaning flagged after",
    group: "Alerts and holds",
    value: 1 * MINUTES_PER_HOUR + 1,
    unit: "minutes",
    source: `${NO_DECISION} (Top 25 ghost bed clear, 15 Oct 2026)`,
  },

  // ---- Arrivals and answers ------------------------------------------------------------------
  lateArrivalGrace: {
    ...SIGNED_BY_JOSH,
    name: "Arrival counted as late, past the estimate, after",
    group: "Arrivals and answers",
    value: 60,
    unit: "minutes",
    source: "D-22 (26 Sep 2026), labelled default",
  },
  silentWardFirstReminder: {
    ...SIGNED_BY_JOSH,
    name: "Ward that has not answered a referral, first reminder after",
    group: "Arrivals and answers",
    value: 2 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "D-22 (26 Sep 2026), labelled default",
  },
  silentWardSecondReminder: {
    ...SIGNED_BY_JOSH,
    name: "Ward that has not answered a referral, second reminder after",
    group: "Arrivals and answers",
    value: 4 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "D-22 (26 Sep 2026), labelled default",
  },
  wardAnswerTarget: {
    ...SIGNED_BY_JOSH,
    name: "Decision target, ward answers a referral within",
    group: "Arrivals and answers",
    value: 2 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "Stream A, 9 Oct 2026, labelled default",
    adjustable: true,
  },
  transferAcceptanceTarget: {
    ...SIGNED_BY_JOSH,
    name: "Decision target, transfer accepted within",
    group: "Arrivals and answers",
    value: 4 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "Stream A, 9 Oct 2026, labelled default",
    adjustable: true,
  },
  transportBookedTarget: {
    ...SIGNED_BY_JOSH,
    name: "Decision target, transport booked within",
    group: "Arrivals and answers",
    value: 1 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "Stream A, 9 Oct 2026, labelled default",
    adjustable: true,
  },
  expectFlagVoluntary: {
    ...SIGNED_BY_JOSH,
    name: "Expected arrival flagged after waiting, voluntary",
    group: "Arrivals and answers",
    value: 48 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "Josh, 7 Sep 2026",
  },
  expectFlagInvoluntary: {
    ...SIGNED_BY_JOSH,
    name: "Expected arrival flagged after waiting, involuntary",
    group: "Arrivals and answers",
    value: 7 * HOURS_PER_DAY * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "Josh, 7 Sep 2026",
  },
  expectReconsider: {
    ...SIGNED_BY_JOSH,
    name: "Expected referral flagged to reconsider after",
    group: "Arrivals and answers",
    value: 72 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "Josh, 7 Sep 2026",
  },

  // ---- Discharge, leave and absence ----------------------------------------------------------
  dischargePrepWindow: {
    ...SYNTHETIC,
    name: "Discharge prep prompt opens before the expected discharge",
    group: "Discharge, leave and absence",
    value: 24 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: `${NO_DECISION} (Top 25 discharge prep, 15 Oct 2026)`,
  },
  leaveOpenWarning: {
    ...SIGNED_BY_JOSH,
    name: "Leave bed flagged to consider opening after",
    group: "Discharge, leave and absence",
    value: 24 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: "D-23 (26 Sep 2026), Josh's default",
  },
  awolBedHoldWarning: {
    ...SYNTHETIC,
    name: "Bed held for a person absent without leave flagged for review after",
    group: "Discharge, leave and absence",
    value: 4 * MINUTES_PER_HOUR,
    unit: "minutes",
    source: `${NO_DECISION} (Top 25 absence tracker, 15 Oct 2026)`,
  },
  ctoFollowUpWindow: {
    ...SIGNED_BY_JOSH,
    name: "Community treatment order follow up booked within, after departure",
    group: "Discharge, leave and absence",
    value: 7,
    unit: "days",
    source:
      "D-58 (15 Oct 2026), 7 days from the national KPI for community care within 7 days of discharge (AIHW). The KPI counts a completed contact after discharge from a public acute mental health unit. This check looks for a booking within the window on every discharge, with extra items for a CTO patient",
  },
  longStayPrompt: {
    ...SIGNED_BY_JOSH,
    name: "Stay long enough to prompt a discharge plan, and escalation dossier, from",
    group: "Discharge, leave and absence",
    value: 7,
    unit: "days",
    source: "Ward board long stay line; no decision recorded for the Top 25 dossier",
  },
  delayedDischargeEscalation: {
    ...SYNTHETIC,
    name: "Delayed discharge escalated, by recorded hours, after more than",
    group: "Discharge, leave and absence",
    value: 72,
    unit: "hours",
    source: `${NO_DECISION} (Top 25 long stay dossier, 15 Oct 2026)`,
  },
  readmissionWindow: {
    ...SIGNED_BY_JOSH,
    name: "Readmission flag, discharged from a ward within",
    group: "Discharge, leave and absence",
    value: 28,
    unit: "days",
    source: "D-58 (15 Oct 2026), national mental health KPI for readmission within 28 days (AIHW); a prompt to look",
  },
  // ---- Access and privacy (role access plan, Josh's go, 15 Oct 2026) ------------------------
  breakGlassWindow: {
    ...SYNTHETIC,
    name: "Patient record opened outside your care (break glass) stays open for",
    group: "Access and privacy",
    value: 60,
    unit: "minutes",
    source: `${NO_DECISION} (role access plan, 15 Oct 2026)`,
  },
  breakGlassPerShift: {
    ...SYNTHETIC,
    name: "Break glass openings in one shift before the coordinator is told it is a pattern",
    group: "Access and privacy",
    value: 3,
    unit: "count",
    source: `${NO_DECISION} (role access plan, 15 Oct 2026)`,
  },
  breakGlassShift: {
    ...SYNTHETIC,
    name: "One shift, when counting break glass openings for a pattern, is the last",
    group: "Access and privacy",
    value: 12,
    unit: "hours",
    source: `${NO_DECISION} (role access plan, 15 Oct 2026)`,
  },
  edHandoffWindow: {
    ...SYNTHETIC,
    name: "Emergency department keeps sight of a patient after they reach the ward for",
    group: "Access and privacy",
    value: 24,
    unit: "hours",
    source: `${NO_DECISION} (role access plan, 15 Oct 2026)`,
  },
  wardHandoffWindow: {
    ...SYNTHETIC,
    name: "Ward keeps sight of a patient after they leave, for the follow up, for",
    group: "Access and privacy",
    value: 7,
    unit: "days",
    source: `${NO_DECISION} (role access plan, 15 Oct 2026); the same figure as the 7 day follow up`,
  },
  idleLock: {
    ...SYNTHETIC,
    name: "A shared computer locks after no use for",
    group: "Access and privacy",
    value: 15,
    unit: "minutes",
    source: `${NO_DECISION} (role access plan, 15 Oct 2026)`,
  },
  smallNumberHidden: {
    ...SYNTHETIC,
    name: "Executive headline counts of people below this show as fewer than this",
    group: "Access and privacy",
    value: 5,
    unit: "count",
    source: `${NO_DECISION} (role access plan, 15 Oct 2026)`,
  },
} satisfies Record<string, ClinicalValueEntry>;

export type ClinicalValueId = keyof typeof CLINICAL_VALUES;

/** Every value as a list, with its id, in the order Settings and the doc show them. */
export const CLINICAL_VALUE_LIST: readonly (ClinicalValueEntry & { readonly id: ClinicalValueId })[] = (
  Object.keys(CLINICAL_VALUES) as ClinicalValueId[]
).map((id) => ({ id, ...(CLINICAL_VALUES[id] as ClinicalValueEntry) }));

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** A figure in its own unit as people read it: "15 minutes", "4 hours", "7 days", "85%". */
export function formatClinicalFigure(value: number, unit: ClinicalValueUnit): string {
  if (unit === "percent") return `${value}%`;
  if (unit === "count") return String(value);
  if (unit === "days") return plural(value, "day");
  if (unit === "hours") return plural(value, "hour");
  if (value % (HOURS_PER_DAY * MINUTES_PER_HOUR) === 0 && value >= 7 * HOURS_PER_DAY * MINUTES_PER_HOUR)
    return plural(value / (HOURS_PER_DAY * MINUTES_PER_HOUR), "day");
  if (value % MINUTES_PER_HOUR === 0) return plural(value / MINUTES_PER_HOUR, "hour");
  return plural(value, "minute");
}

/** The status as Settings shows it: "Synthetic value", or "Signed for the prototype by Dr A, 2026-11-01". */
export function clinicalValueStatusText(entry: ClinicalValueSignature): string {
  return entry.status === "signed"
    ? `Signed for the prototype by ${entry.signedBy}, ${entry.signedOn}`
    : "Synthetic value";
}

/** True only when every named value is signed. */
export function allClinicalValuesSigned(ids: readonly ClinicalValueId[]): boolean {
  return ids.every((id) => (CLINICAL_VALUES[id] as ClinicalValueEntry).status === "signed");
}

/** How many values still wait on a clinical signature. */
export function unsignedClinicalValueCount(): number {
  return CLINICAL_VALUE_LIST.filter((entry) => entry.status !== "signed").length;
}

/**
 * The table `docs/ward-flow/clinical-values.md` carries between its markers. The doc is never
 * edited by hand: `tests/ward-clinical-values.test.ts` fails when it drifts, and
 * `UPDATE_CLINICAL_VALUES_DOC=1` on that test rewrites it.
 */
export function clinicalValuesMarkdownTable(): string {
  const cell = (text: string) => text.replaceAll("|", "\\|");
  // Plain concatenation, no nested templates: the travel-band guard's comment scanner reads this file.
  const rows = CLINICAL_VALUE_LIST.map((entry) => {
    const alternatives = (entry.alternatives ?? [])
      .map((alt) => formatClinicalFigure(alt.value, entry.unit) + " (" + alt.where + ")")
      .join("; ");
    const cells = [
      entry.group,
      entry.name,
      formatClinicalFigure(entry.value, entry.unit) + (entry.adjustable ? ", default, changeable in Settings" : ""),
      clinicalValueStatusText(entry),
      entry.source,
      alternatives || "None recorded",
      "`" + entry.id + "`",
    ];
    return "| " + cells.map(cell).join(" | ") + " |";
  });
  return [
    "| Group | Rule | Value | Status | Source | Other figures seen | Id |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}
