# Testing: historical diagnostics

> **Historical, moved 2026-10-24.** These sections were moved out of [`docs/testing.md`](../../testing.md)
> on 24 October 2026 with the owner's approval. They record former PsychSift and workstation
> diagnostics, the retired Lighthouse budget and the former UI contribution checklist. They are not
> current Ward Flow instructions and do not select a gate. Current testing guidance is in
> [`docs/testing.md`](../../testing.md).

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

<!-- docs-script-refs:historical-start -->

> **Historical contribution checklist:** retained from the former shared UI. Paths and gate references below may be retired; follow current Ward Flow agent rules and the maintained sections above.

## Contribution checklist (UI changes)

Before opening a UI PR, confirm:

- **Reuse first.** Check `src/components/ui-primitives.tsx` (class recipes plus `IconButton`, `AsyncButton`, `InlineNotice`, `EmptyState`, `LoadingPanel`, `ToggleSwitch`) and `src/components/ui/sheet.tsx` (the only overlay primitive) before hand-rolling. Icon-only buttons use `IconButton` (its `label` is a required prop).
- **Tokens only.** No raw hex or Tailwind palette classes, no literal shadows, no `text-[Npx]` — see [`docs/design-system/README.md`](../../design-system/README.md). `check:design-system-contract`, `check:type-scale`, and `check:icon-scale` enforce this.
- **States.** Handle loading / empty / error / disabled where they apply; async surfaces expose a retry, not a dead end.
- **Accessibility** ([design-system](../../design-system/README.md)): keyboard operable, visible focus, accessible names on icon controls, live regions for async status, and reduced motion honoured — scripted `scrollTo`/`scrollIntoView` go through `resolveScrollBehavior` (`src/lib/scroll-behavior.ts`), never a hard-coded `behavior: "smooth"`.
- **Tests.** Add a `.dom.test.tsx` for changed component behaviour (see "Component tests" above) and update the E2E journeys for changed flows.
- **Rendered CSS.** Check the changed styles in a real browser when cascade or geometry matters; the retired style-contract registry is not a current gate.
- **Verify** ([design-system](../../design-system/README.md) and GATES): follow the risk tiers in root `AGENTS.md`. Prove changed component behaviour with the focused DOM test first; run `npm run ensure` before browser work and use the narrowest affected journey. Select one appropriate broad handoff gate when the diff crosses owners, cannot be bounded, or applicable PR/handoff policy requires it; do not routinely stack `verify:cheap`, `verify:pr-local`, and `verify:ui`. Add a manual dark-mode + forced-colors spot check when those rendered states can plausibly change.
- Architecture and state-ownership conventions: `docs/frontend-architecture.md` (historical PsychSift doc).

<!-- docs-script-refs:historical-end -->
