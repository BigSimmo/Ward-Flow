---
name: ledger-rows-lag-reality
description: Open rows in docs/outstanding-issues.md are often already fixed; verify against origin/main before acting or reporting
metadata:
  node_type: memory
  type: project
  originSessionId: a0970f1f-6c3d-4920-b7f4-79c78f764edf
  modified: 2026-08-20T22:25:50.396Z
---

**An open row in the task ledger is not evidence the work is outstanding.** On 2026-08-21 I
checked twenty UI rows against `origin/main` by reading the code rather than the row prose:
**twelve were already fixed**, four were partly fixed, and only five were still true as written.

**Why:** the ledger is deliberately append-only per branch — ordinary PRs queue immutable request
files under `docs/outstanding-issues-inbox/`, and only a separate serialized reconcile branch
edits the canonical list. So the gap between "work landed" and "row closed" is however long it
takes someone to run a reconciliation. PRs #2115, #2157 and #2159 (18–19 Aug) closed most of that
batch silently. This compounds the known hazard that a row carries no structured status field, so
absence of an `IN PROGRESS` marker means nothing (ledger `#292`).

**How to apply:**

1. Before _acting on_ or _reporting_ a row, verify it against `origin/main` — `git grep -e <pattern>
origin/main -- <path>` and `git show origin/main:<file>` are enough, and are far cheaper than
   the work itself. `git log origin/main -L<a>,<b>:<file>` names the commit that fixed it.
2. Reading the row back on a plain `/issues` needs no such check; only acting does.
3. Expect the reconcile interlock to block you: `issues:reconcile` refuses while another branch
   carries unmerged applied records (that guard exists because two concurrent reconciliations
   corrupted the list). Queue the requests, let the other reconciliation PR land, then apply.
4. When closing on evidence, put the evidence _in_ the outcome — commit SHA, the grep that
   returned nothing, or the `N passed` line. See [[checks-that-cannot-fail]].

Related: [[prove-the-task-is-still-outstanding]], [[token-usage-hygiene]] — the ledger is ~500 lines with very long rows; slice the table
columns with `awk -F'|'` rather than reading the whole file.

## 2026-09-04 — the same error, but the stale list was a TEST CONSTANT

`COVERING_THE_GROUND` in `tests/ward-design-language-contract.test.ts` named twenty screens as
owing design-language work. I quoted it to three chats as _"measured on a49876051"_. I had not
measured it; I read the constant. The measured number was sixteen — four screens were already
freed, each carrying an explicit committed comment saying so.

⚠️ **A pinned list is a RECORD of what was true once, never a MEASUREMENT of what is true now**,
and a list living inside a test file reads more like a measurement than a ledger row does. The
assertion that would have told me had been failing since the day it was written; see
[[focused-runs-cannot-select-readfilesync-tests]] for why nobody saw it.
