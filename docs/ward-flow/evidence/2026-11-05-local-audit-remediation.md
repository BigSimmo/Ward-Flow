# Local audit remediation, 5 November 2026

Task: continue the local Ward Flow audit, avoid duplicating open PR work, repair the remaining independently owned defects and publish a draft PR. This does not approve merging or deployment. Baseline: `9503c0a0f023eef9757fddd60a3c541dcff61f69`, branch `codex/local-audit-fixes-20261105`.

## Repairs and contracts

- Demo-code comparison now reserves the existing address and process-wide attempt budgets synchronously, before asynchronous verification. A confirmed correct code refunds its reservation. A failed comparison keeps it. Existing limits, address attribution and shared-mode refusal remain. The limits are per process, not a distributed deployment-wide guarantee.
- The access directory returns `complete` and `nextCursor`. Continuation uses the exact PostgreSQL grant timestamp and membership ID, retains workspace and scope filtering, and bounds each request to ten scans of 500 records. An empty scoped page may still require continuation. A malformed cursor gets 400. No schema migration is required.
- The browser collects directory pages before returning the list. It rejects failed, malformed, looping or over-budget continuation and a role change during the read, so a partial directory is not presented as complete. Older servers without continuation metadata retain their previous contract; therefore deploy the backend continuation support before relying on the corrected directory behaviour.
- Paging is a sequence of authorised live reads, not a database snapshot. Concurrent grant/revoke changes may require refreshing the directory. Reaching the browser's 100-page bound reports an error instead of silently truncating.

## Duplicate-work review

Reviewed metadata and changed-file lists for 25 open/draft PRs, with targeted patches for overlapping audit repairs. This was a brief duplication review, not approval of those PRs or their CI.

- The conflict-reference repair is proposed in #1437 and also included in #1435/#1452. It is not repeated here; the full boundary still needs its owner's validation.
- #1429 removes the account chooser's 20-role cap. This branch repairs the separate directory cap and must preserve that PR's authority/transaction changes when integrated.
- #1447 repairs sheet scroll preservation. It is not repeated here.
- #1454 changes when a correct demo code can be accepted after wrong attempts. This branch fixes concurrent admission while retaining main's current exhausted-budget refusal. Reconcile those overlapping policies during integration.
- Main already contains the capability-compatible WebKit overdue assertion. No responsive-test change was necessary.

## Evidence

All data was synthetic. A private PostgreSQL 16 container used a loopback port and disposable databases. No provider database, paid reviewer, deployment or account setting was used.

- The new session-route regression first reproduced 20 admitted comparisons against an address budget of 10 while verification was pending. The repair admits 10 and returns 429 for the remaining 10. Successful presenter sign-ins refund their slots.
- `node scripts/run-backend-tests.mjs --integration`: 458 tests passed, no failures/skips, including actual PostgreSQL/HTTP continuation to the 501st grant. The first run exposed an existing fake's no-cursor argument contract; the HTTP adapter was corrected to preserve it, then the full integration run passed.
- Backend engine build and strict backend typecheck passed with Node 24.22.1 and npm 11.17.0.
- Additional focused tests cover tied microsecond timestamps, more than 5,000 filtered records, malformed cursors, empty intermediate pages, repeated cursors and failed later pages.

Final selected readiness results belong to the draft PR summary. A local pass does not establish hosted CI, production behaviour, physical Safari, installed-PWA acceptance or clinical validation. Original audit artifacts and the local-session handoff remain private and outside the repository.
