# Movements redesign - status (1 Nov 2026, 08:36 UTC)

1. State: design locked by Josh 08:24; code is in draft PR #1222. Josh asked 08:33 to complete the build (tests, CI, auto-merge); test updates in progress.
2. PR #1222, branch claude/project-thread-t1u1sz, pushed commit 1dd89cb32 (main 6b68a8967 merged in). Full diff vs main: pr1222-branch-vs-main.patch.
3. Left: update tests pinning the old design (14 fail in tests/ward-movements-screen.dom.test.tsx so far; see PR body list), typecheck, phone script budget, mark ready, arm auto-merge.
4. Next step: run `npm run test:related`, rewrite failing assertions to the new wording (keep coverage), push, mark ready, arm auto-merge.
5. Mock-up: https://claude.ai/artifact/SGscDcq4LSpMyCmVrHsdey ; offline copy interactive-preview/ (open index.html#movements via a local web server); screenshots shots-v4/.

Paused by Josh 08:36 UTC. Nothing unpushed. Local related-tests run (08:36, on 1dd89cb32): 10 files fail, 35 tests: ward-movements-screen (14), ward-movements-service-scope (5), ward-movement-typed-legal-line (4), ward-urgent-flag (3), ward-movement-horizon-visual (2), ward-refinement-interactions (2), ward-movements-redesign (2), ward-movement-third-edition (1), ward-waiting-links (1), ward-shared-figures-home (1). Full output: related-tests-0836.txt.
Hosted CI on 1dd89cb32 (08:37-08:40 UTC) failed: prepared browser build, static checks, production build, backend and shared production proof. Not investigated (paused). First step on resume: read the static checks and production build logs (run 41289296320); likely a typecheck error in the new code.
Stopped watching PR #1222 at 08:42 UTC to save Josh's usage while paused (each CI failure was waking this thread). On resume, subscribe to PR activity again.
