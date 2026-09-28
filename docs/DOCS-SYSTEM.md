# Documentation system

How Documentation keeps Ward Flow docs accurate on this tip. **Process doc - no product DDL.**

_Updated 2026-09-28 - dedicated Ward Flow repository boundary; Documentation owns._

## Principles

1. **One live source per topic** - archive or stub duplicates.
2. **Stamp what you touch** - `_Updated YYYY-MM-DD - <why>; Documentation owns._`
3. **Names only for secrets** - never paste values, JWTs, or dashboard passwords.
4. **Status in one board** - for Ward Flow: `docs/ward-flow/STATUS.md` + `docs/ward-flow-task-ledger.md`; do not fork status elsewhere.
5. **One map improvement per pass** when cheap.
6. **Ward Flow repository lock** - confirm `git remote get-url origin` is `https://github.com/BigSimmo/Ward-Flow.git` before editing. Use a separate worktree based on this repository's `main`; confirm the branch and tip before acting. `D:\Worktrees\Database\ward-lead` and `BigSimmo/Database` are legacy sources, not Ward Flow destinations.
7. **Recheck triggers** - tip SHA / boot command / entry path change refreshes entry docs; operator change restamps runbooks; deferred item moves update closeout/STATUS.

## Pipeline

Scope -> Verify repository and branch -> Read tip -> Edit (class-aware) -> Stamp + commit (docs only) -> One map improvement

Stage **docs paths only** - never mix unrelated product WIP. A push or pull request requires the user's authorisation and a verified `BigSimmo/Ward-Flow` destination.

## Ward Flow live set

| Doc                                                            | Role                |
| -------------------------------------------------------------- | ------------------- |
| [`ward-flow/README.md`](ward-flow/README.md)                   | Only product entry  |
| [`ward-flow/LOCAL-FIRST-RUN.md`](ward-flow/LOCAL-FIRST-RUN.md) | UI boot             |
| [`ward-flow/ARCHIVE-NOTE.md`](ward-flow/ARCHIVE-NOTE.md)       | Live vs archive map |
| [`ward-flow/STATUS.md`](ward-flow/STATUS.md)                   | Status board        |
| [`ward-flow/HOW-WE-WORK.md`](ward-flow/HOW-WE-WORK.md)         | Builder workflow    |
| [`ward-flow-task-ledger.md`](ward-flow-task-ledger.md)         | Task ledger         |

**Doc check:** `npm run ward:check-docs` (= `check:ward-doc-links`).

**Boot:** `npm run ensure` - trust the printed URL; never hardcode ports.

## Repository boundary

Ward Flow is in `BigSimmo/Ward-Flow`. `BigSimmo/Database` is the separate PsychSift repository. Historical documents may mention the former shared checkout; treat those paths as history and use the verified Ward Flow checkout for current work.

## Related

- Agent skills: **Documentation Operating System**, **Docs Freshness Audit**.
- Weekday freshness sweep routine (Documentation bot).
