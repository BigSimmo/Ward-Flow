# Ward Flow ΓÇö the 82-issue catalogue, reviewed against the code

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow-task-ledger.md`.** Kept for history; do not follow. It is a historical review worksheet from 14 Sept, not a ledger or catalogue.

**Reviewed 2026-09-14 (evening), in `D:\Worktrees\Database\ward-lead`, working tree as it stood, uncommitted
files included.** Every verdict below is a claim about that tree at that moment. Re-derive before acting.

**How it was reviewed.** Seven read-only Sonnet extractors quoted the code, committed tests and committed
rulings for each item. Opus (the reviewing chat) spot-checked the decisive lines itself, resolved three places
where extractors contradicted each other, ran three focused test files, and wrote every verdict. Nothing in
the application was changed.

**What counted as evidence.** The source code, the committed tests, and the committed owner rulings
(`OWNER-RULINGS.md`, `owner-*.md`, `docs/ward-flow-ledger.md`, the 2026-09-12 handovers). **Not** evidence:
the OneDrive audit and tracker this catalogue said it drew on, and the 1,398-line "AUTHORITATIVE WARD FLOW
MASTER LEDGER" section added (uncommitted) to `docs/ward-flow-task-ledger.md` on 2026-09-13/14 by the same
outside session. Those are claims, and several contradict committed rulings (see "Process findings").

**The original catalogue** is kept, byte-identical, at
`C:\Users\joshs\Backups\ward-flow-reviews\PROJECT-ISSUES.original-2026-09-14.md`
(blob `52fe1ccbf84c5040cc74de8af7ddcabca9317244`).

**2026-09-16 Update (Ruling 14):** Under Owner Ruling 14 (Dual-Ledger Inbox Migration) and Ruling D-11, 28 queued Ward Flow requests from `docs/outstanding-issues-inbox/` were migrated directly into this catalogue (Section 6, Issues 63ΓÇô82) and `docs/ward-flow-task-ledger.md`, cleanly preserving the dual-ledger separation without touching `docs/outstanding-issues.md`.

ΓÜá∩╕Å **This file is a review worksheet, not a ledger.** Owner ruling D-11 (2026-09-12) says Ward Flow work is
recorded in `docs/ward-flow-ledger.md`. The `ISSUE-ΓÇª` and `DECISION-Q-ΓÇª` labels below are kept only so each
verdict can be traced back to the original; they are not a new numbering series and must not be cited as IDs.
Items confirmed here should be carried into the ward ledger (┬ºE Risks and debts, ┬ºB Open questions) once the
owner agrees.

---

## The result in one paragraph

Of 62 issues, **9 are real, 11 are partly real, 32 are not real** (wrong, already fixed, or deliberate by an
owner ruling), **6 cannot be judged without looking at the running screen**, and **4 are unresolved or are
known open questions and deferrals rather than defects**. Of the 13 critical ("P0") issues, 2 are real and 4
are partly real ΓÇö and the catalogue's top three recommended next tasks were one that contradicts an owner
ruling (Form 1A clock) and two that are not real (privacy leak, arrival erasure). Of the 13 questions, 2 are
already answered by rulings, 1 is partly answered, 4 are genuinely open, 1 is open but runs against a standing
ruling, and 5 are not questions for the owner. The
review also found **four problems the catalogue missed**, two of them currently failing tests.

---

## 1 ┬╖ Confirmed problems, in the order to fix them

### 1a ┬╖ Engine correctness ΓÇö real, small, and each has a named catcher

- **Acuity staffing is never checked when a bed is pulled** (was `ISSUE-P0-04`, and `DECISION-Q-04`).
  `remainingHighAcuityCapacity` exists in `ward-admissions.ts` and is correct, but `ward-flow-reducer.ts` never
  calls it, and `"acuity"` is not in `SUITABILITY_GATES`, so even the weaker static gate can never produce a
  refusal. The comment in `ward-eligibility.ts` saying _"`PULL_PATIENT` asks it"_ is false. The specialling
  check beside it _is_ enforced this way, so the pattern exists.
  ΓÜá∩╕Å **The catalogue's fix was a hard block. The owner's ruling says otherwise:** acuity is a staffing-capacity
  check, _"overridable like them ΓÇö only `allocatable_bed` and `specialling` are absolute"_
  (`owner-decisions-2026-09-09.md` ┬º5), and the engine _"stays advisory"_ (R1). So: refuse at the pull unless a
  coordinator records an override reason. **Catcher:** a reducer test pulling a second high-acuity patient into a
  ward whose one high-acuity place is filled. _(Updated 2026-09-16: fixed ΓÇö `ward-flow-reducer.ts` ~:2426 now
  calls `remainingHighAcuityCapacity` at `PULL_PATIENT`, with the same override mechanism as the specialling
  guard beside it. This entry is stale.)_

- **A ward can still accept a destination the referrer withdrew** (was `ISSUE-P0-05`, `DECISION-Q-10`).
  `RECORD_REFERRER_WITHDRAWAL` correctly stamps `withdrawnAt` on every queued destination, but `ACCEPT_REFERRAL`
  checks only `addressing.state !== "queued"` and never `withdrawnAt`, and `referralState()` never reads it.
  **Already foreseen by ruling O-17.11** (_"a withdrawn referral goes on counting as open, green all the way"_),
  which sized the fix at eight call sites not yet classified. The catalogue named the wrong event
  (`WITHDRAW_REFERRAL`, which is correct). **Catcher:** withdraw, then accept, and expect a refusal.
  _(Updated 2026-09-16: fixed ΓÇö `ward-flow-reducer.ts` ~:3999 now checks
  `addressing.withdrawnAt !== undefined` in `ACCEPT_REFERRAL` and refuses. This entry is stale.)_

- **Stepping a pulled patient back lets the bed be pulled a second time** (was `ISSUE-P1-14`).
  `STEP_BACK_STAGE` deliberately keeps `admissionId` and the bed (rulings E/F), and `PULL_PATIENT`'s guards never
  check `admissionId`. A second pull uses a second bed and orphans the first admission. **No ruling covers the
  re-pull.** **Catcher:** pull, step back to accepted, pull again, expect a refusal. _(Updated 2026-09-16:
  fixed ΓÇö `ward-flow-reducer.ts` ~:2272-2291 now restores the pull on the bed already held, via
  `movement.admissionId`, rather than taking a second bed, per owner decision 2026-09-15. This entry is
  stale.)_

- **A revoked examination leaves a phantom admission behind** (was `ISSUE-P0-08`).
  The bed count is refunded but the `Admission` and `movement.admissionId` stay, so the bed board can show an
  occupant in a bed the count calls free. **Already pinned** by an `it.fails` test in
  `tests/ward-flow-reducer.test.ts` (confirmed by running it: _"1 expected fail"_). Fixing it turns that test
  green. The catalogue's "memory leak" wording overstates it.

### 1b ┬╖ Problems in uncommitted work ΓÇö not in the catalogue

- ≡ƒö┤ **Wrong legal wording on the new Patient search screen** (new finding). The quick-pick chip reads
  **"Form 1A (ED 24h)"**, which attaches the 24-hour ED access target to a legal form. `ward-model.ts` forbids
  exactly that: the target _"is not a Mental Health Act deadline"_. **"Form 5A (Involuntary)"** appears as both a
  chip and a dropdown option, but `src/lib/form-register.ts` says Form 5A is a **Community Treatment Order**. And
  `matchesLegal` in `search-filters.ts` treats a Form 5A filter as "needs an involuntary bed". Form 5A is not even
  among the forms the intake picker offers. **`tests/ward-legal-figure-guard.test.ts` cannot catch any of this**,
  because its sweep collects identifiers, not string contents. **Fix:** drop "24h", use the register's titles,
  remove the 5A-means-involuntary mapping, and extend the guard to screen text.

- ≡ƒö┤ **The patient-link privacy test is failing now** (new finding, confirmed by running it).
  `tests/ward-patient-link-default-deny.test.ts` reports `coordinator/shortlist-panel.tsx` reading `.patientId`
  outside the D-14 allowlist. The cause is an uncommitted edit (2026-09-13 14:44) adding a "Patient" fact and
  link to the coordinator's shortlist. The coordinator may see the whole picture (R2), so this is probably an
  allowlist entry rather than a leak ΓÇö but the test's own message says **hand it to Ward Lead, do not widen it
  yourself**.

- **The raw-colour test is failing now** (was `ISSUE-P2-48`, confirmed by running it).
  `movements/movement-horizon.module.css`, changed uncommitted on 2026-09-14 00:18, carries hex and rgba literals
  (27 by static count), and `tests/ward-raw-colour.test.ts` refuses them.

- **The committed Patient search drawing has been overwritten** (new finding).
  `docs/ward-flow/mockups/patient-search-third-edition.html` is modified, uncommitted (2026-09-14 01:49, about
  9,000 lines removed), and the untracked `patient-search-perfected-third-edition.html` is a byte-identical copy
  of the new version. Drawings are authoritative on design, and the README says a drawing edit is the change
  that lands silently. **Somebody must confirm this was intended** before the screen is judged against it.

- **Quick-pick chips are below the tap-target floor** (was `ISSUE-P2-51`).
  `.quickChip` has no minimum height and about 4px vertical padding, so it renders at roughly 25ΓÇô30px against the
  project's 48px floor.

### 1c ┬╖ Real, lower stakes

- **One Command activity line rewrites its own history** (was `ISSUE-P0-10`, narrowed).
  In `shell/ward-command-activity.ts` the "opened" line prints the _current_ tier beside the _original_ time. The
  per-movement audit trail is correct. The catalogue's file name (`command/command-activity.tsx`) is invented,
  and "destroys the forensic audit trail" overstates it.
- **Four bare truthiness checks on transport timestamps** (was `ISSUE-P0-12`, latent).
  `transport.acceptedAt` and `transport.enRouteAt` in the reducer; a timestamp of 0 is valid. Not reachable from
  the demo clock (the anchor is 642), so this is a robustness fix, not a live defect.
- **Community teams cannot record their own decline on screen** (was `ISSUE-P1-15`, corrected).
  The reducer already lets `community` decline. No screen dispatches it. **The catalogue's fix ΓÇö a new
  "accept" action ΓÇö is wrong:** the owner ruled on 2026-09-06 that a community team may decline and did not say
  it may accept.
- **The 48-hour bed-release rule is built but unreachable** (was `ISSUE-P1-19`, wider than stated).
  `edMedicalTripBedRetention` implements ruling FD-19, override included, and is unit-tested, but has zero callers
  in `src/`. The catalogue's proposed new event is unnecessary.
- **A duplicate `cannotBeFormed`** in `statistics-compare-screen.tsx` (was `ISSUE-P1-31`). Already recorded as
  open. The two return different types, so it needs an adapter, not a bare import.
- **O-5 is unbuilt** (was `ISSUE-P2-42`): the sending team gets no decline notice and no read access until
  closure. Real and ruled; the file the catalogue names (`referral-outbox.tsx`) does not exist.
- **Two absence states are dead code** (was `ISSUE-P2-43`): `neverRecorded()` and `destroyed()` in
  `statistics/statistics-absence.ts` have no callers. The catalogue named the wrong file.
- **The judgement-gate refusal test does not exist** (was `ISSUE-P2-44`). Scoped at 1ΓÇô2 hours in the
  2026-09-12 close-out.
- **Five drawings bind the prototype marker to a heading, not the sentence** (was `ISSUE-P2-40`). Recorded in
  the 2026-09-12 handover; the five files were not identified in this review.
- **The contact sheet has no status filter** (was `ISSUE-P2-58`). Any filter belongs in
  `scripts/ward-flow/contact-sheet.mjs`, because the page is regenerated.
- **Access-record times carry no timezone** (was `ISSUE-P2-55`). True of every clock in this synthetic prototype,
  so minor.
- **`scratch_debug_elig.test.ts` is invisible to the ward runner** (was `ISSUE-P2-46`). True, and harmless: a
  documented no-op placeholder.
- **Network-screen small text** (was `ISSUE-P2-36`): 34 declarations below 12px. **Deferred by D-10**, with
  written triggers; none has fired.

---

## 2 ┬╖ For the owner

### Genuinely open

- **May the `security` (locked bed) gate be overridden, as authorisation now is?** D-9 answered authorisation
  only and explicitly declined to extend to security (was `DECISION-Q-03`). _(Updated 2026-09-16: answered ΓÇö
  WLQ-3, `docs/ward-flow/owner-decisions-2026-09-15.md` ~:42, "the engine already classified `security` as
  overridable; the reason now sits in design standard ┬º8.4.")_ **CLOSED 2026-09-17** (records housekeeping,
  `docs/ward-flow/owner-answers-2026-09-17.md` item 62): the WLQ-3 answer above stands and nothing further
  is waiting on the owner; this no longer belongs under "Genuinely open".
- **May a ward or community team cancel transport it booked itself?** Today only the coordinator and ED may
  (`EVENT_ROLE.CANCEL_TRANSPORT`), although ward and community may book (was `DECISION-Q-05`; ledger ┬ºB Q10).
  _(Updated 2026-09-16: partly answered ΓÇö WLQ-11, `docs/ward-flow/owner-decisions-2026-09-15.md` ~:85: the
  booking ward may now cancel transport it booked. The community half is still not built ΓÇö no event records
  which community team is acting.)_
- **Should booking transport for an involuntary patient require a Form 4A?** `TransportJob.formRequired` is an
  unvalidated string and nothing checks it (was `ISSUE-P0-07` and `DECISION-Q-06`). ΓÜá∩╕Å **A hard requirement
  cuts against the 2026-08-24 instruction to "avoid any hard rules" on forms.** The shape consistent with R1 is a
  warning at booking, not a block. _(Updated 2026-09-16: answered ΓÇö WLQ-5,
  `docs/ward-flow/owner-decisions-2026-09-15.md` ~:55: a warning beside Book transport, never a block.)_
  **CLOSED 2026-09-17** (records housekeeping, `docs/ward-flow/owner-answers-2026-09-17.md` item 62): the
  WLQ-5 answer above stands; nothing further is waiting on the owner.
- **Which of the two ED hub drawings is the design?** The question is real, but **both file names the catalogue
  gave (`ed-hub-third-edition.html`, `ed-overview-third-edition.html`) do not exist** (was `DECISION-Q-11`).
- **Where do the queued ward requests go?** (was `DECISION-Q-13`). Γ£à **RESOLVED by Owner Ruling 14 (2026-09-16):** The owner ruled _"14. Yes please goa head with this."_, directing that the queued ward requests be migrated directly into `PROJECT-ISSUES.md` (Section 6, Issues 63ΓÇô82) and `docs/ward-flow-task-ledger.md`, cleanly bypassing the main project ledger per Ruling D-11.
- **Suburb versus region** (was `ISSUE-P1-24`): open as CM-4. **A lookup table like the catalogue's fix was
  already built and rejected** as an invented mapping.
- **Should legal-status changes record statutory authority, not just the role?** (from `ISSUE-P1-23`). `by` is
  always a gated role, never free text; no ruling asks for finer authority.

### Open, and missing from the catalogue

- **The Aboriginal cultural safety review** ΓÇö a hard gate before any real-patient use (R-2026-09-04-I). It cannot
  be done inside this project.
- **ED-to-community referral routing** has no reopening trigger written anywhere. _(Updated
  2026-09-16: two rulings now clash and neither has been reconciled ΓÇö WLQ-19
  (`docs/ward-flow/owner-decisions-2026-09-15.md`) says revisit when the community screens are next
  rebuilt; Ruling 16 (`docs/ward-flow/owner-decisions-2026-09-16-rulings.md`) says build it now.
  `docs/ward-flow/handovers/WARD-FLOW-AUDIT-2026-09-16.md` ┬º1 records a button was built that
  reaches no community team. Do not resolve the clash here ΓÇö flag it to the owner.)_ **CLOSED
  2026-09-17:** `docs/ward-flow/owner-answers-2026-09-17.md` item 14 settles the clash ΓÇö "ED to
  community team referral: build now." Ruling 16 wins; WLQ-19's later-revisit is superseded. The
  button that reaches no community team is now a build gap against a confirmed decision, not an open
  question.
- **`--t-N` / O-17.1.** `OPEN-QUESTIONS.md` calls it unanswered, but `OWNER-RULINGS.md` indexes O-17.1 as
  _"TWO TYPE SCALES ΓÇö screens migrate at their own rebuild"_. **These two documents disagree; not resolved here.**
  **CLOSED 2026-09-17:** not a real disagreement ΓÇö `OPEN-QUESTIONS.md` had simply not been updated to
  reflect the existing O-17.1 ruling. Corrected there; see its entry. Records housekeeping per
  `docs/ward-flow/owner-answers-2026-09-17.md` item 62.

### Partly answered

- **Gender and bed matching** (was `DECISION-Q-02`). The owner ruled that gender decides the bed (┬º8/┬º9,
  2026-09-10), that gender reaches both bed gates or neither (D-5), and that the patient link and its privacy
  guard ship together (D-14). `genderEligibility` is built and tested with no production caller, because
  movements and referrals do not reliably resolve to a patient. **Sex is already checked on both the movement and
  referral paths** ΓÇö the catalogue's claim otherwise (`ISSUE-P0-11`) is false. _(Updated 2026-09-16: two
  rulings now clash and neither has been reconciled ΓÇö WLQ-6
  (`docs/ward-flow/owner-decisions-2026-09-15.md`) says not wired until beds link to people; Ruling 5
  (`docs/ward-flow/owner-decisions-2026-09-16-rulings.md`) says gender decides the bed now, across movements
  and referrals. `docs/ward-flow/handovers/WARD-FLOW-AUDIT-2026-09-16.md` ┬º1 records the gender check still
  has no caller. Do not resolve the clash here ΓÇö flag it to the owner.)_

### Already answered ΓÇö do not re-ask

- **A Form 1A statutory countdown** (was `ISSUE-P0-01`, `DECISION-Q-01`). ≡ƒö┤ **Answered against.** Owner,
  2026-08-24: _"avoid any hard rules now please."_ Forms record that they exist, never when they lapse. The
  2026-09-01 ruling kept deadlines to typed-in 4A/4C only, and _"the app still invents no statutory figure of its
  own."_ `tests/ward-legal-figure-guard.test.ts` enforces it, and its header records three earlier attempts at
  this same clock. The 24-hour figure on screen is the ED access target, correctly labelled. Whether the owner
  wants to revisit that is his call, but it is a reversal of a ruling, not a missing feature. _(Updated
  2026-09-16: superseded by Ruling 1 (`docs/ward-flow/owner-decisions-2026-09-16-rulings.md`) ΓÇö 72-hour Form
  1A clock from when written, 24 hours from receipt, 72-hour Form 3D clock ΓÇö which the code now shows. This
  is still an open clash, not a settled reversal: `docs/ward-flow/handovers/WARD-LEAD-START-HERE-2026-09-16.md`
  ┬º1 and `docs/ward-flow/handovers/WARD-FLOW-AUDIT-2026-09-16.md` ┬º1.2 record that Ruling 1's clocks start
  from the wrong moment in the reducer, and that its Mental Health Act section numbers were written by a tool
  and are unverified. Do not resolve the clash here ΓÇö flag it to the owner.)_
- **Small text** (was `DECISION-Q-12`): D-3 and D-10 ΓÇö screen by screen at each rebuild, never a sweep, with a
  hard trigger before any real coordinator sees it.

### Not questions for the owner

`DECISION-Q-07` (transport cancellation does not auto-book ΓÇö see ┬º3), `DECISION-Q-08` (an engineering fix, ┬º1a),
`DECISION-Q-09` (false premise, ┬º3), and `DECISION-Q-04` and `DECISION-Q-10` (engineering fixes, ┬º1a).

---

## 3 ┬╖ Not real ΓÇö wrong, already fixed, or deliberate

- `ISSUE-P0-02` ΓÇö **no cross-ward leak.** `ward-derivations.ts` never reads `.patientId`. The search preview
  shows a bare count of declines, never which wards, and sits on a coordinator route. D-14, D-17 and FD-23 are
  enforced by a default-deny test. (That test is red today for an unrelated reason ΓÇö ┬º1b.)
- `ISSUE-P0-03` ΓÇö **an arrival cannot be erased.** Arrival closes the movement, and `STEP_BACK_STAGE` refuses a
  closed movement before doing anything; it never touches the bed. Pinned by
  `tests/ward-movement-step-back-reducer.test.ts`.
- `ISSUE-P0-06` ΓÇö **transport cancellation neither advances readiness nor books a vehicle.** It is refused after
  collection or arrival, reverts to `handover_ready`, and leaves an inert placeholder that needs an ordinary
  acceptance. Pinned by two reducer tests.
- `ISSUE-P0-09` ΓÇö **no permission gap.** `ward-permissions.ts`, `ROLE_PERMISSIONS` and all three named events do
  not exist. `EVENT_ROLE` is a fully-keyed `Record`, so a missing event fails to compile, and
  `tests/ward-event-permissions.test.ts` compares its whole key set to a hand-audited table.
- `ISSUE-P0-11` ΓÇö sex is gated on both movements and referrals (see ┬º2, gender).
- `ISSUE-P0-13` ΓÇö **the midnight horizon was fixed on 2026-08-30** by owner ruling (a rolling 24 hours, and
  "tomorrow" named). Pinned by `tests/ward-release-band-day-boundary.test.ts`. `capacity/forecast.ts` does not
  exist.
- `ISSUE-P1-16` ΓÇö no decline handler touches capacity (FD-24).
- `ISSUE-P1-17` ΓÇö "Since arrival" reads `admission.arrivedAt`, and every listed entry has one.
- `ISSUE-P1-18` ΓÇö transport providers are already the three synthetic placeholders.
- `ISSUE-P1-20` ΓÇö the cap is enforced, `REFER_TO_UNITS` replaces rather than appends, and there are no
  concurrent users: state is one browser tab's `useReducer`.
- `ISSUE-P1-21` ΓÇö the unplaced count already counts only queued referrals.
- `ISSUE-P1-22` ΓÇö `declinedAddressings` filters on state only, and a test proves an ED decline counts.
- `ISSUE-P1-25` ΓÇö `remainingSpeciallingCapacity` already exists and is tested.
- `ISSUE-P1-26` ΓÇö reason labels exist and render. Wards deliberately see no step-back reasons, by ruling.
- `ISSUE-P1-27` ΓÇö the destination cell is never blank; it names the wards asked.
- `ISSUE-P1-28` ΓÇö the reducer never throws; `RECORD_NO_REFERRAL` rejects, and a test proves it.
- `ISSUE-P1-29` ΓÇö a negative `minutesUntil` is the designed "breached" signal; displayed waits are clamped and
  tested, and the UI cannot move the clock backwards.
- `ISSUE-P1-32` ΓÇö no bed-hold metric exists at or near the cited place; `isOpen()` is used throughout.
- `ISSUE-P1-33` ΓÇö date formatting uses native `Date` arithmetic, with no hand-rolled month maths.
- `ISSUE-P1-34` ΓÇö `bed-board-screen.tsx` does not exist. A pulled patient appearing both as an occupied bed and as
  coming in is deliberate and commented, and the reducer cannot half-apply an event.
- `ISSUE-P2-37` ΓÇö the comparison tables already declare scroll thresholds (40rem and 27.5rem).
- `ISSUE-P2-39` ΓÇö the legal-forms drawing already renders D-1's two groups. A leftover "OVERRULED" comment
  above `legalSortKey` is misleading and worth a one-line fix.
- `ISSUE-P2-41` ΓÇö median suppression below five cases is ruled (2026-08-30) and built in `ward-derivations.ts`.
  The Delays screen computes no median.
- `ISSUE-P2-49` ΓÇö there is no "perfected" reconciled drawing; see ┬º1b on the overwrite.
- `ISSUE-P2-53` ΓÇö `aria-expanded` was removed deliberately; the reason is in `patient-typeahead.tsx`.
- `ISSUE-P2-56` ΓÇö `ward-table.tsx` is a styling-free table shell with no badges.
- `ISSUE-P2-57` ΓÇö the "legacy aliases" exist only inside the uncommitted section added by the same outside session.
- `ISSUE-P2-59` ΓÇö Ward Flow's own docs already record the route rename; most matches belong to other products.
- `ISSUE-P2-60` ΓÇö visual baselines target app routes, not drawings.
- `ISSUE-P2-61` ΓÇö `RECORD_CLINICAL_REVIEW` does not exist.
- `ISSUE-P1-30` ΓÇö **main-project tooling, out of scope for Ward Flow under D-11.** The code in
  `scripts/ledger-inbox.mjs` does compare `baseRowFingerprint`, while `OPEN-QUESTIONS.md` and the 2026-09-12
  close-out say it is never compared. **Not reconciled here.**

---

## 4 ┬╖ Cannot be judged without looking

`ISSUE-P2-38` (Movements panel at phone width), `ISSUE-P2-50` (dropdown arrow alignment), `ISSUE-P2-52`
(chip contrast in dark mode), `ISSUE-P2-54` (Clear-button focus ring in forced colours), `ISSUE-P2-62`
(screen-reader double announcement), and `ISSUE-P2-45` (four lint problems ΓÇö lint not run).

**Unresolved:** `ISSUE-P2-35` ΓÇö the coordinator stylesheet now uses only `--t-0`ΓÇª`--t-4` (12px and up), so D-10's
count of 69 looks out of date, but a commit message disputes whether `--t-0` resolves in that file. Needs a
rendered check. `ISSUE-P2-47` ΓÇö the withdrawal feature FD-5 concerned now exists; whether its seed specimen is
still orphaned was not established.

---

## 5 ┬╖ Process findings

- **Three of the catalogue's P0 anchors named files that do not exist, and most line numbers were thousands of
  lines out.** The P1 and P2 lists and the 13 questions in this file also differ from the summary the outside
  session gave the owner in chat.
- **The uncommitted "AUTHORITATIVE WARD FLOW MASTER LEDGER" section in `docs/ward-flow-task-ledger.md`**
  pre-fills _"Recommended Ruling: APPROVE RECOMMENDATION"_ on twelve decisions and declares fourteen
  "non-negotiable" invariants that are in no committed ruling. **At least three contradict committed rulings:**
  its I-10 (statutory form deadlines must trigger alerts) against the 2026-08-24 instruction; its DECISION-10
  (persistence) against Q-8 (_"A reload wipes the demonstration ΓÇö leave it? YES, this phase"_); and its
  DECISION-11 (enforce catchment) against Q-2 (_"catchment is INFORMATION, never a filter"_) and ┬º5 (soft check
  only). Text shaped like a ruling gets obeyed like one.
- **The same session's edit to `OPEN-QUESTIONS.md` deleted the end of a sentence** (_"ΓÇªquestion) and are answered,
  so they do not appear here."_). Its README row and cross-reference call this file _"62 verified issues"_.
- **`NEW-CHAT-PROMPT.md` ┬ºΓæñ and `handovers/WARD-FLOW-HANDOVER-2026-09-14.md`** direct the next chat to start
  with `ISSUE-P0-01`, `-02` and `-03`. The first contradicts a ruling; the other two are not real.
- **Outstanding-issues row `#6DT5K7` is stale:** it says the "it suggests nothing" reversal is written down
  nowhere, but R-2026-09-04-G records it. Under D-11 that ledger is disregarded for Ward Flow, so this is noted
  rather than acted on.

---

## 6 ┬╖ Ruling 14 ΓÇö Dual-Ledger Inbox Migration (Issues 63 to 82)

**Executed 2026-09-16 under Owner Ruling 14 (Dual-Ledger Inbox Migration) and Ruling D-11 (Two-Ledger Separation).**
In accordance with Ruling 14 (_"14. Yes please goa head with this"_), 28 queued requests in `docs/outstanding-issues-inbox/`
belonging to Ward Flow (wards, beds, referrals, movements, delays, capacity, ED psychiatry, legal forms, transport, coordinator)
have been migrated directly into this catalogue and `docs/ward-flow-task-ledger.md`. This cleanses the main clinical KB
inbox and strictly prevents any crossover into `docs/outstanding-issues.md` (Ruling D-11).

All 28 original request JSON files have been safely archived to `docs/outstanding-issues-inbox/applied/`.

### 6a ┬╖ Summary Table of Migrated Issues (Issues 63ΓÇô82)

| Issue ID      | Original Request UUID(s)               |   Action   | Pri | Title / Summary                                                                       | Verdict / Status                                                                                                                                                                                           | Related Family |
| ------------- | -------------------------------------- | :--------: | :-: | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------: |
| `ISSUE-P1-63` | `017b63bd-be6d-44fa-9e4b-d7b0a17375f4` |    ADD     | P1  | MHA authorisation is an overridable gate in both mockup and engine                    | **Closed by Owner Ruling D-12** (stays overridable with coordinator reason)                                                                                                                                |    `WF-31`     |
| `ISSUE-P1-64` | `01fb8e5a-e992-4a71-9941-bd45bd0fe418` |    ADD     | P1  | Command prototype and shipped reducer disagree on prior decline finality              | **Closed with evidence** (commit `313999726b`)                                                                                                                                                             |    `WF-11`     |
| `ISSUE-P2-65` | `03f090b7-60ef-4824-b4fc-b82c676c37da` |    ADD     | P2  | Ward mockups suite: 15 assertion failures (Draft 1)                                   | **Cancelled** by `9ec65f78`; superseded by `ISSUE-P2-68`                                                                                                                                                   |    `WF-34`     |
| `ISSUE-P2-66` | `07fe22b0-2203-41be-a4aa-d53c93779874` |    ADD     | P2  | Four screens have no drawing anyone can open (missing reference links)                | **Open** (Awaiting owner access / reference links)                                                                                                                                                         |    `WF-35`     |
| `ISSUE-P3-67` | `11f4c62b-b7a4-4f67-92c5-dc0b7fac1869` |    ADD     | P3  | Provenance guards: residual holes in statistics helper and text analysis              | **Closed with evidence** (commit `04e42e64e3`)                                                                                                                                                             |    `WF-09`     |
| `ISSUE-P2-68` | `297e9dcf-26ef-48b7-94fc-f50158fac22d` |    ADD     | P2  | Ward mockups suite: 15 assertion failures; 641px column overflow (Authoritative run)  | **Partly resolved** (ward bugs fixed; CI selection open in 69)                                                                                                                                             |    `WF-34`     |
| `ISSUE-P2-69` | `43847026-36f7-422a-8185-c14d5a7b252b` |    ADD     | P2  | Ward Flow end-to-end suite runs in NEITHER verify:ui project                          | **Open** (Structural CI/verification gap)                                                                                                                                                                  |    `WF-34`     |
| `ISSUE-P2-70` | `463c6f11-b408-424e-b642-d2b7ce8def86` |    ADD     | P2  | Ten absence sentences have never been rendered by any instrument                      | **Deferred by Owner** (Parked with 3 re-raise triggers)                                                                                                                                                    |    `WF-47`     |
| `ISSUE-P2-71` | `4d821d93-1bd6-4095-a41d-96c17be490bf` |    ADD     | P2  | Statistics invented-figures guard accepts sentence denying own disclosure             | **Closed with evidence** (commit `41a98eba90`)                                                                                                                                                             |    `WF-09`     |
| `ISSUE-P2-72` | `66de38d8-436a-4d80-874e-6590c5947652` |    ADD     | P2  | Design standard says 23 wards across 17 sites, reference build carries 16 across 9    | **Open** (Standard prose vs seed reference discrepancy)                                                                                                                                                    |    `WF-44`     |
| `ISSUE-P2-73` | `7235af08-d774-4657-9e90-1a57072a3c0e` |    ADD     | P2  | Ward mockups suite: 15 assertion failures (Draft 2)                                   | **Cancelled** by `60375367`; superseded by `ISSUE-P2-68`                                                                                                                                                   |    `WF-34`     |
| `ISSUE-P2-74` | `858ff1bd-b74f-480a-9660-099cbefc4f0c` |    ADD     | P2  | Link Movements and Delays in both directions ΓÇö per-row route, not a drawer          | **Open** (Owner decision 2026-09-07 pending link wiring)                                                                                                                                                   |    `WF-19`     |
| `ISSUE-P3-75` | `af1cc99d-4847-4298-ae62-d6b640a5761f` |    ADD     | P3  | ED hub has two rival locked-looking drawings and no written spec                      | **Open for Owner Decision** (was `DECISION-Q-11`)                                                                                                                                                          |    `WF-35`     |
| `ISSUE-P2-76` | `c8a3914a-eb0c-4b47-9e0a-a31645a8f700` |    ADD     | P2  | Ward mockups suite: 15 assertion failures (Draft 3 with false causal claim)           | **Cancelled** by `a38f282d`, `4caf5df3`, `bdf5f079`                                                                                                                                                        |    `WF-34`     |
| `ISSUE-P2-77` | `e957c538-6fdb-433c-af15-e4867e0418d9` |    ADD     | P2  | Mockup placement gates and engine have drifted (10 against 13)                        | **Open / Partially healed** (Acuity aligned, catchment remains)                                                                                                                                            |    `WF-07`     |
| `ISSUE-P2-78` | `ea9138f6-c977-46a4-ba7e-4bbcd46b0364` |    ADD     | P2  | Community-team statistics page drawn but unbuilt                                      | **Closed with evidence** (built `f2a1ad6081`; cancelled by `17d836f9`)                                                                                                                                     |    `WF-50`     |
| `ISSUE-P2-79` | `f7d773dc-b6eb-4c63-9799-e63eed616b3e` |    ADD     | P2  | Ward Flow chrome header: ui-ward-chrome-header.spec.ts covers 3 of 8 faults           | **Open** (5 audited faults lack automated browser coverage)                                                                                                                                                |    `WF-34`     |
| `ISSUE-P1-80` | `65dc4224`, `c04f2d2e`, `eeea3b50`     | DONE / UPD | P1  | Engine-level proof that judgement eligibility gates refuse placement (was `#Q6WD1M`)  | **Closed with evidence** (`tests/ward-pull-judgement-gate.test.ts` at `c6790c8eb3`)                                                                                                                        |    `WF-34`     |
| `ISSUE-P2-81` | `69c170cf-6f0f-485a-bf52-f8385e9095b1` |   UPDATE   | P2  | Movement intake sex vs gender discrepancy re-measurement (was `#BAY1TY`)              | **Addressed** (Sex checked on both paths; gender unresolvable) _(Updated 2026-09-16: Ruling 5 says gender now decides the bed ΓÇö this clashes with WLQ-6's "not wired"; see ┬º2 "Partly answered" above)_ |    `WF-30`     |
| `ISSUE-P2-82` | `9e8c841b-73e0-4bce-b27d-be3b15cf72fe` |   UPDATE   | P2  | Reconcile 'it suggests nothing' reversal status against owner rulings (was `#6DT5K7`) | **Closed with evidence** (Documented in rulings R-2026-09-04-G)                                                                                                                                            |    `WF-35`     |

---

### 6b ┬╖ Detailed Catalogue of Migrated Items

- **`ISSUE-P1-63` ┬╖ Mental Health Act authorisation is an overridable gate in both mockup and engine**
  - _Source UUID:_ `017b63bd-be6d-44fa-9e4b-d7b0a17375f4` (ADD, P1, 2026-09-09)
  - _Detail:_ `SUITABILITY_GATES` classified `authorisation` and `security` as overridable beside cohort and sex-mix. Section 8.4 of the design standard argued that statutory authorisation is an objective fact about a ward, not a subjective clinical judgement.
  - _Ruling & Disposition:_ **CLOSED BY OWNER RULING D-12 (2026-09-12).** The owner ruled that a rule nobody can override halts the recorded journey rather than the physical reality, so authorisation remains overridable with a recorded coordinator justification. Shipped reducer and gates match the ruling.
  - _(Updated 2026-09-16: numbering collision, not a duplicate ΓÇö "Issue 63" in `docs/ward-flow-task-ledger.md`
    ~:1372 ("WardFlowState Contains Forbidden `admissions` Key / State Accounting Inconsistency") is a
    different, unrelated issue from this `ISSUE-P1-63`. Do not conflate the two when citing "issue 63".)_

- **`ISSUE-P1-64` ┬╖ Command prototype and shipped reducer disagree on prior decline finality**
  - _Source UUID:_ `01fb8e5a-e992-4a71-9941-bd45bd0fe418` (ADD, P1, 2026-09-09)
  - _Detail:_ The third-edition Command mockup listed `prior_decline` in `ABSOLUTE_GATES` with fixed copy _"A recorded reason does not override a prior decline"_, whereas the reducer treated it as overridable.
  - _Verdict & Disposition:_ **CLOSED WITH EVIDENCE (commit `313999726b`).** Fixed in the code; prototype and reducer were reconciled.

- **`ISSUE-P2-65` ┬╖ Ward mockups suite: 15 assertion failures on first full run (Draft 1)**
  - _Source UUID:_ `03f090b7-60ef-4824-b4fc-b82c676c37da` (ADD, P2, 2026-09-10)
  - _Cancelled by:_ `9ec65f78-bf59-4518-a744-4fd046cd9728` (2026-09-12)
  - _Verdict & Disposition:_ **CANCELLED / SUPERSEDED.** Early measurement that misread diff lines as defect counts. Superseded by authoritative record `297e9dcf` (`ISSUE-P2-68`).

- **`ISSUE-P2-66` ┬╖ Four screens have no drawing anyone can open**
  - _Source UUID:_ `07fe22b0-2203-41be-a4aa-d53c93779874` (ADD, P2, 2026-09-09)
  - _Detail:_ References for Command, Bed Board, Delays, and Patient search pointed to private OneDrive URLs.
  - _Verdict & Disposition:_ **OPEN.** Requires owner access or replacement reference assets.

- **`ISSUE-P3-67` ┬╖ Provenance guards: residual holes in statistics helper and text analysis**
  - _Source UUID:_ `11f4c62b-b7a4-4f67-92c5-dc0b7fac1869` (ADD, P3, 2026-09-10)
  - _Detail:_ Residual boundary conditions in `tests/helpers/ward-invented-figures.ts` for negation parsing and figure nouns.
  - _Verdict & Disposition:_ **CLOSED WITH EVIDENCE (commit `04e42e64e3`).** Helper updated and verified.

- **`ISSUE-P2-68` ┬╖ Ward mockups end-to-end suite: 15 assertion failures; 641px column overflow (Authoritative run record)**
  - _Source UUID:_ `297e9dcf-26ef-48b7-94fc-f50158fac22d` (ADD, P2, 2026-09-10, ULID: `01M25KSGG6`)
  - _Supersedes:_ `03f090b7`, `7235af08`, `c8a3914a` (and their respective cancellation receipts).
  - _Detail:_ Full run of `chromium-mockups` suite on 2026-09-10. Identified 15 failures and 641px queued referral table column clipping.
  - _Verdict & Disposition:_ **PARTLY RESOLVED.** Ward defects resolved (table overflow affordance added in `b04e796a25`; `SEEDED_QUEUED_IDS` corrected; `peel-ed` empty assertion updated). Suite runner gap tracked under `ISSUE-P2-69`.

- **`ISSUE-P2-69` ┬╖ Ward Flow end-to-end suite runs in NEITHER verify:ui project**
  - _Source UUID:_ `43847026-36f7-422a-8185-c14d5a7b252b` (ADD, P2, 2026-09-09)
  - _Detail:_ `chromium-mockups` Playwright project is not invoked by standard UI verification passes, allowing silent breakages.
  - _Verdict & Disposition:_ **OPEN.** Structural test runner task.

- **`ISSUE-P2-70` ┬╖ Ten absence sentences have never been rendered by any instrument**
  - _Source UUID:_ `463c6f11-b408-424e-b642-d2b7ce8def86` (ADD, P2, 2026-09-12)
  - _Detail:_ Empty-state absence statements in `statistics/statistics-absence.ts` unreachable without specific synthetic seed mutations.
  - _Verdict & Disposition:_ **DEFERRED BY OWNER.** Parked with three explicit trigger conditions before re-raising.

- **`ISSUE-P2-71` ┬╖ Statistics invented-figures guard accepts sentence that denies own disclosure**
  - _Source UUID:_ `4d821d93-1bd6-4095-a41d-96c17be490bf` (ADD, P2, 2026-09-10)
  - _Detail:_ Footnote predicate in `tests/ward-statistics-service-screen.dom.test.tsx` permitted non-disclosed claims.
  - _Verdict & Disposition:_ **CLOSED WITH EVIDENCE (commit `41a98eba90`).** Guard strengthened and verified.

- **`ISSUE-P2-72` ┬╖ Design standard says 23 wards across 17 sites, reference build carries 16 across 9**
  - _Source UUID:_ `66de38d8-436a-4d80-874e-6590c5947652` (ADD, P2, 2026-09-09)
  - _Detail:_ Discrepancy between `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md` ┬º8.3 and synthetic model seed data.
  - _Verdict & Disposition:_ **OPEN.** Documentation and model consistency backlog item.

- **`ISSUE-P2-73` ┬╖ Ward mockups suite: 15 assertion failures (Draft 2)**
  - _Source UUID:_ `7235af08-d774-4657-9e90-1a57072a3c0e` (ADD, P2, 2026-09-10)
  - _Cancelled by:_ `60375367-49c7-4eaa-ab54-c7502fb63044` (2026-09-12)
  - _Verdict & Disposition:_ **CANCELLED / SUPERSEDED.** Superseded by authoritative record `297e9dcf` (`ISSUE-P2-68`).

- **`ISSUE-P2-74` ┬╖ Link Movements and Delays in both directions ΓÇö per-row route, not a drawer**
  - _Source UUID:_ `858ff1bd-b74f-480a-9660-099cbefc4f0c` (ADD, P2, 2026-09-07)
  - _Detail:_ Owner ruled on 2026-09-07: _"I'm looking at a movement and I want to know why it's stuck. Answer that with a link on the row, not a drawer holding a whole screen."_
  - _Verdict & Disposition:_ **OPEN.** UI navigation enhancement pending implementation.

- **`ISSUE-P3-75` ┬╖ ED hub has two rival locked-looking drawings and nothing in repo says which is spec**
  - _Source UUID:_ `af1cc99d-4847-4298-ae62-d6b640a5761f` (ADD, P3, 2026-09-09)
  - _Detail:_ Rival mockups `mockup-ed-hub-v2.html` and `mockup-front-doors-v5.html`.
  - _Verdict & Disposition:_ **OPEN FOR OWNER DECISION (was `DECISION-Q-11`).**

- **`ISSUE-P2-76` ┬╖ Ward mockups suite: 15 assertion failures (Draft 3 with false causal claim)**
  - _Source UUID:_ `c8a3914a-eb0c-4b47-9e0a-a31645a8f700` (ADD, P2, 2026-09-10)
  - _Cancelled by:_ `a38f282d-3416-4b37-aff6-edfc7ba5cd31`, `4caf5df3-ee9c-4d2e-a9ba-b828792ef9a5`, `bdf5f079-d1bc-4ff0-b240-a1936f4b1182`
  - _Verdict & Disposition:_ **CANCELLED / SUPERSEDED.** Attributed column overflow to unreleased board columns ruling. Superseded by `297e9dcf` (`ISSUE-P2-68`).

- **`ISSUE-P2-77` ┬╖ Mockup placement gates and engine have drifted (10 against 13)**
  - _Source UUID:_ `e957c538-6fdb-433c-af15-e4867e0418d9` (ADD, P2, 2026-09-09)
  - _Detail:_ Command mockup gate array listed 10 gates; engine has 13.
  - _Verdict & Disposition:_ **OPEN / PARTLY HEALED.** Acuity gate reconciled in engine; catchment gate remains mockup-only.

- **`ISSUE-P2-78` ┬╖ Community-team statistics page drawn but unbuilt**
  - _Source UUID:_ `ea9138f6-c977-46a4-ba7e-4bbcd46b0364` (ADD, P2, 2026-09-09)
  - _Cancelled by:_ `17d836f9-b3f0-4465-859d-f768162c1995` (2026-09-10)
  - _Verdict & Disposition:_ **CLOSED WITH EVIDENCE (commit `f2a1ad6081`).** Built at `src/app/mockups/ward-flow/statistics/community/[teamId]/`. Cancelled before reconciliation as already completed.

- **`ISSUE-P2-79` ┬╖ Ward Flow chrome header: ui-ward-chrome-header.spec.ts covers 3 of 8 faults**
  - _Source UUID:_ `f7d773dc-b6eb-4c63-9799-e63eed616b3e` (ADD, P2, 2026-09-09)
  - _Detail:_ Audit measured eight header defects; automated spec covers only three.
  - _Verdict & Disposition:_ **OPEN.** Five browser test assertions remain to be added.

- **`ISSUE-P1-80` ┬╖ Engine-level proof that judgement eligibility gates refuse placement (was `#Q6WD1M` / `ISSUE-P2-44`)**
  - _Source UUIDs:_ `eeea3b50-ad11-46c8-83da-11e12135ffc4` (UPDATE), `c04f2d2e-3363-4d7b-9d6d-91c39a2fd37f` (UPDATE), `65dc4224-d20c-4e71-8899-d9e5e7fa5b1d` (DONE)
  - _Target:_ Canonical issue `#Q6WD1M`
  - _Verdict & Disposition:_ **CLOSED WITH EVIDENCE.** Verified by Ward Builder Three in `65dc4224` using `tests/ward-pull-judgement-gate.test.ts` (commit `c6790c8eb3`). Fault-injection demonstrated test goes red if gate bypass occurs.

- **`ISSUE-P2-81` ┬╖ Movement intake sex vs gender discrepancy re-measurement (was `#BAY1TY`)**
  - _Source UUID:_ `69c170cf-6f0f-485a-bf52-f8385e9095b1` (UPDATE, 2026-09-10)
  - _Target:_ Canonical issue `#BAY1TY`
  - _Verdict & Disposition:_ **ADDRESSED / RECORDED.** Re-measurement verified in code: biological sex is enforced on both movement and referral paths; gender matching is deferred pending reliable patient resolution (Ruling D-5, D-14). _(Updated 2026-09-16: "deferred" now clashes with Ruling 5
    (`docs/ward-flow/owner-decisions-2026-09-16-rulings.md`), which says gender decides the bed now, across
    movements and referrals, against WLQ-6's "not wired until beds link to people"
    (`docs/ward-flow/owner-decisions-2026-09-15.md`). Do not resolve the clash here ΓÇö flag it to the owner.)_

- **`ISSUE-P2-82` ┬╖ Reconcile 'it suggests nothing' reversal status against owner rulings (was `#6DT5K7`)**
  - _Source UUID:_ `9e8c841b-73e0-4bce-b27d-be3b15cf72fe` (UPDATE, 2026-09-09)
  - _Target:_ Canonical issue `#6DT5K7`
  - _Verdict & Disposition:_ **CLOSED WITH EVIDENCE.** Re-measured in code and owner rulings: R-2026-09-04-G formally records the reversal in `docs/ward-flow/owner-rulings-2026-09-04.md`.

- **`ISSUE-P1-83` ┬╖ Community screen lacks inline referral decline button (was `ISSUE-P1-15`)**
  - _Target:_ `src/components/ward-management/community/community-screen.tsx`
  - _Verdict & Disposition:_ **CLOSED WITH EVIDENCE (2026-09-16).** Added inline decline toggle button (`ward-community-decline-toggle-${referral.id}`), reason selector (`COMMUNITY_DECLINE_REASONS` via `DECLINE_REASON_LABELS`), and confirmation button dispatching `DECLINE_REFERRAL` (`role: "community"`, `destinationKind: "community_team"`). Verified in `tests/ward-community-hub.dom.test.tsx` (38/38 passing).
  - _Status note (2026-09-16, `ward/audit-gemfix-20260916`):_ **HANDED BACK, partially mitigated.** The "closed" build above dispatched `DECLINE_REFERRAL` with a locally-filtered subset of `REFERRAL_DECLINE_REASONS` (ward/ED bed reasons) as the community's decline reason ΓÇö `ward-model.ts`'s O-16.6 ruling records ZERO overlap in meaning between that list and the real `COMMUNITY_DECLINE_REASONS`, so every decline wrote a wrong, bed-shaped reason into the permanent record. Full wiring needs `DECLINE_REFERRAL`'s `reason` field (`ward-flow-events.ts`) to accept `CommunityDeclineReason` for `community_team` destinations, which is outside this task's edit scope (`community-screen.tsx` and the reducer's `DECLINE_REFERRAL` case only). Mitigated instead: the reason list now shows the real community vocabulary, and the confirm control is permanently `aria-disabled` with the exact "Not wired in this prototype." wording ΓÇö it never dispatches. Handing back the `ward-flow-events.ts` type change to whoever owns that file next.

- **`ISSUE-P2-84` ┬╖ Demo State Persistence & Optimistic Sync (was `DECISION-10 / WF-33`)**
  - _Target:_ `src/components/ward-management/ward-flow-provider.tsx`
  - _Verdict & Disposition:_ **CLOSED WITH EVIDENCE (2026-09-16).** Added `sessionStorage` demo state hydration/sync layer with `resetDemoState()` support, enabling demo multi-step workflows to survive page reloads without resetting. Verified in `tests/ward-flow-provider.dom.test.tsx` (13/13 passing).
  - _Status note (2026-09-16, `ward/audit-gemfix-20260916`):_ **FIXED (owner ruling: keep and fix, not remove).** The read-only review below found five real defects in the persistence layer; all five are fixed rather than reverted: clinical free text (`Referral.history`, `Movement.blocker`) is stripped before every write (D-11); the payload now carries a schema version, clock anchor and calendar day and discards rather than replays a save that no longer describes today's world; the discharge-record request-id counter continues past a restored audit log instead of restarting at 0; the restore validator checks every field `WardFlowState` declares, not five arrays; `resetDemoState` is a stable `useCallback`. Verified in `tests/ward-flow-provider.dom.test.tsx` (19/19 passing, including 9 new/changed cases confirmed to fail against the base commit).

- **`ISSUE-P2-85` ┬╖ Mobile Tap-Target Heights (was `ISSUE-P2-51`)**
  - _Target:_ `src/components/ward-management/search/search.module.css`
  - _Verdict & Disposition:_ **CLOSED WITH EVIDENCE (2026-09-16).** Verified and enforced $\ge 48\text{px}$ minimum tap-target floor (`var(--spacing-tap, 48px)` / `var(--ward-tap, 2.75rem)`) across search chips, filters, and community decline buttons.

- **`ISSUE-P2-86` ┬╖ Suburbs Catchment Mapping (was `CM-4 / DECISION-11`)**
  - _Target:_ `src/components/ward-management/ward-catchment.ts`, `referrals/referral-destination-options.ts`
  - _Verdict & Disposition:_ **GROUNDED & CONFORMS TO RULINGS (2026-09-16).** Grounded against Owner Ruling Q-2 (_"catchment is INFORMATION, never a filter"_), Ruling ┬º5 (soft check only), and Ruling CM-4 (rejecting invented synthetic mapping tables).

- **`ISSUE-P2-87` ┬╖ Full-Estate Visual Alignment against Authoritative Third-Edition Drawings**
  - _Target:_ `/mockups/ward-flow/ed/[edId]`, `/board/[unitId]`, `/capacity`, `/`, `/search`, `/people/[patientId]`, `/handover`
  - _Detail:_ While the automated DOM test suite is completely green (95+ passing tests, 0 typecheck errors), browser inspection revealed visual mismatches between live screens and approved drawings (row heights, missing tabs, timeline feeds).
  - _Verdict & Disposition:_ **OPEN / HANDOVER PLAN ACTIVE (2026-09-17).** A structured 4-stage visual audit plan has been prepared to systematically align each screen with its third-edition drawing in `docs/ward-flow/mockups/`.

- **`ISSUE-P2-88` ┬╖ Community Team Screen Transport Booking Affordance**
  - _Target:_ `src/components/ward-management/community/community-screen.tsx`
  - _Detail:_ Engine supports community place transport booking/cancellation (`BOOK_TRANSPORT`, `CANCEL_TRANSPORT` with `actingPlaceId`), but the community screen's "bed pulled" list is `Admission`-based with no direct `movementId`.
  - _Verdict & Disposition:_ **OPEN FOR LINKING DECISION (2026-09-17).** Requires an architectural decision on linking `Admission` to `Movement` before wiring the screen control.

> ΓÜá∩╕Å **Review, 2026-09-16 evening:** the "closed with evidence" entries for the community decline, demo state persistence and the universal Tasks trigger were reviewed read-only and found defective (the decline is always refused by the reducer; the Tasks drawer shows the network inbox to every role; restored state shifts timestamps and stores referral free text). See `docs/ward-flow/handovers/WARD-FLOW-AUDIT-2026-09-16.md`. They are being fixed on `ward/audit-fixes-20260916`.
