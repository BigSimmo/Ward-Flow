# Task C4 — the ED screen's Q-12 list, and four corrections to the plan's version of it

**Measured 2026-09-12 in `D:/Worktrees/Database/ward-builder-two` at `780222addd`, against
`docs/ward-flow/mockups/emergency-department-third-edition.html`. Inventory only — nothing built,
nothing removed.**

🔴 **Q-12 settles the principle — nothing the app has is dropped — and explicitly does NOT settle the
inventory. This is the inventory.**

## The trap this was taken through, stated first

⚠️ **An inventory taken by `aria-label` and an inventory taken by visible heading return different
lists on this screen.** Three sections announce themselves to a screen reader as one thing and read
on screen as another:

| accessible name              | visible heading                    |
| ---------------------------- | ---------------------------------- |
| `Psychiatry outbox`          | `Still to be moved · {n} patients` |
| `This department's patients` | `{department.name} · {n} patients` |
| `Statewide capacity`         | `Statewide capacity (read-only)`   |

**The third was not in the plan's known-examples list and is a new finding.** It is the mildest of
the three — only the `(read-only)` suffix differs — but it is the same defect, and the suffix is the
part that tells a sighted reader they cannot act here.

Two more blocks carry **neither** an accessible name nor a heading: the synthetic-prototype
governance banner, and the department `<h1>`, which sits in a `<header>` rather than a labelled
`<section>`.

## The nine blocks the app renders, in order

| #   | accessible name              | visible heading                     | derived from                                                                                |
| --- | ---------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| 0   | —                            | — (badge + paragraph)               | static copy                                                                                 |
| 1   | —                            | `{department.name}` (`h1`)          | `edById(edId)`                                                                              |
| 2   | `Expects`                    | `Expects · {n} patients`            | `edExpectsFor(referrals, thisEdId, "psychiatric_review")`                                   |
| 3   | `Referrals`                  | `Referrals · {n} patients`          | `edArrivedFor(...)`                                                                         |
| 4   | `Recently answered`          | `Recently answered · {n} referrals` | `edAnsweredReferralsFor(...)`, capped at 10                                                 |
| 5   | `Psychiatry outbox`          | `Still to be moved · {n} patients`  | `patients.filter((m) => m.acceptedUnitId !== undefined)`                                    |
| 6   | `Raise a referral`           | `Raise a referral`                  | the inline form — ⚠️ **see `c3-is-not-a-duplicate-2026-09-12.md`**                          |
| 7   | `This department's patients` | `{department.name} · {n} patients`  | `movements.filter((m) => m.originEdId === thisEdId && !m.closure && m.stage !== "arrived")` |
| 8   | `Statewide capacity`         | `Statewide capacity (read-only)`    | `wardServiceOrder.flatMap(...)` over `unitCapacity`                                         |

## Four corrections to the plan's list

The plan names **three** panels as in the app and not in the drawing: `Psychiatry outbox`,
`Statewide capacity`, `Recently answered`.

✅ **Verified with a positive control before trusting any zero.** The known-present string
`Emergency departments` returns **6** hits in the drawing, so the search can find things that are
there. Then:

1. **`Psychiatry outbox` / `Still to be moved` — 0 hits.** Plan correct.
2. **`Statewide capacity` — 0 hits.** Plan correct.
3. 🔴 **`Recently answered` is in the WRONG BUCKET.** The drawing has `Seen in the last 24 hours`
   (2 hits) — it is **renamed, not absent**. ⚠️ **And the two are not the same population**: the
   app's list is _referrals answered_, capped at the 10 most recent; the drawing's is _all recorded
   events_ in a trailing 24-hour window. Rebuilding one as the other silently changes what a
   coordinator is looking at.
4. 🔴 **One more is absent that the plan never listed** — `This department's patients` (**0** hits,
   either apostrophe).

   ⚠️ **CORRECTED WITHIN THE HOUR, BY THE VERY CHECK THIS DOCUMENT NAMED AS MOST LIKELY TO OVERTURN
   IT.** The first version of this list said `Expects` was absent too, on a literal search that
   returned zero. **It is not absent — it is a TAB, not a panel.** The drawing's `Department lists`
   carries a tab labelled `Expected`, backed by `expectedIn(edId)`, which is the same population as
   the app's `Expects`. **A search for a panel name cannot find a concept that was promoted to a tab**,
   and that is the whole failure: the zero was real and the conclusion drawn from it was not.

**So the Q-12 list for this screen is THREE items — the same count the plan gave, with a different
membership.** `Psychiatry outbox`, `Statewide capacity` and `This department's patients` are absent;
`Recently answered` and `Expects` both exist in the drawing under other names and in other shapes.
⚠️ **The matching count is a coincidence and must not be read as the plan being right** — one of its
three was miscategorised and one of mine was wrong.

## What I did not check

- ✅ **The tab check is now DONE, and it overturned correction 4** — see the correction above. It
  was written here as the check most likely to change this document, and it was.
- Whether `Medically cleared` and `Under a form`, the other two tabs, likewise re-express something
  the app holds elsewhere. ⚠️ **Not checked**, and the `Expects` miss says this is the direction the
  remaining error would be in.
- Anything about layout, or what a browser paints.

## 🔴 And the tab check found something bigger than this document

The drawing's `Expected` tab is backed by **nine fully-drawn expected arrivals**, `EX-01` to `EX-09`,
each carrying `eta`, a free-text `source`, a `legalForm`, a `note`, `given`/`family`, `ageBand` and
`sex` — sorted by `eta`. **That is the whole of O-16.1, already designed.** See
`ed-expect-arrival-gap-2026-09-12.md`, which has been corrected accordingly.

---

## Summary

    DID        Took the ED screen's Q-12 inventory by BOTH accessible name and visible heading,
               because on this screen those two return different lists. Nine blocks in the app, six
               sections in the drawing, reconciled three ways.

    ISSUE      I got one wrong myself and caught it within the hour, by running the check I had
               just written down as most likely to overturn me. `Expects` is not missing from the
               drawing — it is a TAB rather than a panel, so a search for panel names could not see
               it. The corrected list is still three, with different membership: `Psychiatry
               outbox`, `Statewide capacity` and `This department's patients`. `Recently answered`
               is renamed, not absent. Separately, a third accessible-name/heading mismatch exists
               that nobody had recorded: `Statewide capacity` announces itself without the
               `(read-only)` that tells a sighted reader they cannot act there.

    GAPS       I checked only ONE of the drawing's four tabs after the `Expects` miss. `Medically
               cleared` and `Under a form` have not been checked against what the app holds
               elsewhere, and that is now the likeliest place for the same error to be sitting.

    NEED       Nothing yet. Q-12 says nothing is dropped; where each of the four lands is a build
               decision, not an inventory one.

    RECOMMEND  Act on the O-16.1 find, not on this inventory. The drawing already holds nine
               expected arrivals with times of arrival on them, which turns an open design question
               into a build-to-drawing task.
