# Bed board and Search hub, rendered — settling Ward Builder Four's static candidates

**Ward Verifier, 2026-09-11 evening.** Four stated its own limit first and it is the reason this
exists: _"Static reads only… 'co-mount unconditionally in source' — never 'no contradiction on this
screen'. A conditionally-mounted sibling is invisible to me."_ **This is the render.**

⚠️ **I form no view on fixes, and I have surveyed nothing beyond these two screens.**

---

## 1 · SEARCH HUB — Four's verdict HOLDS under render

The screen makes a universal claim about itself. Rendered verbatim:

> **"The 10 community team names are invented too: each is labelled “(placeholder)” every time it
> appears, and no real team has agreed to be named this way."**

**Measured, in both rail states:**

    marker occurrences on the page        11
    distinct names carrying the marker    10
    marked names rendered ANYWHERE bare    0        <- the whole question
    marker hidden by text-overflow         0

**The eleventh marker occurrence is the claim sentence quoting itself.** 11 − 1 = 10, and the claim
says 10. **The count reconciles against the screen's own number.**

The ten, read out of the DOM rather than assumed:

    Perth Metropolitan · Peel · South West · Great Southern · Wheatbelt ·
    Goldfields-Esperance · Mid West · Gascoyne · Pilbara · Kimberley
    — each "… Community Mental Health Team (placeholder)"

✅ **Four proved the suffix is never stripped at the source. The render adds what a static read could
not: nothing downstream drops it, on any surface, in either rail state.** The marker survives because
it is **part of the name string**, not a separate disclosure that can drift — which is the
transferable half of Four's finding and it is confirmed.

### 🔴 A FALSE POSITIVE OF MINE, CAUGHT ONLY BY READING THE HITS

**My first pass reported FOURTEEN team names rendering without the marker** — Albany, Armadale,
Bentley, Bunbury, Gascoyne, Great South, Great Southern, Joondalup, Kimberley, Midland, Peel,
Pilbara, Rockingham, Subiaco.

**Every one was wrong.** I had taken the 64 community-team names from the statistics comparison table
and searched the hub's text for each. But those short names — _Peel_, _Midland_, _Albany_,
_Rockingham_ — are also the names of **hospitals and health services**, which the hub's own banner
says are **real**: _"the wards, hospitals, emergency departments and health services are the real
network this prototype models."_ **The hits were real hospitals correctly rendered without an
invented-data marker.**

> 🔴 **My probe answered "does this short string appear unmarked", and I read it as "does a community
> team name appear unmarked". A neighbouring question, fluently answered, and it would have accused
> a correct screen of the exact defect it had already closed.**

**What caught it was capturing the surrounding text of every hit instead of reporting the count.**
The corrected probe matches the **full** marked name and asks whether _that_ string ever appears
bare. It does not — `sameNameRenderedBare` is empty.

⚠️ **The first version had a control and the control PASSED** — an invented string was absent, a real
one present. **The control proved the probe could tell present from absent. It could not tell me the
probe was measuring the wrong population**, and no control of that shape ever could.

## 2 · BED BOARD — no ordinal reaches a person by any explicit route. One structural exception.

⚠️ **MY FIRST ATTEMPT MEASURED NOTHING AND ITS OWN CONTROL CAUGHT THAT.** I used unit id
`u-rph-adult-acute`, which **returns HTTP 200 and renders no board.** `tilesFound: 0`,
`ctlPresent: false`. **A 200 from a bad id is this repository's "answers instead of erroring" trap in
a URL.** Re-run against `rph-adult-secure`, which renders 42 tiles.

**Measured on the rendered page, 42 tiles:**

    aria-posinset   0        aria-setsize   0        aria-rowindex  0
    aria-colindex   0        aria-level     0
    visible "Bed <n>" anywhere on the page:   none
    tile sr-only content:                     "1–3 months"   (a stay band)
    tile accessible text:                     "34 DAYS 1–3 months PAST DATE"

✅ **No explicit position semantics, no visible bed number, and the one screen-reader-only string on a
tile is a stay band — a category, never an ordinal.** That independently confirms what Lane B
measured in source, by a different instrument: a live DOM rather than a search.

### 🔴 THE ONE THING A RENDER ADDS, AND IT IS THE WHOLE POINT OF RENDERING

**The tiles are emitted into `<ol data-testid="ward-board-beds">` — an ORDERED list.**

**A native `<ol>` carries implicit position semantics.** Explicit `aria-posinset` is not required for
a screen reader to offer "item 3 of 42" — the list element supplies it. And the component's own rule,
at `ward-board.tsx:673`, says:

> _"nothing here may number a tile, call it 'Bed 7', or let the grid read as a floor plan — **the
> order is seed order**."_
> _"…so **nothing in this component ever has an ordinal to print**."_

⚠️ **So the component states it has no ordinal, and emits markup from which one is derivable, over an
order it says is arbitrary.** That is §U's shape: a stated absence, and a sibling surface that can
make a positive claim about the same subject — here the surface is the element itself.

🔴 **WHAT I HAVE NOT ESTABLISHED, AND IT IS THE DECIDING FACT.** I measured the **markup**. I did not
measure what a screen reader **announces** — I have no screen reader here, and Playwright's
accessibility snapshot is unavailable in this version (`page.accessibility` is undefined at
Playwright 1.62.1, which is why my first script errored rather than quietly returning nothing).

**So: `<ol>` is established. "Announces a position" is NOT.** Treat this as a candidate that needs an
actual assistive-technology check, not as a finding. **It is exactly the distinction Four drew about
its own work, and it applies to mine.**

## 3 · What neither of us has settled

- Whether an `<ol>` here is wrong at all. **A bed list may legitimately be ordered.** The tension is
  with the component's own written rule, not with any ruling I hold — **and nobody has asked the
  owner.**
- Anything about keyboard reach on either screen.
- Anything outside these two screens.

---

## 4 · Added after the first commit — the two questions a source read could not answer

A second agent (**Sonnet, extraction**) traced the hub's name-rendering surfaces and ended with an
explicit _"what I could not determine by reading"_: the name rows carry `text-overflow: ellipsis`, so
**whether a sighted reader ever sees the name with `(placeholder)` clipped off the end depends on
rendered pixel width, which source cannot give.** It also found **two surfaces with no community-team
test coverage at all** — the pinned list and the recently-opened list, whose existing tests use ward
fixtures only.

**Both are now rendered.**

### Truncation — seven viewport widths, 390px to 1440px

    width   marker-bearing elements   overflowing   marker visually cut   control
      390            11                    0                0             detected
      480            11                    0                0             detected
      640            11                    0                0             detected
      768            11                    0                0             detected
      900            11                    0                0             detected
     1100            11                    0                0             detected
     1440            11                    0                0             detected

⚠️ **THE CONTROL IS THE COLUMN THAT MAKES THE ZEROS MEAN ANYTHING.** At each width the probe squeezed
one marker-bearing element to `max-width: 60px` with `text-overflow: ellipsis` and re-measured.
**It detected the clip every time, then restored the style.** So the probe demonstrably sees clipping
and its seven zeros are information rather than silence.

**The marker is never visually clipped at any tested width.**

### The interaction-only surfaces

    BEFORE            11 marker-bearing leaf elements   (10 rows + the claim sentence)
    after PIN         12                                 (+1: the pinned entry, marker intact)
    after OPEN        12                                 (detail panel replaces the glance pane)
    new after interaction: hub-module__…__detailTitle — "Kimberley … Team (placeholder)"

🔴 **Bare occurrences of that team name, at every step: ZERO.** The check scanned the whole page text
each time, so it covers whichever pane was showing.

**Confirmed carrying the marker: the result row, the pinned entry, and the detail heading.**
⚠️ **NOT independently isolated: the recently-opened list** — opening an entry switched the
right-hand pane to the detail panel, so that surface never rendered alongside. **The zero-bare result
covers it in aggregate; it is not a positive confirmation of that surface specifically.**

### So the hub is safe by CONSTRUCTION, not by vigilance

The agent's decisive find: **there is no "append the suffix" function.** The marker is baked into the
ten string literals in `ward-teams.ts:28–38`. Every surface reads the same field of the same entry
object — the pinned/recent lookup maps id → **entry**, not id → name, so it carries the suffixed
string forward rather than re-deriving it.

🔴 **That is why Four's hunt came back empty, and it is the transferable rule: the hub holds the
figure and its provenance in ONE string. Nothing can drift out of step with it because there is no
second thing to drift.**
