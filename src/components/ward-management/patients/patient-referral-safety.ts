// PT1 H10 (Josh, 3 Nov 2026, "accept all recommendations"): the patient page may show risk flags
// and the working diagnosis, read only from the referral. Three conditions came with that yes:
//
// 1. This file is the one reader. It reads ONE referral: the one the movement in focus names.
//    `tests/ward-patient-referral-safety.test.ts` keeps every other patient page file from reading
//    referral risk or diagnosis, the way `ward-patient-link-default-deny.test.ts` guards archived D-14.
// 2. A desk sees the flags only when it can already see that referral. The referral must be in the
//    desk's scoped workspace (`scopeWorkspace`), so a desk the referral was not shared with gets
//    "Not shared with this desk" rather than the flags.
// 3. The referral's date always shows, so an old flag reads as old.
//
// Nothing is stored on the patient, so the 4 Sep ruling (R-2026-09-04-A) still holds: the record
// itself carries no risk flag and no diagnosis.
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { tentativeDiagnosisPhrase } from "@/components/ward-management/ward-diagnosis";
import { seededReferralDossier } from "@/components/ward-management/ward-referral-dossier-seed";
import { riskFlagLabel } from "@/components/ward-management/referrals/referral-risk-flags";

/** The referral fields this file reads: a full referral or a ward's scoped inbox entry (FD-23). */
export type CardReferral = Pick<Referral, "id" | "raisedAt" | "intake">;

export type ReferralSafetyFacts =
  /** The movement names a referral this desk cannot see. Show nothing from it. */
  | { kind: "not_shared" }
  /** No referral stands behind the movement, or no movement is in focus. */
  | { kind: "none" }
  | {
      kind: "shown";
      /** As the referral recorded them. Empty means it flagged none; undefined means no referral. */
      riskFlags?: readonly string[];
      /** When the referral was raised; always shown beside the flags. */
      raisedAt: number;
      /** The referrer's working diagnosis, as written. */
      diagnosisAsWritten?: string;
    };

/**
 * Reads the one referral behind `movement`. `visibleReferral` is the referral the desk's scoped
 * workspace resolved for this patient; it is used only when it is the referral the movement names.
 */
export function referralSafetyFacts(
  movement: Movement | undefined,
  visibleReferral: CardReferral | undefined,
): ReferralSafetyFacts {
  if (!movement) return { kind: "none" };
  const diagnosisOnMovement = tentativeDiagnosisPhrase(movement.tentativeDiagnosis ?? null) ?? undefined;
  if (movement.referralId !== undefined) {
    // Condition 2: the named referral must be one this desk holds. Any other referral, even for
    // the same person, is not read (condition 1).
    if (visibleReferral?.id !== movement.referralId) return { kind: "not_shared" };
    const dossier = seededReferralDossier(movement.id, movement);
    return {
      kind: "shown",
      riskFlags: visibleReferral.intake?.riskFlags ?? dossier?.riskFlags ?? [],
      raisedAt: visibleReferral.raisedAt,
      diagnosisAsWritten: diagnosisOnMovement ?? dossier?.workingDiagnosis,
    };
  }
  // No referral record: a demonstration journey's referral letter rides on the movement itself,
  // and the desk that sees the movement already sees it in the referral detail. A transport
  // officer's copy carries the flags it was given for collection (D-80 item 7).
  const dossier = seededReferralDossier(movement.id, movement);
  const flags = dossier?.riskFlags ?? movement.collectionRiskFlags;
  if (!flags && !diagnosisOnMovement) return { kind: "none" };
  return {
    kind: "shown",
    riskFlags: flags,
    raisedAt: movement.openedAt,
    diagnosisAsWritten: diagnosisOnMovement ?? dossier?.workingDiagnosis,
  };
}

/** What a card may show from the referral: its flags in words and the referral's date. */
export type ReferralCardFlags = { labels: readonly string[]; raisedAt: number };

/**
 * Cards (Josh, 9 Nov 2026, care plans and safety flags thread: defaults approved): the ED board and
 * a ward's bed request show the referral's flags as small worded tags under the same three
 * conditions, through `referralSafetyFacts`. `referrals` is the desk's scoped workspace; only the
 * referral the movement names is looked up, so a desk that cannot see it gets nothing. Nothing
 * also when the referral flagged none.
 */
export function referralCardFlags(
  movement: Movement,
  referrals: readonly CardReferral[],
): ReferralCardFlags | undefined {
  const facts = referralSafetyFacts(movement, namedReferral(movement, referrals));
  if (facts.kind !== "shown" || !facts.riskFlags || facts.riskFlags.length === 0) return undefined;
  return { labels: facts.riskFlags.map(riskFlagLabel), raisedAt: facts.raisedAt };
}

function namedReferral(movement: Movement, referrals: readonly CardReferral[]): CardReferral | undefined {
  return movement.referralId === undefined
    ? undefined
    : referrals.find((referral) => referral.id === movement.referralId);
}

/** The recorded flags that ask the receiving ward to plan staff before the person arrives, in words. */
const ARRIVAL_STAFFING_FLAGS: Readonly<Record<string, string>> = {
  aggression: "aggression",
  absconding: "absent without leave",
};

/** "Plan staffing for this arrival", with the recorded flags behind it in words. */
export type ArrivalStaffingPrompt = { reasons: readonly string[] };

/**
 * Feature 7 (D-117 item 3): the receiving ward's incoming card asks the nurse in charge to plan
 * staff when the referral records aggression or absconding. Read under the same H10 conditions as
 * `referralCardFlags`, so a referral this desk cannot see gives nothing. It rides on the movement
 * and its referral only, never on the patient record (R-2026-09-04-A).
 */
export function arrivalStaffingPrompt(
  movement: Movement,
  referrals: readonly CardReferral[],
): ArrivalStaffingPrompt | undefined {
  const facts = referralSafetyFacts(movement, namedReferral(movement, referrals));
  if (facts.kind !== "shown" || !facts.riskFlags) return undefined;
  const reasons = facts.riskFlags.flatMap((flag) =>
    Object.hasOwn(ARRIVAL_STAFFING_FLAGS, flag) ? [ARRIVAL_STAFFING_FLAGS[flag]!] : [],
  );
  return reasons.length > 0 ? { reasons } : undefined;
}
