# Old app versions across the 6 am release: support window (decision paper, draft)

_Draft, 10 November 2026, audit item M33 (absorbs M92). For Josh to decide. Owner: Josh. Nothing
here is decided until it is recorded as a D entry in [decisions.md](../decisions.md). Evidence
boundary: source read at main 29352cd0; no hosted run was made._

## The question

When the 6 am release moves `live`, a tab opened yesterday keeps running yesterday's screens against
today's backend. How old may a screen be and still be allowed to save?

## What is true today

- **No version check between screen and backend.** The browser sends no build or version header,
  and the backend reads none (searched `src/` and `backend/ward-flow/` for build, version and
  deployment ids). Compatibility is handled command by command in the backend, for example
  `backend/ward-flow/forecast-scope-compatibility.test.mjs` and `tests/ward-audit-transfer-compat.test.ts`.
- **Waiting saves survive a reload.** The shared client keeps an unsent or unanswered command in
  recovery storage (`src/components/ward-management/ward-shared-pending-command.ts`) and resends it
  with the same command id, so the backend's receipt makes the resend safe for 7 days.
- **The update offer exists.** `src/components/ward-management/shell/ward-pwa-update.ts` shows "New
  version of Ward Flow ready" when a new service worker waits, and reloads on request. The check that
  this offer never drops unsaved work belongs to another thread (TE-04 / M33 toast part).
- **Not yet in CI.** No job runs the previous `live-*` build's screens against the new backend.

## Options

1. **One release back (recommended).** The backend must accept every command the previous `live-*`
   build sends. Anything older is refused with a plain "Reload to get the latest Ward Flow" answer
   and its waiting save is kept for after the reload. CI builds the previous `live-*` tag's screens
   and runs the shared-mode journeys against the new backend.
2. **Seven days back.** Matches the receipt window. Covers a tab left open over a long weekend, but
   CI must test up to seven older builds, or the backend must keep every command shape for a week.
3. **No window: every tab reloads at release.** Simplest backend, but a reload in the middle of a
   bed meeting loses the screen's place, and a save sent during the reload must still be safe.

## Recommendation

Option 1. During a pilot releases are weekly by hand, so "one release back" is a week of tabs, and
the CI cost is one extra build and one journey run per pull request that touches the backend.

## What option 1 needs (not started)

1. The browser sends its build commit (for example `x-ward-flow-build`) with each command.
2. The backend refuses, with a fixed code, a build older than the previous release, and the screen
   keeps the waiting save and offers the reload.
3. A CI job checks out the previous `live-*` tag's `src/`, builds it, and runs the shared-mode
   journeys against this pull request's backend. Editing `.github/workflows/ward-flow.yml` is
   shared CI work and needs its own pull request.
4. Record the ruling as the next D entry.
