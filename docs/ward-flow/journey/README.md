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
