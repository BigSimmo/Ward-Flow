# The seventeenth screen — Handover, measured

**Ward Verifier, 2026-09-11, at line tip `ba81fd2109`.** Ward Lead asked for measurement, not
opinion, and asked to be found wrong rather than agreed with quickly. **Its finding survives. One of
its supporting dates does not, and its framing of the plan as wrong is itself wrong — the plan was
true when it was written.**

⚠️ **§1–§5 and §7–§8 are read from the line with `git show`; nothing in them was rendered.** **§6 WAS
rendered**, on 2026-09-11, after Ward Lead asked for it — it was the one claim reading could not
settle, and it is now the only section here backed by a live DOM.

---

## 1 · The population, enumerated rather than searched for

`git ls-tree -r --name-only <line> -- docs/ward-flow/mockups` returns **21 drawings** outside the
kit. Plan §1.4 names **16**. Five are unnamed:

| Drawing                            | Bytes       | Route exists?            |
| ---------------------------------- | ----------- | ------------------------ |
| `design-system-third-edition.html` | 677,738     | no                       |
| `handover-third-edition.html`      | **298,729** | **yes — `/handover`**    |
| `ward-flow-digest.html`            | 100,580     | no                       |
| `patient-search-working.html`      | 89,788      | `/search`, already taken |
| `patient-search-console.html`      | 71,869      | `/search`, already taken |

The sixteen built screens span **287,717 – 432,787 bytes**. **Handover sits inside that band and is
larger than two screens the plan does build** — Search hub (295,716) and Patient search (287,717).

The 36 ward-flow routes were enumerated the same way. **`/handover` is one of them, and it is the
only one of the five unnamed drawings with a route of its own.**

## 2 · Ward Lead's finding — CONFIRMED, and by a better witness than either of us

Two independent records, both authored by the chat that drew the page:

- `WARD-MOCKUPS-STATUS-2026-09-10.md` line 30 — **"`handover-third-edition.html`, new — the 17th
  page. check.mjs 86/0, check-shell 30/0."**
- Commit `66c14961a3`, _"adopt the owner's provenance wording on all eighteen pages"_, touches
  **eighteen** files: the sixteen, **plus design-system, plus handover.** It touches neither the
  digest nor either patient-search draft.

**So the drawing's own author counts it as a page, gave it the same provenance treatment as the
sixteen, and recorded it passing the kit's checks at 86/0 and 30/0.**

## 3 · 🔴 THE PLAN WAS TRUE WHEN IT WAS WRITTEN, AND THAT CHANGES WHAT THIS IS

    plan content authored     2026-09-10 20:36:43   aab2937194
    plan content last edited  2026-09-10 20:38:12   e9c6900e3e   (three minutes later; never since)
    Handover drawing created  2026-09-10 21:41:42   15a4be1b22   (9,460 lines, a new file)

`git log --all -- docs/ward-flow/mockups/handover-third-edition.html` finds **nothing earlier than
`15a4be1b22` on any ref.**

🔴 **The drawing is 63 minutes younger than the sentence saying it does not exist.** The plan's
author could not have known; the file did not exist. **This is not an oversight and should not be
recorded as one.** It is staleness in a document that is deliberately never edited — which is
precisely what the errata exists to carry, and why the correction belongs there rather than in a
patch to the plan.

⚠️ **And the same sentence lives in two places.** Plan line 87's inventory row says _"Twenty-one
further routes have no third-edition mockup"_; the list at 204–208 names **eighteen** routes. **A
repair at 205 alone leaves 87 saying it.** The three-route gap between those figures is
unreconciled — I counted the list once and did not chase it.

## 4 · The four other exclusions — ALL FOUR CORRECT, one supporting date wrong

Ward Lead concluded the first two are not screens and the last two are superseded drafts. **Both
conclusions hold, and the mockups README settles them in its own words rather than by inference:**

- `design-system-third-edition.html` — _"The same thing as a page, with live components."_ It is the
  design system itself. No route. ⚠️ **Note the precision: it IS a page — Ward Mockups counts it
  among the eighteen — but it is not a SCREEN.** "Not a screen" is right; "not a page" would not be.
- `ward-flow-digest.html` — _"The reader's brief — the same rulings in fewer words."_ No route.
- `patient-search-console.html`, `patient-search-working.html` — README, **"Earlier drawings,
  kept"**. Their route `/search` is served by `patient-search-third-edition.html` (plan row 9).

⚠️ **CORRECTION TO A SUPPORTING FACT.** Ward Lead called these two _"2026-09-06 drafts"_. Measured:
both were **created 2026-09-05 and last touched 2026-09-07**; `patient-search-third-edition.html`
first appears 2026-09-09. **The conclusion is unaffected** — and never rested on the date anyway,
because the README states the supersession outright. **The date was the weakest support for a
correct claim, which is the kind of thing that gets quoted later as though it were the evidence.**

## 5 · The drawing against the built screen — the same design, evolved

**`handover-page.tsx` is 729 lines with six test files** (`ward-handover*`, including
destination-truthfulness, filters and print).

At heading level the two look far apart, which is why I checked further:

    DRAWING   Handover · Handover sheet · Outside this filter · Shift and sign off · Print
    BUILT     Shift handover · Outside this filter · Longest waits · Beds pulled ·
              In transit · Placement gone wrong

**They are not far apart. The drawing's "Handover sheet" renders exactly the built screen's four
groups** — at drawing lines 6360–6450 a `section()` helper emits `"Longest waits"`, `"Beds pulled"`,
`"In transit"` and `"Placement gone wrong"` from `longestWaits()`, `pulledBeds()`, `inTransit()` and
`goneWrong()`. The built screen promotes those four to top-level headings; the drawing nests them in
one counted sheet.

Present in **both**: the scope filter and its named summary line, the excluded-count sentence,
"Outside this filter", and printing — the built screen has a `Print` button, `data-print-hide` chrome
handling, and a print test.

⚠️ **Activity / Tasks / Tools in the drawing are NOT Handover content.** Tested against three other
drawings — Delays, Capacity and Ward each carry all three of those `h2`s. **They are shared rail
furniture and must not be counted as this screen's cost.**

**Genuinely absent from the built screen — one section:**

> **Shift and sign off** — a shift-elapsed meter with a percentage; **"What the sign off records"**, a
> list plus a `Sign off the handover` button whose own `title` says _"Not wired in this prototype"_;
> and **"Notes for the incoming coordinator"**, whose empty state is already written: _"Absence here
> means no note was written, not that the shift was quiet."_

## 6 · Reachability — re-derived, then RENDERED on all 36 routes

Ward Lead warned that the shell mount retired the Handover link the old chrome header carried, and
asked me to re-derive rather than carry. Re-derived:

    ward-nav.ts:277    { id: "handover", href: "/mockups/ward-flow/handover", label: "Handover", group: "board" }
    ward-rail.tsx:119  const nav: RailEntry[] = WARD_NAV.map(...)     <- every item, no filter
    ward-rail.tsx:248  {groupEntries.length > 0 ? ... groupEntries.map(renderEntry) ...}

**On a source reading the new rail carries a Handover entry, because it maps the whole registry
unfiltered and renders the group entries.** Both things can be true: the old chrome header's link was
retired AND the new rail supplies one.

🔴 **THAT WAS A DECLARATION, NOT AN EFFECT — SO IT WAS RENDERED. VERIFIED 2026-09-11.**

**Every one of the 36 ward-flow routes was loaded in Chromium against this project's own dev
server (identity confirmed at `/api/local-project-id`), settled, and its rail read from the live
DOM. Handover is present as EXACTLY ONE VISIBLE rail link on all 36, in BOTH rail states, labelled
`"Handover"`.**

```
route                         rail links  handover  visible  ctl-absent  ctl-present
/ (index)                        20         1        1           0            1
/handover                        20         1        1           0            1
/statistics/service/East%20Metro     20         1        1           0            1

ROUTES MEASURED: 36
ROUTES WHERE HANDOVER WAS NOT EXACTLY ONE VISIBLE LINK, OR A CONTROL MISBEHAVED: 0
```

⚠️ **THE TWO CONTROLS ARE WHY THE RESULT MEANS ANYTHING, AND THEY RAN IN THE SAME DOM AT THE SAME
INSTANT AS THE MEASUREMENT** — not once at the start, on every route. `ctl-present` counts the
Delays link, which must be 1; `ctl-absent` counts a route that does not exist, which must be 0.
**Both held on all 36. A probe that scored 1 on both would be matching everything; one that scored
0 on both would be blind. Neither could have produced this table.**

Settle policy per Ward Lead: `networkidle`, then wait for the rail element, then 3s — **8s on the
community routes**, which is the route that needed it elsewhere today. Rail state was set through
the `ward-flow-rail` storage key before first paint, so the closed pass is genuinely the closed
rail and not a toggle animation caught mid-flight.

**So the warning and the finding are both true, and neither cancels the other: the old chrome
header's Handover link was retired, AND the new rail supplies one on every route. Nothing is
unreachable.**

⚠️ **What this does NOT establish:** that the rail entry is reachable by keyboard or announced
correctly to a screen reader. **`visible` here is geometry and computed style, not an accessibility
assertion** — a link can be visible and still be unreachable by keyboard. That belongs to the §U
sweep, not here.

## 7 · §4.17 Handover — in the shape §4.1–§4.16 use

- **Mockup** `handover-third-edition.html`: Handover sheet, filtered to one place at a time (network
  / health service / ward / emergency department / community team) and counted → the four groups
  Longest waits, Beds pulled, In transit, Placement gone wrong → Outside this filter → **Shift and
  sign off** (shift meter; What the sign off records; Notes for the incoming coordinator) → Print.
- **App today** `/handover` → `handover/handover-page.tsx` (729 lines): the same scope filter, the
  same named-filter and excluded-count sentences, the same four groups as top-level sections, the
  same Outside this filter, and printing already ruled on and tested. **Six test files.**
- **Tasks**
  1. Nest the four groups inside a counted **Handover sheet** container and adopt the drawing's
     wording; catcher: the existing `tests/ward-handover*` wording pins re-derived, never deleted,
     plus a heading-order assertion.
  2. Build **Shift and sign off** — the shift meter, the What-the-sign-off-records list, the
     `Sign off the handover` control **unwired, exactly as the drawing marks it**, and the Notes
     empty state in the drawing's own words; catcher: a DOM test asserting that empty state reads as
     the absence of a note and **not** as a quiet shift.
  3. Provenance marker for any figure this screen announces, **in every layer it is announced in**;
     catcher: §U2's marker form — ⚠️ **which does not exist yet and must not be drafted from §U2.**
- **Reads** `movements`, `units`, `now`; community team pages, emergency departments, sites;
  `clockState`.
- **Links** out: a movement, a patient, a ward; in: the rail (§6 — unverified).
- **Done when** Shift and sign off exists with its sign-off control visibly unwired, and the errata
  carries the §1.4 correction **in both places**.
- **Not built:** the sign-off is not wired and the drawing says so — **do not wire it.**

## 8 · Cost

**Smaller than any of the sixteen, and I am not converting that into hours.** The plan prices phases,
never screens, and an invented figure here would be quoted back later as a measurement.

**The comparison that carries the estimate:** four of the drawing's six Handover-specific sections
are already built, tested and ruled on. **One section is new.** Two of the three tasks are rewording
and re-nesting against test pins that already exist. That is materially less than any §4 screen, each
of which restructures panels the app names differently _and_ wires derivations that have no reader.

🔴 **The blocker is not the build. It is task 3** — the marker form does not exist, and §U2 says
explicitly that it needs its own brief and its own adversarial pass. **Handover cannot be called done
against a guard nobody has written.**
