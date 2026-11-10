import { edClearanceTime } from "@/components/ward-management/ed/ed-clearance-time";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { recordedMovementMedicalClearance } from "@/components/ward-management/ward-medical-clearance";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { isAwaitingAnswer } from "@/components/ward-management/ward-referrals";
import { openInformationNeeds, referralInformationNeedLabel } from "./referral-information-needs";
import { latestReferralForPerson } from "./referral-sheet-latest";

/**
 * "WHY A REFERRAL IS STUCK" (item 10, 10 Nov 2026): the Ready to send rail's short "Still open" list.
 *
 * Built only from records that already exist, never from the form being typed:
 * - what a ward asked for on this person's latest referral, while it waits for that ward's answer ("asked for" quick questions,
 *   `REQUEST_REFERRAL_INFORMATION`) and has not been ticked off. Fixed list labels only, never a
 *   ward's name, a count or typed text (D-18, archived D-19);
 * - the medical clearance timing on the open ED journey (D-110): not recorded since arrival, or
 *   recorded as still to come. The amber flag reuses the tracker's signed six hours.
 *
 * A prompt only. It never blocks or delays Send, and it never says a patient is cleared: a clearance
 * the record or this form already holds as done simply drops the line. Nothing here ranks or
 * suggests a ward (D-71).
 */
export type StillOpenItem = {
  readonly id: string;
  readonly words: string;
  /** Amber glyph: the clearance tracker's own flag (D-110), never a new threshold. */
  readonly flagged: boolean;
};

export type StillOpenInput = {
  readonly personId: string | undefined;
  readonly referrals: readonly Referral[];
  /** The person's open ED journey, when the referral starts from one. */
  readonly edMovement: Movement | undefined;
  /** True when the form already answers medical clearance as done; that line then goes. */
  readonly formSaysDone: boolean;
  readonly now: Instant;
};

/** "Legal form copy" reads "legal form copy" after "Ward asked for:"; "ECG" keeps its case. */
function lowerFirst(label: string): string {
  return /^[A-Z][a-z]/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

export function referralStillOpen(input: StillOpenInput): StillOpenItem[] {
  const items: StillOpenItem[] = [];
  const { edMovement, now } = input;
  if (edMovement && !edMovement.closure && !input.formSaysDone) {
    const recorded = recordedMovementMedicalClearance(edMovement, input.referrals);
    if (recorded === undefined) {
      items.push({
        id: "clearance",
        words: `Medical clearance not recorded (since ${formatInstantWithDay(edMovement.openedAt, now)})`,
        flagged: edClearanceTime(edMovement.openedAt, undefined, now).flagged,
      });
    } else if (!recorded.cleared) {
      items.push({
        id: "clearance",
        words: `Medical clearance to follow (recorded ${formatInstantWithDay(recorded.at, now)})`,
        flagged: false,
      });
    }
  }
  // The person's own latest referral only, through the D-14 allowlisted reader: one referral, never
  // their history. Its wards still waiting to answer say what they asked for.
  const latest = latestReferralForPerson(input.personId, input.referrals);
  const seen = new Set<string>();
  for (const arm of latest?.destinations ?? []) {
    if (!isAwaitingAnswer(arm)) continue;
    for (const entry of openInformationNeeds(arm.informationNeeds)) {
      if (seen.has(entry.need)) continue;
      seen.add(entry.need);
      items.push({
        id: `need-${entry.need}`,
        words: `Ward asked for: ${lowerFirst(referralInformationNeedLabel(entry.need))}`,
        flagged: false,
      });
    }
  }
  return items;
}
