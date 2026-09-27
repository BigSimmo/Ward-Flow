# The "none" census — the rendered half, and why the denominator decides the answer

**Ward Verifier, 2026-09-11.** Owner ruling: _"none"_ keeps its true-zero meaning; the checked-empty
screens must name what was searched. **Ward Lead's caution was that the ruling's four checked-empty
sites came from one lane sweeping its own family — a list of what somebody found, not a population.**

**Prediction written before any number: `none-census-prereg-2026-09-11.txt`, committed verbatim.**

## 1 · 🔴 THE HEADLINE FLIPS DEPENDING ON WHAT YOU COUNT

    36 routes declared · 36 measured · 0 errors
    whole-word "none" (case-insensitive) rendered:  352 occurrences, 27 distinct contexts
    routes carrying at least one:                   20 of 36

                                              distinct   occurrences
      a figure rendering the bare word            2           315
      ordinary English PRONOUN in prose          16            23
      neither — a label or an explanation         9            14
      RECONCILE                                  27           352

🔴 **By OCCURRENCE, 315 of 352 — 89% — are a figure. By DISTINCT SITE, only 2 of 27 are.**

**Both numbers are correct. They point in opposite directions.** The 315 are two contexts repeated
hundreds of times — a bed-map cell and a console figure tile — while **twenty-five of the twenty-seven
places the word actually appears are not figures at all.**

⚠️ **For the owner's ruling the DISTINCT-SITE denominator is the relevant one**, because the ruling is
about wording that somebody must go and edit. **On that denominator, the dominant use of "none" in
this module is ordinary English.**

## 2 · 🔴 THE FOURTH BUCKET IS THE MAJORITY, AND MY PREDICTION WAS WRONG ABOUT WHAT IS IN IT

I predicted the fourth bucket would be non-empty and would hold **compound state labels** —
`"None — cleared"`, `"None — in transit"`. ✅ **Right that it would be non-empty. Wrong about its
contents, and badly wrong about its size.**

**It is prose.** _"**None** of them is about a person."_ · _"and **none** is sent anywhere."_ ·
_"a department has **none** in this prototype."_ · _"1 ward asked, **none** has accepted."_ ·
_"Every admission was checked against this team and **none** named it."_

🔴 **A census that classified every "none" into the three offered buckets would have mis-filed
twenty-five sites out of twenty-seven** — and a find-and-replace over the word, which is the obvious
way to apply the ruling, would rewrite English sentences that are already correct.

✅ **The fourth bucket existing is what caught it. Ward Lead offered it; had the brief offered only
three, the honest answer would not have been expressible.**

## 3 · The codebase already explains the distinction the ruling makes

Three of the "neither" rows are the module **explaining its own convention to the reader**:

> _"A nought means the count ran over that reason and found none, which is a true answer about a
> genuine count."_ — `ward-statistics-declines-by-reason`
>
> _"a nought means the count ran over that blocker and found none, not that the figure is
> unavailable."_ — `ward-statistics-ward-measures`

**So part of the ruling is already implemented as prose on the statistics screens.** Recorded, not
acted on.

## 4 · Controls, and one arm I will not claim

    capacity family, "none" as a true zero        153 hits   ✅ probe sees it
    delays + community, checked-empty family        2 hits   ⚠️ WEAK
    CASE: "None" capitalised 8 · "none" lower 344            ✅ both arms non-zero

✅ **The case control is the one that matters most here** — the previous sweep of this kind missed a
capitalised variant by searching lower-case. **Both cases are non-zero, so the case-insensitive claim
is tested rather than asserted.**

⚠️ **The checked-empty arm returned only 2 hits and I will not report a checked-empty count from it.**
**Two is not a population, and per my own rule an arm without a solid control is UNMEASURED, not
small.** **The source enumeration now running is the instrument for that arm; this render is not.**

## 5 · 🔴 AN INSTRUMENT CAVEAT — do not quote my visible/hidden split

I reported `visible 133 · sr-only-or-hidden 219`. ⚠️ **My "hidden" test was `class matches sr-only`
OR `width <= 1`, and a collapsed or zero-width cell in a dense grid satisfies the second without
being screen-reader-only.** **The 219 is an upper bound on hidden, not a count of it.** **I would not
stand behind that split; the 352, the 27, and the case counts are exact.**

## 6 · What this does not cover

- **Default render only.** A "none" that appears after an action was not exercised.
- **One viewport.**
- **The rendered population is not the source population.** The source enumeration is running
  separately; **where it finds more, the difference is UNRENDERED-BY-DEFAULT, not absent.**
