# Ward Flow Git and publication workflow

Read this reference before committing, publishing, reviewing or observing CI. [AGENTS.md](../../AGENTS.md) governs safeguards. Use only the applicable section; provider and ownership boundaries remain binding.

## Commit as you go

- When local commits are within the task's authority, commit each coherent owned unit as it becomes ready: a module and its test, a fix and its proof, a document. Do not wait for the whole task.
- Preserve owned work at every real boundary: coherent completion, a pause or transfer, task end, a checkout or branch change, or a risky restoration. If you cannot commit, name the uncommitted paths and the blocker in the checkpoint. Ordinary conversation is not a boundary.
- Formatting belongs in the same unit. Do not make a separate commit only because a formatter ran.
- A blocked gate stays blocked. Report the exact blocker, the unrun or failed evidence and the next safe step. Never bypass an ownership guard or call unverified work passing.
- Unrelated dirty files do not freeze your commit. Never stage, move, discard or overwrite a peer's changes to clear a hook. Coordinate a release or an approved takeover instead.
- The pre-commit hook checks a snapshot of the staged index. Generated-doc checks run in check mode and never stage files. Report their advisory or strict result accurately.
- Commit before mutation testing. `git checkout --` discards uncommitted fixes in a tracked file and does nothing to an untracked one.

## Bare PR publication is not readiness work

When the user says `open PR`, `create PR` or `publish PR` without also asking for review, validation, readiness or CI observation, publish the prepared change promptly. GitHub is the requested verification surface.

- Inspect only what stops the wrong change being published: branch, base, staged and unstaged scope, and the PR title and body. Reuse the existing task branch or worktree. Do not fetch, pull, rebase, review the ledger, load a release or handover skill or create a worktree unless that keeps unrelated work out.
- Do **not** run or wait for `npm run format`, dependency installs, `npm run verify:pr-local`, tests, lint, typecheck, builds, browser checks, audits, generated-doc syncs or CI.
- For this explicit route only, use `SKIP_PRECOMMIT_READINESS=1 git commit ...` to omit commit readiness checks. The hook independently runs `scripts/pre-commit-checks.mjs --admission-only` against the staged index first: secret/patient scanning and ownership admission must pass, including deletions and merge commits. An absent checker, unavailable log, unsigned file or ownership conflict blocks publication. `SKIP_SIGNOUT_GUARD=1` is rejected in this mode. Never use `git commit --no-verify` or disable hooks to publish.
- If a readiness-only push guard (format or static) is the only blocker, use that guard's own scoped override (`SKIP_FORMAT_GUARD=1` or `SKIP_STATIC_GUARD=1`). Never skip the push hook wholesale — the auto-merge ownership guard has no override and must never be bypassed, even for a bare-publication request. This exception is limited to the explicit bare-publication request and does not weaken normal-push safeguards.
- Create the PR straight after the push. PsychSift's PR template does not apply. Report the URL, executed admission evidence and which local/hosted readiness checks remain unrun by request; admission is not a readiness verdict. Do not babysit CI, amend or do follow-up readiness work unless asked. This route overrides generic branch-bundling, handover, review, and babysit instructions.

## Normal pushes and PRs

- **For normal engineering pushes, run `npm run format -- --files <exact-owned-paths>` on every owned file you will push, including docs and config, and commit the result before pushing.** This rule does not apply to the explicit bare PR publication route above. Formatting after the commit does nothing for the push. Never format or stage another owner's files. `npm run format:all` is a separate whole-tree write that needs explicit scope.
- For normal Ward Flow readiness pushes, never an explicit bare PR publication, assemble the commits, check the remote, branch, CI triggers and deployment effects, run the selected gate for the actual changed files, then verify the exact pushed commit.
- `.githooks/pre-push` holds the local push guard. Before relying on it, check that `core.hooksPath` is `.githooks` and that the guard checks the real remote URL. A missing or bypassed hook grants no permission to push anywhere else.
- The in-flight CI push check in `scripts/guard-push.mjs` is a blocking check, not an advisory one. Run directly, it refuses a push while a required run is active on the branch (bypass one push with `SKIP_IN_FLIGHT_CI_GUARD=1`). The installed `.githooks/pre-push` runs the check by default and never exports that bypass itself; set `SKIP_IN_FLIGHT_CI_GUARD=1` explicitly to opt out for one push.
- Leave unrelated open PRs alone. Before calling a GitHub `DIRTY` or `CONFLICTING` branch a real conflict, run `git merge-tree --write-tree origin/main <tip>`. A clean tree means the branch is only behind.
- Each push to a PR cancels its running CI and starts a new run, and one run fills most of the account's 20 runners, so other PRs wait. Gather a round of fixes (a review round or a CI failure) into one push, not one push per finding. Merge `origin/main` into a PR branch only for a real conflict or a failing check whose fix is on main, or when the owner asks for the branch sync below. Being behind main is not a reason on its own.
- Background PR sweeps, the branch-sync scripts and the inherited `Run PR` and babysit shortcuts are retired. Sync a PR branch with `main` only when the owner asks, one branch at a time, with a normal merge.
- If asked to watch CI, check at most every 5 minutes for at most 30 minutes, then report where it stands. Never leave a scheduled job watching a PR. Treat merge-queue state as read-only.
- Bundle changes into one PR only after checking the branch, owner and authorised scope. Never weaken, skip or relax a required check to save time.

## Reviews

- Review only when asked (review, audit, bug hunt, readiness, PR or CI repair) or when the change touches a high-risk area. Name the exact branch or head reviewed and keep repairs scoped.
- Report findings by severity with file and line evidence. Separate reproduced defects from unverified concerns, preferences and history. Keep clinical and privacy consequences explicit. Say what was not run.
- Reply to or resolve a GitHub review thread only when the user authorised that for that PR. Reply first, then resolve, and only threads you fixed or fully dispositioned. Leave design, product-sensitive or ambiguous threads open with the reason. No marker resolves a thread automatically here.
