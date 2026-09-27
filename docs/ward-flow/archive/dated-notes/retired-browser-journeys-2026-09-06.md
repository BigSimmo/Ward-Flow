# The ward browser journeys, 2026-09-06 — what was retired, what moved, and what was LOST

**Written BEFORE anything was changed.** Companion to
[`retired-coverage-record-2026-09-06.md`](retired-coverage-record-2026-09-06.md), which covers the
82 unit cases over the same eleven screens. ⚠️ **A retired test with no record of its subject is a
deletion wearing a softer word.**

## Why these were missed by that sweep

The 82 were vitest files matching `tests/ward-*`. **These are Playwright specs matching
`tests/ui-ward-*`, and no routine gate runs them**, so the eleven-screen retirement never saw them:

- `verify:ui` → `test:e2e:pr` selects projects `chromium` + `chromium-caring-contacts-seeded`, and
  **each independently sets `grepInvert: @mockup`**, while the command line inverts `@mockup` a third
  time. All ten ward specs are `@mockup`-tagged. The one project whose `grep` would collect them,
  `chromium-mockups`, is the one project `verify:ui` never asks for. **The exclusion is applied three
  separate ways, so widening any single filter would not have reached them.** (Measured by Ward
  Verifier from the config, every link opened.)
- `test:focused` selects by import graph and cannot reach a Playwright spec.
- The CI job `ui-ward-journeys` runs them, but is gated on `vars.WARD_JOURNEYS_BLOCKING == 'true'`
  **and on a pull request** — and Ward Flow is never pushed. The gate is deliberately disarmed until
  somebody has a green run in hand; that comment is in `ci.yml` beside the job.
- Bare `test:e2e` selects every project, and appears only in `verify:release` — provider-backed.

**Measured state before any change: 8 failed, 65 passed, 1 skipped.**

---

## RETIRED — the capability went with the screen

### `ui-ward-roles.spec.ts` › @mockup Live tracker

**1. "tracks every vehicle by leg and by how long since the last stamp"** (:227)
Visited `/mockups/ward-flow/transport`. Asserted `ward-live-tracker` visible; at least one
`ward-tracker-row-*`; and that **every row names its leg** (`Requested|Accepted|En route|Collected|
Arrived`) **and its age** (`ago|since`).

> **What survived:** the leg states, as a counted `WardBar` on Movements — Accepted / En route /
> Collected / Arrived / Cancelled, captioned _"N transport legs booked or moving"_.
> 🔴 **What did NOT: the per-vehicle age.** Movements shows how many vehicles are in each state,
> never how long any one of them has been there. **"How long since the last stamp" is not on any
> reachable screen.**

**2. "lists exactly the movements that carry a transport job, and states the rest explicitly"** (:253)
Asserted exactly **8** `ward-tracker-row-*` rows — pinned, never `> 0`, to catch a filter silently
widening or narrowing what counts as a vehicle — and `ward-tracker-governance` containing **"35 of
43"**.

> **What survived:** the 8, as the bar's caption count.
> 🔴 **What did NOT: the explicit statement of the excluded 35.** That was the screen's answer to the
> Global Constraint — an absence stated in words rather than left blank. Movements states what IS
> booked and says nothing about the movements that carry no transport job.

### `ui-ward-morning.spec.ts`

**3. "the morning page renders its headline, and the rail navigates away and back"** (:55)
Asserted `ward-morning-headline` visible, then exercised `ClinicalRail`'s real `<Link>`s —
deliberately never `page.goto()`, because a full navigation would remount `WardFlowProvider` and
reseed shared state, **making a client-side routing failure indistinguishable from a pass.**

> `/morning` redirects to `/capacity`. The headline and that rail instance are unreachable.

**4. "print states when the sheet was printed, and the real PDF is exactly one A4 page"** (:105)
Asserted `ward-morning-print-view-label` matching `/^This sheet: printed \d{2}:\d{2}\.$/`; that under
real `print` media the label and its note stay visible, the note reading _"a printed sheet is a
moment, not a monitor"_; and that the generated **PDF is exactly one A4 page** (`/Count 5` before).

> 🔴 **THIS IS THE REAL LOSS ON THIS PAGE, AND IT IS WORTH THE OWNER'S ATTENTION.**
> **Measured:** every ward print handle in the repository —`ward-morning-print`,
> `ward-morning-print-meta`, `ward-morning-print-view-label`, `ward-morning-print-view-note` — lives
> only in `morning/morning-page.tsx`, which no route reaches. **`capacity-screen.tsx` has no print
> handling at all and its stylesheet has zero `@media print` blocks.**
>
> **So the printable ward handover sheet is GONE, not moved** — and with it the owner's own 2026-08-30
> ruling that it must state the moment it was printed: _"a sheet with no time on it is the one nobody
> can tell is old."_ A ward handover that prints is an ordinary ward thing. **Nothing replaced it.**

---

## RE-POINTED, NOT RETIRED — the property outlived the screen

**`ui-ward-roles.spec.ts` › "retains its operating structure in dark, forced-colours, and print
modes"** (:269)

Asserted that in dark mode, forced-colours mode and print media, the screen's **operating structure**
stays present — deliberately making no claim about how anything looks.

⚠️ **Retiring this one would have dropped LIVE coverage of a LIVE screen.** The screen changed;
the property did not. Movements is reachable, is the screen that absorbed transport, and "still
works in dark, forced-colours and print" is exactly as true a requirement of it. **Re-pointed at
`/mockups/ward-flow/movements`, asserting the structure Movements actually exposes** rather than
re-typing the tracker's old handles.

**This is the distinction the whole exercise turns on:** a test whose SUBJECT was retired is
retired; a test whose PROPERTY survived onto the replacement is re-pointed. Retiring both is how a
consolidation quietly loses coverage of the screen it kept.

---

## FIXED — a rename — AND THEN IT TURNED OUT TO BE MORE THAN ONE

**`ui-ward-discharges.spec.ts`** (:92) looked for `ward-capacity-view`. The Capacity merge
`bf563af9f` (2026-09-05) renamed that root to **`ward-capacity-page`**. ⚠️ **The only remaining
`ward-capacity-view` string in `src/` is inside a COMMENT** naming the test file — a grep for a
filename finds its prose. **Fixed, and the fix worked: the journey got past it and failed further
along.**

### 🔴 The second failure is NOT a rename, and it is a question for the owner

The journey is _"a bed release's whole lifecycle reaches the coordinator live"_. It then reads the
coordinator's board expecting a per-unit group of **six** figures in fixed order —
**Ready · Held · Confirmed · Expected · Blocked · Occupied** — asserting the board moves
`1Expected` → `2Confirmed` → `0Expected` as a ward flags, confirms and blocks a release, **without a
reload.**

**Measured on the merged screen:** `ward-capacity-bed-states-*` exists **nowhere in `src/`** — only
in this test. `CapacityView` is gone; `ward-management-modes.tsx` mentions it only in a comment. The
new network table's columns are **Ward · Bed kinds · Ready · Locked · Freeing**, and a "Beds freeing
today" panel lists per-ward freeing counts.

> **So `Ready` survived, `Expected` survived in spirit as `Freeing` — and `Held`, `Confirmed`,
> `Blocked` and `Occupied` are no longer shown per unit at all.**

⚠️ **This is not a broken test. It is the test reporting that part of the journey it was written to
protect is no longer in the product.** A release's _stage_ — flagged, confirmed, blocked — reaches
the ward screen but no longer reaches the coordinator's capacity board.

**LEFT RED DELIBERATELY, and not weakened to green.** A red holding an unanswered question visible is
this repository's own stated preference over a quietly narrowed assertion, and only the owner can
settle it: **should a coordinator still see, on the capacity board, that a ward has confirmed or
blocked a release — or is the simplified board the intended design?** If the board is right as it
stands, the journey is re-pointed at Ready/Freeing and the rest recorded as a deliberate reduction.
**Nothing here should be decided by whoever next wants this suite green.**

## LEFT ALONE, deliberately

- **`ui-ward-management.spec.ts` (:71)** — `WARD_VIEWS gained a destination with no testid mapping:
delays`. **The guard is working correctly**: it derives from `WARD_VIEWS` and carries an
  anti-vacuity floor. Ward Builder Three is folding Delays into Movements on the owner's direct
  instruction, so the right mapping depends on a decision already being executed elsewhere. **Fixing
  it now would likely write coverage for a screen being removed.**
- **`ui-ward-management.spec.ts` (:230)** — the header brand at tablet width. Reported separately;
  not classified here, because from the outside an intended redesign and a real visual regression
  look identical, and this file records only what was measured.
