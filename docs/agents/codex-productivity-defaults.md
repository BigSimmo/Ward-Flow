# Codex Productivity Defaults

<!-- BEGIN:codex-productivity-defaults -->

## Codex productivity defaults

- Treat terse prompts as workflow shortcuts when the intent is clear. If the user says `run`, execute `npm run ensure`, verify the project identity through that helper, and return the printed local URL without a long log dump.
- Use the on-demand [focused Ward Flow task workflow](task-efficiency.md) for a reusable brief, one continuation record and private measurement. Start from the actual Ward Flow worktree, branch, base, owned files and relevant failures.
- For UI, browser, styling, routing, accessibility, or screenshot work, run `npm run ensure` before opening the app, then use browser QA and the smallest relevant UI proof before broader gates.
- Prefer the smallest failing check first. For this repo, use focused Vitest or Playwright targets before widening to `npm run verify:cheap`, `npm run verify:ui`, or `npm run verify:release`.
- Use `npm run test:focused -- --files <paths>` only for safe source-only iteration. It fails closed for deleted files and test/configuration infrastructure; follow its instruction to run `npm run test` in those cases.
- When the user says `safely`, preserve unrelated staged, unstaged, and untracked work; stop only clearly repo-owned transient processes; and verify the result instead of doing broad cleanup.
- For Ward Flow clinical, privacy, security or environment changes, select the applicable checks under [How we work](../ward-flow/HOW-WE-WORK.md) and [public CI policy](../ward-flow/PUBLIC-CI.md). The copied PsychSift production-readiness and Supabase commands do not apply here. Provider access needs the authority required by [AGENTS.md](../../AGENTS.md).
- For handoff, archive-safety, or upload-style requests, inspect branch/upstream/status and select the appropriate verification. Commit coherent task-owned changes under AGENTS.md's local-commit rules; publication still requires separate authority.
- Before editing, use Ward Flow's exact-file sign-out check and shared ownership log as required by AGENTS.md. Preserve other sessions' work and inspect scripts before using any inherited reconciliation procedure.
- For codebase appraisal exports, stage outside the repo, include `EXPORT_MANIFEST.md`, exclude secrets/dependencies/build outputs/local state, and verify the archive can be opened before handoff.
- When a repeated repo-specific workflow is discovered, update this file or ask the user whether it should be remembered.

<!-- END:codex-productivity-defaults -->
