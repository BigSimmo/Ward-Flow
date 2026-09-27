---
name: a-deferral-whose-reason-expires
description: A deferral conditioned on a transient state has nobody to un-defer it; the condition ends silently and the work is invisible from that moment
metadata:
  node_type: memory
  type: feedback
  originSessionId: 78a1f8ba-8ebd-47af-9e6c-674b54499d41
  modified: 2026-09-05T22:59:48.074Z
---

Ward Flow, 2026-09-06. `tests/ward-movement-step-back-reducer.test.ts` recorded, honestly and in
full: the DOM half of Task 5 was _"deferred by Ward Lead's explicit ruling (another session is
reading `ward-management-console.tsx` for review right now)"_.

**That session finished within the hour. Nothing else referred to the deferral.** So from the moment
the reason expired, two coordinator actions existed in the reducer — `STEP_BACK_STAGE` and
`WITHDRAW_ACCEPTANCE` — complete, tested across six files, documented, and dispatchable from no
screen in the application. **A coordinator could not undo a ward's acceptance, so a bed stayed held
against a decision reversed in reality.**

The owner had already ruled on exactly this shape (R-B-08): _"Half-built, 'override is possible but
always recorded' had become 'override is impossible', which is a different clinical policy."_

**Why:** a deferral note records the DECISION and the REASON. When the reason is a fact about the
world right now — somebody is holding a file, a gate is red, a branch is unfolded — the note stops
being true without anything changing in the repository. **Nobody re-reads a deferral to check
whether its reason still holds; they read it to find out why the thing is not built, accept the
answer, and move on.** A deferral whose reason has expired reads exactly like one whose reason
stands.

**How to apply:**

1. **When deferring on a transient condition, name what ends it and where that will be noticed.**
   "Deferred until X finishes" belongs in the queue X's completion touches, not only beside the code.
2. **Prefer a deferral that a mechanism can see.** A register entry in a test — a name in an
   allowlist that a guard walks — goes red when the condition changes; a sentence in a docblock
   cannot. The guard here is `tests/ward-event-reachability.test.ts`, whose register is exact in both
   directions: an unreachable event with no entry fails, and an entry for an event that HAS a screen
   fails too, so building the control forces the record out.
3. **When sweeping deferrals, sort them by whether the stated reason is a DECISION or a STATE.**
   The decision-shaped ones ("the owner has not ruled") are stable. The state-shaped ones are where
   the rot is, and they are the minority, so the sweep is cheap.

⚠️ **The tell in prose is a present-tense clause about another agent, a branch, or a gate** — "right
now", "while", "until X reports", "another session is". Related:
[[fields-with-no-producer]], [[prove-the-task-is-still-outstanding]], [[observations-expire]],
[[ledger-rows-lag-reality]], [[a-working-safeguard-leaves-no-trace]].

## 2026-09-11 — the deferral's SUBJECT expired, and a parked note read as an empty one

A Playwright test was parked, skipped, never run, asking whether ward `forced-colors` blocks do
anything. I diagnosed its failing control as "pointed at the wrong element" and said it _"could not
have produced a reading under any palette in any browser."_

🔴 **False. Its target was correct the day it was written.** `git log -L` on the one line:

    36d514022b  created     border: 1px solid var(--ward-border)   ← what the probe was written against
    0a1d718d9a  next day    border: 1px solid var(--border)        ← "panels take the system's border+shadow"

**A styling commit with nothing to do with forced colours silently retargeted it.** The test did not
get worse; **the code moved underneath it.** ⚠️ **A parked test has no failing run to notice the
drift, so the decay is invisible by construction** — the usual signal that a selector has gone stale
is a red, and a skipped test cannot produce one.

**So: when reviving any skipped test, `git log -L` the lines its selector depends on, BEFORE running
it.** The gap between "written" and "revived" is exactly the window in which nobody was watching.

### 🔴 And the worse half: I diagnosed it after reading ONE paragraph of a three-paragraph note

The head note already recorded a prior run with the exact colour, already reported that the same
manipulation **succeeds in the dev server and fails in the production build**, and already named
that as the real mystery. **I talked past all of it and spent two production builds re-deriving a
worse version.**

⚠️ **"Parked" reads as "nothing here yet", so the notes attached to parked work are the cheapest
evidence available and the easiest to skim.** Same trap as a stated cost, one layer in: _"too
expensive to iterate"_ stopped people looking at the code, and _"parked"_ stopped me reading the
note. **Read the whole of what the last person wrote before measuring anything — they were there
when it worked.**

Related: [[a-written-diagnosis-does-not-sweep]], [[read-what-the-guard-reports-not-its-source]],
[[a-control-must-test-the-premise-not-the-measurement]], [[observations-expire]].
