# Audit finding appraisal and bounded remediation

Audience: Ward Flow engineering and Josh. Status: blocked on exact-file ownership approval; bounded config fix committed locally. Owner: Codex coordinating the requested subagent swarm. Synthetic data only.

Original objective: reassess all 54 findings in the supplied master report, stress-test credible claims, fix bounded defects, and defer challenging work or significant design changes. Source baseline: `BigSimmo/Ward-Flow` main `dd81e1c327c0776a0f1afdd1366919e756c3647a`; branch `codex/audit-remediation-20261103`.

## Current implementation

WF-15 narrows both TypeScript root-file sets to omit date-shaped root backup directories (`mockup-backup-????-??-??/**`). Real `mockups/`, ordinary source, MTS scripts, undated similarly named source directories and similarly named root TS files remain included. A broad prefix exclusion was rejected because TypeScript also excluded a genuine similarly named root file. The regression keeps that source-preservation assertion.

Focused scope regression: four cases pass after two expected exclusion failures before the change. Local commit `5bdcf9941` contains the fix and its regression. Normal commit admission, selected lint/type checks and the four focused scope cases passed. Local locked dependencies were freshly installed through the repository installer and attested; lifecycle scripts were disabled. Matching npm 11.17.0 was provisioned outside this checkout.

## Reproduced defects awaiting exact-file ownership

- WF-01: collection accepts an open restrictive-practice episode; four targeted cases fail before the proposed guard, and four boundary/compatibility cases pass.
- WF-02: legal handover copy omits passed recorded times; three cases fail before the proposed correction and ten boundary/input cases pass. Keep D-93 typed-time wording and one counted row per form.
- WF-04: both originally examined stand-down buttons dispatch immediately. Twelve real-confirm-host cases failed against the original implementation. Independent review identified a third reachable button, stale local-clock callbacks and cross-world consent. The unapplied proposal now uses the existing styled host and command-lifetime predicate; its regression file has 34 cases covering three surfaces. That expanded regression awaits execution after source authority and application.
- WF-05: discharge/community 12-hour literals remain. Existing string assertions need corresponding updates.

The four repair proposals apply cleanly in check-only mode and have independent source review with no remaining concrete blocker. They remain unapplied. These tests are diagnostic reproductions, not passing acceptance. New failing regressions remain uncommitted until their associated sources may be repaired. Existing-source overlaps on the shared claim board require the pending exact-file takeover; no peer source is edited without it.

## Deferrals

- WF-03: inpatient downtime census plus legal coverage requires coordinated admission identity/current-form resolution, frozen output inputs, approved four-tab screen and print changes. Deferred as a significant cross-layer/design extension.
- WF-06/WF-07/WF-08/WF-09/WF-10/WF-11: clearance/acknowledgement history, attribution, ISBAR clearance, repatriation indicators, retrospective dated entry and governance views extend data/UI contracts. Defer to scoped work rather than adding unreviewed fields or duplicating shared audit.
- WF-12/WF-13/WF-14: broad bundle/refactor/suite optimisation needs new measurements. Configured script ceilings and historical worker totals do not prove current route sizes or elapsed runtime. Existing targeted negative/concurrency tests were inspected and selected existing cases exercised.
- WF-16/WF-17/WF-18: unknown-clearance transport policy, broadcast visibility and Ready/occupancy semantics are deliberate product rules. Preserve until the relevant policy is explicitly changed.
- WF-19/WF-20: mock contacts are not emergency contacts; TV clicker/rotation/legal summaries are optional new presentation modes.
- WF-21/WF-22/WF-23: Windows lock/filesystem claims and unspecified obsolete-governance assertions need concrete machine/assertion evidence. No cleanup or test deletion.

## Supporting executed evidence and limits

- Three selected dead-owner/forced-release/heartbeat lock cases passed; 43 cases were not selected.
- Existing clearance provenance, admitted-form progression, Ready/preparation and overlapping UI-save tests: four files and twelve tests passed. These support retaining the disputed contracts, not a universal assurance.
- Pinned Playwright Chromium is unavailable (expected revision 1248, no managed install). Browser/print/physical-device acceptance is unrun. The temporary offline local server was identity-verified as Ward Flow and stopped; no provider backend was used.
- One broad TypeScript run found a new fixture ID typing error; that fixture was corrected. The corrected working tree, including all three uncommitted regression files, subsequently passed the repository typecheck command. This does not typecheck or accept the unapplied implementation proposals.
- No hosted CI, provider-backed test, source publication, PR, merge or deployment is authorised or claimed.

## Handoff and exact remaining boundary

The user approved issue 688 ownership claim/release comments only. Existing source and test overlaps require the separate pending exact-file takeover: the initial twelve paths plus the three supplemental paths. No silence or prior comment permission is treated as takeover. All peer work remains preserved.

External task checkpoint and reviewable proposals: `/workspace/ward-flow-review/fix-task/`. The exact scope is in `takeover-scope.md`; `bounded-source-repairs.patch` combines the four unapplied proposals. The local checkout is `/workspace/ward-flow-fixes`. Three uncommitted tests are deliberately retained as diagnostic work: `tests/ward-restrictive-practice-collection.test.ts`, `tests/ward-legal-handover-copy.test.ts` and `tests/ward-broadcast-stand-down-confirm.dom.test.tsx`. They must accompany the repaired implementation, not be published as passing on this branch alone.

Next: obtain exact-file ownership, append claims, apply the reviewed patches, run the targeted green and related checks, then inspect affected interactions when a matching browser is available. No source push or integration follows implicitly.

## Every original issue retained for traceability

These are appraisal dispositions; work-package completion is tracked above. The original summary said 49, but its body has 54 unique IDs. Eight source-confirmed observations are distinct from the proposed preventive config fix.

| Original ID   | Assessment   | Proposed work / disposition                                                                                                             |
| ------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| ISSUE-STAT-01 | Confirmed    | WF-02                                                                                                                                   |
| ISSUE-STAT-02 | Disagree     | Deliberate form progression and recorded-time rules; no restored 72-hour calculation.                                                   |
| ISSUE-STAT-03 | Disagree     | Passed/upcoming states already have different words; no mandatory flashing or sound.                                                    |
| ISSUE-CLIN-01 | Partly agree | WF-16                                                                                                                                   |
| ISSUE-CLIN-02 | Partly agree | WF-07                                                                                                                                   |
| ISSUE-CLIN-03 | Not current  | The misleading screen-only ED review/clearance selector is removed.                                                                     |
| ISSUE-CLIN-04 | Partly agree | WF-06                                                                                                                                   |
| ISSUE-CLIN-05 | Partly agree | WF-07                                                                                                                                   |
| ISSUE-REST-01 | Confirmed    | WF-01                                                                                                                                   |
| ISSUE-REST-02 | Partly agree | WF-11                                                                                                                                   |
| ISSUE-REST-03 | Disagree     | Do not automatically change a clinical observation order from an operational episode.                                                   |
| ISSUE-REST-04 | Partly agree | WF-10                                                                                                                                   |
| ISSUE-DOWN-01 | Confirmed    | WF-03                                                                                                                                   |
| ISSUE-DOWN-02 | Partly agree | WF-19                                                                                                                                   |
| ISSUE-DOWN-03 | Confirmed    | WF-03                                                                                                                                   |
| ISSUE-DOWN-04 | Partly agree | WF-19                                                                                                                                   |
| ISSUE-GEO-01  | Disagree     | Travel bands are intentionally invented. Better fixture plausibility is optional; never label placeholders verified.                    |
| ISSUE-GEO-02  | Disagree     | Current default is four hours, plus an accepted extra-travel hold; alleged three-hour cap/mid-flight release not established.           |
| ISSUE-GEO-03  | Disagree     | WF-18                                                                                                                                   |
| ISSUE-GEO-04  | Partly agree | WF-09                                                                                                                                   |
| ISSUE-ALRT-01 | Partly agree | WF-17                                                                                                                                   |
| ISSUE-ALRT-02 | Not current  | General-page broadcast identity uses effective access/desk context.                                                                     |
| ISSUE-ALRT-03 | Confirmed    | WF-04                                                                                                                                   |
| ISSUE-ALRT-04 | Partly agree | WF-08                                                                                                                                   |
| ISSUE-BED-01  | Partly agree | WF-18                                                                                                                                   |
| ISSUE-BED-02  | Disagree     | WF-18 — Owner-ruled Ready/cleaning arithmetic; revisit wording/policy in WF-18, not a silent subtraction.                               |
| ISSUE-BED-03  | Disagree     | Restricted typed reducer unions do not require silent default branches.                                                                 |
| ISSUE-BED-04  | Disagree     | Shared command envelopes and backend locking/conflict checks already carry revision protection.                                         |
| ISSUE-BED-05  | Disagree     | WF-14 — Existing negative tests rebut the blanket claim; any exact missing case belongs in WF-14.                                       |
| ISSUE-TIME-01 | Confirmed    | WF-05                                                                                                                                   |
| ISSUE-TIME-02 | Confirmed    | WF-05                                                                                                                                   |
| ISSUE-TIME-03 | Confirmed    | WF-05                                                                                                                                   |
| ISSUE-TIME-04 | Not current  | The community drawer formats valid recorded dates of birth.                                                                             |
| ISSUE-TIME-05 | Disagree     | en-CA is an internal grouping key; visible date headings use Australian formatting.                                                     |
| ISSUE-TOOL-01 | Disagree     | WF-21 — Current lease recovery is not governed solely by the root compatibility sentinel; investigate actual Windows evidence in WF-21. |
| ISSUE-TOOL-02 | Unverified   | WF-21                                                                                                                                   |
| ISSUE-TOOL-03 | Partly agree | WF-15                                                                                                                                   |
| ISSUE-TOOL-04 | Disagree     | WF-21 — Refusing to steal live/unknown work is intentional; retain that safety property.                                                |
| ISSUE-TOOL-05 | Disagree     | Duplicate compiler entry-point aliases alone are not a defect; do not remove used script names blindly.                                 |
| ISSUE-TOOL-06 | Not current  | The browser CI build is prepared/uploaded and reused as an artifact.                                                                    |
| ISSUE-PERF-01 | Partly agree | WF-12                                                                                                                                   |
| ISSUE-PERF-02 | Disagree     | WF-12 — No blanket ssr:false change; measure actual rendering/chunk behaviour in WF-12.                                                 |
| ISSUE-PERF-03 | Partly agree | WF-12                                                                                                                                   |
| ISSUE-PERF-04 | Partly agree | WF-13                                                                                                                                   |
| ISSUE-ARCH-01 | Partly agree | WF-13                                                                                                                                   |
| ISSUE-ARCH-02 | Partly agree | WF-14                                                                                                                                   |
| ISSUE-ARCH-03 | Unverified   | WF-23                                                                                                                                   |
| ISSUE-ARCH-04 | Unverified   | WF-22                                                                                                                                   |
| ISSUE-ARCH-05 | Unverified   | WF-22                                                                                                                                   |
| ISSUE-ARCH-06 | Disagree     | WF-14 — Offline conflict/overlap tests already exist; prove an exact coverage gap in WF-14.                                             |
| ISSUE-WALL-01 | Partly agree | WF-20                                                                                                                                   |
| ISSUE-WALL-02 | Partly agree | WF-20                                                                                                                                   |
| ISSUE-WALL-03 | Partly agree | WF-20                                                                                                                                   |
| ISSUE-WALL-04 | Disagree     | No reproduced role/route/flag case; current shift band is not the reported context-menu implementation.                                 |
