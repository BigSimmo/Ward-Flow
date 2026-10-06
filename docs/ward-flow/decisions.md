# Ward Flow — decision log

A short record of project-level decisions: how the work is run, what is in and out of scope, and
where the product is going. Newest at the bottom. Detailed clinical and product rulings on how a
screen or the engine behaves stay in [`OWNER-RULINGS.md`](OWNER-RULINGS.md); this log points there
when a decision here depends on one.

**How to add an entry.** Add a numbered entry at the bottom with the date, who decided, the
decision in one or two sentences, and why. Never rewrite an old entry. If a decision is reversed,
add a new entry that says which one it replaces, and mark the old one "Replaced by D-n".

---

## D-1. Ward Flow is local only, with no linked repository (Replaced by D-27)

- **Date:** 25 September 2026. **Decided by:** Josh.
- **Decision:** All Ward Flow work lives on Josh's own computer, in
  `D:\Worktrees\Database\ward-lead` and worktrees made from it. No GitHub repository is linked.
  Nothing is pushed, and no pull request is opened, unless Josh asks.
- **Why:** The ward line shares history with the live PsychSift app, where pushing to `main`
  deploys the app and changes the live clinical database. Keeping Ward Flow local removes that risk.
  "Fold into main" always means the local ward line, never GitHub (ruling of 12 September).

## D-2. Railway is disconnected

- **Date:** 25 September 2026. **Decided by:** Josh.
- **Decision:** Railway (the hosting service used by the old app) must not be connected to Ward
  Flow. Any Railway or other deployment tool is ask-first, whatever name it appears under.
- **Why:** Ward Flow holds only invented data and is not ready to be hosted. Where it is eventually
  hosted is a separate decision (roadmap milestone 5).

## D-3. The PsychSift and Database code is being retired from Ward Flow

- **Date:** 25 September 2026. **Decided by:** Josh.
- **Decision:** The PsychSift guideline search app and its Database deployment tooling that sit on
  the ward line are leftovers. Ward Flow work ignores them, and they will be removed from the ward
  line (roadmap milestone 1).
- **Why:** Ward Flow does not use them, and they slow every check and confuse every new chat.

## D-4. Synthetic patients only

- **Date:** 25 September 2026 (restating a standing rule). **Decided by:** Josh.
- **Decision:** Every patient, ward and figure in Ward Flow is made up. No real patient data is
  entered or loaded, and no invented clinical fact or figure is shown as if it were real data.
- **Why:** There is no privacy approval, clinical safety sign-off or legal advice yet (roadmap
  milestone 6). Invented figures presented as records would mislead anyone testing it.

## D-5. Parallel threads in separate worktrees, folded one at a time

- **Date:** 25 September 2026. **Decided by:** Josh.
- **Decision:** Many threads may work at once. Each thread that edits code works in its own git
  worktree and local branch, made from the latest ward line, and says which files it expects to
  change. The coordinator keeps two threads off the same files. Before folding, a thread merges the
  latest ward line into its branch, rebuilds and retests, then folds; only one thread folds at a
  time.
- **Why:** Two chats writing in one folder have deadlocked commits and lost work before. Folding one
  at a time keeps each merge small and checkable.

## D-6. Aboriginal cultural safety review deferred

- **Date:** 17 September 2026, restated 25 September 2026. **Decided by:** Josh.
- **Decision:** The Aboriginal cultural safety review is deferred. Threads do not raise it again
  unless Josh brings it back.
- **Why:** Josh's call. It needs outside reviewers this team cannot provide, and it is not needed
  while the app holds only invented data.

## D-7. The first four milestones, in this order

- **Date:** 25 September 2026. **Decided by:** Josh.
- **Decision:** The [roadmap](roadmap.md) runs in this order: (1) clean up the leftover PsychSift
  code, (2) get the ward tests passing, (3) remove invented data from the screens, (4) make the
  Coordinator bed board's full journey reliable, from referral in through bed held, transport,
  arrival and discharge. Milestones 5 and 6 are not yet approved.
- **Why:** Cleanup makes every later change smaller and safer. Until the tests pass, nobody can tell
  whether a new change broke something. Invented data shown as real (such as the wrong name on
  Handover) is the main clinical safety risk. The Coordinator view is the one Josh asked to be built
  first.

## D-8. Josh's standing rulings, numbered R1 to R16, for every session and tool

- **Date:** 25 September 2026. **Decided by:** Josh (collected by the coordinator).
- **Decision:** Every session and tool reads this list before starting. New rulings are added here as
  R17 onward by the thread the coordinator routes them to, with the date and time.
  - **R1** No GitHub, remotes, cloud threads, Railway or Supabase. Nothing is pushed.
  - **R2** Fold everything to the local line before a thread is resolved; never resolve a thread
    without Josh's yes for that thread.
  - **R3** Back up before replacing anything; no early removal; archive, don't delete.
  - **R4** Keep the design exactly as on the line.
  - **R5** Legal (D5): no Act section numbers, no computed legal limits, typed times only, marked
    "Not legally checked".
  - **R6** Made-up patients only.
  - **R7** Gender and sex (10:56): gender is Female, Male, Non-binary, Different term or Not recorded;
    sex is Female, Male, Another term or Not recorded. If either is not female or male, the
    coordinator reviews and notes a reason before allocation, on every ward. Female and male allocate
    by gender identity. A binary mismatch on a single-sex ward refuses.
  - **R8** Demo data (10:08): an "EMHS demo" scenario and an "EMHS surge" state, plain ward labels,
    other health services too; only patients and linked records, never standalone figures.
  - **R9** Retire Care Plan, Caring Contacts and Developer Hub with PsychSift batch 3.
  - **R10** Shared board: PC only; keep "stop saving"; keep "reset all".
  - **R11** History: the Person screen and the Activity drawer; one event log shared with the shared
    board.
  - **R12** Bed board on the capacity screen, held until roadmap steps 1 to 3 fold.
  - **R13** Pilot: EMHS with site switching; the Coordinator view is primary.
  - **R14** Transport release: keep; "no bed" goes to the waitlist.
  - **R15** Run slots and batch folds: heavy checks only where needed, one wide run at a time, one
    fold steward; desktop-only screenshots (full rules in the AGENTS.md Ward Flow rulebook).
  - **R16** The Aboriginal cultural safety review is deferred; don't re-ask (see D-6).
- **Why:** One numbered list every tool reads means fewer relays and fewer mix-ups.

## D-9. Josh's rulings of 25 September, 11:43 to 12:00 (R17 to R21)

- **Date:** 25 September 2026. **Decided by:** Josh (relayed by the coordinator).
- **Decision:**
  - **R17** Gate priority: while a batch fold gate is queued or running, other threads run nothing
    heavy. The coordinator sends "go" after the fold.
  - **R18** Leave beds are linked to the patient's stay. An empty but blocked bed counts as held. A
    bed release is a named discharge.
  - **R19** Made-up trend charts show "Not recorded"; target lines stay, labelled; a ward's confirmed
    ready count is a record.
  - **R20** Legal: the dead clock arithmetic is removed, and 5B continues 5A.
  - **R21** Gender is shown to ward staff.
- **Why:** Recorded so every session and tool reads the same rulings without a relay.

## D-10. Gate build type check (R22)

- **Date:** 25 September 2026, 12:21 UTC. **Decided by:** Josh (decision card).
- **Decision:** **R22** In the fold gate, the app build skips its own type check (`WARD_GATE_BUILD=1`)
  only when the batch changes no page, layout or route file. Otherwise the build keeps it.
  `scripts/ward-flow/gate-build-flag.mjs` decides.
- **Why:** The gate's full type check already covers the code; only the build checks Next's
  generated route types, so route-shaped changes keep that check.

## D-11. Rulings of 25 September, 12:41 (R23 to R25)

- **Date:** 25 September 2026, 12:41 UTC. **Decided by:** Josh ("yes to all").
- **Decision:**
  - **R23** Look-identical checks use about 8 representative screens, one per layout type, not
    every screen.
  - **R24** A READY branch may join a batch if it lands within about 15 minutes of the batch's
    planned start.
  - **R25** READY-FAST-ENGINE: an engine change with no screen, wording or demo-data change, whose
    own tests and full tsc pass on its tip, folds in fast-lane gaps without a gate. The next gate
    re-checks it, and a red is reverted first.
  - Also on 25 September (card): batch 2's journeys run in three shards straight away, without
    trial runs; a failing spec is rerun alone, unsharded, before any branch is blamed.
- **Why:** Fewer missed rounds and shorter gates, at a small, stated quality cost.

## D-12. Rulings of 25 September, 12:43 (R26 to R31)

- **Date:** 25 September 2026, 12:43 UTC. **Decided by:** Josh ("yes 1-4", "also yes to 6-7").
- **Decision:**
  - **R26** Build memory: gate builds keep and reuse Next's working cache between runs, never the
    finished build output.
  - **R27** Ward-only test build: gate builds compile only the Ward Flow routes the journeys and
    screenshots visit, falling back automatically to a full build if a route is missing or the
    build fails.
  - **R28** Rolling batches: no fixed cut-off; the next gate starts when the last one ends, with
    whatever is READY, plus a 15-minute grace.
  - **R29** Stacked work: a branch may be built on an unfolded READY branch and fold in the same
    batch; if the base drops, the stacked branch drops too.
  - **R30** Owners' type check is incremental (`gate-tsc.mjs`); the gate keeps a full, clean tsc.
  - **R31** Owners run only the tests that use their changed files (`related-tests.mjs`), never a
    full suite of their own; the batch gate covers the rest.
- **Why:** Remove waits and duplicate runs at a small, stated cost.

## D-13. Tooling tests in batch gates (R32)

- **Date:** 25 September 2026, 13:07 UTC. **Decided by:** Josh ("apply more speed ups").
- **Decision:** **R32** In batch gates, tooling tests (tests of scripts, hooks and the gate itself,
  listed in `TOOLING_TESTS` in `scripts/check-ward-expected-reds.mjs`) run only when the batch
  changes scripts, hooks, package files, the test setup or tool config. Otherwise the gate prints
  "tooling tests skipped: no tooling change" with the list, and the night shift runs them on the
  line tip. Product guards that merely run a script are never on the list.
- **Why:** They are slow (real git fixtures) and cannot be affected by a product-only batch.

## D-14. Standing defaults: decide small things without asking

- **Date:** 25 September 2026. **Decided by:** Josh (approved the coordinator's speed audit).
- **Decision:** Where one of these covers a small choice, apply it and move on; ask only if none fits.
  - A blank or missing value shows "Not recorded", never a guess.
  - Fixtures record gender (and sex) for every made-up person.
  - Never guess a link between records; link only what the data holds.
  - Keep the current layout and design exactly (R4).
  - Made-up patients only (R6); no computed legal limits (R5).
- **Why:** Fewer round trips through the coordinator for choices Josh has already made in general.

## D-15. Rulings of 25 September, 13:26 (R33 to R35)

- **Date:** 25 September 2026, 13:26 UTC. **Decided by:** Josh ("implement all recommendations").
- **Decision:**
  - **R33** Journeys start from a prepared browser state (demo state injected before the page loads)
    in specs that are not testing setup; one dedicated spec per setup flow keeps setup covered.
  - **R34** The gate's type check covers Ward Flow code and tests plus everything they import
    (`tsconfig.ward-gate.json`, about 1,400 of 3,600 files). The full-app check runs nightly; a
    nightly error blocks the next fold until fixed.
  - **R35** Vitest `isolate: false` for a pure-logic subset only, after 3 identical runs prove the
    same pass list as isolated.
- **Why:** Shorter gates; the parts left out are covered nightly or proved equal first.

## D-16. Legal overrides and form receipts, 25 September 13:51 UTC

- **Date:** 25 September 2026, 13:51 UTC. **Decided by:** Josh ("all yes").
- **Decision:**
  - Ward authorisation for an involuntary patient is never overridable. `OVERRIDE_LEGAL_MISMATCH`
    (added 22 Sept, no screen used it) is removed; recording a mismatch (`FLAG_LEGAL_MISMATCH`)
    stays. Removed code kept on `backup/2026-09-25-legal-mismatch-override`.
  - A legal-form receipt may be recorded against any of the nine receivable legal forms, not only
    Form 1A (the 23 Sept widening, 6eec76bd85, is accepted).
- **Why:** The override contradicted the authorisation gate the engine already treats as fixed; the
  receipt widening matches the rule that every legal time is typed from the form and not legally
  checked.

## D-17. Morning roll-up time is Josh's own default (25 September)

- **Date:** 25 September 2026, 15:15 UTC. **Decided by:** Josh (answer A, "yes to all recommendations").
- **Decision:** The morning roll-up time of 09:30, adjustable from 08:00 to 11:00 in 15-minute steps,
  is Josh's own ward-practice default. It is not a Mental Health Act figure or any other legal time
  limit. The constants are renamed `MORNING_ROLLUP_TIME_MINUTES` and
  `MORNING_ROLLUP_TIME_RANGE_MINUTES` (from `_DEADLINE_`), and the legal-figure guard records this
  answer as their provenance. The guard itself is not widened.
- **Why:** The guard refuses any figure in the model with no named human source, and bans
  `_DEADLINE_` names there so an operational time is never read as statutory.

## D-18. The privacy lock stops saving only for typed text (25 September)

- **Date:** 25 September 2026, evening (Perth). **Decided by:** Josh ("Only for typed text").
- **Decision:** Saving to the browser stops only when someone types free text. A refused action no
  longer stops saving: refusals keep saving, but the saved copy carries no refusals, so a refusal's
  quoted id never reaches the device, and loading still rejects any stored refusal. Typed text stays
  off the device as before.
- **Why:** A refusal locked the whole session's saving though it held no typed text. A read-only
  privacy recheck against the 17 September finding found no new risk.

## D-19. Rulings of 25 September, evening (walkthrough, leave beds, PsychSift, gender display)

- **Date:** 25 September 2026, evening (Perth). **Decided by:** Josh ("yes to all recommendations",
  15:15 UTC, and his answers to the coordinator's cards that evening).
- **Decision:**
  - Armadale leave beds WL-RD07 and WL-RD08 are kept, each linked to a named patient.
  - "Move the date" is left off.
  - The Command referral panel keeps its summary.
  - Sample history is labelled "Example history".
  - Where screens disagree about a discharge, the discharge record is the truth.
  - The involuntary discharge guard's mismatched label is fixed.
  - The side rail's bed counts match the board.
  - The delays badge and tab read "at a time limit or with nowhere to go".
  - The transport officer sees patient names.
  - Sample patient WF-003 is fixed.
  - The SCGH and FSH mixed wards with no locked beds go on the list to confirm before the pilot.
  - Removing the legal-mismatch override and recording receipts on the nine legal forms: see D-16.
  - PsychSift: keep only what Ward Flow requires, uses or finds useful; remove the rest.
  - R7 display: gender identity is shown beside sex on the ward screens, the referral board, the bed
    board and the referral details a ward opens (Q2 and the 13:11 UTC card, "Show").
- **Why:** Josh's answers to the live walkthrough and the coordinator's cards; recorded here so no
  session asks again.

## D-20. One high-contrast colour check retired (26 September)

- **Decision:** Josh chose "Retire" (decision card, 25 Sept 16:39 UTC): the search page's check
  "does repointing --ward-border under forced colours change what is painted?" is archived with a
  written reason, nothing deleted, nothing else changes.
- **Why:** a shared token layer (since 5 Sept) sets both border tokens to the same value on every
  Ward Flow screen, measured on 26 Sept, so the check could only ever read "identical" and measured
  nothing. Archive and measurement:
  `docs/ward-flow/archive/retired-tests/2026-09-26-forced-colours-ward-border-probe.md`.
- **Left open:** whether the screen-local forced-colours repoint blocks are now dead code.

## D-21. Coordinator bed board: all nine recommended answers (26 September)

- **Date:** 26 September 2026, 00:53 Perth. **Decided by:** Josh ("go ahead with all recommendations").
- **Decision:** 1A the bed board lives in the existing Capacity screen; 2A urgency shows as recorded,
  with no time targets; 3A out of service, discharges held up and locked stay separately named; 4A HDU
  is left off until Josh defines it; 5A an out-of-service bed says its reason is not recorded; 6A no bay
  or room needs on queue cards; 7A queue cards keep today's words; 8A Capacity shows discharges due
  today and transfers today per ward, with "Not recorded" where unknown; 9A "Coordinator to review"
  shows as a flag on the queue card.
- **Why:** Show only what is recorded, keep the approved layout, and add no invented targets or words.
  The question list and options are in `ward-flow-logs/drafts/bed-board-decisions-2026-09-26.md`.

## D-22. No legal limits in hour rules; the rest are labelled defaults (26 September)

- **Date:** 26 September 2026. **Decided by:** Josh ("1A … go ahead with this please"; "yes to both";
  "yes to all recommendations" for 2A).
- **Decision:**
  - Any hour rule that claims a legal limit comes out. Where it is unclear whether a rule is a legal
    limit or an operational default, it comes out too and is listed for Josh's review (2A).
  - Every other hour or percentage rule becomes a labelled default, "your default, not a legal
    limit", like the 9:30 morning roll-up. They live in one module,
    `src/components/ward-management/ward-operational-defaults.ts`, with the values the screens used
    before, and the settings screen lists them read-only. Making them adjustable is later work.
  - The word "breach" is removed from everything a user sees or hears. Internal names are unchanged.
  - A guard test stops "breach", made-up figures and typed hour limits creeping back.
- **Why:** The screens stated legal limits the software never checked, and called operational
  thresholds breaches.

## D-23. Leave-bed fields kept; patient search stops matching by ward (26 September)

- **Date:** 26 September 2026, about 04:59 Perth. **Decided by:** Josh ("Yes both", to the
  coordinator's two questions).
- **Decision:**
  - Leave beds keep their kind (off-ward or medical trip) and the warning when leave has been open
    24 hours. The 24 hours is labelled as Josh's own default, not a legal limit, in the same style as
    the morning roll-up (D-17).
  - Patient search no longer matches a person through the referrals and movements linked to them.
    Typing a ward's name had listed everyone accepted there, which disclosed where a person was
    referred (it came in with 5d7f438126). Search matches the person's own record only.
- **Why:** The leave-bed fields name no patient and are useful; the search behaviour was a privacy
  leak nobody had ruled on.

## D-24. Hour-rules morning list: all A (26 September)

- **Date:** 26 September 2026, 01:42 UTC. **Decided by:** Josh ("Yes to all recommendation", answering
  "Hour rules: all A?").
- **Decision:** the six items taken out under D-22's 2A rule, settled:
  1. The 24-hour hospital wait comes back as Josh's default (`LONG_WAIT_MINUTES`), worded "Waiting over
     24 hours", in a neutral colour, labelled "your default, not a legal limit", with no "breach" and no
     "standard".
  2. The 12-hour handover flag stays out.
  3. The capacity tracker's "statutory deadline" alarm stays out.
  4. The morning census keeps "your morning roll-up, your default, not a legal limit".
  5. The Delays "Over 24 hours" group is plain grey. Josh overrode 5A on a card (01:47 UTC): "Neutral:
     plain grey like the other groups; no hint of a limit." The same neutral colour applies to
     "Waiting over 24 hours" everywhere (item 1).
  6. Superseded by the neutral card: no 24-hour line is drawn on the Delays chart ("no hint of a
     limit").
- **Also (question 14, "Yes to both"):** the 85% occupancy target, the 90% WEAT target and the ACEM
  8-hour target lines come off the screens until they have a source.
- **Also (card, 02:35 UTC):** the 1-hour and 3-hour warnings before a recorded legal due time stay as
  Josh's defaults (`DUE_SOON_URGENT_MINUTES`, `DUE_SOON_MINUTES`), labelled "your default, not a legal
  limit" and listed in Settings. Making them changeable in Settings is the same later work as the other
  defaults.
- **Why:** a long wait is worth seeing, but only as Josh's own threshold, never as a law.

## D-25. The lone-patient check counts free beds on both matching paths (26 September)

- **Date:** 26 September 2026, 02:26 UTC. **Decided by:** the coordinator's brief (Fix 2), applying the
  rule the referral path already followed (fix round C, F3); no new rule.
- **Decision:** the movement path's `sex_mix` check now reads free beds, `min(allocatable, empty)`,
  exactly as the referral path does, so a ward with 3 allocatable beds but 1 empty no longer passes it.
  Nothing else changes: the movement path's `allocatable_bed` check still reads `allocatable`.

## D-26. Select fold checks by changed risk (27 September)

- **Date:** 27 September 2026. **Decided by:** Josh ("overhaul this now and make it significantly more
  efficient" and avoid excessive heavy testing).
- **Decision:** `select-fold-gate.mjs` assigns STATIC, FOCUSED or FULL from the changed paths. Local
  tooling uses its focused contracts, Ward screens use focused unit and selected browser checks,
  and shared behaviour, test infrastructure, executable/test deletions and unknown scope use FULL.
  The complete offline suite runs once daily on the ward line as well. Reuse passing checks on an
  identical merged tree. Start batches with branches already READY; do not wait 15 minutes for a
  promised branch. This replaces D-5's blanket retest, R24's grace, R25's engine fast lane, R28's
  grace, R31's assumption that every branch waits for a full batch suite, and R38/R39/R48's former
  blanket check wording. The fold lock, backup, diff inspection and local-only boundary remain.
- **Why:** On 27 September, a three-file queue-tool change passed its four related merged-tree tests
  but then waited over 14 minutes in a roughly 9,600-test fold suite. The full suite did not target
  a plausible additional failure path for that change and blocked the shared wide slot.

## D-27. Ward Flow uses its dedicated repository (28 September)

- **Date:** 28 September 2026. **Decided by:** Josh.
- **Decision:** `BigSimmo/Ward-Flow` is the sole GitHub repository for current Ward Flow work. Use
  an isolated worktree based on its `main` and verify `git remote get-url origin` before any Git
  write or publication. `D:\Worktrees\Database\ward-lead` and `BigSimmo/Database` are legacy
  sources, not destinations for this project. Pushes, pull requests, merges and deployments remain
  separate actions requiring their applicable authorisation and checks. This supersedes D-1's
  local-only and no-linked-repository directions and R1's no-GitHub direction; their historical
  record remains above.
- **Why:** The old shared checkout pointed at PsychSift. Its instructions caused Ward Flow work to
  be aimed at the wrong repository. A verified dedicated repository prevents that mix-up.

## D-28. Design Modernization & Anti-Box Architecture (30 September 2026)

- **Date:** 30 September 2026. **Decided by:** Josh ("I approve these 7 recommendations").
- **Decision:** The 7 rigid design rules that caused repetitive boxy styling, clumsy accordion layout shifts, and artificial UI bloat are modernized:
  1. **Floating Dynamic Island HUD (0 Clicks, 0 Layout Shift):** The Standing Figures rule is modernized. Alarms remain 0-clicks away in a persistent header HUD that dynamically expands and pulses on active alerts, replacing the bulky accordion dropdown panel that shoved page content down.
  2. **Visual Priority Triage, No Runtime Crash:** The fatal runtime throw in `WardFigureStrip` (`flagged > 2`) is eliminated. Multiple alerts are handled gracefully with visual triage (highlighting primary breach + aggregate counter); the application never crashes on clinical alert surges.
  3. **Accessible Smart Badges:** Compact icon + number pills are authorized, paired with full screen-reader accessibility labels (`aria-label`) and progressive disclosure tooltips rather than forcing verbose sentences onto button faces.
  4. **Micro-Typography Exemption (10px–11px):** A scoped exemption to D-3's 12px floor is granted for uppercase, letter-spaced, high-contrast auxiliary metadata and telemetry tags (e.g. `HDU`, `OVERRIDES`, `CH 1`), keeping patient data and numbers >= 12px.
  5. **Subtle 2px Left Hairlines & Status Pips:** Fine left-border accent lines and status pips are authorized for clinical urgency indicators, removing the need to wrap metrics in heavy, full-bordered card boxes.
  6. **Anti-Box Modernization Authorized:** Rule R4 is amended with an official owner authorization: design modernization to replace outdated rectangular card boxes with dynamic HUDs, natural language statements, and clean Swiss layouts is approved across Ward Flow.
  7. **Fluid Inline Strips & Narrative Stacks:** Rigid 2/3/5-column metric grids (`.figureStrip`) may be replaced with flexible horizontal strips, natural language executive sentences, and adaptive inline pills.
- **Why:** The previous rules created a rigid design straitjacket where developers were forced into boxy cards, verbose buttons, and layout shifts to avoid breaking dogmatic rules.

## D-29. Act time limits shown as a labelled synthetic demo (4 October 2026)

- **Date:** 4 October 2026. **Decided by:** Josh (item 13 thread: "Go ahead for act drafting task",
  then "Ok I give permission" after reviewing the draft of the Act time limits).
- **Decision:** This narrows D5 for one purpose. The Legal forms screen may show the Mental Health
  Act period for a recorded form, with its section reference. It is labelled "Synthetic demo, not
  legally checked" and counts down from the written time a person typed. Only periods with a written
  source appear. They are held in one file,
  `src/components/ward-management/legal-forms/act-periods-demo.ts`, and the section-citation guard
  exempts that file and its test only. The typed expiry from the paper form stays the record, and
  the engine still never writes a computed `dueAt`. Forms 1B and 3D have no period until a source is
  confirmed. Everything else in D5 is unchanged.
- **Why:** Josh asked for statutory countdowns as a clearly labelled synthetic demo. The WA legal
  review on the "before any real patient" list is still required before any real use.

## D-30. Central Coordinator Approval for Inter-Ward Bed Transfers (6 October 2026)

- **Date:** 6 October 2026. **Decided by:** Josh (product owner & psychiatrist).
- **Decision:** Inter-ward patient transfers between hospitals/facilities must receive central bed coordinator approval and visibility; direct uncoordinated ward-to-ward transfers are not permitted in the matching engine. Direct community clinic referrals (e.g. Alma Street, Stirling Clinic) are deferred to Phase 2 (resolving WF-15 / DECISION-03).
- **Why:** Uncoordinated transfers between hospital wards bypass the statewide acute bed allocation queue, creating blind spots for ED patients awaiting urgent admission. Central coordinator oversight ensures equitable allocation based on statewide clinical acuity.

## D-31. Gender-Diverse Bed Placement Policy & Clinical Override Safety (6 October 2026)

- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** Automatic algorithmic room placement for gender-diverse or non-binary patients is deferred. The bed-matching engine retains gender eligibility rules in `ward-eligibility.ts` (Female, Male, Non-binary, Different term, Not recorded) and alerts the coordinator when a patient's gender identity requires individual room accommodation (e.g. single room with ensuite vs shared bay). Placement requires explicit clinician review, multi-disciplinary agreement, and documented clinical rationale (resolving WF-30 / DECISION-05).
- **Why:** Algorithmic assignment of shared multi-bed bays carries clinical, cultural, and psychological safety risks. Human clinical judgment must govern individual bed assignments while honoring patient identity and ward physical layout.

## D-32. FIFO Waiting Time with Clinical Triage Badging vs Algorithmic Urgency Sorting (6 October 2026)

- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** The emergency referral queue defaults to sorting by waiting time (FIFO) with prominent, standardized ATS Triage Category badges (1–5) and clinical urgency flags displayed on each row. Pure automated algorithmic re-ordering by urgency or predictive wait times is deferred (resolving WF-32 / DECISION-07).
- **Why:** Pure algorithmic re-sorting creates clinical bias, gaming, and "black box" queue jumping that obscures how long lower-acuity patients have been waiting in emergency departments. Clinicians and bed managers require transparent, chronological visibility with clear acuity visual aids to make defensible allocation decisions.

## D-33. Separation of Local Ward Shift Notes from Statewide Coordinator Telemetry (6 October 2026)

- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** Local nursing and medical shift notes recorded on the Handover screen remain strictly local to that ward's operational view. Only standardized operational telemetry—patient transfer status, departure/arrival timestamps, clinical alert flags (e.g., falls risk, 1:1 nursing requirement), and statutory MHA form statuses—are published to the central statewide coordinator (resolving WF-41 / DECISION-06).
- **Why:** Granular nursing observations and shift handovers contain sensitive, point-in-time clinical observations intended for direct bedside care. Publishing raw nursing notes statewide creates privacy exposure and information overload for central coordinators, who need concise operational facts.

## D-34. Acute Medical Deterioration Bed Release and Escalation Protocol (6 October 2026)

- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** When an emergency department patient accepted for psychiatric admission acutely deteriorates medically prior to transport, the bed allocation must be formally cancelled. The reserved inpatient bed is immediately released back to the statewide pool, tagged with the audit record "Medical Deterioration - ED Resuscitation Required", and the psychiatric referral is paused until medical stabilization and clinical re-clearance (resolving WF-43).
- **Why:** An acute medical emergency (e.g. overdose complications, sepsis, respiratory distress) takes absolute precedence over psychiatric transfer. Holding an inpatient psychiatric bed while a patient undergoes medical resuscitation blocks another waiting psychiatric patient from accessing care.

## D-35. Deferral of Regional Multi-Leg Transport & RFDS Repatriation (6 October 2026)

- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** Regional multi-leg patient journeys (e.g., Kimberley, Pilbara, or Goldfields transport involving Royal Flying Doctor Service flights and secondary road ambulances) are formally deferred to the post-pilot regional expansion phase. The current prototype models metropolitan road transport via St John WA Patient Transfer (resolving WF-45).
- **Why:** Regional aeromedical transfers involve complex flight logistics, weather delays, and multi-agency coordination that would add excessive complexity to the core metropolitan prototype demonstration.

## D-36. Affirmation of External Governance & Clinical Safety Hard Gates (6 October 2026)

- **Date:** 6 October 2026. **Decided by:** Josh (affirming Item 63 ruling of 17 September 2026).
- **Decision:** The 10 external human, legal, and ethical governance gates remain formally parked hard gates until the prototype progresses toward production readiness and before ANY real patient data or live EHR connection is permitted (resolving WF-29, WF-31/56, WF-33, WF-44, WF-46, WF-53–WF-57 per Item 63):
  - WF-29: External Privacy & Multi-Tenant Azure Entra ID isolation.
  - WF-31 & WF-56: WA Crown Law formal legal sign-off on Mental Health Act statutory forms.
  - WF-33: Production multi-tenant cloud database connection and disaster recovery.
  - WF-44: Live phone-verified statewide mental health service directory.
  - WF-46: Formal appointment of an Australian Clinical Safety Officer (CSO) and live hazard log.
  - WF-53: Independent Aboriginal Cultural Safety Review commissioned by Josh.
  - WF-54: TGA Medical Device (SaMD) regulatory classification.
  - WF-55: Formal External Privacy Impact Assessment (PIA).
  - WF-57: Post-Incident Review (PIR) forensic audit logging standard.
- **Why:** These activities require external institutional, legal, and regulatory processes that cannot be simulated or solved in code. They are intentionally decoupled from the demonstration prototype per the Prototype Operating Mode.

## D-37. External Governance Hard Gate Operational Postures & Resolution Roadmap (6 October 2026)

- **Date:** 6 October 2026. **Decided by:** Josh (product owner & psychiatrist).
- **Decision:** Following full review of the 10 parked external governance gates (Item 63 and Decision D-36), formal operational postures, clinical standards, and resolution pathways are ratified across all 9 domains:
  1. **WF-29 (External Privacy & Service-Scoped Authority):** Ratified 4-tier Role-Based Access Control (RBAC) specification: (1) Statewide Bed Coordinator, (2) Inpatient Nurse Unit Manager / Bed Manager, (3) ED Psychiatric Liaison Clinician, (4) Executive / Operations Viewer. Local demonstrations continue using mock role simulation; Entra ID SSO will map directly to these 4 roles during live hospital hosting commissioning.
  2. **WF-31 & WF-56 (WA Crown Law Legal Advice on Forms & Statutory Limits):** Ratified the "Advisory Notice Only" doctrine. Software displays advisory timers and countdown alerts based strictly on clinician-recorded timestamps; software never computes binding legal expiry or automatically alters/detains/discharges a patient under the WA _Mental Health Act 2014_. Physical signed statutory forms remain authoritative. Involuntary placements (`Form 5A`) remain strictly locked to gazetted authorised hospital beds. Pre-drafted compliance pack (`docs/ward-flow/governance/WA-MENTAL-HEALTH-ACT-COMPLIANCE.md`) approved for State Solicitor's Office / Office of the Chief Psychiatrist submission.
  3. **WF-33 (Authoritative Multi-Tenant Persistence & Live Cloud Recovery):** Ratified cloud database deferral standard (affirming D-18). Backend Azure code and optimistic concurrency control (`expectedRevision`) are complete and verified; live cloud database connection remains parked until Health Service Provider pilot funding and dedicated GovNext network commissioning. Local JSON scenario persistence remains active for demonstrations.
  4. **WF-44 (WA Health Verified Service Directory):** Ratified "Advisory Directory with Coordinator Override" standard. The transcribed 2026 WA Health catchment schedule (~537 suburbs and catchments) is adopted as the demonstration baseline; live clinic-by-clinic phone audit is parked until site onboarding. Bed coordinators may manually assign out-of-catchment clinics by recording an auditable reason flag.
  5. **WF-46 (Clinical Safety Officer & Live Hazard Log):** Ratified Clinical Safety Case (`docs/ward-flow/governance/CLINICAL-SAFETY-CASE.md`) as the formal baseline. Josh acts as Clinical Sponsor / Lead Psychiatrist; Hazards HAZ-01 through HAZ-05 are actively mitigated in code; formal appointment of an external certified Australian CSO (or Health Service Clinical Governance Unit) is scheduled as an entry gate prior to real-patient clinical pilot.
  6. **WF-53 (Aboriginal Cultural Safety Review):** Ratified Aboriginal Cultural Safety Charter (`docs/ward-flow/governance/ABORIGINAL-CULTURAL-SAFETY-CHARTER.md`). The review is formally retained as an independent external engagement commissioned directly by Josh with Derbarl Yerrigan, WACHS Aboriginal Health Strategy, AHCWA, and Aboriginal Lived Experience representatives when real-world deployment is planned.
  7. **WF-54 (Medical Device TGA / SaMD Classification):** Ratified TGA Clinical Decision Support Software (CDSS) Exemption Position. Ward Flow is an operational bed-coordination tool, does not automate diagnosis or therapy, does not process raw physiological signals, and requires independent clinician verification for all placement decisions (per D-31). Class I/IIa SaMD registration is not required under Schedule 4, Part 2 of the _Therapeutic Goods (Medical Devices) Regulations 2002_.
  8. **WF-55 (External Privacy Impact Assessment):** Ratified Privacy Architecture Standard. 100% synthetic patient isolation guaranteed; data minimisation on public flight decks and ward boards (Bed ID, initials, age, gender code, legal status only); detailed clinical notes restricted to authenticated role-scoped views. External legal PIA scheduled during hospital IT onboarding.
  9. **WF-57 (Post-Incident Review Architectural Scope):** Ratified PIR Immutable Telemetry Specification. The system captures append-only timeline events under Invariants I-01 through I-14 (recording occurrence, dispatch, and commit timestamps, user ID, prior state, new state, and clinician override reasons). A single-click "PIR Chronology Export" standard is adopted to supply tamper-evident chronologies for hospital clinical incident reviews (SAC 1) and Coronial inquiries.
- **Why:** Replaces passive parking with definitive, clinically and legally defensible governance standards across all 10 items, establishing complete pre-pilot governance readiness.
