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

## Open advisory and review ownership

[SEC-003 in the dependency follow-up](dependency-security-exceptions.md#open-upstream-advisory-braces)
is the single record for the open `braces` advisory, its dependency path, mitigation, owner and
next review. The original audit identifiers R43 and QF-10 refer to that same finding. The five
affected npm package records do not represent five independent advisories.

The next review is **5 November 2026**, or sooner on the triggers in that record. Review the
nightly full-audit warning in the meantime. Do not use `npm audit fix --force`, an unsupported
Next lint downgrade, a fabricated patched version or an advisory suppression to obtain green.

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
