# Ward Flow — open questions

**Rewritten 17 September 2026, evening, round 2. Keeps only what is still genuinely open.** Re-derive
before acting on anything below. For the full history of how each item was closed, see the dated
entries this replaces, kept below the line, and `docs/ward-flow-task-ledger.md` §7.8.

> **Cross-Reference:** for every Ward Flow task and its current state, see
> **[`../ward-flow-task-ledger.md`](../ward-flow-task-ledger.md)**, §7.8 for the round-2 refresh.
> `PROJECT-ISSUES.md` is a historical worksheet, not the current task list.

---

## NEEDS THE OWNER

None open. R2-17 (Statistics link on the patient-search drawing) and the urgent-flag reason placeholder wording were both answered yes on 17 September; see `archive/dated-notes/owner-answers-2026-09-17.md`, "Fourth ruling".

Before any real data, item 58 (internal patient codes) is
decided again.

---

## ANSWERED — kept for the record, not questions any more

- **Gender-determines-bed gate, movements and referrals (item 8).** Answered and built: gender is
  checked at referral raise, with gender corrections re-checking the held ward; non-binary placement
  on a single-gender ward is allowed with a coordinator's recorded reason (R2-2). Detail:
  `docs/ward-flow/STATUS.md` "What is built".
- **A ward or community team cancelling transport it booked (item 24, R2-9).** Superseded, not just
  answered: transport booking is being redefined as a logged phone call rather than an in-app booking
  (the owner's third 17 September ruling). Once that lands, a community team can log and cancel only
  its own booking. In progress on `ward/r2-referrals-community-20260917`. Detail:
  `docs/ward-flow/STATUS.md` "Round 2" and "Deferred".
- **Which emergency-department drawing is the spec (item 42).** Answered:
  `emergency-department-third-edition.html` is confirmed as the ED drawing (archive/dated-notes/owner-answers-2026-09-17.md
  item 42; also registered at `/ed/[edId]` in `SCREEN-VERIFICATION.md`).
- **`O-17.1` / two type scales.** Was never actually unanswered — already indexed in `OWNER-RULINGS.md`
  as "screens migrate at their own rebuild, never as a sweep". Housekeeping only.

**The Aboriginal cultural safety review is never listed here as a question.** It is deferred by the
owner, second round, his own verbatim words: _"Stop asking and add to ledger... i have deferred."_ He
arranges it himself; it stays a hard gate before any real-patient use. Recorded at
`docs/ward-flow-task-ledger.md` (`WF-53`) and `docs/ward-flow/archive/dated-notes/owner-answers-2026-09-17.md` ("Second
round," answer 6). Do not raise it with him again, in this file or anywhere else.

---

## Superseded sections below this line, kept for history

> [!CAUTION]
> **HISTORICAL ARCHIVE ONLY — ZERO OPEN QUESTIONS.**
> All items below were resolved, answered, or deferred on 12–18 September 2026. Do NOT re-ask or act on any question below. Settled questions stay settled (standing rule: `a-question-he-has-already-answered.md`).

Everything from here down was written 2026-09-12 and is superseded by the sections above. Do not act
on it without re-deriving against current git and `docs/ward-flow-task-ledger.md` first.

## ① NEEDS THE OWNER — clinical (2026-09-12, superseded above)

- **Is the gender-determines-bed gate wired into movements and referrals, or does it stay
  reducer-only for now?** It is built and tested for admissions, but movements and referrals do
  not reliably resolve to a patient record yet, so the safety gate does not actually run on those
  two paths. Blocks full protection of the two-field sex/gender ruling outside admission. Detail:
  `docs/ward-flow/handovers/NEW-BUILD-HANDOVER-2026-09-12.md` §7.
- **Should the `security` gate (a locked/secure bed) be overridable, the same way authorisation
  now is?** The owner ruled on authorisation with his own clinical reasoning; `security` was raised
  in the same breath but was deliberately not extended to it by inference, and has never actually
  been put to him. Blocks writing the reasoning into the design standard and the mockup's gate-detail
  text for `security`. Detail: `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-12-fold-and-authorisation.md`
  (D-9, "the same answer applies to security"). _(Updated 2026-09-16: answered — WLQ-3,
  `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-15.md` ~:42, "the engine already classified `security`
  as overridable; the reason now sits in design standard §8.4.")_
- ~~Who does the Aboriginal cultural safety review, and can Ward Flow move toward real clinical use
  before it happens?~~ **CLOSED — DEFERRED BY THE OWNER, do not re-ask.** See "ANSWERED" above.

---

## ② NEEDS THE OWNER — product or process (2026-09-12, superseded above)

- **Should the 27 ward-side queued requests be filed into the main project ledger first and then
  migrated, or redirected straight to the Ward Flow ledger?** Asked directly; not guessed at.
  Blocks draining the inbox cleanly under the new two-ledger rule. Detail:
  `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-12-fold-and-authorisation.md` (D-11, "still owed").
  _(Updated 2026-09-16: answered — Owner Ruling 14, "Yes please goa head with this", directing the
  requests straight into the Ward Flow ledger (now 28 in the queue). Detail:
  `docs/ward-flow/PROJECT-ISSUES.md` ~:154 and its Ruling 14 section, ~:288 onward.)_
- **May a ward or community team cancel transport it booked itself?** See "ANSWERED" above — item 24,
  R2-9, now superseded by the logged-phone-call redesign.
- **Which of the emergency-department hub's two rival drawings is the actual spec?** See "ANSWERED"
  above — item 42, closed.
- **`--t-N` / `O-17.1` is still unanswered**, and its own reopening trigger has already passed
  unnoticed (the first rebuild that needed it went ahead without it). What the question actually
  asks is not detailed in the source read for this document — open the file below before treating
  it as answered or safe to ignore. Detail: `docs/ward-flow/handovers/ward-lead-close-out-2026-09-12.md`
  §5. _(Closed 2026-09-17: this was never actually unanswered — `OWNER-RULINGS.md` had already
  indexed `O-17.1` as "TWO TYPE SCALES — screens migrate at their own rebuild, never as a sweep"
  (`docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md` ~:2319). This document simply had not been
  updated to say so. Records housekeeping per `docs/ward-flow/archive/dated-notes/owner-answers-2026-09-17.md` item 62.)_

---

## ③ UNOWNED WORK — nobody is doing it, no decision needed

- **One reducer-level test proving a judgement gate (not a physical gate) refuses a coordinator
  pull.** Scoped already — a movement/unit pair whose only failing gate is a judgement gate, 1–2
  hours. Detail: `docs/ward-flow/handovers/ward-lead-close-out-2026-09-12.md` §4.
- **Four lint problems** in `governance-registers`, `out-of-area-board`, and `patient-search`.
  Detail: `docs/ward-flow/handovers/ward-lead-close-out-2026-09-12.md` §5.
- **`baseRowFingerprint` is recorded and format-checked but never compared** — `resolveIssue` runs
  without it and overwrites it with the row's current value, so the field meant to detect that a
  queued edit's target row changed cannot detect anything. Detail: same §5.
- **The inbox queue has no owner** — several chats add to it, nobody drains it, ten days deep.
  Detail: same §5.
- **`statistics-compare-screen.tsx` defines its own `cannotBeFormed`** instead of importing the
  shared absence vocabulary — a second copy of the concept in one screen. Detail: same §5.
- **Three absence states (`empty`, `neverRecorded`, `destroyed`) are recorded as available but are
  unreachable from any screen.** Detail: same §5.
- **The comparison table has no phone-scroll threshold**, and nobody has measured whether it needs
  one at 375px. Detail: same §5.
- **The Movements panel move is unverified at phone width** — a panel above the list may push the
  first patient row down; nobody has looked. Detail: same §5.
- **`legal-forms-third-edition.html` (lines 8581–8599) still draws the sort order the owner
  overruled (D-1).** Just needs the drawing corrected to match the ruling. Detail: same §5.
- **FD-5's seed specimen was routed to two lanes; both closed it and neither adopted it.** Orphaned.
  Detail: same §5.
- **`scratch_debug_elig.test.ts` is not a real guard** — it runs in every lane's full suite but is
  invisible to the ward test runner. Detail: same §5.
- **Five mockups' synthetic-prototype disclosure marker is bound to the wrong element** (a heading
  instead of the sentence it should mark, against an existing owner ruling on where the marker
  binds). Detail: `docs/ward-flow/handovers/NEW-BUILD-HANDOVER-2026-09-12.md` §3.
- **Whether the median-wait suppression rule is already wired up is unverified.** The instruction
  is to use the existing rule if it is already set up — nobody has checked. Detail:
  `docs/ward-flow/handovers/ward-lead-close-out-2026-09-12.md` §2.
- **O-5's two jobs — the decline notice to the sending team, and that team's read access until
  closure — are both ruled but neither is built.** Detail: same §2.

---

## ④ DEFERRED WITH A TRIGGER

- **The sub-floor (below-12px) text sweep** — safety caveats, gate-verdict labels, refusal reasons
  in `coordinator.module.css`, and the bed-count chips/triage-tier digits in
  `ward-management-network.module.css`. Deferred as a sweep, not cancelled. Triggers: (1) the
  standing per-screen rule already raises grandfathered text whenever that screen is rebuilt, so
  this is unaffected; (2) hard trigger — before Ward Flow is shown to a real bed coordinator; (3)
  re-raise if any of the named selectors gains a new declaration. Detail:
  `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-12-fold-and-authorisation.md` (D-10).
- **The sign-in outage fix** (`fbbb6c16cf`) — merged, but whether it actually deployed needs
  provider/deploy access to confirm. Trigger: someone with that access checks the live deploy; do
  not close it on the commit alone. Detail:
  `docs/ward-flow/handovers/ward-lead-close-out-2026-09-12.md` §3.
- **ED-to-community referral routing** — an ED cannot refer onward to a community team; the form
  shows this as a visible deferral rather than hiding it. ⚠️ **No reopening trigger is stated
  anywhere** — that absence is itself the finding, not an oversight in this document. Detail:
  `docs/ward-flow-ledger.md` §B (Q9). _(Closed 2026-09-17: the WLQ-19 ("revisit later") vs Ruling 16
  ("build now") clash is settled — `docs/ward-flow/archive/dated-notes/owner-answers-2026-09-17.md` item 14: "ED to
  community team referral: build now. All teams offered, the patient's area team first; while on a
  form, not offered until the examination outcome is recorded; then allowed with legal status
  shown." Ruling 16 wins; this is no longer a deferral, it is a build item.)_
- **Deferred 17 Sept, second round (owner: "remove anything deferrable")** — seven items dropped
  from the round-two housekeeping sweep so it stayed inside its timebox, none a ruling reversal:
  (1) diversions T4a/T4b (destination change/diversion in transit); (2) the officer-screen print
  loss; (3) the Command "Statewide flow" panel showing every real ward from the data; (4)
  re-checking the ward and handover screens against Antigravity's new drawings, and redoing the
  ward panel order (F2); (5) the ~59 broken document links `npm run docs:check-links` reports; (6)
  the lesson-note control bytes — **already fixed and committed** (`685a730d82`) before the defer
  instruction reached the session, kept here only because the owner's list named it; (7) the
  print-only ward panel, which waits until printing is tested. Trigger: whenever this sweep, or a
  later one, is asked to pick these back up. Detail: `docs/ward-flow-task-ledger.md` (`WF-58`).

---

## MIGHT BE CLOSED — VERIFY BEFORE ACTING

These come from Section B of the ledger, dated 2026-08-29, before the third-edition mockup rebuild
that the current handovers describe. Nothing read for this document confirms them closed, but
nothing confirms they still apply either.

- **Where the bed board sits in the primary nav** was deferred pending a rebuild (`WB-DB-20`); the
  current build already routes a "Bed board" screen as one of sixteen third-edition screens, which
  may have already answered this. Detail: `docs/ward-flow-ledger.md` §B (B7).
- **Marking `WB-DB-10`/`P6-D5`/`P6-D6` superseded, and retiring the old ward screen into the
  board**, listed OPEN against a session and a screen ("the ward board") that may no longer exist
  in its 2026-08-29 form. Detail: `docs/ward-flow-ledger.md` §B (B1, B3, B6).
- **Reconfirming "zero spelled as the word 'none'" after the fuller 31-of-69-cell measurement** —
  a recommendation was given to keep the original ruling, but it is unclear whether the owner
  actually reconfirmed after seeing the larger number. Detail: `docs/ward-flow-ledger.md` §B (Q11).
