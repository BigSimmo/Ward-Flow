---
name: ledger-reconcile-mechanics
description: How to drain the outstanding-issues inbox — one branch may reconcile OR queue new requests, never both, and cancellation reasons are often wrong
metadata:
  type: project
---

Draining the `docs/outstanding-issues-inbox/` backlog into `docs/outstanding-issues.md`
has two traps that cost a full rebuild on 2026-09-02 (PR #2518, 93 requests, oldest filed
2026-08-24 — the ledger had misreported reality for over a week).

**1. A branch cannot both create a request and reconcile it.**
`check:ledger-write-discipline` compares the whole branch diff against the base and rejects
any file appearing in `applied/` that did not move from a pending request _present at the
base_. So the order is fixed: reconcile the base's pending set in commit one, then queue new
requests in commit two, where they stay pending for the next serial branch. Doing it the
other way round fails the gate with one error per new request and forces starting over from
the base.

Other mechanics that bite in order: requests must be **committed** before `issues:reconcile`
will run; the reconciler refuses a HEAD that does not include the current `origin/main`, so
re-fetch and re-base if anything merges mid-run; and `test:focused` **refuses** a list of
test-file paths (call `npx vitest run <files>` instead).

**2. A cancellation's stated reason is not evidence.** In that batch, five of seven `done`
requests were cancelled with the identical wording _"target issue is no longer in Open items
on current main"_ while the rows were plainly still open. Two were correct closes that got
thrown away; three reached the right outcome for the wrong reason. Check the code, not either
claim — see [[ledger-rows-lag-reality]] and [[assert-only-about-code-you-opened]].

**Cost note:** `data/outstanding-issues-snapshot.json` is generated and committed, and it sets
`source_changed`/`ui_changed`/`build_changed`/`coverage_changed` in `ci-change-scope.mjs`. So a
pure-docs ledger PR still pulls full heavy CI, and two concurrent ledger PRs always conflict on
it. That was ledger row `#Y090R5` (resolved 2026-09-02 with scope differentiation).

## The raw script writes the canonical table; only the npm wrapper queues a request

⚠️ **Measured 2026-09-20.** `node scripts/outstanding-issues.mjs update '#X' --detail "..."` edits
`docs/outstanding-issues.md` **directly** and reports "docs/outstanding-issues.md updated", which
reads like success. That is exactly the direct table-row edit AGENTS.md forbids for a normal PR, and
`check:ledger-write-discipline` rejects it.

✅ **Use `npm run issues:add|update|done|queue`** — those map to `scripts/ledger-inbox.mjs`, which
writes one immutable request under `docs/outstanding-issues-inbox/` and says "Queued … request at …
It is merge-safe". Two different scripts, near-identical argument shapes, opposite write discipline.

Also: `check:ledger-write-discipline` compares two committed refs, so it **passes vacuously on an
uncommitted change** and tells you so — `git add` the request and commit before believing it.
