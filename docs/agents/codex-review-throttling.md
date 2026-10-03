# Codex Review Throttling & Thread Resolution

<!-- BEGIN:codex-review-throttling -->

## Codex review throttling and routing

Do not review branches opportunistically. Review the current changed diff, PR, or branch only when the user explicitly asks for review/audit/hunter/cleanup/upload work, when CI/check failures are the task, or when the current change touches high-risk areas that require a targeted review before handoff.

Use [current Ward Flow review handling](codex-github-review.md#current-contract-2-october-2026) and the repository boundary for repo-local reviews, audits, bug hunts, readiness checks and PR/CI reviews. The [inherited protocol](../codex-review-protocol.md) is historical background, not an active workflow.

Report concrete findings by severity with file/line evidence and the affected behaviour. Separate reproduced defects from unverified concerns, design preferences and historical findings. Keep clinical/privacy consequences explicit and select proportionate checks. State the exact reviewed scope/revision and unrun evidence; a review or local pass does not establish hosted readiness.

Before reviewing a branch or PR, review the changed scope directly. The ledger lookup that used
to skip unchanged, already-reviewed heads was retired on the Ward Flow line on 26 September 2026
at Josh's request; the PsychSift version remains on `origin/main`.

Before reviewing multiple branches:

- Build a short branch inventory first: branch, upstream, ahead/behind, last commit, and merged status.
- Skip branches already merged into `main`.
- Do not re-review every branch after ordinary coding tasks.
- If a repeated request targets unchanged reviewed branches, summarize the prior result and ask before doing another full pass.

Review routing:

- `diff-review`: Use for explicit review of the current diff, PR, or named branch. Findings first, ordered by severity, with file/line evidence.
- `bug-hunter`: Use only for the exact `bug-hunter` shortcut or an explicit defect-hunt request. Prioritize reproducible bugs and smallest proof.
- `repo-auditor`: Use for explicit repo-wide audit/refactor/dead-code/import/dependency-structure requests. Treat outputs as triage, not automatic delete lists.
- `release-readiness`: Use for explicit release, merge, PR readiness, or handoff confidence requests. Do not run provider-backed gates without confirmation.
- `branch-cleanup`: Use only when the prompt explicitly asks for branch cleanup/hygiene or branch deletion candidates. Apply `docs/branch-cleanup-guide.md` before inspecting branch diffs.
- `pr-ci-fix`: Use only for an explicitly authorised Ward PR/CI repair. Verify the exact repository and head; provider reads/writes, comments, reruns and publication need their applicable authority. Routine local scoped repairs follow the task authorisation. The inherited `Run PR` sweep is disabled in Ward and grants no authority.

Recording completed reviews in a shared ledger (with a throttle on repeat Run PR sweeps) was
retired on the Ward Flow line on 26 September 2026 at Josh's request; the PsychSift version
remains on `origin/main`.

<!-- END:codex-review-throttling -->

<!-- BEGIN:resolve-review-threads-after-fixing -->

## Resolve review threads after fixing them

Pushing a fix is not the end of the task when that fix was made in response to a GitHub PR
review comment. Resolving the corresponding review thread is part of the same unit of work,
not a follow-up to remember later — an addressed comment left unresolved still blocks merge
and still reads to reviewers, merge-queue tooling, and `pr-policy.mjs`-style gates as
unaddressed.

- After pushing a fix for a review comment, reply on that thread with a short summary of what
  changed (naming the fixing commit where useful), then resolve the thread once the fix is
  pushed — reply first, resolve second, both before moving to the next item.
- Only resolve a thread you actually fixed or fully dispositioned. Never resolve a thread you
  did not act on, never resolve one to tidy away feedback you disagree with, and never resolve
  a thread on a PR you are only watching on someone else's behalf — leave those for the PR's
  owner or reviewer.
- If the comment needs more than a direct fix (a design decision, missing context, reviewer
  input), reply explaining why instead of resolving, and leave the thread open.
- This does not grant new GitHub write access or user authorisation for separate provider
  writes. Reply and resolve only when the user explicitly authorised those actions for that PR
  (for example, a named Ward PR repair that explicitly includes replies or thread resolution)
  and the available tooling permits
  them. If the user's ask was scoped to only committing and pushing the fix, stop there and tell
  them the reply/resolve step is still open rather than performing it unasked.
- This applies to every separately authorised Ward review-thread reply/resolution. Handle threads
  manually through supported tools and verify the resulting thread state. No marker automatically
  resolves a thread; the inherited automated resolve workflow is absent. Do not start another review
  or broaden the repair scope without the applicable task authority.

<!-- END:resolve-review-threads-after-fixing -->
