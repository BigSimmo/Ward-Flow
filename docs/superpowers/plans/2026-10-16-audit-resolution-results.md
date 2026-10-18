# Audit resolution results — 16 October 2026

## Post-merge reconciliation — 17 October 2026

PR [#381](https://github.com/BigSimmo/Ward-Flow/pull/381) merged as
`ed9d59e71a294787e4fd32c8363ee875c7b63161`; PR
[#382](https://github.com/BigSimmo/Ward-Flow/pull/382) merged as
`135c485f6aca3157f72df6e556dd67d83f677c6b`. The 44-item register below now records **43 findings
addressed in merged source and one open upstream advisory**, rather than 44 items awaiting a
handoff. This reconciliation preserves the original finding IDs and historical checks; it does
not claim that every original counterexample was independently repeated after merge.

R43, SEC-003 and the separate audit's QF-10 are the same advisory, maintained once in
[the dependency follow-up](../../dependency-security-exceptions.md#open-upstream-advisory-braces).
The [operations readiness record](../../ward-flow/operations-readiness.md) records the remaining
browser and recovery checks separately from confirmed defects.

[Ward Flow CI #2533](https://github.com/BigSimmo/Ward-Flow/actions/runs/39000996265) completed
successfully on PR #381's final head `d51008848ac4a34a2a3aac3b1c8e6aeb6974efa3`. Its production
job checked out merge `8e9c86425026f9d24726f3296a635f6a3e9b5383`, whose tree
`6442d8a8f717641cdc5c7fa819d91b79cd6eb368` matches the merged main snapshot above. The observed
successful jobs include static/backend, all eight unit shards, coverage, all three browser
groups, release journeys, secret scan and production build. This is hosted CI evidence for
that source snapshot; it is not proof of browser authentication or database recovery in the
deployed services. Later source or lock changes require their own applicable checks.

## Original implementation receipt

All 44 retained findings are accounted for: **34 implemented on this branch, nine already merged and rechecked, and R43 remains open because no supported upstream patch was available.** Implementation does not imply that every verification gate passed; the exact evidence and limitations appear below.

Final implementation and test commit: `ed06098435c80a783f5c16b4f10e5eb736f0ccf2` on `codex/resolve-audit-20261016`, from verified main `c9f271a98c96551bc3b3a725923461c02344a1f2`. That base already includes PRs #365 and #366. This is a local implementation receipt, not a current hosted PR inventory, hosted CI verdict, publication or deployment claim.

The [detailed plan](2026-10-16-audit-resolution.md) and [specification](2026-10-16-audit-resolution-spec.md) define six workstreams: domain validation, metrics, confirmed command outcomes, CI contracts, documentation, and backend/dependencies. Six implementation agents used isolated worktrees; their commits were integrated serially. Separate reviewers inspected the non-outcome changes at `b0ae5423`, the outcome changes through `fecdd8f3`, and the final ED correlation change now in `7721319e`. A final independent review inspected the nine integration-correction files through `9aca1c31` and found no high-confidence defects or hidden quality relaxation. Those source reviews are bounded source evidence; executed checks are listed separately.

## Every retained finding

- **R01 — Wait for shared confirmation before showing success or Undo. Implemented locally.** Command-specific accepted/refused/failed/cancelled completions drive feedback. Retry IDs, poll/role/token cancellation, restored replay, exact Undo sequences, world/account lifetimes, queued-reset cancellation and ED co-batch correlation are covered.
- **R02 — Reject malformed pull expiry and make printed handover null-safe. Implemented locally.** Stored pull expiry must be finite when present; malformed/null expiry is rejected, and handover formatting handles absent or invalid holds safely.
- **R03 — Sort capacity by the occupancy definition being displayed. Implemented locally.** Capacity sorting uses the occupancy definition shown to the reader, including held beds.
- **R04 — Use unrounded figures consistently for occupancy thresholds. Implemented locally.** Threshold classification uses raw occupancy values before rounding for display.
- **R05 — Stop treating stale capacity alone as no eligible bed on Delays. Implemented locally.** Stale capacity alone no longer establishes that no eligible bed exists on Delays.
- **R06 — Give seeded ward referrals a real recipient unit. Implemented locally.** Sent and answered seed referral arms name actual receiving units. Intentionally unaddressed queued candidates remain supported.
- **R07 — Validate discharge-blocker vocabulary before restoring it. Implemented locally.** Restored discharge blocker values must belong to the maintained blocker vocabulary.
- **R08 — Calculate comparison Mean stay from pooled admissions. Implemented locally.** Comparison summaries pool actual stay durations and populations. The explicitly labelled mean-of-wards table remains separate.
- **R09 — Exclude waitlist aliases from decline totals. Implemented locally.** No-bed aliases are excluded from genuine decline counts when matching ward/time waitlist history establishes the alias. Ambiguous legacy records are preserved.
- **R10 — Agree on the exact hold-expiry boundary. Implemented locally.** Delays uses the shared bed-hold expiry rule, including the expiry instant.
- **R11 — Show confirmed outcomes for shortlist cancellation and escalation. Implemented locally.** Shortlist escalation and transport cancellation feedback follows its own command result, including refusals.
- **R12 — Disable Release pull while a transport booking is active. Implemented locally.** An active transport booking exposes the cancellation precondition before releasing its bed. The unavailable action remains keyboard-focusable with an accessible reason and blocks Enter, Space and click without submitting or dispatching.
- **R13 — Exclude completed arrivals from overdue-arrival notification counts. Implemented locally.** Completed planned arrivals are excluded from outstanding counts while unfinished arrivals at instant zero remain included.
- **R14 — Offer the supported Undo after bed-board departure. Implemented locally.** All ward-board departure paths offer Undo only for the accepted recorded departure through the real provider helper.
- **R15 — Make CI contracts check executable workflow semantics. Implemented locally.** Workflow guards inspect active commands, routing, bindings and aggregate shell behavior; comment decoys and the specified unsafe mutations are rejected.
- **R16 — Make release journeys affect the required merge verdict. Implemented locally.** Release journeys participate in both ordinary and reused required-job verdicts and retain their own guarded execution.
- **R17 — Replace the CSRF integration test’s retired route and permissive success assertion. Implemented locally.** CSRF tests require GET 200 and allowed POST 405 on the existing health route, plus exact 403 rejection controls. The active Chromium CI lane explicitly selects this spec.
- **R18 — Add an authenticated HTTP plus real-store integration test. Implemented locally.** A regression composes real HTTP parsing, signed-token authentication with offline public-key lookup, PostgreSQL save, independent reload, stale conflict, retry and audit attribution.
- **R19 — Allow valid flake-ledger entries and bind quarantine records to actual tests. Implemented locally.** Nonempty flake entries must match actual configured Playwright collection, spec path and complete nested title; dead declarations and comment decoys fail.
- **R20 — Make coverage inventory verify actual files and invoke it in CI. Implemented locally.** Coverage uses shared include/exclude globs and compares actual executable files with LCOV membership. Declaration files are excluded consistently.
- **R21 — Correct the remaining testing and repository documentation claims. Implemented locally.** Testing commands, browser cadence, receipt reuse limits and retired ledger claims now match maintained source.
- **R22 — Identify the last successful save when restoring after a failed save. Implemented locally.** A retained older successful save is identified by its actual successful save timestamp, including beside a later storage warning; reset clears the identity.
- **R23 — Fence Since last look to the user and world generation. Implemented locally.** Last-look snapshots fence account, scenario, world generation and backward clock movement; older unfenced snapshots are ignored.
- **R24 — Classify scope refusals as scope in the audit. Implemented locally.** Scope refusals retain the scope reason in audit evidence rather than a later transition reason.
- **R25 — Bind broadcast stand-down attribution to the acting role. Implemented locally.** Alert stand-down records and audit attribution use the actual acting role.
- **R26 — Use the Perth calendar date for rules-export filenames. Implemented locally.** Exports use the existing Perth calendar helper for filenames.
- **R27 — Floor the census day boundary correctly for negative instants. Implemented locally.** Day offsets use floor semantics for instants before the reference day.
- **R28 — Repair reference-pack integrity and close its checker gaps. Implemented locally.** Reference-pack checking enforces recursive exact membership, canonical paths, regular files, bytes and hashes. The dependency-free pack-only CLI is wired into CI.
- **R29 — Correct clinical-safety-case references to the implemented controls. Implemented locally.** Safety-case source paths and D18 persistence behavior are corrected, with source-check limits explicit and no inferred approval.
- **R30 — Describe audit coverage accurately in the demonstration. Implemented locally.** Demonstration wording distinguishes session metadata from selective governance auditing and makes no universal rationale or immutability promise.
- **R31 — Resolve the PostCSS override’s incompatible dependency version. Implemented locally.** PostCSS 8.5.30 and a minimum 8.5.26 satisfy the installed Vite 8 dependency requirement.
- **R32 — Use a supported Codspeed/Vite combination. Implemented locally.** Codspeed 6.0.1 supports Vite 8 without the old forced peer override; Vitest and coverage remain aligned.
- **R33 — Keep sending desks’ outbound referrals and linked journeys in scope. Already merged and rechecked.** Merged code scopes outbound ward, ED and community access and trims receiving-side records.
- **R34 — Upgrade catchment dates-only stays correctly during break glass. Already merged and rechecked.** Merged break-glass code upgrades authorized catchment dates-only reads for its bounded read-only window.
- **R35 — Clear held-bed numbers when acceptance or a reservation ends. Already merged and rechecked.** Merged withdrawal, reopening, deterioration and release paths clear stale held-bed numbers.
- **R36 — Reset ward-specific bed and discharge fields on transfer. Already merged and rechecked.** Merged transfer behavior resets receiving-bed, discharge and step-down metadata appropriately.
- **R37 — Preserve diversion holds until their explicit bed release. Already merged and rechecked.** Merged diversion markers require explicit bed release before generic blocker clearing.
- **R38 — Accept valid support-notification state in shared snapshots. Already merged and rechecked.** Merged shared-wire validation accepts supported support notifications and scopes them to the correct receiving desk. The original defect rejected commands rather than corrupting persisted worlds.
- **R39 — Make the community contact form record what it asks for. Already merged and rechecked.** Merged contact UI asks only for the team/session timestamp it records; unsupported patient and modality inputs were removed.
- **R40 — Keep community rail shortcuts out of editable fields and use the rail store. Implemented locally.** Community delegates bracket navigation to the canonical rail owner, preserving tablet More behavior and desktop store/document agreement.
- **R41 — Reconcile PR #365 with current main before landing its repairs. Already merged and rechecked.** PR #365 is already merged at the verified main base; local ancestry includes the role/access changes and PR #366.
- **R42 — Resolve the two failing PR #365 scoping/validation regression tests. Already merged and rechecked.** The corrected real-service fixtures and backlinks reach their intended assertions and pass.
- **R43 — Track the still-open braces tooling denial-of-service advisory. Open — upstream blocked.** No supported patched braces release was available. The development-tooling advisory remains open with bounded mitigation and a 22 October follow-up.
- **R44 — Acknowledge genuine admission-backed absence alerts. Implemented locally.** A current absence for an existing, non-departed admission on an order can be acknowledged by the permitted coordinator; voluntary, departed, returned, missing and wrong-category records are rejected, matching the actual alert derivation.

## Evidence and limits

Fresh integrated evidence on the committed combined source:

- Full lint and full typecheck passed after the final corrections (`9aca1c31`).
- The initial selected local verification passed runtime, changed-file formatting, diff integrity, documentation scripts/links/index/inventory, installed-lock parity and CI contracts. Final handover documentation checks also passed: 146 script references resolve, zero broken local links with 28 historical line advisories, all 19 indexed roots/modules/routes covered, inventory within its existing tolerance, and diff integrity (23/23 self-tests; 35 changed test files, 377 to 437 static test cases). These static test-case counts are separate from executed test counts.
- The full backend suite passed **198 tests, zero failures and zero skips**, including authenticated HTTP/save/reload/conflict/retry/audit against an owned loopback PostgreSQL database. The database was stopped cleanly afterward. That evidence is reused; no backend source changed afterward.
- The real request-only CSRF spec passed **all nine cases, zero retries**, against a server whose project identity matched this worktree. It demonstrated GET 200, allowed POST 405 and exact 403 rejection controls. It used HTTP request/pure fixtures; it does not establish a browser-journey pass. The API server was stopped afterward.
- The complete unit run on `9aca1c31` collected **1,192 files and 13,169 tests**: 13,152 passed, one historical conditional skip, 15 assertion failures from changed contracts/fixtures/observers and one settings-import timeout. All files reported; tooling was included. The preserved complete receipt was submitted to the repository's guarded bounded recheck; the guard subsequently refused reuse.
- The guarded bounded recheck on test-only commit `ed06098435c80a783f5c16b4f10e5eb736f0ccf2` was **refused**, with no test run or merged pass: its module-resolution analysis remains globally uncertain. Diagnostic analysis found 335 unresolved CSS imports, four `createRequire` forms and eight computed loads, with no TypeScript-config/read/parse failure. The resolved edges did not reference the eight changed tests, but unknown edges prevent the guard from approving reuse. The guard was retained.
- Direct verification of all eight corrected suites passed **215 tests across eight files** in 79.31 seconds, under the same two-worker configuration and existing budgets. Normal hooks passed lint and typechecking on all eight files. An independent reviewer checked the actual `9aca1c31..ed060984` diff and found only the reviewed test corrections plus formatting, with no production/configuration change or material quality relaxation. This focused result is not a full-suite verdict.
- The fresh full-unit attempt on `ed060984` was deliberately stopped after it had already reported two timeout failures. Its two completed batches reported **200 files, 2,731 tests: 2,728 passed, one historical skip and two failures**. The citation-guard scan and capacity-observation DOM test exceeded the unchanged 30-second budget (42.46s and 32.19s); they passed in the previous complete run in 8.31s and 0.49s. These test files and their relevant production code are unchanged between these two heads. Independent source review found no demonstrated correctness defect or established timing cause, so no speculative optimization or timeout increase was made. Batch three was interrupted and produced no report; the runner exited nonzero. This is partial diagnostic evidence, **not a completed full-suite pass**. The owned runner and its children were stopped and their absence checked.
- **Outstanding verification work:** obtain a passing complete unit verdict on the final head, investigate the two timeout failures without relaxing budgets or assertions, and run the required browser/build checks when the pinned browser and usable dashboard are available. The refused bounded recheck, focused 215-test pass and prior complete run cannot be combined into a formal passing full-suite receipt.
- The sole historical skip is the unchanged `diff-integrity.test.ts` regression requiring absent commit object `d1485d6e8`. It was not newly quarantined or excluded.

Integration failures were corrected rather than hidden. A stale v1 last-look fixture failed both typecheck and its runtime contract, then passed with a v2 account/generation-fenced snapshot while legacy refusal controls remained. The initial unit attempt was intentionally stopped after five batches when it exposed a real inaccessible Release control; its 500-file/6,265-collected-test partial output is diagnostic, not a full-suite result. The accessibility regression failed before the fix and passed afterward.

Flake-ledger controls now validate the valid and invalid entries in one real collector call with distinct IDs and exact error reasons. Coverage fixture cleanup uses bounded filesystem retries. The runner contract asserts both shared coverage bindings. Discharge tests reuse verified connected semantic nodes; the column contract still checks every row in every group, parameterized across all four groups. Existing assertion populations, budgets, retry policy and coverage/discovery floors remain intact. Default Vitest concurrency changed from four to two workers with the explicit override retained; this is resource configuration, not a timeout increase or excluded population. Controlled baseline/candidate diagnostics were variable and included baseline timeouts, so they do not establish an introduced production performance cause. Hosted eight-shard timing and its unchanged 15-minute deadlines remain unobserved.

Final test-only corrections retain all 215 cases across eight files. Recovery checks require the successful last-save notice while retaining state, audit, clock, privacy and one-time consumer assertions. Genuine no-bed and still-referable populations are both nonempty and exhaustive; all movements stay open, genuine no-bed flags remain and referable cases explicitly exclude that cause. Four terminal-decision tests now address their actual valid seeded ward, retain coordinator scope and exact refusal messages; RF-004's UI expectation names its concrete recipient. The dispatch inventory removes the genuinely retired Undo forwarding exception while preserving AST refusals, construction pins, exact inventory equality and discovery floors. Transport observation moves from reducer evaluations to the actual screen dispatch boundary and still requires exactly one unchanged ETA. The settings import test reuses the live control's small parent for the same named semantic query, with an explicit edited-value premise, connection, saved-state equality and exact visible rejection. All seven settings cases and the 30-second budget remain. The timeout's cause was not established; no production performance fix is inferred.

Focused worker evidence, reused from each committed workstream:

- Domain: 84 tests across four files; importer checks covered 199 tests across eight files. The ordinary sampled schema gate passed. A separate full schema comparison timed out after 301 seconds after writing its comparison artifacts: 20,016 original cases, 28 added recipient-key cases, 12 intended stricter blocker refusals and no relaxed original verdict. That diagnostic timeout is not a full-run pass.
- Metrics: 124 tests across seven files.
- CI: 59 workflow tests, nine flake-ledger tests, five coverage-inventory tests and 58 aggregate shell cases. Coverage claims apply to the declared `src`/`scripts` include/exclude population, not every language or backend file.
- Documentation: 46 focused tests across three files, exact reference-pack checks and the read-only maintenance aggregate. Reference-pack membership and bytes are verified; this does not establish semantic freshness or clinical ratification.
- Landed fixes: 118 tests across seven files on the merged base; R39 additionally source-reviewed and R41 verified through local ancestry.
- Outcomes: focused client/provider/DOM/storage suites and normal changed-file lint/type hooks passed. Early failing fixture runs were corrected before the final commits. These focused populations overlap and are not added into a fabricated full-suite count.
- ED correlation follow-up: a valid unrelated refusal co-batched with this command's accepted completion reproduced the missed Undo offer. The new test failed before the fix; both affected suites then passed all 38 tests.
- Backend composition: the deliberately miswired scratch negative control failed independent reload as expected, and the healthy committed composition test passed. It uses generated signed tokens, an offline key lookup and a disposable loopback PostgreSQL database, with no provider calls.
- Dependencies: clean trusted `npm ci --include=dev`, supported peer validation and local benchmark-configuration loading passed. Production audit reported zero vulnerabilities; the full audit retained five high-severity dependency entries arising from the one open braces advisory. No benchmark or telemetry upload was run.

Important appraisal corrections retained:

- R09 removes no-bed aliases only when matching ward/time waitlist history establishes their meaning. Ambiguous legacy declines remain counted; independent Delays labels are outside that statistics correction.
- R38 originally rejected shared commands during validation; the evidence did not establish persisted-world corruption.
- R44 was reproduced with the permitted coordinator role, correcting the original probe's ward-role assumption.
- R43 remains tracked in [dependency-security-exceptions.md](../../dependency-security-exceptions.md), with bounded mitigation and a 22 October 2026 review. No unsupported forced downgrade was used.

The pinned Playwright Chromium download was attempted and refused with HTTP 403 by the environment's CDN policy. No mismatched system browser or fake cache was substituted for a required gate. The normal `npm run ensure` was attempted: the local project identity endpoint responded, but dashboard cold compilation exceeded readiness and no usable app URL was claimed. Profiling identified expensive React Compiler analysis; a separate live lint input was the unchanged `shell/ward-bar.tsx`, byte-identical to the main base. The provider compiler control completed successfully and faster on the candidate than the base. These observations do not prove the dashboard startup cause, and no speculative component rewrite or compiler suppression was applied.

No hosted CI, remote publication, deployment, physical Safari or installed-PWA acceptance was observed. The owned API and PostgreSQL services were stopped after their checks. Usable dashboard readiness is not inferred from source, HTTP or unit evidence.

## Publication alignment — 17 October 2026

The prepared commit `f916ac34` was checked against current main `7b14c9888d2ed2e534a55b2e366ddaf91f5d690b`, which adds nine merged PRs. A merge preview demonstrated four actual conflicts, so main was integrated into the existing audit branch. The resolutions retain the newer role/access request fences, same-revision payload identity, bounded sequential event logs, shared download helper and both PostgreSQL suites, together with this branch's command completions, restoration outcomes and Perth filename date.

A fresh independent adversarial review found an integration defect: an accepted command could be reported failed, refused or cancelled if the separate post-grant reconciliation read failed or required sign-in/role selection. The command's definitive result and its own Undo records now settle before that permissions-only read; failed reconciliation requires a fresh board read without repeating the mutation. Session and role gates invalidate older feedback lifetimes. A targeted regression reproduced expected acceptance versus actual failure before the correction. Controls cover network failure, HTTP 401/403/409, token-session failure and automatic role expiry.

Fresh alignment checks: five affected client/provider/export/navigation suites passed 65 tests before the final sign-in/role controls; the two complete shared-client suites then passed 60 tests on the final correction. Backend engine bundling, backend typechecking and all 38 real PostgreSQL tests passed with zero skips; the owned loopback database was stopped afterward. The initial backend typecheck exposed a stale generated engine bundle and the new TCP-address union type; rebuilding with main's maintained build script and asserting the owned server's TCP address corrected those diagnostics. These are focused and backend results, not a new full-unit/browser verdict.

The open-PR snapshot contained #335 (grouped dependencies), #336 (Vitest), #337 (coverage), #338 (ESLint), and #380 (hosting documentation). The dependency PRs overlap this branch's package files; this branch retains its reviewed compatible toolchain rather than absorbing those unmerged upgrades. #380 changes only `docs/hosting.md`, which this branch leaves intact. No unrelated PR was modified. Main was checked again at the same `7b14c988` head before publication. The R43 and complete-unit/browser limitations above remain open and belong in the draft PR description.

## Merge-readiness repair — 17 October 2026

PR #381's first hosted run on `7574eb34` exposed one stale unused-code baseline entry: `ward-derivations.ts:isArrivalLate` is now used by the corrected outstanding-arrival notification path. The supported ratchet reproduced the failure locally. Removing that one baseline entry preserves the live helper and its caller; no source code or export is deleted, and the baseline is not enlarged. The arrival predicate still requires an open movement before testing lateness.

The first hosted run also demonstrated a successful production build, backend check and whole-tree lint. Its browser runners installed the pinned browsers successfully; the earlier CDN restriction belongs to this local environment. Partial job results do not establish a completed required verdict. Current-head final CI, unit/coverage shards and browser/release results are recorded on [PR #381](https://github.com/BigSimmo/Ward-Flow/pull/381/checks); those results must pass before merge readiness is claimed. The local full-unit rerun is deferred pending the observed hosted verdict; equivalent evidence requires the exact head, workflow and full selected population. A job name alone is insufficient.

Requirement alignment: the 44 bullets above provide each retained finding's disposition, the linked six-workstream plan records implementation ownership, and the publication follow-up records current-main/open-PR reconciliation and the independently reviewed command-confirmation repair. This repair addresses the actual hosted ratchet failure without changing assertion populations, timeouts, required jobs or dependency versions. `braces` was rechecked on 17 October and still reports version `3.0.3`; the upstream advisory remains open under the existing bounded exception, not silently closed.

Risk: shared-command confirmation and Undo affect feedback across role/account/world changes; tightened restore/referral rules can refuse previously malformed inputs. Required unit, backend, browser and release checks remain the acceptance evidence. The development-only braces advisory remains a documented residual risk; no zero-vulnerability or deployment claim is made.

Rollback: if the change causes a regression after merge, prepare a separate revert PR against main for this PR's squash commit, or revert its merge commit with mainline parent 1. Keep later main changes intact, run the normal required checks and obtain review before merging the revert. Do not reset or rewrite shared history. This PR introduces no database schema migration, so no reverse database migration is required. Verify sign-in, shared save/reload/conflict, departure/Undo and restore behavior on the reverted candidate; do not delete saved data to simulate recovery.

The next adversarial review reproduced two boundary defects and corrected them without changing required gates. R44's row-existence check now matches the actual on-order, non-departed absence projection. Three negative controls failed before the correction; all 25 domain regressions pass afterward, including a genuine derived alert and the existing role/category controls. The support-notification form now fences accepted-save dismissal to the submitted draft revision. An earlier acceptance preserves a reopened form, including the same party, or edits made while saving; its unchanged submitting draft still closes and refused/failed saves remain open. Three race regressions failed before the correction; all 13 feedback tests pass afterward. Final hosted acceptance remains tied to the current PR head in the checks link above.

The same review round reproduced premature “Mark them back” feedback: the board started up to two saves but discarded their completions. It now waits for all saves started by that action and reports a refusal or failure from either command. Mixed results explicitly report a partial save rather than forwarding an inaccurate “Nothing was changed” message. Ten leave-bed board tests pass, retaining the original three cases and covering either command's refusal/failure plus an all-refused control. Concurrent automatic fixes were fast-forwarded into this branch and reviewed rather than overwritten. Scenario-file replacement correctly cancels discarded pre-adoption commands; all six provider-completion tests pass, including a new StrictMode regression verifying exactly one cancellation and preservation of the loaded world. The automatic audit-actor simplification is retained as benign hardening: broadcast stand-down is not currently captured by the structured audit classifier, so a structured-audit attribution mismatch was not demonstrated.

Review of the automatic changes caught regressions in role switching and Undo. A deliberate role change now distinguishes an already-started save, whose result may be uncertain, from commands not yet sent; it clears stale work without silently ignoring the role control. A started save is reported as failed with explicit uncertainty, and unsent work is cancelled. Undo requires the fresh record from its own accepted command, preserving that record across successful grant reconciliation; an absent or hidden record does not authorise an unbound Undo. A separate memory-only availability fence prevents Undo dispatch while the shared board is unavailable, without changing a definitive acceptance or the role/account/world lifetime fence. All 77 cases in the three shared-client/command-completion/feedback suites pass after these corrections; independent source review found no further material defect in the reviewed changes. The normal required checks remain unchanged.

A further real-toast review corrected temporary Undo blocking. Availability now matches the command queue: an existing snapshot may accept Undo while ready or saving. A temporary refusal returns `false` through the hook, toast provider and button, retaining the same mounted toast and its remaining window. No timer or key is reset. Successful callbacks and permanent lifetime refusals consume the toast normally; throwing callbacks retain their prior settlement behaviour. Real provider/button regressions cover retry with the original record sequence, expiry at the original deadline, and permanent refusal. Shared toast controls also cover deferred expiry and callback-driven eviction, keeping existing callers' behaviour intact. All 98 cases in the four focused shared-client, command-completion, feedback and toast suites pass; independent source review found no remaining concrete defect in this correction. Final hosted acceptance remains tied to the exact current PR head.

Local board refusals also retain explicit outcome wording: both the visible toast and live announcement prefix a refused command with “Action refused”. Failed and cancelled messages remain unchanged, and partial-save messages retain their qualification without a blanket no-change claim. A real local arrival refusal reproduced the missing prefix; all 13 board tests pass, including failed/cancelled controls and the earlier partial-return regressions.

## Post-merge close-out and remaining acceptance — 17 October 2026

[PR #381](https://github.com/BigSimmo/Ward-Flow/pull/381) merged as `ed9d59e71a294787e4fd32c8363ee875c7b63161` on 17 October at 04:14 UTC. Its final integrated head `d51008848ac4a34a2a3aac3b1c8e6aeb6974efa3` passed [Ward Flow CI #2533](https://github.com/BigSimmo/Ward-Flow/actions/runs/39000996265). The required job reported static/backend, unit, browser, secret scan, production build, coverage and release results all successful. All eight unit shards and all three browser groups passed. This observed hosted verdict supersedes the earlier pending full-unit/browser and merge-readiness observations above; those dated local failures remain historical evidence. This follow-up reuses that completed workflow rather than claiming a fresh full-suite run.

The two final review commits were included before integration: session termination by another request reports an already-sent command as uncertain; the action inbox uses the canonical bed-expiry boundary; support-notification refusals have one feedback channel; partial returns retain honest save wording; recovery tests account for device time; and the demo Q&A no longer promises universal clinical justification or enforced peer review.

The follow-up checked current main and open PRs before editing. PR #385 subsequently merged as `a8983c41`, recording the prototype psychiatrist-attestation decision. This follow-up integrates that documentation commit and preserves its accepted decision. PR #387 also merged as `2999baf9`; its prototype sign-off notes and matching ledger decision wording are preserved. PR #384 changes role grants and remains separate. PR #335 groups dependency updates, including Next 16.4.0, but does not remove R43's dependency chain. Josh accepted retaining numbered placeholders for community readers of typed discharge criteria; the existing implementation and its tests already enforce that choice, so no behaviour change is needed.

Fresh lockfile audits still report five high development package entries for the one R43 advisory and zero production vulnerabilities. Registry checks establish no supported patch in braces or its latest parent packages. R43 stays open under the [bounded exception](../../dependency-security-exceptions.md), with review due 22 October. No forced downgrade, blind override or reduction in lint coverage was used.

Read-only Railway deployment records identify this same merged commit for the main app, backend and shared frontend. The app deployment `f34b174f-83f7-4d44-9ef0-0eff3424df6e` and backend deployment `906d84d0-21b6-4cc0-9d18-73408145439a` report success; the shared frontend deployment `f21c47cb-c62d-4df9-afc6-66fd03c1e286` reports sleeping. These observations establish deployed source identity and provider status, not authenticated application acceptance.

Direct access to the hosted app's health endpoint was blocked by this execution environment's network policy (CONNECT HTTP 403). No live authenticated save, reload or conflict check was performed in this follow-up. The separate dated hosting record describes earlier synthetic-account HTTP checks; it is not fresh browser evidence for this deployment. Physical Safari and installed-PWA acceptance also remain unverified. Complete these checks with approved network access and a configured synthetic test session before claiming them passed.

## Current-main follow-up — 17 October 2026

This continuation reviewed main `5875823b5322f0b4ed2f5239628f88d40ea0195e` after PR #335
merged. The current dependency path and toolchain snapshot are recorded in
[the dependency follow-up](../../dependency-security-exceptions.md). jsdom 30.1.3 requires
Undici `^8.12.1`, while the inherited global override left 8.11.2 locked. Raising that override's
minimum to `^8.12.1` lets npm select 8.12.2. Only that package's version, URL and integrity change
in the lock; unrelated platform metadata is preserved. This aligns a declared development
requirement; no application runtime failure was reproduced.

A fresh locked install with lifecycle scripts, installed-lock parity, dependency-tree inspection,
owned formatting, documentation checks, full lint and typecheck passed. The full unit gate
requires a committed clean tree and did not execute before this checkpoint; browser journeys
also remained unrun at that boundary. These checks are not a full-suite or merge-readiness
verdict. Current candidate results belong with the exact published head's checks and task receipt.

Four parallel source reviews covered recent backend/auth adapters and pruning changes, merged
dependency compatibility, and open PRs #396 and #397. No concrete backend regression was found
within that scope. At reviewed heads `216fde77` (#396) and `b0f5fbe6` (#397), required CI had
failed. Review confirmed local-only discharge/checklist success claims and a hypothetical-versus-
current referral suitability mismatch in #396; #397 had an unterminated test string and an
ambiguous-merge admission fallback that discarded required paths. Proposed repairs are retained
privately for exact-file ownership coordination with those active PRs. These are separate from
this dependency correction, and are not claimed applied or passing here.

The fresh full lockfile audit still reports five high development entries for the one R43 advisory;
the production audit reports zero vulnerabilities. The registry still reports braces 3.0.3, so R43
remains open with its 22 October review. No unsupported downgrade or advisory suppression was
used. Hosted acceptance, current deployed revision, backup/recovery acceptance, physical Safari
and installed-PWA checks remain unverified. No Railway or Supabase access was attempted in this
continuation; the reported host-grant rejection remains unresolved.
