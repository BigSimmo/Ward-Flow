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
 * holds one.** "Police" is not a referrer's name, and rendering a source type — an organisation —
 * in a field labelled as a person is a fabricated attribution on a clinical record, not a
 * formatting choice. Same family as spec §8.3: never invent a person's name that could be mistaken
 * for real.
 *
 * ⚠️ **`Referral` HOLDS NO FIELD THAT CAN NAME A REFERRER TODAY — CHECKED, NOT ASSUMED.** Its own
 * doc comment states the closed set of person-facts it may ever carry (`ageBand`, `homeRegion`,
 * and — on a ward addressing only — `sex`), `tests/ward-referral-model.test.ts` pins that set
 * structurally, and every "who acted" field the model DOES carry is documented as a ROLE, never a
 * person: `ReferralAddressing.decidedBy`, `Referral.localBedSought.by`. So for every
 * `ReferralSource` this repository has today — community, crisis service, police, ambulance,
 * inter-hospital, ED medical staff — this returns the flat `REFERRER_NOT_RECORDED`.
 *
 * Written as a function of the whole `Referral`, not of `referral.source` alone, so the day a
 * named-referrer field is added to the model, THIS is the one place that starts reading it. Every
 * caller asks this function rather than reading `referral.source` or a source-label map directly —
 * that is what makes a future caller unable to regress into printing the source type as though it
 * were a person's name; the discipline is in the indirection, not in a caller's good intentions.
 *
 * The parameter is kept (rather than dropped to `unknown` or nothing) so the day a real field
 * exists, this signature does not have to change to read it — only the one line inside it does.
 */
export function referralReferrerName(referral: Referral): string {
  // `referral.source` is deliberately never read here — see the doc comment above. Reading it to
  // produce a name is exactly the fabrication D-12 forbids: a source type is not a person.
  void referral;
  return REFERRER_NOT_RECORDED;
}
