# Documentation system

How Documentation keeps Ward Flow docs accurate on this tip. **Process doc - no product DDL.**

_Updated 2026-09-28 - dedicated Ward Flow repository boundary; Documentation owns._

## Principles

1. **One live source per topic** - archive or stub duplicates.
2. **Stamp what you touch** - `_Updated YYYY-MM-DD - <why>; Documentation owns._`
3. **Names only for secrets** - never paste values, JWTs, or dashboard passwords.
4. **One task identity** - follow `docs/task-receipts.md` and reuse existing ledger/checkpoint IDs. `docs/ward-flow/STATUS.md` preserves dated history; current task state needs current source and acceptance evidence. Do not create another status store.
5. **One map improvement per pass** when cheap.
6. **Ward Flow repository lock** - confirm `git remote get-url origin` is `https://github.com/BigSimmo/Ward-Flow.git` before editing. Use a separate worktree based on this repository's `main`; confirm the branch and tip before acting. `D:\Worktrees\Database\ward-lead` and `BigSimmo/Database` are legacy sources, not Ward Flow destinations.
7. **Recheck triggers** - relevant source, boot command or entry path changes refresh affected maintained guidance; operator changes restamp runbooks. Update the existing task receipt at meaningful lifecycle events; preserve dated status evidence.

## Pipeline

Scope -> Verify repository and branch -> Read tip -> Edit (class-aware) -> Stamp + commit (docs only) -> One map improvement

Stage **docs paths only** - never mix unrelated product WIP. A push or pull request requires the user's authorisation and a verified `BigSimmo/Ward-Flow` destination.

## Ward Flow live set

| Doc                                                            | Role                                |
| -------------------------------------------------------------- | ----------------------------------- |
| [`ward-flow/README.md`](ward-flow/README.md)                   | Only product entry                  |
| [`ward-flow/LOCAL-FIRST-RUN.md`](ward-flow/LOCAL-FIRST-RUN.md) | UI boot                             |
| [`ward-flow/ARCHIVE-NOTE.md`](ward-flow/ARCHIVE-NOTE.md)       | Live vs archive map                 |
| [`task-receipts.md`](task-receipts.md)                         | Current task/evidence handoff       |
| [`ward-flow/STATUS.md`](ward-flow/STATUS.md)                   | Historical status and owner context |
| [`ward-flow/HOW-WE-WORK.md`](ward-flow/HOW-WE-WORK.md)         | Builder workflow                    |
| [`ward-flow-task-ledger.md`](ward-flow-task-ledger.md)         | Task ledger                         |

**Doc check:** `npm run ward:check-docs` (= `check:ward-doc-links`).

**Boot:** `npm run ensure` - trust the printed URL; never hardcode ports.

## Repository boundary

Ward Flow is in `BigSimmo/Ward-Flow`. `BigSimmo/Database` is the separate PsychSift repository. Historical documents may mention the former shared checkout; treat those paths as history and use the verified Ward Flow checkout for current work.

## Related

- Agent skills: **Documentation Operating System**, **Docs Freshness Audit**.
- Weekday freshness sweep routine (Documentation bot).
