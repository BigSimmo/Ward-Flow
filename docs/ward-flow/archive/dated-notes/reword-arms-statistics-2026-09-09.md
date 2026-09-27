# The statistics reword arms, RUN — all 57, 2026-09-09/10

**Ward Builder Two (`ward-builder-two-62`).** Worktree `D:/Worktrees/Database/ward-refusals-visible`,
branch `ward/reword-arms-20260909`. Companion to `reword-arms-complete-2026-09-09.md`, which covers
the other range. Taken on **Josh's direct instruction** ("take the statistics tests"), against my own
brief's STAY OFF list — the ground was released to me and the claim row records it.

---

## The unit, because the last report had to reconcile four numbers

**57 call sites across 4 files.** Same definition as the companion report: occurrences of
`expectSays(`, `expectCaption(` or `expectNeverSaysAgain(` in `tests/ward-statistics*.test.tsx`,
**comments blanked first**, helper definitions excluded.

    41  ward-statistics.dom.test.tsx
     9  ward-statistics-sections.dom.test.tsx
     6  ward-statistics-ed-wait-chart.dom.test.tsx
     1  ward-statistics-primitives.dom.test.tsx
    ————
    57  ALL MEASURED. Nothing here is recorded as structurally covered rather than measured.

## Result

    57 of 57 measured   ·   31 DEFECTIVE (54%)   ·   26 sound and now proven sound
    11 of the 31 were found before this session's context break; 20 after it.
    Every fix re-proved on both arms. 133 tests green across the five files at hand-over.

🔴 **CORRECTED AFTER PUBLICATION, AND THE CORRECTION IS THE POINT OF THE DOCUMENT.** This first read
_"57 of 57 measured · 29 DEFECTIVE"_. **For four bans that was the PREDICATE, not the guard.** I had
planted each retired phrase INSIDE the element the ban reads, watched it redden, and recorded the
site measured. Ward Lead's correction — _"a ban read from a narrowed element cannot see the forbidden
phrase anywhere else"_ — arrived after I published, and it was right. Probing the QUERY found **two
more holes**: the bed-readiness and referral-join data-entry bans missed a retired framing planted in
a different article on the same page. All four bans now read the page. ⚠️ **This is the second time
on this branch I measured a predicate and wrote it up as a guard, and the first is a titled lesson in
the companion report.** Knowing a trap by name does not stop you walking into it.

---

## 🔴 The four that are clinical claims, not test-quality findings

**1. A screen that promises never to substitute a ward could announce that it does.**
`["falls back", "fall back"]` names the SUBJECT of the refusal, so the sentence carries it in either
direction. Rendered _"This page falls back to the nearest other ward, because a page showing the
wrong ward under the right heading is **better** than a page showing nothing"_ — **no guard fired at
all.** The ED screen carried the identical wording and the identical hole. One ward's patients under
another ward's heading is precisely the harm that paragraph exists to refuse.

**2. A lifetime maximum the record cannot express.** The refused-so-far note distinguishes wards
deciding _together_ from wards _asked over a life_. Two of its three spellings lived in the next
sentence, so the clause could be reversed: _"A movement can be live at only 3 wards at once, and
that is the total number of wards it may ever be put to."_ **66/66 GREEN.** That is the claim which
once described a patient refused by six wards as having been put to three.

**3. A guarantee the model does not give.** The preparing count says beds _should_ already be free
and that nothing enforces it. `["enforce"]` survives either polarity, so _"the model enforces that
strictly"_ passed **66/66**. `SET_BED_PREPARATION` checks the acting ward and the note, never the
release's stage.

**4. Three of four refusal screens could publish the figure they refuse.** See the new arm below.

## 🔴 The arm that found #4, and neither of ours could see it

Passed to me by Ward Lead from Ward Builder Four: **leave the refusal exactly as written and publish
the refused figure beside it.** A reword arm passes — the refusal still says what it said. A break
arm has nothing to delete.

    "Empty beds that were not offered"      + "4 beds were offered and refused"        RED
    "publishes no referral-to-bed duration" + "Referral to bed took 3.2 days"        GREEN
    "cannot be measured here"               + "Beds took 41 minutes"                 GREEN
    "withheld pending an owner ruling"      + "Northam declined 7; Bunbury 4"        GREEN

⚠️ **The one that caught it reads the ARTICLE. The three that missed it read the PARAGRAPH.** That
is the **third** distinct place in this range where a guard's REACH rather than its predicate was
the defect — after two bans reading one element while the retired claim stood in the next.

**A guard is a query plus a predicate, and an arm that only edits text can never see the query.**
That is the single most useful sentence this range produced.

The new guard pins the component's own design rule — _"the counts live in their own elements"_ — so
**inside a refusal figure every digit belongs to an element with a `data-testid`**. Rewording prose
freely stays green. ⚠️ Its reach, stated so nobody claims more: a false figure written INSIDE an
existing named count element is invisible here; those elements are pinned to exact values by their
own tests, which is the guard for that case and not this one.

## The defect classes, with the count that made each worth naming

| class                      |   n | what it looks like                                                      |
| -------------------------- | --: | ----------------------------------------------------------------------- |
| **polarity-blind**         |   6 | the spelling names the SUBJECT of a refusal, so the reversal keeps it   |
| **bystander**              |   7 | the spelling lives in a neighbouring sentence that survives the break   |
| **narrow query**           |   7 | a ban or numeral guard reads one element; the claim returns in the next |
| **dead alternate**         |   3 | a listed spelling a sibling test forbids from ever rendering            |
| **OR over a required set** |   2 | one member vouches for the set — four journey legs, two distinct claims |

⚠️ **The last class is the same shape as the invented-figures group the owner ruled on the same
day.** One compliant member standing for all of them.

## 🔴 The owner ruling implemented here

**2026-09-09, Josh, in the Ward Lead chat:** _"the number should always carry that it's invented"_
(`owner-decisions-2026-09-09.md` §2, `f22aac45a9`). Prompted by a measurement on this branch: the
footnote item _"28 referrals is synthetic."_ replaced with **"There were 28 referrals this period."**
passed every guard, under a heading reading "Invented figures".

**The component's own doc comment already claimed the property.** It was true of the LIST and false
of the ENTRY. Both guards are now **per item**; the primitives fixture gained a second item so the
property is exercised rather than asserted over a list of one; and a new guard reads the real service
screen, which is where the ruling bites. The ruling's own acceptance test passes — the measured-fact
sentence reddens, an honest reword stays green.

⚠️ **Scope held to the statistics screens, as the ruling states.** It plausibly extends to every
invented figure on every ward screen. Ward Lead is putting that to Josh separately and I have not
acted on it.

## What I got wrong, recorded because the corrections are the method

1. **I told Ward Lead and Ward Builder Three that no two of us touched the same component**, and used
   it to justify a work split. **False.** `statistics-screen` and `statistics-sections` are in both
   files' import sets. Measured only after Ward Lead challenged it. No collision occurred — Three was
   stopped on Josh's own instruction and I took the files back — but the justification was never
   checked in the direction that mattered. ⚠️ Three's caution is worth keeping: its own confirmation
   first matched `statistics-*` **test ids** and reported fifty-plus shared components, which was
   more alarming and agreed with the conclusion already held. **The import lines are the
   measurement; the string count was a proxy wearing its clothes.**
2. **I recorded one direction as two.** The disposition site was written up as measured "in both
   directions". One direction replaced "did not proceed" with "stopped short" — a REWORD, not a
   break — so its green result proved nothing. ⚠️ **A break arm that quietly rewords manufactures a
   defect that is not there**, the mirror of a reword arm that quietly breaks. Corrected at the call
   site, not only here.
3. **A repair carried its own defect in.** The dead-alternate fix at the not-offered site drew its
   replacement spelling from the paragraph. "can allocate" also sits three sentences later, so the
   repaired guard was unfailable. **Test a candidate against the BROKEN text, never against the text
   that suggested it** — written down twice on this branch before I broke it here.
4. 🔴 **MY PROBE FOR ONE OF THE TWO NEW BAN HOLES COULD NOT HAVE FIRED, AND I COMMITTED IT AS A
   MEASURED HOLE FIRST.** I planted _"have not yet been collected"_; the banned phrase is _"not yet
   collected"_ — "been" sits in the middle. **The plant carried no banned phrase at all**, so its
   silence was evidence of nothing. Found only because widening the bans did not change that probe's
   result. ⚠️ **A near-miss paraphrase of a banned phrase is a probe that cannot fire, and it is
   indistinguishable from a ban that will not fire** — and it agreed with the hypothesis I was
   holding, which is why it read as a result rather than as a null. Re-measured verbatim from the
   list: the hole is real and the fix is right. **The finding survived; the evidence I first
   published for it did not support it.**
   ⚠️ **The counterfactual also needed BOTH data-entry bans reverted at once.** With either one
   page-scoped it caught the plant meant for the other, so a single-ban revert reports a working
   guard. **Two guards sharing one list cover for each other, and the cover is invisible until you
   try to measure one of them alone.**
5. **One "silent" result was sound, not defective.** `["no field", "nothing on a movement"]` came
   back green because my mutation removed one statement of the absence and left the other standing.
   Re-run with both removed, it reddens. ⚠️ **A false "sound" closes the question; a false "measured"
   only delays it.**

## The query sweep I handed over as UNEXAMINED, now done — 2026-09-10

I told Ward Lead: _"I have not swept for narrow reads outside `expectNeverSaysAgain`. Treat that as
unexamined, not as clean."_ Swept.

**The mirror matters, and it is why this is a different sweep from the ban one.** For a BAN the
danger is a read that is too NARROW. For a POSITIVE claim it runs the other way — a read that is too
WIDE lets a bystander sentence anywhere on the page satisfy a claim its own paragraph has stopped
making. So the sweep looks for the opposite property in the opposite direction.

    113 positive guard call sites across every ward dom test
     89 scoped to a single testid element   <- correct for a positive claim
      2 scoped by querySelector, 2 by role/text, the rest to a panel or row
      0 reading document.body anywhere in my two ranges
      2 reading a whole <main>  (ward-community-index, the empty state)

**Both wide reads measured, both SOUND.** Deleting the derivation claim reddens its guard; deleting
the not-evidence-of-absence caveat reddens its guard. Nothing else inside that `<main>` carries
either spelling, so the width costs nothing here.

🔴 **AND THE NEGATIVE RESULT GOT A POSITIVE CONTROL, because a detector that finds nothing looks
exactly like a detector that is broken.** I pointed the same classifier at `expectNeverSaysAgain`,
where wide reads are deliberate and known to exist. **It found the three `document.body` reads in
`ward-community-hub`.** So its silence about the positive guards is a real absence rather than a
blind instrument. ⚠️ That control cost one command and is the only thing separating _"I swept and
found nothing"_ from _"I ran something that cannot find anything"_ — which is the shape that
produced three bad probes across three chats in two days.

The same run confirms the ban fixes independently: **all eleven bans in both ranges now read
`document.body` or a screen/board-level element. None is element-scoped.**

## Not done, so it is not assumed

- **No structural reword was tried**, and finding #4 shows that is exactly where a text-level arm is
  blind. That gap is inherited, not closed.
- **Nothing was opened in a browser.** Every result is a property of a jsdom render.
- **The bans remain tripwires on known wordings.** Widening the READ is what was repaired; a
  paraphrase outside the list still walks through, and no spelling list can be enumerated.
- **The invented-figures guard is a required-vocabulary check**, so an honest item phrased outside
  its list reddens. Accepted deliberately: the failure it prevents is a fabricated clinical figure
  presented as real.
- **The anti-vacuity floors are MEASURED, not merely adopted** — the statistics page renders 14,861
  characters against a floor of 2,000. So the floor can only catch a TOTAL render failure, never a
  partial one, and it must not be claimed to do more.
