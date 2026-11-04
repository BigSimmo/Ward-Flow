# Consolidated audit repair record — 4 November 2026

**77 of 80 issues are implemented: all 42 P2 and 35 of 38 P3.** WF-HLP-06, WF-HLP-08 and WF-HLP-10 remain partial pending the exact-file ownership approvals below. Final aggregate verification is incomplete; this is not a release-ready verdict.

The [80-row repair register](2026-11-04-consolidated-repair-register.csv) retains canonical IDs, aliases, original priorities, source/test paths and qualifications. The original historical report, disposition CSV and evidence ZIP were unavailable. Their missing contents have not been reconstructed.

## Source and implemented work

Repository `BigSimmo/Ward-Flow`; branch `codex/resolve-consolidated-audit-20261104`; repair baseline `559f225892b27b6c42bd7e9a6fa81f3ef81e62ec`, including the reported audit source `0876ef9e35fa9e58dbd1e7e3fc6d158b773a8adc`.

Current executable source is **`78d4700384e5b849d9997b0287fae4aeea2a509e`**, with a clean worktree when this record was prepared. Earlier `b2e26e69942f88a9bc0ad3682f7e44176700e022` results are diagnostic evidence, not final-source acceptance.

The changes cover accepted observation ordering, import identifier uniqueness, fictional-network origin lookup, current authority and Undo provenance, generation-bound detail/exceptional openings, membership selection and uncertain grant retries. Bookings use the actual desk/place; save recovery retains command ownership; local durability, import replacement, editor dismissal and navigation guards protect unfinished work. Census, whereabouts, capacity, meeting occurrences, search, Activity pagination/scope and forecast workspace identity use their separate contracts. Help eligibility, exceptional read-only views, desk switching, chronology/arrival identity, TV messages and operational guidance are repaired within the recorded limits.

The latest source also preserves both census-table and outer-page scroll positions through responsive sheet changes and Back navigation. Query/filter identity changes retire hidden desktop offsets on phones. The fix uses numeric position capture and existing view-lifetime gates; it does not retain patient content in scroll memory.

Verification contracts now require actual local PostgreSQL for the full plan, named browser obligations, distinct storage-mode evidence, a functioning symlinked verifier and preserved spaced browser arguments. No expected-red entry, population reduction or gate bypass was added.

## Verification state

| Evidence                                              | Source and result                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Final production build                                | `78d470038…`: compilation, TypeScript and all 106 static pages passed.                                                                                                                                                                                                                                                                                                |
| Final local shared-mode production browser            | `78d470038…`: **6 passed, 0 failed, 0 skipped**, one worker. Real isolated loopback PostgreSQL and backend HTTP, production Next build, local fake sign-in/HTTPS proxy.                                                                                                                                                                                               |
| Final offline production browser                      | `78d470038…`: **218 selected and executed; 217 passed, 1 failed, 0 skipped, 0 flaky**, across the supported two-shard run (shard 1: 91 passed / 1 failed; shard 2: 126 passed). The only failure is the known unsupported bed-manager signoff vector in `tests/ui-ward-help-show-me.spec.ts:116`.                                                                     |
| Final full local gate                                 | `78d470038…`: all 2,055 selected files reported across 21 batches; **20,218 collected, 20,215 executed, 20,212 passed, 3 failed, 3 skipped**. Tooling was included. Required static checks and 451 backend integration tests passed. The expected-reds gate correctly failed; the plan stopped before its build/browser stages, which were executed separately above. |
| Prior complete unit diagnostic                        | `b2e26e699…`: 2,054 files; 20,200 collected; 20,197 executed; 20,194 passed, 3 failed, 3 skipped. Every requested file reported.                                                                                                                                                                                                                                      |
| Latest scroll acceptance before final production runs | `78d470038…`: 128 focused assertions passed; 3 actual development-browser cases passed. Final commit's seven-file lint/type checks passed. This is separate from final aggregate verification.                                                                                                                                                                        |
| Final phone script-size gate                          | `78d470038…`: four routes exceed unchanged limits; measured values and prepared limits below.                                                                                                                                                                                                                                                                         |

The final offline suite completed all 218 cases through the runner's supported two-shard mode. Its sole failure is the existing Help browser contract conflict in the ownership-blocked file above. The automatic unsharded diagnostic reproduced the same failure: 11 passed, 1 failed and no skips; it does not replace the original result. The full required local gate completed its full unit population on `78d470038…` and remained blocked by those three failures. A passing build, shared browser or earlier complete unit run does not establish that final gate passed.

The six shared cases exercised save/poll/reload across desks, same-record conflict refusal, domain refusal, post-save keyboard focus, concurrent changes to different records, and offline catch-up. This establishes the local protocol and database behavior exercised by those cases; it does not verify hosted Supabase Auth or a deployed service. Private receipt: `ward-audit-shared-browser-final.log`.

The final three unit failures are confined to two ownership-blocked files:

- `tests/ward-alerts-screen.dom.test.tsx`: two stale assertions expect “Every ward declined” and “Transport not left”; source truthfully says “Multiple wards declined” and “Transport delayed”.
- `tests/ward-help-screen-guides.test.ts`: generated Help differs from corrected source; the generated bundle and manifest need an atomic refresh.

The final three skips are explicitly accounted for: `tests/diff-integrity.test.ts` could not replay unavailable historical commit `d1485d6e8`; two diagnostic cases in `tests/ward-executive-statistics-projector.test.ts` require opt-in `WF_EXECUTIVE_MEASURE` / `WF_EXECUTIVE_PROFILE`. There were no other pending or todo assertions.

Runtime is checksum-verified Node 24.22.1 with pinned npm 11.17.0 and locked dependencies; browser revision 1248; PostgreSQL 16. Actual earlier UI checks covered desktop/tablet/phone census sticky headings and keyboard access and the ward booking destination. The final focused scroll cases verify positive inner/outer offsets after responsive resizing and settled Back navigation, plus phone query-reset behavior. Instant intermediate scroll readings were not treated as final failures.

## Remaining exact-file ownership work

[AGENTS.md](../../../AGENTS.md) rule 7 requires: **“an overlap needs that owner's release or Josh's scoped takeover.”** These four groups remain open, ownership-verified and unapplied. A consolidated exact-file approval request has been issued after independent review; its answer is pending:

| Exact files                                                                                                                                                                                    | Owner and remaining action                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ward-management/help/ward-help-find.tsx`; `tests/ui-ward-help-show-me.spec.ts`                                                                                                 | #1333. Finish WF-HLP-06 / WF-HLP-08 visible BestAnswer step/action eligibility and update the stale bed-manager browser vector without weakening permission guards. |
| `tests/ward-alerts-screen.dom.test.tsx`                                                                                                                                                        | #1423. Reconcile the two stale wording assertions with the corrected counted populations.                                                                           |
| `public/help/screens/.ward-help-guides.json`; `public/help/screens/handover.md`; `public/help/screens/handover.html`; `public/help/screens/seclusion.md`; `public/help/screens/seclusion.html` | #1333. Refresh the five-file generated bundle atomically. WF-HLP-10 source guidance is repaired; generated output is still pending.                                 |
| `script-budget.json`                                                                                                                                                                           | #1425. Reconcile the bounded measured increases below while preserving that PR's separate Movement budget repair.                                                   |

A concrete combined patch is prepared privately and passes `git apply --check` against the executable source. Independent read-only review found no concrete defect; this is not execution evidence. Its SHA-256 is `4cae137cb4c50a02439364b8870a80d2cfb0fdfdc1aa0f6718de68718350df4d`. Its companion files are `tests/ward-consolidated-help-20261104.dom.test.tsx` and `docs/script-budget-history/2026-11-04-consolidated-audit-repairs.md`. Prepared, unapplied changes are not counted as executed acceptance or completed repairs. No active PR was overwritten to obtain a passing result.

## Measured phone script sizes

KB gzipped, copied from the actual production measurement JSON for `78d470038…`; current limits are unchanged:

| Route                              | Untouched repair baseline | Current executable source | Current limit | Prepared limit |
| ---------------------------------- | ------------------------: | ------------------------: | ------------: | -------------: |
| `/ward-flow`                       |            550.2763671875 |            552.2158203125 |         550.3 |          552.4 |
| `/ward-flow/referrals`             |            555.5537109375 |            559.3701171875 |         555.6 |          559.6 |
| `/ward-flow/ed`                    |             504.568359375 |            506.3955078125 |         516.1 |          516.1 |
| `/ward-flow/ward/rph-adult-secure` |            581.7548828125 |            585.8310546875 |         582.5 |          586.0 |
| `/ward-flow/movements/WF-001`      |            611.2744140625 |            615.0556640625 |         610.9 |          615.3 |

Prepared total increases are Home +2.1 KB, Referrals +4.0 KB, Ward +3.5 KB and Movement +4.4 KB; ED is unchanged. Each is below the D-82 allowance of 5 KB per route. That allowance does not release #1425's ownership claim. The limits have not been changed.

The separately built untouched baseline already exceeded Movement's limit. The official baseline comparison nevertheless rejects this branch's additional growth; inherited overage does not explain it away. A safe header Help extraction removed unnecessary live tour-fact derivations and passed 88 focused assertions. Rebuild/remeasure showed no script-byte saving, so none is claimed. No measured user-latency benefit is inferred.

## Completion boundary

Record the separate browser diagnostic and final full-gate outcomes, obtain the four exact overlap releases/takeovers, apply the prepared changes, and rerun their focused checks and the required final gates. Complete the three partial Help entries only after that work is accepted. Publication and release remain outside the completed scope.

No push, PR publication, hosted CI dispatch, merge, release, production migration or deployment was performed. No physical-device, installed-PWA, hosted-auth, external-provider, live-service or new exhaustive-storage-sweep acceptance is claimed. RSEQ-04 provider/remount behavior and quick-action completion remain outside the 80 confirmed issues. Genuinely unordered legacy observation ties, optional direct return cancellation, durable forecast draft recovery, release-veto policy and vocabulary remain separate product choices; newly accepted observation edits retain their actual order.

The original checkout, concurrent work and earlier evidence were preserved. The protected baseline worktree and private raw receipts remain retained and unpublished.

## Evidence identities and host

The final full-unit receipt is `receipt-1793828915868-121316.json` under the private source-specific `ward-full-gate` checkpoint. Offline browser reports are the two `shard-*.json` files under invocation `110923-1793826682832`; the separate diagnostic retains the initial failure. Private logs are `ward-audit-full-gate-9.log`, `ward-audit-production-browser-final.log`, `ward-audit-shared-browser-final.log`, `ward-audit-production-final-build.log` and `ward-audit-phone-script-final-budget.log`. Raw browser DOM, auth material and database fixtures are not included in this report.

Work ran in the managed cloud workspace with local shell, native bounded reviewers, Chromium and Docker PostgreSQL. GitHub connector reads were used for source/ownership context; no hosted workflow or paid external test service was invoked. There were two bounded scoped startup memory recall calls and no memory save.
