# Ward journey: current command models and selective route

_Updated 2026-11-03 — model every current command, review route semantics and detect source drift; Documentation owns._

**Audience:** engineers and reviewers tracing Ward Flow behaviour. Current implementation, tests
and owner decisions establish behaviour. The route illustrates the central patient path; it does
not draw every possible ordering of commands or certify a clinical workflow.

The **Current events** tab accounts for every current `EVENT_ROLE` key. **Diagram-reviewed**
entries have reviewed route/action notes. **Modelled** entries add before/after diagrams with
payload, scope, guards, effects and relevant existing test references. The former 74 catalogue-only
gaps now have these models. A before/after record update does not necessarily advance a patient
stage. Event-level roles do not establish authenticated place scope. Source review and test
references are separate from executed tests or end-to-end acceptance.

## Read it

```sh
node docs/ward-flow/journey/serve.mjs
```

Open the printed loopback URL. The reader is `ward-journey-explorer.html`; no backend, credentials
or provider calls are needed. Source paths refer to the recorded local checkout; publication of that revision is not verified. The source-contract
fingerprint identifies extracted event identities, roles, source-reference paths/lines and notice
kinds. It does not certify handler bodies or historical prose. Provenance also reports uncommitted
inputs; it is distinct from the wrapper’s broader input-race fingerprint.

## Verify and refresh safely

```sh
node docs/ward-flow/journey/verify.mjs --check
node docs/ward-flow/journey/verify.mjs --prove
node docs/ward-flow/journey/verify.mjs --write
```

These commands need plain Node, no installed packages. They run the build in a temporary tree.
`--check` compares five reader outputs without writing the checkout. `--prove` runs mutation
proofs only in that temporary tree. `--write` adopts reader outputs only after the full build
succeeds and confirms the original input fingerprint is unchanged. Do not run the older direct
`build.mjs --prove` command in a working checkout: those probes deliberately modify their inputs.

The checked reader outputs are vocabulary, route layout, explorer HTML, BPMN and the flat
inventory. Build-time/revision provenance is reported separately from content drift. Dated
`WHAT-CHANGED.md`, `map-snapshot.json` and `refusal-coverage.json` are retained historical evidence,
not regeneration gates. No new coverage execution is implied; missing/mismatched coverage is
shown as unknown. The current event catalogue is not a count of separately supported staff jobs.

## Sources and maintenance

- `source-contracts.mjs` discovers the unique exported `EVENT_ROLE` and `NoticeKind` declarations.
  Missing/ambiguous declarations and incomplete parses refuse; declaration moves are discovered.
- `actions.json`, `machines.json` and `rebuild-map.mjs` contain the selective route, state machines,
  gates, resource notes and gap descriptions. The source comparison covered all 97 original actions,
  eleven machines, route nodes, gate rows and resource ledgers. Selected refusal examples are not
  an exhaustive list of refusals or proof that a screen can reach every branch.
- `event-dispositions.json` now contains the additional command models. Every model requires payload,
  scope, guards, effects, before/after notes, existing test paths and reviewed source references.
  A new event must have diagram action notes or a complete command model; no blanket exclusion or
  catalogue-only placeholder clears the check. Obsolete and duplicate entries refuse.
- Each action's `review`, each command model's `sources`, and the diagram's `review` record source
  SHA256 digests. A cited source-file edit refuses generation until someone compares the changed
  behaviour and updates the notes and review record. Whole-file digests are deliberately conservative:
  an unrelated change in a cited file can also require review. Generation never refreshes these
  digests automatically. A matching digest proves file identity, not that a reviewer was correct.
- `explorer-template.html` renders the route and current models. `MAP-INVENTORY.md` records the
  models, references and their digests in a text form reviewers can diff.

When a source change trips the check, inspect the changed handler, payload, access boundary and
relevant tests. Correct the affected notes, then record the reviewed source's digest (for example,
`sha256sum src/components/ward-management/ward-flow-placement-events.ts`) in the corresponding
review records. Do not bulk-refresh digests to silence the gate. For a new command, add its real
transition or record effects and evidence; event names alone are insufficient. Run `--write`,
`--check` and `--prove` after the settled owned change. CI runs the check, while the mutation proofs
are an explicit local command. Provider state, backup/restore and physical-device acceptance remain
separate checks. The guide below is retained historical evidence rather than current instructions.

<details>
<summary>Historical guide — September/October claims and original build instructions</summary>

<!-- docs-script-refs:historical-start -->

# The ward journey — the map of what Ward Flow can actually do

🔴 **This is the master tool for mapping Ward Flow's flow and behaviour** (owner instruction,
18 September 2026). New behaviour goes on here. "What can happen at this point?" is answered from
here, not from a screen and not from memory.

**Open [`ward-journey-explorer.html`](ward-journey-explorer.html) to read it.** Serve it rather
than opening it as a bare file — like every other drawing in `docs/ward-flow/`, it builds itself
in JavaScript:

```bash
node docs/ward-flow/journey/serve.mjs
```

## What it is

One page with seven tabs: the route map, state machines, bed decision gates, accepted actions,
closed word lists, refusal coverage and recorded gaps.

The vocabulary is extracted from `src/components/ward-management/`. The route wording and action
descriptions are curated in `rebuild-map.mjs`, `actions.json` and `machines.json`; builders check
structure and event coverage, but a reviewer must still compare prose and controls with the engine
and rendered screens. The coverage tab is historical until a fresh full coverage run is available.

## Re-running it

```bash
npm run ward:journey
```

No dependencies, plain Node. It runs seven steps in order and stops at the first that refuses.

| Step                   | What it does                                                                    |
| ---------------------- | ------------------------------------------------------------------------------- |
| `extract-vocab.mjs`    | reads every exported word list straight out of the engine → `vocabularies.json` |
| `rebuild-map.mjs`      | lays the route map out from its edge specification → `stages.json`              |
| `build-explorer.mjs`   | builds the page, and checks every claim on it → `ward-journey-explorer.html`    |
| `build-bpmn.mjs`       | emits the pathway as BPMN 2.0 for Camunda Modeler / bpmn.io                     |
| `make-inventory.mjs`   | writes `MAP-INVENTORY.md`, a flat list a reviewer can diff against source       |
| `refusal-coverage.mjs` | says which refusals no test ever reaches → `refusal-coverage.json`              |
| `what-changed.mjs`     | reports what moved since the last run → `WHAT-CHANGED.md`                       |

`actions.json` and `machines.json` are the **hand-curated** inputs — what each event does, refuses
and demands. They are the only things here written by a person, and the build refuses if any of
them names a box that does not exist.

## 🔴 Every check here can refuse, and refusing is the point

This tooling makes a claim — _this is everything the ward journey can do_. A drawing that quietly
omits something is worse than no drawing, because somebody will trust it. So the builders check
their own output and **exit non-zero rather than write a file that is wrong**.

`rebuild-map.mjs` refuses if two boxes overlap, or if a line runs behind a box it does not join.
`build-explorer.mjs` refuses if an action is modelled nowhere, if a line is not the colour of the
box it leads to, if a box is neither continued nor terminated, if a filter controls nothing, if a
colour has no sentence saying what it means, or if a lane on the map is not named in the legend.

**A check nobody has seen fail is a check nobody has seen**, so each one is proved against a
deliberately broken input:

```bash
npm run ward:journey:prove
```

Each proof breaks an input, checks the build refuses _and names the offender_, then restores it.
They must not run beside a normal build.

## ⚠️ The trap this tooling keeps falling into

**A rule stated in a comment but implemented as a list.** Three separate rules here — which boxes
get a terminating bar, which lines route around a box, which colour a line takes — each started as
a hand-written list of ids under a comment claiming it was one rule. Every one of them was wrong
the next time a box was added, and two of them were only caught because a later check refused.

If you add behaviour here: derive it from the node list, and run the derivation **after** the node
list is complete. A list that happens to be right today is the defect, not the fix.

## Adding behaviour

1. Add the box and its links to `rebuild-map.mjs` — position is `{x, y, w, h}`, routing is
   computed, so do not hand-draw a path.
2. Add or extend the action in `actions.json`, pointing `nodes` at the box.
3. Run `npm run ward:journey`. Read what it refuses; it names the box, line or action.
4. Say in the box's own text what the engine actually does, in the words a clinician uses. A box
   that states a behaviour more confidently than the source supports is the failure mode here —
   check the reducer case before you write the sentence, and cite it in the commit.

## What it deliberately does not do

It changes no behaviour. It is a drawing and a set of checks. Where the engine has a gap — a
stretch with no record at all, a screen whose buttons dispatch nothing — the map **states the
absence** rather than leaving a blank or filling it in with something plausible.

Every person, ward and figure named anywhere in it is invented.

<!-- docs-script-refs:historical-end -->

</details>

## Label review — 6 Nov 2026 (`fix/pr2-speed-keyboard`)

Source digests for `ward-screen.tsx`, `officer-screen.tsx`, `discharge-board.tsx` and `out-of-area-board.tsx` were re-reviewed after accessible-name and spacing edits only (axe 4.14 label content, front-end fix PR 2). Event dispatches, roles and the cited lines are unchanged; the `CLEAR_BED_RELEASE_BLOCK` citation in `discharge-board.tsx` moved from line 1411 to 1408.

## Follow-up honesty — 5 Nov 2026 (`fix/wf-followup`)

Source digests for Alerts UI were re-reviewed after wording-only edits; event handlers and roles are unchanged.

**WF-15 / WF-40 / WF-13 (access + Alerts chrome)**

- Closed and wrong-role redirects share the tab title `Not part of your role — Ward Flow` (unknown ≈ forbidden); OwnHomeRedirect says the page is not part of the role before opening home.
- Access admin Alerts empty copy names Access admin (not Executive) and says alerts are not part of that role.
- Quiet-ward Alerts empty copy says "Nothing in the network queue" and points nurses to My ward instead of "Nothing needs you".

**WF-16 / WF-45 / WF-28 (Capacity, Statistics, On-call, footer — Worker 2)**

- Capacity hero chip: **Beds freeing today** (was "Discharges due today"); forecast note distinguishes that figure from next-24h discharges; mismatch axis **Spare that fit**.
- Statistics Wards: occupancy column **In use %** with Occupied caption; Statistics Teams: **"teams that have someone in a bed"** / **"No team patients..."** empty copy.
- On-call: site bed manager scoped to own site with **"{site} + statewide"** meta.
- Shell footer: **Demo board clock · scenario set on {demo day}**.

These are display-label honesty fixes. They do not change EVENT_ROLE handlers or journey graph edges.

## Source review — 8 Nov 2026 (documentation history move)

Source digests for `ward-change-reasons.ts`, `ward-flow-referral-answer-events.ts` and `ward-model-referral-parts.ts` were re-reviewed after comment-only edits: five comments now cite `docs/history/` paths for moved decision files. No code, event handler, role or cited line changed.

## Source review — 8 Nov 2026 (repo review fixes, PR #1523)

Source digests for `ward-flow-reducer.ts`, `ward-flow-placement-events.ts`, `ward-flow-transport-events.ts`, `ward-derivations.ts` and `movement-workflow-actions.tsx` were re-reviewed after these edits: a departure from a locked bed now caps free locked beds at the ward's locked beds; `PULL_PATIENT` resolves the patient once (referral, then movement, then event) for both the already-in-a-bed check and the new stay; arrival lateness ignores closed movements. Event names, roles, guards described in the notes and graph edges are unchanged.

## Source review — 9 Nov 2026 (D-80 item 17, PR #1543)

Source digests were re-reviewed after the coordinator's "on behalf of the ward" reason, file by file:

- `ward-flow-protected-record-events.ts`: `OPEN_DISCHARGE_RECORD` now refuses a coordinator's opening without a reason from the closed `ON_BEHALF_REASONS` list, and refuses a reason sent by any other desk (`invalid-payload`). The `OPEN_DISCHARGE_RECORD` notes, its refusal row and its screen note were corrected. One import line moved later citations down by one to five lines; `REVIEW_AUDIT_EVENT`, `UNDO_AUDIT_REVIEW`, `RECORD_PATIENT_DISCHARGE`, `RECORD_ADMISSION_CARE` and `RECORD_ADMISSION_FOLLOW_UP` behaviour is unchanged.
- `ward-flow-events.ts`: `OPEN_DISCHARGE_RECORD` gains an optional `onBehalfReason` field, plus one type import. Every other event's payload is unchanged; its 36 citations moved by one to three lines.
- `ward-flow-storage-validation.ts`: a stored `OPEN_DISCHARGE_RECORD` audit row is refused when its `onBehalfReason` is off the list. The cited locked-bed invariant moved from line 455 to 456, unchanged.
- `ward-flow-provider.tsx`: `openDischargeRecord` takes the optional reason and passes it on the dispatch; an import replaced a blank line. The cited dispatch lines for `RECORD_LEAVING`, `ADVANCE_CLOCK`, `RESET_SCENARIO`, `RECORD_PATIENT_DISCHARGE` and `OPEN_DISCHARGE_RECORD` did not move.
- `discharge-board.tsx` and `capacity-ward-drawer.tsx`: a coordinator's record opening now waits for the reason picker (loaded lazily from `on-behalf-reason-form-lazy.tsx`) before dispatching. `CLEAR_BED_RELEASE_BLOCK` (line 489 to 490) and `REQUEST_CAPACITY_REFRESH` (line 248 to 258) are unchanged in role, payload and guard.

`handover/handover-page.tsx` (two blank lines removed) is not a cited source.

After review (9 Nov 2026), `capacity-ward-drawer.tsx` catches a failed record opening after the reason is given and shows the same "record is unavailable" line as the Discharges board. `REQUEST_CAPACITY_REFRESH` moved from line 258 to 263, unchanged in role, payload and guard.

After `main` was merged into PR #1543 (9 Nov 2026), `ward-flow-events.ts` holds both sides' edits. From `main`, `ADD_PATIENT` accepts the optional admin detail fields (`Partial<Record<AdminDetailField, string>>`, with one type import widened). From this PR, `OPEN_DISCHARGE_RECORD` has its optional `onBehalfReason`. Neither edit adds or removes lines on the other side, so all 37 citations (36 command models and the state-machine review) keep this PR's line numbers, and `main`'s line numbers map to the same lines. Only the digest was re-recorded. No other cited source differs from its recorded digest after the merge.

## Source review — 9 Nov 2026 (search, export and training tools, PR #1559)

Source digests were re-reviewed after review fixes, file by file:

- `ward-flow-provider.tsx`: training mode (feature 47) gives the tab a private synthetic world; a training reset now clears only the in-memory referral draft, so the real world's stored drafts survive. `RECORD_LEAVING` (1215 to 1218), `RESET_SCENARIO` (1131 to 1133), `RECORD_PATIENT_DISCHARGE` (1234 to 1237) and `OPEN_DISCHARGE_RECORD` (1263 to 1265) moved down; role, payload and guard are unchanged. The `ADVANCE_CLOCK` citation (line 440) is unchanged.
- `use-ward-minute-tick.ts`: the minute tick starts only while the tab is visible. It only re-renders; it dispatches nothing, and `ADVANCE_CLOCK` is unchanged.
- `ward-global-search.tsx`: My views (feature 45) rows pass the same access gate as other rows. The demo `ADVANCE_CLOCK` dispatch on line 1275 is unchanged.
- `discharge-board.tsx`: an Export button (feature 44) sits in the list header and is disabled when the list is empty. `CLEAR_BED_RELEASE_BLOCK` moved from line 533 to 539, unchanged in role, payload and guard.

The G-then-letter go-to keys (`shell/ward-goto-shortcuts.ts`) navigate through `navigateWithDirtyGuard`, so the unsaved-work guard still applies to that path. They dispatch no event.

## Source review — 10 Nov 2026 (care plans and safety flags, PR #1578, D-104)

Source digests were re-reviewed file by file before being re-recorded:

- `ward-flow-events.ts`, `ward-flow-event-roles.ts`: four new events (`RECORD_CARE_PLAN`, `RECORD_TRIBUNAL_HEARING`, `RECORD_TRIBUNAL_OUTCOME`, `SET_CULTURAL_SUPPORT_REQUEST`) and their roles were added. No existing event's payload or role changed; cited lines below the additions moved down only.
- `ward-flow-reducer.ts`: the four new events route to `reducePatientCarePlanEvent` from the default branch. No existing case changed.
- `ward-flow-record-events.ts`: `RECORD_ESCALATION` now also appends to `Movement.escalations` (seeded from the older single `escalation` when the list is empty). Its guards, role and the `escalation` field every existing reader uses are unchanged. The `RECORD_ESCALATION` action note says so and its `reviewedOn` is 10 Nov 2026.
- `ward-movements.ts`: seed data only (a second synthetic escalation on one journey).
- `patients/add-patient.tsx`: the duplicate check's tier order, wording and input rule moved to shared helpers in `ward-patients.ts` with the same behaviour. `ADD_PATIENT`'s dispatch, role and payload are unchanged.

The other command models citing these files had only their digests re-recorded, because none of their handlers, guards, roles or payloads changed.

## Source review — 10 Nov 2026 (clinical display answers, D-122)

Source digests were re-reviewed file by file before being re-recorded:

- `ward-flow-bed-events.ts`: one import was added (line 21), so every cited line after it moved down by one. `EVALUATE_LEAVE_BED_WARNINGS` now words its notice from the signed leave bed value ("24 hours or more", the check being at or over the line). Its guard, role, payload and the warning time are unchanged.
- `coordinator/shortlist-panel.tsx`: comment-only edits (the override comment cites D-122, not D-86; the three-ward cap comment cites D-122). The edits replace comment lines one for one, so no cited line moved.
- `ward/ward-answer-view.tsx`: the hero ring's at-risk word tests the whole percent shown (D-109, extended by D-122). No dispatch, role or cited line changed.

## Source review — 10 Nov 2026 (final master audit fixes, PR #1594, D-128)

Source digests were re-reviewed after these edits, and every cited line was re-mapped against `main` line by line (no citation sat on a changed line):

- `ward-flow-record-events.ts` and `ed/ed-medical-placement-controls.tsx`: `RECORD_MOVEMENT_MEDICAL_CLEARANCE` now carries `actingPlaceId`, and an ED is refused unless it names itself as the journey's origin ED (M2). The coordinator sends none. Its needs note and a new refusal row were added.
- `ward-flow-record-legal-events.ts`, `ward-flow-events.ts` and `movements/movement-workflow-actions.tsx`: `RECORD_LEGAL_FORM_CONTINUATION` takes an optional `actingUnitId`; on a ward desk only the accepted ward may record it (D-128 item 1). Coordinator, ED and community behaviour is unchanged. Its needs note and a new refusal row were added.
- `ward-access-state.ts` and `ward-flow-reducer.ts`: a ward caller that names no acting ward or movement place is now refused rather than allowed (M4, M113), and the shared server's place check covers the continuation. The existing notes already say the acting ward is required for ward callers, so no note changed. Other events' roles, payloads and graph edges are unchanged.
- `patients/patient-now-screen.tsx`, `patients/patient-transit-operations.tsx` and `referrals/referral-match.tsx`: dispatches now pass the acting ward or ED. Event names, roles and guards are unchanged.

After `main` was merged in (10 Nov 2026), this PR's ruling became D-128 because main had used D-124. The comment-only renumbering in `ward-access-state.ts`, `ward-flow-events.ts`, `ward-flow-record-legal-events.ts` and `ward-flow-reducer.ts` changed no line, so only their digests were re-recorded. Citations in files only `main` changed keep `main`'s reviewed lines and digests.

## Source review — 10 Nov 2026 (master audit fix batches, D-129)

Source digests were re-reviewed file by file before being re-recorded:

- `ward-flow-referral-answer-events.ts`: `RECEIVE_REFERRAL` now also refuses a typed referrer phone that is not a phone number (audit M39, `referrerPhoneError`); a blank one is still accepted. Its `needs` note says so and its `reviewedOn` is 10 Nov 2026. One import line changed; no cited line moved.
- `referrals/use-ward-referral-drawer-state.ts`: the drawer's Send check calls `referralContactSendError` (the same limits plus the phone check). The `RECEIVE_REFERRAL` dispatch line did not move.
- `ward-undo.ts`: `CONFIRM_BED_RELEASE` is now an undoable step, filed against its bed release (`release:<releaseId>`), so a Ward Decisions sign-off can be taken back by `UNDO_RELEASE_STEP` (M37). The `UNDO_RELEASE_STEP` model and the `CONFIRM_BED_RELEASE` `changes` note say so. Later citations moved down by two to nine lines; no other undo kind changed.
- `ward/ward-screen.tsx`: the sign-off now builds its short Undo (`ward-sign-off-undo.ts`) from the outcome; one import line added. The dispatches cited for twelve events moved down by one to three lines, unchanged in role, payload and guard.
- `ward-tasks-drawer.tsx`: Acknowledge visible sends one `ACKNOWLEDGE_INBOX_ITEM` per row and names each alert (M13). The event, its role and payload are unchanged; `RECORD_ESCALATION` moved from line 671 to 672.
- `governance-registers.tsx`: Governance's review list also shows each cover given (M58); `REVIEW_AUDIT_EVENT` moved from line 543 to 546, unchanged.

After `main` (D-121 to D-127) was merged into this branch (10 Nov 2026), `ward/ward-screen.tsx` and `ward-tasks-drawer.tsx` hold both sides' edits. Each cited line was found again by its text, unchanged in role, payload and guard: the twelve `ward-screen.tsx` citations moved down by three to seven lines, and `RECORD_ESCALATION` in `ward-tasks-drawer.tsx` moved to line 673 (one comment line added beside the D-125 sign-out wait). Only lines and digests were re-recorded. This thread's rulings were then renumbered D-129 and D-130, a comment-only change in the cited files, so those digests (in `actions.json`, `event-dispositions.json` and `machines.json`) were re-recorded with no line moved.

## Source review — 10 Nov 2026 (Batch 4 outages and pilot control, PR #1603, D-135)

Source digests were re-reviewed file by file against `main` before being re-recorded. Only additive Batch 4 edits were found:

- `ward-flow-event-roles.ts`, `ward-flow-events.ts`: three new events (`SET_SITE_FEATURE_SWITCH`, `RECORD_DOWNTIME_PACK_PRINTED`, `RECORD_OUTAGE_WINDOW`) and their roles were added. No existing event's payload or role changed; cited lines below the additions moved down only.
- `ward-flow-reducer.ts`: one type import, the `PilotControlState` records joined to `WardFlowState`, and the three new events routed to `reducePilotControlEvent`. No existing case changed; later citations moved down by one to six lines.
- `ward-access-state.ts`: the three new records are scoped (switches and outage windows to every desk, print times to the desks of the wards printed for). No existing field rule changed; every citation moved down by seven to ten lines.
- `ward-flow-storage-validation.ts`: the three stored records are checked on restore. The cited locked-bed invariant moved from line 460 to 461, unchanged.

Each cited line was found again by its text. The three new events have command models in `event-dispositions.json`; no screen dispatches `SET_SITE_FEATURE_SWITCH` or `RECORD_OUTAGE_WINDOW` yet (screens wait for the Batch 4 design review, D-74).

After review the same day, `ward-site-feature-switches.ts` and `ward-outage-catch-up.ts` made three helpers private (`isSiteProtectedFeature`, `SiteProtectedFeature`, `wardOwnConfirmationAt`) for the unused-export check. Only the `export` keyword changed; behaviour and cited lines are the same, so only their digests were re-recorded.
