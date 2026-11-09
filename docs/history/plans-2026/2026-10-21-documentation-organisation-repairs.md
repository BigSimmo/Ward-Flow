# Documentation and organisation repairs

_Updated 2026-10-21 — local implementation of the two-pass audit; Documentation owns._

- Task identity: `WF-DOCORG-AUDIT-20261021`; continuation of the same audit objective.
- Stage: published as PR #526; reconciliation and CI repair authorised. No PR merge or deployment. The original local verification below is retained as dated history; the continuation checkpoint records subsequent evidence.
- Source: `BigSimmo/Ward-Flow`, PR branch `codex/ward-docs-organisation-repairs-20261021`; original implementation base `fc30c90c9cdae9a208786ade6e885750f770a7ea`.
- Original audit: local `main` at `5875823b5322f0b4ed2f5239628f88d40ea0195e`. Cached upstream is 578 commits later. Every finding was revalidated against the implementation base; obsolete fixes were not copied.
- Canonical task handling: [task receipts](../../task-receipts.md). This is an implementation checkpoint, not another task ledger. Remote reconciliation remains unsynced.
- Ownership: exact paths claimed in the existing shared sign-out log. Three isolated workers cover navigation, tooling and operational guidance; the coordinator owns integration and checks. Retained historical branches and the dirty main checkout are preserved.
- Specific authority: Josh approved a local exact-file takeover of `.github/workflows/ward-flow.yml` for missing documentation checks on 21 October 2026. This does not authorise publication or hosted execution.

## Acceptance

Correct remaining factual documentation and checking defects using existing mechanisms. Keep current routes, feature defaults, synthetic-data protections and historical records intact. Prove regression cases for changed selectors/classification/count policy and the workflow contract. Run selected local documentation and engineering gates on the consolidated inputs. Distinguish source-reviewed guide text from browser verification.

Larger source, test and CSS moves are conditional on demonstrated benefit. Do not perform them merely to match the proposed tree. Before any separately commissioned move, map imports, path-scoped safeguard populations, executable assets, generators and build/watch inputs, and preserve their coverage.

## Finding disposition

| ID  | Current-source assessment          | Action / evidence                                                                                                                         |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | Already corrected upstream         | First-run ownership log is mandatory; preserved                                                                                           |
| F02 | Repaired remaining route coverage  | Screen-map selector covers main, sign-in and digest source trees; positive and negative regression cases pass                             |
| F03 | Repaired local workflow definition | Five native checks and post-install site-map check added; executable mutations and 58 verdict cases pass; hosted outcome unrun            |
| F04 | Repaired maintained guidance       | Coordinator navigation follows current role-menu source, with explicit source-only evidence                                               |
| F05 | Repaired maintained guidance       | Clock and transport route corrected; September census fenced, two stale source explanations corrected                                     |
| F06 | Repaired forward navigation        | D28 item 4 points to D42; original ruling retained                                                                                        |
| F07 | Repaired plan navigation           | Current scope, dated checkpoints and completed/archived work distinguished                                                                |
| F08 | Repaired task/decision routing     | Both ledgers point to current homes; historical wording retained                                                                          |
| F09 | Repaired exact count contract      | Zero drift accepted; existing exports preserved; generated headline refreshed from 115 to 118 tracked scripts, 82 commands                |
| F10 | Already clarified upstream         | Advisory freshness description preserved                                                                                                  |
| F11 | Already corrected upstream         | All three generated reference outputs compared; local reference gate passed                                                               |
| F12 | Repaired remaining API reference   | Governance readiness row names `/v1/workspace` and `/commands`; already-correct setup/hosting routes preserved                            |
| F13 | Repaired classifier advice         | Existing out-of-scope files and proposed backend modules keep their paths; explicit registry-review guidance and regression cases         |
| F14 | Repaired public settings guidance  | Templates and hosting describe build-time settings, NODE_ENV defaults, device precedence and safeguard locking; no feature policy changed |
| F15 | Already corrected upstream         | Current psql example uses one backslash; preserved, no database action                                                                    |

## Organisation recommendation disposition

| ID  | Smallest useful treatment                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 | Keep one shared engine; document its pure-domain/build boundary. Any extraction needs a concrete consumer benefit and safeguard proof         |
| R02 | Clarify existing backend build/typecheck prerequisites without inventing a runtime dependency                                                 |
| R03 | Retain current test paths; the shallow journey selector cited by the old audit was retired upstream on 18 October. Do not recreate it         |
| R04 | Historical TypeScript documentation examples are absent on this base. No current template typecheck defect to fix; leave configuration intact |
| R05 | Retain accepted CSS and current appearance; consolidation requires component-specific cascade and visual proof                                |
| R06 | Improve the existing command navigation; no new tool registry or arbitrary executable moves                                                   |
| R07 | Correct classifier advice and state registry scope; do not move legitimate files just to satisfy old roots                                    |
| R08 | Explain design sources and their runtime consumers in existing navigation                                                                     |
| R09 | Retain protected components until a retain/reconnect/retire decision with caller evidence                                                     |
| R10 | Preserve recent upstream archive trims and restoration sources; no recreated or moved history                                                 |
| R11 | Link one documentation portal and shorten reader routes without losing unique instructions                                                    |
| R12 | Add a lightweight convention for new maintained pages at the existing documentation-system home                                               |
| R13 | No broad screen refactor without a demonstrated change boundary; preserve existing size ratchets                                              |
| R14 | Make executable documentation tooling and its check boundary explicit in the command map                                                      |
| R15 | Add guard-population preservation to the maintained migration acceptance procedure                                                            |
| R16 | Existing backend watch-input contract corrected upstream; preserve it and document remaining live-verification boundary                       |
| R17 | Keep digest/PWA literal file and URL contracts visible; no asset move                                                                         |
| R18 | Clarify pending target-specific recovery procedure/rehearsal; do not turn a planning checklist into claimed recovery proof                    |

## Verification checkpoint

Dependency installation: completed from the local npm cache with `npm ci --offline --ignore-scripts --no-audit --no-fund`; no registry access. The direct install-stamp invocation was refused by the lifecycle guard. The supported `npm run postinstall` then wrote the trusted stamp and retained the existing hook setup.

Fresh focused tests on the consolidated source: **163 passed, one platform skip**, six files. Command: `node scripts/run-vitest.mjs run tests/staged-docs-check.test.ts tests/docs-inventory.test.ts tests/ward-docs-maintain-pipeline.test.ts tests/ward-nav.test.ts tests/ward-public-ci-setup.test.ts tests/ward-policy-scope.test.ts --reporter=dot`. The skipped existing Windows case tests child-command timeout termination; it is not claimed passing. Earlier regression proof observed three failures before the tooling fixes.

Local gates passed: `npm run docs:maintain` (all generators, organisation, pack digests and documentation integrity gates); `node scripts/ward-ci-public/check-contracts.mjs` (58 aggregate verdict cases and rejected workflow mutations); `npm run typecheck`; owned-path ESLint; owned formatting; `git diff --check`. The full maintenance run exposed and then corrected the exact scripts-count drift. Affected checks are repeated after final edits; unchanged generated inputs retain their earlier evidence. Local Bash checks use a process-only Git Bash path preference because the Windows WSL launcher did not preserve synthetic verdict variables.

The dead-code guard initially refused removal of two recent inventory exports. Both exports were retained, with an explicit zero tolerance; `npm run check:dead-code-candidate -- --diff origin/main` then passed with no removed declarations. No override or weakened gate was used.

Independent review found one feature-default wording error, corrected in all three affected files and rechecked by the reviewer. A later narrow review accepted preservation of the inventory exports and the exact comparison contract. No remaining material review finding.

Local evidence is retained outside the repository in `D:/Temp/WardFlow-organisation-audit-20261021/`, including the final focused-test log, maintenance log, ownership manifest and final evidence manifest. All observations apply to the named base plus the exact owned working diff; no committed, hosted or deployed outcome is implied.

Full unit/browser/release suites, a fresh visual walkthrough, physical-device acceptance, provider configuration, hosted CI and a target-specific recovery rehearsal were not run. The guide identifies its source-review scope. R01/R05/R09/R13 remain conditional structural work requiring a demonstrated benefit, explicit ownership and focused acceptance; they are not unresolved factual repairs. No protected component, history or asset was moved or removed.

Next action: review the local repair diff and choose whether to commission publication as a separate stage. No user action is required to retain the local result. Remote ledger reconciliation remains unsynced.

## PR reconciliation checkpoint — 21 October 2026

Josh authorised reconciling PR #526 with current main and fixing CI, with no merge or deployment. After a concurrent writer published `9333ad44c9e85fb26f2613a69bf3edb7237af4f9`, Josh chose to continue from that published head. Its conditional documentation checks are preserved. The earlier local merge `9807de0e5bc6ed5ff60bdd3c0d8b131ef8a39b9b` remains intact in its original worktree and is not being pushed over the newer work.

The continuation uses `C:/Users/joshs/.codex/worktrees/ward-docorg-pr526-ci/Ward-Flow`, local branch `codex/ward-docorg-pr526-ci`, based on the published head. Main `785915e80ac3435d7a591c3b3e902c5da162c442` merges cleanly. The only repaired CI defect so far is the generated scripts headline: 132 was stale; the existing generator reports 130 script files and 85 npm commands. No executable inventory, threshold or required check was removed.

[Hosted run 39563273804](https://github.com/BigSimmo/Ward-Flow/actions/runs/39563273804), on published head `9333ad44c`, failed the scripts-inventory step with that exact mismatch. Its eight unit shards, production build, phone budget, three browser groups, backend/shared proof and coverage inventory passed. Those results belong to that head and do not establish the corrected candidate's CI status. Fresh checks and the eventual pushed SHA/run are recorded in the existing external evidence manifest at `D:/Temp/WardFlow-organisation-audit-20261021/final-evidence-manifest.json`.

The earlier candidate passed focused tests (163 passed, one Windows skip), documentation checks, lint, source/backend types and backend unit checks. Its full local unit run was interrupted because another project occupied the machine's wide-run slot; three completed batches had 3,995 passing tests. Local build and production-browser stages were not reached. Those incomplete results are not a full local-gate pass and are not reused as fresh proof for this continuation.

Independent review also reproduced two missing documentation-check inputs in the published selector: root `mockups/` changes and added directory paths that can introduce a tracked repository root. Both new regression cases failed before repair. The selector now includes those inputs while retaining conditional checks for unrelated modifications. No required gate is weakened.

Next action: finish selected local checks, commit the combined reconciliation and corrections, make one normal push to PR #526, then inspect that exact head's CI. Auto-merge is user-owned and was confirmed off. The dirty main checkout and all retained worktrees remain untouched. Remote task-ledger reconciliation remains unsynced.
