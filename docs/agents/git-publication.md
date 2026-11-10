# Ward Flow Git and publication workflow

_Updated 2026-11-10 - Josh's PC host hooks, the missing-log wording and read-only tasks (D-121); Documentation owns._

Read this reference before committing, publishing, reviewing or observing CI. [AGENTS.md](../../AGENTS.md) governs safeguards. Use only the applicable section; provider and ownership boundaries remain binding.

## Commit as you go

- When local commits are within the task's authority, commit each coherent owned unit as it becomes ready: a module and its test, a fix and its proof, a document. Do not wait for the whole task.
- Preserve owned work at every real boundary: coherent completion, a pause or transfer, task end, a checkout or branch change, or a risky restoration. If you cannot commit, name the uncommitted paths and the blocker in the checkpoint. Ordinary conversation is not a boundary. A read-only task (a review, audit, question or plan that changes no file) needs no commit and no empty commit to be done; its report is the record.
- Formatting belongs in the same unit. Do not make a separate commit only because a formatter ran.
- A blocked gate stays blocked. Report the exact blocker, the unrun or failed evidence and the next safe step. Never bypass an ownership guard or call unverified work passing.
- Unrelated dirty files do not freeze your commit. Never stage, move, discard or overwrite a peer's changes to clear a hook. Coordinate a release or an approved takeover instead.
- The pre-commit hook checks a snapshot of the staged index. Generated-doc checks run in check mode and never stage files. Report their advisory or strict result accurately.
- Commit before mutation testing. `git checkout --` discards uncommitted fixes in a tracked file and does nothing to an untracked one.

## Bare PR publication is not readiness work

When the user says `open PR`, `create PR` or `publish PR` without also asking for review, validation, readiness or CI observation, publish the prepared change promptly. GitHub is the requested verification surface.

- Inspect only what stops the wrong change being published: branch, base, staged and unstaged scope, and the PR title and body. Reuse the existing task branch or worktree. Do not fetch, pull, rebase, review the ledger, load a release or handover skill or create a worktree unless that keeps unrelated work out.
- Do **not** run or wait for `npm run format`, dependency installs, `npm run verify:pr-local`, tests, lint, typecheck, builds, browser checks, audits, generated-doc syncs or CI.
- For this explicit route only, use `SKIP_PRECOMMIT_READINESS=1 git commit ...` to omit commit readiness checks. The hook independently runs `scripts/pre-commit-checks.mjs --admission-only` against the staged index first: secret/patient scanning and ownership admission must pass, including deletions and merge commits. An absent checker, an unreadable claims folder or a file another branch holds in the optional shared log blocks publication. A missing log does not block (claim files in a `claims/` folder beside it are still checked), and a file needs no sign-out line of its own (Q374). `SKIP_SIGNOUT_GUARD=1` is rejected in this mode. Never use `git commit --no-verify` or disable hooks to publish.
- If a readiness-only push guard (format or static) is the only blocker, use that guard's own scoped override (`SKIP_FORMAT_GUARD=1` or `SKIP_STATIC_GUARD=1`). Never skip the push hook wholesale — the auto-merge ownership guard has no override and must never be bypassed, even for a bare-publication request. This exception is limited to the explicit bare-publication request and does not weaken normal-push safeguards.
- Create the PR straight after the push. PsychSift's PR template does not apply. Report the URL, executed admission evidence and which local/hosted readiness checks remain unrun by request; admission is not a readiness verdict. Do not babysit CI, amend or do follow-up readiness work unless asked. This route overrides generic branch-bundling, handover, review, and babysit instructions.

## Normal pushes and PRs

- **For normal engineering pushes, run `npm run format -- --files <exact-owned-paths>` on every owned file you will push, including docs and config, and commit the result before pushing.** This rule does not apply to the explicit bare PR publication route above. Formatting after the commit does nothing for the push. Never format or stage another owner's files. `npm run format:all` is a separate whole-tree write that needs explicit scope.
- For normal Ward Flow readiness pushes, never an explicit bare PR publication, assemble the commits, check the remote, branch, CI triggers and deployment effects, run the selected gate for the actual changed files, then verify the exact pushed commit.
- `.githooks/pre-push` holds the local push guard. Before relying on it, check that `core.hooksPath` is `.githooks` and that the guard checks the real remote URL. A missing or bypassed hook grants no permission to push anywhere else.
- The in-flight CI push check in `scripts/guard-push.mjs` is a blocking check, not an advisory one. It blocks a push to an open PR branch while a required Ward Flow CI run is active, because the new push would cancel it. The installed `.githooks/pre-push` runs it by default. Opt out for one push with `SKIP_IN_FLIGHT_CI_GUARD=1`, or with `GUARD_PUSH_DISABLE=1`, which also skips the format and static checks but never destination identity or auto-merge ownership. Without `gh` installed the check is skipped (fail-open); if `gh` cannot read the CI state, the push is blocked.
- **Base every PR on `main`; never stack PRs (Q373, 3 Nov 2026).** When a lower PR in a stack merges, GitHub retargets or closes the PR above it and its auto-merge is dropped, which is how auto-merge was going missing. If one change needs another, wait for the first to merge, then branch from the new `main`.
- **Hold a PR with the `hold` label, not a written note (Q373).** Never write "auto-merge OFF" or similar in a PR body, handover or doc. To hold a PR, add the `hold` label and say why in one PR comment; leave auto-merge alone. The `Ward Flow hold` check (`.github/workflows/pr-hold.yml`) fails while the label is on, so a held PR cannot merge even with auto-merge armed once that check is required. Nobody arms auto-merge on a PR labelled `hold`, and only Josh (or the session he tells) removes it.
- Leave unrelated open PRs alone. Before calling a GitHub `DIRTY` or `CONFLICTING` branch a real conflict, run `git merge-tree --write-tree origin/main <tip>`. A clean tree means the branch is only behind.
- Each push to a PR cancels its running CI and starts a new run, and one run fills most of the account's 20 runners, so other PRs wait. Gather a round of fixes (a review round or a CI failure) into one push, not one push per finding. Merge `origin/main` into a PR branch only for a real conflict or a failing check whose fix is on main, or when the owner asks for the branch sync below. Being behind main is not a reason on its own. No merge queue is in use, so this normal merge is how a branch catches up.
- Background PR sweeps, the branch-sync scripts and the inherited `Run PR` and babysit shortcuts are retired. Sync a PR branch with `main` only when the owner asks, one branch at a time, with a normal merge.
- If asked to watch CI, check at most every 5 minutes for at most 30 minutes, then report where it stands. Never leave a scheduled job watching a PR.
- **A PR that changes something staff will see adds one small file to `src/components/ward-management/help/whats-new/`**, named `<YYYY-MM-DD-short-slug>.json` (the date of the change, then a few lower-case words) and holding `{ "line": "One plain sentence." }`: under 120 characters, no PR numbers or code words. Never edit another PR's file, so What's new cannot conflict. The build combines the files and shows the last 6 months of them (older files stay in the repository), the app's What's new note and Help list show the line after the next daily release, and the release workflow copies it into that release's notes. Engineering-only changes add nothing.
- Never weaken, skip or relax a required check to save time.

## Josh's PC host hooks

On Josh's own PC only, an extra host hook runs before agent commands, on top of this repository's
Git hooks (D-121 item 7). Its source is `ward-host-hooks.mjs` in Josh's `ai-rules` repository; read
that file for the exact current behaviour, as this summary can lag it.

- It blocks any Ward Flow `git push`, `gh pr create` or `gh pr merge` unless the command carries an
  explicit publication assertion and names the repository literally: `git -C <absolute path>` for a
  push, or `-R github.com/BigSimmo/Ward-Flow` for `gh`.
- It blocks every push to `main` and every force-push.
- It checks the branch history against a fixed anchor commit before a push.
- It does not run in cloud sessions. There, the repository's own hooks (`.githooks/pre-commit` and
  `.githooks/pre-push`) are the only local guards.

## Fewest PRs

Josh, 9 November 2026 ([D-107](../ward-flow/decisions.md#d-107-working-rules-and-documentation-from-the-9-november-2026-audit-9-november-2026)): keep the number of PRs as low as possible.

- **One PR per thread.** A thread opens one PR for its task and keeps adding to it.
- **Fold follow-ups in.** A fix, review round or small extra for the same task goes into the thread's open PR as new commits, not a new PR.
- **Combine related work.** When two pieces of work touch the same area or ship together, put them in one PR. Before adding work to a PR, check its branch, owner and authorised scope.
- **The one allowed split is a held clinical PR.** A change that needs Josh's clinical sign-off goes in its own PR with the `hold` label, so the rest can merge without waiting. No other reason splits a thread's work.

## Integration thread and the five-PR cap

- **No merge queue is in use.** PRs merge straight into `main` once the required checks pass. The `merge_group` triggers in the workflows are dormant. If Josh turns a merge queue on later, this section and AGENTS.md hard rule 6 change first.
- **The integration thread** is the one thread Josh names to own PR integration. Its authority is the exception already in [AGENTS.md](../../AGENTS.md) hard rule 6 (not D-107, which only adds the fewest-PRs rule above). It may arm, re-arm and merge any owner's PR, set the merge order and fix merge conflicts on any PR branch. It keeps every other limit in AGENTS.md hard rule 6: required checks, no `hold` PRs, no force-push or history rewrite while armed.
- **Five open PRs at most.** The integration thread holds the number of open PRs at five or fewer by merging ready ones first. Other threads help by keeping to one PR each.

## Reviews

- Review only when asked (review, audit, bug hunt, readiness, PR or CI repair) or when the change touches a high-risk area. Name the exact branch or head reviewed and keep repairs scoped.
- Report findings by severity with file and line evidence. Separate reproduced defects from unverified concerns, preferences and history. Keep clinical and privacy consequences explicit. Say what was not run.
- Reply to or resolve a GitHub review thread only when the user authorised that for that PR. Reply first, then resolve, and only threads you fixed or fully dispositioned. Leave design, product-sensitive or ambiguous threads open with the reason. No marker resolves a thread automatically here.
