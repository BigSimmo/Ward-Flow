# Five more holes, three of which belong to the approach rather than to either implementation

**Ward Lead, 2026-09-10.** Ward Builder Four verified Ward Builder Two's repair **at the moment I had
just praised it** — the moment least likely to be checked and most likely to need it. Reproduced here
by lifting `statesItsOwnProvenance` verbatim from the folded helper and running the corpus.

    PASSES   "The bed counts were invented until recently."          retraction after the claim
    PASSES   "The bed occupancy is invented; the wait is eleven..."  figure-noun off the whitelist
    PASSES   "The names are invented: there were 28 referrals."      colon
    PASSES   "The referral count is invented and the wait is 11h."   conjunction "and"
    PASSES   "Every name is synthetic, and four beds are free."      comma + and

    REJECTS  "There were 28 referrals this period."                  control — the plain defect
    PASSES   "Every bed figure … vacant but not yet cleared, and     control — honest prose,
              out of service — is invented for this prototype."      commas and an "and"
    PASSES   "The bed occupancy is a random walk, not measured."     control — honest, statistics

**The controls matter as much as the failures:** the honest sentence a comma- or and-splitter would
destroy is real, it is on `hub-screen`, and it passes.

## 1 — Two are one implementation's alone, and both fixes already exist

- **Retraction after the claim.** No `RETRACTED` check. Measured: _"used to be synthetic"_ is
  **rejected**, _"were invented until recently"_ **passes**. ⚠️ **The rejection is an accident** — it
  simply fails to contain `is/are/was/were synthetic`. **An accident is not coverage**, and the next
  honest phrasing lands on whichever side chance puts it.
- **`MENTIONS_A_FIGURE` is a whitelist of figure nouns.** A clause with a spelled-out number and a
  noun off the list — `wait`, `delay`, `occupancy`, `stay` — is **skipped entirely**.

  🔴 **This is the bare-word-list defect one level along: a LIST standing where a SHAPE should be.**
  It does not examine a clause wrongly — **it leaves the clause UNEXAMINED**, which reads identically
  to compliant.

## 2 — Three are shared, and shared means they belong to the approach

A colon, an `and`, a comma. **Splitting on any of them destroys honest prose.**

> **Sentence-level text analysis cannot see a bystander inside one clause**, and any attempt to make
> it will redden correct work until the guard is switched off.

**The general form, now part of the method:**

> **A residual shared by two independent implementations is a property of the APPROACH, not a bug in
> either.** Reporting it against whichever one you measured second is how a sound design gets churned.

## 3 — ⚠️ A limits section is a population like any other

Ward Builder Four's file documents the **colon** hole and says nothing about the conjunction ones —
found by hitting it, never by looking for its siblings. **The honest-limits section is itself
incomplete, in the file that argues at length for stating limits. It was never floored.**

## What was not done

**Nothing was changed on either guard.** The repair is sound and better designed than what was asked
for. **Nobody should undo any of it.** Routed to the owning chats; queued in the outstanding-issues
inbox so it survives all three sessions.
