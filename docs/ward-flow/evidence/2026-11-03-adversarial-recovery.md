# Adversarial journey recovery fixes

Base: `1579bf8942705358feefcf5e08ab56a369ed480b` on Ward Flow main. Repairs address the four findings from the read-only review at `b6aa5cdef2768d4e1c90e5f1a19728f7fee9a61d`.

- Care-transfer acceptance and handover require a placement link. A coordinator can explicitly cancel the current unfinished transfer and accept a replacement; arrival still rechecks capacity and role, and stale steps remain refused.
- Partial shared-command receipts retain their partial outcome through reload, without exposing stored rejection text or resending the command.
- Demo entry describes same-tab persistence and excludes typed-text retention, preserving the existing scrubbed save/reload behaviour.
- Pass requests have a 15-second deadline covering headers and body, abort obsolete work and permit explicit retry. A late reply cannot navigate after timeout.

## Retained staff announcement

The app keeps its existing maximum of 20 announcements. The oldest displaced entry is retained here without changing its wording:

- 2026-10-31 (`2026-10-31-help-tabs`): Help has one search box and three tabs, shows each login only what it can use, and the tour starts when you choose.

## Verification

- Fresh regressions failed before the fixes: missing placement acceptance, cancellation/replacement, partial receipt recovery, sign-in timeout and reload wording.
- Six new frontend/domain/client regression tests pass, plus one actual backend receipt projection test with a fake pool. No database is opened by these checks.
- The affected-test selection passes: 14 files, 204 tests. The selector capped its broad fan-out; this is not a full-suite verdict.
- Required PR-check components pass locally: runtime, formatting, diff integrity, documentation checks, locked dependency parity, backend engine build/typecheck, frontend lint/typecheck and affected tests. Initial file-length and test-fixture/expectation failures were resolved; no thresholds, permissions or assertions were weakened.
- Local system Chromium 151.0.7922.173: acceptance → handover → cancellation → replacement acceptance; reload retains replacement. Desktop 1440 × 1000 and phone 390 × 844; no captured page/console errors or phone horizontal overflow. A valid disposable synthetic saved placement supplied the starting state; early harness attempts lacked complete save metadata and were rejected by the existing restore fence.
- Temporary localhost demo gate: wrong code returns 401; a held request restores enabled input/retry with a connection message after the 15-second deadline; a late completion does not navigate; explicit retry returns 204 and opens the requested Discharges page. The old reset promise is absent. No captured page errors.

The browser tool connector was unavailable, so installed Playwright controlled system Chromium. This is not pinned-browser, physical Safari or installed-PWA proof. Full unit suite, real PostgreSQL integration, production build and pinned-browser journeys remain for hosted CI; no hosted result is claimed. No live database, notification, migration, deployment or library prompt was run. The separate session/admitted-command ordering question was not a confirmed review finding and is unchanged.
