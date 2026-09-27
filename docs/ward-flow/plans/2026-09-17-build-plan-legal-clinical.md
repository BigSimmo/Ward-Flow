# Build plan — legal and clinical owner answers 1, 2, 4–12 (17 Sept 2026)

> **FOLDED on 17–21 September 2026 into `codex/task-ward-flow-live-state-20260831` (commit `a7c7288668` / `6c33169b03`).**
> Kept for historical reference. For deferred items and active status, see `docs/ward-flow/STATUS.md`.

Read-only Opus planner. Base: `ward/audit-fixes-20260916` at **`73e617fbdc`** (y2, y3, z5, z7 folded; y4 and y7 not
folded). **Every line number below belongs to that commit. Re-derive
before editing** — the fix line moved three times while this plan was being written.

Nothing here has been checked by a WA legal adviser. The owner's rule stands: **the app works out no legal
time limits, and no Mental Health Act section numbers appear anywhere.**

## Binding owner words this plan rests on

- Item 1 note: _"the timer that starts when a patient arrives is separate to forms. One records time in ED
  and the other is a forms category."_ The two clocks are never merged and never stand in for each other.
- Item 2: _"a psychiatrist allowing 3 days to remain on forms."_ The official register gives Form 3D a
  different title (see Owner question 1). **No task below maps a form code to a duration or a purpose.**
- Items 4–12: the recommendations in `owner-answers-2026-09-17.md` §A, accepted as written.

## 1. Current code and target, item by item

**Item 1 — form time limits.**
Facts: `ward-model.ts:396-405` exports three computed limits (`FORM_1A_VALIDITY_HOURS`,
`FORM_1A_EXAMINATION_WINDOW_HOURS`, `FORM_3D_DETENTION_WINDOW_HOURS`); `ed-screen.tsx:2468-2555` counts
down from them and prints breach alerts; `tests/ward-legal-figure-guard.test.ts:243-252,2293-2297`
allowlists them. `ed-screen.tsx:2464-2467` prints "Legal clock: … since opened" — it dates a _form_ clock
from `openedAt`, the ED arrival time, whenever `formedAt` is missing or later (`isCommunityFormed`/
`legalClockReference`, `:703-713`). **That is the ED clock standing in for a form clock.** Typed expiry is
captured only for transport/transfer kinds (`ward-flow-reducer.ts:1471-1472`), as minute-of-day with no
day (`ed-screen.tsx:403-413`, `:2114-2127`). `isForm1A`/`isForm3D` (`ed-screen.tsx:2386-2395`) also test
`legalStatus` against strings the type cannot hold. `settings-screen.tsx:826-851` claims the screen
"Enforces Western Australia legislative mandates"; `settings-thresholds.ts:99` says only 4A/4C can breach.
Target: the clinician types the expiry written on any form (date and time). The screen shows it and warns
when it is close or past, using the same `clockState` thresholds already applied to 4A/4C. Nothing blocks.
No computed limit, no "since opened" legal clock. The ED access-target line is untouched.

**Item 2 — Form 3D.** Facts: `src/lib/form-register.ts:54-57` already holds the official title;
`legalFormName` renders from it. Hand-written descriptions that do not come from the register:
`ward-model.ts:400-401` comment; `ed-screen.tsx:2490,2552,2553`; `legal-forms-screen.tsx:126`
("Form 3B/3D (Inpatient)"); `legal-forms-derivations.ts:17` and `ward-model.ts:280` call 3B "inpatient
treatment order". Target: every form label comes from the register. Nothing states what 3D is for or how
long it lasts until the owner answers Question 1.

**Item 4 — undo "Form 1A received".** Facts: `RECORD_LEGAL_FORM_RECEIVED` (`reducer:1766-1797`) is one
click, stamps `now`, refuses a second recording (`:1777`), and writes the same instant twice —
`Movement.legalFormReceivedAt` (`ward-model.ts:1103`) and `LegalForm.receivedAt` (`:337`). No undo.
Target: a correction with a reason from a fixed list clears the receipt so it can be marked again; the
original receipt and the correction stay in the movement's history. One home for the receipt instant.

**Item 5 — regional extensions.** Facts: nothing records an extension. Target: the clinician records an
extension by typing the new expiry written on the form. The app never calculates one, does not know
metro from regional, and does not limit how many are recorded.

**Item 6 — examination revoked after transport booked.** Facts: `RECORD_EXAMINATION`'s WLQ-4 branch
(`reducer:1918-1926`) already keeps the bed at `handover_ready`/`moving` and writes the prose blocker
`examinationRevokedAwaitingRelease` (`reducer:207`). **The flag lives only in that free-text blocker**, which
`RECORD_MOVEMENT_BLOCKER` and every later transport transition overwrite (`reducer:2849,2900,2938`), so the
flag can vanish while the bed stays held. Release needs `STEP_BACK_STAGE` then `RELEASE_PULL`. Nothing stops
collection while flagged (`reducer` comment above `:1918`). Target: the flag is derived from the
examination record plus a held bed, so no prose edit can clear it; it shows on the ED and coordinator
screens until a person releases the bed or a repeat examination supersedes it.

**Item 7 — repeat examination.** Facts: `Movement.examination` holds one record (`ward-model.ts:1127`);
outcomes are `inpatient_order | community_order | revoked` (`ward-flow-events.ts:171`); a second is
refused (`reducer:1860-1862`, mirrored at `ed-screen.tsx:454-463`); ED options at `ed-screen.tsx:3008-3013`.
Target: new outcome "Further examination ordered", which changes nothing about beds or transport. A repeat
examination is allowed only after that outcome, becomes the current record, and the earlier one moves to
history.

**Item 8 — gender and beds.** Facts: placement reads `sex` (`ward-eligibility.ts:109-110,178-185` movement
path; `:404-405,455-463` referral path); `sex_designation` is overridable (`reducer:755-763`).
`genderEligibility` (`ward-eligibility.ts:664-709`) follows WLQ-35 but has no caller. No referral, draft or
movement records gender (`ward-model.ts:1591`, `ward-flow-events.ts:48-51`). Network: 21 undesignated, 1
female-only, 2 male-only wards (`ward-sites.ts`). Target: gender is recorded at referral (ED intake and front
door). The incoming patient's own designation check reads gender, never sex, and cannot be overridden.
"Not yet recorded" is refused only at the three single-gender wards. The bay-mix check (`sex_mix`) waits
and still reads sex — stated, not hidden.

**Item 9 — non-binary patient (placement rule only).** Facts: the model cannot record non-binary as
distinct from "not recorded"; no single-room fact exists; `PULL_PATIENT` is dispatched only from
`ward-screen.tsx:594,2603`. Target: a non-binary patient is placed only after a coordinator records a reason
from a fixed list and ticks that they checked with the ward, with a single room preferred. Recorded per
ward. Ward and ED staff cannot bypass it.

**Item 10 — high-acuity override.** Facts: `PULL_PATIENT` accepts any `OVERRIDE_REASONS` member past the
acuity refusal (`reducer:2545-2552`) and **records no override** (the movement update at `:2691` never
touches `overrides`). The refusal text lacks `OVERRIDE_REASON_REQUIRED`, so the ward screen's reason form
(`ward-screen.tsx:612-652`) never appears for it — the override is reachable only by a direct dispatch.
Target: the override needs a reason and a "Nurse unit manager consulted" tick, is written to
`movement.overrides`, and is reachable from the ward screen. Specialling is unchanged.

**Item 11 — bed kind.** Facts: `PULL_PATIENT` decrements `allocatable` only (`reducer:2571`); nothing ever
decrements `allocatableLocked` (`ward-model.ts:474`), so `lockedBedsFree` overstates after any pull; the
movement-path security gate asks only whether locked beds exist (`ward-eligibility.ts:160`); no refund
restores a kind (`releasePulledBedAndAdmission`, `reducer:1012-1042`; inline refund in `RECORD_EXAMINATION`
from `:1939`). Target: an Open-security request takes an open bed first, then a locked one; a Secure request
takes a locked bed first, and falls back to an open bed only with a recorded override reason (the same
overridable security ruling). The kind taken is recorded on the admission and restored on every release.
Reading: "voluntary" is taken as the request's `security: "Open"`, because bed kind belongs to the request.

**Item 12 — diagnosis carried to the admission.** Facts: `PULL_PATIENT` writes `tentativeDiagnosis: null`
(`reducer:2670`) beside the y3 `resolvedReferral` lookup (`:2646`). No `Referral` or `Movement` field holds a
category; `tests/ward-referral-model.test.ts:830` refuses new referral fields by design. The vocabulary exists
(`ward-diagnosis.ts`). Target: the front-door referral and the ED intake record an optional broad category
from that list; an admission made by a pull carries it; every screen already says "Tentative diagnosis".
Reading: a movement raised from a referral starts with the referral's category, and the ED's own later
choice replaces it (the 29 Aug ruling: "easy to continually adjust and refine").

## 2. On-screen wording (exact)

No section numbers. No durations beside a form code. Any control not wired says exactly
**"Not wired in this prototype."**

- ED form column, one line each: `Form written: {time}` or `Time written not recorded` ·
  `Expiry written on the form: {formatInstantWithDay} ({duration} left)` ·
  `Expiry written on the form: {time} (passed {duration} ago)` · `No expiry recorded from the form.` ·
  `Form 1A received {time} ({duration} ago)` · `Extension recorded {time}: new expiry {time}`.
- Warning lines (`data-level="warning"`, never blocking): `Warning: the expiry written on the form is close.` ·
  `Warning: past the expiry written on the form. Check the form.`
- Caveat under the column: `Typed from the form. This prototype does not work out legal time limits.`
- Intake: label `Expiry written on the form (optional)`, inputs `Date` and `Time`, help
  `Leave blank if the form has no expiry or you do not have it yet.`, blocked reason
  `Enter both the date and the time written on the form, or leave both blank.`
- Controls: `Record expiry from the form` → legend `Expiry written on the form for {id}` → `Save expiry`.
  `Record an extension` → legend `Extension written on the form for {id}`, field
  `New expiry written on the form` → `Save extension`. Refusals:
  `An extension's new expiry must be later than the expiry already recorded.` ·
  `There is no legal form on this record to add an expiry to.`
- Receipt correction: `Correct receipt` → legend `Undo "Form 1A received" for {id}`; reasons (placeholders,
  marked as such in code): `Marked against the wrong patient` · `Marked before the form was actually received` ·
  `Marked by mistake`; submit `Undo receipt and keep a record`; history
  `Receipt marked {time} was undone {time}: {reason}`.
- Examination: option `Further examination ordered`; outstanding item
  `Further examination ordered — record the repeat examination when it happens.`; history
  `Earlier examination {time}: {outcome label}`; flag
  `Examination recorded as {outcome label} after transport was booked. The bed is still held. A coordinator decides whether to release it.`
- Gender intake: label `Gender (decides which bed)`; options `Choose…`, `Female`, `Male`, `Non-binary`,
  `Not yet recorded`; blocked reason `Choose a gender, or "Not yet recorded". None is chosen for you.`
- Gender gate details, coordinator screens only: `{ward} takes any gender` ·
  `{ward} is {female only|male only} and suits this patient` ·
  `{ward} is {female only|male only} and does not suit this patient` ·
  `Gender is not yet recorded, so {ward} ({female only|male only}) cannot be offered. Record gender first.`
  Ward and ED screens show only `This ward's bed designation does not suit this patient.` (never "sex" or
  "gender", so a verdict cannot reveal that the two differ).
- Non-binary placement (coordinator): legend `Place a non-binary patient`; guidance
  `Check with the ward first. A single room is preferred.`; tick `I have checked this placement with the ward`;
  reasons (placeholders): `A single room is available on this ward` ·
  `The patient's stated preference, agreed with the ward` · `The ward has agreed the bed after discussion`;
  submit `Record reason and place`; refusal
  `This patient is recorded as non-binary. A coordinator must record a reason after checking with the ward before this placement.`
- Acuity: refusal `{ward} has no high-acuity nursing capacity left ({n} staffable, all in use). This placement needs a recorded override reason and the nurse unit manager consulted.`;
  tick `Nurse unit manager consulted`; register line `High-acuity staffing — nurse unit manager consulted`.
- Bed kind: `No locked bed is free at {ward}. This placement needs a recorded override reason to use an open bed.`
- Diagnosis: label `Broad diagnosis category (tentative)`, first option `Not recorded`, then
  `tentativeDiagnosisPhrase` for each block.
- Settings (`settings-screen.tsx:826-851`): title `Form expiry warnings`; description
  `Warnings come from the expiry typed from each form. Nothing is blocked. This prototype does not work out legal time limits.`;
  header sentence `This prototype does not enforce the Mental Health Act.`; toast `Not wired in this prototype.`
- Form 3D and 3B labels: **"to be filled from the confirmed source"** — rendered from `form-register.ts`.

## 3. Tasks

Tier is Sonnet (high effort) unless stated. Every Sonnet brief ends: _"If you reach a decision this brief
does not cover, stop and hand it back."_ "Owns" lists files; reducer work names its case blocks.

**T1 · ED screen stops computing form limits (M).** Starts now (y2 is folded).
Owns `ed-screen.tsx` (imports, `:678-713`, `:2364-2555` only); `tests/ward-ed-legal-clock.dom.test.tsx`;
`tests/ward-legal-clock-needs-written-time.dom.test.tsx`; `tests/ui-ward-roles.spec.ts` (`:429-508` only);
new `tests/ward-ed-form-expiry.dom.test.tsx`. No engine change; the constants stay exported until T2.
Failing tests first: (a) a Form 1A with `formedAt` and no `dueAt` shows `No expiry recorded from the form.`
and no text matching `/\b(72|24)h\b|remaining \(/`; (b) a past `dueAt` shows the passed line and the warning;
(c) **separation**: two movements identical except `openedAt` render identical form lines, and two identical
except `dueAt` render identical access-target lines. Mutation: point the expiry line at `openedAt` → (c) red.
Delete `isCommunityFormed`/`legalClockReference` and `data-minutes-legal-clock`; replacing the old tests
needs a `diff-integrity.json` entry. Catcher: the new DOM test plus typecheck.

**T2 · Engine: typed expiry for any form, extensions, no computed limits (M).** Waits: y7 fold (same model
comment and same guard file). After T1.
Owns `ward-model.ts` (`LegalForm` block `:296-338`, constants `:393-405`, one new `Movement` field
`legalFormExpiryHistory?: { at; by; dueAt; basis: "written_on_form" | "extension" }[]` — `at` and `dueAt`
are already re-anchored names, so `ward-reanchor.ts` is not touched); `ward-legal-forms.ts`;
`ward-flow-events.ts` (`ReferralDraft.legalFormDueAt` doc, new variant `RECORD_LEGAL_FORM_EXPIRY`, EVENT_ROLE
`["ed","coordinator"]`); reducer **`RAISE_REFERRAL` capture lines `:1446-1472` and the `legalForm:` literal only**,
new case `RECORD_LEGAL_FORM_EXPIRY`; `legal-forms/legal-forms-derivations.ts`; `settings/settings-thresholds.ts:99`;
`ward-audit.ts` (new event entry); tests `ward-legal-figure-guard.test.ts`, `ward-legal-form-due-at-capture.test.ts`,
`ward-owner-decisions-2026-09-16.test.ts:14-44`, `ward-legal-forms-derivations.test.ts`, `ward-event-permissions.test.ts`.
Rules: capture keeps a typed expiry for any selected form (no `kind` test); `legalForm.dueAt` always equals the
last history entry; an extension must be later than the current expiry; closed movement or no form refused.
Failing tests first: 1A, 3B, 3D each keep a typed expiry (today dropped, `due-at-capture.test.ts:117-142` pins
the opposite); extension earlier than current refused with the exact sentence; **provenance property**: across
every event in the guard's event list, every `dueAt` in the resulting state is a sentinel value the test
supplied or an authored fixture value. Guard changes: delete the three provenance entries and
`ALLOWED_STATUTORY_CONSTANTS`; replace the code allowlist with the provenance property; widen the
"screen text beside a legal form carries no duration" scan from `search/` to `ed/`, `legal-forms/`, `alerts/`,
`settings/` (measure hits first; T1 must already have removed "Form 1A 72h").
Mutation proofs: re-add `export const FORM_1A_VALIDITY_HOURS = 72` → red; make `RAISE_REFERRAL` write
`dueAt: event.now + 4320` → red; restore `"Form 3D 72h detention:"` in `ed-screen.tsx` → red.
**T2r · Opus reviewer, adversarial, on the guard only.** Veto: _designs a check whose strength is the point._

**T3 · ED screen: record expiry and extension (M).** After T2; ED-screen token. Owns `ed-screen.tsx`
(`:363-413` draft and parser, `:2098-2127` intake field, actions block for the two new forms). A date plus
time helper resolved against the provider's `dayZero`, refusing partial input. Failing tests first
(`tests/ward-ed-form-expiry-controls.dom.test.tsx`): intake with date+time on a 3D files `dueAt`; time without
date blocks with the exact sentence; `Save extension` dispatches and the history line appears; a past
expiry never disables `Book transport` or pull controls (warning never blocks). Catcher: DOM test.

**T4 · Receipt correction (M).** After T3; ED-screen token. Owns reducer `RECORD_LEGAL_FORM_RECEIVED` and new
case `CORRECT_LEGAL_FORM_RECEIPT`; `ward-model.ts` (delete `LegalForm.receivedAt`; add
`legalFormReceiptCorrections?: { at; by; reason; receivedAt }[]`, all names already re-anchored);
`ward-flow-events.ts` (variant, EVENT_ROLE `["ed"]`); `ward-change-reasons.ts` (new placeholder list);
`ward-audit.ts`; `ed-screen.tsx:2720-2737`; `tests/ward-legal-figure-guard.test.ts` event list
(`:651`, `:1099`, `:1134-1137`). Failing tests first (`tests/ward-legal-form-receipt-correction.test.ts`):
correction clears `legalFormReceivedAt`, appends the record holding the original instant, and a second
`RECORD_LEGAL_FORM_RECEIVED` then succeeds; an unlisted reason is refused by membership; correcting with no
receipt refused. Mutation: make the correction skip appending → the history assertion goes red.

**T5 · Form labels from the register (S).** **Waits: Owner question 1 and the researcher's confirmed
source.** Owns `legal-forms/legal-forms-screen.tsx:121-127`, `legal-forms-derivations.ts` comments,
`ward-model.ts:277-295` comment, `ward-legal-forms.ts` (adds 3C only if the owner says so). All label text
comes from `legalFormName`/`formTitleForCode`; placeholder text in the brief is
"to be filled from the confirmed source". Failing test: `tests/ward-form-labels-from-register.test.ts` scans
ward `.tsx` literals and JSX text for `Form \d[A-Z]` followed by a parenthesised or colon-led description
not produced by the register helpers. Mutation: re-add "Form 3B/3D (Inpatient)" → red.

**T6 · Drawings: no computed limits (S).** Waits: y7 fold. Owns
`docs/ward-flow/mockups/legal-forms-third-edition.html` (`:646,698,670,892,907,996`) and
`alerts-third-edition.html` (`:576,618,678`), plus regenerated `MANIFEST.json`/`SCREEN-VERIFICATION.md`.
Replace invented periods and "Automatic release" with the §2 wording. **Coordinate with the screens planner,
whose drawing work regenerates the same two files — one drawing task at a time.** Catcher: manifest
`--check`, citation guard, then a served look recorded in `SCREEN-VERIFICATION.md`.

**T6b · Settings wording (S).** Owns `settings/settings-screen.tsx:820-855`,
`settings/settings-search-index.ts:148`. **Coordinate with the screens lane (item 39 is still CLARIFY).**
Failing test: the row renders the §2 sentences and the toast is exactly `Not wired in this prototype.`

**T7 · Engine: repeat examination and the revoked flag (M).** Starts now. Owns reducer `RECORD_EXAMINATION`
only; `ward-model.ts:1127` (outcome union + `supersededExaminations?: { at; outcome }[]`);
`ward-flow-events.ts:167-172`; `ward-derivations.ts` (new `examinationRevokedWhileBedHeld(movement)`);
`ward-audit.ts`. Replace the inline refund (from `:1939`) with `releasePulledBedAndAdmission` so T14 has one
restore site; prove with the existing refund tests unchanged. Failing tests first
(`tests/ward-repeat-examination.test.ts`): `further_examination_ordered` closes nothing and refunds nothing;
a second examination is allowed only after it, and the first moves to `supersededExaminations`; a second after
`inpatient_order` is refused "already examined"; revoked at `handover_ready` → flag true; `RECORD_MOVEMENT_BLOCKER`
then `TRANSPORT_ACCEPTED` leave the flag true; `STEP_BACK_STAGE` + `RELEASE_PULL` clear it. Mutation: derive the
flag from the blocker sentence → red on the overwrite case.

**T8 · Screens: examination history and flag (M).** After T7; ED-screen token. Owns `ed-screen.tsx`
(`:454-463`, outstanding item `:638-676`, `:2998-3030`) and the flag line in `ward-management-console.tsx`
(coordinate: screens lane). Failing DOM tests: the new option is offered; history renders; the flag sentence
appears on both screens for a revoked-at-handover movement and not for a pulled-only one.
The transport officer's display waits for the transport planner's `officer-screen.tsx` work.

**T9 · Refuse collection while flagged (S).** **Waits: Owner question 2.** Owns reducer `PATIENT_COLLECTED`.

**T10 · Engine: gender at referral decides the incoming bed check (L).** Starts now (after T2 for the
`RAISE_REFERRAL` token). Owns `ward-eligibility.ts`; reducer `SUITABILITY_GATES`, `eligibilityRefusal`,
`referralAcceptanceRefusal` (the gender check runs **before** the override early return), the gender line of
`RAISE_REFERRAL`'s created movement, `RECEIVE_REFERRAL`'s ward-arm validation; `ward-model.ts` (ward arm
`:1591`, `Movement` beside `sex:` `:996`, `REFERRAL_GENDERS = ["Female","Male","Non-binary"]`, absent = not
recorded; `GENDERS` stays two); `ward-flow-events.ts` drafts; `ward-movements.ts`/referral seed (author gender
only on named examples — one Female and one Male at single-gender wards, one Non-binary, one unrecorded —
**never copied from sex in bulk**; record eligible-pairing counts before and after in the commit); tests
`ward-referral-model.test.ts:830` (widening recorded as owner item 8), `ward-gender-gate.test.ts`,
`ward-referral-reducer.test.ts`, `ward-eligibility.test.ts`, `ward-referral-matching.test.ts`.
Rename the gate `sex_designation` → `gender_designation`; type `SUITABILITY_GATES` so it cannot hold it.
Failing tests first (`tests/ward-gender-at-referral.test.ts`): a pair differing only in gender flips the
verdict and a pair differing only in sex does not (mutant reading sex → red); unrecorded passes at an
undesignated ward and is refused at a female-only ward **even with a valid override reason** (mutant moving
the check after the early return → red); `sex_mix` still reads sex (residual pinned by name).
**T10r · Opus reviewer on gate detail wording and screen placement.** Veto: _output is a privacy judgement._

**T11 · Intake gender selects (M).** After T10. Owns `referrals/referral-intake.tsx` (`:399`, `:585`, `:887`,
prefill `:994-1010` reading `Patient.gender`, never sex) and `ed-screen.tsx` intake (ED-screen token).
Failing DOM tests: "Raise referral" blocked until gender answered; PT-007 prefill leaves gender unchosen.

**T12 · Non-binary placement (M).** After T10 and T15 (PULL token); (y2 is folded, so `referral-match.tsx` is free).
Owns reducer `REFER_TO_UNITS` and `ACCEPT_REFERRAL` (write `genderPlacements?: { at; by; unitIds; reason }[]`,
coordinator role only), `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` (refusal when no record names the unit);
`ward-change-reasons.ts` (placeholder list); `coordinator/shortlist-panel.tsx`, `referrals/referral-match.tsx`.
Failing tests first (`tests/ward-non-binary-placement.test.ts`): refused without a record; refused with reason
but no tick; refused when a ward or ED role supplies both; placed when the coordinator records both for that
ward; a record for ward A does not admit ward B. Mutation: drop the unit match → red.

**T13 · Acuity override with the NUM tick (M).** Starts now. Owns reducer `PULL_PATIENT` acuity block and its
movement update; `ward-model.ts` `Override` (`numConsulted?: true`, `gate?: "high_acuity_staffing"`);
`ward-flow-events.ts:288` (`numConsulted?: true`); `ward/ward-screen.tsx:572-652` (tick shown only for the
acuity refusal); `override-register.tsx`. Failing tests first (`tests/ward-acuity-override-num.test.ts`): reason
without tick refused; tick without reason refused; both → placed and one override recorded naming the unit;
specialling unchanged. `ward-acuity-gate.test.ts:390` pins the old one-field override and must change.
Mutation: remove the tick check → red. Also `ward-override-surfaces.test.ts` must see the new dispatch.

**T14 · Bed kind on pull and release (M).** After T13 (PULL token) and T7 (single restore site). Owns reducer
`PULL_PATIENT` capacity lines and admission literal, `releasePulledBedAndAdmission`; `ward-admissions.ts`
(`bedKind?: "locked" | "open"`, absent on seed). Failing tests first (`tests/ward-bed-kind-pull.test.ts`): Open
request at a mixed ward with both free takes open; Secure takes locked and `lockedBedsFree` drops; Secure with
no locked free refused without a reason, placed on open with one; every release path (`RELEASE_PULL`,
`WITHDRAW_REFERRAL`, `REFER_TO_COMMUNITY_TEAM`, `RECORD_EXAMINATION`, referrer withdrawal) restores the same
kind. Mutation: restore to `allocatable` only → red. Residual stated: `RELEASE_BED` on seeded admissions has no
kind to restore.

**T15 · Diagnosis category carried to the admission (M).** After T14 (PULL token) and T10 (RAISE/RECEIVE
token). Owns `ward-model.ts` (`Referral.tentativeDiagnosis?`, `Movement.tentativeDiagnosis?`); drafts in
`ward-flow-events.ts`; reducer `RECEIVE_REFERRAL` and `RAISE_REFERRAL` field writes (membership via
`isTentativeDiagnosisBlock`), `PULL_PATIENT` line `:2670`; `referral-intake.tsx`; ED intake (ED-screen token);
`ward-referral-model.test.ts:830`. Failing tests first (`tests/ward-diagnosis-from-referral.test.ts`): referral
F30–F39 → raise → pull → admission F30–F39; ED choice replaces it; none → `null`; unlisted code refused.
`ward-community-hub.test.ts:49` and `ward-pull-vocabulary.dom.test.tsx:284` construct `null` and stay valid.

## 4. Lanes

- **Lane A, legal forms:** T1 → T2 (+T2r) → T3 → T4. T5 waits Q1. T6 and T6b run beside it (file-disjoint).
- **Lane B, examinations:** T7 now → T8 (ED-screen token) → T9 waits Q2.
- **Lane C, pull:** T13 now → T14 (after T7) → T15.
- **Lane D, gender:** T10 now (after T2 lands its `RAISE_REFERRAL` lines) → T11 → T12 (after T15).
- **Shared tokens — one holder at a time, across all three planners' tasks:** `ed-screen.tsx` (T1, T3, T4,
  T8, T11, T15 and the referral planner's items 14, 19, 21); reducer `PULL_PATIENT` (T13, T14, T15, T12);
  `RAISE_REFERRAL` (T2, T10, T15, referral planner 21–22); `RECEIVE_REFERRAL` (T10, T15);
  `tests/ward-legal-figure-guard.test.ts` (T2, then T4); drawings manifest (T6 and the screens planner).
- **Waiting on folds:** y7 before T2 and T6. y2, y3 and z5 are folded, so nothing else waits on a fold.
- `ward-model.ts` and `ward-flow-events.ts` are split by type block and event variant as listed; the fold
  order above settles `EVENT_ROLE` and `ward-audit.ts` appends.

## 5. Risks

- **Tests that pin the old behaviour:** `ward-ed-legal-clock.dom.test.tsx` (whole file), the controls in
  `ward-legal-clock-needs-written-time.dom.test.tsx:145,164`, `ui-ward-roles.spec.ts:429,483`,
  `ward-legal-form-due-at-capture.test.ts:117-142,198`, `ward-legal-figure-guard.test.ts:1412,1896-1904,2293`,
  `ward-owner-decisions-2026-09-16.test.ts:14-44`, `ward-audit-engine-fixes-2026-09-16.test.ts:630+`,
  `ward-acuity-gate.test.ts:390`, `ward-referral-model.test.ts:830`, eight test files naming `sex_designation`,
  13 reading locked-bed figures. Replacing a test needs a `diff-integrity.json` record.
- **Places the ED clock and form clocks could still be merged:** `legalClockReference` returning `openedAt`
  (removed by T1); `ward-priority.ts:126-169`, where "Time waiting" and form-timing points sit in one score; the
  delays screen listing `formedAt` beside ED events (`delays-derivations.ts:374`); any warning helper that falls
  back to `openedAt` when `dueAt` is absent. T1's separation test is the check; the priority file belongs to the
  queue-order planner (item 37).
- **Typed 1A/3D expiries will start to count** in `ward-priority.ts:154-169` points, `ward-pressure.ts:61`
  breach counts, `ward-derivations.ts:1029` and `alerts-screen.tsx:121`, exactly as 4A/4C do today. The
  queue-order planner must decide whether form timing still scores.
- **Fixture counts change:** gender examples (T10) change eligible pairings at the three single-gender wards;
  T14 changes `lockedBedsFree` on every pulled locked bed; T7 changes nothing seeded (three `examination`
  values keep their shape).
- **The referral planner's item 14** gates ED→community referral on "examination outcome recorded".
  "Further examination ordered" is a recorded outcome that must **not** unlock it.
- **Notices (item 48)** for a revoked examination should derive from T7's record, not edit `RECORD_EXAMINATION`
  while T7 holds it.
- **Guard vacuity:** T2's provenance property must fail on a mutant, not only pass on today's fixture; T2r reviews
  that. New events must appear in the guard's event lists or the property silently skips them.
- **Privacy:** a gender verdict beside a displayed sex can reveal a trans or non-binary patient; T10r decides
  where verdicts show. Single-room preference is guidance only — there is no single-room fact to check.
- **Unverified law:** nothing here asserts what any form authorises or for how long.

## 6. Owner questions

1. **Form 3D.** Your description ("a psychiatrist allowing 3 days to remain on forms") matches Form 3C,
   "Continuation of detention to enable a further examination by a psychiatrist", in the official register. Form
   3D is "Order authorising reception and detention in an authorised hospital for further examination".
   **Recommendation: use the official register's titles for every form; confirm whether the 3-day continuation
   you meant is Form 3C.** If yes, 3C is added to the form picker. Blocks T5 only.
2. **Collection while a revoked examination still holds the bed.** Today transport can still collect the patient.
   **Recommendation: refuse collection until someone releases the bed or records a repeat examination; arrival
   can always be recorded.** Blocks T9 only.
