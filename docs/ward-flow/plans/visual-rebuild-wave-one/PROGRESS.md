# SDD ledger — plan: docs/ward-flow/plans/2026-09-12-visual-rebuild-wave-one.md

This is the single current task-status and resumption record for this implementation wave. Only the controller edits it. Plan checkboxes describe the acceptance work; this ledger records whether it happened.

## Resume checkpoint

- Updated: 2026-09-13.
- Phase: seven-screen implementation and independent visual review recorded; integrated acceptance blocked by the mutation harness filesystem error and two pre-existing typecheck diagnostics.
- Controller: current Codex task, Astra; session/task ID `01a095da-708e-74a3-9fcf-1df1770b8347`.
- Checkout: `D:/Worktrees/Database/ward-lead`.
- Required branch: `codex/task-ward-flow-live-state-20260831`.
- App HEAD: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`; uncommitted seven-screen wave changes now present.
- Plan SHA-256: 1A78CB67348BA660315B01FF7D85C0CF651EFCFCE64A1E1A1FFE164C041124BA
- Review: [six findings and resolutions](../2026-09-12-visual-rebuild-wave-one-review.md). One scoped follow-up; final frame ownership correction checked by controller.
- Next action: owner inspection may proceed; resume only the failed harness gate after resolving Windows UNKNOWN/open contention. Do not repeat accepted matrices or the full suite. Exact commands, outcomes and limits: tasks/final-gate-checkpoint-r1.md.
- Active ownership: all implementation source returned to controller; no worker write claim or persistent role lease. Final read-only evidence audit acknowledged below.
- Test/browser execution owner: controller only. Full Ward runner finished and released its lease. No tests or browser work run by workers.
- Application checks: full run451/451files5031passed15failed75pending. Latest focused correction batch19/19files397/399; later Board/Delays/Hub pass and seam5/5 closure. Mutation remains failed. Final typecheck reports only two unchanged HEAD TS2578 comments. See final-gate-checkpoint-r1.md for exact, non-aggregated evidence.
- Human visual acceptance: pending for all seven screens and shared shell.
- Bootstrap: `start-codex-task.ps1 -TaskSlug ward-visual-wave-one` already ran in this task; retained the branch. Do not rerun for the same-task continuation.
- Preserved unrelated work: `.codex/config.toml`, `docs/agents/codex-reasoning-effort.md`, `scripts/check-codex-cloud-setup.mjs`, `tests/codex-cloud-setup.test.ts`, `.claude/launch.json`. Do not inspect secret-bearing contents or absorb these files.
- Authorisation: local implementation, documentation, scoped verification and temporary subagents. No staging, commit, push, PR, merge, deployment, provider operations or protected deletion/move. The user asked to finish this control setup before starting the screens.

## Task ledger

Use `ready`, `waiting`, `in_progress`, `review`, `agent_verified`, `blocked`, or `owner_accepted`. `agent_verified` requires scoped review and evidence; it does not imply human acceptance. Never turn `blocked` into a passing result.

| Task | Deliverable                                  | State   | Dependency / release condition                                                                  | Assigned agent     | Brief / report / review / evidence                                        |
| ---- | -------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| 1    | Mounted shell, opt-in primitives, frame seam | review  | Scoped visual and functional evidence accepted; integrated gates blocked (see final checkpoint) | controller         | tasks/task-1-report-r1.md; tasks/pilot-gate-report-r1.md                  |
| 2    | Search hub pilot                             | review  | Scoped visual and functional evidence accepted; integrated gates blocked (see final checkpoint) | controller         | tasks/task-2-visual-review-r1.md; tasks/task-8-hub-seam-corrections-r1.md |
| 3    | Statistics overview and compare              | review  | Scoped visual and functional evidence accepted; integrated gates blocked (see final checkpoint) | controller         | tasks/task-3-report-r2.md; tasks/task-3-visual-review-r1.md               |
| 4    | Command                                      | review  | Scoped visual and functional evidence accepted; integrated gates blocked (see final checkpoint) | controller         | tasks/task-4-review-r2.md                                                 |
| 5    | Delays                                       | review  | Scoped visual and functional evidence accepted; integrated gates blocked (see final checkpoint) | controller         | tasks/task-5-review-r1.md                                                 |
| 6    | Community team                               | review  | Scoped visual and functional evidence accepted; integrated gates blocked (see final checkpoint) | controller         | tasks/task-6-review-r1.md; tasks/task-6-report-r1.md                      |
| 7    | Bed board                                    | review  | Scoped visual and functional evidence accepted; integrated gates blocked (see final checkpoint) | controller         | tasks/task-7-review-r1.md; tasks/integrated-acceptance-r1.md              |
| 8    | Evidence roster and integrated acceptance    | blocked | Visual roster and fingerprints saved; executable gate blockers explicitly retained              | controller / Astra | tasks/final-gate-checkpoint-r1.md; tasks/integrated-acceptance-r1.md      |

## Decisions and blockers

- Design/behaviour precedence, scoped model routing, foundation pilot, nested primitive adoption and isolated statistics frame/content styles are specified in the [plan](../2026-09-12-visual-rebuild-wave-one.md) and its review record. Do not restate their requirements differently here.
- Current blockers: mutation self-test cannot reliably open its own file on Windows; typecheck has two source-confirmed pre-existing TS2578 diagnostics. Neither is waived. Human acceptance is pending. Local application identity and historical role-lease resolution remain as recorded below.
- Broader clinical/product decisions remain in the existing Ward Flow decision documents and [Ward Flow ledger](../../../ward-flow-ledger.md). This task ledger does not replace those records or the global work-claims/lease mechanism.

## Handoffs and messages

No implementation handoff is outstanding. Future durable message rows use:

| Message ID | Task / sender → recipient | Durable file | State | Acknowledgement / disposition |
| ---------- | ------------------------- | ------------ | ----- | ----------------------------- |

States: `pending`, `acknowledged`, `resolved`. Sending a tool message does not acknowledge it or transfer ownership. The controller records receipt and resulting action before dependent work proceeds.

## Evidence index

| Evidence                   | Source / scope                                                 | Result and limit                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning source inspection | App HEAD above; plan's named files                             | All 23 referenced test/spec filenames exist; no execution proof                                                                                                      |
| Adversarial plan review    | Linked review record                                           | Six issues corrected; final narrow ownership correction checked by controller                                                                                        |
| Control setup              | Plans index, this ledger, agent protocol and entry-point links | `PLAN_HASH_MATCH`; `TASK_LEDGER_MATCH=8`; `CONTROL_LINKS_VALID`. Scoped `git diff --check` emitted no errors. Scratch pointer is Git-ignored. No UI or engine proof. |

Screen visual results belong only in [screen-verification.json](../../screen-verification.json), with generated [SCREEN-VERIFICATION.md](../../SCREEN-VERIFICATION.md). Link them from task rows; do not keep a second editable screen-verdict table here. A global summary count is not proof every required viewport/theme was inspected.

## Append-only activity

- 2026-09-12 — Sol screen scout and shell scout, Luna verification scout completed read-only planning; reports consolidated into the plan.
- 2026-09-12 — Astra adversarial review and scoped closure check completed; resolutions recorded beside the plan.
- 2026-09-12 — Controller created this durable execution ledger and the agent protocol. Application work remains unstarted. Next update records the first dispatch and its acknowledged file claim.

- 2026-09-12 — Owner authorized beginning. Control status confirms all three persistent role leases none. Controller owns foundation (new spawn exceeded thread limit); two Sol inventories and Luna roster used available slots. Hub inventory and roster reports received and acknowledged. App identity verified at printed URL; HTTP mockup server running. Draft recipe supplied to Hub pilot; no visual acceptance yet.

- 2026-09-12 — Shell route titles, compact search treatment, grouped scrolling rail and truthful absence containers implemented. Primitive/frame and Hub writers acknowledged owned scopes. Parent accepted narrow chart-caption/badge scope extension to prevent old-scale descendant leakage. Baseline source-only assertion that Hub suppressed universal search was corrected by runtime evidence. App stopped during a transient Hub stylesheet replacement; file restored, writer instructed to use only in-place edits, and server recovery awaits coherent patch. No passing or visual-completion claim.

- 2026-09-12 — Independent Task 1 and Task 2 source reviews received. Hub input focus/48px target, print row visibility and ground corrections applied. Controller added marker-scoped WardGround transparency; plan ownership amended accordingly. Statistics frame receives the same root-ground/print correction. First shell runner summary: 3 handed in, 3 ran, 51 collected, 50 passed, 1 locator failure corrected. Pilot follow-up did not start because focused-test admission is occupied by another worktree. Second ensure attempt timed out; server diagnosis delegated read-only. No visual acceptance recorded.

- 2026-09-12 — Fresh app identity and rendered Hub confirm server healthy; reused without restart. First post-change visual review found right metrics squeezed by disclosure and excessive mobile nav height. Hub owner acknowledged bounded footer/order correction; independent Sol reviewer acknowledged exclusive rail-pair ownership for More pages correction. Controller retains bar. Plan ownership-only amendment acknowledged by both Sol workers. Appearance controls and root .75rem token checked; matrix still pending.

- 2026-09-12 — Hub correction and responsive rail reports received and acknowledged; controller now owns all pilot files for freeze. More pages focuses Network, Escape closes and returns focus to trigger. At820 global search input measures48px collapsed and expands same input on focus. Reproduced saved-Dark reload mismatch and uncached WardLiveRegion server snapshot; applied bounded fixes and two regression cases. Plan adds live-region ownership only. Current admission scout still found live other-worktree lease/queue, so tests remain blocked before start.

- 2026-09-12 — Independent shared-shell visual review of all12captures received: no remaining P0-P2 shell visual findings. Independent Hub all6cell review received: tableheader and attentioncardtype corrections requested, assigned toHubowner. Searchglyph restored; shortcutbadge rejected because slashfocusbelongs toglobal search. Hub visual inspection recorded with deviates verdict and exactdrawinghash, not complete. Settledreload appliesDark; lastcached-snapshoterror predates correctedreload. Morepagesfocus/Escape, lowerphonedisclosure, forced-colourfocus and printCSS/disclosureeventemulation checked. ActualPDFprinting unsupported. Latest coherentfocusedpilot attempt again blocked before testsstart by live accessibility-run lease in another worktree; no bypass or fullsuite/typecheck.

- 2026-09-12 — Final tableheaders/total, insetattentioncards/age andsearchglyph correction report acknowledged. Controller right-aligned the Ready header and corrected disclosure location wording. Final6appcells recaptured for narrowclosure. Five other pilot TS/TSX files have zero transpile syntax diagnostics and clean scoped diff; this is not typecheck/testproof. Exact uncommitted source fingerprints saved in tasks/pilot-checkpoint-fingerprints.json. Original dispatch metadata confirms Solmedium workers and Lunamedium scout; corrected generic GPT6 labels in reports. Next executable action remains focusedpilot admission and visualclosure, then acceptedrecipe release toTasks3-5.

- 2026-09-12 — Independent revision-2 Hub closure received and acknowledged: all6updatedappcells viewed, assigned table/card/glyph findings closed, no newoverflow. The verdict remains deviates for recorded engine/design adaptations, not a claim of identical content or finishedscreen. Updated generated verification record:1of18lookedat,nostructuralproblems. Human acceptance, physical-device proof and actualPDF output remainunverified. Pilot cannotreleaseTasks3-5 until focusedtestsobtainadmission. Temporary theme andviewport overrides restored, browser tabs retainedforresumption. Localbranch/HEAD unchanged; no Gitpublicationoperations.

- 2026-09-13 — Pilot focused gate accepted with exact per-file rerun accounting in tasks/pilot-gate-report-r1.md; Luna narrow source closure received with no issues. Statistics r2 and Command r1 exact ownership acknowledged before edits; first coherent implementations received. Controller implements Delays and compact statistics-frame presentation. HTTP drawing captures exposed a screenshot-only distortion from captureBeyondViewport=true on Statistics; actual-viewport capture resolves it, invalid references are excluded. Next: rendered inspection, focused batch and independent task review.

- 2026-09-13 — Task7 Board scope acknowledged; controller supplied both served drawing captures. Task4 correction report r2 received and source returned; Task5 independent all12-image review received with two presentation corrections and one open-sheet capture correction. Controller implemented Community first pass and first-consumer continuous figure band. Plan amendment adds controller-owned canonical Board URL builder needed by Change ward; no engine changes. Updated hash DEB1A10C336EB44856430D8C15D91B09EE5787B5762B3D55A0159DB0C772BAEB. Next: acknowledge Task7 interface addendum, apply Delays corrections, finish focused browser evidence.

- 2026-09-13 — Focused batch ran11/11 files,209 collected:203 passed,2 failed,4 pending; exact report tasks/focused-batch-r1.md. Corrected shell literal routes by importing canonical constants and scoped Delays population locator to its actual Waiting region. Community table/provenance, switcher-to-Albany empty-state and phone-table/print-disclosure checks performed; report task-6-report-r1.md. Board first review found filter-selection focus, print ancestor and hidden-warning regressions; bounded correction received. Command second visual review found queue-header shrink, phone pressure restoration and offscreen hub; all three corrected in CSS, runtime closure pending. Six-file follow-up runner now admitted; browser paused during it. Next: final visual correction closure, Board journey/matrix, then integrated gates.

- 2026-09-13 — All seven independent visual reviews received; accepted matrices and specific correction closures linked in tasks/integrated-acceptance-r1.md. Final Board runtime exposed global hidden-rule print conflict, corrected and measured20beds/3panels/dailySheet visible in print. Independent source review's quiet-filter/heading-visibility findings corrected and closed. All source returned to controller; full451-file Ward suite admitted once across3batches, browser paused. No passing full-suite claim until its own summary arrives.

- 2026-09-13 — Fullrunnerownsummary:451handedin451ran5121collected5031passed15failed,3batchesexit1/1/1; JSONreportsward-tests-qYA18Y. No repeatfullsuiteplanned. PlanTask8expandedonlyfornecessarystalecontract/canonicalownershipcorrections; hash2E6A6F90C7986829895E6FE8AD4D0C33CBDE3F973D35FDA8ABA6570B520F07C9. Solthreepresentationtestcorrectionsreceived; Lunaphone-parser/resolvedfallbackcorrectionsreceived; Hubcanonicaltable/localprinthook and Solnavigation/claimsboundedwritesactive. Next: finishbatch, verifyaffectedtestsandtypecheckonce; keepcurrentfullrunfailedratherthanroundingup.

- 2026-09-13 — All Task8 correction reports received and source reviewed. Forced-colour specificity corrected and runtime verified. Hub canonical table compactness and print restoration verified. Mutation residue proven task-induced and restored exactly; historical full-run failure retained. Affected17-file run refused admission before starting: PID2176 rag-local-build owns focused capacity. While blocked, bounded shell hover-card closure assigned to Statistics Sol under tasks/task-1-hover-card-brief-r1.md; exclusive Tooltip/rail/test paths there. New plan hash7714BAF3D8FCFFBAAE58BD03346A755C0F116912CD4FB34F605833D7B4B72E67. Next: review closure, then affected tests and typecheck when admitted.

- 2026-09-13 — Hover-card brief/hash acknowledged by Sol before correction handoff; implementation uses existing portal with opt-in semantics, preserving default Tooltip behavior. Controller requested geometry-reset and full-width-trigger checks. Independent Task8 seam review and mutation forensics reports received. Next: final card source/visual review, admitted focused gate, typecheck.

- 2026-09-13 — Final rail visual closure and bounded restore review received from Sol. Focused19/19 run397passed2failed; five-file follow-up63/65; final seam5/5 closes Tooltip membership/count pins. Four new role-query type errors fixed; admitted typecheck rerun reports only two unchanged HEAD TS2578 comments, independently classified. Final mutation diagnostic still RED due UNKNOWN/open at initial mutation write, while restoration recovered; anchor/probe integrity confirmed. All source returned. Checkpoint and fresh fingerprints saved; no further unchanged test retry. Integrated acceptance remains blocked, human acceptance pending.

- 2026-09-13 — Luna final evidence accounting clarified against source: fourteen original non-harness failures have passing exact or bounded replacement-contract evidence; mutation remains failed. Source fingerprints refreshed after one whitespace-only formatter correction. Scoped formatting and git diff whitespace checks passed; verification record7/18 with0structuralproblems, screen map38mockups40routes current.
