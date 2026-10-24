import {
  CLINICAL_VALUES,
  clinicalValueStatusText,
  formatClinicalFigure,
  type ClinicalValueEntry,
  type ClinicalValueId,
} from "@/components/ward-management/ward-clinical-values";

/**
 * Where each clinical value came from, and any other figure seen for the same rule. Settings and
 * `docs/ward-flow/clinical-values.md` show these; nothing that flags, colours or escalates reads
 * them. They live apart from `ward-clinical-values.ts` so the engine every page loads carries the
 * figures only (21 Oct 2026, phone script budget). Every value must have a note here.
 */

const MINUTES_PER_HOUR = 60;

/** Another figure some screen used, or a document named, for the same rule. */
interface ClinicalValueAlternative {
  readonly value: number;
  readonly where: string;
}

export interface ClinicalValueNote {
  /** Where the figure came from: a decisions.md id, an owner answer, or "No decision recorded". */
  readonly source: string;
  readonly alternatives?: readonly ClinicalValueAlternative[];
}

const OBSERVATION_LEVEL_SOURCE = "Fix plan item 10 (21 Oct 2026)";

const CLINICAL_VALUE_NOTES = {
  tierOneOverdue: {
    source: "D-54 (10 Oct 2026); one rule since the L4 site review, 12 Oct 2026",
    alternatives: [{ value: 8 * MINUTES_PER_HOUR, where: "Home queue before 12 Oct 2026" }],
  },
  tierTwoOverdue: {
    source: "D-54 (10 Oct 2026); one rule since the L4 site review, 12 Oct 2026",
    alternatives: [{ value: 24 * MINUTES_PER_HOUR, where: "Home queue before 12 Oct 2026" }],
  },
  tierThreeOverdue: {
    source: "D-54 (10 Oct 2026); one rule since the L4 site review, 12 Oct 2026",
    alternatives: [{ value: 72 * MINUTES_PER_HOUR, where: "Home queue before 12 Oct 2026" }],
  },
  anyTierOverdue: {
    source: "D-54 (10 Oct 2026)",
  },
  edElevatedPressure: {
    source: "D-22 (26 Sep 2026), labelled default",
  },
  edSeverePressure: {
    source: "D-22 (26 Sep 2026), labelled default; the ACEM eight hour line came off screens under D-24",
  },
  longWait: {
    source: "D-24 (26 Sep 2026), Josh's default, shown neutral",
  },
  veryLongWait: {
    source: "D-63 (16 Oct 2026), twice the long wait, a display band with no WA or national mark",
  },
  edAccessTarget: {
    source: "Owner ruling 22 Aug 2026 (ward-model.ts provenance)",
    alternatives: [{ value: 4 * MINUTES_PER_HOUR, where: "the original spec, superseded 22 Aug 2026" }],
  },
  edMedicalBedRelease: {
    source: "FD-19 (30 Aug 2026) (ward-model.ts provenance)",
  },
  bedAlertLine: {
    source: "Josh, v6 shell boards 02 and 03b, 7 Oct 2026; D-24 had taken the eighty five line off until sourced",
    alternatives: [
      { value: 90, where: "the occupancy colour band, and All wards before 11 Oct 2026" },
      { value: 90, where: "the WEAT target line removed under D-24" },
    ],
  },
  occupancyAmber: {
    source: "D-22 (26 Sep 2026), labelled default",
    alternatives: [{ value: 85, where: "the bed alert line" }],
  },
  occupancySurge: {
    source: "D-22 (26 Sep 2026), labelled default",
  },
  occupancyCritical: {
    source: "D-22 (26 Sep 2026), labelled default",
  },
  dueSoonUrgent: {
    source: "D-24 (26 Sep 2026), Josh's default",
  },
  dueSoon: {
    source: "D-24 (26 Sep 2026), Josh's default",
  },
  pullNowAnswer: {
    source: "Josh accepted, global alerts option A, 10 Oct 2026",
  },
  pullNowLive: {
    source: "Global alerts option A, 10 Oct 2026",
  },
  pullHold: {
    source: "Owner answer 35, 17 Sep 2026 (ward-model.ts provenance)",
  },
  extraTravelHold: {
    source: "Josh, 21 Oct 2026, D-75 item 5 (ward-model.ts provenance)",
  },
  bedHoldReview: {
    source: "Josh, 26 Sep 2026, his default",
  },
  bedCountFresh: {
    source: "D-63 (16 Oct 2026), local workflow choice, no external source",
  },
  downtimePackStale: {
    source:
      "D-63 (16 Oct 2026), local workflow choice; each health service's business continuity plan sets downtime report refresh",
  },
  preparingBedStale: {
    source: "D-63 (16 Oct 2026), more than an hour, local workflow choice",
  },
  lateArrivalGrace: {
    source: "D-22 (26 Sep 2026), labelled default",
  },
  silentWardFirstReminder: {
    source: "D-22 (26 Sep 2026), labelled default",
  },
  silentWardSecondReminder: {
    source: "D-22 (26 Sep 2026), labelled default",
  },
  missedRequestWindow: {
    source:
      "Product brief success measure 2 (25 Sep 2026); signed off by owner Josh, 07:02 AWST 20 Oct 2026, prototype",
  },
  wardAnswerTarget: {
    source: "Stream A, 9 Oct 2026, labelled default",
  },
  transferAcceptanceTarget: {
    source: "Stream A, 9 Oct 2026, labelled default",
  },
  transportBookedTarget: {
    source: "Stream A, 9 Oct 2026, labelled default",
  },
  expectFlagVoluntary: {
    source: "Josh, 7 Sep 2026",
  },
  expectFlagInvoluntary: {
    source: "Josh, 7 Sep 2026",
  },
  expectReconsider: {
    source: "Josh, 7 Sep 2026",
  },
  dischargePrepWindow: {
    source:
      "D-63 (16 Oct 2026), local workflow choice; matches the pre-discharge medical review window in the WACHS Criteria Led Discharge Guideline",
  },
  dischargeCriteriaValidity: {
    source:
      "D-63 (16 Oct 2026), WACHS Criteria Led Discharge Guideline (16 Apr 2026), s 2.5 and s 3: a medical review within this window before discharge. Shortened from the D-60 figure",
  },
  leaveOpenWarning: {
    source: "D-23 (26 Sep 2026), Josh's default",
  },
  awolBedHoldWarning: {
    source:
      "D-63 (16 Oct 2026), local workflow choice; MP 0012/16 leaves AWOL procedures to each health service. Review warning paused by D-65, then switched on again on 20 Oct 2026 when Josh turned on all features (flag awol-bed-hold-review)",
  },
  ctoFollowUpWindow: {
    source:
      "D-58 (15 Oct 2026), 7 days from the national KPI for community care within 7 days of discharge (AIHW). The KPI counts a completed contact after discharge from a public acute mental health unit. This check looks for a booking within the window on every discharge, with extra items for a CTO patient",
  },
  longStayPrompt: {
    source: "Ward board long stay line; no decision recorded for the Top 25 dossier",
  },
  delayedDischargeEscalation: {
    source: "D-63 (16 Oct 2026), local workflow choice, counted from the typed expected date",
  },
  readmissionWindow: {
    source: "D-58 (15 Oct 2026), national mental health KPI for readmission within 28 days (AIHW); a prompt to look",
  },
  breakGlassWindow: {
    source: "D-63 (16 Oct 2026), local privacy choice under MP 0015/16 need to know and audit",
  },
  breakGlassPerShift: {
    source: "D-63 (16 Oct 2026), local privacy choice; every opening is still reviewed",
  },
  breakGlassShift: {
    source: "D-63 (16 Oct 2026), the longest common WA shift",
  },
  edHandoffWindow: {
    source: "D-63 (16 Oct 2026), local privacy choice",
  },
  wardHandoffWindow: {
    source: "D-63 (16 Oct 2026), the same figure as the 7 day follow up",
  },
  idleLock: {
    source:
      "D-63 (16 Oct 2026), Australian Government ISM-0428: lock after at most 15 minutes of inactivity. Checked against the September 2026 ISM on cyber.gov.au (D-65)",
  },
  smallNumberHidden: {
    source: "D-63 (16 Oct 2026), common Australian small cell practice (counts under 5)",
  },
  coverLength: {
    source: "D-63 (16 Oct 2026), one shift, the same figure as the break glass shift",
  },
  sessionLimit: {
    source:
      "D-65 (17 Oct 2026), Australian Government ISM-0428: sessions end after at most twelve hours. Checked against the September 2026 ISM on cyber.gov.au",
  },
  stepUpWindow: {
    source: "D-63 (16 Oct 2026), local security choice, stricter than NIST SP 800-63B",
  },
  accessExpiringSoon: {
    source: "D-63 (16 Oct 2026), local choice, two weeks to renew",
  },
  accessUnused: {
    source:
      "D-63 (16 Oct 2026), Australian Government ISM-1404 and ISM-1648: access disabled after 45 days of inactivity. Was 90 days. Checked against the September 2026 ISM on cyber.gov.au (D-65)",
  },
  accessMaxTerm: {
    source: "D-80 (23 Oct 2026), a 12 month ceiling that fits the quarterly access review",
  },
  observationIntermittentShort: {
    source: OBSERVATION_LEVEL_SOURCE,
  },
  observationIntermittentLong: {
    source: OBSERVATION_LEVEL_SOURCE,
  },
} satisfies Record<ClinicalValueId, ClinicalValueNote>;

/** Every value as a list, with its id, in the order Settings and the doc show them. */
export const CLINICAL_VALUE_LIST: readonly (ClinicalValueEntry &
  ClinicalValueNote & { readonly id: ClinicalValueId })[] = (Object.keys(CLINICAL_VALUES) as ClinicalValueId[]).map(
  (id) => ({ id, ...(CLINICAL_VALUES[id] as ClinicalValueEntry), ...(CLINICAL_VALUE_NOTES[id] as ClinicalValueNote) }),
);

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
