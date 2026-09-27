---
name: a-partial-withdrawal-reads-as-a-careful-one
description: Withdrawing half a claim makes the surviving half look re-checked when it was not — and a stale claim that a guard has a GAP is more dangerous than one that it has coverage
metadata:
  node_type: memory
  type: feedback
  originSessionId: c7f34035-e7ab-45f5-b402-b971db4d0464
  modified: 2026-09-12T05:14:25.486Z
---

**A partial withdrawal reads as a careful one, so the surviving half inherits the credibility
of the correction.** A full retraction invites re-checking everything; a partial one signals
rigour, and the kept half then gets _less_ scrutiny than it had before.

I did this on 2026-09-12. I had told two chats the ward text-size gate was (a) wired to
nothing and (b) missing `src/components/ward-flow-sign-in/` from its population. When (a) was
corrected I withdrew it crisply and **kept (b) without re-measuring it**. (b) was also false —
and not merely stale against a moving line: the widening was already in **my own working tree**,
merged by me an hour earlier. Dated by walking my own commits: true at `c9b206ad42`, false from
`01c843b559` onward. **I had run the gate once, and having run it once is exactly what stopped
me running it again.**

**Why:** the paired asymmetry, from Ward Builder Two — _a stale claim that a guard has a GAP is
more dangerous than a stale claim that it has COVERAGE, because the first prompts action._ A
false "covered" makes someone relax; a false "gap" makes them build a second guard over defended
ground, or add the very thing the guard forbids believing nothing watches. And a gap-claim
recruits: I sent that sentence to two chats, so one bad measurement became three chats' belief.

**How to apply:**

- **Giving a partial withdrawal:** say explicitly which halves you re-derived and which you are
  merely not retracting. "I withdraw X; I have re-measured Y and it stands" — never let silence
  imply the survivor was checked.
- **Receiving one:** treat the surviving half as unverified, not as confirmed.
- Re-run the actual command rather than quoting an earlier run of it. Date the claim to a SHA
  when you can: walking your own commits to find where a claim died turns an excuse ("my base
  was old") into a finding.
- Two instruments agreeing is worth less than it sounds **when they measure different things** —
  a crawl counting rendered elements and a stylesheet read counting declarations are not two
  counts of one quantity; one rule makes many elements.

Related: [[a-relayed-ruling-in-first-hand-voice]], [[observations-expire]],
[[a-status-claim-about-someone-else-expires]], [[a-retraction-does-not-travel]],
[[a-measurement-is-scoped-to-what-it-measured]], [[a-correction-that-agrees-with-you]],
[[establish-the-unit-before-counting]].
