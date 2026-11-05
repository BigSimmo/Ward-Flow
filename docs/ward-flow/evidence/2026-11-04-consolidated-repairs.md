# Consolidated audit repairs — 5 November 2026

**All 80 confirmed issues are implemented: 42 P2 and 38 P3.** This record covers local implementation, verification and draft publication. All changed-input checks and the explicitly identified reused evidence passed.

[Draft PR #1447](https://github.com/BigSimmo/Ward-Flow/pull/1447) targets `main`. The [80-row register](2026-11-04-consolidated-repair-register.csv) retains canonical IDs, aliases, priority, repair, source/test paths and audit qualifications. The original historical report, disposition CSV and evidence ZIP were unavailable; missing appendix contents were not invented.

## Source and integration

Repository: `BigSimmo/Ward-Flow`; branch: `codex/resolve-consolidated-audit-20261104`. Reported audit source: `0876ef9e35fa9e58dbd1e7e3fc6d158b773a8adc`. Original repair baseline: `559f225892b27b6c42bd7e9a6fa81f3ef81e62ec`.

Latest verified snapshot: **`6760783d6cc2f6d32f57fb529ac0cb2157ed94d3`**, integrating main through `3099a5fab4a5a2ae9f343c500d61bbe3dd081e5d`. Application changes from the last Help merge are in `a6e1fb4fe36af4a98aca426402033385f82bb272`; the later commit reconciles reviewed journey data and generated reader output. The final evidence follow-up changes only this record, its CSV and budget history.

The owner approved the overlapping files. Both actual conflict rounds were reconciled with main: account Help memory remains mounted while Help opens/closes, while answer identity, unsaved-work guards, role/device/page restrictions and the current print controls remain. Full `WardAccess` gates statewide tasks; the header also removes forbidden steps even when a prior eligible answer remains cached. Capability denial retains main's focus-trapped notice; unsupported devices/pages return to Help. The browser refusal case tests that distinction without weakening the guard.

The search line-cap integration was fixed by moving its unchanged keyboard hints into `ward-global-search-key-hints.tsx`; no on-screen wording or line limit changed. Existing peer branches and original local history were preserved.

The 80 repairs cover observation order, retained identifier uniqueness, scenario-local origins, current authority/place/Undo provenance, generation-bound details and grants, role dispatch, save/import/durability ownership, return journeys, census/whereabouts/capacity/search/meeting contracts, Activity pagination, forecast identity, Help, guidance and verification tooling. No expected-red entry or test-population reduction was added.

## Verification and reuse

| Evidence                                     | Result and exact scope                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full required local gate                     | **Passed at `c94db590822e655c662f9a5c607ded56d18862f7`**, after integration of main `50288eb4f…`: every selected stage completed. All 2,061 unit files reported across 21 batches: **20,257 collected; 20,254 executed/passed; 0 failed; 3 documented skips**. **459 real PostgreSQL backend cases passed, 0 failed/skipped**. Build, static/documentation/dependency checks and 219 browser cases passed. |
| Latest Help/docs incremental gate            | **Passed at `a6e1fb4fe…` against the last fully verified `c94db590…`**: runtime, formatting/diff, docs, locked dependencies, backend/frontend typechecks, lint and **482 affected cases across 38 files**, with no failures. An earlier focused pass had **437 cases across 36 files**; these populations overlap and are not summed.                                                                      |
| Reused engine/database evidence              | Backend runtime `.mjs`, migration/runtime SQL, reducer and other reviewed core inputs were verified unchanged from `c94db590…`. The full backend/core results above are reused evidence, not a new full-suite claim at `6760783d6…`. Latest related tests and browser checks cover the changed Help inputs.                                                                                                |
| Latest production build                      | `6760783d6…`: compilation, TypeScript and all **106 static pages passed**.                                                                                                                                                                                                                                                                                                                                 |
| Latest production browser                    | `6760783d6…`: **219 passed, 0 failed, 0 skipped, 0 flaky**, supported two-shard execution (93 and 126 cases). Includes all role walkthroughs, the restricted bed-manager sign-off case and responsive census scroll/Back/query-reset behavior.                                                                                                                                                             |
| Latest shared-mode production browser        | `6760783d6…`: **6 passed, 0 failed, 0 skipped**, fresh production app with real isolated local PostgreSQL/backend HTTP and local test authentication.                                                                                                                                                                                                                                                      |
| Latest phone script budgets                  | `6760783d6…`: **all five passed** the official production checker. Values below.                                                                                                                                                                                                                                                                                                                           |
| Documentation maintenance and journey proofs | Reviewed source/data commit `6760783d6…`: **aggregate `docs:maintain:check` passed**. Official journey write, check and mutation/refusal proofs passed. Five reader outputs; input fingerprint `5f5042ec7e8b57c33db29b6363b6b680d7a645638341f4189c12d008522e386a`.                                                                                                                                         |

The three full-run skips are `tests/diff-integrity.test.ts` (historical commit `d1485d6e8` unavailable) and two explicit opt-in timing/profile diagnostics in `tests/ward-executive-statistics-projector.test.ts` (`WF_EXECUTIVE_MEASURE` / `WF_EXECUTIVE_PROFILE`). No required PostgreSQL integration was silently omitted.

The latest shared checks exercise save/poll/reload, same-record conflict refusal, server domain refusal, keyboard focus, concurrent different records and offline catch-up. They use real isolated loopback PostgreSQL/backend HTTP with a production Next build and local test authentication/HTTPS proxy. Hosted Supabase Auth and deployed behavior are separate and not established by these cases.

Runtime: checksum-verified Node 24.22.1, pinned npm 11.17.0, locked dependencies, Chromium revision 1248 and PostgreSQL 16. Execution used the managed cloud workspace, local shell and bounded native source reviewers. No additional paid provider test service was invoked.

## Journey review reconciliation

The newly merged journey reader correctly refused digests predating the repairs. Three bounded source reviews compared all **21 mismatching files** with main, handlers, payload/place boundaries and regression source. Specific model/action notes were corrected before their conservative whole-file digests were updated; unchanged sibling events were checked against the actual diff. Source anchors were relocated through that diff. Generation-time review checks were retained.

The [dated reconciliation](../journey/CURRENT-REVIEW.md) records each source, unchanged-input reuse and the observation/legacy-tie, receiver/original-ward, return-retry, occurrence, durability and late-completion qualifications. Official negative proofs still refuse unaccounted/obsolete/duplicate events, incomplete models, bad references, missing/stale reviews, role drift and false no-screen claims. This is engineering/model evidence, not clinical validation.

## Measured phone scripts

KB gzipped, measured from the actual latest production build; rounded to six decimals:

| Route                              | Latest source KB | Limit KB |
| ---------------------------------- | ---------------: | -------: |
| `/ward-flow`                       |       554.891602 |    555.1 |
| `/ward-flow/referrals`             |       561.515625 |    561.7 |
| `/ward-flow/ed`                    |       509.050781 |    516.1 |
| `/ward-flow/ward/rph-adult-secure` |       587.969727 |    588.2 |
| `/ward-flow/movements/WF-001`      |       617.669922 |    617.9 |

Against integrated main's limits (554.1 / 558.9 / 516.1 / 585.1 / 614.7 KB), this PR changes limits by +1.0 / +2.8 / 0 / +3.1 / +3.2 KB, all within D-82's 5 KB per-route allowance. The earlier diagnosed header-facts trim remains; remeasurement showed no byte saving, so none is claimed. See the [complete history](../../script-budget-history/2026-11-04-consolidated-audit-repairs.md) for original and integrated baselines. No user-latency improvement is inferred from these sizes.

## Boundaries and receipts

The draft is for review; no main merge, release or deployment was performed through this task. Hosted CI results are not claimed as this local acceptance evidence. No physical-device, installed-PWA, hosted-auth, live-service, production migration or fresh exhaustive-storage-sweep acceptance is claimed. RSEQ-04/provider-remount and quick-action concerns remain outside the 80 confirmed issues. Genuinely unordered legacy observation ties, optional direct return cancellation, durable forecast draft recovery, release-veto policy and vocabulary remain separate product decisions.

Full receipt: `receipt-1793849509484-189665.json`, SHA-256 `7aa963ca042f23531cc07d5e692423ca35b4d5eab867963a476491837c55357a`. Private logs: `ward-audit-full-gate-12.log`, `ward-audit-pr1447-latest-incremental-gate.log`, `ward-audit-pr1447-docs-maintain-2.log`, `ward-audit-pr1447-journey-{refresh,check,prove}.log`, `ward-audit-pr1447-final-build.log`, `ward-audit-pr1447-latest-browser.log`, `ward-audit-pr1447-latest-phone-budget.log` and `ward-audit-pr1447-latest-shared-browser.log`. Browser invocation: `230129-1793853213583`. Raw DOM, auth material and database fixtures remain private and are not included here.

The original checkout, protected baseline worktree, prior evidence and local history were preserved. Task processes and the task-owned database are stopped after verification; retained worktrees/backups were not deleted. Continuity receipts remain in the existing private task checkpoint.
