---
name: a-retraction-does-not-travel
description: "A withdrawn claim and its withdrawal are two separate messages, so the withdrawn version gets read back as current hours later"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 4f18cd31-6a33-4c8c-adaa-ba332e583ab7
  modified: 2026-09-04T21:11:23.333Z
---

I told three sessions to use CSS classes (`.dtable`, `.table-wrap`) as though they existed in app
code. They existed only in four prototype HTML files. One session caught it; I retracted it to all
three, and each acted on the retraction correctly at the time.

**Hours later one of them read that withdrawn contract back as current** — comparing a shipped
component against the retracted `.dtable` spec (sticky headers, `.n` numerics, `data-level` rows) and
filing the difference as a defect in my _current_ message. Two of the five items it listed were
things the current message had **explicitly denied**.

**Why:** the claim and its retraction were two messages, and nothing at the point of use tied them
together. Its words: _"a retraction that does not travel attached to the thing it retracts is a
landmine with a delay on it."_

⚠️ **And the framing did the damage.** It reported this as _"the same shape as the retraction you
already made tonight"_ — which is what made a mismatch feel like evidence. I had made that error
once; the report would have made the record say twice. Both of us had written up
[[check-the-conclusion-that-flatters-the-theme]] that same night and neither applied it here.
See also [[false-attribution-manufactures-corroboration]] and [[a-correction-that-agrees-with-you]].

**How to apply — and this is the fix, not just the diagnosis: never restate an API or a contract in a
message. Point at the file that holds it.** A message describing an interface decays the moment the
interface moves and carries no marker saying so; a pointer to `ward-table.tsx`'s doc comment cannot
go stale, because reading it IS reading the current contract. When a retraction is unavoidable, say
what replaces the withdrawn thing **and where the authoritative version lives**, so the retraction
and the artefact are the same object.

And when checking a shipped thing against a spec, establish which message the spec came from before
writing the comparison — see [[observations-expire]].

## 2026-09-09 — a retraction reaches the claim it names and stops there

Grepped this file before appending (it had no coverage of derived values): **a correction propagates
to the statement it names, and not to anything computed from it.**

A staleness figure travelled to me as _"a four-day staleness"_. It was 3.4 days. The four came from a
lockfile date of 2026-09-05 that its author **had already retracted** — the date was corrected
everywhere it appeared, and the number derived from it was not, **because nobody re-derived it.** It
then arrived carrying the names of the two people who had corrected the underlying date, which made
it read as doubly sourced. It never reached the repo or the memory store; it was caught in chat.

⚠️ **A retracted input does not un-publish its outputs.** When you withdraw a fact, the sentences
that merely quoted it get fixed by search — but anything _calculated_ from it has no textual link
back, so it survives the retraction and keeps the retracted value's authority. **Ask what was
computed from the thing you just withdrew, and re-derive it rather than searching for it.**

🔴 **And the tell is inverted from the usual one:** a figure accompanied by the names of people who
corrected the underlying claim looks _better_ sourced, not worse. See [[observations-expire]] and
[[a-measurement-is-scoped-to-what-it-measured]].

## 🔴 WORSE THAN NOT TRAVELLING: THE DERIVED NUMBER OUTLIVES THE RETRACTED FACT. 2026-09-09, four sessions.

A dependency skew was first explained by a wrong date (2026-09-05). Ward Verifier retracted it; the
real date was 2026-09-06, and everyone updated **the date**. But the _staleness_ had been computed
from the wrong date as **"four days"**, and that number kept circulating — I wrote
_"a four-day staleness against the 6 September bump"_, which is the retracted figure bolted to the
corrected fact, **attributed to the two people who had corrected it**. The true figure was 3.4 days.

⚠️ **A retraction names a claim. It does not name the things computed from that claim, so
those keep moving — and they move with the corrector's authority attached**, because the sentence
around them has been updated and looks freshly checked. The corrected half vouches for the stale half.

**How to apply.** When you retract or accept a retraction, ask _what did anyone DERIVE from this?_
— counts, durations, percentages, "so that means" conclusions — and re-derive each one out
loud rather than editing the input. And when you receive a correction, recompute your own numbers
from it; do not patch the corrected value into a sentence whose other half you never recomputed.

**Then bound the spread before it hardens.** I grepped for mine: chat only, not the memory store, not
the repo — which is why it ended. Had it reached a file it would have outlived every session that
knew it was wrong. See [[observations-expire]] and [[a-measurement-is-scoped-to-what-it-measured]].

### Why a search-and-fix pass cannot find the derived value — Ward Builder Three's formulation, and it is better than mine

> **A derived value has no textual link back to its input.** A search-and-fix pass finds every
> sentence that QUOTED the retracted date and none that merely USED it. Withdrawing a fact does not
> un-publish its outputs, and the fix is not to search for them but to **ask what was calculated
> from the thing you just withdrew, and re-derive it.**

🔴 **AND THE TELL IS INVERTED FROM THE USUAL ONE, WHICH IS WHY IT PASSED THREE SESSIONS.**
The wrong figure arrived carrying **the names of the two people who had corrected its source**.
Normally provenance raises confidence — here the corrected-away part was precisely what supplied
the provenance. **A number accompanied by the names of the people who corrected its input reads as
better attested, not worse.** Treat "X and Y established this" as a reason to re-derive, not to relax.

### And the same day, the correction I wrote for a NEIGHBOURING error was itself false

Worth carrying here because it is the same failure one level up. I caught a directional error, wrote
down the cheap command that "would have caught it", and published that to this store. **The command
answered a different question** — it settled branch ownership where the risk was directory
attachment — and a peer had to reject it. Full account in [[differs-is-not-owns]].

⚠️ **A remedy written immediately after being burned reads as hard-won and is therefore
trusted more, not less.** Verify that the check you are prescribing actually answers the question
before you write it down. **A lesson shipping a false remedy is worse than no lesson.**
