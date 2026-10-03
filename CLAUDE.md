@AGENTS.md

# Ward Flow — orientation for AI assistants

This is the **Ward Flow** repository, `BigSimmo/Ward-Flow`: a synthetic-data prototype for
coordinating psychiatric ward beds, referrals, movements, transport, delays and capacity. It is
not validated clinical decision support. Do not enter real patient data or present invented
figures as live clinical records.

## Start here

1. Read [`AGENTS.md`](AGENTS.md) for the current repository and safety rules.
2. Read [`docs/ward-flow/README.md`](docs/ward-flow/README.md) for the product, accepted design, working behaviour and verification routes.
3. Read [`docs/ward-flow/HOW-WE-WORK.md`](docs/ward-flow/HOW-WE-WORK.md) for the current builder workflow, then the task's relevant source and tests.

Before any Git write, verify `git remote get-url origin` is
`https://github.com/BigSimmo/Ward-Flow.git`, check the branch and status, and use a separate
worktree based on this repository's `main`. The old `D:/Worktrees/Database/ward-lead` checkout
and `BigSimmo/Database` remote are historical PsychSift-era sources, not Ward Flow destinations.
A local commit, push, pull request, merge, migration and deployment are separate actions with
their own applicable authority and checks.

## Useful maps

| Need                                            | Read                                                                                                                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product entry, design and behavioural authority | [`docs/ward-flow/README.md`](docs/ward-flow/README.md)                                                                                                                                                                           |
| Current process and exact-file ownership        | [`docs/ward-flow/HOW-WE-WORK.md`](docs/ward-flow/HOW-WE-WORK.md) and `D:/Repos/ward-flow-logs/sign-out.md`                                                                                                                       |
| Code and test ownership                         | [`docs/ward-flow/code-map/README.md`](docs/ward-flow/code-map/README.md)                                                                                                                                                         |
| Task scope, evidence and decisions              | [`docs/task-receipts.md`](docs/task-receipts.md) and [`docs/ward-flow/decisions.md`](docs/ward-flow/decisions.md); [`STATUS.md`](docs/ward-flow/STATUS.md) opens with the current summary; its lower part is historical evidence |
| Ward Flow tasks                                 | [`docs/ward-flow-task-ledger.md`](docs/ward-flow-task-ledger.md)                                                                                                                                                                 |

The app and tests remain the evidence for behaviour. Use focused checks while editing, then the
checks selected for the exact integration candidate. A passing local check does not prove a
hosted service, database connection or deployment. Keep the synthetic-data and provider-confirmation
boundaries in `AGENTS.md`.

Older PsychSift, Supabase, Railway, RAG and local-only Ward Flow orientation formerly in this file is preserved in Git history. Do not use it as current project guidance.
