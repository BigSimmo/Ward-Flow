# Ward Flow plans

_Updated 2026-11-09 - active plans only; finished and September plans moved to history (D-107); Documentation owns._

Start at the [Ward Flow entry point](../README.md). Open work is in the [backlog](../backlog.md) and
the plan is the [roadmap](../roadmap.md). Plan checkboxes do not establish a current backlog.

## Active

| Plan                                                                       | Status                                                                                        |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Tier 1–4 improvements](2026-11-04-tier-improvements.md)                   | Approved implementation index; [evidence record](../evidence/2026-11-04-tier-improvements.md) |
| [Tier improvements: operational acceptance](2026-11-04-tier-operations.md) | Draft for Josh's review; owner acceptance checklist still open                                |

## Finished and older plans

Moved to [`docs/history/`](../../history/README.md) on 9 November 2026. Nothing was deleted.

- September 2026 build, fix and lane plans: [`history/plans-2026-09/`](../../history/plans-2026-09/).
- Documentation repairs (PR #526, merged) and the Handover redesign build (PR #1232, merged):
  [`history/plans-2026/`](../../history/plans-2026/).
- Agent-authored plans and specs of August to October 2026: [`history/superpowers/`](../../history/superpowers/).

Tests and code comments still name some of these plans by their old path. Read them at the new path,
or with `git show 6b1352c9:<old path>`.

## Adding a plan

Put a new Ward Flow plan in this folder, add a row under **Active** with its status, and link it from
the backlog item it delivers. When it is finished, move it to `docs/history/plans-2026/` and remove the
row. Follow the [document rules](../../DOCS-SYSTEM.md).
