# Ward Flow checks and evidence

Read when selecting or reporting verification. [AGENTS.md](../../AGENTS.md) governs safeguards; [task-efficiency.md](task-efficiency.md#ward-verification-entry-points) gives the current scoped command entry points.

## Checks and evidence

- Run the smallest check that could catch a plausible regression from this diff. Run nothing for planning or read-only work. Do not stack broad gates or rerun an unchanged passing gate.
- While editing, run `npx vitest run <path/to/test.ts>` directly. `npm run test:focused -- --files <paths>` suits source-only iteration and fails closed to `npm run test`. Keep `npm run test` and `npm run verify:pr-local` for pre-push readiness. Current entry points: [task-efficiency.md](task-efficiency.md).
- One wide run at a time per machine. Narrow checks use the shared run slots. A busy lock belongs to someone else: wait or narrow the check, never force or delete lock state.
- Before running a script, confirm its checkout, base and provider effects suit this repository. A pass in the old checkout proves nothing here.
- Stop servers, browsers and processes you started once the task no longer needs them. Check ownership before stopping one that may belong to another session.
- Paste the decisive output line. Exit 0 alone is not proof. Say what was run, what was read and what is inferred.
- Report reused evidence as reused. A skipped, deferred, previewed or advisory check is never a pass, and missing CI checks are not green. Unknown CI coverage means run the selected gate or report it blocked. A declared workflow is not an observed verdict.
- A focused run is not a full-suite verdict. Local checks do not prove hosted CI, a database connection or a deployment. Chromium evidence does not close physical Safari or installed-PWA acceptance.
- Check a bot's or agent's claim that a fix landed against the actual commit before repeating it.
- Playwright blocking tests run with zero retries. There is no quarantine: `tests/flake-ledger.json` is no longer read (its tooling was retired on 18 October 2026), so a test that keeps failing on the same commit is a real failure to fix or report.
- Test deletion guard: `npm run check:diff-integrity` measures test-case drops against the merge base with `origin/main`. Drops are advisory by default and fail with `DIFF_INTEGRITY_STRICT=1`. Truncation artefacts and an unreadable before-state always fail. Record a deliberate reduction as `{path, before, after, reason, approvedOn}` in `diff-integrity.json`. Never raise thresholds to clear a diff. Detail: [test-deletion-guard.md](test-deletion-guard.md).
- Dead code: "nothing imports it" is not enough. Before removing an exported symbol, run `npm run check:dead-code-candidate -- --diff origin/main`. A refusal fails closed. Only with Josh's explicit approval for that run may you set `DEAD_CODE_OWNER_APPROVED=1` on that single invocation, never as a default or in a script, and record the approval in the PR. Detail: [dead-code-deletion.md](dead-code-deletion.md).
