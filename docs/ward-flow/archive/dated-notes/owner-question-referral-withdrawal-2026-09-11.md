# One missing record, two wrong numbers on the community team page

**For the owner. Written 2026-09-11 by Lane D. Measured on the merged line at `3058d5f325`.**

---

## The short version

**Nothing in Ward Flow can record a referrer withdrawing a referral.** There is no button, no
field, no event — a referrer who changes their mind leaves no trace.

That one gap breaks two different figures on the community team statistics page, and it breaks them
in opposite directions:

- one figure is stuck at **nought forever**, and the page claims that nought is a real count;
- another figure is **permanently too high**, and the page claims it means something it cannot mean.

**They are the same gap. We would like to answer them together, once, rather than patch two panels
separately and end up with two different answers.**

---

## Symptom one — a zero that can never be anything else

The approved drawing for the community page lists the reasons referrals were turned down. The last
row reads:

> Withdrawn by the referrer before assessment — **0**

and the paragraph beside it says, in the drawing's own words:

> **The last row reads none, and that is a real, measured count of 0.** No referral was withdrawn by
> its referrer before assessment in this window. It is not 'not yet recorded'.

**That paragraph is wrong, and it is wrong in the most awkward possible way.** The system cannot
record a referrer withdrawing. So that row will read nought on every team, every day, for ever — not
because it never happens in real life, but because nothing can write it down.

The drawing does not merely print the nought. It states the correct general rule one sentence
later — _a count this page could not take is never shown as none; it is stated in words_ — and then
makes an exception for the single row where that rule matters most. **It also rules out the correct
description by name**, in quotation marks.

**Nothing has been built for this row. It is waiting on you.**

## Symptom two — a count of people "awaiting an answer" who mostly are not

The same page is drawn with a figure called **Still open**, described as _"Awaiting this team's
answer."_

A referral to a community team is marked "waiting" the moment it is created. Nothing ever sets that
mark deliberately — it is simply the state every referral starts in, and it means _no answer has been
recorded yet_. Three completely different situations end up wearing it, and nothing distinguishes
them:

1. the team genuinely has not answered yet;
2. **the referrer dropped it** — which is symptom one again, seen from the other side;
3. **the patient was already accepted to a hospital ward**, and the community referral was
   deliberately left open.

**The third one is the ordinary case, not an edge case** — and it happens because of a decision you
made yourself, on 1 September, which we think is right.

When a ward accepts a patient, every other competing referral for that patient is cancelled
automatically. Community referrals are exempt. Your reasoning, recorded in the code: _"Community
referral means a patient is about to be discharged."_ A community referral is not competing for a
bed — it means the patient is on their way **out**. Cancelling it because a ward said yes would have
been the system cancelling somebody's discharge plan at the exact moment their admission was
confirmed.

**So the exemption is correct and should stay.** But it means a community referral stays marked
"waiting" through the whole of an admission. A page telling a team it has four referrals awaiting its
answer would mostly be listing patients the team already knows about, or referrals nobody is
pursuing any more.

**This cannot be fixed by rewording the label.** The record genuinely cannot tell the three groups
apart. **Nothing has been built for this figure either.**

---

## What we would like from you

**One decision, in two parts.**

**1. Should a referrer be able to withdraw a referral?** In real practice, does a GP, a crisis team or
a hospital ward ever ring back and say "don't worry about that one" — and if so, is that something
this system should record? If yes, it becomes a new action in the app, and both figures above become
computable. If no, both figures should be removed from the page rather than shown as noughts and
inflated totals.

**2. If yes — is a withdrawal a kind of refusal, or its own thing?** A refusal is the receiving
service saying no. A withdrawal is the sender saying never mind. They read very differently in a
service's own statistics, and putting them in one column would flatter or damn a team for something
it did not do.

**Our recommendation:** record it as its own act, separate from a refusal, with who withdrew it and
when. That makes symptom one a real count, and it lets "still open" exclude withdrawn referrals. It
does not fix the third group in symptom two — referrals left open through an admission — which needs
its own answer and is a smaller question we can bring you separately.

**Nothing is blocked while you think about it.** Both figures are simply not built, and the rest of
the page works.

---

## For whoever implements this

Anchors re-derived on the merged line `3058d5f325`; cite by symbol, because line numbers differ in
every tree.

- **The gap itself.** `ward-model.ts`, the doc comment above `REFERRAL_ADDRESSING_STATES` (line 1522
  on this tree): a referrer withdrawing _"is an act by a person rather than a consequence of somebody
  else's acceptance, and **has no event yet**"_. Deliberately distinct from `cancelled` and from
  `Movement.withdrawnReferrals`, which carries the same meaning for a different subject.
- **`"queued"` is an initial value, never an act.** Every write of an addressing state, grepped
  whole: one at creation (`ward-flow-reducer.ts`, the `destinations: event.destinations.map(...)`
  line), then `accepted` twice, `cancelled` once, `declined` once. **Nothing transitions INTO
  `queued`, and no expiry, staleness or timeout concept exists in any referral module.**
- **The community exemption.** `ward-flow-reducer.ts:3358`,
  `if (candidate.destination.kind === "community_team") return candidate;` — with the owner's
  1 September reasoning in the comment above it.
- ⚠️ **The behaviour of that block is pinned by no test.** Its own comment records why (Ward
  Verifier, 2026-09-01): every existing test drives a _ward_ acceptance, none drives a community one,
  so whether a community acceptance cancels the queued arms is asserted nowhere. **It is deliberately
  unwritten pending a separate ruling, not forgotten. Do not "fix" it in passing** — written today it
  must assert the cancellation, and after that ruling it must assert the opposite.
- **The decline reasons are a separate question** and are in the same owner batch: the drawing's five
  community reasons have no overlap with `REFERRAL_DECLINE_REASONS`' seven bed-placement ones, so
  four more rows of that table are unbuildable for a different reason than this one.
