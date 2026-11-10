# Ward Flow — definition of done

_Updated 2026-11-10 - read-only tasks need no commit (D-121); Documentation owns._

A task is done only when every box below is ticked. If one cannot be ticked, the task is not done:
say which box and why in the thread and the PR body. The **Now** section of [STATUS.md](STATUS.md)
is current; keep it in step when your work changes where things stand. Screens have an extra
checklist on top of this one: [`SCREEN-DEFINITION-OF-DONE.md`](SCREEN-DEFINITION-OF-DONE.md).

## The checklist

- [ ] **The checks pass.** Before a push, run `npm run verify:pr-local` once and leave the suites hosted CI
      selects for the change to hosted CI (a docs-only change may run none of them), as [checks-and-evidence.md](../agents/checks-and-evidence.md) sets out.
      Never skip, disable or loosen a test to make it pass. Report any failure honestly, with the
      one line that shows it, and name the gates left to CI as not run.
- [ ] **It is committed.** Small commits on your own branch in your own worktree. Nothing finished
      is left uncommitted. Publication is a separately authorised stage. A read-only task (a
      review, audit, question or plan that changes no file) ticks this box with no commit: its
      report is the record.
- [ ] **The record is written.** Commits and the PR body say what changed, which checks ran and
      their results. Only results actually observed go in; anything not run is written as "not run".
      [Task receipts](../task-receipts.md) are optional.
- [ ] **Rulings are in the decision log.** If Josh settled a question, add a new D entry to
      [`decisions.md`](decisions.md) in the same PR, quoting his words. Do not start new owner files.
      Never manufacture clinical approval. When Josh answers a decision card or rules in chat, the
      thread that asked writes the entry the same day, in its open PR, even if the build comes later
      (D-107). Memory notes point to the D-number; they are never the only record.
- [ ] **Staff are told about changes they will see.** If the change alters what staff see or do,
      add one file to `src/components/ward-management/help/whats-new/`, as
      [git-publication.md](../agents/git-publication.md#normal-pushes-and-prs) describes. If it
      changes a step on screen, update the matching [desk guide](desk-guides/README.md) too.

## Integration is a separate stage

Follow the dedicated repository's [boundary](../../AGENTS.md) and
[HOW-WE-WORK](HOW-WE-WORK.md). Preserve exact-file ownership, reviewed diffs and
required checks. Hand off the committed branch and evidence; integration,
publication and deployment retain their applicable authority.
