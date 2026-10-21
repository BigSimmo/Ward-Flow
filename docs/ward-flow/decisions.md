# Ward Flow — decision log

A short record of project-level decisions: how the work is run, what is in and out of scope, and
where the product is going. Newest at the bottom. Detailed clinical and product rulings on how a
screen or the engine behaves stay in [`OWNER-RULINGS.md`](OWNER-RULINGS.md); this log points there
when a decision here depends on one.

**How to add an entry.** Add a numbered entry at the bottom with the date, who decided, the
decision in one or two sentences, and why. Never rewrite an old entry. If a decision is reversed,
add a new entry that says which one it replaces, and mark the old one "Replaced by D-n".

_Updated 2026-10-22 - added D-72 to D-77 (21 October fix plan, merge safeguards, owner answers, UX audit follow-up, community gaps and the bigger UX changes); Documentation owns. Historical decision text and dates preserved._

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
- **Subsequent approval:** The Railway disconnection/no-hosting position was superseded by the
  [owner-approved hosting setup record of 27 September 2026](../hosting.md). Its Ward Flow-only
  resource boundaries apply; provider and deployment actions remain ask-first under `AGENTS.md`.

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
- **Subsequent exception (17 October 2026):** D-67 permits session draft recovery for the explicitly opted-in synthetic referral and legal forms. The general typed-event state saving lock remains unchanged.

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

**8 October implementation scope note:** The owner subsequently requested and approved
implementation of the audit remediation backlog, including CAP-001's expected-discharge
editor. Local implementation now uses the existing guarded date event. This records the
new task scope without changing the historical ruling or treating the earlier deliberate
omission as a confirmed accidental defect. No wider intervention or forecasting policy
is inferred.

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
  4. **Micro-Typography Exemption (10px–11px):** **Replaced by [D-42](#d-42-12px-typography-floor-with-no-uppercase-exception-reaffirmed-in-design-system-v9-910-october-2026); original decision retained below.** A scoped exemption to D-3's 12px floor is granted for uppercase, letter-spaced, high-contrast auxiliary metadata and telemetry tags (e.g. `HDU`, `OVERRIDES`, `CH 1`), keeping patient data and numbers >= 12px.
  5. **Subtle 2px Left Hairlines & Status Pips:** Fine left-border accent lines and status pips are authorized for clinical urgency indicators, removing the need to wrap metrics in heavy, full-bordered card boxes.
  6. **Anti-Box Modernization Authorized:** Rule R4 is amended with an official owner authorization: design modernization to replace outdated rectangular card boxes with dynamic HUDs, natural language statements, and clean Swiss layouts is approved across Ward Flow.
  7. **Fluid Inline Strips & Narrative Stacks:** Rigid 2/3/5-column metric grids (`.figureStrip`) may be replaced with flexible horizontal strips, natural language executive sentences, and adaptive inline pills.
- **Why:** The previous rules created a rigid design straitjacket where developers were forced into boxy cards, verbose buttons, and layout shifts to avoid breaking dogmatic rules.

## D-29. Act time limits shown as a labelled synthetic demo (4 October 2026)

- **Date:** 4 October 2026. **Replaced by D-70** (20 October 2026). **Decided by:** Josh (item 13 thread: "Go ahead for act drafting task",
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
- **Decision:** Inter-ward patient transfers between hospitals/facilities must receive central bed coordinator approval and visibility; direct uncoordinated ward-to-ward transfers are not permitted in the matching engine. Direct community clinic referrals (e.g. Alma Street, Stirling Clinic) are deferred to Phase 2 (resolving DECISION-03).
- **Why:** Uncoordinated transfers between hospital wards bypass the statewide acute bed allocation queue, creating blind spots for ED patients awaiting urgent admission. Central coordinator oversight ensures equitable allocation based on statewide clinical acuity.

## D-31. Gender-Diverse Bed Placement Policy & Clinical Override Safety (6 October 2026)

- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** Automatic algorithmic room placement for gender-diverse or non-binary patients is deferred. The bed-matching engine retains gender eligibility rules in `ward-eligibility.ts` (Female, Male, Non-binary, Different term, Not recorded) and alerts the coordinator when a patient's gender identity requires individual room accommodation (e.g. single room with ensuite vs shared bay). Placement requires explicit clinician review, multi-disciplinary agreement, and documented clinical rationale (resolving DECISION-05).
- **Why:** Algorithmic assignment of shared multi-bed bays carries clinical, cultural, and psychological safety risks. Human clinical judgment must govern individual bed assignments while honoring patient identity and ward physical layout.

## D-32. FIFO Waiting Time with Clinical Triage Badging vs Algorithmic Urgency Sorting (6 October 2026)

- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** The emergency referral queue defaults to sorting by waiting time (FIFO) with prominent, standardized ATS Triage Category badges (1–5) and clinical urgency flags displayed on each row. Pure automated algorithmic re-ordering by urgency or predictive wait times is deferred (resolving DECISION-07).
- **Why:** Pure algorithmic re-sorting creates clinical bias, gaming, and "black box" queue jumping that obscures how long lower-acuity patients have been waiting in emergency departments. Clinicians and bed managers require transparent, chronological visibility with clear acuity visual aids to make defensible allocation decisions.

## D-33. Separation of Local Ward Shift Notes from Statewide Coordinator Telemetry (6 October 2026)

- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** Local nursing and medical shift notes recorded on the Handover screen remain strictly local to that ward's operational view. Only standardized operational telemetry—patient transfer status, departure/arrival timestamps, clinical alert flags (e.g., falls risk, 1:1 nursing requirement), and statutory MHA form statuses—are published to the central statewide coordinator (resolving DECISION-06).
- **Why:** Granular nursing observations and shift handovers contain sensitive, point-in-time clinical observations intended for direct bedside care. Publishing raw nursing notes statewide creates privacy exposure and information overload for central coordinators, who need concise operational facts.

## D-34. Acute Medical Deterioration Bed Release and Escalation Protocol (6 October 2026)

- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** When an emergency department patient accepted for psychiatric admission acutely deteriorates medically prior to transport, the bed allocation must be formally cancelled. The reserved inpatient bed is immediately released back to the statewide pool, tagged with the audit record "Medical Deterioration - ED Resuscitation Required", and the psychiatric referral is paused until medical stabilization and clinical re-clearance.
- **Why:** An acute medical emergency (e.g. overdose complications, sepsis, respiratory distress) takes absolute precedence over psychiatric transfer. Holding an inpatient psychiatric bed while a patient undergoes medical resuscitation blocks another waiting psychiatric patient from accessing care.

## D-35. Deferral of Regional Multi-Leg Transport & RFDS Repatriation (6 October 2026)

- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** Regional multi-leg patient journeys (e.g., Kimberley, Pilbara, or Goldfields transport involving Royal Flying Doctor Service flights and secondary road ambulances) are formally deferred to the post-pilot regional expansion phase. The current prototype models metropolitan road transport via St John WA Patient Transfer.
- **Why:** Regional aeromedical transfers involve complex flight logistics, weather delays, and multi-agency coordination that would add excessive complexity to the core metropolitan prototype demonstration.

## D-36. Affirmation of External Governance & Clinical Safety Hard Gates (6 October 2026)

- **Date:** 6 October 2026. **Decided by:** Josh (affirming Item 63 ruling of 17 September 2026).
- **Decision:** The 10 external human, legal, and ethical governance gates remain formally parked hard gates until the prototype progresses toward production readiness and before ANY real patient data or live EHR connection is permitted (per Item 63):
  - External Privacy & Multi-Tenant Azure Entra ID isolation.
  - WA Crown Law formal legal sign-off on Mental Health Act statutory forms and statutory limits.
  - Production multi-tenant cloud database connection and disaster recovery.
  - Live phone-verified statewide mental health service directory.
  - Formal appointment of an Australian Clinical Safety Officer (CSO) and live hazard log.
  - Independent Aboriginal Cultural Safety Review commissioned by Josh.
  - TGA Medical Device (SaMD) regulatory classification.
  - Formal External Privacy Impact Assessment (PIA).
  - Post-Incident Review (PIR) forensic audit logging standard.
- **Why:** These activities require external institutional, legal, and regulatory processes that cannot be simulated or solved in code. They are intentionally decoupled from the demonstration prototype per the Prototype Operating Mode.

## D-37. External Governance Hard Gate Operational Postures & Resolution Roadmap (6 October 2026)

> **Implementation clarification — 8 October 2026 (evidence, not a new owner ruling):**
> D-37 records intended standards and internal adoption. It does not constitute
> institutional, legal or TGA approval. Local roles are simulated, not authenticated
> staff accounts; the private Azure snapshot service is not shared service persistence;
> runtime logs are mutable and do not provide authenticated tamper-evident PIR exports.
> D-18 stops browser persistence after typed-text events. The current legal forms
> mapping identifies Form 5A as a community treatment order and Forms 6A/6B as
> inpatient treatment orders; the earlier 5A inpatient wording below is corrected.
> TGA exclusion/exemption applicability requires a function-scoped intended-purpose
> assessment; an excluded function and an exempt medical device have different duties.
> See [production-readiness evidence](governance/PRODUCTION-READINESS.md).

- **Date:** 6 October 2026. **Decided by:** Josh (product owner & psychiatrist).
- **Decision:** Following full review of the 10 parked external governance gates (Item 63 and Decision D-36), formal operational postures, clinical standards, and resolution pathways are ratified across all 9 domains:
  1. **External Privacy & Service-Scoped Authority:** Ratified 4-tier Role-Based Access Control (RBAC) specification: (1) Statewide Bed Coordinator, (2) Inpatient Nurse Unit Manager / Bed Manager, (3) ED Psychiatric Liaison Clinician, (4) Executive / Operations Viewer. Local demonstrations continue using mock role simulation; Entra ID SSO will map directly to these 4 roles during live hospital hosting commissioning.
  2. **WA Crown Law Legal Advice on Forms & Statutory Limits:** Ratified the "Advisory Notice Only" doctrine. Software displays advisory timers and countdown alerts based strictly on clinician-recorded timestamps; software never computes binding legal expiry or automatically alters/detains/discharges a patient under the WA _Mental Health Act 2014_. Physical signed statutory forms remain authoritative. Involuntary inpatient placements (`Forms 6A/6B`; Form 5A is a community treatment order) remain strictly locked to gazetted authorised hospital beds. Pre-drafted compliance pack (`docs/ward-flow/governance/WA-MENTAL-HEALTH-ACT-COMPLIANCE.md`) approved for State Solicitor's Office / Office of the Chief Psychiatrist submission.
  3. **Authoritative Multi-Tenant Persistence & Live Cloud Recovery:** Ratified cloud database deferral standard (affirming D-18). Backend Azure code and optimistic concurrency control (`expectedRevision`) are complete and verified; live cloud database connection remains parked until Health Service Provider pilot funding and dedicated GovNext network commissioning. Local JSON scenario persistence remains active for demonstrations.
  4. **WA Health Verified Service Directory:** Ratified "Advisory Directory with Coordinator Override" standard. The transcribed 2026 WA Health catchment schedule (~537 suburbs and catchments) is adopted as the demonstration baseline; live clinic-by-clinic phone audit is parked until site onboarding. Bed coordinators may manually assign out-of-catchment clinics by recording an auditable reason flag.
  5. **Clinical Safety Officer & Live Hazard Log:** Ratified Clinical Safety Case (`docs/ward-flow/governance/CLINICAL-SAFETY-CASE.md`) as the formal baseline. Josh acts as Clinical Sponsor / Lead Psychiatrist; Hazards HAZ-01 through HAZ-05 are actively mitigated in code; formal appointment of an external certified Australian CSO (or Health Service Clinical Governance Unit) is scheduled as an entry gate prior to real-patient clinical pilot.
  6. **Aboriginal Cultural Safety Review:** Ratified Aboriginal Cultural Safety Charter (`docs/ward-flow/governance/ABORIGINAL-CULTURAL-SAFETY-CHARTER.md`). The review is formally retained as an independent external engagement commissioned directly by Josh with Derbarl Yerrigan, WACHS Aboriginal Health Strategy, AHCWA, and Aboriginal Lived Experience representatives when real-world deployment is planned.
  7. **Medical Device TGA / SaMD Classification:** D-37 records an internal position, not a TGA determination. The classification remains pending a qualified assessor's review of each function, its intended purpose, claims and intended users against current TGA instruments, and a signed determination. Exclusion and exemption are distinct; an exempt clinical decision support software device remains a regulated device with applicable obligations. The internal position is that Ward Flow is an operational bed-coordination tool that does not automate diagnosis or therapy, does not process raw physiological signals, and requires independent clinician verification for all placement decisions (per D-31).
  8. **External Privacy Impact Assessment:** Ratified Privacy Architecture Standard. 100% synthetic patient isolation guaranteed; data minimisation on public flight decks and ward boards (Bed ID, initials, age, gender code, legal status only); detailed clinical notes restricted to authenticated role-scoped views. External legal PIA scheduled during hospital IT onboarding.
  9. **Post-Incident Review Architectural Scope:** Ratified PIR Immutable Telemetry Specification. The system captures append-only timeline events under Invariants I-01 through I-14 (recording occurrence, dispatch, and commit timestamps, user ID, prior state, new state, and clinician override reasons). A single-click "PIR Chronology Export" standard is adopted to supply tamper-evident chronologies for hospital clinical incident reviews (SAC 1) and Coronial inquiries.
- **Why:** Replaces passive parking with definitive, clinically and legally defensible governance standards across all 10 items, establishing complete pre-pilot governance readiness.

## D-38. Leave, absent without leave and CTO on the Patient page (9 October 2026)

- **Date:** 9 October 2026. **Decided by:** Josh, in the Patient page gate board session ("go
  ahead and do now", approving the engine change the build handed back).
- **Decision:** The Patient page shows On leave, Absent without leave and On a CTO as their own
  modes. On leave reads the existing leave bed on the stay (no new field). Absent without leave is
  recorded on that same held bed (`absentWithoutLeave`: when it was recorded and the time each of
  five fixed missing person steps was done), so no bed figure moves. A community treatment order is
  a new optional patient field, `communityTreatmentOrder` (Form 5A, when recorded and by which
  role). Four events carry them: `RECORD_ABSENT_WITHOUT_LEAVE` and `RECORD_ABSENCE_STEP` (ward),
  `RECORD_COMMUNITY_TREATMENT_ORDER` and `END_COMMUNITY_TREATMENT_ORDER` (community). Return from
  an absence uses the existing `END_LEAVE_BED`.
- **Limits:** Ids, fixed choices and times only, never typed text. No lapse or review time is held
  or computed for a CTO (D5). Next of kin, carer and guardian are still not on the record and stay
  labelled Preview.
- **Why:** The ward already has leave beds, but a missing person and a CTO could not be shown
  honestly without a field to read.

## D-39. Patients are identified by UMRN, never by a WF number (9 October 2026)

- **Date:** 9 October 2026. **Decided by:** Josh ("remove the old patient numbers you have
  everywhere, i.e. WF-005 ... replace them with UMRN ... and update docs to know this").
- **Decision:**
  - Every screen, drawer, feed, refusal and notice names a patient by **UMRN**. A `WF-...` number is
    never shown as the patient's number.
  - `WF-...` stays the internal id of one **journey** (a `Movement`): routes such as
    `/mockups/ward-flow/movements/WF-005`, React keys, `data-testid`s, engine events and fixtures.
    Renaming it would touch about 5,000 lines and every open pull request for no visible gain. It
    must not appear in visible text.
  - Read the UMRN through the D-14 resolver only: `movementUmrn` and `resolveSubjectPatient` in
    `ward-patient-resolver.ts`, or the `usePatientOf` and `useUmrnText` hooks in
    `ward-patient-name.ts` (ward screens use the provider's `resolvePatientIdentity`). Engine prose
    that quotes a journey id passes through `withUmrnInPlaceOfMovementIds` before it is shown;
    refusals are converted when they are raised. An unlinked, ambiguous or unknown journey shows
    "UMRN not recorded"; a refusal keeps the id in its `movementId` field for diagnosis. Pass the
    full records (referrals included, or a journey linked through a referral reads as unknown) and
    build that lookup once per render, because the resolver caches its index on the object.
  - **Synthetic UMRN format:** two letters `UM` then six digits, for example `UM100047`. A real WA
    UMRN is one letter then seven digits, so these can never be mistaken for a real patient, and
    the synthetic-data guard (`src/lib/synthetic-data-guard.ts`) does not flag them. Ranges: hand
    authored patients `UM1nnnnn`, generated patients `UM5nnnnn`, the rulings demo `UM60nnnn`, the
    demo network `UM7nnnnn`, the community demo cohort its own six digits.
  - **Update, 15 October 2026.** Decided by Josh ("you should have purged all these numberings
    from the site"). Referral (`RF-...`), patient (`PT-...`), admission (`AD-...`) and bed release
    (`WR-...`) numbers are now also kept off screens, toasts and accessible names. A screen names
    the person by name and UMRN, or says the record kind, such as "this referral". The ids stay in
    routes, keys, test ids, engine events and fixtures. Statistics screens keep admission ids
    because they deliberately show no patient identity.
  - **Addresses, 15 October 2026.** Decided by Josh ("Screens and addresses"). A link to a
    journey, person, referral or stay carries an address code that carries no record number. The
    same goes for query values that name a record. The code is made from the id itself, so a record
    added while the app runs gets a working link at once. Old links that still hold a raw id keep
    working: the movement and person pages send them on to the coded address with the query kept,
    and query readers accept either form. Refusals and notices say "this referral" or "this stay"
    in place of a record number, and the ids stay in their data fields. The code only keeps the
    number out of the address bar. It is not a privacy control.
  - Names and UMRNs come only from the resolver. When it has none, a screen shows "Name not
    recorded" and "UMRN not recorded". `patientIdentityLine` writes the shared "Family, Given ·
    UMRN" line.
- **Why:** Staff on shift search and hand over by UMRN. A journey number nobody else uses reads as
  a second patient number and invites mistakes.

## D-40. A second community treatment order keeps the first (9 October 2026)

- **Date:** 9 October 2026. **Decided by:** Josh ("take over and fix the CTO finding", PR #147).
- **Decision:** Recording a CTO after an earlier one has ended keeps the ended order. It moves into
  `earlier`, a list inside the same D-38 `communityTreatmentOrder` field, and Documents lists every
  earlier order as Closed. No new patient field is added. Each earlier order holds the same four
  facts as D-38 (Form 5A, when recorded, by which role, when ended) and nothing else.
- **Why:** Review found that a second CTO overwrote the first, so its Closed Form 5A vanished from
  Documents. Refusing a second order would have blocked a real re-order; a separate history field
  would have widened what the record holds.

## D-41. Delays board filters narrow the table and state the hidden count (9 October 2026)

- **Date:** 9 October 2026. **Decided by:** Josh.
- **Decision:** On the October 2026 Delays board, hero counts, whose-move tiles, chips and graph
  choices keep filtering the Waiting table, as the approved Delays page mockup draws it. Whenever a
  filter hides anyone, the table must say how many people are hidden and offer "Show everyone".
  For this board, this supersedes the 2026-09-07 "a chip highlights, it never hides" ruling. The
  old Delays table and graph components (`delays-data-views.tsx`, `delays-coordination.tsx` and
  their stylesheets) are deleted.
- **Why:** The mockup's narrowing is the approved behaviour. The hazard behind the September ruling
  (a filtered-out patient looking like a placed one) is closed by the stated hidden count, which
  `tests/ward-delays-screen.dom.test.tsx` guards.

## D-42. 12px typography floor with no uppercase exception reaffirmed in Design System v9 (9–10 October 2026)

- **Date:** 9–10 October 2026 (`2026-10-10`). **Decided by:** Josh (`design/v9/design-system-v9.md` §4 & §14, reaffirming O-15.1).
- **Decision:** The 12px minimum font-size floor holds across all Ward Flow surfaces with no uppercase exception. Five page type steps are used (`20px`, `15px`, `14px`, `13px`, `12px`, plus `28px` for sign-in and print only); `11px` and `16px` steps are retired (`--wf-fs-11` aliases `12px` and `--wf-fs-16` aliases `15px`). This supersedes D-28 item 4's temporary 10px–11px uppercase micro-typography exemption.
- **Why:** Sub-12px uppercase eyebrows, counts, tier pills and chart ticks failed readability on ward monitors and contradicted ruling O-15.1.

## D-43. Colour lives in glyphs and the hero; red means act now with a thin 1px edge, never a fill (9 October 2026)

- **Date:** 9 October 2026 (`2026-10-09`). **Decided by:** Josh (`design/v9/design-system-v9.md` §1, §3 & §14).
- **Decision:** Semantic tone lives in status glyphs, the hero band, and a thin `1px` edge (`--wf-act-edge` via `.edge-act`) on act-now items. Red (`--wf-danger`) means "act now" and nothing else. Cards, rows and tiles take no tinted fill (except a free or fit bed, which keeps its soft fit tint), and standalone status words use their `-ink` token partner.
- **Why:** Full-card tinted washes and competing red badges diluted urgency cues and made normal operational rows look like clinical alarms.

## D-44. Compact sizing, white cards and smaller text retained over expression-test card tints (9 October 2026)

- **Date:** 9 October 2026 (`2026-10-09`). **Decided by:** Josh (`design/v8/design-system-v8.md` v8.2 & `design/v9/design-system-v9.md` §14).
- **Decision:** After comparing the v8.1 expression test against the earlier Ward page, Ward Flow retains the compact scale, white/surface cards, smaller text (`13px` body, `14px` card titles, `15px` mono figures) and compact hero chips, while retiring v8.1 card tints and 40px hero figures.
- **Why:** Compact white cards keep high-density clinical lists calm and scannable while preserving the shift timeline and dedicated phone design.

## D-45. Phone is its own 390×844 design, never a desktop reflow (9 October 2026)

- **Date:** 9 October 2026 (`2026-10-09`). **Decided by:** Josh (`design/v9/design-system-v9.md` §7 & §14).
- **Decision:** Phone (`390×844`, below `--wf-bp-narrow` `48rem`) is a dedicated mobile design—priority list, cards with one action, bottom sheets, a sticky `44px` bottom bar and a segmented control—never a squashed desktop multi-column reflow. Names render at `14px`, meta at `12px`, rows tap as a whole, row actions are at least `36px`, and phone bars use solid surfaces rather than glass blur.
- **Why:** Clinicians walking the ward on a phone need immediate priority triage and thumb-reachable bottom sheets rather than stacked desktop tables.

## D-46. Every page has a focal part, a part of its own, a page-specific hero and command-bar action rules (9 October 2026)

- **Date:** 9 October 2026 (`2026-10-09`). **Decided by:** Josh (`design/v9/design-system-v9.md` §1, §7, §9 & §14).
- **Decision:** Every page answers one question in 5 seconds: its focal part sits in the first screen with the most space, its hero title states the answer in five words or fewer (e.g. "Short 26 beds"), and each page carries a signature part of its own (such as the shift timeline on Ward Hub). The page owns its top command-bar action, the hero holds facts and at most one primary action on the left with page-specific actions on the right, and each area has at most one primary button.
- **Why:** Uniform template pages without a focal component or clear action hierarchy made every screen look identical and hid the primary shift task.

## D-47. Glass stays about 80% opaque with the top sheen kept (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh ("keep the Apple shine at 80% opacity", `design/v9/design-system-v9.md` §3 & §14).
- **Decision:** Chrome and overlay glass stays largely opaque at about 80% (`80%` day / `78%` night for `.glass.bar`, `84%` / `82%` for `.glass` popovers and palette, `88%` / `86%` for `.glass.sheet`), keeping the cool day tint (`rgba(244,247,250)`), `1px` bright top edge, top sheen gradient and `saturate(1.4)`. Never use glass on data tables or cards; reduced transparency and unsupported browsers fall back to solid `--wf-raised`.
- **Why:** Overly transparent glass lost legibility over busy clinical tables by day, whereas 80% opacity with the top sheen preserves depth and 4.6:1+ contrast.

## D-48. Figures stay in Geist Mono with tabular digits while chart axes use Geist Sans (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh ("keeps the control room feel", `design/v9/design-system-v9.md` §4 & §14).
- **Decision:** All operational figures—counts, percentages, durations (`.num`), hero chips, stat values, clock times, UMRNs and record IDs—render in `Geist Mono` with `tabular-nums`. Chart axes and tick labels use `Geist Sans` so charts read quietly, while chart data values stay in mono.
- **Why:** Tabular monospace digits give the bed-coordination board its control-room alignment and scannability without cluttering chart axis labels.

## D-49. Ward Flow 44px default row target (dense 36px, touch 52px) vs retired 48px PsychSift tap knob (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh (`design/v9/design-system-v9.md` §5 & §14).
- **Decision:** Ward Flow rows, beds, controls and card heads bind to `data-density` on the shell (`--wf-row`): `44px` default, `36px` `dense` (long lists on large desktop screens), and `52px` `touch` (ward touchscreens and coarse pointers). Desktop pointer targets are at least `28px` (`--wf-target`) and reach `44px` on touch/phone via hit area. The `48px` `--spacing-tap` knob in `docs/design-system/DECISIONS.md` (C2) belongs exclusively to the retired PsychSift design system and does not govern Ward Flow.
- **Why:** Reconciles the Ward Flow density scale (`36px` / `44px` / `52px`) against legacy PsychSift documentation so agents do not apply PsychSift's 48px tap rule to Ward Flow rows.

## D-50. Neutral T1 urgency pill vs Form 1A amber statutory warning badge (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh (`design/v9/design-system-v9.md` §10 & §14).
- **Decision:** The `T1` clinical urgency tier pill (`.tier`, `TierTile`) renders in neutral monospace styling rather than a red or coloured fill, because red is reserved strictly for "act now" glyphs and thin edges. By contrast, Mental Health Act statutory form expiry/assessment badges (such as a `Form 1A` approaching its recorded assessment window) carry the amber warning tone/glyph when due soon, never a red fill on a static tier label.
- **Why:** Keeps triage tier classification (`T1`–`T3`) visually distinct from time-critical statutory form warnings (`Form 1A`) and "act now" clinical alerts.

## D-51. Delays filters hide rows with a stated hidden count while other queues highlight by default (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh (`design/v9/design-system-v9.md` §9 & §14, harmonising D-41).
- **Decision:** Across queues of 100 rows or fewer, filter chips (`HighlightPills`) highlight matching rows by default and dim non-matching rows with `--wf-dim` (`data-dim`, stating `"N of M highlighted, all rows stay"` with `Clear`). By explicit owner exception (D-41), the Delays board filters continue to hide non-matching rows and state the hidden count with `"Show everyone"`.
- **Why:** Preserves context on standard queues so waiting patients never vanish silently, while honouring the approved Delays board narrowing contract.

## D-52. 10 October page review rulings: time-axis overdue zone, 15px/20px strip figures, 8px people pips and incremental shared parts (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh (`design/v9/design-system-v9.md` §3, §4, §5, §10 & §14).
- **Decision:** From the 10 October page review: (1) `--wf-overdue-zone` (danger tone at 6% day / 8% night) tints the overdue region on time axes only, never cards, rows or tiles; (2) queues highlight by default (see D-51); (3) figures in strips and tiles use `15px` mono, with `20px` reserved for titles and at most one focal strip per page; (4) people pips use `8px` glyphs only when accompanied by their numeric figure; and (5) remaining shared parts (`ViewSwitch`, `WardCapacityRow`, `GroupHead`, `NeedsYou`, `KeyHints`, `RecordCard`, `RailSummary`) are built incrementally when each page is next touched.
- **Why:** Settles the pending page-review questions from the v8/v9 transition so screen migrations have one unambiguous specification.

## D-53. Elevate design language and Glare mode adopted for Design System v9 (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh ("Go ahead with all your recommendations", `design/v9/design-system-v9.md` §§9–14).
- **Decision:** The Elevate recommendations are adopted into Design System v9 and implemented in `src/app/ward-flow-v9-tokens.css` and `src/components/wf/v10-parts.tsx`: one action blue (`--wf-accent` `light-dark(#245a8c, #8cbcf0)`), a fixed top-right radial light on the hero, visible day glass, quiet slate (`--wf-data-closed`) with a dashed edge for closed beds (never gold), the Section 12 Elevate parts (`QuietUnits`, `MixedAnswer`, `FadeHairline`, `PressureArc`, `FigureRoll`, `AllClear`, `BedPlan`, `RowSpark`, `DeltaTwins`, `JourneyRibbon`, `SinceYouLooked`, `CommandPalette`, `UndoHairline`), and Glare mode (`data-mode="glare"` via `clinical-kb-glare` for ward PCs near windows).
- **Why:** Unifies the v9 token layer, Elevate shared components, and bright-ward readability mode into one standard.
- **Subsequent note (15 October 2026):** The Top 25 `CommandPalette` item was dropped in the 15 October Top 25 review, and its implementation and exports were removed. The original decision remains as historical context; the design-system inventory now treats the command palette as outline-only.

## D-54. Tier time thresholds remain synthetic demo values requiring clinical sign-off (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh (`design/v9/design-system-v9.md` §14).
- **Decision:** Urgency tier (`T1`–`T3`) time thresholds and target lines in the demonstration prototype remain synthetic placeholder values and require formal clinical governance sign-off before any real-patient or live operational use (consistent with D-4, D-22 and D-36).
- **Why:** Prevents synthetic demonstration wait thresholds from being mistaken for ratified WA Health clinical policy.
- **Subsequent note (15 October 2026):** Josh signed the tier targets for the prototype (D-56). This decision still stands: real-patient or live use needs formal clinical governance sign-off.
- **Subsequent note (16 October 2026):** Josh signed the remaining values for the prototype (D-63). This decision still stands, and only the health service's clinical governance process can close it.

## D-55. Supabase is Ward Flow's database and sign-in provider, and Azure is retired (15 October 2026)

- **Date:** 15 October 2026 (`2026-10-15`). **Decided by:** Josh (project thread "Big picture repo review").
- **Decision:** The dedicated Ward Flow Supabase project (`zakzoemeedfepxcstsou`) is the current database and sign-in provider for the shared synthetic workspace. The Azure Functions host, Azure Blob session vault, Azure PostgreSQL and Entra sign-in code are removed. Plain PostgreSQL stays behind the same provider seam as a fallback. [`DATABASE.md`](DATABASE.md) is the single source of truth for the provider and how to change it.
- **Why:** Supabase was already the default (PR #289), and keeping three providers left stale code and docs. One seam keeps a future switch to one adapter and one setting. Real patient data still needs separate hosting approval, a privacy impact assessment and clinical sign-off.

## D-56. Josh signs the clinical values that have a recorded source, for the prototype (15 October 2026)

- **Date:** 15 October 2026 (`2026-10-15`). **Decided by:** Josh (project thread "Clinical values file", decision card "Sign the 31 sourced"; the card miscounted, and 30 values have a recorded source).
- **Decision:** In [`ward-clinical-values.ts`](../../src/components/ward-management/ward-clinical-values.ts), every value with a recorded source (a decision id or an owner answer), 30 of the 44, is marked signed by Josh on 15 October 2026, at the figure the app ran on that day. The 14 values with "No decision recorded" as their source stay synthetic until a decision is made. Where two figures conflicted (for example the 85% bed alert against the 90% amber occupancy band), the figure the app runs on is the one signed. The other figure stays listed under "Other figures seen".
- **Why:** One file now holds every clinical threshold, so a sign-off can be recorded against each value instead of being implied. Signing is for the prototype. Real-patient or live use still needs formal clinical governance sign-off (D-54), and no value is a legal limit (D-22).

## D-57. Twenty Top 25 items move from the showcase into the real screens, each behind its own flag (15 October 2026)

- **Date:** 15 October 2026 (`2026-10-15`). **Decided by:** Josh (project thread on the Top 25 review: "Go ahead with all remaining recommendations outstanding", "Single PR").
- **Decision:** Each item below is built into a real screen from shared state, behind its own `top25-*` flag in [`ward-feature-flags.ts`](../../src/components/ward-management/ward-feature-flags.ts) (on in development and demo, off in production). Timings come from [`ward-clinical-values.ts`](../../src/components/ward-management/ward-clinical-values.ts). The Sovereign showcase and its local fixtures are removed. Items 9 and 16 are not built yet. For item 23 Josh picked option D of the phone mockups.
  - **1, discharge support notices:** after the ward confirms a discharge, the ward screen lists pharmacy, transport and cleaning with a send button that says "Not wired in this prototype." No event records them yet.
  - **2, referral cap:** asking more wards than the cap of 3 warns and asks for a reason, kept in the audit trail. Without a reason the engine still refuses. Acceptance already withdraws the other requests.
  - **3, next ward after a refusal:** the coordinator shortlist suggests the next eligible wards (main eligibility rules) and adds them through the existing Refer path. The ED declined flag names them.
  - **4, bed being made ready:** a bed still being made ready past `preparingBedStale` asks the ward to tap Ready. Nothing opens a bed or changes a count.
  - **5, discharge prep:** stays due out within `dischargePrepWindow` (24 hours) show on the ward's This shift list with their barrier. The bed drawer sets the barrier from the 7 item barrier list, from day `longStayPrompt`.
  - **6, Needs you by role:** one owner to role filter on the shared task list. The ED Needs you adds the ED owned task rows. The coordinator is never limited.
  - **7, silent ward:** the existing reminders at `silentWardFirstReminder` and `silentWardSecondReminder` suggest asking another ward at the second reminder. Nothing is moved automatically.
  - **8, step down board:** step down candidates on Capacity are matched by the main eligibility rules (single sex D-31, legal, forensic) through a stay adapter.
  - **11, seven day follow up:** every discharge shows whether follow up within `ctoFollowUpWindow` (7 days) is booked, with extra items on an active community treatment order. It warns and never blocks.
  - **12, stuck handover:** the existing Transport awaiting departure row is named "Handover waiting too long" past the transport booked target.
  - **13, ED wait steps:** one ladder from `edElevatedPressure`, `edSeverePressure`, `longWait` and `veryLongWait`, shown neutrally on ED board rows (D-24).
  - **14, arrival checklist:** a read only checklist on the ED person card from recorded medical clearance, legal form and transport. Contraband search and medication chart say "Not wired in this prototype."
  - **15, bed being made ready on a match:** the shortlist notes a bed being made ready and a medical pause read from the movement (D-34).
  - **17, undo:** the one undo pattern is `useUndoableStep`. Remaining hand made undo toasts are listed for conversion.
  - **19, paper legal form time left:** the patient forms register uses the one time left rule and the due soon settings (D-29). The radar's 4 hour amber is dropped.
  - **20, long stay summary:** the handover Beds tab lists stranded stays with barrier, hold and an escalation point at the typed expected date plus `delayedDischargeEscalation`. Not a legal limit.
  - **21, discharge date moved:** the bed tile and drawer show "Date moved N times" from the recorded count.
  - **23, phone walk round (option D):** on a phone, a bed strip in bed order sits above the grouped bed list. Tapping a bed walks the ward one bed at a time, with Reviewed, next bed and Back to list. Updates go through the bed's existing panel. Reviewed and changed this round marks are held on screen only, never saved.
  - **24, absent without leave:** the patient status card shows time away, steps done from the existing list and a bed hold review warning past `awolBedHoldWarning`.
  - **25, broadcast alerts:** the real banner can extend an alert by 2 hours (new `EXTEND_BROADCAST_ALERT`, same roles as stand down) or stand it down.
- **Why:** The showcase skipped the shared reducer and used its own unsigned rules. Building each item into the screen that already owns the job, from shared state and signed values, keeps one rule per job. Flags let unfinished items ship without changing production.
- **Open for Josh:** wording of the referral cap reasons and community treatment order items, WA Health names for the ED wait steps, whether a stuck handover turns red, the start point for the 72 hour escalation, the day 7 limit on recording a barrier, the edited date count of 3, and the unsigned values `awolBedHoldWarning` and `delayedDischargeEscalation`.

## D-58. Josh signs three more clinical values that have a national source, for the prototype (15 October 2026)

- **Date:** 15 October 2026 (`2026-10-15`). **Decided by:** Josh (project thread "Clinical values file", decision card "Sign the 3").
- **Decision:** Three of the 14 synthetic values in [`ward-clinical-values.ts`](../../src/components/ward-management/ward-clinical-values.ts) are marked signed by Josh on 15 October 2026, at the figure the app ran on that day. The ED wait escalated to a state coordinator broadcast from 12 hours takes its 12 hours from the ACEM 12 hour emergency department length of stay measure. ACEM sets the length of stay mark, not the broadcast, which stays a local workflow choice. Follow up booked within 7 days of departure takes its 7 days from the national mental health KPI for community care within 7 days of discharge (AIHW). The KPI counts a completed community contact after discharge from a public acute admitted mental health unit. The app's check is different: it looks for a booked appointment rather than a completed contact. It runs on every discharge and adds extra items for community treatment order patients, so it is a local workflow that borrows the KPI's window, not the KPI itself. The readmission flag within 28 days rests on the national mental health KPI for readmission within 28 days (AIHW). The other 11 stayed synthetic because they are local workflow choices with no external source. Later the same day the Top 25 follow-up (#339) retired the 12 hour broadcast value as unused, along with other unused synthetic values, so two D-58 values remain in the file.
- **Why:** Josh asked for a recommendation per value rather than a blanket sign-off, and only these three have a published national source. Signing is for the prototype. Real-patient or live use still needs formal clinical governance sign-off (D-54), and no value is a legal limit (D-22).

## D-59. Each role sees only what it needs, from one access table (15 October 2026)

- **Date:** 15 October 2026 (`2026-10-15`). **Decided by:** Josh (project thread "Role based access plan", plan v2 approved at 17:43 with the bed manager allowed patient pages, then "go ahead and build the plan" at 17:47).
- **Decision:** Ward Flow uses strict default deny. One table in [`ward-role-access.ts`](../../src/components/ward-management/ward-role-access.ts) says which screens each role may open and at which places, and it drives the routes, the rail, the phone menu and dock, and the desk switcher. [`ward-access-scope.ts`](../../src/components/ward-management/ward-access-scope.ts) trims the workspace to the desk's role and place before any screen reads it. The executive sees counts with no names, the access admin sees no patients, and the transport officer sees open jobs only and no longer raises referrals. Ward, ED, community and bed manager desks may break glass on one record, read only, with a reason, for a set time, and the coordinator reviews every opening. The app part ships behind the `role-access` flag. The server part (scoped replies, memberships, audit role) follows through the Backend thread and needs Josh's confirm before any live Supabase change.
- **Why:** Every desk saw the whole statewide workspace. Least privilege matches WA Health privacy expectations and keeps the demo honest about who can see what. The ward raising referrals in its own name stays on the existing borrowed-role pair until the reducer checks the referral source, so a ward cannot file a referral under another source.

## D-60. Criteria led discharge, for voluntary patients only (15 October 2026)

- **Date:** 15 October 2026 (`2026-10-15`). **Decided by:** Josh (project thread for the Top 25 follow-up, "Yes go ahead with all recommendations" at 23:21 UTC, on the review's item 9 verdict "Rework, needs your sign off").
- **Decision:** The bed panel's Plan to leave tab, on desktop and phone, records discharge criteria set by the treating psychiatrist, chosen from a fixed list of seven ([`ward-discharge-criteria.ts`](../../src/components/ward-management/ward-discharge-criteria.ts)). The ward ticks each criterion as it is met. When every one is met, the panel says the ward can confirm the discharge without waiting for the next review. It confirms nothing itself, and the existing discharge guards still apply. Only a patient recorded as voluntary is eligible. An involuntary patient is excluded because only a psychiatrist can revoke the order, and a patient with no recorded legal status or on a community treatment order is excluded until the status is recorded as voluntary. Criteria a patient already has pause if they stop being voluntary. Setting, changing or reviewing the list needs the ward to record that the treating psychiatrist set it. Criteria lapse after `dischargeCriteriaValidity` (72 hours, synthetic) and then need a review before more can be ticked. One event, `SET_DISCHARGE_CRITERIA`, sets, ticks and clears them. It ships behind the `top25-criteria-led-discharge` flag.
- **Why:** The review found criteria led discharge uncommon in inpatient mental health and safe only with criteria set per patient by the treating psychiatrist and with involuntary patients excluded. Requiring a recorded voluntary status rather than the absence of an involuntary one makes exclusion the failure mode. The criteria list and the 72 hours are prototype choices. Real patient use still needs clinical governance sign-off of both (D-54). Item 16, the inter ward swap matcher, stays parked as Later.
- **Subsequent note (16 October 2026):** D-63 cut the lapse to 24 hours and added two criteria, nine in all.
- **Subsequent note (16 October 2026):** D-64 put the criteria state on the bed tiles and beside "Record that they have left", and added the "patient told" confirmation.
- **Subsequent note (17 October 2026):** D-65 switched criteria led discharge on in production for the prototype and added up to three typed patient specific criteria.

## D-61. Tasks and Alerts are one queue called Alerts (16 October 2026)

- **Date:** 16 October 2026 (`2026-10-16`). **Decided by:** Josh (project thread "Merge Tasks and Alerts", chose design B of three mockups at 05:19 UTC, after "Go ahead with all follow-up tasks" at 05:01).
- **Decision:** The Tasks drawer and the Alerts screen showed the same list under two names, with different words for the same groups. They become one queue called Alerts. The bar button and the phone dock tab say Alerts with the same count. The desktop drawer stays as a quick look from pages other than the Alerts screen, uses the Alerts words (Act now, Waiting and Running, the same groups as the Alerts queue), and leads with Open the Alerts screen. A phone opens the Alerts screen instead of a drawer, from the dock, the Needs you row and anywhere else that opened Tasks. On the Alerts screen the button moves focus to the queue rather than opening a second copy. Only the bed coordinator's desk sees the one queue, because the task list is theirs. Other desks, and any desk whose role may not open the Alerts screen, keep the Tasks name and drawer. It ships behind the `alerts-one-queue` flag (on in development and demo, off in production).
- **Why:** Two names for one list made people wonder whether they were different work. Keeping the quick look on desktop saves leaving the current page, and the phone already had the full Alerts screen. When Josh signs it off, the flag, the Tasks words and the phone drawer path are removed.

## D-62. The one Alerts queue is signed off and its flag removed (16 October 2026)

- **Date:** 16 October 2026 (`2026-10-16`). **Decided by:** Josh (project thread "Merge Tasks and Alerts", "Permission to go ahead with your recommendations" at 06:55 UTC, answering the recommendation to remove the flag once signed off).
- **Decision:** D-61's one Alerts queue is signed off, so the `alerts-one-queue` flag is removed. The bed coordinator's desk always gets the Alerts quick look on desktop and the Alerts tab on a phone. Other desks keep the Tasks name and drawer, so the Tasks words and the phone Tasks drawer stay rather than being removed as D-61 expected.
- **Why:** Every flag stays off in production until it is removed, so removing the flag is how a signed-off change becomes permanent. Other desks still need the Tasks drawer.

## D-63. Josh signs the remaining clinical values and the criteria list, for the prototype (16 October 2026)

- **Date:** 16 October 2026 (`2026-10-16`). **Decided by:** Josh (project thread for the clinical sign-off sheet, "Yes to all" at 10:02 UTC on the clinical sign-off sheet of 16 October 2026, kept in the project's shared review files rather than this repository). The sheet's sources are listed in this entry.
- **Decision:** The 19 values still synthetic in [`ward-clinical-values.ts`](../../src/components/ward-management/ward-clinical-values.ts) are signed by Josh for the prototype. Seventeen keep their figure. Two change. The criteria led discharge lapse, `dischargeCriteriaValidity`, goes from 72 to 24 hours, because the WACHS Criteria Led Discharge Guideline (16 April 2026) needs a medical review within 24 hours before discharge. The unused role switch off, `accessUnused`, goes from 90 to 45 days, from Australian Government ISM-1404 and ISM-1648. The criteria led discharge list in [`ward-discharge-criteria.ts`](../../src/components/ward-management/ward-discharge-criteria.ts) gains "Safety plan reviewed with the patient" (MP 0181/24 Safety Planning for Mental Health Consumers Policy) and "Observations done and reviewed in the last 24 hours" (the WACHS guideline's observations on the day of discharge, worded to match the 24 hour validity), nine in all, and the list is signed for the prototype. Criteria led discharge stays behind its flag and off in production, because the WACHS guideline lists mental health patients as generally not recommended. A health service would first need to agree a mental health cohort.
- **Open before real use:** the absent without leave bed hold (MP 0012/16 leaves this to each health service's procedure), the downtime pack refresh (each health service's business continuity plan), patient specific criteria (the fixed list cannot hold typed text), and the ISM wording, which was checked on a third party copy.
- **Why:** Josh asked for a recommendation on each value rather than a blanket sign-off. The sheet gave a WA or Australian source where one exists and named local workflow choices as such. Signing is for the prototype. Real-patient or live use still needs formal clinical governance sign-off (D-54), and no value is a legal limit (D-22).
- **Subsequent note (17 October 2026):** D-65 closed or paused the items left open here, except clinical governance sign-off (D-54) and the downtime pack refresh, which need a health service.

## D-64. Criteria led discharge shows on the boards and warns at departure (16 October 2026)

- **Date:** 16 October 2026 (`2026-10-16`). **Decided by:** Josh (project thread for the criteria led discharge walk through, "Go ahead and review for any improvements ... then plan and build it" at 12:16 UTC, on the walk through's ranked findings).
- **Decision:** Building on D-60 and D-63, behind the same `top25-criteria-led-discharge` flag. The bed tiles show a short chip (CLD ready, CLD 2 of 5 as "CLD 2/5", CLD review, CLD paused), and the bed panel's Legal tile reads the same records as the criteria card so the two agree. Beside "Record that they have left" the panel says where the criteria stand and, when any is unmet or lapsed, asks for a medical review before the patient leaves. It warns and never blocks. Saving criteria now also needs the ward to confirm the patient was told they are on criteria led discharge. Nothing new is recorded by that confirmation. Each tick shows when it was made, ticks from before a lapse read "Met before it lapsed", and the bed timeline gains "Discharge criteria set or reviewed" and "All discharge criteria met". Two Dabakarn demo patients start with criteria, one part way and one with every criterion met.
- **Why:** The WACHS Criteria Led Discharge Guideline (16 April 2026) asks for a patient's criteria led discharge status on handover, journey boards and whiteboards (s 2.4, 2.5), for patients to be told (s 2.2), and for the clinician facilitating the discharge to instigate a medical review when any criterion is unmet (s 3). The walk through found the ready state visible only inside the bed panel and the Legal tile disagreeing with the card. The "patient told" confirmation is new wording for the prototype and needs the same clinical governance sign-off as the list (D-54).
- **Subsequent note (17 October 2026):** Josh signed off the "patient told" wording for the prototype (D-65). Real patient use still needs D-54.

## D-65. Criteria led discharge on in production, typed patient specific criteria, and the AWOL bed hold review paused (17 October 2026)

- **Date:** 17 October 2026 (`2026-10-17`). **Decided by:** Josh (project thread for the clinical sign-off sheet, "Please complete these issues and switch on criteria led discharge, also turn on typed text, also AWOL bed hold pause for now and review later" at 02:52 UTC, on the list of items still open after D-63).
- **Decision:** Four changes for the prototype.
  - The `top25-criteria-led-discharge` flag is on in production as well as development and demo. The flag stays, so the feature can still be switched off. It is the one flag on in production, a deliberate exception to D-62's rule that a signed-off flag is removed instead.
  - The treating psychiatrist can add up to three patient specific criteria as typed text, each up to 120 characters, after the fixed list ([`ward-discharge-criteria.ts`](../../src/components/ward-management/ward-discharge-criteria.ts)). They are ticked, counted and lapse like the fixed ones, and the card marks them "Patient specific". This matches Part B of the WACHS criteria led discharge form MR28. A save or tick that names a typed criterion is typed text, so it stops browser saving for the session like every other typed-text event (`eventCarriesTypedTextPayload`). A save of fixed criteria only stays safe.
  - The absent without leave bed hold review warning is paused behind a new flag, `awol-bed-hold-review`, off everywhere. The tracker still shows the time away and the steps. `awolBedHoldWarning` keeps its signed figure for when Josh reviews it.
  - The ISM wording behind `idleLock` and `accessUnused` was checked against the September 2026 ISM on cyber.gov.au. ISM-1404 (revision 5) and ISM-1648 (revision 2) both disable access after 45 days of inactivity. ISM-0428 (revision 11) locks a session after at most 15 minutes of inactivity. It also caps a session at 12 hours overall and needs every sign-in factor to unlock. Ward Flow does not do those two yet.
- **Still open:** clinical governance sign-off before real patient use (D-54) and the downtime pack refresh (each health service's business continuity plan). Both need a health service. The WACHS guideline still lists mental health patients as generally not recommended for criteria led discharge, so a health service would need to agree a mental health cohort before real use.
- **Why:** Josh is the product owner and wanted the remaining sign-off items finished for the prototype. Typed criteria were the only way to record patient specific criteria. Typed text already has one rule across the app, so the criteria follow it rather than a new one.
- **Subsequent note (17 October 2026):** Josh chose to keep the self-ticked "Set by the treating psychiatrist" box for typed criteria in the prototype. His answer, verbatim, on the decision card in the clinical sign-off sheet thread at 05:14 UTC: "Keep tick box", to the question "Keep the psychiatrist tick box for typed discharge criteria in the prototype?" The app cannot check who ticked it. The fixed D-60 criteria use the same tick box. Before any real use, setting, changing or reviewing any criteria, fixed or typed, needs a real psychiatrist sign in, not the tick box.
- **Subsequent note (17 October 2026):** Josh, verbatim, in the clinical sign-off sheet thread at 05:29 UTC: "Go ahead with all recommendations and I give full permission for sign off". For the prototype this signs off the D-64 "patient told" wording, the typed criteria rules above, and community teams seeing numbered placeholders instead of the typed wording (task ledger 7.82 item 1). It does not close D-54. Real patient use still needs clinical governance sign-off by a health service.
- **Subsequent note (17 October 2026):** Josh, verbatim, in the clinical sign-off sheet thread at 06:55 UTC: "Go ahead with your recommendations", to the recommendation to build the ISM-0428 12 hour session limit only. The signed-in shared site now refuses any request from a sign-in more than 12 hours old (`sessionLimit` in the clinical values module), reads included, and the app signs the person out with the reason. It counts from the first sign-in factor, which a token refresh or a later factor never moves, so only a fresh password sign-in resets it. A sign-in with no recorded time is refused. Asking for every sign-in factor to unlock the screen lock is not built. The screen lock stays a local privacy screen.
- **Subsequent note (21 October 2026):** Correction from a source check. The line above and the ISM item in the decision understate what is built. In the signed-in shared workspace the idle lock (`WardIdleLock` in [`shell/ward-access.tsx`](../../src/components/ward-management/shell/ward-access.tsx)) signs the person out, here and on the server, so carrying on needs a full fresh sign-in. The ISM-0428 unlock requirement is therefore met in signed-in mode. Only the local demo, which has no sign-in, keeps the lock as a privacy screen.
- **Subsequent note (20 October 2026):** Josh switched every finished feature on for the prototype on 20 October 2026 (overall review project thread; relayed to this change by the coordinating session, not quoted here). That includes `awol-bed-hold-review`, so the absent without leave bed hold review warning described above as paused and "off everywhere" is no longer paused; it uses the signed `awolBedHoldWarning` figure. The flag change itself is in PR #487. The same day Josh chose to keep demo reset off on the live site.

## D-66. Granted roles work without a second approval (17 October 2026)

- **Date:** 17 October 2026 (`2026-10-17`). **Decided by:** Josh in the shared backend setup thread: "Please remove the second approver requirement".
- **Decision:** Remove the second approval requirement for coordinator and access-admin role grants in the synthetic Ward Flow prototype. An authorised grant works immediately. Existing unexpired, unrevoked and recently used grants with null approval fields also work; their history is preserved rather than recording an approval that did not happen. The compatibility `/approve` endpoint refuses an unnecessary approval without changing the record.
- **Still required:** Sign-in, an authorised granter, no self grants, a valid place within the granter's scope, a future end date, automatic switch off when unused, revocation, recent sign-in for access changes, and the existing audit trail. This decision does not authorise real patient data.
- **Why:** The only bootstrap coordinator could grant the synthetic test admin a role but could not also provide its second approval. Josh chose to remove that prototype requirement. This replaces the second approval part of the role access plan; it is a policy change, not evidence of independent approval.

## D-67. Recover synthetic form drafts within the browser session (17 October 2026)

- **Date:** 17 October 2026 (`2026-10-17`). **Decided by:** Josh in the five-task Ward Flow handover thread. The request specifies 500ms sessionStorage draft recovery for referral and legal forms, then authorises implementation: "Go ahead and update and perfect the plan and launch it now and work autonomously for me and fix all the issues you have confirmed".
- **Decision:** Permit typed drafts only for the explicitly opted-in synthetic referral drawer and legal form editor, scoped to the current account/session, scenario and form subject. Restore into the form for human review; never submit or change a clinical record automatically. Show a restored-draft notice with Clear. Successful submission, sign-out, session termination and reset clear the relevant drafts and invalidate pending writes. Rejected submissions retain the draft for correction.
- **Boundary:** This is a narrow exception to D-18 for the synthetic prototype. The general typed-event state saving lock remains in force. No real patient information is authorised. Do not put draft text in localStorage, URLs, logs, screenshots, commit messages or memory services. Browser session restoration may preserve sessionStorage across a restart, so browser-close deletion is not a guaranteed property.
- **Why:** The existing memory-only referral draft survives closing and reopening its drawer but is lost on refresh. The requested exception supports refresh recovery while preserving explicit session cleanup and human submission.

## D-68. Bed meeting TV content and access (19 October 2026)

- **Date:** 19 October 2026 (`2026-10-19`). **Decided by:** Josh in the project chat, answering the design audit questions: "yes to all recommendations".
- **Decision:** (1) For synthetic demonstrations the bed meeting TV may keep showing initials, sex and day of stay. (2) Ward desks may open the bed meeting TV view, because they attend the meeting; ED desks may not. (3) The audit also recommended showing the referral number on the ward's accept card. That is not built: it conflicts with D-39 (no record numbers printed on screens, Josh, 15 October 2026), which the recommendation missed. The card stays as it is, with no name, UMRN or record number until the ward accepts (D-14, FD-23), until Josh decides between the two.
- **Boundary:** Before any real patient data, the TV content needs a privacy review: a wall screen in a shared room shows initials, sex and day of stay to anyone who walks past. This decision does not authorise real data.
- **Why:** The design audit found that ward staff at the bed meeting could not open its view (decision questions), and that the accept card gives the ward nothing to quote when phoning the coordinator (DA-34).

## D-69. A referral with no legal status: "Needs an involuntary-capable bed until status is set." (20 October 2026)

- **Date:** 20 October 2026 (`2026-10-20`). **Decided by:** Josh, in his own words, at 2:02 PM AWST: "Needs an involuntary-capable bed until status is set."
- **Decision:** A referral with no legal status recorded is allocated as needing a bed that can hold someone involuntarily until a status is set. It never defaults to Voluntary. Only a recorded Voluntary status clears the need; Involuntary, any form, a blank or "Not recorded" keeps it. The rule lives in `involuntaryBedNeededForLegalStatus` (`src/components/ward-management/referrals/ward-referral-drawer-model.ts`) and is tested in `tests/ward-referral-unknown-legal-status-bed.test.ts`.
- **Boundary:** This is a prototype allocation rule for synthetic data, not a legal determination about the person, and not clinical governance sign-off (D-54).
- **Why:** PR #465 made every legal status start blank. Unknown status is the safe direction: it widens nothing and routes to a bed that can hold the person whatever their status turns out to be.

## D-70. No computed Mental Health Act periods: show only the recorded due time (20 October 2026)

- **Date:** 20 October 2026 (`2026-10-20`). **Decided by:** Josh, on the overall review of 20 October 2026 (section 1, item 1): "Fix all of these issues ... Go ahead with all recommendations." The recommendation was "Remove the computed countdown. Show only the due time a person recorded."
- **Decision:** This replaces D-29. The Legal forms screen no longer works out when an Act period ends, never picks an under-18 period from age, and no longer counts down to a computed end or orders a list by one. It shows only the due time a person recorded from the form (`legalForm.dueAt`), and says no deadline is recorded when there is none. `legal-forms/act-periods-demo.ts` and its test are deleted, and the section-citation guard exempts no file. D5 applies everywhere again.
- **Why:** The standing rule rules out computed Act times and expiry, including the under-18 periods. The legal question pack is unanswered, and the screen itself said the periods were not legally checked.

## D-71. Audit 1 clinical safety fixes: no suggested wards, wait-order queues, recorded facts only (20 October 2026)

- **Date:** 20 October 2026 (`2026-10-20`). **Decided by:** Josh, on Audit 1 (clinical safety and the never-build rule, `main` `3ff8503`), at 10:03 PM AWST: "Please go ahead with all recommendations and fix all issues identified."
- **Decision:** All seven Audit 1 recommendations apply:
  1. The ward answer view shows no invented clinical summary and no "Admit to" line, only recorded facts or "Not recorded".
  2. No suggested, ranked, capped or pre-selected ward anywhere: "Suggested destination" goes, wards not yet asked are listed in full in a fixed order, the ED board gives a count only, and the phone accept starts with no ward chosen.
  3. Waiting lists default to wait order. Flags, act-now and form due times are highlights that do not move rows. This restores D-32 (first in, first out), which the Home queue, Waiting, Movements and step-down lists had drifted from.
  4. No points score: "Why this wait" gives plain reasons only.
  5. "Time left" counted down to an expiry a person typed from the form stays: it computes nothing about the Act (D-70 is unchanged).
  6. Road time "nearest ready beds" stays, captioned "Distance only, not suitability". Make-room chains stay switched off outside local builds. Candidate wards use a fixed order within each fit group, not catchment or free-bed tiers.
  7. Every copy to the clipboard starts with the synthetic line. Whether real names may appear in copied text is decided before any real data.
- **Why:** The standing never-build rule (19 October 2026) excludes best-match ward suggestions, automatic placement, re-sorting the ED queue and risk scores, and the audit found these built before the rule. Findings and evidence: `/mnt/project-files/audits/2026-10-20-clinical-safety-audit/`.

## D-72. Seven product decisions for the 21 October fix plan (21 October 2026)

- **Date:** 21 October 2026 (`2026-10-21`). **Decided by:** Josh, in the "App backlog and recommendations" project thread at 6:59 PM AWST: "Yes to all", to the session's seven recommendations on the fix plan for the 14 big product issues.
- **Decision:**
  1. **Work lost on refresh.** After a typed-text event the browser keeps saving every change that holds no typed text, and typed fields are saved as "Typed text not kept on this device". The live site moves to shared mode by default later, once shared boards are reliable. D-18's rule that typed text never reaches the device is unchanged.
  2. **Outage copy.** The downtime pack regenerates hourly and at each shift change as a print or a saved file only. No board data is kept in the browser cache.
  3. **Supabase Realtime and a history table.** Approved in principle for shared live updates and occupancy and wait history, expected to sit inside the plan's included allowances. Enabling either on the Ward Flow project is still a provider change that needs Josh's confirmation at the time, after the live plan and price are checked, and any charge needs his spending approval.
  4. **Six core coordinator screens.** Home ("Needs you now", with Alerts as its drawer), Referrals (Queue, Waiting and Delays merged), Beds (Board, Capacity, Wards and Network merged), Movements (Transport and Out of area merged), Discharges, and Handover (with the bed meeting and TV view). Statistics, the directories, Search, Legal forms and Settings stay as secondary screens. Command, Hub, Constellation, Exceptions and Escalation fold into the six. The layout is tried as a mockup first (`design/third-edition-mockups/coordinator-six-screens-mockup.html`) before any app change.
  5. **Observation levels.** General (hourly), Intermittent (interval typed, 15 or 30 minutes), Constant within sight (1:1), Constant within arm's length (1:1) and Two staff constant (2:1). Each 1:1 counts as one staff member against a ward's observation capacity and 2:1 as two; General and Intermittent count as none. The labels stay editable in the clinical values, because names vary by health service. Nothing is scored or suggested from a level (D-71).
  6. **Seclusion and restraint.** An operational view only: what is in use now and seclusion room availability, typed times, no computed limits (D-70). The legal register stays in the health service's own system.
  7. **Unfinished controls hidden by Audit 7.** Build the answer view's bed hold field (wired to the existing hold event) and its nurse unit manager field (wired to the existing high-acuity override tick). Delete the referral Call button and replace it with "Log a call" from the new call log. Delete the Add patient "After adding" card and go straight to the patient's page. Delete the cockpit's "Confirm a destination" section, which leans toward suggesting a ward (D-71). Build Assign referral with the call log.
- **Boundary:** Synthetic data only. This decides product direction, not clinical governance sign-off (D-54), and authorises no provider, deployment or spending step.
- **Why:** A source review of 21 October 2026 found 14 product issues; these were the decisions the fix plan needed from the owner before building. Plan: `/mnt/project-files/plan/ward-flow-fix-plan-2026-10-21.md` (project files, outside the repository).

## D-73. Batch merge safeguards (21 October 2026)

- **Date:** 21 October 2026 (`2026-10-21`). **Decided by:** Josh, in the project's health check thread at 7:46 PM AWST: "yes to all", to that session's seven recommendations.
- **Decision:**
  1. The Work loss, Observation levels and Phase 0 threads may push their branches and open PRs.
  2. The Referral owner and Observation levels threads share engine files by section: each edits only its own lines, and the second PR to merge resolves any conflict.
  3. An old record with `specialling: true` is read as Within sight 1:1, and `false` as General.
  4. The Node 24 install lives in the cloud environment's setup script. The repository ships no `.claude` folder.
  5. The merge queue is used for this batch. Josh switches it on himself.
  6. A read-only check of the Supabase plan and Realtime quota is allowed before fix plan items 1 (shared boards) or 6 (history) start.
  7. Issues #430 (CAD number validation) and #431 (seeded surname check) join Phase 2 of the fix plan. Issues #314, #315 and #374 to #376 are closed once each is verified as fixed in the source.
- **Boundary:** Synthetic data only. A push or PR is not a merge, deployment or provider change; each still needs its own authority (AGENTS.md hard rule 10).
- **Why:** Several threads were building fix plan items in parallel, and the batch needed agreed rules for publishing, shared files and merge order.
- **Subsequent note (21 October 2026):** Item 5 cannot be applied as approved: GitHub's merge queue is unavailable for a personally owned repository. Josh accepted a lighter substitute in the health check thread at 7:51 PM AWST, in his words "yes but this slows things down", then "yes ok", to that session's proposal as relayed by the coordinating session: "Require branches to be up to date before merging" stays off; only the three riskier PRs (Work loss, Referral owner and Observation levels) merge `main` in and re-run CI just before they are marked ready; the smaller PRs merge as they are.

## D-74. Owner answers to the 21 October open questions (21 October 2026)

- **Date:** 21 October 2026 (`2026-10-21`). **Decided by:** Josh, in the project chat at 8:02 PM AWST: "please go ahead with all recommendations... EXCEPT... ANYTHING YOU ARE BUILDING A MOCKUP FOR", to the coordinating session's 17 recommendations.
- **Decision:**
  1. **Shared boards Realtime** is closed. The 3-second refresh is accepted for the prototype. This supersedes D-72 item 3 for live updates; the history table stays as D-72 left it.
  2. **Community workflow gaps** join Phase 2 of the fix plan: an accepted community referral can be moved, transported and arrived; the coordinator can ask more wards; a community team sees the referrals it sent and whether a ward accepted.
  3. **Community referral purpose (Q9).** A new community team referral needs a purpose, "Community follow-up" or "Assess for admission". Older records read as "Community follow-up".
  4. **Six-screen mockup rejected and build cancelled.** Josh, in the project chat at 8:04 PM AWST: "CAN THAT 6 CORE SCREENS BUILD!!!! THE MOCKUP LOOKS TERRIBLE!!!". The mockup was removed before merge, and D-72 item 4 is withdrawn: the current coordinator screens stay as they are.
  5. **D-39** is kept: no referral number shows on the accept card until the ward accepts.
  6. **Copied text** carries no real names.
  7. **OA-58** (internal patient codes) stays parked until the privacy review.
  8. **Pilot** runs beside the ward whiteboard first.
  9. **D-57 wording** items left over are closed as covered by D-63 and D-65.
  10. **Assign referral** records the community desk only, with no clinician names.
  11. **R19** (costed ward questions) stays parked until a pilot ward is chosen.
  12. **Hosted checks.** The hosted save and conflict test and the hosted fresh browser check are approved, with synthetic data only.
- **Standing rule:** Josh, in the project chat at 8:02 PM AWST: "DO NOT EVER GO AHEAD UNTIL I APPROVE THE MOCKUP". Nothing is built from any mockup until Josh explicitly approves that mockup.
- **Boundary:** Synthetic data only. This authorises no deployment, provider configuration change or spending. The Supabase connector, open sign-up, restore drill, iPhone walkthrough and pilot roles are for Josh to do himself.
- **Why:** The parallel threads had raised open questions that needed owner answers before Phase 2 and the hosted checks could go ahead.

## D-75. UX audit follow-up, page caching, community gaps and the extra-travel bed hold (21 October 2026)

- **Date:** 21 October 2026 (`2026-10-21`). **Decided by:** Josh, in the project chat at 9:58 PM AWST, answering five recommendations: "yes to these."
- **Decision:**
  1. **UX simplification audit.** The small fixes the audit found go to the fix threads now: the top 10 to the audit thread and the rest to the area threads. The 10 bigger changes go to a mock-up first, under the D-74 standing rule.
  2. **PERF-03.** Pages keep the per-request security (CSP) nonce, and HTML is not cached at the edge. Every page stays dynamic: that is the accepted cost, because a cached page would replay one nonce to every visitor. The `src/proxy.ts` header comment (PR #541) carries the same ruling, and it closes TASK-L4-11.
  3. **Community workflow gaps** (fix plan items 15 to 17, D-74 item 2) start in their own thread after the current merges. The Q9 purpose is already in the trends work.
  4. **Seclusion view** may claim the two screen-map files their previous owner released.
  5. **Extra-travel bed hold.** A bed hold for a person with extra travel adds 60 minutes to the hold set in Settings.
- **Mock-up evidence rule:** Josh, in the project chat at 8:40 PM AWST: "Disregard any mockups that did not utilise up to date live or local site and visual assessment". A mock-up counts only when it was made from screenshots of the running app at current `main` or the hosted site, and it says which commit.
- **Boundary:** Synthetic data only. This authorises no deployment, provider configuration change or spending, and no build from a mock-up before Josh approves it.
- **Why:** The audit and the fix threads needed owner answers before the quick wins, caching work, community gaps and bed hold timing could go ahead.

## D-76. Community referral gaps: the full move journey and asking more wards (21 October 2026)

- **Date:** 21 October 2026 (`2026-10-21`). **Decided by:** Josh, in the Community referral gaps thread at 10:05 PM AWST: "Go ahead with all recommendations", on the scope in `community-gaps-scope-2026-10-21.md`.
- **Decision:**
  1. **Fix plan item 15.** An accepted community referral is built as the full journey: it can be moved, transported and arrived, and it shows on the Movements and Transport boards. The journey records a community origin by team name, with no address. This updates owner ruling 8 of 1 September 2026, which said a journey never starts at a community team, for an accepted community referral. The smaller option, where the ward records "arrived from community" against the held bed with no movement, is not taken.
  2. **Fix plan item 16.** The coordinator can ask more wards about an open community referral. Each ward added is recorded with who added it and when. No more than 3 wards may be waiting at once (`PARALLEL_REFERRAL_CAP`), and wards that declined do not count. Wards are listed alphabetically and are never ranked or suggested (D-71).
- **Boundary:** Synthetic data only. The engine work waits until the trends work has merged, because both touch the same event, model and drawer files. This authorises no deployment, provider configuration change or spending.
- **Why:** D-74 item 2 put the community gaps into Phase 2, and the scope showed that only the full journey puts community transport on the boards that coordinators and transport officers already use.

## D-77. The ten bigger UX changes approved for build (22 October 2026)

- **Date:** 22 October 2026 (`2026-10-22`), 12:52 AM AWST. **Decided by:** Josh, on the decision card in the Bigger UX changes mock-ups thread, choosing "Build all ten, as recommended", after "Ok go ahead and build this for me now". The mock-ups were made from the running app at `main` 1459fb5, as D-75 requires, and the D-74 approval rule is met.
- **Decision:** build these ten changes and the desktop top bar fix:
  1. **Short community referral form.** Purpose is asked only on referrals to a community team, and purpose and first contact are required. There is no Documents step. The form has team search and a Sent tab.
  2. **ED board** shows where its referral stands, using the words "Bed held".
  3. **Desktop decision pane** uses the phone list, with Clinical override behind one button.
  4. **Ask wards** is a checkbox list of up to 3 wards (D-76 item 2).
  5. **Legal forms** loses the strip and side panels. Board now and Check a form time are dropped, and Form times stays in Tools.
  6. **Add a patient** asks for identity only. Aboriginal status stays an optional field.
  7. **Alerts drawer** gives one action per alert.
  8. **Demo menu** sits under the Synthetic pill, and all 7 scenarios are kept.
  9. **Statistics.** Summary and Overview become one Network page with no duplicate figures.
  10. **Phone Bed board** shows every bed, above the day figures, with no legend on the phone.
  11. **Top bar** at 1280 px is fixed.
- **Not decided:** the "Not legally checked" notice stays on the live Legal forms screen, and D-70 is unchanged, until Josh answers that question. The card's recommendation to remove it is not acted on.
- **Process:** one pull request per group, each from current `main`, with a visual check. Nothing merges without Josh.
- **Boundary:** Synthetic data only. This authorises no deployment, provider configuration change or spending.
- **Why:** Josh reviewed the ten mock-ups, made from the current app, and approved them with the recommended answers to their open questions.
