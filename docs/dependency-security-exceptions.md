# Dependency security follow-up

Current advisory review: 24 October 2026 (AWST), from the public GitHub advisory record. This is
the canonical status record for SEC-003, also R43 and QF-10. The dated npm, mitigation and
installation evidence below is historical. This record covers dependency maintenance for synthetic
local development; it does not approve clinical use.

<a id="open-upstream-advisory-braces"></a>

## Closed by upstream withdrawal: braces

- **Tracking:** SEC-003, R43 and QF-10 are aliases of
  [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), one finding.
- **Current status:** withdrawn by upstream and closed on that basis. GitHub records
  `withdrawn_at: 2026-10-23T12:53:02Z` and `updated_at: 2026-10-23T12:53:05Z`. The advisory's
  withdrawal explanation says the reported issue is not practically exploitable.
- **Closure basis:** upstream withdrawal, not a patched release or dependency upgrade. The record
  retains `first_patched_version: null` and the historical vulnerable range `<= 3.0.3`; those
  retained fields do not override the withdrawal status. No package or lockfile change is required
  to close this advisory.
- **Follow-up:** cancel the conditional 5 November 2026 review for this withdrawn advisory.
  Routine dependency audits still apply, including review of any new advisory or relevant tooling
  configuration change. The literal-pattern mitigation recorded below remains useful tooling
  guidance; it is no longer an open exception awaiting a patch for this advisory.
- **Evidence limits:** this review checks the advisory's status. It does not claim a fresh npm
  audit, package-registry query, installation, test run or hosted result. Earlier audit counts
  below remain dated evidence, not a statement of current audit output.

## Historical upstream advisory review — 21 October 2026

The following open/upstream-blocked assessment and its follow-up dates describe the evidence
available on 21 October, before the withdrawal above. They are retained as history and are
superseded by the current closure status and cancellation of the 5 November review.

Review source: main `67ace3940b17a422a574dfab5d28a9def4bf0ad7` and the npm registry.

- **Tracking:** SEC-003, also R43 and QF-10;
  [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). These are aliases of
  one finding, not additional open issues.
- **Affected version:** braces 3.0.3, the latest published version on the checked date. There is no
  supported patched release to select (`npm view braces version` still returns `3.0.3`). This
  vulnerability remains open and upstream-blocked.
- **Supported parent updates:** the latest `micromatch` 4.0.8 still requires `braces ^3.0.3`;
  `fast-glob` 3.3.3 still requires that micromatch line. Even `@next/eslint-plugin-next` 16.4.2
  pins `fast-glob` 3.3.1. Merged dependency PR #335 retains this chain and therefore does not close
  this advisory. Updating these packages solely for R43 would leave the vulnerable parser present.
- **Dependency path:** development-only `eslint-config-next` 16.4.2 → `@next/eslint-plugin-next`
  16.4.2 → `fast-glob` 3.3.1 → `micromatch` 4.0.8 → `braces` 3.0.3. The five audit package entries
  describe one inherited advisory, not five separate vulnerabilities.
- **Trigger and consequence:** an adversarial deeply nested brace glob can exhaust the parser's
  stack and terminate a developer or CI tooling process.
- **Observed reachability:** the Next ESLint plugin's `get-root-dirs.js` calls fast-glob for an
  explicitly configured `settings.next.rootDir` pattern. This repository does not configure that
  setting. Current lint commands use maintained literal source roots, not web/request/patient
  supplied patterns. No runtime application import or untrusted HTTP glob endpoint was found.
  Developer-supplied CLI patterns and future configuration changes can still expose the parser.
- **Current mitigation:** retain literal lint roots; review new rootDir/glob configuration before
  accepting external patterns. Required CI has job deadlines, read-only permissions and no
  persisted checkout credentials. A malicious pull request can disrupt its own tooling run, but
  this record establishes no guarantee that every possible repository-tooling path is protected.
- **20 October audit:** the reviewed lock reports five high development package entries for this one
  advisory; `npm audit --omit=dev --json` reports zero vulnerabilities. The full audit exits nonzero
  while this exception is open. Neither result establishes a reachable application exploit.
- **Decision:** retain the supported Next 16 toolchain while awaiting an upstream fix. Do not use
  `npm audit fix --force`: its suggested ESLint/Next 14 downgrade is incompatible with the current
  application. This is a bounded maintenance exception, not a zero-vulnerability claim.
- **Follow-up owner:** Ward Flow dependency/tooling maintainer; assignment and any broader risk
  acceptance remain with the repository owner.
- **Next review:** 5 November 2026, or immediately on a braces/Next ESLint patch or a change that
  accepts external glob patterns. The 22 October review was brought forward to 21 October; see
  below for why the date moved. Re-run `npm view braces version`, `npm explain braces` and
  `npm audit --json`; install a supported patch and verify the lint contracts when available.

## Scheduled review — 21 October 2026

Fresh npm registry queries on 21 October return braces 3.0.3, micromatch 4.0.8 and fast-glob 3.3.3
as latest, unchanged since September 2024. `@next/eslint-plugin-next` latest (16.4.2) and canary
(16.5.0-canary.21) both still pin fast-glob 3.3.1. `npm audit --package-lock-only --json` reports
the same five high development entries for GHSA-vfj7-8cjw-p6xm and nothing else.

No safe override exists. fast-glob 3.x requires micromatch 4 (3.3.1, the plugin's pin, declares
`^4.0.4`; 3.3.3 declares `^4.0.8`). Every micromatch 4 release requires braces 3, and the advisory
covers every braces release with no patched version published, so an override can only select the
same vulnerable parser. Replacing
fast-glob or micromatch with a different library under the plugin would be an unsupported local
substitution. `eslint.config.mjs` still sets no `settings.next.rootDir`, so the plugin's only
fast-glob call is not reached by the configured lint run.

Decision: SEC-003 stays open and upstream-blocked with the same mitigation. The review moves to
5 November 2026 because two weeks matches the observed upstream cadence (no release in over a
year) while keeping a short interval; the nightly full audit and the immediate triggers above still
apply in between.

## Audit repair review — 20 October 2026

The audited checkout's lock selects `eslint-config-next` and `@next/eslint-plugin-next` 16.4.2.
Fresh npm registry queries still return braces 3.0.3, micromatch 4.0.8 and fast-glob 3.3.3 as their
latest releases. The latest Next ESLint plugin remains 16.4.2 and still pins fast-glob 3.3.1.
Updating the available parent packages does not remove the vulnerable parser, and there is no
published patched braces release to override to. No unsupported downgrade, audit suppression or
local parser replacement was applied.

`npm audit --package-lock-only --json` still reports five high development package entries for this
one advisory, while `npm audit --omit=dev --package-lock-only --json` reports zero vulnerabilities.
SEC-003 remains open and upstream-blocked, with the literal-pattern mitigation and 22 October
review retained. The installed dependencies in the audit environment differ from this lock;
these are fresh lockfile/registry results, not a claim of a clean locked installation or passing
lint, browser or hosted checks.

## Local remediation review — 18 October 2026

The full-audit remediation branch was based on verified main
`aa3a78b9ecfd1132a7ff48867bac5f1d366dbccc`. A fresh public npm registry query still reports
braces 3.0.3 as the latest version. The unchanged lockfile audit reports the same five high-severity
development entries arising from SEC-003. Its suggested forced downgrade of the Next ESLint
configuration is not a supported fix for this application's toolchain.

No supported upstream patch is available in that evidence. SEC-003 remains open; this review does
not resolve or suppress it. The literal-root mitigation and the 22 October review above remain in
force. Local source, tests and lint results are reported separately from the upstream advisory.

## Current toolchain — 17 October 2026, after PR #335

Current main selects Next 16.4.2, React and React DOM 19.3.0, ESLint 10.12.0,
`eslint-config-next` 16.4.0, Vitest and coverage-v8 5.0.5, Vite 8.2.2 and PostCSS 8.5.30.
The follow-up raises the Undici override minimum to `^8.12.1`, matching jsdom 30.1.3's
requirement; npm's native lock resolution selects Undici 8.12.2. This repairs a development
consumer's declared dependency range, with no reproduced application failure claimed.
A fresh locked install passes the unchanged installed-lock parity guard. The fresh full
lockfile audit still reports the same five development entries for SEC-003, and the production
lockfile audit reports zero vulnerabilities. These checks do not establish full application,
browser or hosted acceptance.

## Historical toolchain and install evidence — 17 October 2026, before PR #335

The assessed lock selects Next 16.3.8, React 19.2.8, ESLint 10.12.0,
`eslint-config-next` 16.3.6, Vitest and coverage-v8 5.0.5, Codspeed's Vitest plugin 6.0.1,
Vite 8.2.2 and PostCSS 8.5.30. These are a dated lockfile snapshot, not new version constraints.
The ESLint 10 upgrade's explicit React-version setting is retained. npm still warns about the
ESLint peer ranges of the inherited React, import and accessibility plugins; successful lint
execution is separate evidence from declared peer support.

A clean `npm ci --include=dev` using the required npm 11 toolchain initially failed the normal
postinstall parity guard. Two unreachable lock entries, `supports-color@7.2.0` and its
`has-flag@4.0.0` dependency, were absent from npm's concrete install. Native lock-only generation
removed exactly those entries without changing any package version or the manifest. The fresh
clean install then passed with lifecycle scripts and the unchanged parity guard enabled; the
existing installed-lock regression suite passed all ten cases. This lock correction does not
fix or suppress SEC-003.

Vitest 5 also introduced a persistent module cache distinct from Vite's `cacheDir`. Its default
location under `node_modules` changed the stamped dependency inventory after a test run. The
supported `fsModuleCachePath` setting now keeps it in the existing worktree-specific temporary
cache. A new regression failed before this change and passed afterwards. Following another
normal clean install, all 56 runner-safety and installed-lock cases passed, then the unchanged
installed-lock parity check passed without restamping.
The separate benchmark configuration uses its own worktree-specific module cache too: all 13
benchmarks passed after a normal clean install, followed by the unchanged parity check passing.

## Historical patched advisory roots — 16 October 2026

The remediation lock selects sharp 0.35.5 (including libvips 1.3.4), source-map-js 1.2.2 and
smol-toml 1.9.0. These address SEC-001, SEC-002 and SEC-004 respectively. The sharp override and
its installation allowlist entry agree. All other application versions are retained. Run a clean
locked install, image processing, source-map/TOML consumer checks, the production audit and the
integration build before claiming the candidate's full verification.

## Historical toolchain constraints and verification

The pre-#335 merged lock selected PostCSS 8.5.30, Vite 8.2.2, Codspeed's Vitest plugin 6.0.1, and matching
Vitest/coverage-v8 5.0.5 after PR #336. Next is 16.3.8, its ESLint configuration/plugin are 16.3.6,
and ESLint is 10.12.0 after PR #338. The direct PostCSS dependency and override require at least
8.5.26, satisfying Vite's declared `^8.5.26` dependency; no forced Vite override is present.

The earlier 16 October verification used Vitest 4.1.11 with lifecycle scripts disabled. It is
historical evidence, not a check of this merged toolchain. The retained ESLint configuration names
React 19 explicitly for the inherited React plugin's ESLint 10 compatibility workaround. That
plugin's declared peer range still stops at ESLint 9, so installation can warn about its peer
range. The final integrated PR #381 passed whole-tree lint in hosted CI; no broader upstream peer
support is inferred. None of these compatibility changes closes the braces advisory above.
