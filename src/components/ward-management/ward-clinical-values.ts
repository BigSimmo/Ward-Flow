import {
  ED_ACCESS_TARGET_MINUTES,
  ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS,
  EXTRA_TRAVEL_HOLD_MINUTES,
  PULL_HOLD_MINUTES,
} from "@/components/ward-management/ward-model";

/**
 * CLINICAL VALUES — the one list of every threshold and timing that flags, colours or escalates a
 * patient, a referral or a bed (Josh, 15 Oct 2026, item 6: "One file of signed clinical values, each
 * marked synthetic or signed, replacing the four conflicting sets of hours").
 *
 * Every value carries its status. **Synthetic** means a prototype default nobody has clinically
 * signed: it may be Josh's product default, or a figure an earlier build typed in with no decision
 * behind it (its `source` in `ward-clinical-value-notes.ts` says which). **Signed** means a named person signed it on a date, and the
 * type will not accept a signed value without both. On 15 Oct 2026 Josh signed every value with a
 * recorded source (D-56), and two more with a national source (D-58). On 16 Oct 2026 he signed the rest,
 * changing two of them (D-63). Signing is for
 * the prototype: real patient use still needs formal clinical governance sign-off (D-54). No value
 * is a legal limit (D-22) and none comes from the Mental Health Act. Ward Flow holds no Act periods:
 * the only form due time is the one a person records (D-70, which replaced D-29).
 *
 * Where two screens used different figures for the same rule, the figure the main app runs on was
 * kept and the other is listed under `alternatives` in the notes file, so Josh can sign one. The constants the screens
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
  | "Access and privacy"
  | "Observation levels";

export type ClinicalValueEntry = ClinicalValueSignature & {
  /** What the rule does, in the words Settings lists it under. */
  readonly name: string;
  readonly group: ClinicalValueGroup;
  readonly value: number;
  readonly unit: ClinicalValueUnit;
  /** True when a coordinator can change it in Settings; the value here is then the default. */
  readonly adjustable?: boolean;
};

/** Josh signed every value with a recorded source on 15 Oct 2026 (D-56), and two with a national source (D-58). */
const SIGNED_BY_JOSH = { status: "signed", signedBy: "Josh (product owner)", signedOn: "2026-10-15" } as const;
/** Josh signed the remaining synthetic values for the prototype on 16 Oct 2026, two of them changed (D-63). */
const SIGNED_BY_JOSH_16_OCT = { status: "signed", signedBy: "Josh (product owner)", signedOn: "2026-10-16" } as const;
/** Josh signed the shared site's session limit for the prototype on 17 Oct 2026 (D-65). */
const SIGNED_BY_JOSH_17_OCT = { status: "signed", signedBy: "Josh (product owner)", signedOn: "2026-10-17" } as const;
/** Josh signed the missed bed request window for the prototype at 07:02 AWST on 20 Oct 2026. */
const SIGNED_BY_JOSH_20_OCT = { status: "signed", signedBy: "Josh (product owner)", signedOn: "2026-10-20" } as const;
/**
 * Josh chose the extra-travel bed hold (D-75 item 5) and approved the observation levels and their
 * intervals for the prototype (fix plan item 10) on 21 Oct 2026.
 */
const SIGNED_BY_JOSH_21_OCT = { status: "signed", signedBy: "Josh (product owner)", signedOn: "2026-10-21" } as const;
/** Josh approved the role access plan version 2, with its 12 month role ceiling, on 23 Oct 2026 (D-80). */
const SIGNED_BY_JOSH_23_OCT = { status: "signed", signedBy: "Josh (product owner)", signedOn: "2026-10-23" } as const;

/**
 * The name each observation level is shown under, everywhere Ward Flow shows one (fix plan item 10,
 * Josh, 21 Oct 2026). Names vary by health service, so this is the one place to change them: the
 * screens, the handover and the doc all read from here, and the stored record keeps the code, never
 * the name. Changing a name is a clinical value change and needs the same sign-off as a figure.
 */
export const OBSERVATION_LEVEL_NAMES = {
  general: "General",
  intermittent: "Intermittent",
  within_sight: "Constant within sight",
  arms_length: "Constant within arm's length",
  two_staff: "Two staff constant",
} as const satisfies Record<string, string>;

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
  },
  tierTwoOverdue: {
    ...SIGNED_BY_JOSH,
    name: "Tier 2 referral shown as overdue after",
    group: "Referral tiers",
    value: 4 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  tierThreeOverdue: {
    ...SIGNED_BY_JOSH,
    name: "Tier 3 referral shown as overdue after",
    group: "Referral tiers",
    value: 24 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  anyTierOverdue: {
    ...SIGNED_BY_JOSH,
    name: "Any referral shown as overdue after",
    group: "Referral tiers",
    value: 72 * MINUTES_PER_HOUR,
    unit: "minutes",
  },

  // ---- Emergency department waits -----------------------------------------------------------
  edElevatedPressure: {
    ...SIGNED_BY_JOSH,
    name: "ED pressure shown as elevated from a wait of",
    group: "Emergency department waits",
    value: 3 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  edSeverePressure: {
    ...SIGNED_BY_JOSH,
    name: "ED pressure shown as severe, and first escalation step, from a wait of",
    group: "Emergency department waits",
    value: 8 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  longWait: {
    ...SIGNED_BY_JOSH,
    name: "Wait in hospital shown as long, and top escalation step, from",
    group: "Emergency department waits",
    value: 24 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  veryLongWait: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Wait in hospital shown in the second, danger waiting band on statistics, from",
    group: "Emergency department waits",
    value: 48 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  edAccessTarget: {
    ...SIGNED_BY_JOSH,
    name: "ED access target, counted from arrival",
    group: "Emergency department waits",
    value: ED_ACCESS_TARGET_MINUTES,
    unit: "minutes",
    adjustable: true,
  },
  edMedicalBedRelease: {
    ...SIGNED_BY_JOSH,
    name: "Psychiatric bed released after a medical trip expected to last",
    group: "Emergency department waits",
    value: ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS,
    unit: "hours",
  },

  // ---- Bed occupancy -------------------------------------------------------------------------
  bedAlertLine: {
    ...SIGNED_BY_JOSH,
    name: "Bed alert line on the rail, statistics and meters",
    group: "Bed occupancy",
    value: 85,
    unit: "percent",
  },
  occupancyAmber: {
    ...SIGNED_BY_JOSH,
    name: "Service occupancy colour band, amber from",
    group: "Bed occupancy",
    value: 90,
    unit: "percent",
  },
  occupancySurge: {
    ...SIGNED_BY_JOSH,
    name: "Service occupancy colour band, surge from",
    group: "Bed occupancy",
    value: 95,
    unit: "percent",
  },
  occupancyCritical: {
    ...SIGNED_BY_JOSH,
    name: "Service occupancy colour band, red from",
    group: "Bed occupancy",
    value: 98,
    unit: "percent",
  },

  // ---- Legal form warnings (before a typed due time; never a computed legal limit) -----------
  dueSoonUrgent: {
    ...SIGNED_BY_JOSH,
    name: "Typed legal due time, urgent warning before it",
    group: "Legal form warnings",
    value: 1 * MINUTES_PER_HOUR,
    unit: "minutes",
    adjustable: true,
  },
  dueSoon: {
    ...SIGNED_BY_JOSH,
    name: "Typed legal due time, first warning before it",
    group: "Legal form warnings",
    value: 3 * MINUTES_PER_HOUR,
    unit: "minutes",
    adjustable: true,
  },

  // ---- Alerts and holds ----------------------------------------------------------------------
  pullNowAnswer: {
    ...SIGNED_BY_JOSH,
    name: "Unanswered Pull now returns to the coordinator after",
    group: "Alerts and holds",
    value: 15,
    unit: "minutes",
  },
  pullNowLive: {
    ...SIGNED_BY_JOSH,
    name: "Pull now stays live, if nobody pulls or stands it down, for",
    group: "Alerts and holds",
    value: 4 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  pullHold: {
    ...SIGNED_BY_JOSH,
    name: "Pull hold on an accepting bed lasts",
    group: "Alerts and holds",
    value: PULL_HOLD_MINUTES,
    unit: "minutes",
    adjustable: true,
  },
  extraTravelHold: {
    ...SIGNED_BY_JOSH_21_OCT,
    name: "Extra-travel bed hold adds",
    group: "Alerts and holds",
    value: EXTRA_TRAVEL_HOLD_MINUTES,
    unit: "minutes",
  },
  bedHoldReview: {
    ...SIGNED_BY_JOSH,
    name: "Bed hold without a confirmed dispatch flagged for review after",
    group: "Alerts and holds",
    value: 2 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  bedCountFresh: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Ward bed count named as not checked after",
    group: "Alerts and holds",
    value: 1 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  downtimePackStale: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Downtime pack shown as stale after",
    group: "Alerts and holds",
    value: 1 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  preparingBedStale: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Bed left as preparing or cleaning flagged after",
    group: "Alerts and holds",
    value: 1 * MINUTES_PER_HOUR + 1,
    unit: "minutes",
  },

  // ---- Arrivals and answers ------------------------------------------------------------------
  lateArrivalGrace: {
    ...SIGNED_BY_JOSH,
    name: "Arrival counted as late, past the estimate, after",
    group: "Arrivals and answers",
    value: 60,
    unit: "minutes",
  },
  silentWardFirstReminder: {
    ...SIGNED_BY_JOSH,
    name: "Ward that has not answered a referral, first reminder after",
    group: "Arrivals and answers",
    value: 2 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  silentWardSecondReminder: {
    ...SIGNED_BY_JOSH,
    name: "Ward that has not answered a referral, second reminder after",
    group: "Arrivals and answers",
    value: 4 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  missedRequestWindow: {
    ...SIGNED_BY_JOSH_20_OCT,
    name: "Bed request with no ward asked counted as missed after",
    group: "Arrivals and answers",
    value: 2 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  wardAnswerTarget: {
    ...SIGNED_BY_JOSH,
    name: "Decision target, ward answers a referral within",
    group: "Arrivals and answers",
    value: 2 * MINUTES_PER_HOUR,
    unit: "minutes",
    adjustable: true,
  },
  transferAcceptanceTarget: {
    ...SIGNED_BY_JOSH,
    name: "Decision target, transfer accepted within",
    group: "Arrivals and answers",
    value: 4 * MINUTES_PER_HOUR,
    unit: "minutes",
    adjustable: true,
  },
  transportBookedTarget: {
    ...SIGNED_BY_JOSH,
    name: "Decision target, transport booked within",
    group: "Arrivals and answers",
    value: 1 * MINUTES_PER_HOUR,
    unit: "minutes",
    adjustable: true,
  },
  expectFlagVoluntary: {
    ...SIGNED_BY_JOSH,
    name: "Expected arrival flagged after waiting, voluntary",
    group: "Arrivals and answers",
    value: 48 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  expectFlagInvoluntary: {
    ...SIGNED_BY_JOSH,
    name: "Expected arrival flagged after waiting, involuntary",
    group: "Arrivals and answers",
    value: 7 * HOURS_PER_DAY * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  expectReconsider: {
    ...SIGNED_BY_JOSH,
    name: "Expected referral flagged to reconsider after",
    group: "Arrivals and answers",
    value: 72 * MINUTES_PER_HOUR,
    unit: "minutes",
  },

  // ---- Discharge, leave and absence ----------------------------------------------------------
  dischargePrepWindow: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Discharge prep prompt opens before the expected discharge",
    group: "Discharge, leave and absence",
    value: 24 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  dischargeCriteriaValidity: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Criteria led discharge criteria need a fresh psychiatrist review after",
    group: "Discharge, leave and absence",
    value: 24 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  leaveOpenWarning: {
    ...SIGNED_BY_JOSH,
    name: "Leave bed flagged to consider opening after",
    group: "Discharge, leave and absence",
    value: 24 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  awolBedHoldWarning: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Bed held for a person absent without leave flagged for review after",
    group: "Discharge, leave and absence",
    value: 4 * MINUTES_PER_HOUR,
    unit: "minutes",
  },
  ctoFollowUpWindow: {
    ...SIGNED_BY_JOSH,
    name: "Community treatment order follow up booked within, after departure",
    group: "Discharge, leave and absence",
    value: 7,
    unit: "days",
  },
  longStayPrompt: {
    ...SIGNED_BY_JOSH,
    name: "Stay long enough to prompt a discharge plan, and escalation dossier, from",
    group: "Discharge, leave and absence",
    value: 7,
    unit: "days",
  },
  delayedDischargeEscalation: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Delayed discharge escalated, by recorded hours, after more than",
    group: "Discharge, leave and absence",
    value: 72,
    unit: "hours",
  },
  readmissionWindow: {
    ...SIGNED_BY_JOSH,
    name: "Readmission flag, discharged from a ward within",
    group: "Discharge, leave and absence",
    value: 28,
    unit: "days",
  },
  // ---- Access and privacy (role access plan, Josh's go, 15 Oct 2026) ------------------------
  breakGlassWindow: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Patient record opened outside your care (break glass) stays open for",
    group: "Access and privacy",
    value: 60,
    unit: "minutes",
  },
  breakGlassPerShift: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Break glass openings in one shift before the coordinator is told it is a pattern",
    group: "Access and privacy",
    value: 3,
    unit: "count",
  },
  breakGlassShift: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "One shift, when counting break glass openings for a pattern, is the last",
    group: "Access and privacy",
    value: 12,
    unit: "hours",
  },
  edHandoffWindow: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Emergency department keeps sight of a patient after they reach the ward for",
    group: "Access and privacy",
    value: 24,
    unit: "hours",
  },
  wardHandoffWindow: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Ward keeps sight of a patient after they leave, for the follow up, for",
    group: "Access and privacy",
    value: 7,
    unit: "days",
  },
  idleLock: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "A shared computer locks after no use for",
    group: "Access and privacy",
    value: 15,
    unit: "minutes",
  },
  smallNumberHidden: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Executive headline counts of people below this show as fewer than this",
    group: "Access and privacy",
    value: 5,
    unit: "count",
  },
  coverLength: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Cover for a second ward or ED, given for one shift, lasts at most",
    group: "Access and privacy",
    value: 12,
    unit: "hours",
  },
  sessionLimit: {
    ...SIGNED_BY_JOSH_17_OCT,
    name: "The signed-in shared site asks for a fresh sign-in after",
    group: "Access and privacy",
    value: 12,
    unit: "hours",
  },
  sessionWarning: {
    ...SIGNED_BY_JOSH_21_OCT,
    name: "The shared site warns that the sign-in limit is near, before it ends, by",
    group: "Access and privacy",
    value: 10,
    unit: "minutes",
  },
  stepUpWindow: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Granting access or opening a record outside your care needs a sign-in within the last",
    group: "Access and privacy",
    value: 10,
    unit: "minutes",
  },
  accessExpiringSoon: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "Access review lists a role ending within",
    group: "Access and privacy",
    value: 14,
    unit: "days",
  },
  accessUnused: {
    ...SIGNED_BY_JOSH_16_OCT,
    name: "A role not used for this long is switched off by itself",
    group: "Access and privacy",
    value: 45,
    unit: "days",
  },
  accessMaxTerm: {
    ...SIGNED_BY_JOSH_23_OCT,
    name: "A role is granted for at most",
    group: "Access and privacy",
    value: 365,
    unit: "days",
  },
  // ---- Observation levels (fix plan item 10, Josh, 21 Oct 2026) -----------------------------------
  // The level names are in `OBSERVATION_LEVEL_NAMES` above. General is hourly and the staff counts
  // (1:1 counts one, 2:1 counts two) are what the level names mean, so they are fixed in
  // `ward-observation.ts` rather than listed here as figures to edit.
  observationIntermittentShort: {
    ...SIGNED_BY_JOSH_21_OCT,
    name: OBSERVATION_LEVEL_NAMES.intermittent + " observation, shorter interval",
    group: "Observation levels",
    value: 15,
    unit: "minutes",
  },
  observationIntermittentLong: {
    ...SIGNED_BY_JOSH_21_OCT,
    name: OBSERVATION_LEVEL_NAMES.intermittent + " observation, longer interval",
    group: "Observation levels",
    value: 30,
    unit: "minutes",
  },
} satisfies Record<string, ClinicalValueEntry>;

export type ClinicalValueId = keyof typeof CLINICAL_VALUES;

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
