# Dependency security follow-up

Checked 8 October 2026 against this repository's npm lockfile and the npm registry. This record
covers dependency maintenance for synthetic local development. It does not approve clinical use.

## Open upstream advisory: braces

- **Tracking:** SEC-003; [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- **Affected version:** braces 3.0.3, the latest published version on the checked date. There is no
  supported patched release to select. This vulnerability remains open.
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
- **Decision:** retain the supported Next 16 toolchain while awaiting an upstream fix. Do not use
  `npm audit fix --force`: its suggested ESLint/Next 14 downgrade is incompatible with the current
  application. This is a bounded maintenance exception, not a zero-vulnerability claim.
- **Follow-up owner:** Ward Flow dependency/tooling maintainer; assignment and any broader risk
  acceptance remain with the repository owner.
- **Next review:** 22 October 2026, or immediately on a braces/Next ESLint patch or a change that
  accepts external glob patterns. Re-run `npm view braces version`, `npm explain braces` and
  `npm audit --json`; install a supported patch and verify the lint contracts when available.

## Patched advisory roots

The remediation lock selects sharp 0.35.5 (including libvips 1.3.4), source-map-js 1.2.2 and
smol-toml 1.9.0. These address SEC-001, SEC-002 and SEC-004 respectively. The sharp override and
its installation allowlist entry agree. All other application versions are retained. Run a clean
locked install, image processing, source-map/TOML consumer checks, the production audit and the
integration build before claiming the candidate's full verification.
