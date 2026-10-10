import type { Referral } from "@/components/ward-management/ward-model";

/**
 * D-12 (Ward Lead ruling, delegated 2026-09-11 — `docs/ward-flow/owner-decisions-2026-09-1x.md`)
 * — never a personal name, and never a source type standing in for one. A STATED absence, which is
 * the right shape here precisely because this is a fact nobody is obliged to supply (D-6's flat
 * form — never "Not yet recorded", which would promise a pending step nobody has committed to).
 */
export const REFERRER_NOT_RECORDED = "Not recorded";

/**
 * WHO the referrer is, for a field labelled as a PERSON — never inferred from the source type.
 *
 * **THE RULE (D-12): show the recorded source; show a named person only where the record actually
 * holds one.** "Ambulance" is not a referrer's name, and rendering a source type — an organisation —
 * in a field labelled as a person is a fabricated attribution on a clinical record, not a
 * formatting choice. Same family as spec §8.3: never invent a person's name that could be mistaken
 * for real.
 *
 * Approved drawer submissions record the named referrer in `intake`. Legacy referrals retain
 * the stated absence; the source organisation never substitutes for a person.
 */
export function referralReferrerName(referral: Referral): string {
  // `referral.source` is deliberately never read here — see the doc comment above. Reading it to
  // produce a name is exactly the fabrication D-12 forbids: a source type is not a person.
  return referral.intake?.referrer.name ?? REFERRER_NOT_RECORDED;
}
