# Owner question, 2026-09-11 — Ward Flow does not record who sent a referral

**Raised by Lane C. Every claim below was measured in the tree, not recalled.**
**Written for Ward Lead to time. Not sent.**

---

## The question, in one sentence

**Ward Flow records the hospital a referral came from, and never the team — so it can always say
where a referral is going, and it cannot say who sent it.**

---

## What the software actually stores

A referral has sixteen fields (`ward-model.ts`, `export type Referral`). The one that says where it
came from is:

    originSiteCode: string      ← a HOSPITAL

There is no team field, no service field, no named referrer. The field that names _where a referral
is going_ — `teamName` — sits on the **destination** arm only, so a community team can be addressed
but never credited as the sender.

That is the whole of it. Everything below is a consequence of that one absence.

---

## Four consequences, each measured

**These are not four problems. They are one missing field, showing up in four places** — which is
why fixing any one of them locally would leave the other three, and why this is a question about the
model rather than a bug report.

### 1 · A community referral that is declined tells nobody

`ward-flow-reducer.ts:1024`. When a referral is turned down, the system works out who to tell. It
can only answer for referrals that came from a hospital emergency department. For the other five
kinds — community, crisis service, police, ambulance, inter-hospital — it deliberately tells nobody
at all, rather than risk telling the wrong team.

✅ **This is the right call as written, and the code says so in its own words:** guessing an address
_"would either address a decline's reason to a community team that never sent this referral, or
address it to nobody who could actually read it."_ **It is a conservative failure, not a mistake.**
But its practical effect is that a community mental health team that asks for a bed and is refused
is not told by this software.

### 2 · Your own access ruling describes a party the data cannot name

**O-5, your words, 2026-09-11:** _"Once a referral is sent, It can be read by the team who sent it
until that referral is either closed or accepted."_

⚠️ **For a community referral, "the team who sent it" is not recorded anywhere.** The ruling is
clear and I am not questioning it — the software simply cannot currently identify the party it
names. This was already noted in the decisions record at the time and is repeated here because it is
the same absence as the other three.

### 3 · The ward statistics cannot show a share, and say so

**D-42.** _"Referrals into this ward"_ shows plain counts with no percentage, because working out a
share needs a total of referrals received, and a referral is never addressed to a named ward. The
section states this in its own words rather than showing a number it cannot stand behind.

✅ **That was the correct resolution and it stays correct.** It is listed here only to show the
absence is already costing something visible on screen.

### 4 · A link can carry a team, and the form has nowhere to put it

**Task 14, built today.** Links into the referral form can carry four pieces of information.
Three land somewhere. The fourth — the community team the person is being referred from — has no
question on the form that it answers, because the form asks for an origin _hospital_ and a community
team is not one.

⚠️ **I did not invent a place to put it.** I wrote a test that fails if anybody does, because
choosing where it goes is a decision about how referrals work, not a coding choice.

---

## What I have NOT established

- **Whether it matters in practice.** I do not know how a community team in your service expects to
  hear that a bed request was refused — whether that is a phone call, a letter, or something they
  would expect to see in a tool like this. **Nothing here has been tested against how referrals
  really flow.**
- **Whether the other four unresolved sources matter as much.** Police and ambulance may genuinely
  have no one to notify; a crisis service probably does. I traced community because that is what
  three separate pieces of work surfaced.
- **Who, exactly, "the team" would be.** Whether that is a named CMHT, a duty clinician, or a shared
  inbox is a question about your service, and the answer changes what the field would have to hold.

---

## The question

> **Should a referral record the team or service that sent it, as well as the hospital?**

And, if yes, the part only you can answer: **when a community team's bed request is turned down,
should this software be responsible for telling them — or is that a phone call that happens
outside it?**

---

## One recommendation

**Record the sender, and do not build the notification yet.**

Adding a field that records who sent a referral is cheap, carries no clinical risk, and is the thing
all four consequences above are waiting on. It makes the record honest about where a request came
from, which is worth having whether or not anything is ever sent back down that route.

**Telling a community team their request was declined is a different piece of work and a bigger
one** — it needs to know who that team is, how they would be reached, and what happens when nobody
reads it. ⚠️ **I would not slip it in alongside the field.** A half-built notification is worse than
none: the current behaviour tells nobody and is honest about it, whereas a notification that
sometimes reaches nobody looks like it worked.

⚠️ **And I would not add the field quietly as part of other work either** — that would make the
record look complete while the notification gap stayed hidden, which is the same mistake avoided in
the GP write-up on 2026-09-11.

---

## Summary

**DID** — Measured `Referral`'s sixteen fields and confirmed it records a hospital and never a team;
traced the decline-notification path, your O-5 access ruling, the D-42 statistics ruling and the
Task 14 query contract, and established that all four rest on the same single absence.

**ISSUE** — Ward Flow cannot name who sent a community referral. A declined community referral
therefore notifies nobody, your access ruling names a party the data cannot identify, the ward
statistics cannot compute a share, and a link can carry a team the form has nowhere to put.

**GAPS** — I have not established whether this matters in your actual service, what "the team" would
be, or whether the other four unresolved sources are as affected. Prototype, invented data.

**NEED** — Should a referral record the team that sent it? And separately: should this software tell
a community team their bed request was declined?

**RECOMMEND** — Record the sender; scope the notification as its own work rather than adding it with
the field.

**NEXT** — Nothing waits on this. Every consequence above is already handled conservatively — the
software declines to guess in each case, which is the correct behaviour while the answer is unknown.
