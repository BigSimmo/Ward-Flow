# The Thresholds table on Settings — wrong in both directions

**For the owner. Written 2026-09-12 by Lane D. Measured on `f9285a03d3`, which carries the line at
`485a66455d`.**

---

## The short version

The Settings drawing has a table headed **Thresholds**, and its stated purpose is good:

> Every number in this prototype that turns a screen amber or red **without saying so on the screen
> itself**, with what it triggers and where it lives.

**That is exactly the right thing to publish.** A number that quietly changes a colour, and that
nobody chose, is the sort of thing that ends up treated as a standard.

**But the table as drawn is wrong in both directions, and I have not built it.**

- **Two of its three rows describe thresholds the working app does not have.** They exist in the
  drawings only.
- **The app has one such threshold the table does not list** — and it is currently invisible, which
  is a different problem needing a different answer.

---

## Row by row, measured

### Row 3 — the only one that is real

**1,440 minutes (24 hours) in an emergency department.** Real, built, and yours: you set it on
22 August 2026, replacing an earlier four-hour figure from the spec, and it is recorded as a
departmental performance measure and never a Mental Health Act deadline. It lives in one named
constant, cited correctly by the drawing.

**Buildable exactly as drawn. Nothing to decide.**

### Row 1 — 200 minutes: **UNBUILT**

The drawing says a 200-minute longest wait turns a department's card amber on the Command screen and
on the statewide map, and says the number lives in `command-third-edition.html` — **which is a
drawing, not the app.**

**Measured in the running app: no such comparison exists anywhere.** The longest wait is carried and
displayed, and nothing compares it to 200 or to any other number.

⚠️ **The cards really do turn amber — on something else entirely.** They tint when a patient's legal
form deadline has already passed. That is a different fact about a different thing, and a reader who
took the table at its word would believe the colour meant a long wait.

### Row 2 — 120 minutes: **UNBUILT**

The drawing says a 120-minute oldest referral puts an amber dot beside Referrals in the sidebar, and
again says it lives in a drawing file.

**Measured: the sidebar has no referrals figure at all.** Its urgency marks come from two other
places — how many delays need attention now, and how many discharges are blocked today. **There is no
referral age anywhere in it.**

---

## The one the table misses, and it is the more interesting half

**The app has exactly the kind of number this table exists to publish, and the drawing does not list
it:** the amber tint on a department's card when somebody's legal form deadline has passed.

🔴 **And it is currently impossible to see.** The code's own note says so: after your correction of
23 August — that neither a Form 1A nor a Form 3B carries a deadline any more — only the transport and
transfer forms do, and **none of those is overdue in today's invented data**. So the count is always
nought and the amber never appears.

**That is a third state, and it needs naming because the first two look identical to it on screen:**

    UNBUILT       the app has no such threshold. Rows 1 and 2.
    UNREACHABLE   the threshold exists and works, and no data can currently reach it.
                  The legal-form tint.
    LIVE          the threshold exists and fires. Row 3, the 24-hour target.

⚠️ **Unbuilt and unreachable look the same to anyone using the app — nothing is ever amber — and they
need opposite fixes.** One needs a decision about whether the number should exist at all. The other
needs either a piece of invented data that reaches it, or an acceptance that a working safeguard is
untested by anything anybody can see.

---

## What we would like from you

**Three small decisions, and none of them is urgent.**

**1. Should the two missing thresholds exist?** A department's card turning amber on a long wait, and
a sidebar mark on an old referral, are both reasonable things for a coordinator to want. **They do not
exist today.** If you want them, they are new behaviour and each needs a number you choose — and the
drawing's own note on both says _"No owner recorded. Nobody has approved this figure or written down
why 200 minutes rather than any other number."_ That note is honest and it is the reason to ask.

**2. Should the table publish the legal-form tint?** It is the only threshold of this shape the app
actually has. Leaving it out while listing two that do not exist would make a truthful-looking table
the least accurate thing on the screen.

**3. Should the table say which state each row is in?** Our recommendation: yes — one extra column
saying whether a threshold is live, or exists but nothing currently reaches it. Without it, a reader
who never sees amber cannot tell a working safeguard from an absent one.

**Nothing is blocked.** The panel is simply not built, and the rest of the Settings screen works
without it.

---

## For whoever implements this

Anchors measured on `f9285a03d3`; cited by symbol, because line numbers differ in every tree.

- **Live:** `ED_ACCESS_TARGET_MINUTES` in `ward-model.ts`. Read on the emergency-department screen
  against how long a patient has been there.
- **Unreachable:** `edPressure` (`ward-pressure.ts`) computes `breaching` by filtering open movements
  whose `legalForm.dueAt` has a `clockState` of `"breached"`. `pressure-strip.tsx` renders it as
  `data-breaching`, and `coordinator.module.css` tints `.pressureCard:not([data-breaching="0"])`.
  **The derivation's own comment records that it evaluates to 0 on today's fixture** — the state is
  reachable in principle and unreachable in practice.
- **Unbuilt, row 1:** `EdPressure.longestWaitMinutes` exists and is displayed; **no comparison
  against any constant exists.** Searched by behaviour (tone, amber, warn) and by value across the
  coordinator screen, the pressure strip and the flow diagram.
- **Unbuilt, row 2:** `WardNavCount` carries `value`, `noun` and `urgent`. `wardNavCounts` sets
  `urgent` from `severe > 0` (delays) and `blockedToday > 0`. **There is no referrals entry and no
  age anywhere in it.**
- ⚠️ **Do not resolve this by searching for `200` or `120`.** Both appear in the seed as ordinary
  offsets (`NOW_ANCHOR - 200`) and in unrelated constants (`CHART_BUCKET_MINUTES`,
  `staleAfterMinutes`), and a search by value finds those and concludes the thresholds exist. **The
  question is answered by searching for the BEHAVIOUR the drawing describes, not for its number.**
