# Plan — gender decides both bed checks (`WLQ-6`), and why it is not switched on yet

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow. Gender is recorded at referral and the check is wired (owner item 8; gender review rounds 1 and 2, folded).

**Written 2026-09-15 by Ward Lead from an Opus planning pass (clinical and privacy judgement, check design).
Measured on branch `ward/lead-fixes-20260914`. Nothing in the application was changed by the plan.**

## The ruling

Owner, 2026-09-15, `WLQ-6`: _"Yes As you recommend"_ to — once beds are linked to people, the bay-mix
check reads gender as well as the bed-type check, built together with its privacy guard (`D-14`). This
ratifies `D-5` ("both gates read gender, or neither"). The binding words it rests on:

- §8 (2026-09-10): _"placement follows GENDER, not sex"_.
- §9: _"bed matched on GENDER. Never on sex."_ and _"Do NOT default an unrecorded gender to the recorded sex."_
- `D-45`: `D-5` is _"Blocked by an absent POPULATION, which is what D-45 fills."_

## Why it is not wired today — measured

- **Occupied beds linked to a person: 1 of 259** (AD-RPHS-14 → PT-003). No ward's occupancy is fully known
  by gender; 22 of 23 wards have no occupant with a known gender.
- **Open movements reaching a patient with a gender: 0 of 50.** Queued ward referrals: 0 of 3.
- **Patients: 8.** 7 have a gender; none has a gender that differs from recorded sex, so the case the ruling
  exists for has no example in the data.
- **Placement if wired now:** eligible movement × ward pairings fall from 214 of 667 to **0** with the gate as
  built, and to about 56 under the most lenient reading. Queued referrals: 17 of 69 → 0 (lenient: about 4).
- **The rejected alternative** — gender where known, recorded sex otherwise — contradicts §9's words, and would
  silently match an unlinked trans woman on recorded sex while the screen says nothing about it.

**Therefore the trigger is `D-45`'s person links.** This lands as ONE change with them.

## The design

1. **Gender only, on both checks, never sex.** Sex fields and the ward's stored sex mix stay as recorded facts
   for display; nothing in placement reads them.
2. **Rename the gates** `sex_designation` / `sex_mix` → `gender_designation` / `gender_mix`, so no screen says
   "Sex" while deciding on gender.
3. **Bed designation by gender is not overridable, enforced explicitly.** `eligibilityRefusal`
   (`ward-flow-reducer.ts` ~754-789) returns early and skips every gate when any override reason is present, on
   `REFER_TO_UNITS`, `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT`. The gender refusal runs before that return, and
   `SUITABILITY_GATES` is typed `Exclude<EligibilityGate, "gender_designation">[]` so adding it fails to compile.
4. **Incoming gender not recorded:** a designated ward refuses, not overridable, and the reason says to record
   gender on the profile. **Owner, 2026-09-15, `WLQ-35`: a ward that takes either gender places them.**
5. **Occupants' gender not recorded:** the mix check passes if a recorded occupant shares the incoming gender, or
   more than one bed is free; otherwise it says it cannot tell who is in the bay. **Owner, 2026-09-15, `WLQ-36`:
   that refusal is overridable by a coordinator with a recorded reason after confirming with the ward; unknown
   occupants are never counted by sex.**
6. **One change, together with:** `D-45`'s person links on occupants and movements; the referral form showing and
   completing the profile's gender (§9 point 3 authorises it; nothing under `referrals/` mentions gender today);
   the privacy allowlist entry below.

## Code to change

- `ward-eligibility.ts`: `eligibility`, `referralEligibility` gain a gender-facts argument; `ELIGIBILITY_GATES`
  renamed; `genderEligibility` becomes the shared rule and its "why not wired" header is replaced.
- New `ward-placement-gender.ts`: exports only `placementVerdictForMovement` and `placementVerdictForReferral`,
  returning a verdict and nothing else; internally resolves the incoming person and the one ward's occupants.
- `ward-flow-reducer.ts`: `SUITABILITY_GATES` (~726), `eligibilityRefusal` (~748), callers ~1736, ~1831, ~2164,
  ~3729 pass state-built facts.
- Derivations: `ward-derivations.ts` `eligibilityWarning`, `shortlistCandidates`, `eligibleCandidatesAmong`;
  `ward-referrals.ts` `referralCandidates`.
- Screens calling eligibility: `coordinator/shortlist-panel.tsx`, `coordinator/flow-diagram.tsx`,
  `ward/ward-screen.tsx`, `ward-management-network.tsx`, `ward-management-console.tsx`; label maps in three.
- Probes that ask about a bed, not a person: `ward-board-derivations.ts` `bedAcceptsSex`,
  `referrals/referral-destination-options.ts` `wardFigures`.
- `referrals/referral-intake.tsx` plus a reducer event that writes the patient's gender.

## Privacy (`D-14` guard, `tests/ward-patient-link-default-deny.test.ts`)

`ward-placement-gender.ts` becomes allowlist entry 12, and it is **new in kind**: it reads the genders of other
people (the bay). Its bound, void if any part widens: exports return a verdict only, never an id, record, gender
or count; it reads only the one ward's occupants plus the subject's own linked person; no detail sentence prints
occupant gender counts (beside the capacity screen's sex counts that would identify a trans occupant at small
numbers, `D-38`); not carried past synthetic data. Add a positive control proving the module really holds the
read, and close the guard's destructuring gap (`const { patientId } = admission` is not detected today).

**Ward Lead ruling to make when this is built:** gender placement verdicts appear on the coordinator's screens
only, not ward screens — a verdict that disagrees with a displayed sex reveals that a person's gender differs from
their recorded sex.

## Tests (each with a control that can fail)

T1 designation reads gender (flip gender, verdicts flip; mutant pointing back at sex goes red) · T2 the mix reads
occupants' gender, ignoring admission sex and stored mix · T3 for every bay, a trans woman's verdict deep-equals a
cis woman's, with an anti-vacuity bay where the mix decides · T4 unrecorded incoming gender refuses at a designated
ward with no sex fallback · T5 unrecorded occupants behave as `WLQ-36` decides · T6 no override on any placement
event, with matching-ward controls, plus a typecheck gate for the `Exclude` typing · T7 the privacy module returns
only verdicts, positive control AD-RPHS-14/PT-003 · T8 a referral and its movement agree.

Existing tests that change: `ward-referral-reducer.test.ts` (sex gates "must remain overridable", gate-list pins),
`ward-eligibility.test.ts`, `ward-referral-matching.test.ts`, `ward-referral-model.test.ts`,
`ward-board-derivations.test.ts`, `ward-scenarios.test.ts`, `ward-gender-gate.test.ts` (test 3 per `WLQ-35`),
the allowlist count, `ward-physical-facts-are-not-overridable.test.ts`, and the ward/coordinator browser specs.

**Measured:** coverage, per-ward completeness, placement table, 18 of 23 wards with at most one free bed.
**Estimated:** the lenient 56 and 4 approximate two gates rather than running rewritten code.
**Read, not exercised:** that an override reason bypasses designation on the three events.
