# Findings that outlived their lane — Ward Builder Four's read-only verification, 2026-09-10

**Recorded by Ward Lead, on the line, because the chat that found them cannot write them down.**

Josh ruled **"Hold"** on Ward Builder Four, directly and in one word, after it put the go/hold to him
with the scope change named. **That is a ruling, not a pending question.** Lane D is not started and
will not start without a fresh word from him: no branch, no plan file, no subagents.

⚠️ **Ward Builder Four then declined to write these findings to a file on its own branch, on the
grounds that writing them down is the work he has just held.** That reasoning is right, and it
creates the problem this file exists to solve: **a chat that correctly produces no artefact produces
findings that exist nowhere.** They were measured, they are real, they do not depend on Lane D ever
running — and they would have died in a message.

**Ward Lead is not under that hold, so this is mine to keep.** Every finding below is attributed;
none of it is mine.

⚠️ **Ward Builder Four measured these at line `8c5aebc938`. The line has moved since. Re-measure
before building on any of it — and find things by name, never by line number.**

---

## 1 · 🔴 A referral is addressed to the ward SYSTEM, not to a named ward

**Found by Ward Builder Four. Independently confirmed by Ward Lead before this was written.**

The master plan's §4.14 task 3 asks for a panel of _"Referrals into this ward"_, and — to its
credit — tells the builder to confirm the field first and hand back if it is not there. **It is not
there.**

    ward-model.ts  the psychiatric_ward destination arm carries sex, secureBedNeeded,
                   involuntaryBedNeeded, highAcuityNursingNeeded — request facts, no addressee
    ward-model.ts:1322-1500   grep -nE "unitId|wardId"  ->  ZERO hits in the whole destination region
    ward-model.ts:1498        acceptedUnitId?: string — "Only ever set on a psychiatric_ward
                              addressing", i.e. it exists only once a ward has ACCEPTED

**So pending and declined referrals to a ward are not data.** There is nothing to filter on. The
only derivable figure is _referrals this ward accepted_.

### Why this matters more than a missing field, in the finder's words

> **"A ward that declines everything would show an empty panel and read as a ward nobody refers to."**

It is **supply reported as demand**, and it is the flattering half — flattering to the ward, not to
the patient waiting. Every test that counts rows passes.

### RULING (Ward Lead): build it as (a), whoever eventually builds it

- The panel is titled **what it actually holds** — _Referrals this ward accepted_. Never _Referrals
  into this ward_.
- 🔴 **And it carries a stated absence beside it.** The retitle alone is not enough: without a line
  saying that **pending and declined referrals cannot be attributed to a ward in this model**, a
  reader still infers demand from supply, just from a more careful noun.
- Not dropped — Q-12 says nothing is dropped. Not fixed by extending the model — that changes the
  referral act itself and is the owner's.

**Open question for the owner, not yet asked:** should a referral name the ward it is addressed to,
and not only the ward that accepted it? Queued for the next batch, deliberately not asked piecemeal.

---

## 2 · 🔴 The three flow timestamps are nullable, and the charts are built on them

**Found by Ward Builder Four. Confirmed by Ward Lead.**

    ward-admissions.ts:418   pulledAt:   Instant | null
    ward-admissions.ts:421   arrivedAt:  Instant | null
    ward-admissions.ts:504   leftAt:     Instant | null

A `dailyFlow` derivation written the obvious way **filters the nulls out**, and the chart then draws
a clean line over a quietly different population from the one its own axis claims.

⚠️ **It will pass every test that counts rows**, and it violates the standing constraint that a
missing value is _shown and marked absent, never dropped_ — which on a chart matters more than
anywhere else, because a dropped absent value is invisible and reads as data rather than as a gap.

**This is the finding that matters most and it is not Lane D's to hold:** Movement's chart (lane A)
and the ward screens (lane B) read the same three fields **today**, whether or not Lane D ever runs.
Broadcast to lanes A, B and C on 2026-09-10.

---

## 3 · `communityStatisticsHref` takes a slug, not a name

**Found by Ward Builder Four.** Its own comment flags this as the difference from
`serviceStatisticsHref`. Whoever moves it into the facade must carry the distinction across, **or
the sixty-five community teams of Q-5 will produce hrefs that look right and resolve wrong** — which
is worse than a link that fails loudly.

Carried into Ward Lead's facade-extraction brief.

---

## 4 · A panel the plan forgot — _"What this page cannot see"_

**Found by Ward Builder Four**, on `/statistics/community/[teamId]`. It exists in the app today, is
drawn in no mockup, and **the master plan does not mention it at all** — so it is unallocated rather
than decided.

**RULING (Ward Lead): KEEP IT, and it is the last panel anyone should drop.** It is a stated-absence
panel. Removing it does not lose a figure — **it loses the warning that figures are missing**, and
nothing downstream goes red. That gap is the plan's, not the finder's, and it is still in the plan
for whoever picks the screen up.

---

## 5 · The plan's §4.13–§4.16 are unusually well evidenced

Five of five line counts exact; eight emergency departments confirmed by `grep -c` on
`ward-sites.ts`; 23 units, matching the acuity work's own figure. **Worth recording because two of
the plan's other claims failed when Ward Lead checked them** — the quality is not uniform, and these
sections are the good end.

---

## 6 · The correction the finder caught in itself, which is why the rest is trustworthy

It grepped `ward-model.ts` alone for `pulledAt` / `leftAt`, got zero hits, and **nearly reported the
plan's claim false.** The fields exist — in `ward-admissions.ts`. In its own words:

> **"I had scoped an absence claim to one file and drawn a conclusion the size of the tree."**

It caught this **before** the claim left its chat, not after it reached four builders. **And
widening the search is what produced finding 2**, which is the most consequential item on this page.

⚠️ Kept here because the habit is the transferable part: **an absence measured under one prefix is
absence under that prefix only.** The finding that mattered was on the other side of the boundary
the search had drawn.
