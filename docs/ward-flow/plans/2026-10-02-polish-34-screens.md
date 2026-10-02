# Ward Flow polish: 34 screens

Task/source identity: `BigSimmo/Ward-Flow:polish-34-screens-20261002`.
Coordinator: `codex/chat-polish-34-screens-6c8b` in
`C:/Users/joshs/.codex/worktrees/6c8b/Ward-Flow`.
Base: verified local main `981a4a8a52e0c235b888e4c9470c94c34808cf33`.
Current integration candidate: `codex/polish-final-preserve-20261002` in
`D:/Temp/ward-polish-fold-20261002`, app HEAD `770c006`.
Candidate base and current local main: `81bdd870bc387635629550c994e3042e8ec0affc`.
Status: **In progress**. All three scoped decisions were approved; final gates and the local fold remain in progress.
Last verified: 2026-10-02T14:58:30.743Z. Local preview: **http://localhost:4266**.
Local integration is authorised but pending required gates; publication and deployment are not authorised.
Original polish is committed on its clean branch at `e7c22323a0e7265da63fe9813e0bb4afd2cca05a`.
Earlier sections retain the original preview evidence and historical blockers; the latest checkpoint supersedes their current-state statements.

## Agreed outcome

Polish all 34 application designs except Discharge Board, Referral Board and Community
Directory. Include New Referral, Community Hub and Community Statistics. Exclude the
optional showcase initially; Josh subsequently authorised completing it after the local-main fold. Preserve identity, working features, calculations, clinical/legal
meaning, permissions, persistence and synthetic-data boundaries. Remove redundant prose;
retain metric definitions, scope, provenance and essential notices.
Replacement concepts stay separate, are presented together at the end, and are never
applied to working pages during this task. Desktop acceptance uses **1920 x 1080 viewport
captures only**; earlier 1440/full-page images are preliminary and excluded.

## Coverage and ownership

| Batch                   | Designs                                                                        | Result                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Access/preferences      | Sign In, Settings                                                              | Polished; imports validated; visible feedback and honest role preview                                                 |
| Operational overview    | Command, Capacity, Network, Service Search                                     | Polished; current-state meaning preserved                                                                             |
| Movement/transport      | Movement Board, Movement Workspace, Transport Hub                              | Polished; enlarged timeline/focus recovery retained; mobile chips wrap                                                |
| Services                | Ward Directory, Ward Hub, Ward Response, Ward Bed Board, ED Hub, Community Hub | Reviewed; response header overlap and Community dark notice repaired; Community spacing commit awaits exact ownership |
| Patients/intake         | Patient Search, Patient Overview, Governed Record, Add Patient, New Referral   | Polished; malformed IDs and unknown-record recovery preserved; lower actions checked                                  |
| Coordination/governance | Delays, Handover, Alerts, On-Call, Out-of-Area, Legal, Governance              | Polished; accepted/refused feedback follows scope/state; examples disclosed; empty-state claims corrected             |
| Reporting               | Dashboard, Statewide, Comparison, Service, Ward, ED, Community                 | Polished; invented history removed; comparison scale/hydration repaired                                               |

Three concurrent screen workers used disjoint main-derived branches. Coordinator applied
scoped patches and owned shared styles, Git and records. Completed worker units:
`c60b1eb`, `bcbcf24`, `5bacbf4`, `409fac3`, `17be650`, `c19acd4`,
`841cd925`, `1f7a14e`. Recovery `ffd61d2` inspected before movement work.
Both remote destinations were verified as `BigSimmo/Ward-Flow`; history anchor and base
were checked. Task bootstrap ran once; exact-lock dependencies belong to this repository.

## Saved implementation and remaining overlap

Coordinator commits: `7493135` guard repair, `cb75d91` access/settings/alerts,
`e44e1bb` workspaces/comparison, `e8cf2f7` reporting, `e4dd9f7` readability,
`a480278` hydration/unavailable controls/print, `530dc67` honest contrast target.
All normal commit hooks passed. No hook bypass, reset, clean, rebase, push or provider call.

Fresh shared-signout probes cleared released movement/statistics/generated-map claims.
Only `src/components/ward-management/community/community.module.css` remains blocked by
`ward/ag-community-v2-elevation`: three already prepared spacing declarations at the
content workspace/governance panel. Do not commit or further edit that file without its
owner's release or Josh's scoped takeover approval. Preserve the existing local candidate.
The original ownership question is unanswered; silence is not approval. Shared legal-notice
CSS was separately clear and its dark contrast repair is committed.

## Decisive local evidence

- Fresh `npm run ensure`: **http://localhost:3302**. API project
  `clinical-kb:3eb35f2e4a07`, own PID47396, exact implementation worktree verified.
  Earlier owned PID37260 stopped after control/compile stalls; unrelated servers untouched.
- Final focused Vitest: **19 files, 233 tests passed**, maxWorkers1. Includes imports,
  broadcasts/reset, sign-in, handover, movement, patient recovery, statistics, primary
  actions, signout/pre-commit guards and print coverage. Exact command recorded by the
  repository gate receipt. Latest full `gate-tsc` (tsconfig.typecheck.json): exit0 in9s.
- Desktop: 34 included + three excluded regression routes, 37 HTTP200, no page errors or
  document horizontal overflow in the initial source-bound pass; all34 original pixels
  inspected by coordinator/workers. Targeted fresh checks replace affected initial evidence.
- Final actions: selected-scope broadcast/reset, Settings invalid import/draft/save,
  inert role preview, timeline dialog Tab/Escape/focus return, Handover disclosure,
  relevant lower forms/records and fixed response-header scrolling checked.
- Comparison final browser: all22 bars within actual range, keyboard focus and **no
  hydration error**. Patient lower pane retargeted after an initial capture hit navigation.
  Search inspector and Delays real shell lower content recaptured and inspected.
- All34 phone routes checked at390x844 with no document horizontal overflow. Affected
  phone controls and layout representatives inspected; shared-style regressions checked
  on allthree excluded routes. Six desktop dark representatives inspected. Community
  legal notice measured **5.496:1** against its actual dark background, previously2.810:1.
- `screen-map.mjs --check` and `screen-verification.mjs --check`: current, no hard/structural
  problems. Canonical record updated for32 included contract screens; patient governed
  view and Movement Workspace are additional checked designs. Prior verification preserved.
  Latest app review records deliberate adaptation, not new literal drawing equality.

Primary evidence directory: `D:/Temp/ward-polish-34-20261002/`.
Receipts: `final-desktop-1920`, `final-desktop-sections-1920`,
`final-actions-responsive`, `final-targeted-recheck`, `final-last-recheck`,
`settings-copy-final`, `concepts-1920`. Each executed browser run closes its owned browser;
app runs verify source unchanged. Local-only requests and synthetic fixtures are enforced.

Resolved failures remain in evidence: wrong scroll target/capture gaps; unsupported browser
role selector; pre-commit test timeout passed alone and in final233; normal lint ref-read
failure moved measurement to event handlers; stale generated map regenerated after release;
disabled hover cascade corrected; split SVG title hydration corrected; existing unreset
HUD print selectors repaired and print guard12 passed. Never report these failed runs as green.
CUA control repeatedly timed out, so purpose-built installed-Chrome local harnesses supplied
browser evidence. Old IAB tabs could not be controlled/closed; no unrelated browser was killed.

## Separate concepts and limits

Two isolated HTML artifacts in the task visualizations directory: role selection and
horizontal comparison. Localfile1920 browser checks and independent pixel review passed;
role interaction is inert and comparison values are explicitly illustrative. No app adoption.
Long comparison names, physical devices, exhaustive states, printed browser appearance,
backend/provider/hosted behaviour and release readiness are unverified. No measured token
or time savings claimed. Browser emulation is not physical-device evidence.

Next exact action: obtain release/scoped takeover for the sole Community CSS file, then
commit its three prepared spacing declarations with normal hooks. No other worktree/main
writes. Refresh only relevant evidence if those declarations change. Existing local receipt
bridge prepared for this original task; canonical Notion reconciliation remains unsynced.

## Authorised local integration and showcase continuation

Josh authorised committing all reviewed changes and folding to local main, then completing the Design System Showcase on 2 October 2026. He explicitly required preserving all existing work. This includes the previously disclosed three Community CSS spacing declarations, committed on the original task branch as e7c2232 with normal hooks.

Integration target at start: dedicated local main 7eb199bd2e9824c1165896f821750973bb986b82, clean checkout D:/Repos/Ward-Flow. Recoverable references: backup/20261002-local-main-before-polish and backup/20261002-polish-before-fold. Candidate checkout D:/Temp/ward-polish-fold-20261002, branch codex/polish-local-fold-20261002. Both Ward Flow remote destinations and identical lockfile hashes verified. No remote/provider/publication authority inferred.

The merge preserves newer main Statistics tabs, summary panels, allocation headroom, hospital capacity matrix, subnavigation, and Community V2 implementation. Statistics conflicts and generated verification output are reconciled in the candidate only. Inherited unsupported target/history displays are corrected within the original reporting truthfulness scope. Required candidate gates and affected 1920 x1080 visual checks remain pending. Design System Showcase implementation starts after the polish fold; separate concepts remain unadopted.

## Safe pause for PC restart

Paused at Josh's explicit request on 2 October 2026. No fold to main occurred: local main remains 7eb199bd2e9824c1165896f821750973bb986b82 and was verified clean. Original polish branch is clean at e7c2232 with every original polish change committed, including Community spacing. Backup refs preserve pre-fold main and prior polish.

The isolated integration checkout has a merge in progress with 73 staged/merged paths and two unresolved files: src/components/ward-management/statistics/statistics-compare-screen.tsx and statistics-ward-screen.tsx. Those files still contain conflict markers; the integration cannot be committed as a valid result yet. Generated SCREEN-VERIFICATION.md was reconciled from the merged JSON; checkpoint additions are staged/partly unstaged. All agents have been interrupted. No gate, validation browser, or candidate dev server is running; shared run slots are free. A private ZIP snapshot includes all candidate modified files and Git merge/index metadata for recovery.

Resume: validate main/source HEADs and ownership against this checkpoint; resume bounded statistics resolution while preserving main tabs/KPI panels/capacity matrix/Community V2 and task range/null/hydration/readability changes. Correct inherited unsupported target/history presentations; retain current calculations and explicitly labelled unavailable-history treatment. Regenerate records, commit candidate with normal hooks, run selector-required local gates and affected1920x1080 checks, independent preservation review, then fast-forward local main only if its unchanged clean head still matches. Next complete /mockups/ward-flow/sovereign in an isolated main-derived task branch using existing components/tokens. Showcase has not been edited. Keep separate concepts unadopted and no push/provider/deployment action.

## Resumed integration checkpoint: 2 October 2026

The merge is resolved and committed as `5fb1121405ac273531169456ea2178c52f6a5975`.
Subsequent coherent repairs are committed through app HEAD `fcae12d019d6496b57506980dcb57acb32de4f8c`.
Main remains clean at `7eb199bd2e9824c1165896f821750973bb986b82`; it has not been folded or overwritten.
Both candidate remote destinations were rechecked as `https://github.com/BigSimmo/Ward-Flow.git`.
No source files are uncommitted. This checkpoint-only update is a separate owned commit.
The task's requested mode is now local integration validation; no push, provider or deployment step is authorised.

Two reused, disjoint agents completed the Statistics integration and independent preservation review.
The candidate preserves main's newer KPI panels, summary/headroom information, hospital matrix,
subnavigation and Community V2. It adds working Statistics section links, truthful availability
qualifiers without changing the underlying counts, name-free ED feedback, synthetic status
provenance, exact fixed colour tokens, shared table insets, a full-width Ward Statistics panel,
Legal Forms viewport recovery and generic Governance practice labels without invented form codes.
Scope, metric definitions, prototype disclosures and unavailable-history treatment remain.
Independent review covered the integration, proposed reuse commits and subsequent source/CSS repairs.
The original two concepts remain separate and unadopted. The showcase still awaits the polish fold.

### Verification and input identity

All evidence below is local, synthetic and provider-free. Exact-lock dependencies use Node 24 and
Next 16.3.3; lock SHA256 is `0EE7F97317825DAA0BEDB9F7848225FE78B199721D72D1F5D7F531E7629A2058`.
The installed Next client guide was read before source edits. Wide checks and browser runs were serialised.

- Fresh `npm run ensure` printed **http://localhost:4266**. The identity endpoint confirms Ward Flow,
  project `clinical-kb:41dae78e9f13`, candidate checkout, development PID42752. Historical port3302 is stale.
- Full typecheck passed on the resolved integration input. Normal scoped commit hooks passed for
  subsequent repairs. Whole-current-head typecheck is pending the final source assembly.
- Required FULL at `7cd2259f062e42b67e4130f10f5ce43c39f9b8cd` ran **841 files / 9,874 tests** and
  failed with **33 assertions plus collection failures**. The focused same-lock baseline at main
  reproduced **27 assertions**. This is failed evidence, not a passing release gate.
- Focused status contracts passed **2 files / 112 tests**; canonical table tests passed **1 file / 6 tests**;
  final practice-label and breakpoint guards passed **2 files / 7 tests**. Other earlier focused runs
  retain their partial failures. Remaining raw-colour/fallback, patient-link/cycle, renderer/runner and
  cohort-name failures require the scoped decisions below. No allowlist or guard was weakened.
- Source-bound browser receipts cover the affected reporting screens, Community Hub, Settings,
  Movement Workspace, Delays and the three excluded regression routes at **1920 x1080**, plus affected
  phone geometry and dark representatives. All eight section links reached, focused and revealed their
  actual targets. The Comparison chart's 22 bars were within range. Capture and pixel-review coverage
  are distinct; prior original 34-screen evidence is preserved rather than called fresh integration proof.
- `style-label-qa/receipt.json` passed five targeted routes with unchanged source. Ward Statistics and
  Community Directory passed the separate targeted receipt. An earlier Directory failure was an
  incorrect harness assumption that it consumed the new palette; it does not, and the app was unchanged.
- `table-practice-final/receipt.json` passed Governance but failed the Capacity automation scroll.
  Follow-up `capacity-diagnostic.json` used live connected DOM reads and actual shell scrolling:
  HTTP200, no console/page errors, visible table at 1920, real ward cells 6px/12px, group cells 4px/12px,
  headers 10px/12px. The lower table screenshot was inspected. No reproduced app defect was found;
  the failed locator run remains recorded rather than relabelled as passing.
- Generated screen maps were checked after integration. Their checks, diff-integrity, whole typecheck,
  required FULL and journeysALL must be refreshed once the final authorised inputs are stable.
  Do not repeat the full suite while protected fixes remain pending.

Primary evidence root: `D:/Temp/ward-polish-34-20261002/`. Selected SHA256 identities:

| Evidence                                    | SHA256                                                             |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `full-gate/receipt-1790943317604-2560.json` | `B6C37F2B4B652C0D911B8114854ED06DE5D8709F6B8B920959BF57AB9A542845` |
| `baseline-failures.json`                    | `492078E312003B27C30CDC4122FE9A8534D92B7C8F3394607047CFE5CE91F6E7` |
| `status-contract-final.json`                | `1E799DCAB3AEE757F425BFFD88684057FBCFD37792BD6A5C9D0A5BB910F68349` |
| `practice-breakpoint-final.json`            | `00B2F86BF0BABA721AEBC03E165099ED1DBFF570E7098B1DE2EF14C366FAFB2F` |
| `style-label-qa/receipt.json`               | `AAEAA875BE5C894893A8A27CD2E806D6F2623FA2CC65102076AD116690812E6F` |
| `capacity-diagnostic.json`                  | `3D7D856F27FD71FFCD9BC8B1CF3C60BC599B09D1597CE4B214E2BF6880AA1A1D` |

### Pending scoped decisions and next exact action

Three asynchronous questions remain unanswered; elapsed time is not approval:

1. Reuse already reviewed commits `8f6ea7b` and `4f14a8f` from
   `codex/ward-validation-repair-20261002`, including takeover of the active exact-file claims on
   `movements/movement-workspace-cockpit.tsx` and `ward-management-console.tsx`. Other commit paths
   must also be checked before integration. This fixes runner visibility, the import cycle,
   patient identifier feedback and guards that do not match the actual legal renderer.
2. Permit minimum repairs on the excluded Referral/Discharge boards: unchanged colour values into
   fixed tokens, declared fallback names and a truthful dated referral-raised label. Exact paths:
   `discharges/discharges-third-edition.module.css`, `referrals/referrals.module.css`,
   `referrals/referral-board.tsx`. All are under `src/components/ward-management/`.
3. Permit the single protected Community cohort line to use `siteByCode("JHC")?.name ?? "Hospital not recorded"` rather than duplicating a hospital name. Exact file:
   `src/components/ward-management/community/community-demo-cohort.ts`, owned by
   `ward/ag-community-v2-elevation`. Private patch `community-name-proposal.patch` passes apply-check;
   it has not been applied.

These files remain untouched pending owner release or Josh's scoped approval under the active-overlap
rule in AGENTS.md; the excluded-board scope also needs the requested explicit decision. Earlier
Community CSS spacing approval does not extend to the cohort file. No generic reconfirmation of
the already authorised local-main fold is needed.

After the decisions: revalidate exact claims and main's clean head, apply only authorised repairs,
run focused proof and required stable-input gates, review the affected1920 screens, then fast-forward
local main. Complete the Design System Showcase afterwards on an isolated main-derived branch.
Keep concepts separate. The existing task receipt is exported locally; Notion reconciliation is unsynced.
No measured token, credit or time savings are claimed.

## Scoped approval and final validation assembly

Josh said **"Yes I approve the three pending approvals"** in this chat on 2 October 2026.
The exact takeovers were recorded in the append-only sign-out, including all paths in the two repair
commits; unrelated work and the protected canonical token file remain intact. Original local-main
fold authority is unchanged. No further approval is pending for these three decisions.

Integrated `8f6ea7b` and `4f14a8f` as `005f2f5` and `32f3733`; the sole conflict was an append-only
test-map section, whose history was retained. Minimum board/cohort repairs are committed as `3ce1323`.
Independent review found the adjacent inherited legal assurance cards and header inferred legal
authority from a bed request. Commits `0b2a89d` and `c25ac73` remove those unsupported assurances,
retain the cards and truthful bed-request labels, and show consent/detention status and register
checks as unrecorded. Two DOM cases verify both values of the bed-request flag through the real
provider, including accepted creation, preserved absence and no fabricated status. No legal policy
or placement calculation changed.

Four unchanged fixed colours now resolve through aliases on the routed WardGround root. The
date-format guard follows the extracted helper and actual cockpit; its global bare-clock scan is
unchanged. `90a7132` isolates standalone hook-test repositories from the machine-wide sign-out file;
their real secret/ownership checks still run. This removes an unrelated external fixture input,
without widening a timeout or bypassing a guard.

Fresh targeted proof: `approved-followup.json` **3 files / 23 tests passed**,
`hook-fixture-final.json` **1 file / 20 tests passed**, `referral-header-final.json`
**1 file / 2 tests passed**. The earlier 27-file run retains its three failures, each followed by the
specific correction and fresh check. Independent source review found no introduced defect.
Generated screen-map and screen-verification checks remain current; diff-integrity against main
passed **25 changed test files, 318 to331 cases**. Desktop repair captures use1920x1080 only.
`approved-browser-1920` passed four routes; its Referral failure selected a hidden table control,
then the actual visible card selector passed in `referral-legal-final-1920`. The final header capture
is in `referral-header-final-1920`. Phone geometry and affected dark layouts are also checked.
Whole clean typecheck passed on `90a7132`; it is refreshed after the final header edit before fold.

Next: hold app inputs stable for the required FULL/typecheck/journeysALL, preserve the latest
independent review and affected UI evidence, verify main is still clean and unchanged, then fold
locally. Showcase drafts may be prepared privately during gate time, but app implementation starts
after the polish fold. Update the same local receipt at the result; canonical Notion remains unsynced.

### Complete approved FULL findings and corrections

The approved stable run at `df7a780` completed **842 files / 9887 tests**. Its receipt is
`D:/Temp/ward-polish-34-20261002/full-gate-approved/receipt-1790950166412-53532.json`.
Two files failed: the adversarial HUD test retained four pre-provenance status expectations,
and the print guard found seven themed Movement Workspace selectors without winning print ink.
No manifest entry, test timeout, population or guard was weakened.

`770c006` retains exact synthetic status expectations and adds a print-only CanvasText reset
to the existing cockpit root. `final-corrections.json` passed **2 files /137 tests**. The first
browser attempt selected two cockpit roots and failed strict locator matching; the actual workspace
test ID then passed in `movement-print-final-corrected-1920/receipt.json`, including ordinary desktop,
phone geometry, dark layout and a1920x1080 print-media capture. The inspected print crop has readable
ink; complete printed pagination and physical printing remain unverified. Source remained unchanged.

Organisation acceptance passed on working-tree input, fingerprint
`ed3a08e2df496bdcf77442394084ee4801df462236dfffe4b60ff1eaff533aba`; existing restricted/unresolved
registry items remain visible. Screen-map and verification generators passed their structural checks.
Because a stylesheet source changed, bounded test-only FULL reuse is ineligible. Run a fresh FULL
on this corrected clean assembly, then clean typecheck and selected journeysALL before the local fold.

### Preserve main's concurrent documentation integration

The corrected FULL at `d770b40` passed **842 files /9887 tests /zero failures**, receipt
`full-gate-corrected/receipt-1790951460644-49260.json` in the private evidence root.
During that run, another authorised session advanced clean local main to `5f8f067` with six
documentation/tooling commits. Its changes are preserved as the new candidate base. The original
polish candidate remains committed and recoverable on `codex/polish-local-fold-20261002`.
The automatic source merge combines root-dotfile claim recognition with the previously reviewed
Git-environment sanitation and multi-branch release handling. Independent review found no defect;
21 hook/environment tests and11 new-main boundary tests pass. All229 maintained command references
resolve. App source remains byte-identical to the corrected polish candidate.

Two verification documents acquired active publication claims after the original approvals:
`screen-verification.json` and `SCREEN-VERIFICATION.md`. A preference question was offered; the safe
preservation option is used pending any explicit takeover authority. Main's exact versions remain
in the candidate. The original committed34-screen updates and
`D:/Temp/ward-polish-34-20261002/protected-verification-handoff.patch` retain the proposed updates,
with exact base/proposal identities in the accompanying JSON. They are not silently overwritten,
claimed reconciled or freshly verified by the structural generator. Primary visual receipts and
this canonical checkpoint remain the evidence for the actual polish review.

Next: commit this preserved-main assembly with normal hooks, reselect and run the required gates
on its stable source, fast-forward only the unchanged clean main, then implement the Showcase.
No provider, publication or deployment action is authorised by this continuation.

### Reuse the owner's runner fix and complete browser population

Local main advanced cleanly to `81bdd87`. Its original owner registered the same 11
boundary cases with Vitest, making the proposed private Node bridge unnecessary.
Independent review found no removed assertions and no app, dependency, runner-config or
executable-script change. The new integration branch starts from this latest main and
merges the committed polish candidate without overwriting the main commits.

`journeys-polish.json` completed at clean `c1d5b8a`: 93 passed, two existing skips and
one failure among 96 cases. The failing pre-selection assertion expected introductory
wording deliberately removed during polish. It now verifies the exact synthetic fixture
ward count in the diagram header; the selection and replacement assertions remain intact.
The full referral-to-discharge journey and other operational selections passed.
A focused coordinator rerun closes that failure; unchanged app/browser inputs support
reuse of the other completed cases, rather than repeating ALL solely for a test correction.

The verification-record owner's claims are now released. Exact-file ownership was checked
again, and the retained committed 34-screen record patch is applied. Its historical checked
revisions remain historical; structural generation does not substitute for visual review.
The earlier stopped combined-main FULL remains partial, not a pass. Run one final FULL and
clean typecheck on the stable newest-main assembly, then the authorised local fast-forward.
Showcase source and focused browser tests remain private until that fold.

### Bound the newly collected documentation fixtures

The stable run at `f133ea7` exposed one real new-main test-fixture defect:
`test-runner-safety.test.ts` found two recursive removals in the newly registered
`ward-documentation-boundaries.test.ts` without required bounded retries. Batch 1
completed 100 files /1541 cases with that failure; batch 2 completed 100 files /
1148 cases without failures. The owned run was stopped and its partial records
remain in `full-gate-final-source`. It is not a complete FULL result.

The released exact test file is signed out and both removals now use the established
`maxRetries: 5, retryDelay: 100` options. Both root-prefix checks and all 11 assertions
remain intact. App/browser inputs are unchanged. The generic safety guard reads other
test files, so the existing bounded failing-file-only recheck cannot establish this
correction; run one fresh complete FULL on the corrected stable tree, without weakening
that gate or manufacturing a change to the failing safety test.

The original fixture owner concurrently folded `a3e55d7` to main, solving the same cleanup
finding through the existing `removePathSync` helper. This latest owner version is preserved
exactly in the integration candidate. The coordinator's two-line alternative remains recoverable
at `1706c6b` but is superseded. The only merge conflict was that same test file; all 11 assertions
and both root-prefix checks remain unchanged. No application inputs changed. Refresh the focused
fixture/safety proof on the adopted helper version, then run the final complete gate once.
