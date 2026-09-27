# Ward Flow third edition — master build plan, second edition

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/README.md`.** Kept for history; do not follow. It is no longer the plan of record.

> **For agentic workers:** REQUIRED SUB-SKILL: each lane runs superpowers:subagent-driven-development
> from its own task-level plan (lane A, B and C plans exist under `docs/ward-flow/plans/`; lane D
> writes its own from §6.13–§6.16 with superpowers:writing-plans). Steps use checkbox (`- [ ]`)
> syntax. **A lane never builds from this document's prose alone: names come from the drawing, values
> come from the code, and every claim below carries a tag saying how it was established.**

**Second edition, written 2026-09-11 evening by the design-review chat** (worktree
`ward-flow-phase-5-resume-166ecb`, branch `claude/wardflow-design-review-43df97`), at the owner's
instruction, after one day of building against the first edition. **It folds in the errata**
(`docs/ward-flow/plans/2026-09-10-master-plan-errata.md`, read whole to its §CL at line tip
`ba81fd2109`) **and the rulings** (`docs/ward-flow/owner-decisions-2026-09-1x.md` D-1 to D-27,
`docs/ward-flow/owner-decisions-2026-09-09.md` §5–§9). The first edition and the errata stay as the
record of what was believed when; **this edition is the plan of record where the three disagree,
and an errata entry written after `ba81fd2109` overrides this edition until Ward Lead folds it in.**

**Goal:** every one of the sixteen third-edition drawings becomes a working screen on its existing
route, inside the one shared shell that is now mounted, reading one state through one facade, with
every figure derived, every state carrying a word, every link a real arrival, and nothing built that
the owner has not decided.

**Architecture (unchanged in kind, corrected in detail):** the shell is mounted once in the ward
layout and owned by Ward Lead; a narrow facade owns the shell's figures and the href builders and
nothing else; four lanes own disjoint component directories and never edit a shared file; an
integration phase proves the whole flows end to end; a fold protocol keeps one committer on the line.

**Spec:** the sixteen drawings `docs/ward-flow/mockups/*-third-edition.html` and the standard
`docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md`, **both read from the master line** (they are
folded there; the copies on this branch are not newer). Where a drawing and an owner ruling disagree,
**the ruling wins and the drawing is routed to Ward Mockups** — the drawings have re-committed two
closed rulings already (three history boxes, FD-13; a two-hour tile with no clock, D-15).

---

## 0 · Read this first

### 0.1 How every claim in this document is tagged — and why the first edition needed an errata

The first edition marked several findings "unproven" in one section and restated them as facts inside
tasks in another. A fresh implementer reads the task, not the caveat. Eight of its factual claims
failed when a lane measured them, and two lanes nearly rebuilt tested code. **So every factual
sentence here carries one of these tags, inline, where it is used:**

    [M <sha>]   measured by this author with a git command at that SHA — re-run it before acting
    [L <ref>]   measured by a lane or Ward Lead and recorded in the errata (§X) or owner-decisions (D-n)
    [R owner]   the owner's own words, quoted from owner-decisions-2026-09-09.md or -1x.md
    [R lead]    Ward Lead's ruling under the owner's standing instruction — overturnable by the owner
    [P]         proposed by this plan — a recommendation, never a fact
    [U]         reported, not measured by anyone here — treat as a hint; the re-measure command follows

⚠️ **The thirteen Q-answers are `[R lead]` approved en bloc, not `[R owner]`.** The owner answered
all thirteen with the words _"your recommendation"_; only Q-4's name (D-1) and the instruction to
build communication (D-2) carry words of his own (`owner-decisions-2026-09-1x.md`, header). **If a
Q-answer conflicts with the code, the first question is whose sentence it is, and only Ward Lead can
answer that — bring it, do not defer to it.**

🔴 **This edition is not adopted until it clears Ward Lead's acceptance condition, D-31, set before it
existed:** every claim that a symbol _comes from_, _is exported by_, _is wrapped by_, _is read by_ or
_lives in_ a named file must name a file that actually contains that symbol, **checked mechanically**
— a `[M sha]` tag records that somebody measured, not that the file holds the symbol. The first
edition hung one module's exports on three wrong homes [L Ward Builder Four's sweep: 124 claims, 61
true, 33 false, 26 partly]. A read-only pass is running that check over this text; its result is
recorded here when it lands, whichever way it goes. Until then a lane reads this edition as a
correction of the first, not as a source.

### 0.2 What changed since the first edition — the short list

- **The shell is mounted once.** `layout.tsx` mounts `WardLiveRegion`, `WardRail` and `WardBarMount`
  from `shell/`, and there is no `<ClinicalRail` JSX mount left in `src/` (one CSS comment mentions
  it) [M ba81fd2109]. `shell/` holds the rail, bar, live region, reconciliation line, facade, types and their stylesheets [M ba81fd2109].
- **The facade exists** at `shell/ward-facade.ts` and exposes `shellFigures()` (five fixed chrome
  figures: `bedsAvailable`, `openMovements`, `delaysNeedingAttention`, `referralsWaiting`, `tasks`),
  the href builders (`patientHref`, `unitHref`, `teamHref`, `communityTeamHref`, `edHref`,
  `movementHref`, `wardStatisticsHref`, `edStatisticsHref`, `serviceStatisticsHref`,
  `communityStatisticsHref`), `raiseReferralHref()`, `serviceScope()` and a re-export of the
  eligibility types [M ba81fd2109]. **The four ED-tally names the first edition gave the facade never
  existed** (`waitingInEd`, `breached`, `dueWithin2h`, `longestWait`) [L §AG, §CF] and **must never be
  created** [R lead D-26/§CF].
- **`WARD_PRIMARY_ACTIONS` exists in `ward-nav.ts`** with kinds `new-referral`, `record-decision`,
  `contact-team`, `export-figures`, `none` [M ba81fd2109]; whether the bar receives it is a seam to
  verify (§2.3).
- **The owner's reconciliation wording is in force:** _"Invented figures, reconciled with each other"_
  (with each screen's own trailing clause copied from its drawing) replaces _"Synthetic snapshot at
  <time>, figures reconcile"_ everywhere [R owner §7; L §B3, §B4]. The kit's shell checker already
  enforces the new sentence — **do not split it** [L §B CLOSED].
- **The thirteen owner questions are answered** (§9) [R lead, approved]. Acuity as a sort key: no;
  the acuity **gate** (a staffing-capacity check): build as drawn [R owner §5]. Catchment: a soft
  note, never a filter [R owner §5]. The screen is called **Patient**, not "Patient Now" [R owner D-1].
  Communication is to be built [R owner D-2]. The 12px floor is adopted screen by screen, never as a
  sweep, with a ratchet [R owner D-3]. The word for a free bed is **Ready**, and neither _Available_
  nor _Unoccupied_ may appear as visible text [R lead D-27].
- **Gender is a model change with a join missing** (§2.1): two fields, gender decides the bed, no
  override on that gate [R owner §8–§9]; nothing consults gender when placing anybody today
  [L §AC]; the `patientId` link and D-14's default-deny guard **exist at `ba81fd2109`** (a stale
  absence in this edition's first draft said otherwise — corrected, §2.1) [M]; whether the seed
  populates the link is unmeasured [U].
- **Handover is a build item this phase — seventeen screens, not sixteen** — and waits on the
  provenance-marker brief [R owner O-6, `6b150a8b2a`]. It has no third-edition drawing; the standard's
  §14 screen 9 is its only spec until Ward Mockups draws it.
- **The design-system contract gate: the owner rules the clean-tree-red files EXEMPT** [R owner O-7];
  two things the exemption does not cover still stand — `transition: width 0.18s` → `--duration-base`
  is an identical substitution to take, and `999px` against the canonical `9999px` is a decision, not a
  substitution [L Ward Lead].
- **Two lanes' worth of the first edition's task detail now lives in lane plans** (A, B, C) that
  measured the drawings themselves; §6 below gives the corrected screen contracts and points at them.

### 0.3 Staleness — how to know whether this document is still true

    node scripts/ward-flow/check-errata-freshness.mjs      re-measures each errata claim: STILL TRUE / EXPIRED / CLOSED
    git rev-parse --short codex/task-ward-flow-live-state-20260831   the line moved twice while the first edition was written
    git merge-base --is-ancestor <sha> <line>              "has this landed" — never git log -S without --diff-merges

Every `[M]` tag names its SHA; **a later SHA may falsify it and nothing goes red.** Every line number
in the first edition drifted [L §D]; this edition cites functions, components, test names and files,
never lines.

### 0.4 The rules that cost the most, in one line each

1. **Ward Lead folds, by SHA, into the ward line only; never `main`, never a push** (`HOW-TO-FOLD-2026-09-10.md` §0–§2).
2. **Confirm the artefact, not the fold**: the requester names a grep unique to the new content.
3. **One chat per worktree; exact paths; never `git add -A`; never bare `git stash`** — a lane's implementer did, and reported itself [L §M]. Set work aside with a temporary commit.
4. **Claim the defect in `control/work-claims.md` before editing, claim a path before creating it, announce a document after writing it.**
5. **Sonnet implements, Opus reviews; every Sonnet brief ends "if you reach a decision this brief does not cover, stop and hand it back."**
6. **Before declaring a branch ready, merge the line INTO it and run the full ward suite there** — the shell branch was green alone and produced seven reds in the union [L §AF].
7. **A blocked deletion is an instruction, not an obstacle** — leave the file and report it; never route around the protection hook, never use its override without the owner's word [L §AD, §BC].

### 0.5 Rulings made after this edition's cut — folded by reference, not yet read here

Ward Lead reports D-28 to D-39 ruled on 2026-09-11 after `ba81fd2109`; **none is on the line at that
SHA** [M ba81fd2109: `git show <line>:docs/ward-flow/owner-decisions-2026-09-1x.md | grep -c "^## D-3"`
→ 0]. They override this edition until folded in. As reported [U Ward Lead]:

- **D-28** — `movementVerdict` is closed, not deferred (this edition's §0.2 already says nothing is
  exported through the facade for it).
- **D-29** — the Access record stays `{ words, at }`, no `role`.
- **D-30** — `Unit.forensic` names a **ward**, not a bed; five rendered strings changed.
- **D-31** — the plan's disposition: **line counts, line-number citations, route paths, "Reads" lists
  and link inventories are deleted, not corrected** — a plan that does not state a count cannot state a
  wrong one, and six of six were wrong within a week. **Applied to this edition** (§6 headings carry the
  owning directory only; routes are read from `ward-nav.ts` and the `src/app/mockups/ward-flow` tree;
  no document or file is described by its length).
- **D-32** — D-6 restated: one wording per state, and the states are named.
- **D-33, D-34** — content not reported here; read the file.
- **D-35** — the ED pressure strip does not narrow to the selected service.
- **D-36 to D-39** — a fifth lane's ("Lane E") section classifications; nothing else known here.

---

## 1 · Where the build stands — 2026-09-11, about 16:40 AWST

| Thing                                                                                                 | State                                                                                                                                                                                                                                               | Tag and how to re-measure                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master line                                                                                           | `codex/task-ward-flow-live-state-20260831` at `ba81fd2109`, nothing pushed                                                                                                                                                                          | [M] `git rev-parse --short <line>`                                                                                                                                    |
| First edition and its two fixes                                                                       | folded (`e9c6900e3e` is an ancestor)                                                                                                                                                                                                                | [M] `git merge-base --is-ancestor e9c6900e3e <line>`                                                                                                                  |
| The three mockup commits (`d523d5e3cd..fb7ef96b83`)                                                   | folded                                                                                                                                                                                                                                              | [M] same                                                                                                                                                              |
| Shell                                                                                                 | mounted once in `layout.tsx`; zero per-screen rail mounts                                                                                                                                                                                           | [M ba81fd2109] `git grep -n "<ClinicalRail" <line> -- src` → one CSS comment only                                                                                     |
| Facade, primary actions, roles module, `Notice` type, `genderEligibility`, one-entry `HISTORY_FIELDS` | all present                                                                                                                                                                                                                                         | [M ba81fd2109] `git show <line>:src/components/ward-management/shell/ward-facade.ts \| grep -n "^export"`                                                             |
| Offline suite                                                                                         | reported green: 384 files / 4,509 passed / 0 failed; typecheck clean                                                                                                                                                                                | [U Ward Lead 2026-09-11] `node scripts/run-ward-tests.mjs` after `tsc -p tsconfig.typecheck.json --noEmit`                                                            |
| Browser journeys                                                                                      | reported 88 passed / 0 failed / 3 skipped **after two count assertions were re-expected** (10→11 gates, an eleventh gate added by the acuity fold); the four "suggests nothing" guards' behavioural assertions were byte-identical before and after | [L §BA, §BY] `npm run test:e2e:ward-journeys` after `npm run ensure`; read the run's own exit, never a pipe's                                                         |
| Search hub, Patient search                                                                            | complete and browser-verified                                                                                                                                                                                                                       | [U Ward Lead] the lane C plan's task ledger; `git log --oneline <line> -- src/components/ward-management/hub src/components/ward-management/search`                   |
| Raise a referral, Ward, Delays, Community team                                                        | partly built                                                                                                                                                                                                                                        | [U Ward Lead] same shape, per directory                                                                                                                               |
| Command, Movement, Capacity, Bed board, Emergency department, Statistics ×4                           | not started                                                                                                                                                                                                                                         | [U Ward Lead]                                                                                                                                                         |
| Lane branches                                                                                         | A, B, C each two commits ahead of the line, with 1 / 2 / 0 `src` files changed from their own merge-base — i.e. nearly everything they built is already folded                                                                                      | [M ba81fd2109] `git diff --name-only $(git merge-base <line> <branch>) <branch> \| grep -c '^src/'` — **from the merge-base, never from the line tip** [L §AY-2, §BF] |
| Lane D (Ward Builder Four)                                                                            | held; no lane plan yet; worktree still on `ward/invented-figure-markers-20260909`                                                                                                                                                                   | [M] `git worktree list \| grep ward-builder-four`                                                                                                                     |
| The errata                                                                                            | read to §CL; eight of its own entries retracted, all caught by lanes                                                                                                                                                                                | [M ba81fd2109] `git show <line>:docs/ward-flow/plans/2026-09-10-master-plan-errata.md \| wc -l`                                                                       |

⚠️ **"Twelve of sixteen built" was sent to the owner on 2026-09-11 and was false** — a diff against
the line tip counted the line's own work as lane work [L §BF]. The true picture is the table above.

---

## 2 · The foundation — what Phase 1 still owes (Ward Lead, on the line)

Phase 0 is done. Phase 1 landed the shell, the facade, the primary-action table and its wiring. **What remains is
below, and every item is a shared file. This edition was adopted by Ward Lead on 2026-09-11 evening
at `db912ee458`, subject to the line's newer errata overriding it** [L Ward Lead]. ⚠️ **What the
adoption check covered, and what it could not see:** it verified every explicit symbol-and-file pair
(34 of 34) and every route (16 of 16). **It cannot see a symbol named without a file, whose subject
comes from the section heading** — and two such claims in §6.13 and §6.16 were false and are
corrected there [L Ward Lead, Lane D]. The widened condition — _for every symbol named in a §6.N section, the implied file is that section's own screen; check it whether or not the sentence names it_ — **was dry-run over §6.1–§6.16 on 2026-09-11 at `a387cdbdfb`: 37 identifiers reached, 9 flags raised, 9 false (100%)** [L B1, Sonnet extraction]. Every flag fired on a sentence that _denies_ an association ("not built from", "imports nothing from", "as identifiers, ever"), names a shared derivation (`edHomeSummaries` twice, `edHomeTotals`), or lists an unbuilt task (`dailyFlow`, lane D held). It also found the grain the check would need and cannot have as written: §6.13–§6.16 share one directory, so `acceptedUnitId`, `referredUnitIds` and `psychiatric_ward` in §6.14 pass only because they live in a sibling statistics file, not the ward-statistics screen. **Disposition: not a gate. It would need a polarity marker, a not-yet-built state and per-file matching before its red meant anything, and the two false claims it was proposed to catch were caught by reading** [P withdrawn; report at `research-2026-09-10/B1-widened-check-dry-run.md` beside this plan].

### 2.1 The person join, and gender reaching both bed gates — D-14, D-5

- **Fact — CORRECTED 2026-09-11 evening, after Ward Lead read the claim against the code:** the
  first draft of this edition said `Admission` and `Referral` carry no `patientId` `[L §AC-2, §CD,
§AE]`. **That was a stale absence: `Referral.patientId?: PatientId` and `Admission.patientId:
PatientId | null` both exist at the SHA this edition pins itself to, and the enforcing test
  `tests/ward-patient-link-default-deny.test.ts` exists beside them** [M ba81fd2109; L Ward Lead].
  `ward-admissions.ts` records that the field was added with D-14's default-deny guard. **D-14 is
  built.** **The data, measured by running the repository's own derivations over the seed** [L §DG,
  `f93cfe85e9`]: 267 seeded admissions, 259 occupied by `bedIsOccupied()`; **`patientId` is non-null on
  exactly one** (AD-RPHS-14 → PT-003, and it resolves); 258 are null. Via the second path
  (`referralForMovement`, never the manufactured `Admission.referralId`), two of fifty movements carry a
  referral and neither referral carries a patient. **The one link is deliberate — the seed's own
  words: _"enough for the default-deny guard's own anti-vacuity floor to have something real to find,
  deliberately not more."_ This is a working mechanism with a fixture that exercises one arm, not a
  broken join and not a field with no producer; anyone reporting "258 nulls, the join is broken" is
  wrong** [L §DG]. It inverts the changeable-data rule: a feature that works and whose seed makes it
  look empty — a property of the fixture that reads as a property of the software. A false claim of absence is not
  a sourcing error and no sourcing check can be shaped to catch it; it was caught by reading the claim
  against the code.
- **Ruling:** the link is added **and** FD-23's privacy guard starts enforcing by test **in the same
  change**; neither half ships alone [R lead D-14] — **approved by the owner 2026-09-11, _"Approve as
  written"_, and already built as written; the approval schedules nothing** [R owner]. Gender reaches both bed gates (`sex_designation`
  and `sex_mix`) or neither [R lead D-5]. Gender is `Female | Male | not yet recorded`, on the patient
  profile, completed at referral if absent, never defaulted from sex, **no override path on that gate**
  [R owner §8–§9].
- **What it decides:** lane B's Bed board done-when _"the board shows who is in the bed"_ is **not
  buildable against this seed**, and its failure would read as a board defect; lane C's gender completion
  (D-5) is **blocked by an absent population, not an absent join — a different blocker with a different
  owner**. Whether the seed gains person links and whether it gains a high-acuity referral are **one
  decision** — does the fixture exercise the arm the code supports — Ward Lead's, to settle before lane
  D's first screen ships; **not proposed as a fix here**, because a seed change moves every count on
  every screen that reads `admissions` or `referrals`, and lane D's statistics baseline was taken against
  this seed [L §DG].
- **Catcher:** a seed test asserting every seeded admission resolves to a real earlier referral and a
  patient [P]; the FD-23 guard's new positive test that reddens when the link is read outside the
  permitted paths [R lead D-14]; `npm run mutate` on both, reporting **how many tests reddened and
  which** — a mutation that reddens everything is a crash, not a proof [L §S].

### 2.2 The `checks` array, and what an empty one says

- **Fact:** `layout.tsx` mounts `<WardRail checks={[]} />` and `<WardBarMount checks={[]} />`
  [M ba81fd2109]. The bar guards it: `hasChecks && problems.length === 0` decides `activityGood`, an
  empty array renders a neutral tone and never _"figures reconcile"_ [M ba81fd2109, `ward-bar.tsx`].
  **But `reconciliationSentence(checks)` in `ward-reconciliation-line.tsx` returns the agreeing
  sentence whenever `problems.length === 0`, including for an empty array** [M ba81fd2109] — and
  **`ward-rail.tsx` mounts `WardReconciliationLine` unconditionally, not behind the rail's open
  state, so with the layout's empty array every ward route renders _"Invented figures, reconciled
  with each other"_ over zero checks** [L Ward Lead 2026-09-11, read in the file]. `hub-screen.tsx`
  passes a hardcoded zero to its own line [L Ward Lead]. The rail clips part of the text to a
  screen-reader-only span when closed, which changes the severity, not the defect. **A reassurance
  produced by the absence of evidence is the governing rule inverted.** Ward Lead has an Opus pass
  classifying it (false / true but unfounded / not rendered) before ruling; nothing here pre-empts
  that.
- **Ruled and measured since the first draft:** D-40 — an empty check array never claims
  reconciliation; every ward screen now reads _"No reconciliation is available for this page yet."_
  [R lead D-40, on the line at `f605c914be`; L §CR]. **§8.7's append contract is unimplemented, and
  not merely unbuilt: no file constructs a `WardReconciliationCheck[]`; the provider's context has no
  `checks` and no setter; and a screen renders as a descendant of the shell inside `WardGround`, so
  prop-drilling cannot reach the bar or rail** [L §DD, `32aa384ab2`]. The pattern that solves the
  same topology already exists in this shell — `announceToWardShell` in `ward-live-region.tsx`, a
  module-level bridge from a screen up to shared chrome [L §DD]. **The honest sentence becomes a
  different kind of wrong the day a screen has checks and still cannot say so** [L §DD].
- **Scheduled — owner answer O-9, `6b150a8b2a`: the §8.7 append path is built THIS PHASE**, copying
  `announceToWardShell` — a screen publishes its check array; the rail, bar and line consume it; the
  sentence per screen is the drawing's own [R owner O-9; L Ward Lead].
- **Catcher:** a unit test that `reconciliationSentence([])` is not the agreeing sentence; the shell
  DOM test asserts a screen with zero checks shows the neutral state on rail, bar and line [P].

### 2.3 Two seams left by the mount

- **`primaryAction` IS supplied — §AY's "passed by nobody" is false at current state:**
  `WardBarMount` resolves `resolveWardPrimaryAction(pathname)` against the sixteen entries of
  `WARD_PRIMARY_ACTIONS` [L §DE, `32aa384ab2`]. **The call is unconditional and the result is
  route-conditional:** a real action on twelve routes, `{kind: "none"}` on four, and no button at all
  on every other ward route (Handover, Discharges, the referral board, Out of area, Officer, the
  indexes, Network, Governance). **A lane checks `WARD_PRIMARY_ACTIONS` for its own route, not whether
  the seam exists** [L §DE]. Two exported types named `WardPrimaryAction` with different shapes existed
  across the seam [L §BD]; **a third name collision: three screens import a progress-bar widget also
  called `WardBar` from `ward-management/ward-bar.tsx`, unrelated to the shell bar** [L Ward Lead] —
  a search for the shell bar's users returns screens that do not use it.
- **Two exported types named `ReferralSource`**: the facade's route-of-raise (`"ed" | "community" |
"gp"`) and the model's provenance (`community | crisis_service | police | ambulance | inter_hospital
| ed_medical`) [L D-18]. **Ruling:** the query contract carries **model** values verbatim
  (`source=ed_medical`, never `source=ed`); the facade's three-value type is renamed and stops being
  called `ReferralSource`; the menu must not pass a `source` the form does not read [R lead D-18].
  **`gp` is the owner's question** — a GP referral is a common real pathway and the model has no such
  source; nobody adds a seventh member to a clinical union to make a URL work [R lead D-18].

### 2.4 The Activity drawer's per-page tally, and the two-hour tile

- **Fact:** the drawings' `PAGES[key].core(f)` block renders **the Activity drawer's tally**, four
  per-page figures headed "<Page> now" — not a masthead and not the pressure strip [L §AJ, §AJ-2b].
  Every drawing carries the same block; anyone meeting it reads it as a masthead [L §AJ-2b].
- **Fact:** Command's four are Waiting in ED, Breached, Due within 2 hours, Longest wait. Three exist
  in `edPressure()`; **"Due within 2 hours" has no derivation and names no clock** [L §AJ, §BT]. **A-7
  CLOSED by the owner, 2026-09-11:** _"This appears pointless as it is easier to just notify at 24
  hours."_ **No two-hour tile anywhere; the tally is three figures; Ward Mockups removes the tile from
  the eighteen drawings** [R owner]. D-15 stands for every other figure [R lead].
- **Fact:** `edPressure` and `edHomeSummaries` were two faithful copies of one computation; **D-26
  makes `edPressure` a projection of `edHomeSummaries`**, keeping its name, shape and sort;
  `tests/ward-pressure.test.ts`'s seventeen assertions stay exactly as written and become the proof
  [R lead D-26].
- **Task (Ward Lead):** build the Activity drawer's tally slot in the shell so a screen can supply
  four `{label, value, tone, noun}` figures; the shell renders _none_ for an absent figure [P].
  Command's C3 waits on this slot; A-7 is closed and the tally is three figures [L §AJ-2c; R owner].

### 2.5 The seed, the communication addendum, and Q-12's inventory

- **Seed:** extend so every figure a drawing shows is derivable, with the person join of §2.1; every
  seeded figure carries the invented-figure marker where it is read [R owner 2026-09-09 §2]. Names in
  the app's seed are deliberately invented and search-tuned [L A4]; the standard's plant-bird-stone
  rule is for drawings and does not rename the seed [P].
- **Communication:** D-2 says build it; the addendum `2026-09-1x-communication-addendum.md` corrects
  the premise — an inbox already exists (`buildActionInbox`, coordinator-only, no addressee) — and
  builds an authored, addressed `Notice` beside it, never a second inbox [R owner D-2; L addendum §0].
  `Notice` is on the line [M ba81fd2109].
- **Q-12 inventory:** the principle is settled (nothing dropped); the list is not. Each lane reports
  the panels its screens carry that its drawings lack; Ward Lead puts the assembled list to the owner
  **once**, at the end of Phase 2 [R lead, Q-12 note].

---

## 3 · Delegation — who owns what, as it stands

| Chat                            | Worktree                                        | Branch (measured 2026-09-11)                            | Owns                                                                                                         | Status                                                                                                                                                                |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ward Lead**                   | `D:/Worktrees/Database/ward-lead`               | the line, `ba81fd2109`                                  | `layout.tsx`, `shell/**`, seeds, model, reducer, `ward-nav.ts`, every fold, every owner question, the errata | Phase 1 remainder (§2)                                                                                                                                                |
| **Ward Builder** — lane A       | `D:/Worktrees/Database/ward-builder`            | `ward/lane-a-command-delays-movement-capacity-20260910` | `coordinator/**`, `delays/**`, `movements/**`, `tracker/**`, `capacity/**`, their tests                      | plan written; Delays partly built; C3 held on §2.4                                                                                                                    |
| **Ward Builder Two** — lane B   | `D:/Worktrees/Database/ward-builder-two`        | `ward/lane-b-ward-board-ed-community-20260910`          | `ward/**`, `ward-table/**`, `wards/**`, `board/**`, `ed/**`, `community/**`, their tests                     | plan written; Ward and Community team partly built                                                                                                                    |
| **Ward Builder Three** — lane C | `D:/Worktrees/Database/ward-builder-three`      | `ward/lane-c-search-patient-referral-20260910`          | `search/**`, `hub/**`, `patients/**`, `referrals/**`, their tests                                            | plan written plus `lane-c-drawing-facts.md`; Search hub and Patient search complete; Raise a referral partly; Patient blocked on §2.1                                 |
| **Ward Builder Four** — lane D  | `D:/Worktrees/Database/ward-builder-four`       | to cut from the line: `ward/lane-d-statistics-2026091x` | `statistics/**`, `tests/ward-statistics*`                                                                    | **held pending the owner's direct word** — a blanket "go ahead with all recommendations" did not reach inside a direct "Hold" [L §BB]; Four asked for his word itself |
| Ward Mockups                    | `D:/Worktrees/Database/ward-mockups`            | `ward/mockups-20260910`                                 | `docs/ward-flow/mockups/**`, `design/prototypes/**`                                                          | receives every drawing defect (§8)                                                                                                                                    |
| Ward Verifier                   | `D:/Worktrees/Database/ward-verifier-9afb82c6e` | —                                                       | assesses, never builds                                                                                       | Phase 3 review if open                                                                                                                                                |

**Shared files nobody in a lane edits:** `layout.tsx`, `ward-nav.ts`, `shell/**`, the seeds,
`ward-model.ts`, `ward-flow-reducer.ts`, `ward-flow-events.ts`, `ward-eligibility.ts`, any
`*.module.css` outside the lane's directories, `docs/ward-flow/mockups/**`, the protection hook.
A change there is a four-line message to Ward Lead. **Before the first edit each lane writes its
`.ward-session.json`, its `assignment-register.md` row (never the word _authorised_ in the status
column), its `control/now.md` row and a `work-claims.md` row per defect.**

**Two ways to know a peer's branch really holds work, from today's failures:** measure from
`git merge-base`, never from the line tip [L §AY-2, §BF]; and before dispatching into a worktree
another agent occupied, read `git status`, not the agent list — `completed` did not mean stopped
[L §AO, §AZ].

---

## 4 · How every task is run — the first edition's rules plus what a day of building added

### 4.1 Inside a lane

1. The lane owner writes and maintains its task-level plan (superpowers:writing-plans) with the
   task-brief / report-file discipline of superpowers:subagent-driven-development. Lanes A, B and C
   have theirs; lane D writes one from §6.13–§6.16.
2. Per task: a fresh **Sonnet** implementer with the brief, the interfaces and §5 pasted in (never
   linked); an **Opus** task reviewer on a diff package cut from the recorded BASE; at most five fix
   rounds; every ruling ledgered.
3. Per screen: one **Opus** whole-screen review against the drawing (open beside the screen) and
   §7.0 before the SHA goes to Ward Lead.
4. Tiers stated on every dispatch summary and every relayed finding.

### 4.2 The task shape — seven lines now, not six

    Files:       create / modify / test — exact paths, cited by symbol never by line
    Interfaces:  consumes (facade functions, actions) / produces (exports later tasks rely on)
    Catcher:     the exact test or gate that goes red if this is wrong — and PROOF IT CAN: run it red once,
                 by mutation, reporting how many tests reddened and which. A named, green, existing test is
                 not a catcher until its POPULATION is shown to include the thing the task changes [L §CB]
    Steps:       failing test → run it red → minimal implementation → run it green → prettier on the touched
                 files → commit with explicit paths
    Not built:   the §9 items this screen touches, named
    Report:      proven by test / proven by looking / not proven
    Population:  what the green actually walked — files the gate walked, screens the browser pass was read
                 on, widths looked at — and what it is silent about [L §AL]

### 4.3 Practices that a day of building made mandatory

- **Names come out of the drawing, copied, never retyped.** Seven of the first edition's panel names
  and three of five Movement tab names differed from the drawings, and tab names are what the DOM test
  asserts — the test fails against a correct screen and the cheap repair is to damage the screen
  [L §G, §G3]. Curly apostrophes (U+2019) and `&rsquo;` entities defeat a literal search; **a zero
  from a literal grep of an HTML drawing is not evidence of absence** — search a fragment either side,
  or the element id [L §G2, §I]. **To establish what a screen HAS, enumerate; a targeted grep can only
  confirm** [L §BP].
- **Read the drawing's own appendices.** Raise a referral's drawing carries "Rules the build must not
  break" and "Open questions the build must settle" that no task list mentioned; an open question
  inside a drawing has never been asked of the owner [L §G4].
- **Check every "every row / every tab has X" assertion against what the model can resolve before
  writing it** — a completeness assertion is the shape most likely to force a fabrication (community
  rows in the hub have no resolvable statistics id) [L §N]. And check the source supplies the
  alternative for every case before forbidding an improvisation — three facets had no empty wording
  in the drawing and the brief forbade a generic one [L §T].
- **Read the live regions on every screen's browser pass.** A refusal that is exactly right can be
  contradicted by a `sr-only` status from another component ("Nobody matches" beside a refusal) —
  invisible to tests, screenshots and eyes [L §U]. The shared shell live region is read **on every
  screen**, not once [L §U3]. Count live regions by rendering a settled page, not by grep, and not too
  early — an unsettled render under-counts whatever mounted last [L §BQ, §BR]. A **refusal** must be
  alone; a **marker** must be together with its figure — the two need opposite assertions [L §U2].
- **Restore a mutated file with `git show HEAD:<path> > <path>` then `git diff --quiet <path>`** —
  the ordinary restore is blocked on ward paths and fires after the mutant is in the tree [L §F2].
  Never bare `git stash` [L §M]. Never `find … -delete` or any other route around a blocked deletion
  [L §AD, §BC].
- **Inside `src/`, describe a forbidden declaration, never reproduce it** (a comment quoting the
  visually-hidden block's negative margin is counted as debt); outside `src/` — plans, reports,
  commit messages — quote it exactly [L §AB-3-CORRECTION]. Never spell the 10px or 11px token names in
  ward CSS comments; name the pixel size [L §BK].
- **A green gate measures something specific.** `check-type-scale.mjs` forbids arbitrary sizes and
  declares 10px the floor; `no-hardcoded-hex` reads TSX, not `.css`; `check-design-system-contract.mjs`
  is a **debt-regression** gate that is **red on a clean tree** (Delays' stylesheet and the global
  search stylesheet) — compare named paths against a clean run, never the exit code, and never refresh
  its baseline to make it green [L §L, §Y2, §AA, §AB]. The token-resolve guard asks "declared
  anywhere", not "reachable from this file through `composes`" — a token declared in a module the
  screen does not compose resolves to nothing while every gate stays green [L §BI, §BN].
- **Never put a gate behind a pipe. Redirect to a file, read `$?`, then read the file.** A harness
  notification's "exit 0" is the wrapper's, not the runner's [L §Q1, §BL]. Check for the positive
  (`N passed`), never for the absence of `failed` [L §BL].
- **Typecheck with `tsc -p tsconfig.typecheck.json --noEmit`.** The bare form reads generated
  `.next` validator files and reports errors in nobody's source [L §BH]. The "pre-existing tsc failure"
  exemption is gone; carry no such exemption [L §Q2].
- **Journey runs are staggered across lanes** — one machine, one eight-minute heavyweight tier; five
  at once produced a lock refusal that looked like a dead-owner bug [L §BH]. A lane runs the specs
  that touch its routes (`node scripts/run-playwright.mjs --project=chromium-mockups ui-ward-<name>`,
  about sixteen seconds each) rather than the twelve [L §AM-2]. "Route mentions" are not coverage.
- **After `git merge --no-commit`, `git status` before committing and name paths explicitly** — a
  bare commit commits the merge's index, not the tree, and a fix described in the message was not in
  the commit [L §BM].
- **When a red becomes green, say which: repaired, or re-expected.** A count assertion moving is a
  ruling somebody made by editing a test; quote the diff or say the population changed [L §BY].
- **A comment describing a guard is not the guard; a token named in a finding is not a token the
  component reads; a CSS rule inside a media block is not its effect.** Open the test, grep the
  component, measure in a browser or read the whole cascade [L §Y]. Run a new test **red first** to
  learn which arm executes [L §BW].

---

## 5 · Global constraints — paste into every brief (corrected)

Each line names its authority. A lane that meets a conflict between two of these hands it back.

- **Tokens only** — no hex, no `color-mix`, no shadow inside a panel, no coloured bar on any edge, no
  top highlight [R owner 2026-09-09; standard §2, §13]. **The gate that reads ward `.css` for raw colour
  is `check-design-system-contract.mjs`, a debt-regression gate red on a clean tree** [L §AA]: prove
  your catcher once by adding one hex, running it, watching it fail, removing it [L §Y2].
- **12px floor for new HTML text; a smaller size is a stop-and-hand-back.** The 389 existing sub-12px
  declarations are raised **screen by screen as each is rebuilt, never as a sweep, never in passing**;
  the invented-figures notice is raised everywhere now; the flow map's 10.5/11.5px stands; a ratchet
  pins the count [R owner D-3]. **No DOM test can see a font size — the proof is the CSS read and the
  screen looked at; every report names how many declarations it raised** [L §O].
- **Words before colour.** Every state carries text; colour only reinforces a word already present
  [standard §8.1]. A tone that is the only carrier of a state is a defect [L §AJ].
- **Absence and zero.** Shown and marked, never dropped; zero reads _none_ [standard §8.2].
  _"Not recorded"_ and _"Not yet recorded"_ are **both** used, deliberately, for two different states
  [R lead D-6]; fourteen absence wordings exist and **must not be collapsed by find-and-replace** —
  some are different facts [L §CH].
- **Invented and real.** The reconciliation phrase is **_"Invented figures, reconciled with each
  other"_**, verbatim, asserted as a substring; the **sentence** around it — clock, trailing clause,
  and the disagreeing form _"Invented figures, N figure(s) do/does not reconcile, as at <clock>, …"_ —
  is **copied from each screen's own drawing**, never composed (Search hub's clause is _"no event feed
  on this screen"_) [R owner §7; L §B3, §B4]. Never _"Live"_; never _"reconciled with reality"_. The
  announced marker says _"invented names"_, never _"invented people"_ [R lead D-8]. A figure names its
  own clock or does not ship [R lead D-15]. The noun travels with the number (`ShellFigure = {value,
noun}`) — prefer a shape that cannot separate a figure from its words over a guard that catches the
  separation [L §AH, §AK].
- **Derived, never typed.** Every count, tile, line and sentence is computed from state on every
  render; every href comes from the facade's builders [standard §8.7]. **An empty list passed into a
  derivation is an absence in an argument — say so on screen or pass real data, never neither**
  [R lead D-23].
- **Vocabulary rulings:** the free-bed word is **Ready**; _Available_ and _Unoccupied_ never appear as
  visible text (the `available` `data-state` token is internal and stays) [R lead D-27]; the third
  bed stage is _discharged_, never _released_ [R owner 2026-08-30]; a community patient is a team's by
  the explicit team on the referral, never by home area [R owner 2026-08-31]; _legal authority_ reads
  _Yours_; wait bands are 8 and 24 hours [R owner 2026-09-08]; the six urgency reasons are placeholders
  _"for now"_, never the owner's language.
- **Clinical rulings that bind what a screen may do:** sex and gender are two fields; gender is
  `Female | Male | not yet recorded`, on the patient profile, completed at referral if absent, never
  defaulted from sex; **gender decides the bed and there is no override on that gate**; gender
  reaches both bed gates or neither [R owner §8–§9; R lead D-5]. The system never computes acuity; the
  clinician marks it; **the acuity gate is a staffing-capacity check and is built as drawn; acuity is
  never a sort key and is shown as a word** [R owner 2026-09-09 §5, §7; R lead Q-1]. Catchment is
  information, never a filter, and nothing infers a catchment relationship the model does not hold
  [R owner §5; R lead Q-2]. No forensic-unit exclusion — there is no ruling [assignment-register]. A
  bed-board placement prompts _confirm with the ward_ [R owner 2026-09-06]. FD-23: a ward never sees
  where else its patient went; **the Patient screen shows no other movements and no referral history
  elsewhere, to anyone, until role enforcement reaches that screen** [R lead D-17]. _"Something is
  already open for this person"_ is permitted; _where_ never is [R lead D-19]. **One story field** on
  the referral, optional, last, never feeding eligibility, warns when half-written and is never stored
  [R owner 2026-08-30 FD-13; R lead D-11]. The referrer is the recorded source [R lead D-12].
- **Shell behaviour:** Escape never clears the service; drawers are modal; the rail's state is
  remembered [standard §7.6, §7.7]; keyboard reach and visible focus on every control [§7.3, §9].
  **The shell's live region is read on every screen; a refusal must be alone in every channel**
  [L §U, §U3].
- **Widths and themes:** 1920, 1600, 1440, 1280, 1200, 1100, 390, 320, light and dark, forced colours,
  print — nothing clipped, nothing scrolling sideways at page level; **wide content scrolls inside its
  own wrapper with the affordance — a sentence first (_scroll sideways for the rest_) and a measured
  edge — never a frame or an arrow** [standard §5.8; R lead D-9, D-10]. Sample one width in the
  641–1000px band; six of twelve specs never do [L handover §12].
- **The changeable-data rule:** the owner will replace every invented figure; nothing may work only
  for the seed [`docs/ward-flow-changeable-data-rule.md`].
- **Never `git add -A`; never bare `git stash`; commit each coherent unit; prettier on touched files;
  `npm run format` is not trusted; `ls node_modules/.bin | wc -l` first; typecheck with
  `tsc -p tsconfig.typecheck.json --noEmit`.**
- **If you reach a decision this brief does not cover, stop and hand it back — do not choose.**

---

## 6 · The sixteen screens — corrected contracts

**Every route is under `/mockups/ward-flow/…`.** The first edition's §1.5 wiring shorthand
(`/ward/[unitId]` etc.) named directories that do not exist [L §H4, §CE]; the route table of the
first edition's §1.4 was right and is repeated here in full form. **Panel and tab names below are
NOT authoritative** — they are copied from the lane plans' drawing-facts where a lane has measured
them, and marked `[drawing]`; anything else is a description, and the lane copies the real string out
of the drawing before asserting it [L §G]. Where a lane plan exists, **the lane plan is the task-level
source and this section says only what changed since the first edition and what still binds.**

### 6.1 Command — lane A · `coordinator/`

> 🔴 **THIS SECTION'S STATUS AND CONTRACT ARE STALE. CORRECTED 2026-09-11 LATE — READ THIS FIRST.**
> **NOT "not started".** **Command's priority queue gained a Referrals tab and the shortlist a
> second subject (`8812d7faf7`, folded); third-edition panel shapes landed at `df3d134ed0`.**
> ⚠️ **And O-15.1 adds work here: Command's TIER and SCORE render at 10px, 43 rows each, and
> the owner has ruled them to the 12px floor.**

- **Status:** not started [U]. Lane plan tasks C1–C4 exist [M ba81fd2109 lane A plan].
- **Corrections since v1:** the pressure strip **exists, is wired to `edPressure(now, movements)`,
  and is tested** — it is not built from the facade and not from `edHomeTotals` [L §CI]; after D-26
  `edPressure` is a projection of `edHomeSummaries`, so Command and ED home cannot disagree
  structurally and **no cross-screen agreement test is written** — it would compare two copies of one
  computation [R lead D-26]. **C3 (the four Activity-drawer figures) waits on the shell's tally slot
  (§2.4) and on A-7 — three of four are derivable, the fourth has no clock** [L §AJ, §AJ-2c]. The
  drawing's four-tab panel is **`Exceptions and escalation`** `[drawing]`, not the first edition's
  paraphrase [L §G]. The Referrals tab on the priority queue is still absent from the app [L A2a] and
  remains C2. Q-11: remove the flow map's ED-node bars; keep the brand stripe [R lead].
- **Not built:** ordering by acuity (show the word); catchment as a filter (soft note only);
  `withDeadline` and the department deadline sentence until the derivation exists [R lead D-25];
  `waitingInEd`/`dueWithin2h` as identifiers, ever [L §CF].
- **Done when:** the lane plan's C1–C4 gates plus §7.0; the pressure strip agrees with ED home by
  construction (D-26) and a test proves `edPressure`'s seventeen assertions unchanged.

### 6.2 Delays — lane A · `delays/`

- **Status:** partly built [U]. Lane plan D1–D3; **D4 withdrawn — `What the blocker is` has existed
  since 2026-09-07, grouped by `DELAY_OWNERS`, filtering on click** [L §BP]. The screen enumerates as
  seven panels against a rename table built for five [L §BP].
- **Corrections since v1:** `legalDeadlineMinutes` **has a reader** and a dedicated DOM test — D2 is
  "check the wording against what ships", not "wire it" [L A1]. `delays.module.css` carries the
  design-system gate's clean-tree debt (eight motion durations, padding, radius, margin, line-height
  literals) — tokenised **during** the rebuild, with the gate's named paths for that file returning to
  zero, and `--ward-radius-round` living in `ward-tokens.module.css` which every ward screen composes
  [L §AA, §BI, §BM]. _"No deadline recorded"_ on Delays is a **patient** with no legal deadline; on
  Command it would be a **department** — same words, two claims; R-5 ruled it not built on Delays;
  D-25 defers Command's [L §CL].
- **Not built:** anything acuity-derived; a generic empty sentence where the drawing supplies none —
  hand back instead [L §T].

### 6.3 Movement — lane A · `movements/`, `tracker/`

> 🔴 **THIS SECTION'S STATUS AND CONTRACT ARE STALE. CORRECTED 2026-09-11 LATE — READ THIS FIRST.**
> 🔴 **THE FIVE-TAB CONTRACT BELOW WAS RULED AGAINST BY THE OWNER ON 2026-09-11. DO NOT BUILD
> IT.** **A lane taking this section as its contract would build five tabs including one that can
> never render a row — and would be FOLLOWING THE PLAN OF RECORD to do it.**
>
> **What was measured:** **three of the five tabs were the SAME 43 people** — Tab 3's id set is
> IDENTICAL to Tab 1's, and Tab 2 is a two-way split of the same 43. **Tab 5, _Movements with no
> owner_, is UNREACHABLE: `owner: string` is required and never blank, 0 of 50.**
>
> **The owner ruled: ONE tab with sorting, plus _Resolved today_ kept separate.** His words:
> _"three tabs implies three different groups of patients, and a coordinator would reasonably read
> it that way."_ **The three tab names survive as SORT OPTIONS, reworded from population phrasing
> to ordering phrasing, and the section heading carries the marking. Tab 5 is DROPPED.**
>
> 🔴 **AND THE REGION KEEPS CLOSED MOVEMENTS, against what the drawing draws** — owner ruling
> 2026-09-05, _"MARK IT, DO NOT FILTER IT"_, made having been shown the row and three options.
> ⚠️ **The drawing's stated reason for dropping them is FALSE ON ALL FOUR CLAUSES: measured,
> 7 of 7 closed movements carry a cause, 7 of 7 a stage, 7 of 7 a wait, 6 of 7 a transport leg.**
>
> ✅ **Status: M2, M4 and M5 are BUILT and committed on the lane branch, with the divergence
> logged under §5.0(2) BEFORE the build. M1 is held behind M2. Refused corridors are deferred to
> D-45 — `Decline` carries no stage, so a refused row would borrow the movement's CURRENT stage,
> safe on today's two specimens for a reason nothing enforces.**

- **Status:** not started [U]. Lane plan M1–M7.
- **Corrections since v1:** `totalsReconciliation()` **exists, renders and is tested, and guards a
  closed clinical defect (WF-008)** — M5 moves the existing sentence into the footer panel; nothing
  is re-derived [L A2]. Tab names are `Where each open movement stands` · `Transport legs and what has
none` · `How long they have waited` · `Resolved today` · `Movements with no owner` `[drawing]` and
  the traffic heading uses a curly apostrophe, `Today’s traffic` `[drawing]` [L §G, §G2]. The detail
  stays a drawer that links to the workspace route, which stays [R lead Q-4].
- **Not built:** a second detail page; any new reducer event.

### 6.4 Capacity — lane A · `capacity/`

> 🔴 **THIS SECTION'S STATUS AND CONTRACT ARE STALE. CORRECTED 2026-09-11 LATE — READ THIS FIRST.**
> ✅ **P1's RENAME is built (`"Every ward in the network"` → `"Wards"`); the scope word survives
> because the panel's own count carries it.**
> 🔴 **P1's REORDER IS RULED AGAINST AND MUST NOT BE BUILT.** **The drawing leads with the bed
> map; the owner ruled on 2026-09-11 that his 2026-09-07 order STANDS — mismatch → Ready now → the
> bed map → the network table. O-15.2.**
> ⚠️ **AND P2 IS LISTED WITHOUT ITS DEPENDENCY. P2's _"Reconciled to Command"_ footer CANNOT be
> built while `layout.tsx` passes an empty check array on every ward route — D-40 forbids claiming
> reconciliation over an empty one. P2 waits on O-9 (§8.7's append path), which the owner scheduled
> for this phase.**

- **Status:** not started [U]. Lane plan P1–P2.
- **Corrections since v1:** **fourteen** `tests/ward-capacity-*` files, not fifteen [L A3]. The
  free-bed word is **Ready**; the done-when now asserts _Available_ and _Unoccupied_ **absent**, with a
  note that both are absent today so nobody reads the assertion as a migration target [R lead D-27; L
  lane A `99c2124a23`]. **The bed mix is blocked on the gender question:** render `sexMix` exactly as
  today, no rename, no second mix; a drawing labelling the mix with a gender word is a hand-back
  [L §AC-2]. The standard's §14 "Hold a bed" row is stale — Ward Mockups fixes it [R lead Q-10].
- **Not built:** a gender mix; "Hold a bed".

### 6.5 Ward — lane B · `ward/`, `ward-table/`, `wards/`

- **Status:** partly built [U]. Lane plan A1–A4.
- **Corrections since v1:** the first edition said _"Where to refer shows all four catchment lookup
  states (built 2026-09-05, keep)"_ — **the words `Where to refer` and `catchment` occur zero times in
  `ward-screen.tsx`**; the catchment logic lives on the referral screens [L §CC]. **"Keep" is struck:
  the panel is either built as drawn (a soft note, per Q-2 and §5) or handed back — never reported
  done by inaction.** The heading contract (h1 `Ward`, ward name below, document title carries the
  name) stands [lane B A1]. `Accepted, pulled or en route here` is also **rendered prose** in a
  sentence, not only a heading — rename both, and pin the heading and the clause separately
  [R lead D-20, D-20-REVISED; L §BW]. The retired standing strip and the drawing's `Ward figures` are
  different populations; A2 is a rename and regroup, not a rebuild [L §BV].
- **Not built:** catchment as a filter; a roster or ward round; acuity anywhere.

### 6.6 Bed board — lane B · `board/`

> 🔴 **THIS SECTION'S STATUS AND CONTRACT ARE STALE. CORRECTED 2026-09-11 LATE — READ THIS FIRST.**
> **NOT "not started".** **D-23 (leave beds) folded at `f8742d4963`; the `<ol>` → `<ul>` honesty fix
> and the ordinal census landed at `685dbfeedb`; B1's headings and the destinations fold at
> `21ec0d401a`, WITH the first heading guard this board has ever had.**
> 🔴 **A plan of record saying NOT STARTED is the exact condition under which a second lane
> rebuilds finished work.** **That is the inverse of a stale hazard: instead of hunting a defect
> that is closed, somebody rebuilds what is done.**
> ⚠️ **HELD for the owner: whether the three always-visible panels (_Coming in_, _Going out
> today_, _Since yesterday_) become three TABS as drawn. Nothing is dropped from the page; two of
> three leave the GLANCE, and that is an interaction decision on a clinical screen.**

- **Status:** not started [U]. Lane plan B1–B4.
- **Corrections since v1:** the first edition's done-when _"every occupied tile resolves to a person
  through admission → referral → patient"_ was written when the join was believed absent — **the `patientId` link and its guard exist at `ba81fd2109` [M]; the seed sets it on one occupant of
  259, deliberately, as the guard's specimen — so "who is in the bed" is not buildable against this seed
  and its failure would read as a board defect [L §DG]**; the drawing's footnote claiming the chain resolves is false and is Ward Mockups' to mark
  as unverified, never deleted [L §AE, §AC-2]. **Amend when D-14 lands; until then a tile whose chain
  breaks says _record not linked_.** The board passes a constant empty `leaveBeds` array into three
  capacity figures and says nothing — **D-23: pass real leave beds or say in words that leave beds are
  excluded; `capacityBreakdown` itself is not changed** [R lead D-23]. Two `arrivedAt` fields with two
  absence shapes (`null` on `Admission`, `undefined` on `TransportJob`) — a guard for one waves the
  other through, and a pulled bed with no arrival is **not empty** [L §C, §C2]. Bed numbers on tiles
  and the word _Occupied_ on occupied tiles are **decisions handed back** (the component refuses
  numbers by design; the app renders no state word on an occupied tile) — J2, J3 [L §J]. `Who is in
these beds` is print-only (`display: none`) and cannot be "folded into a visible panel" without a
  print decision — J4 [L §J].
- **Not built:** the two withheld patient fields (Aboriginal or Torres Strait Islander status,
  interpreter language) pending the review; a gender word on any tile.

### 6.7 Emergency department — lane B · `ed/`

- **Status:** not started [U]. Lane plan C1–C4.
- **Corrections since v1:** the drawing's `Today&rsquo;s return` heading defeated a literal grep and
  nearly produced a task deleting a drawn panel [L §I] — enumerate, do not confirm. The inline referral
  form becomes the bar's New referral **only after D-18's contract is honoured**: the menu carries a
  model `source` the form actually reads, or passes none [R lead D-18]. `edHomeTotals` /
  `worstEdSummary` belong to this screen's hub and nowhere else [L §CF].
- **Not built:** any triage or acuity computation; medical clearance as a blocker.

### 6.8 Community team — lane B · `community/`

- **Status:** partly built [U]. Lane plan D1–D4.
- **Corrections since v1:** **Q-5 is already satisfied** — the screen and its derivations import only
  the 65-team catchment list; the hits for the ten-team list are comments explaining why it is unused
  [L §H1]. **The decline-reason catcher is a guard over an empty population**: the screen renders no
  decline reason and has no accept or decline control (the drawing has them disabled) — building them
  is decision J1, handed back [L §H2, §J]. `Expected back` is a column plus band tile in the drawing,
  not a dropped panel — fold it in as that column [L §H3]. Tiles and panels use **different**
  wording deliberately, both copied from their own place in the drawing (_Waiting for an answer_ /
  _Waiting for the team's answer_) — the test says they must not be tidied into agreement [L §AL-2].
  The h1 is the screen's name and the team an h2, but **the rendering does not change** — the owner
  said the top of this screen was too large [L §BS]. `community-index.tsx` announces counts in a live
  region 63 lines from its visible marker — flagged, deliberately unguarded until the marker guard has
  its own brief [L §V2].
- **Not built:** membership by home area; accept/decline controls (J1).

### 6.9 Patient search — lane C · `search/`

- **Status:** **complete and browser-verified** [U Ward Lead]. Lane plan tasks 4–7; **task 7 (Access
  record) is HELD** — the panel promised a trace the build does not keep [L lane C drawing-facts §E;
  R lead D-4 and addendum].
- **What binds:** the kinds are **facets over movements, not people** (`Everything · Accepted · No
ward yet · No owner · Under 6 hours · 6 to 24 hours · Over 24 hours` `[drawing]`), each with its own
  empty wording copied per facet; three facets have none in the drawing [L §G3, §T]. Panel headings
  `Search · Results · Selected person · Access record` `[drawing]` — with `Selected person` **not**
  adopted as that panel's heading for a reason the drawing itself gives [L drawing-facts A2a]. The
  §8.6 refusal sentences verbatim; **the standard's fixed footer _"Names are invented. Search never
  returns a risk score, an acuity score or a best match."_ is built on neither search surface** and is
  queued as work [L §AV]. A refusal is contradicted by nothing in any channel — the typeahead's
  _"Nobody matches"_ was the defect [L §U].
- **Not built:** persistence of the access record; the false assurance sentence D-4 struck.

### 6.10 Patient — lane C · `patients/`

- **Status:** blocked on §2.1 for gender; four tasks narrowed by D-17 [U; L lane C §0].
- **Corrections since v1:** the screen is called **Patient** [R owner D-1]. The verdict comes from
  the existing standalone `eligibility()` / `candidateReason()` exports in `ward-eligibility.ts` (one
  unit, not a list) — nothing is exported through the facade for it [L A4]. **FD-23 wins: the screen
  shows neither a person's other movements nor their referral history elsewhere, to anyone**; a task
  whose whole content was the cross-reference is **closed by ruling, not deferred** [R lead D-17].
  Headings `The person now · Journey · One day, one network` `[drawing]` — the third panel was absent
  from the first edition entirely [L §G3]. The tablist's accessible name is `The record`; tabs `Now ·
History · Community · Details · Documents`; **Now, History, Community and Documents carry a count,
  Details does not** [L §G3]; the Documents count is a logged departure [L drawing-facts D6]. Gender
  is shown as an addition the drawing does not draw, logged as such, under D-7's three conditions
  [R lead D-7].
- **Not built:** cross-referencing of any kind (D-17); gender completion until §2.1 lands.

### 6.11 Search hub — lane C · `hub/`

- **Status:** **complete and browser-verified** [U Ward Lead].
- **What binds:** headings `The network · At a glance · Where these figures come from` `[drawing]`
  [L §G3]; the reconciliation clause is _"no event feed on this screen"_ [L §B4]; **community rows get
  a stated absence and no statistics link** — no resolvable team id exists and the module refuses to
  fabricate one [L §N]; ward and ED rows carry both links. The four claims in the drawing's footer that
  failed a data check stay corrected in the app and are Ward Mockups' to fix in the drawing [L A2b].
- **Not built:** pins or recents beyond the existing browser memory.

### 6.12 Raise a referral — lane C · `referrals/`

- **Status:** partly built [U]. Lane plan tasks 13–17; **task 17 (gender on the form) blocked on §2.1**.
- **Corrections since v1:** **the one-story-field ruling is already built** — `HISTORY_FIELDS` holds
  one optional entry and nothing reads `.history`; the task is a guard, because the drawing still shows
  three boxes including a _Risk and safety_ box captioned _Never scored_ over prose that is never
  saved — a clinical hazard and the reason FD-13 stands [L A7, §BJ]. The query contract carries
  **model** source values; `gp` is the owner's question; the menu must not promise a prefill the form
  does not perform [R lead D-18]. The duplicate sentence is permitted (_something is already open for
  this person_) and never says where [R lead D-19]. The referral board's table **may** scroll sideways;
  the affordance is a sentence first and a measured edge; `ui-ward-referrals.spec.ts`'s off-screen
  assertion encoded a stricter rule than the standard and is rewritten with two separate reds (shade
  alone, sentence alone) [R lead D-9, D-10; L §AW]. The Send-never-enables red at `:710` is a stale
  journey that never answers the acuity control — repair the spec, not the form [L §AS].
- **Not built:** three history fields; catchment narrowing; a seventh referral source.

### 6.13 Statistics — lane D · `statistics/`

- **Status:** not started; lane held [U; L §BB]. No lane plan yet — lane D writes it from §6.13–§6.16
  and the errata entries cited here before its first task.
- **Corrections since v1:** all routes sit under `/mockups/ward-flow/statistics/…` [L §CE].
  `pulledAt`, `arrivedAt`, `leftAt` exist **in `ward-admissions.ts`, all `Instant | null`** — a
  `dailyFlow` that filters nulls draws a clean line over a quietly different population; say what was
  excluded, on screen [L §BE-2, §C]. The first edition's line counts for §4.13–§4.16 were exact and
  its route paths were all wrong — a sweep is scoped to the questions it asked [L §CE].
- **Tasks (lane D writes them in full):** headline band from `pullToArrival` and `referralToBedJoin` — **`wardStatistics` takes a single
  `unitId` and cannot serve a whole-of-system band; a network figure is summed per unit or handed
  back** [L Ward Lead] — with every wording pin re-derived, none deleted (the 41-site statistics DOM test
  was measured on both arms on 2026-09-10); `dailyFlow(admissions, days)` with its excluded
  population stated; three tables (wards, EDs, teams) each row linking through the facade's builders;
  Referrals for a bed derived from `referrals`, never the drawing's literal; Export the figures as a
  CSV equal to the rendered figures; **the two panels _How the system is performing_ and _What is happening to patients_ live on
  `/statistics` itself (from `pullToArrival` and `referralToBedJoin`), not on `/statistics/overview`,
  which holds its own stage panel _Where admissions sit in the bed lifecycle_ and others** [L Ward
  Lead; M `32aa384ab2`] — every panel on both routes is a Q-12 item, kept and listed; the first draft's
  "two funnels of `/statistics/overview`" named a route that holds neither, which under Q-12 would
  have produced either a keep of nothing or a drop of the two that exist.
- **Not built:** any figure the model cannot derive (stated absence instead).

### 6.14 Ward statistics — lane D · `statistics/`

- **Corrections since v1:** **a referral is addressed to the ward SYSTEM; the `psychiatric_ward`
  destination arm carries sex and bed criteria and no unit id; `acceptedUnitId` lives on `Movement`
  and is set only on acceptance** [L A5, §A5-CORRECTION]. So _Referrals into this ward_ becomes
  **two honest figures — asked (movements whose `referredUnitIds` include the unit) and accepted
  (`acceptedUnitId` equals it)** [P]. The free-bed word is Ready [R lead D-27]. The app already serves every unit
  by route [L A2b]; **no switcher component exists to "become" one — the §6.18 switcher is new work**
  [L Ward Lead].
- **Not built on this screen:** occupancy predictions; any acuity figure (acuity exists across the
  app — the acuity gate and the clinician's mark — this line is about this screen only).

### 6.15 Community team statistics — lane D · `statistics/`

- **Corrections since v1:** the team list is the catchment list [R lead Q-5] — **its size is under
  measurement and not to be quoted: three checked-in tests pin 65, a render handover said 64, a doc
  comment says "71 distinct strings for 65 clinics"; lane D has an agent resolving it** [L Ward Lead]; the join to admissions depends on
  §2.1 — until it lands, _People currently in a hospital bed_ is a stated absence with the reason, never
  a zero presented as a count [P]. Contacts and time to first contact: the model holds no contact
  records — stated absence, never an invented series [P]. `Where this team sits` is kept (Q-12).
- **Not built:** contact figures; catchment inference.

### 6.16 Emergency department statistics — lane D · `statistics/`

- **Corrections since v1:** **the screen computes its own wait bands from `movement.openedAt`,
  bucketed at 24h and 48h — built, not restyled; it imports nothing from `edHomeSummaries`** [L Ward
  Lead, `32aa384ab2`; M: zero occurrences]. This edition's first draft said the bands come from
  `edHomeSummaries` — a true fact about Command and ED home (D-26) carried one screen too far, the
  fifth time that module was hung on a screen that does not import it. Band edges that conflict with
  the owner's 8/24-hour bands are a hand-back, never invented [P]. 🔴 **_Due within 2 hours_ IS NOT BUILT AT ALL. A-7 is CLOSED** — the owner, 2026-09-11: _"This appears pointless as it is easier to just notify at 24 hours."_ **No two-hour tile anywhere; the tally is three figures** [R owner; see §2.4 and §9.2].
  ⚠️ **CORRECTED 2026-09-12.** This line previously read _"is D-15's tile and renders nothing until A-7 is answered"_ — written before the ruling and never updated when it landed elsewhere in this same document. 🔴 **A ruling recorded correctly in two sections and contradicted in a third, where the third is the BUILD INSTRUCTION.** A lane opened this section first, for exactly the reason anyone would, and stopped rather than acting on it. The 30-day trend renders the drawing's own _not drawn_ state — the seed's largest ED-open
  offset is about 600 minutes [L Ward Lead; the first draft said ~300], nowhere near 30 days. "All departments" needs a nav entry — Ward Lead's file [P]. Comparison
  across departments renders the ED table of `/statistics/compare` inline and links to Compare for
  wards; the placement choice is recorded under Q-12 [P].
- **Not built:** a 30-day series from invented history; a two-hour figure with no clock.

---

## 7 · The integration phase — Phase 3, after all four lanes have folded (Ward Lead)

- [ ] **7.1 One figure, one number — by shape first, by test second.** Where two screens show one
      concept, prefer a projection (D-26's shape) over a cross-screen agreement test: **a test that two
      faithful copies agree cannot fail and never discriminates** [L §CK]. Where a projection is not
      possible, the agreement test is written and **proved against a mutation that reddens it by name**.
- [ ] **7.2 The example patients flow end to end**, one Playwright journey per path
      (`tests/ui-ward-third-edition-flow.spec.ts`, path claimed): refer → shortlist (gender gate refuses
      without an override; sex-mix and specialling refuse with a reason; unavailable wards grouped and
      counted) → accept (Ward, Bed board, Capacity show the pulled bed as _Held_; the movement stage
      advances; Delays drops the row) → move (transport leg on Movement and the officer view) → arrive
      (`PATIENT_ARRIVED` creates the admission; the tile reads _Occupied_ only if J3 rules it; ED count
      falls; Statistics counts it) → discharge (_discharged_; the bed reads **Ready**). After each step
      every visited screen's reconciliation line carries the owner's phrase in its agreeing form and
      the live region announced the change. **Run after `npm run ensure`, alone, never concurrently
      with another lane's journeys** [L §BH].
- [ ] **7.3 The shell is the same on every route.** For all routes: active rail link matches; the bar's
      place line matches; drawers open and close by keyboard; Escape leaves the service alone; the
      appearance choice persists; the twenty-one un-redrawn routes render inside the shell with no
      second header (`ModeHeader` on Network and Governance is Ward Lead's to remove). **The shell live
      region is read on every screen** [L §U3]; live regions are counted by a **settled** render — four
      per ward page today, two of them the app's shared announcer outside ward code [L §BQ, §BR].
- [ ] **7.4 Markers.** The invented-figure checker's population is **provenance blocks** (paragraphs
      under a heading matching `invented|synthetic|placeholder|prototype boundary`), in two files
      neither of which is in any lane — **a green run says nothing about lane screens** [L §V, §V2]. The
      owner's ruling keeps the reach at 2 [R owner 2026-09-10]. The lanes' screens are examined by the
      §7.0 definition of done and by eyes, and each report says so; the positive-over-the-whole-surface
      marker guard gets its own brief and adversarial pass, and asks first whether the shape can carry
      the marker as one value [L §U2, §AH, §AK].
- [ ] **7.5 Words before colour, on every state** — one DOM sweep, the test proved by removing one word.
- [ ] **7.6 Widths and themes.** Sixteen screens at 390, 820 and 1440, light and dark, plus print for
      Handover and Ward statistics, plus one width in 641–1000px; a screenshot per width in the phase
      report; **font sizes read from the CSS, because no DOM test can see them** [L §O].
- [ ] **7.7 Heavy gates once, on the line, staggered:** `tsc -p tsconfig.typecheck.json --noEmit`,
      lint, `node scripts/run-ward-tests.mjs`, `node scripts/check-ward-expected-reds.mjs`,
      `npm run test:e2e:ward-journeys` — quoting the runner's own final lines and its exclusion notice.
      Then `node scripts/ward-flow/check-errata-freshness.mjs`.
- [ ] **7.8 Q-12 to the owner, once**, with the assembled list; close the phase in a dated handover
      with the SHAs, what was believed but not measured, what was withdrawn, what was NOT done; back up
      with `env -u MSYS2_ARG_CONV_EXCL bash ~/.claude/scripts/backup-work.sh`.

### 7.0 Definition of done for a screen built from a drawing — corrected

A screen is done when **all** of these are true and each is quoted in the lane's report with the line
that proves it, **plus the population line saying what that proof walked**:

1. It renders inside the shared shell on its existing route with no rail or header of its own.
2. Every panel, action and state the drawing draws is present **under the drawing's own copied
   name**, or its absence is recorded as an owner question by number; every panel the app had that the
   drawing lacks is listed for Q-12 — nothing dropped silently, nothing kept silently.
3. Every figure is derived through the facade or the lane's own derivation module; a grep of the
   screen's JSX for a numeric literal in text position returns only ordinals and dates; **an empty
   list passed into a derivation is stated on screen or replaced with data** [R lead D-23].
4. Every link the drawing draws resolves through the facade's builders to a real route with the
   identifier intact; **where no identifier can resolve, the screen states the absence and draws no
   link** [L §N].
5. The screen's DOM test asserts the words of every state (empty, refused, absent, zero as _none_),
   copied per state from the drawing, and **was proved a catcher by one mutation that reddened it by
   name** — with the number of tests that reddened reported [L §S].
6. It states in words, visible at every width, that its figures are invented and reconcile with each
   other, using the owner's phrase and the screen's own drawn sentence; **one test proves the statement
   goes red when a figure is made to disagree; the exact sentence lives in the standard and the
   drawing, never as a copy in the lane's test** [R lead §W].
7. Keyboard reach and visible focus on every control; the live region announces each change and
   contradicts no refusal; no new HTML text under 12px and the count of raised declarations reported;
   tokens only; no edge bar or top highlight.
8. Looked at, by a person, at 390, 820 and 1440 in both themes and at one width in 641–1000px; the
   shell live region read on this screen; the screenshots are in the report.
9. The lane's branch **synced with the line and the full ward suite run there** — `node
scripts/run-ward-tests.mjs` then `node scripts/check-ward-expected-reds.mjs` green in the lane's
   worktree after the sync [L §AF]; prettier clean on touched files; one SHA handed to Ward Lead with
   an artefact grep.
10. The report ends with four lines: proven by test / proven by looking / not proven / population.

---

## 8 · Issues — the first edition's register corrected, plus what the day found

**Proven** = measured with a command by the author or a lane at a stated SHA. **Unproven** = read from a
document or inferred. Where a first-edition issue was wrong, it says so.

| #    | Issue                                                                                                                                                              | Status                                                                                                                                                                                                                                                                                                                                                                                                             | Where it lands                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| I-1  | Master line lacked the three mockup commits                                                                                                                        | **Closed** — folded [M ba81fd2109]                                                                                                                                                                                                                                                                                                                                                                                 | —                                                                            |
| I-2  | Rail mounted per screen                                                                                                                                            | **Closed** — shell mounted once, zero mounts [M ba81fd2109]                                                                                                                                                                                                                                                                                                                                                        | —                                                                            |
| I-3  | No appearance control in the app                                                                                                                                   | Shell built; verify the control persists across routes (7.3)                                                                                                                                                                                                                                                                                                                                                       | Ward Lead                                                                    |
| I-4  | Three role types                                                                                                                                                   | Stands; plus `WardFlowRole` moved to `ward-flow-roles.ts` [M ba81fd2109]. Two `WardPrimaryAction` types and two `ReferralSource` types were the same shape across seams [L §BD, D-18]                                                                                                                                                                                                                              | every lane (rule)                                                            |
| I-5  | Reload wipes the demonstration                                                                                                                                     | **Answered:** leave it this phase [R lead Q-8]                                                                                                                                                                                                                                                                                                                                                                     | —                                                                            |
| I-6  | Manufactured `Admission.referralId`; the person join                                                                                                               | **Closed as a defect, open as a fixture decision:** the link and D-14's default-deny test exist; the seed sets `patientId` on 1 of 259 occupants **deliberately**, as the guard's specimen [L §DG]. Whether the fixture should exercise the arm is Ward Lead's one decision, joint with the high-acuity referral                                                                                                   | Ward Lead                                                                    |
| I-7  | Two community-team lists                                                                                                                                           | **Answered:** the 65; the screen already uses only the 65 [R lead Q-5; L §H1]                                                                                                                                                                                                                                                                                                                                      | —                                                                            |
| I-8  | `legalDeadlineMinutes` has no reader                                                                                                                               | **WRONG in v1** — it has a reader and a DOM test [L A1]                                                                                                                                                                                                                                                                                                                                                            | —                                                                            |
| I-9  | `Unit.held` dead field                                                                                                                                             | Stands [L A4]                                                                                                                                                                                                                                                                                                                                                                                                      | rule                                                                         |
| I-10 | Drawings model the world differently from the app                                                                                                                  | Stands and sharpened: the drawings' `PAGES` block is the Activity drawer's tally; the Bed board drawing asserts a chain that does not exist; the referral drawing re-commits FD-13; eighteen drawings carry a two-hour tile with no clock [L §AJ, §AE, §BJ, §BT]                                                                                                                                                   | Ward Mockups, lanes                                                          |
| I-11 | Marker predicate at HEAD is the claim-shape rewrite                                                                                                                | Stands; and its **population is provenance blocks in two files outside every lane** [L §V, §V2]                                                                                                                                                                                                                                                                                                                    | Ward Lead (document), lanes (report)                                         |
| I-12 | Ward gates run in no automatic chain                                                                                                                               | Stands; and `npm run test:e2e:ward-journeys` is called by nothing — found at least twice, changed nothing either time; **not to be wired in while red** [L §AM, §BB-2]                                                                                                                                                                                                                                             | Ward Lead                                                                    |
| I-13 | 44% of non-DOM ward tests invisible to `test:focused`                                                                                                              | Stands [L A5]                                                                                                                                                                                                                                                                                                                                                                                                      | every lane                                                                   |
| I-14 | Two test defects (dead literal; absent-only test id)                                                                                                               | Stands; lane B task B4 [L A5]                                                                                                                                                                                                                                                                                                                                                                                      | lane B                                                                       |
| I-15 | Three deferred browser reds                                                                                                                                        | **Now understood:** two were stale specs (seed moved under a four-id list; peel-ed's inbox is not empty), one is the 641px table whose assertion was stricter than the standard (D-9, D-10); a fourth red (Send never enables) came from the acuity fold and is a stale journey; reported 88/0/3 after two count re-expectations whose behavioural assertions were byte-identical [L §AP, §AQ, §AS, §AW, §BA, §BY] | Ward Lead                                                                    |
| I-16 | Six of twelve specs sample no 641–1000px width                                                                                                                     | Stands; one spec (`ui-ward-search`) does sample 641/700/760/820 and was running nowhere [L §AM-2]                                                                                                                                                                                                                                                                                                                  | every lane                                                                   |
| I-17 | Two search screens; the app's Patient search searches movements                                                                                                    | **Answered:** keep both; facets are over movements [R lead Q-3; L §G3]                                                                                                                                                                                                                                                                                                                                             | lane C                                                                       |
| I-18 | Parked unreachable components                                                                                                                                      | Stands                                                                                                                                                                                                                                                                                                                                                                                                             | rule                                                                         |
| I-19 | Seven screens missing from the standard's §14                                                                                                                      | **Answered:** Ward Mockups adds them [R lead Q-10]                                                                                                                                                                                                                                                                                                                                                                 | Ward Mockups                                                                 |
| I-20 | Movement's two figures unreconciled                                                                                                                                | **WRONG in v1** — `totalsReconciliation()` renders and is tested [L A2]                                                                                                                                                                                                                                                                                                                                            | —                                                                            |
| I-21 | No communication mechanism                                                                                                                                         | **Corrected:** an inbox exists (coordinator-only, no addressee); notices are being built beside it under D-2 [L addendum]                                                                                                                                                                                                                                                                                          | Ward Lead                                                                    |
| I-22 | Two chats edited the mockup folder                                                                                                                                 | **Closed** — folded without conflict [M]                                                                                                                                                                                                                                                                                                                                                                           | —                                                                            |
| I-23 | Stale registry rows                                                                                                                                                | Stands; Ward Lead refreshes at each phase                                                                                                                                                                                                                                                                                                                                                                          | Ward Lead                                                                    |
| I-24 | No definition of done for a built screen                                                                                                                           | §7.0 supplies it, corrected                                                                                                                                                                                                                                                                                                                                                                                        | this plan                                                                    |
| I-25 | Sex/gender wording tension                                                                                                                                         | **Resolved into a model change** with a missing join (§2.1) [R owner §8–§9; R lead D-5, D-14]                                                                                                                                                                                                                                                                                                                      | Ward Lead                                                                    |
| I-26 | 58 never-written test files                                                                                                                                        | **Answered:** superseded; struck [R owner §7; R lead Q-9]                                                                                                                                                                                                                                                                                                                                                          | —                                                                            |
| I-27 | The reconciliation line claimed reconciliation over an empty check array, on every ward route                                                                      | **Ruled and fixed: D-40** (`f605c914be`) — the honest sentence now; **the append path for a screen's checks does not exist and cannot be prop-drilled (§DD)**                                                                                                                                                                                                                                                      | Ward Lead (§2.2)                                                             |
| I-28 | The four ED-tally facade names in v1 never existed; a lane's correction was misread as propagation                                                                 | **Proven** [L §AG, §CF, §CJ]                                                                                                                                                                                                                                                                                                                                                                                       | never create them                                                            |
| I-29 | Two independent copies of the ED figures computation                                                                                                               | **Ruled:** projection, D-26 [R lead]                                                                                                                                                                                                                                                                                                                                                                               | Ward Lead                                                                    |
| I-30 | The design-system contract gate is red on a clean tree and has no exemption path for the visually-hidden idiom's negative margin                                   | **Proven** [L §AA, §AB-1]                                                                                                                                                                                                                                                                                                                                                                                          | design-system question, recorded                                             |
| I-31 | 389 sub-12px declarations; two type scales with opposite floors                                                                                                    | **Ruled:** D-3, screen by screen, ratchet                                                                                                                                                                                                                                                                                                                                                                          | lanes, in rebuilds                                                           |
| I-32 | `check-type-scale.mjs` blesses 10px; `no-hardcoded-hex` reads TSX only                                                                                             | **Proven** [L §L, §Y2]                                                                                                                                                                                                                                                                                                                                                                                             | catcher menus corrected                                                      |
| I-33 | The token-resolve guard cannot see `composes`; a token declared in an uncomposed module resolves to nothing while green                                            | **Proven** [L §BI, §BN]                                                                                                                                                                                                                                                                                                                                                                                            | rule: check every new token's resolution                                     |
| I-34 | The protection hook matched the working directory, not the target; `find -delete` bypassed it; prose naming a verb trips it                                        | **Fixed in the two widening directions with the owner's approval; the over-broad axes left deliberately** [L §AN, §BC]                                                                                                                                                                                                                                                                                             | done; unversioned — re-check after any config restore                        |
| I-35 | `WardPrimaryAction` seam                                                                                                                                           | **Measured: wired** — `WardBarMount` resolves the route; a button appears on twelve routes, none on the rest [L §DE]                                                                                                                                                                                                                                                                                               | lanes check their own route                                                  |
| I-36 | `_broken-copy.html` — an untracked 664 KB snapshot of the design-system page with the dark ink in the light palette and pre-ruling edge bars; purpose undocumented | **Proven (file); purpose inferred** [L §BE]                                                                                                                                                                                                                                                                                                                                                                        | owner's word before moving or deleting                                       |
| I-37 | 75 tests skip; at least four whole community DOM suites are `describe.skip` with no stated reason                                                                  | **Proven (skips); reasons unexamined** [L §BG]                                                                                                                                                                                                                                                                                                                                                                     | Ward Lead; any coverage claim names the suite and confirms it is not skipped |
| I-38 | Fourteen absence wordings against D-6's two                                                                                                                        | **Proven; a rename would be the defect in reverse** [L §CH]                                                                                                                                                                                                                                                                                                                                                        | a reading job with no owner yet                                              |
| I-39 | `gp` referral source missing from the model                                                                                                                        | **Proven; clinical question** [L D-18]                                                                                                                                                                                                                                                                                                                                                                             | owner                                                                        |

---

## 9 · Owner questions — answered, open, and new

### 9.1 The thirteen — answered 2026-09-10 evening, all as Ward Lead's recommendation approved [R lead]

| #                                     | Answer                                                                            | What it does not settle                                         |
| ------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Q-1 acuity ordering                   | **No** — order by wait and legal deadline; the acuity mark is shown as a word     | grouping, warning or refusing on the mark; the built gate stays |
| Q-2 catchment                         | **No filter** — information only                                                  | nothing infers a relationship the model does not hold           |
| Q-3 two search screens                | **Keep both** this phase                                                          | —                                                               |
| Q-4 Patient Now                       | **The person's page**; the workspace route stays; **named Patient** [R owner D-1] | narrowed by D-17: no cross-referencing shown                    |
| Q-5 team list                         | **The 65**, marked invented                                                       | already the case in the code                                    |
| Q-6 retire the 2026-09-06 header spec | **Yes**                                                                           | —                                                               |
| Q-7 demo controls                     | **Tools drawer, labelled _Demonstration_**                                        | —                                                               |
| Q-8 reload wipes the demo             | **Leave it** this phase                                                           | scope limit added after a drawing's appendix was read           |
| Q-9 the 58 test files                 | **Struck**                                                                        | —                                                               |
| Q-10 seven missing §14 entries        | **Yes**, Ward Mockups                                                             | —                                                               |
| Q-11 bars and stripe                  | **Remove the two bars; keep the brand stripe**                                    | —                                                               |
| Q-12 app-only panels                  | **Keep every one; drop nothing**                                                  | the list is not yet known — collected at the end of Phase 2     |
| Q-13 history fields                   | **One**, FD-13 stands; Ward Mockups redraws                                       | —                                                               |

### 9.2 Still with the owner — asked, not answered

- **A-6 / D-14** — **APPROVED by the owner, 2026-09-11 evening, to the design-review chat: _"Approve
  as written"_** [R owner, relayed to Ward Lead to record]. The person join and the enforcing FD-23
  guard land in one change.
- **A-7 / D-15** — **CLOSED by the owner, 2026-09-11, to Ward Lead:** _"This appears pointless as it
  is easier to just notify at 24 hours."_ **The tile is removed everywhere**; nothing counts to a
  two-hour horizon [R owner].
- **`gp` as a referral source** — **ANSWERED by the owner, 2026-09-11: _"NO. They come through ED or
  community."_** [R owner, relayed]. No seventh source; the drawings' GP option is removed by Ward
  Mockups; the New referral menu carries model values only (D-18).
- **Lane D's hold** — **released by the owner directly to Ward Builder Four, 2026-09-11** [R owner:
  _"I have notified them"_].
- **J1–J4** — **ANSWERED by the owner, 2026-09-11: _"Yes to your recommendations"_** [R owner,
  relayed]: community accept/decline controls are **not built** this phase; the board's refusal of bed
  numbers on tiles **stands**; _Occupied_ **is rendered as a word** on an occupied tile; `Who is in
these beds` **stays print-only**.
- **The 12px legibility programme** — D-3 adopted the floor screen by screen; the ratchet's baseline
  count is his to see [R owner D-3].
- **The protection hook's remaining over-broad axes** — left deliberately; his to narrow if he wants
  [L §BC].
- **`_broken-copy.html`** — keep, move or delete [L §BE].

### 9.3 What he may be missing — carried from the first edition, corrected

1. **Communication:** an inbox exists but has no addressee and is coordinator-only; notices are being
   built (D-2). The first edition's "no inbox anywhere" was wrong [L addendum].
2. **Nobody is anybody:** role gates data in places (the sidebar filters by it; the reducer refuses a
   ward acting outside its unit) but not on the Patient screen — which is why D-17 could not rule
   "coordinators only" [L D-17].
3. **The marker guard reaches two files, neither in any lane** — a green run is not marker coverage
   of a rebuilt screen [L §V2].
4. **The browser journeys run in neither loop**, found twice, changed nothing either time; they are
   the only instrument that can see a media query, a cascade or a computed style [L §AM, §BB-2].
5. **Drawings re-commit closed rulings** — twice today (FD-13's three boxes; D-15's two-hour tile in
   eighteen files). Nobody diffs a drawing against the rulings before it is approved [L §BJ, §BT].
6. **Two P1 safeguards are built, tested and unreachable** (`genderEligibility`;
   `validateGovernedMessage` in Caring Contacts) — a decision nothing asks for looks identical to a
   working one from every green [L §AC].
7. **The three gates before real-patient use are unchanged and unstarted** — TGA/SaMD; gender as a
   matching input, now ruled at model level and still un-reviewed as a use gate; Aboriginal cultural
   safety [R owner §7].

---

## 10 · Verification — what proves each level (corrected commands)

| Level      | Command or act                                                                                                                                                         | Decisive line                                                     | Trap                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Typecheck  | `npx tsc -p tsconfig.typecheck.json --noEmit`                                                                                                                          | `exit 0`, zero lines                                              | the bare form reads generated `.next` files [L §BH]                                                                          |
| Task       | `npm run test:focused -- --files <changed files>`; readFileSync tests run directly `npx vitest run tests/<file>`                                                       | `N passed`                                                        | 44% invisible to focused runs                                                                                                |
| New test   | `npm run mutate` (`scripts/ward-flow/mutation-run.mjs`); restore with `git show HEAD:<path> > <path>` then `git diff --quiet <path>`                                   | the mutant's `FAILED` naming the test, **and how many reddened**  | a mutation that fails everything is a crash [L §S]; the ordinary restore is blocked [L §F2]                                  |
| Formatting | `npx prettier --check <touched files>`                                                                                                                                 | `All matched files use Prettier code style!`                      | `npm run format` exits 0 having done nothing on a tree with no binaries                                                      |
| Screen     | `node scripts/run-ward-tests.mjs` then `node scripts/check-ward-expected-reds.mjs`, **after merging the line into the branch**                                         | `N passed`, floors met; the runner's exclusion notice quoted      | both live in `scripts/`, not `scripts/ward-flow/` [L §H5]; a branch's own green says nothing about whole-tree guards [L §AF] |
| Screen     | the lane's specs: `node scripts/run-playwright.mjs --project=chromium-mockups ui-ward-<name>` after `npm run ensure`, one lane at a time                               | `N passed` from the runner's own final line                       | never behind a pipe; never concurrent with another lane's run [L §BL, §BH]                                                   |
| Screen     | render and look: 390, 820, 1440, both themes, one width in 641–1000px, live regions read                                                                               | screenshots and the population line                               | an unsettled render under-counts the newest work [L §BR]                                                                     |
| Tokens     | `node scripts/check-design-system-contract.mjs` compared against a clean-tree run by **named path**                                                                    | the named paths for your files                                    | red on a clean tree; never refresh the baseline [L §AA]                                                                      |
| Shell      | `tests/ward-shell-*` DOM tests; the facade scan now walks real shell files — its floor must require a non-facade file and be proved by a planted route string [L §X]   | `N passed`                                                        | vacuous until the shell existed                                                                                              |
| Fold       | `scripts/ward-flow/folded.sh`; the requester's artefact grep; `git merge-base --is-ancestor <sha> <line>`; measure contribution from `git merge-base`, never from HEAD | folded / not folded / cannot tell                                 | `git log -S` without `--diff-merges` manufactures an absence                                                                 |
| Line       | heavy gates once per phase, staggered (§7.7); `node scripts/ward-flow/check-errata-freshness.mjs`                                                                      | the runner's own lines; `STILL TRUE / EXPIRED / CLOSED` per entry | a harness notification's exit code is the wrapper's [L §Q1]                                                                  |
| Lock       | exit 75 / `DATABASE_HEAVY_RUN_ADMISSION_BUSY` means blocked, retry — a dead owner is reclaimed immediately, so a refusal is real contention [L §BH]                    | —                                                                 | never delete the lock directory                                                                                              |

**Every report says what it did not verify, and what population its green walked.** An absent signal
reads exactly like a passing one; a green over the wrong population reads exactly like coverage.
