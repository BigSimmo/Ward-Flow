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

## Upstream-blocked development advisory

Checked while preparing maintenance from main `5394102122ef823a1e3a16dc6a3d633fc7b07177`:

- [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) affects `braces <=3.0.3`.
  The root lockfile's ESLint/Next lint chain contains `braces@3.0.3` through `micromatch` and
  `fast-glob`. npm reports five affected package records for this one underlying high advisory.
- `npm view braces version dist-tags --json` reports latest `3.0.3`; the published version list has
  no newer release. `npm view micromatch version dependencies --json` reports `4.0.8`, still using
  `braces ^3.0.3`. Even `@next/eslint-plugin-next@16.4.1` still uses `fast-glob`, so updating the lint
  package alone does not remove this chain.
- `npm audit --json` suggests `eslint-config-next@14.2.35` as a semver-major change from the
  installed Next 16 lint configuration. That downgrade is not a compatible targeted fix. Do not use
  `npm audit fix --force`, a fabricated patched version, or a suppressed advisory to obtain green.

This finding remains **upstream-blocked**, not resolved or exempted. It concerns stack exhaustion
when tooling parses deeply nested glob patterns; no runtime exploit or production exposure was
established by this advisory check. Keep project/tool glob inputs trusted and bounded while
tracking a compatible upstream fix. Re-evaluate when `braces`, its callers or the lint toolchain
publish a relevant change, then validate the dependency graph, audit and focused lint/CI contracts.

Review on 17 October 2026 against Ward Flow main `7b14c9888d2ed2e534a55b2e366ddaf91f5d690b`:
the npm registry still lists `braces@3.0.3` as latest with no newer release, and
`micromatch@4.0.8` still requires `braces ^3.0.3`. No compatible version-only repair was found.
The dependency maintainer owns the follow-up: review the nightly full-audit warning and
recheck publication metadata within 30 days, or sooner on a relevant upstream release or a
change to the lint/glob dependency chain. Keep untrusted glob input out of this development
toolchain in the meantime. This mitigation and review record do not close the advisory.

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
