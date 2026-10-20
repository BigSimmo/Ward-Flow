# Testing and verification

_Updated 2026-10-20 - verified CI scope, production browser proof and measured diagnostics; Documentation owns._

Current Ward Flow commands, browser cadence and CI topology below were checked
against the remediation source on 20 October 2026. Hosted performance for this topology has not been measured. Older diagnostic and performance
material is retained as historical context; it does not select a gate. Follow
[AGENTS.md](../AGENTS.md) and [HOW-WE-WORK.md](ward-flow/HOW-WE-WORK.md) for authority and gate rules.

> [!NOTE]
> **Inherited diagnostic material:**
> Some historical sections describe tooling developed for the former PsychSift monorepo. Those sections do not imply those tools or hosted jobs are present in Ward Flow.
> In the dedicated **Ward Flow** repository (`BigSimmo/Ward-Flow`), use synthetic browser/offline data. Run a focused unit check through `node scripts/run-vitest.mjs run <test-file>` or `npm run test:focused -- --files <paths>` so repository admission and offline defaults apply. Use `npm run test:e2e:ward-journeys` for browser journeys and inspect `npm run verify:pr-local -- --dry-run` before readiness checks. Follow [`AGENTS.md`](../AGENTS.md) and [`HOW-WE-WORK.md`](ward-flow/HOW-WE-WORK.md) for authority and gates.

## Safe local execution

Repository verification uses a local run coordinator derived from Git's common directory, so admission covers every worktree for this repository. It permits at most two shared leases from different worktrees for fail-closed focused Vitest selections and read-only typechecking. Full Vitest, coverage, lint, build, Playwright, and live-provider tests retain exclusive admission. Unknown Vitest selections fail closed to exclusive mode, and shared Vitest runs are capped at two workers each.

Composite gates do not hold an umbrella lease: `verify:cheap` and `verify:pr-local` let each lint, typecheck, unit, build, or browser stage acquire the appropriate lease. This lets focused work proceed during lightweight stages without allowing it to overlap an exclusive stage. Waiting admission is queue-ordered, so later focused runs cannot jump ahead of a queued exclusive command. Exclusive stages wait up to 15 minutes for long browser or build owners; shared focused work retains a 30-second admission timeout so an interactive check reports contention promptly.

Nested commands reuse their parent's token. Shared typechecks override the repository's `node_modules/.cache` incremental path with worktree-specific temporary `.tsbuildinfo` state, so junctioned dependency directories are not written concurrently. The coordinator retains the legacy lock path and a live sentinel owner so older worktrees safely wait instead of bypassing newer shared leases. Dead owners and abandoned queue entries are reclaimed; live owners heartbeat and command text is redacted before persistence or contention output. Do not bypass or delete coordinator state manually.

Vitest's Vite transform cache is outside the commonly-junctioned `node_modules` tree and keyed by worktree. Two focused runs from the same worktree are not admitted concurrently. Do not install packages while a repository test, build, lint, typecheck, or server command is active. Avoid short-interval polling, and do not repeat an unchanged broad gate after it has already passed.

Ordinary Vitest and Playwright runs remove OpenAI, Supabase, database, and E2E credentials and force demo/offline mode. Provider tests use the `*.live.test.ts` suffix, are excluded from default discovery, and can only be started explicitly with `ALLOW_PROVIDER_TESTS=true npm run test:live`.

Provider-backed work, including `npm run test:live`, requires explicit user approval under
[AGENTS.md](../AGENTS.md).

<!-- docs-script-refs:historical-start -->

> **Historical provider-command examples:** the following aliases include retired monorepo tooling.

**Provider-backed boundary:** `test:live`, `eval:quality`, `eval:retrieval:quality`, `verify:release`, `check:supabase-project`, and other OpenAI/Supabase/hosted workflows need **explicit user approval** before agents run them (see root `AGENTS.md`). Prefer offline gates (`verify:cheap`, `verify:pr-local`, `eval:rag:offline`) unless that approval is in the task.

<!-- docs-script-refs:historical-end -->

<!-- docs-script-refs:historical-start -->

> **Historical Windows diagnostic:** retained incident guidance; it does not select a Ward Flow gate.

### Windows process-spawn diagnostic (#VV83VA)

Before investigating a slow `git push`, `gh`, or pre-push guard on a Windows workstation, measure an unrelated local process spawn.

In PowerShell:

```powershell
Measure-Command { node --version }
# or evaluating inline execution:
Measure-Command { node -e "console.log(process.version)" }
```

From `cmd.exe`, invoke the same measurement without relying on shell aliases:

```cmd
powershell -NoProfile -Command "Measure-Command { node --version }"
powershell -NoProfile -Command "Measure-Command { node -e 'console.log(process.version)' }"
```

In Bash / WSL:

```bash
time node --version
time node -e "console.log(process.version)"
```

Subsecond completion (<0.2s) is healthy; if this simple command takes multiple seconds (measured up to 17s on process-starved hosts vs 0.08s after reboot), treat it as host process-spawn starvation rather than a repository or GitHub CLI fault. Close stale Codex, Node, and terminal sessions, then retry; reboot the workstation if the condition persists. Do not change Windows Defender, add security exclusions, or otherwise alter Windows security settings as part of this diagnosis.

<!-- docs-script-refs:historical-end -->

## Risk-based selection

Start with the cheapest check that can fail for the changed behavior. Add another check only when it covers a distinct plausible regression that the existing evidence does not. Documentation and policy changes normally need formatting, documentation, syntax, or focused contract checks; localized behavior needs its directly affected test; cross-cutting or uncertain executable changes escalate to the relevant domain or broad gate. Do not routinely stack focused tests, the full unit suite, lint, typecheck, build, and browser checks, and do not rerun an unchanged passing gate.

`npm run verify:pr-local -- --dry-run --files <comma-separated paths>` shows the local plan. Recognised documentation and maintained policy scopes stay focused. Unit-only changes retain root static/unit checks; backend-only changes also select backend typecheck/tests because root contracts import backend engine and schemas. Both skip the demo UI build and journeys. Source, tooling, configuration, unknown changes and unavailable history select broad work, including the production `build`. Provider, physical-device and release-only acceptance retain their normal authority requirements.

## Testing speed playbook

<!-- docs-script-refs:historical-start -->

> **Historical selection examples:** this table includes the former Production UI workflow and retired process reference. Use the current commands and CI topology below.

Browser gates are expensive; select the affected checks before starting them. Prefer selection, duration-balanced groups, and within-session cache reuse over raising Playwright workers (`workers: 1`, `fullyParallel: false`, `retries: 0` stay required — see `#093` and [process-hardening.md](process-hardening.md)).

| Change type                           | Run this                                                                       | Avoid                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Lib/helper, no UI                     | `npm run test:focused -- --files <paths>` or one Vitest file                   | `verify:ui`                                               |
| Component interaction                 | `.dom.test.tsx` + focused Vitest                                               | full Chromium                                             |
| Phone chrome / scroll / composer      | Focused Ward journey; release-gate phone project where affected                | immediate `verify:ui`                                     |
| Shared shell / header / `globals.css` | Inspect the local readiness plan; run affected Ward journeys                   | stacking `verify:cheap` + `verify:pr-local` + `verify:ui` |
| Docs / ledger only                    | `npm run verify:pr-local -- --dry-run` (confirm docs route)                    | full unit + UI                                            |
| PR ready                              | `npm run format -- --files <owned-paths>` (commit it) + `verify:pr-local` once | mid-CI pushes that cancel Production UI                   |

<!-- docs-script-refs:historical-end -->

**Local Playwright keep-root (iterative UI work).** Each `run-playwright.mjs` invocation otherwise builds under a unique `.next-playwright/<id>/` and deletes it. KEEP does **not** skip the Next production build — every invocation still rebuilds. It reuses the webpack/dist cache inside one shared root across stages in the same local session:

```bash
export PLAYWRIGHT_BUILD_ROOT_ID=local-ui
export PLAYWRIGHT_KEEP_BUILD_ROOT=true
# then: a focused Ward journey or single-spec run
# each run still builds; the shared root retains webpack cache between them
# unset both vars (or delete `.next-playwright/local-ui`) when done
```

<!-- docs-script-refs:historical-start -->

> **Historical workstation and Cloud diagnostics:** retained from the former monorepo. The following setup recipes, hook and hosted-workflow references are not current Ward Flow instructions.

### Dev Drive trusted package cache verification (#6SMMB4)

On Windows workstations hosting worktrees on a Dev Drive (`D:`, ReFS) where `npm config get cache` resolves to `D:\.npm-cache`, register the npm package cache as a trusted Dev Drive cache to prevent Microsoft Defender real-time scanning overhead during `npm ci` extractions across worktrees.

**Elevated registration command (run once in an Administrator PowerShell or CMD):**

```powershell
fsutil devdrv trust D:\.npm-cache
```

**Diagnostics & verification:**

1. **Elevated Dev Drive query:**
   ```powershell
   fsutil devdrv query D:
   ```
   Inspect the output for `Developer volume is trusted: Yes` and check that filesystem filters are attached in performance mode. (Note: Non-elevated prompts return `Error 5: Access is denied`).
2. **Fallback registry probe (non-elevated PowerShell diagnostic):**
   ```powershell
   Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "DevDrive*" -ErrorAction SilentlyContinue
   ```
   Or verify volume file system properties (`(Get-Volume -DriveLetter D).FileSystemType -eq 'ReFS'`). Trusting the volume or cache enables Defender asynchronous performance mode without disabling Defender real-time protection on untrusted files.

### PreCompact hook contract and logging (#RZQQBT)

`.claude/hooks/precompact-issues-capture.sh` is log-only and write-isolated. It appends firing receipts to `claude-precompact.log` under the directory from `git rev-parse --git-dir` (the worktree git dir for linked worktrees, not a hardcoded `.git/` path) and stays silent on stdout and stderr. Claude Code surfaces hook stdout to model context for `SessionStart` and `UserPromptSubmit`; `SessionStart` is the post-compaction backstop. The PreCompact hook is a silent audit log, guaranteed never to throw an unhandled error or break an automatic or manual context compaction.

**Refuted levers (do not revive):** persistent Actions cache for the Next webpack tree (~804 MB, evicts browser cache); transporting the critical job's 1.09 GB webpack cache to three shard runners (CI 31285952061 spent 19–67s downloading it and the slowest runner was slower than a cold build); splitting `ui-phone-scroll*` to rebalance `--shard` (siblings still co-land); renaming specs to game alphabetical shard order; Playwright `workers > 1` or blocking retries; dropping Production UI from ordinary UI PRs; the former general Firefox/WebKit matrix. Ward Flow now runs the dedicated phone WebKit release gate on browser-scoped changes; the former matrix is retired.

**Remote / Cloud browser drift.** When `check:installed-lock-parity` fails on `playwright`, or `check:playwright-browser-revision` reports `/opt/pw-browsers` revision drift, do **not** point `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` at a mismatched shell and do **not** set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` to force a run — a browser gate against the wrong revision is not evidence. `run-playwright.mjs` applies the same revision check in its launch preflight and refuses a mismatched override before acquiring the heavy lock or building. Delegating browser proof to CI Production UI is always valid. Restoring the gates locally is also possible; the recipe below was verified end to end on 2026-08-09 (`#255`). See also codex-cloud-environment.md (Codex Cloud notes, removed in the 15 Oct 2026 agent rules merge).

Two separate image faults produce this, and the second is why the obvious fix looks impossible:

1. **The baked `node_modules` is stale or incomplete.** Symptoms range from no `node_modules` at all to `playwright: installed 1.62.0 does not match locked 1.62.1` with `tailwind-merge` missing entirely. The lockfile is not wrong — do not re-pin it to the installed version.
2. **The image's Node is too old to run `npm ci`.** `jsdom@30.0.1` requires `^22.22.2 || ^24.15.0 || >=26.0.0`; images have shipped v24.13.0, so `npm ci --include=dev` dies on `EBADENGINE` under `engine-strict=true`. Never bypass with `--force`, `--legacy-peer-deps`, or `--engine-strict=false`.

```bash
# 1. Node >= 24.15.0 (satisfies both the repo's 24.x engine and jsdom's floor).
curl -sSL -o /tmp/node24.tar.xz https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz
mkdir -p /root/.node24 && tar -xf /tmp/node24.tar.xz -C /root/.node24/
export PATH=/root/.node24/node-v24.19.0-linux-x64/bin:$PATH   # node v24.19.0, npm 11.17.0

# 2. Real install. Expect exit 0; then parity prints all seven pinned packages.
npm ci --include=dev && npm run check:installed-lock-parity

# 3. Browsers. Playwright 1.62.1 wants Chromium 1234; images have shipped only 1194.
unset PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
npx playwright install chromium chromium-headless-shell   # installs into PLAYWRIGHT_BROWSERS_PATH
```

Costs roughly 5 minutes and ~330 MB (184 MB chromium + 115 MB headless shell + 32 MB node), needs a few GB free, and is paid **per session** because the container is ephemeral. The durable fix is still an image that ships Node ≥ 24.15.0, a complete `npm ci`, and the locked Chromium revision.

Codex Cloud agents remain provider-free. Run authenticated Supabase tests through the
manual `.github/workflows/authenticated-live-tests.yml` workflow, which requires the
explicit `run-authenticated-live-tests` dispatch confirmation, records the run against the
`Database / production` environment, and injects GitHub secrets only into the identity
guard and live-test steps. The secret-bearing job runs only from `refs/heads/main` and
checks out that trusted ref; it never runs on a push, pull request, or schedule. This suite
is not read-only: the confirmation explicitly authorizes bounded E2E-user sign-in/sign-out,
test requests, and production rate-limit row updates. A connected-only GitHub PAT exception
does not authorize provider tests, provider credentials, deployment, or production data access;
it is limited to the documented, exact GitHub connector-gap operation in
`docs/codex-cloud.md`.

<!-- docs-script-refs:historical-end -->

## Commands

| Command                                       | Purpose                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `node scripts/run-vitest.mjs run <test-file>` | Focused development check with admission and offline defaults.                                                |
| `npm run test:focused -- --files <paths>`     | Related-file selection; unsafe or empty mappings fail closed to the full unit command.                        |
| `npm run test`                                | Complete default offline unit population.                                                                     |
| `npm run typecheck:backend`                   | Backend TypeScript check, selected for backend and unknown local scope.                                       |
| `npm run test:backend`                        | Discover all backend tests; prints PostgreSQL integration NOT RUN without an explicit loopback test database. |
| `npm run test:backend:integration`            | Require an explicit loopback `WARD_TEST_DATABASE_URL`; refuse missing or remote databases.                    |
| `npm run test:backend:coverage`               | Backend discovery with separate `coverage/backend/lcov.info`, without an invented coverage floor.             |
| `npm run test:ci-workflows`                   | Selected offline cache, runner, lock parity, backend-CI and audit-CI contracts.                               |
| `npm run test:live`                           | Explicit provider suite; needs separate authority and `ALLOW_PROVIDER_TESTS=true`.                            |
| `npm run test:e2e:pr`                         | Production Chromium CSRF spec, excluding `@mockup` and legacy `@quarantine` tags.                             |
| `npm run test:e2e:ward-journeys`              | Synthetic Ward Chromium journeys.                                                                             |
| `npm run test:e2e:release-gate`               | Dedicated desktop Chromium and phone WebKit release journeys/axe checks.                                      |
| `npm run test:e2e:advisory`                   | Tag-filtered mockup/legacy `@quarantine` selections; no waiver from required journeys.                        |
| `npm run verify:cheap`                        | Broad offline local static, lint, typecheck and unit gate.                                                    |
| `npm run verify:pr-local`                     | Risk-routed local readiness; inspect `-- --dry-run` against the actual changed set.                           |
| `npm run verify:ui`                           | Lock parity plus the production Chromium selection, not the complete Ward journey suite.                      |
| `npm run check:coverage-inventory`            | Verify the declared executable-file population against produced LCOV.                                         |
| `npm run docs:maintain:check`                 | Read-only document, index, organisation and reference-pack integrity aggregate.                               |

Local readiness always invokes its selected gates: the cross-gate receipt store and gate arbiter
were retired on 18 October 2026, so
`run-heavy.mjs` and `run-vitest.mjs` never skip a run on an earlier result. Report reused evidence only
when you reuse an exact earlier run of the same inputs, with its time and scope.

The full unit gate separately checkpoints complete batches. Reuse requires matching source,
dependencies, command and environment, including all three `WARD_ENGINE_FUZZ_*` settings. Each batch
must retain its process outcome as well as assertion results; older checkpoints without that evidence
are refused. A normal exit 1 is valid evidence of assertion failures, not permission to ignore a
launch failure, signal, unhandled error or disagreement between the process and its assertion report.
A test file that fails outside its tests (an import crash) is a failing file; it is never accepted as
a listed expected red.

Playwright keeps an internal JSON report even with a caller-selected display reporter. Explicitly
requested projects must each execute a test across the reports; listing a project in configuration
or skipping all its tests is insufficient. Only the existing `test:e2e:advisory` selection may be
empty. A diagnostic rerun cannot erase an initial shard failure. Browser preflight includes both
mobile WebKit projects. The release accessibility sweep checks HTTP success, the intended final
URL and screen identity before axe, including the bed-meeting phone fallback. The complete release gate requires all four named journeys on desktop Chromium and phone WebKit: eight passed cases, no skips and no retry recovery. Any serious or critical axe WCAG violation fails it; the runner does not rescan to turn an initial failure green.

The script-budget check requires positive finite limits and complete measurements, counts queried
Next script assets, and rejects missing/empty assets or unexpected redirects. The existing WF-001
legacy redirect is accepted only at its exact coded destination. `check:client-bundle-secrets` scans
tracked source for known credential patterns, fails on unreadable eligible files, and retains its
synthetic exclusions; it does not inspect built bundles. Bounded FULL dependency analysis resolves
safe local const literal imports; unresolved or shadowed loads still retain the full gate.

Set `FAST_CHECK_SEED` to reproduce the property tests; local and ordinary CI runs default to `424242`. The scheduled engine safety run separately uses `scripts/ward-flow/engine-fuzz-window.mjs`: a reproducible UTC-day window of 16 sequences, 100 steps each. Its JSON records first/last seeds and the 1,600-event budget. Reproduce with `--date YYYY-MM-DD` and the recorded `WARD_ENGINE_FUZZ_FIRST_SEED`, `WARD_ENGINE_FUZZ_SEQUENCES` and `WARD_ENGINE_FUZZ_STEPS`; checkpoint identity includes all three settings. `WARD_TEST_PROFILE_DIR` enables aggregate preparation counters and milliseconds without source text or event payloads. Unit blob and Playwright JSON extractors produce reviewable timing JSON; update duration records from comparable successful measurements, without capping real outliers or inventing hosted savings.

## Component tests (jsdom)

Two Vitest projects run under one `npm run test` (see `vitest.config.mts`):

- **node** (`tests/**/*.test.ts`) — pure logic, route handlers, and SSR-string assertions.
- **jsdom** (`tests/**/*.dom.test.tsx`) — interactive component tests via `@testing-library/react`. The `.dom.test.tsx` suffix is required; a `.test.ts` file is collected by the node project and has no DOM.

Author component tests to assert **user-visible behaviour**, not markup snapshots:

- Query by role and accessible name (`getByRole("button", { name: … })`) so a missing or wrong `aria-label` fails the test; drive interactions with `@testing-library/user-event`.
- Cover the state matrix the change touches — loading / empty / error / disabled — plus keyboard operability and focus where relevant.
- The shared setup (`tests/setup/jsdom.setup.ts`) registers jest-dom matchers, auto-unmounts between tests, and polyfills `matchMedia` (override per test with the exported `installMatchMediaStub`) and `Element.scrollIntoView`.
- Mock hooks/modules with `vi.mock`; when the factory needs a spy, create it with `vi.hoisted` so it exists when the hoisted mock runs.

<!-- docs-script-refs:historical-start -->

> **Historical component examples:** some example files below were removed; consult current tests before reusing a path.

Reference examples: `tests/icon-button.dom.test.tsx` (accessible-name contract), `tests/sheet.dom.test.tsx` (stacked-overlay keyboard + scroll-lock), `tests/scroll-behavior.dom.test.tsx` (reduced-motion), `tests/registry-retry.dom.test.tsx` (`vi.hoisted` hook mock + error recovery).

<!-- docs-script-refs:historical-end -->

## Playwright ownership

The repository runner exclusively builds and serves each Playwright production app. It selects a safe port, verifies `/api/local-project-id`, uses an isolated `.next-playwright/<run-id>` build directory, replaces provider configuration with inert loopback values, and removes its server and output on success, failure, or signal. Playwright configuration never starts a server. The production boot guard permits this demo profile only when the output is isolated, provider mode is offline, credentials are absent, and the Supabase URL is the inert `127.0.0.1:1` target. Before acquiring the heavy lock or building, the runner preflights the Chromium (or requested Firefox/WebKit) executable — including the default `chrome-headless-shell` binary and any `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override — and exits non-zero immediately when it is missing, so a launch-infra failure cannot be mistaken for product-test failures after a multi-minute build. The designated download-disabled container image is the one exception: when `PLAYWRIGHT_BROWSERS_PATH` is exactly `/opt/pw-browsers` and the client-pinned shell is absent, the runner selects the newest preinstalled shell for the current platform and CPU architecture, then passes its exact path to Playwright. It logs that fallback before the build; generic shared caches still fail closed even when `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, so a developer cache cannot silently bless a stale browser.

When capturing Playwright output through a shell pipe (`cmd 2>&1 | tee …`), enable `set -o pipefail` (or avoid the pipe). Without it, bash reports the pipeline exit from `tee` (`0`) while the log still ends in `N failed` — a measurement artifact that previously looked like a green-when-broken gate (outstanding-issues #120). The Node runners themselves already propagate Playwright’s exit status.

The active Ward CI prepares one isolated offline production browser build and fans the verified
artifact out to three journey runners and the release gate. Consumers check checkout/toolchain,
build flags, isolated path and payload digest. The separate production-build job still checks the
normal application build. On verified main reuse the prepared-build job is skipped and release
journeys build afresh. Next working-cache reuse is separate from this completed artifact; only main
saves explicit Next/browser cache entries. Local keep-root reuse still rebuilds unless an explicitly
verified prepared artifact is selected.

Blocking tests run with zero retries. The browser wrapper selects list and JSON reporters;
the reporter defaults in `playwright.config.ts` do not establish that JUnit is produced by that wrapper.
Default reports and traces stay under a unique `test-results/<run-id>-<uuid>/` directory after the
temporary build is removed. A later invocation, including the CI CSRF check, uses a separate directory. At startup the runner keeps only the newest five such run directories,
counting the current one, and never removes anything else under `test-results/`.
Each report must also be configured with every requested project, including each name of a variadic
`--project a b` selection. An optional local sharded diagnostic rerun writes to its own directory and
cannot erase the original failure. A job name is never enough to establish which tests executed or why
they failed.

The former `verify:phone-chrome` command is retired in this repository. For phone changes select the
affected current Ward journey or the dedicated release-gate phone project. Browser emulation does
not establish physical Safari or installed-PWA acceptance.

### Playwright project cadence

`playwright.config.ts` declares ten always-present projects plus the conditional
`chromium-mockups-known` and `ward-shared-mode` projects. Declaring a project is not proof CI executes it.

| Project                                                       | Execution in the dedicated Ward Flow repository                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `release-gate-desktop`, `release-gate-phone`                  | `test:e2e:release-gate`: desktop Chromium and phone WebKit, in the browser-scoped `release-gate` job.                                                                                                                                                                                                                                                                          |
| `chromium-mockups`                                            | `test:e2e:ward-journeys`: required Ward journeys in three file groups when the planner selects browser work.                                                                                                                                                                                                                                                                   |
| `chromium-mockups-known`                                      | Conditional local/fold project when `WARD_JOURNEY_KNOWN_FAILURES` is set; not a separate CI matrix.                                                                                                                                                                                                                                                                            |
| `ward-shared-mode`                                            | Conditional: shared mode against a local backend and PostgreSQL, only through `node tests/support/ward-shared-mode-run.mjs` (needs `WARD_E2E_DATABASE_URL`); CI runs it in the separate backend/shared-production job. It builds and serves production Next plus a production backend through loopback HTTPS and local fake authentication, including save/reload persistence. |
| `chromium`                                                    | `test:e2e:pr` selects the production CSRF spec; CI invokes that spec explicitly in browser group 1.                                                                                                                                                                                                                                                                            |
| `firefox-ward-responsive`, `webkit-ward-responsive`           | Manual/selective responsive checks through the existing wrapper.                                                                                                                                                                                                                                                                                                               |
| `firefox`, `webkit`, `mobile-webkit`, `mobile-pwa-standalone` | Available for explicit project selection; no general main/weekly release matrix invokes them in the current workflows.                                                                                                                                                                                                                                                         |

The responsive projects select only `tests/ui-ward-responsive-audit.spec.ts` and require `@mockup`.
Run a selected project through `npm run test:e2e -- tests/ui-ward-responsive-audit.spec.ts --project=firefox-ward-responsive`
(or `--project=webkit-ward-responsive`). Availability and a Chromium result do not prove execution
in another engine. Phone WebKit in the release gate is emulation, not physical Safari/PWA acceptance.

<!-- docs-script-refs:historical-start -->

> **Historical phone geometry diagnostic:** the following pattern refers to the former PsychSift shell. It is retained as incident context, not a Ward Flow UI contract.

### Phone sticky-header settle timing (screenshots and DOM measurements)

The phone header stack (`.phone-sticky-header-stack`) uses `position: fixed` in browser tabs and `position: absolute` within the phone viewport frame in installed standalone mode, and mounts collapsed. The top content reserve `max-sm:pt-[var(--phone-overlay-chrome-h)]` resolves to the full measured stack height only after mount via `usePhoneOverlayChromeReserve` across an 80ms quiet window (`phoneOverlayReserveGeometryQuietWindowMs`). Standalone tests must assert the absolute-positioning contract.

Playwright tests that evaluate DOM offsets (`getBoundingClientRect()`, `offsetTop`, etc.) or capture screenshots immediately at `networkidle` can observe premature unsettled geometry (such as content appearing at `y=72` under the header rather than at its settled `y=121` position, as discovered on `/dictionary/browse` in #XPY409).

**Required settle assertion pattern before reading DOM offsets or taking screenshots:**

```ts
import { expect, type Page } from "@playwright/test";

// Wait for the phone header stack and overlay reserve to settle
await expect
  .poll(
    async () => {
      return page.evaluate(() => {
        const stack = document.querySelector<HTMLElement>(".phone-sticky-header-stack");
        const reserve = getComputedStyle(document.documentElement).getPropertyValue("--phone-overlay-chrome-h");
        const stackHeight = stack ? Math.round(stack.getBoundingClientRect().height) : 0;
        const reservePx = parseFloat(reserve) || 0;
        return stackHeight > 0 && Math.abs(stackHeight - reservePx) <= 1;
      });
    },
    { message: "expected phone-sticky-header-stack and --phone-overlay-chrome-h to settle" },
  )
  .toBe(true);
```

Or when measuring a specific content element (`main` or `h1`), wait for its vertical offset to stabilize across frames:

```ts
await expect
  .poll(
    async () => {
      return page.evaluate(async () => {
        const el = document.querySelector<HTMLElement>("main, h1");
        if (!el) return false;
        const first = Math.round(el.getBoundingClientRect().top);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const second = Math.round(el.getBoundingClientRect().top);
        return first > 0 && Math.abs(first - second) <= 1;
      });
    },
    { message: "expected content vertical offset to stabilize across animation frames" },
  )
  .toBe(true);
```

<!-- docs-script-refs:historical-end -->

## Appearance verification

The former `ui-style-contract`, `ui-visual-baseline` and visual-artifact specs were removed from this
dedicated repository. There is no active visual-baseline CI job or automatic screenshot adoption
workflow. The retained generic `playwright.visual.config.ts` is not evidence of a running gate.
Verify changed Ward appearance through the affected Ward journey and direct browser inspection,
including meaningful computed styles, geometry, keyboard interaction and accessibility where affected.
Follow the bounded screenshot and viewport rules in [AGENTS.md](../AGENTS.md).

<!-- docs-script-refs:historical-start -->

## Performance budget (historical tooling reference)

The Lighthouse commands and CI cadence described in this section belong to the former monorepo.
They are not active Ward Flow gates: the current workflow has no Lighthouse or live-web-vitals job.
Use the actual workflow and root package scripts to establish available checks.

`npm run verify:lighthouse` builds and serves an isolated production app in demo mode, measures the
routes in `lighthouse-budget.json` on mobile and desktop, and grades the result. It is a **relative**
gate: absolute web-vitals thresholds are meaningless against a localhost server with no network
latency, so each route is compared to a committed known-good baseline with a per-metric tolerance,
following the same shape as `check:bundle-budget`.

- No baseline recorded → warn, exit 0. Within tolerance → pass. Over tolerance → fail when
  `enforce` is true, warn otherwise.
- Incomplete evidence — a route that produced no report, a report with no LCP/CLS, or a report that
  measured a different page after a redirect — **always fails**, regardless of `enforce`. An ungraded
  route counted as a pass is the failure mode `summarise-web-vitals.mjs` documents at length.
- CLS is graded on absolute movement; LCP and TBT need to clear both a percentage and an absolute
  floor, so 12 ms → 16 ms is not reported as a 33% regression.
- A cell that produced **no measurement at all** — a non-zero exit, no report file, or a report
  carrying only a `runtimeError` such as Lighthouse's own `NO_NAVSTART` (ledger #147 recorded
  `/forms` doing this) — is retried **once**, and the retry is always logged to the run summary and
  written to `retries.txt` whether or not it recovered. A run that never started measured nothing
  about the diff; it is not a pass either, so if the retry also produces nothing the grader still
  fails closed. A cell that _did_ measure outside its numeric budget receives exactly two targeted
  confirmation samples; only that failing route/strategy is repeated, all three reports are retained,
  and their majority is graded. Missing or incomplete confirmation evidence retains the initial
  breach and fails closed. Passing cells are never re-run.
- The 45-minute required CI job reserves 10 minutes for the isolated build, 2 minutes for server
  readiness, and 28 minutes for the complete measurement suite. Each Lighthouse process receives
  the lesser of its 120-second cap and the suite time remaining. If time runs out, unmeasured cells
  remain missing and the grader fails closed, while the artifact still uploads for diagnosis.

### Baseline browser pinning, and how to refresh

The baseline is a **browser-specific** artefact. `check-lighthouse-budget.mjs` fails closed when a
baseline row's `chromeVersion` differs from the measuring run's, because a browser bump is otherwise
indistinguishable from an application regression. Both Lighthouse jobs therefore pin Playwright's
managed Chromium through the shared `./.github/actions/setup-lighthouse-chromium` composite action —
never the ambient runner-image Chrome, which is not pinned per commit (the fleet was observed serving
HeadlessChrome/150 and /151 to jobs minutes apart on 2026-08-07). Drift is reported as one collapsed
instruction when uniform across all expected runs, but mixed browser versions, partial legacy rows,
or incomplete evidence retain per-run diagnostics so distinct facts are not obscured. The verdict is
unchanged: incomplete evidence still fails, independently of `enforce`.

Because the numbers must come from that pinned browser, refresh the baseline **from a CI runner**,
never a developer machine:

1. Actions → CI → **Run workflow** → pick the branch → tick **refresh_lighthouse_baseline** → Run.
2. Check the run's diff step prints exactly **one** distinct `chromeVersion`, and that it is the
   pinned `HeadlessChrome/<major>`. More than one line means the refresh is not usable.
3. Download the `lighthouse-baseline-refresh-<run_id>` artifact, review the per-route deltas, and
   commit **only** `lighthouse-budget.json`.

The refresh job is dispatch-only, is not `continue-on-error` (a refresh that measured nothing must go
red), and deliberately cannot push — a workflow that can rewrite a gate's own baseline is a gate that
can green itself. `npm run check:lighthouse-budget -- --update` exists for local experiments; its
output must not be committed.

### When the budget runs

Historically keyed off `perf_changed` in the retired `scripts/ci-change-scope.mjs`, which is deliberately narrower than the
`ui_changed || build_changed` union it replaced — that union put every dependabot lockfile bump and
every `worker/**` ingestion change through a ~7 minute isolated production build plus ten Lighthouse
runs. In scope: `src/**`, `data/**`, `public/**`, `next.config.ts`, `postcss.config.mjs`,
`tsconfig.json`, the Chromium pin composite action, and the budget's own inputs. Excluded:
`worker/**` and container surfaces, dependency manifests and the lockfile, Playwright/test surfaces
including committed screenshots, most of `src/app/api/**` (except the initial-load handlers
`/api/setup-status` and `/api/local-project-id` that `/` always fetches), `src/app/mockups/**`, and
server/edge runtime entry points other than `src/proxy.ts` (which runs before every budgeted
navigation). An unrecognised path under a listed root stays **in** scope, so a future refactor
over-triggers by one job rather than silently dropping a render surface.

Event matrix: pull requests on perf scope when not a draft; `merge_group` on perf scope so the
required aggregate re-verifies the exact merge candidate; `push` to `main`/`release/**` on perf
scope **or** when `lockfile_changed` is true (the
lockfile arm is the backstop for a runtime dependency bump the PR arm deliberately excludes from
`perf_changed`); the weekly `schedule`; and `workflow_dispatch`. The `lighthouse-budget` label
forces a run and `skip-lighthouse-budget` opts out, with skip winning. Caveat:
`on.pull_request.types` has no `labeled` (adding it would re-run all of CI on every label change),
so the opt-in label takes effect on the next push or re-run — use `workflow_dispatch` for an
immediate run.

This is distinct from `.github/workflows/live-web-vitals.yml`, which measures the deployed origin for
ledger #017 and is dispatch-only — by the time it runs, `main` has already auto-deployed. Both pin
the same Lighthouse version, and `tests/check-lighthouse-budget.test.ts` fails if they drift apart.
Neither uses secrets or providers. The live workflow validates canonical root-relative, collision-free
route paths before it contacts the origin; it requires at least three samples and caps the complete
matrix at 30 Lighthouse calls. Its 45-minute job gives each live child 80 seconds, sends `TERM`, then
allows a 10-second kill grace. A failed cell remains a warning so the summary can retain its existing
evidence-based verdict rather than disguising a public-network failure as a local gate result.

<!-- docs-script-refs:historical-end -->

## Flake policy

Blocking Playwright tests run with zero retries. The flake ledger and quarantine tooling were
retired on 18 October 2026; `tests/flake-ledger.json` is no longer read. A repeatable failure on
the same commit must be fixed or reported. Legacy tag filters in command aliases do not restore
that policy. Report and investigate failures on the same revision: a diagnostic rerun supplies
additional evidence and does not erase the initial failure. See [checks and evidence](agents/checks-and-evidence.md).

<!-- docs-script-refs:historical-start -->

> **Retired quarantine policy:** the following paragraph records the former ledger requirements.

`tests/flake-ledger.json` may be empty. Each entry must match the exact spec and title, and the test title must include `@quarantine` but not `@critical`. Entries require an owner, reproduction command, local tracking reference, first/last-seen dates, and an expiry no more than 30 days away. Reproduce a candidate three times on the same SHA before adding or retaining it: fix fail/pass races, treat repeatable failures as regressions, and remove entries that no longer reproduce.

<!-- docs-script-refs:historical-end -->

## CI topology

The active workflow is `.github/workflows/ward-flow.yml`; [Public CI](ward-flow/PUBLIC-CI.md)
describes its jobs and exact scope table. A dependency-free `plan` job derives and verifies `full`,
`unit`, `browser`, `policy`, `backend`, `build` and `frontend_static` before allocating matrices.
Recognised Ward Markdown can skip executable work. Policy selects its contracts. Backend-only
changes select frontend static checks, the full root unit gate and backend/shared proof; unit-only
changes skip backend proof. Both skip demo UI production builds and journey groups. Unknown,
deleted/renamed, executable configuration, source and non-PR/missing-history scopes fail closed.
The local readiness planner uses these flags too: inspect its dry run; source/unknown scope includes
backend typecheck/tests and production `build`.

Every root and backend install uses `scripts/install-locked-dependencies.mjs`, followed by installed
runtime inventory verification. Static work includes CI contracts, source safety, maintained links,
commands, facts and the dependency-free reference-pack membership/hash check. Full local
`docs:maintain:check` additionally checks generated indexes and organisation and needs dependencies
for site-map generation. Scoped frontend checks retain whole-tree lint and route/source typecheck.
Eight disjoint unit shards produce coverage blobs; the coverage job merges them, enforces unchanged
thresholds and validates declared executable files. Source-reading guards remain mandatory in
focused selection even after import fan-out capping; capped/deferred evidence remains partial.

The separate backend job discovers nested `.test.mjs` suites, typechecks and records backend LCOV
against disposable PostgreSQL. Without an explicit loopback `WARD_TEST_DATABASE_URL`, the local
runner says **PostgreSQL integration: NOT RUN**; the integration alias requires that URL and refuses
remote hosts. The shared-mode browser proof uses production builds, loopback HTTPS and local fake
authentication. It checks signed-in saves, another desk's view, reload persistence, conflicts,
server refusals and keyboard focus. Backend/root tests cannot substitute for that browser proof.

One prepared browser build feeds three journey groups; group 1 runs the separate Chromium CSRF
case on the same server. The release gate requires all eight named desktop/phone journey cases,
zero retry recovery and no serious or critical axe WCAG violations, without a recovery rescan. The required job checks plan, static,
backend, unit, prepared build, journeys, release, secret scan, build and coverage, and rejects
unexpected skips. Main reuse retains the existing exact-tree/PR-run proof. On that path only the
approved heavy jobs skip; static, backend/shared proof, secret scan and a fresh release run remain.

Events include the nightly 18:00 UTC (02:00 AWST) full main run. Nightly fuzz windows are bounded and
recorded for reproduction; preparation profiles and unit/browser timing JSON support measurement.
Coverage blobs and prepared builds are kept one day; static/unit and failed browser diagnostics
three days; backend evidence, final coverage/unit costs and browser execution reports/costs seven
days. Explicit cache saves are main-only. These are retention policies, not evidence that a hosted
run passed or that it became faster. `.github/workflows/dependency-audit.yml` is the separate audit
workflow. Hosted results and deployment state require observed evidence and their own authority.

<!-- docs-script-refs:historical-start -->

> **Historical contribution checklist:** retained from the former shared UI. Paths and gate references below may be retired; follow current Ward Flow agent rules and the maintained sections above.

## Contribution checklist (UI changes)

Before opening a UI PR, confirm:

- **Reuse first.** Check `src/components/ui-primitives.tsx` (class recipes plus `IconButton`, `AsyncButton`, `InlineNotice`, `EmptyState`, `LoadingPanel`, `ToggleSwitch`) and `src/components/ui/sheet.tsx` (the only overlay primitive) before hand-rolling. Icon-only buttons use `IconButton` (its `label` is a required prop).
- **Tokens only.** No raw hex or Tailwind palette classes, no literal shadows, no `text-[Npx]` — see [`docs/design-system/README.md`](design-system/README.md). `check:design-system-contract`, `check:type-scale`, and `check:icon-scale` enforce this.
- **States.** Handle loading / empty / error / disabled where they apply; async surfaces expose a retry, not a dead end.
- **Accessibility** ([design-system](design-system/README.md)): keyboard operable, visible focus, accessible names on icon controls, live regions for async status, and reduced motion honoured — scripted `scrollTo`/`scrollIntoView` go through `resolveScrollBehavior` (`src/lib/scroll-behavior.ts`), never a hard-coded `behavior: "smooth"`.
- **Tests.** Add a `.dom.test.tsx` for changed component behaviour (see "Component tests" above) and update the E2E journeys for changed flows.
- **Rendered CSS.** Check the changed styles in a real browser when cascade or geometry matters; the retired style-contract registry is not a current gate.
- **Verify** ([design-system](design-system/README.md) and GATES): follow the risk tiers in root `AGENTS.md`. Prove changed component behaviour with the focused DOM test first; run `npm run ensure` before browser work and use the narrowest affected journey. Select one appropriate broad handoff gate when the diff crosses owners, cannot be bounded, or applicable PR/handoff policy requires it; do not routinely stack `verify:cheap`, `verify:pr-local`, and `verify:ui`. Add a manual dark-mode + forced-colors spot check when those rendered states can plausibly change.
- Architecture and state-ownership conventions: `docs/frontend-architecture.md` (historical PsychSift doc).

<!-- docs-script-refs:historical-end -->
