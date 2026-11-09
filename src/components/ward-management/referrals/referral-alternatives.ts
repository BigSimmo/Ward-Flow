/**
 * Feature 26, alternatives to admission (Josh, 9 Nov 2026).
 *
 * Before a bed request, community and emergency staff may mark what was considered instead of a
 * ward bed. Each option is marked "Not suitable", "Tried" or "Declined by patient", or left
 * unmarked. The list is unranked and always in this fixed order. It never blocks a bed request,
 * never recommends one and never scores anything (Clinical Safety Case §2.3).
 *
 * The service names are generic placeholders, so every surface that shows them also shows
 * `ALTERNATIVES_LOCAL_NOTE`. Every value here is a fixed-list choice, never typed text.
 */

/** Fixed display order. Never sorted, ranked or filtered by anything about the patient. */
export const ADMISSION_ALTERNATIVE_OPTIONS = [
  "crisis_team_home_visit",
  "hospital_in_the_home",
  "step_up_step_down_unit",
  "short_stay_unit",
  "next_day_community_follow_up",
] as const;
export type AdmissionAlternativeOption = (typeof ADMISSION_ALTERNATIVE_OPTIONS)[number];

export const ADMISSION_ALTERNATIVE_LABELS: Readonly<Record<AdmissionAlternativeOption, string>> = {
  crisis_team_home_visit: "Crisis team home visit",
  hospital_in_the_home: "Mental Health Hospital in the Home",
  step_up_step_down_unit: "Step-up/step-down unit",
  short_stay_unit: "Short-stay unit",
  next_day_community_follow_up: "Next-day community follow-up",
};

export const ADMISSION_ALTERNATIVE_OUTCOMES = ["not_suitable", "tried", "declined"] as const;
export type AdmissionAlternativeOutcome = (typeof ADMISSION_ALTERNATIVE_OUTCOMES)[number];

export const ADMISSION_ALTERNATIVE_OUTCOME_LABELS: Readonly<Record<AdmissionAlternativeOutcome, string>> = {
  not_suitable: "Not suitable",
  tried: "Tried",
  declined: "Declined by patient",
};

/** One marked option. An unmarked option is simply absent. */
export type AlternativeConsidered = {
  option: AdmissionAlternativeOption;
  outcome: AdmissionAlternativeOutcome;
};

export const ALTERNATIVES_LOCAL_NOTE = "Check local services before clinical use.";

const isOption = (value: unknown): value is AdmissionAlternativeOption =>
  (ADMISSION_ALTERNATIVE_OPTIONS as readonly unknown[]).includes(value);
const isOutcome = (value: unknown): value is AdmissionAlternativeOutcome =>
  (ADMISSION_ALTERNATIVE_OUTCOMES as readonly unknown[]).includes(value);

/** The sheet's marks before Send, as a kept draft holds them: option to outcome. */
export type AlternativeMarks = Partial<Record<AdmissionAlternativeOption, AdmissionAlternativeOutcome>>;

/** A kept draft's marks: listed options with listed outcomes and nothing else. */
export function isAlternativeMarks(value: unknown): value is AlternativeMarks {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries(value).every(([option, outcome]) => isOption(option) && isOutcome(outcome))
  );
}

/**
 * Why a supplied list cannot be stored, or `null` when it can. A present list must hold one to
 * five entries, each a listed option with a listed outcome and nothing else, no option twice.
 */
export function alternativesConsideredError(value: unknown): string | null {
  if (!Array.isArray(value)) return "alternatives considered must be a list";
  if (value.length === 0) return "alternatives considered is present but empty: omit it to record none";
  if (value.length > ADMISSION_ALTERNATIVE_OPTIONS.length) return "alternatives considered lists too many options";
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry))
      return "each alternative considered must be an option and an outcome";
    const keys = Object.keys(entry).sort();
    if (keys.length !== 2 || keys[0] !== "option" || keys[1] !== "outcome")
      return "each alternative considered holds only an option and an outcome";
    const { option, outcome } = entry as Record<string, unknown>;
    if (!isOption(option)) return "alternative option must be chosen from ADMISSION_ALTERNATIVE_OPTIONS";
    if (!isOutcome(outcome)) return "alternative outcome must be chosen from ADMISSION_ALTERNATIVE_OUTCOMES";
    if (seen.has(option)) return "an alternative option is listed twice";
    seen.add(option);
  }
  return null;
}

/** The marked entries in the fixed order, whatever order they were marked in. */
export function orderedAlternatives(
  marks: Partial<Record<AdmissionAlternativeOption, AdmissionAlternativeOutcome>>,
): AlternativeConsidered[] {
  return ADMISSION_ALTERNATIVE_OPTIONS.flatMap((option) => {
    const outcome = marks[option];
    return outcome ? [{ option, outcome }] : [];
  });
}

/** "2 of 5 considered", or "None marked". A count of marks, never a score. */
export function alternativesSummary(list: readonly AlternativeConsidered[] | undefined): string {
  const count = list?.length ?? 0;
  return count === 0 ? "None marked" : `${count} of ${ADMISSION_ALTERNATIVE_OPTIONS.length} considered`;
}

/** One read-only line per marked option, in the fixed order: "Short-stay unit: Tried". */
export function alternativesLines(list: readonly AlternativeConsidered[] | undefined): string[] {
  const byOption = new Map((list ?? []).map((entry) => [entry.option, entry.outcome]));
  return ADMISSION_ALTERNATIVE_OPTIONS.flatMap((option) => {
    const outcome = byOption.get(option);
    return outcome ? [`${ADMISSION_ALTERNATIVE_LABELS[option]}: ${ADMISSION_ALTERNATIVE_OUTCOME_LABELS[outcome]}`] : [];
  });
}
