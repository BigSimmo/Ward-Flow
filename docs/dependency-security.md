# Dependency advisory maintenance

The [dependency audit workflow](../.github/workflows/dependency-audit.yml) checks the root and
`backend/ward-flow` lockfiles nightly at 02:30 AWST and on manual request. It reads the lockfiles
without installing packages or running lifecycle scripts. The two package audits run independently,
so a frontend finding does not cancel the backend report.

Production **high and critical** advisories fail the scheduled job. A separate full audit includes
development tooling, prints its JSON, emits a warning on a nonzero result and retains the report for
seven days. Review those warnings, including audit-service errors; an informational result is not a
claim that the finding is fixed or accepted. Moderate and lower production findings also remain in
the full report. This standalone schedule does not change the existing PR or deployment gates.

## Advisory records

The historical `braces` finding (SEC-003, R43 and QF-10) was closed after upstream
withdrawal. Its [canonical record](dependency-security-exceptions.md#open-upstream-advisory-braces)
preserves the dated evidence and cancels the former 5 November review. Routine audits
and review of new advisories continue.

### Minimatch globparts amplification — 5 November 2026

[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) affects
`minimatch >=7.0.0 <11.0.1`. A fresh root-lock audit found version 10.2.5 or 10.2.6
through ESLint, `@eslint/config-array` and `typescript-eslint`. The ten affected npm
package records all traced to this one moderate development-tooling advisory.

The root override `minimatch@10: 11.0.1` replaces those three affected copies while
leaving the unrelated version 3.1.5 copy intact. Version 11.0.1 supports the pinned
Node 24 runtime. ESLint and Next's lint configuration remain on their existing versions;
no forced toolchain downgrade or advisory suppression is used. The lockfile also adds
Minimatch's development-only `@isaacs/nonrecursive-glob-match` dependency.

Fresh full lockfile audits after the update reported zero known advisories in both the
root and `backend/ward-flow` trees. This is a dated advisory-database result, not proof
of complete security or runtime exploitability.

Do not use `npm audit fix --force`, an unsupported Next lint downgrade, a fabricated
patched version or an advisory suppression to obtain green.

The [post-merge operations record](ward-flow/operations-readiness.md) separates merged audit
repairs from browser, deployment and recovery evidence; a passing build does not close an
unverified operational check.

Useful read-only commands:

```sh
npm audit --json
npm audit --omit=dev --audit-level=high
npm --prefix backend/ward-flow audit --json
npm --prefix backend/ward-flow audit --omit=dev --audit-level=high
npm view braces version dist-tags --json
npm view braces versions --json
npm view micromatch version dependencies --json
npm view @next/eslint-plugin-next version dependencies --json
```

Record the exact advisory, affected dependency path, registry response and verification date in the
task evidence. Do not treat zero known production advisories as proof of complete security.
