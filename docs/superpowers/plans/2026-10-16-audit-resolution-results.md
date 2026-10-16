# Audit resolution results — 16 October 2026

All 44 retained findings are accounted for: **34 implemented on this branch, nine already merged and rechecked, and R43 remains open because no supported upstream patch was available.** Implementation does not imply that every verification gate passed; the exact evidence and limitations appear below.

Code reviewed: `7721319ec68917a54f60434a820dec0cc858b901` on `codex/resolve-audit-20261016`, from verified main `c9f271a98c96551bc3b3a725923461c02344a1f2`. That base already includes PRs #365 and #366. This is a local implementation receipt, not a current hosted PR inventory, hosted CI verdict, publication or deployment claim.

The [detailed plan](2026-10-16-audit-resolution.md) and [specification](2026-10-16-audit-resolution-spec.md) define six workstreams: domain validation, metrics, confirmed command outcomes, CI contracts, documentation, and backend/dependencies. Six implementation agents used isolated worktrees; their commits were integrated serially. Separate reviewers inspected the non-outcome changes at `b0ae5423`, the outcome changes through `fecdd8f3`, and the final ED correlation change now in `7721319e`. Those source reviews reported no remaining high-confidence actionable regression in their bounded diffs. Executed checks are listed separately.

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
- **R12 — Disable Release pull while a transport booking is active. Implemented locally.** An active transport booking exposes the cancellation precondition before releasing its bed.
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
- **R44 — Acknowledge genuine admission-backed absence alerts. Implemented locally.** A valid absence row backed by an admission can be acknowledged by the permitted coordinator; wrong-category and missing records are rejected.

## Evidence and limits

Verification is still running; this section will be finalised before the receipt is committed.

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

No hosted CI, remote publication, deployment, physical Safari or installed-PWA acceptance was observed. Temporary local services are owned by this task and will be stopped after verification.
