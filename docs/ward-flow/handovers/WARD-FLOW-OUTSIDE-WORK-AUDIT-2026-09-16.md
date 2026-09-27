# Ward Flow — what exists outside ward-lead, and what is worth keeping

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

> ⚠️ **SUPERSEDED the same day. Read [`WARD-LEAD-START-HERE-2026-09-16.md`](WARD-LEAD-START-HERE-2026-09-16.md) instead.** This was accurate when written, but the folder changed within the hour: engine work described here as missing has since landed, and fourteen approved drawings were replaced in committed history. Kept as a record only — do not act on it.

**2026-09-16. Written for the owner, who is consolidating everything into the `ward-lead`
folder and discarding the other working folders.**

## The answer in one paragraph

Roughly thirty branches carry Ward Flow names and are not merged into the ward line. Their
contents were compared, file by file, against what is actually on disk in `ward-lead`. **Three
items exist anywhere else that `ward-lead` does not already have. Two are worth taking; the
third should be dropped.** Everything else is either already here in a later form, or was never
Ward Flow work despite its name.

---

## 1. What to take — two items

### 1.1 A test that describes the wrong thing

`tests/ui-ward-roles.spec.ts`, line 643. The test is named:

> "shows rph-ed and peel-ed each their own **queued-for-review** psychiatry referral, and never
> the other's"

The referral it uses at Peel (RF-013) is not queued. Its recorded state is `accepted` — an
emergency department that has already answered. The name says the opposite of what the fixture
holds, so anybody reading it learns something untrue about how referrals behave.

The correction, on `ward/task-patient-link-guard-20260911`, renames it to "arrived
psychiatric-review referral" and adds a comment separating the genuinely queued referral
(RF-009, at Royal Perth) from this answered one. No assertion and no fixture changes.

**Recommendation: take it.** It costs nothing and it stops a test lying about clinical flow.
**Verified directly:** the stale name is on disk at line 643, the corrected name is on the
branch at line 642, and RF-013's state is `accepted` in `ward-movements.ts`.

### 1.2 A browser test whose clock drifts

`tests/ui-ward-roles.spec.ts`, line 131. The test freezes the clock to a fixed moment, but never
pauses it — so real time keeps running between setup and the assertion. A countdown measured
that way can read differently depending on how busy the machine is, which is how an intermittent
failure gets born.

The fix is one line: pause the clock at the same instant it is installed.

**Recommendation: take it.** **Verified directly:** the disk copy installs the clock without
pausing; the branch copy pauses on the next line.

Note both fixes land in the **same file**, so they should be applied together in one edit.

---

## 2. What to drop — one item that looks useful and is not

### A file-locking fix for machinery you have decided to delete

`scripts/ward-flow/chat-control.mjs` currently claims its lock by creating a file that fails if
one already exists. A version on another branch replaces this with a safer method that behaves
correctly on more kinds of drive. The difference is real — **verified directly**: the disk copy
uses the old method at line 372; the branch uses the safer one at line 376.

**Recommendation: drop it, despite being a genuine improvement.** This file is the chat-control
system, and **WLQ-33 settled that the chat-control machinery is removed once the fixes are
folded.** Taking this would harden a component that is scheduled for deletion, and would make
that deletion marginally harder to do.

If the removal is ever reversed, this fix is worth revisiting. It is recorded here so it can be
found again.

---

## 3. What was also rejected

- **A stale edit to the 5 September handover.** That document has been superseded seven times
  since. The edit also asserts that a particular CI gate was removed — which `ward-lead`'s own,
  more recent and more carefully measured note says is not true here.
- **A duplicate safety test.** One branch adds an 83-line test proving the coordinator's
  bed-pull check enforces the cohort rule. `ward-lead` already proves the same thing in
  `tests/ward-pull-judgement-gate.test.ts`, with a positive control and protection against
  false passes. The duplicate adds no coverage.
- **A typeface study of the Command drawing.** Its proposal was adopted directly into the real
  drawing, which already uses that typeface throughout. The standalone study was never needed.
- **A mutation-testing script** (`reword-arm.mjs`). Its safety contract is implemented more
  robustly by `mutation-run.mjs` and `mutate.mjs`, both already here, and the audit it was built
  for is recorded as complete.

---

## 4. Where nothing was found, so nobody repeats this

| Checked                                                                                                                                                                                                                   | Result                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The three publication branches (3, 4 and 6 September)                                                                                                                                                                     | Snapshots of the ward line exported for pull requests. Not one of their ~1,200 files is absent from disk. Their genuine bug fixes were each checked by name and are all here in later form.                                                             |
| `verify_ward_flow_isolation`, `audit_ward_flow_logic`, `backup/verify_ward_flow_isolation_stale`, `explore_ward_flow_project`                                                                                             | **None touches any ward file at all.** Two of those names point at the same commit. Their real content — removing the Caring Contacts card and a Developer settings section — was superseded by a different decision to keep both behind a safety gate. |
| `codex/ward-flow-canonical-reference-data` (261 files)                                                                                                                                                                    | Not Ward Flow work. A snapshot of the main project's history: search, source governance, caring contacts. Contains no ward or hospital reference data of any kind.                                                                                      |
| Fifteen small branches (phase 5, form selection, design, referral corrections, verifier audit, phone test, untangle, consolidate, reword arms, command mockups, ledger separation, and the three September task branches) | Fourteen fully superseded — their work is here and has been extended past what they built. One yielded item 1.1 above.                                                                                                                                  |

---

## 5. Three things this audit established that are worth remembering

**A ward-sounding branch name is no evidence of ward content.** Four branches carrying "ward
flow" in their names contain zero ward files between them. This was wrong three separate times
in one audit, always in the same direction — the name promised more than the branch held.

**"Not merged" is not "not folded".** Git lists about thirty ward branches as unmerged. Almost
all of their work reached the ward line by another route and only the branch label was left
behind. Counting branches, or counting differing files, measures how stale a branch is — not
whether anything was lost. Only comparing file contents against the disk answers that.

**The branch sprawl has a cause, and it is mechanical.** The ward line carries a 118 MB file in
its history, and GitHub refuses anything over 100 MB. Nothing reachable from that history can
ever be pushed. That is why sessions repeatedly built fresh "publication" branches — the code
without the history — instead of pushing the line itself.

---

## 6. How this was checked, and what that is worth

Four agents compared every branch's files against the files on disk in `ward-lead`, by content
hash rather than by branch name or commit count. That comparison is mechanical and reliable.

**The three concrete findings were then opened and checked by hand** before being written here —
the stale test name, the missing clock pause, and the locking method — because a report saying
"this fix is missing" is cheap to assert and easy to get wrong. All three held up. The
surrounding characterisations of what each branch _was_ come from the agents' reading and were
not independently re-derived.

**No test or gate was run.** Nothing was folded, merged, deleted or modified. Every step of this
audit was read-only.

---

## 7. What is left to do

1. Apply the two fixes in section 1 — both in `tests/ui-ward-roles.spec.ts`, one edit.
2. Then the other folders hold nothing you need, and can be discarded whenever you choose.

The one exception is the September 14–16 work on `ward/lead-fixes-20260914`, which is a genuine
body of work and is covered separately in
[`WARD-FLOW-HANDOVER-2026-09-16.md`](WARD-FLOW-HANDOVER-2026-09-16.md). This document is only
about everything _else_.
