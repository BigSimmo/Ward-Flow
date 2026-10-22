import type { TentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Observation } from "@/components/ward-management/ward-flow-observation-events";
import type {
  AtsCategory,
  Cohort,
  LegalStatus,
  RecordedSex,
  ReferralGender,
  Security,
} from "@/components/ward-management/ward-model";

// Moved out of ward-flow-events.ts unchanged on 22 October 2026 for the line cap, and re-exported there.
/** The short form an ED fills in to raise a brand-new referral. */
export type ReferralDraft = {
  cohort: Cohort;
  security: Security;
  /** Recorded sex (R7, 25 September 2026) — see `RECORDED_SEXES`. */
  sex: RecordedSex;
  /**
   * T10, item 8 (owner answer, 17 September 2026): the gender recorded at referral — see
   * `Movement.gender`'s doc comment (`ward-model.ts`) for why this is a separate, wider fact from
   * `sex` above. Optional, and absent means not yet recorded — the same convention `sex`'s
   * neighbours on this draft hold to; T11's intake screen is what requires an active choice
   * (including an explicit "Not yet recorded") before a referral can be raised, which is a
   * screen-level rule and not one this type can express.
   */
  gender?: ReferralGender;
  /**
   * T15 (item 12): the ED's own choice at intake, which REPLACES whatever a linked referral
   * carried (the 29 Aug ruling: "easy to continually adjust and refine along the way"). Optional
   * — most journeys are raised with no referral to inherit from and no ED choice either, and
   * absent leaves `Movement.tentativeDiagnosis` unset rather than forcing a guess.
   */
  tentativeDiagnosis?: TentativeDiagnosisBlock;
  observation: Observation; // Recorded at intake (fix plan item 10). See `Movement.observation`.
  /**
   * Whether high-acuity nursing is requested. **The referring clinician marks it — owner ruling,
   * 2026-09-10**, chosen over the system working it out, which would have been the first thing
   * Ward Flow ever did that assessed a patient. `false` is the ordinary state, and it is never
   * inferred from `urgency`, `security` or `legalStatus` on this same draft.
   */
  highAcuity: boolean;
  legalStatus: LegalStatus;
  urgency: 1 | 2 | 3;
  /** Category supplied by the referring clinician, never inferred from urgency. */
  atsCategory?: AtsCategory;
  /**
   * The legal form the clinician selected, as a code from `SELECTABLE_LEGAL_FORMS`, or `null`
   * for no form at all. Explicitly nullable rather than optional or an empty string so that
   * "this patient is on no form" is a first-class choice the clinician made, indistinguishable
   * from neither a field the caller forgot to fill in nor a blank that could be read as a
   * default. Nothing derives this from `legalStatus` any more (product owner, 2026-08-24).
   */
  legalFormCode: string | null;
  /**
   * The expiry written on the legal form, **as typed by the clinician raising this referral** —
   * minutes since midnight, like every other `Instant`. May be supplied beside ANY
   * `legalFormCode`, not only a transport or transfer order — see the correction below.
   *
   * 🔴 **CAPTURED, NEVER COMPUTED, AND THAT IS THE WHOLE DESIGN OF THIS FIELD.** The product
   * owner was asked on 2026-09-07, in one sentence — *"when a coordinator raises a transport (4A)
   * or transfer (4C) order, should the screen ask them to type the due time?"* — and answered
   * **"Yes"**. That answer authorises ASKING. It does not authorise deriving a deadline from a
   * statutory interval, which he declined separately on **2026-08-23**: *"please can you leave the
   * legal part and just start a clock once the patient arrives to ED. Keep it simple for now."*
   *
   * ⚠️ **So nothing may ever populate this from a duration.** A prototype that computes a
   * statutory deadline is making a claim about the Mental Health Act on a clinician's screen, and
   * `ward-model.ts`'s `LegalForm` records that this model once carried exactly such a figure on a
   * Form 1A *"on the strength of an unverified figure an earlier agent wrote into this file from
   * its own recollection"*. It was removed. Do not reintroduce it in this direction either.
   *
   * ⚠️ **AND DO NOT TAKE A DEFAULT FROM THE FIXTURE.** `ward-movements.ts` seeds four deadlines —
   * 4A at `NOW_ANCHOR + 60` and `+ 90`, 4C at `+ 300` and `+ 340`. **They disagree with each
   * other, so they cannot be intervals: a statute does not give two answers for one form.** They
   * are illustrative figures for the demonstration corpus. Anyone reading them to recover "the"
   * interval gets two, and the one they pick will look authoritative on screen.
   *
   * 🔴 **CORRECTED 2026-09-17, T2 — "ONLY 4A AND 4C MAY CARRY ONE" IS NOW FALSE.** Until this date
   * the reducer dropped this value for every code but `transport`/`transfer` kinds, and
   * `tests/ward-legal-figure-guard.test.ts` held an allowlist that made that binding. Owner answer
   * 1, 2026-09-17: the clinician types the expiry written on whichever form they hold — 1A, 3B,
   * 3D, 4A or 4C alike. The reducer now captures this value for any selected code; the guard's
   * allowlist was replaced by a provenance property (every `dueAt` the guard's sweep ever produces
   * must trace to a value the test itself supplied or an authored fixture value, never a computed
   * one) — see that file's own header for the current shape of the check.
   *
   * **Optional, and it stays optional.** A required due time would block the intake form, which is
   * a larger behaviour change than the owner authorised, and `ward-model.ts`'s `LegalForm` comment
   * is emphatic that an absent `dueAt` must be rendered as absent — never as "clear" and never as
   * "not yet due".
   */
  legalFormDueAt?: Instant;
};
