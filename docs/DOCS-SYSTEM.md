# Documentation system

How Documentation keeps PsychSift + Ward Flow docs accurate on this tip. **Process doc - no product DDL.**

_Owned by Documentation. Updated 2026-09-21._

## Principles

1. **One live source per topic** - archive or stub duplicates.
2. **Stamp what you touch** - `_Updated YYYY-MM-DD - <why>; Documentation owns._`
3. **Names only for secrets** - never paste values, JWTs, or dashboard passwords.
4. **Status in one board** - for Ward Flow: `docs/ward-flow/STATUS.md` + `docs/ward-flow-task-ledger.md`; do not fork status elsewhere.
5. **One map improvement per pass** when cheap.
6. **Ward Flow tip lock** - only `D:\Worktrees\Database\ward-lead`. Confirm tip (`git log -1` / `rev-parse`) before acting. No stale worktrees, detached inventory/suite checkouts, older SHAs, or cloud agents unless Joshua explicitly names another path.
7. **Recheck triggers** - tip SHA / boot command / entry path change refreshes entry docs; operator change restamps runbooks; deferred item moves update closeout/STATUS.

## Pipeline

Scope -> Read tip -> Edit (class-aware) -> Stamp + commit (docs only) -> Memory/FYI -> One map improvement

Ward Flow commits stay **local** (never push the ward line). Stage **docs paths only** - never mix unrelated product WIP.

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

## PsychSift (same monorepo, GitHub main)

Product name **PsychSift**; repo `BigSimmo/Database`. Prefer GitHub default branch for PsychSift product docs; use this tip for Ward Flow.

## Related

- Agent skills: **Documentation Operating System**, **Docs Freshness Audit**.
- Weekday freshness sweep routine (Documentation bot).
