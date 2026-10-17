# Dependency security follow-up

Current advisory review: 17 October 2026, from main
`ed9d59e71a294787e4fd32c8363ee875c7b63161` and the npm registry. This is the canonical record for
the remaining advisory. The dated installation evidence below is retained separately. This record
covers dependency maintenance for synthetic local development; it does not approve clinical use.

## Open upstream advisory: braces

- **Tracking:** SEC-003, also R43 and QF-10;
  [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). These are aliases of
  one finding, not additional open issues.
- **Affected version:** braces 3.0.3, the latest published version on the checked date. There is no
  supported patched release to select (`npm view braces version` still returns `3.0.3`). This
  vulnerability remains open and upstream-blocked.
- **Supported parent updates:** the latest `micromatch` 4.0.8 still requires `braces ^3.0.3`;
  `fast-glob` 3.3.3 still requires that micromatch line. Even `@next/eslint-plugin-next` 16.4.2
  pins `fast-glob` 3.3.1. Open dependency PR #335's Next 16.4.0 update therefore does not close
  this advisory. Updating these packages solely for R43 would leave the vulnerable parser present.
- **Dependency path:** development-only `eslint-config-next` 16.3.6 → `@next/eslint-plugin-next`
  16.3.6 → `fast-glob` 3.3.1 → `micromatch` 4.0.8 → `braces` 3.0.3. The five audit package entries
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
- **17 October audit:** the corrected lock reports five high development package entries for this one
  advisory; `npm audit --omit=dev --json` reports zero vulnerabilities. The full audit exits nonzero
  while this exception is open. Neither result establishes a reachable application exploit.
- **Decision:** retain the supported Next 16 toolchain while awaiting an upstream fix. Do not use
  `npm audit fix --force`: its suggested ESLint/Next 14 downgrade is incompatible with the current
  application. This is a bounded maintenance exception, not a zero-vulnerability claim.
- **Follow-up owner:** Ward Flow dependency/tooling maintainer; assignment and any broader risk
  acceptance remain with the repository owner.
- **Next review:** 22 October 2026, or immediately on a braces/Next ESLint patch or a change that
  accepts external glob patterns. Re-run `npm view braces version`, `npm explain braces` and
  `npm audit --json`; install a supported patch and verify the lint contracts when available.

## Current toolchain and install evidence — 17 October 2026

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

## Toolchain constraints and historical verification

The merged lock selects PostCSS 8.5.30, Vite 8.2.2, Codspeed's Vitest plugin 6.0.1, and matching
Vitest/coverage-v8 5.0.5 after PR #336. Next is 16.3.8, its ESLint configuration/plugin are 16.3.6,
and ESLint is 10.12.0 after PR #338. The direct PostCSS dependency and override require at least
8.5.26, satisfying Vite's declared `^8.5.26` dependency; no forced Vite override is present.

The earlier 16 October verification used Vitest 4.1.11 with lifecycle scripts disabled. It is
historical evidence, not a check of this merged toolchain. The current ESLint configuration names
React 19 explicitly for the inherited React plugin's ESLint 10 compatibility workaround. That
plugin's declared peer range still stops at ESLint 9, so installation can warn about its peer
range. The final integrated PR #381 passed whole-tree lint in hosted CI; no broader upstream peer
support is inferred. None of these compatibility changes closes the braces advisory above.
