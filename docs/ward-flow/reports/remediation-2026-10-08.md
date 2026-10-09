# Ward Flow audit remediation — 8 October 2026

Task identity: `Ward-Flow-audit-remediation-20261008`. Repository: `BigSimmo/Ward-Flow`.
Original audit baseline: `e7b7f325346ea7abb5004bd2e60e63f64f5c9f95` (PR #121).
Fresh canonical main through PRs #131 and #130:
`0bbcd341d08ad1b2e0c67a77a9cab84367e03769`.
Application verification candidate:
`868211848897291197fbd0d3106fa9ae1a618c92`, branch `codex/audit-remediation-20261008`,
worktree `/workspace/ward-flow-remediation`. Subsequent receipt/documentation changes
and a browser-helper comment do not alter the application render inputs.

## Outcome and readiness

The interactive synthetic prototype has locally corrected clinical state, capacity,
workflow, UI truthfulness, privacy boundaries, snapshot handling and development checks.
The consolidated register contains 93 independently traceable items: all 79 original IDs
plus 14 substantiated follow-ups. Its original fields are preserved; current dispositions
and new evidence are separate. At this checkpoint, 49 are fixed locally, five original
phone findings were resolved by newer main, and 39 remain partial, require an owner
contract/approval, need external verification or are optional. A locally fixed task does
not imply provider or clinical readiness.

Reliable active development is supported by the observed checks below. Authenticated
multi-user operation remains incomplete: the frontend's browser reducer is not a shared
server authority, and Azure Functions store owner-private demonstration snapshots.
Real-patient use is not approved. Only synthetic data was used throughout this work.
No push, remote merge, issue creation, provider configuration or deployment was performed.
The original source checkouts and original owner holds remain intact.

## What changed

| Area                       | Locally implemented correction                                                                                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clinical lifecycle         | Explicit originating-ED deterioration with confirmation/cancel, atomic pre-collection cancellation and release, paused placement, fresh recorded clearance, identity/provenance checks, truthful refusal feedback and re-clearance clock re-anchoring. Actual collected arrivals remain recordable.                 |
| Beds and capacity          | Reciprocal held-admission/unit checks; physical occupancy and preparation conservation; bounded reservation refund and visible conflict marker; the same actual bed-hold fact drives board, search, profile and live preview.                                                                                       |
| Intake and workflows       | ATS 1–5 recorded separately from urgency 1–3; consistent queue labels; real expected-departure date/time save/cancel; state-derived lifecycle headlines and placement review; referral clearance drafts cannot masquerade as a clinician record.                                                                    |
| Community and Settings     | Live referral facts, actual accept/refusal outcomes and scoped patient-linked care journey; unsupported assignment/contact/EHR/signature claims removed. Recent Settings filters are genuinely committed in screen memory, deduplicated/bounded and cleared without browser storage or configuration-audit changes. |
| Frontend and accessibility | Current upstream phone fixes and Home/Placement appearance preserved; service-identity containment and local keyboard-scrolling regions corrected; meaningful geometry and phone action checks.                                                                                                                     |
| Snapshot backend           | Versioned validation, conditional-save/conflict handling, bounded retries, last-save receipt, content-erasing deletion, diagnostics and bounded frontend fetch behaviour. These do not constitute shared command history or retention approval.                                                                     |
| Security and tooling       | Client secret redaction, safer monitoring defaults, maintained dependency updates, exact-lock installation/parity, reproducible CI contracts, independent tokens/map IDs, bounded fixture cleanup, AST module-graph traversal and fail-closed computed imports. Privacy allowlists remain unchanged.                |
| Documentation              | Current-state claims qualified, statutory/TGA assertions separated from approvals, architecture/roadmap refreshed, original decisions/history retained, scoped browser provenance recorded without renewing historical whole-screen verdicts.                                                                       |

Six author groups worked in isolated claimed worktrees. Two independent reviewers
checked specification correctness and engineering standards, found actionable defects
that were corrected, and recorded no remaining confirmed actionable findings within
the final reviewed source and composition scopes. Their conclusions are source-scoped,
not a clinical approval or substitute for executed checks.

## Executed verification

| Check                              | Actual result                                                                               | Source and scope                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete Vitest suite              | 936 files / 10,881 tests passed; 9 files / 146 tests skipped; exit 0                        | `3d01bf9`, 511.00 seconds. Skips remain disclosed.                                                                                                                                          |
| Whole-source lint and type check   | Both exit 0                                                                                 | `3d01bf9`; complete local remediation before incoming PR #130.                                                                                                                              |
| New-main overlap/regressions       | 29 files / 325 tests passed; exit 0                                                         | `8682118`, 26.50 seconds; seven owner-changed files plus 22 relevant integration/clinical/privacy checks.                                                                                   |
| Merged whole-source lint           | Exit 0                                                                                      | `8682118`; latest owner changes and remediation together.                                                                                                                                   |
| Complete isolated production build | Passed; normal full TypeScript check passed                                                 | `8682118`; all application routes, no build-path restriction or type-check bypass, provider-free synthetic environment.                                                                     |
| Production Chromium                | 12 passed; 0 skipped, failures or flaky tests                                               | `8682118`, 45.4 seconds: full community-intake → ED → coordinator → ward → transport → discharge-planning journey; seven responsive routes; four selected coordinator phone/refusal checks. |
| Settings production browser        | Ten bounded checks passed; no page errors                                                   | `8682118`: actual filtering/recent queries, restore, deduplication/max-four, clear feedback, unchanged local storage/configuration history and transient-state reset after reload.          |
| Azure backend mock suite           | 34 passed                                                                                   | Integrated backend source; mocked JWT/storage cases, not a configured Azure deployment.                                                                                                     |
| Installation/dependencies          | Exact-lock install/parity passed; production dependency audit reported zero vulnerabilities | Matched repository lock; one unpatched development-only `braces` advisory remains under the dated bounded exception, `SEC-003`.                                                             |

The first integrated run at `0ffdce4` failed 19 tests; the failures, fixes and later
passing logs are all retained. Two earlier development-server journey attempts failed;
the later frozen production journey passed. Two Settings harness mismatches were
preserved and corrected before the final passing check. None is silently relabelled.
A complete suite was not repeated after PR #130: unchanged remediation inputs are
supported by the full run, while changed inputs have the explicit 29-file, lint, complete
build/type-check and production browser evidence above. The final merged-source tests
must not be misreported as a second complete-suite run.

Production browser render fingerprint:
`659b58adf6d90659ab9306947265d23c068146c7ed5b1b973ecbbd9cb9f7f13b`.
It covers first-party `src` and root render/dependency configuration; it excludes runtime
environment values, installed binaries and public assets outside `src`. Chromium was
151.0.7922.173. Responsive geometry covers 320/390/768 widths, keyboard local-scroller
access and a bounded dark-theme case, not every screen/theme/state combination.
Five exact roster rows have new scoped records; two measured routes are supplementary.
All 34 historical whole-screen records, verdicts and missing revisions are preserved.
Firefox/WebKit execution remains blocked by browser-download HTTP 403 responses;
manual assistive-technology and physical-device acceptance remain open.

## Durable register, coverage and reconciliation

The immutable ten-deliverable audit is at `/workspace/ward-flow-audit/2026-10-08`.
The local implementation evidence is at `/workspace/ward-flow-remediation-output`:

- `remediation-register.json` / `.md`: complete 93-item register with preserved original
  fields, current actions, dependencies, acceptance and evidence; all 93 local issue drafts
  are in `issue-ready/`. No GitHub or tracker records were changed.
- `prioritised-master-register.csv`: independently actionable P0–P3 ordering.
- `historical-reconciliation.json` / `.csv`: all 1,264 historical lead rows have distinct
  dispositions, evidence, ownership and remaining actions. Contextual headings are not
  defects; unverified semantic/mutation claims are not marked complete.
- `remediation-component-coverage.csv` / `.md`: both-baseline changed-path dispositions,
  declarations/dependencies and source/test/runtime limits, supplementing original coverage.
- `final-gate-results.json`, source provenance, complete logs, screenshots, worker receipts
  and independent review reports: actual results and their candidate boundaries.
- `shared-pilot-implementation-plan.md`: concrete dependency-aware next milestone and
  exact authority decisions, retaining the existing Azure/Entra/Blob architecture.

Validation checks original-field preservation, unique IDs, draft existence, dependency
cycles, all historical rows, current progress/register consistency and changed-path coverage.
Artefact generation proves structure/traceability, not an unexecuted workflow or deployment.

## Next work, in order

1. Review and integrate the local candidate using existing ownership/publication rules.
   Observe the resulting hosted checks before claiming remote integration or deployment.
2. Name Ward-only identity/resource owners and approve staff/service membership, actor
   privileges and synthetic retention. Implement frontend sign-in, trusted server commands
   and authoritative shared persistence; a role selector or private snapshot is insufficient.
3. Add durable command idempotency/history, revision-aware peer updates and recovery.
   Prove competing bed reservations, duplicate submission, lost responses, reconnect,
   revoked access and cross-service refusal with two authenticated synthetic staff members.
4. Verify Ward environments, monitoring sink/alert ownership, backups/restore, quotas and
   application/data rollback against actual authorised resources. Connector absence is not
   evidence that a provider service is absent.
5. Complete the remaining browser/accessibility and workflow/product-contract tasks.
   Preserve declared limits for collected-patient diversion, clinician assignment, contact
   outcome records, intervention settings and operational reference data.
6. Commission qualified clinical, privacy, legal/cultural and intended-purpose TGA reviews
   and obtain institutional pilot authority before any real patient information is used.

The [production-readiness register](../governance/PRODUCTION-READINESS.md) and complete
93-item register retain every deferred requirement. Local test success grants none of
these external approvals. No remediation beyond the authorised local stage is implied.
