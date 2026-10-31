// Settings round 3 (mock-up, 30 Oct 2026): what each rule changes on today's records, read with the
// app's own predicates and never re-derived. A rule with no such predicate shows nothing rather than
// an invented figure (Morning bed numbers due, the forecast alerts).
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import { publishedThresholds } from "@/components/ward-management/settings/settings-thresholds";
import { clockState, dueSoonThresholdsOf, type Instant } from "@/components/ward-management/ward-clock";
import type { WardConfiguration } from "@/components/ward-management/ward-configuration";
import { decisionTargetReading } from "@/components/ward-management/ward-decision-targets";
import type { Movement } from "@/components/ward-management/ward-model";

import type { RuleKey } from "./settings-rule-catalogue";

export type RuleImpact = {
  /** Records the rule reaches with this configuration. */
  readonly count: number;
  /** "past the target", "in Early warning": read after the count. */
  readonly words: string;
};

type StepKey = "referral_decision" | "transfer_acceptance" | "transport_booked";

function overdueSteps(movements: readonly Movement[], now: Instant, configuration: WardConfiguration, step: StepKey) {
  return movements.filter((movement) => {
    const reading = decisionTargetReading(movement, now, configuration);
    return reading?.step === step && reading.overdue;
  }).length;
}

/** Forms whose recorded due time is in a warning now. Only the typed due time is read (D-70). */
function formsInWarning(
  movements: readonly Movement[],
  now: Instant,
  configuration: WardConfiguration,
  state: "due" | "critical",
) {
  const thresholds = dueSoonThresholdsOf(configuration);
  return movements.filter((movement) => {
    if (movement.closure) return false;
    const dueAt = currentLegalDueAt(movement);
    return dueAt !== undefined && clockState(dueAt, now, thresholds) === state;
  }).length;
}

/** The impact of one rule at one configuration, or null where the app has no predicate to read. */
export function ruleImpact(
  key: RuleKey,
  movements: readonly Movement[],
  now: Instant,
  configuration: WardConfiguration,
): RuleImpact | null {
  switch (key) {
    case "ed":
      return {
        count:
          publishedThresholds(movements, now, configuration).find((row) => row.id === "ed-access-target")?.reached ?? 0,
        // Final round: "past target", as the referral, transfer and booking counts read.
        words: "past target",
      };
    case "soon":
      return { count: formsInWarning(movements, now, configuration, "due"), words: "in Early warning" };
    case "urgent":
      return { count: formsInWarning(movements, now, configuration, "critical"), words: "in Final warning" };
    case "referralTarget":
      return { count: overdueSteps(movements, now, configuration, "referral_decision"), words: "past target" };
    case "transferTarget":
      return { count: overdueSteps(movements, now, configuration, "transfer_acceptance"), words: "past target" };
    case "transportTarget":
      return { count: overdueSteps(movements, now, configuration, "transport_booked"), words: "past target" };
    default:
      return null;
  }
}

/**
 * Beds pulled right now. A pull keeps the limit in force when it was made, so a change reaches the
 * next pull only; the row says that instead of counting beds the change would not touch.
 */
export function bedsPulledNow(movements: readonly Movement[]): number {
  return movements.filter((movement) => !movement.closure && movement.stage === "pulled").length;
}

/** "1 form in Early warning", "No one past target", with the noun named, zero too (round 2 wording rule). */
export function impactText(impact: RuleImpact, noun: { one: string; many: string } | null): string {
  if (impact.count === 0) {
    const none = noun === null ? "None" : noun.many === "people" ? "No one" : `No ${noun.many}`;
    return `${none} ${impact.words}`;
  }
  const named = noun ? ` ${impact.count === 1 ? noun.one : noun.many}` : "";
  return `${impact.count}${named} ${impact.words}`;
}

export const IMPACT_NOUNS: Partial<Record<RuleKey, { one: string; many: string }>> = {
  ed: { one: "person", many: "people" },
  soon: { one: "form", many: "forms" },
  urgent: { one: "form", many: "forms" },
  referralTarget: { one: "referral", many: "referrals" },
  transferTarget: { one: "transfer", many: "transfers" },
  transportTarget: { one: "booking", many: "bookings" },
};
