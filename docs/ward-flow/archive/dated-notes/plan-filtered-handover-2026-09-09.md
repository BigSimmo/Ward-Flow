# A handover you can generate for any scope, at any moment

**Plan, Ward Lead, 2026-09-09, at the owner's request.** Third edition design system. This is a plan,
not a build. **One owner ruling is required before the first line is written — section 3.**

---

## 1. What exists today

`/mockups/ward-flow/handover` renders **Shift handover**: four sections in an owner-approved order —
Longest waits, Beds pulled, In transit, Placement gone wrong — one Print button, and nothing else.
Page height 2585px at 1400px wide. **There is no filter and no scope of any kind.** It is the whole
network or nothing.

Two properties are already owner rulings and this plan keeps both:

- 🔴 **It reads LIVE** (OD-4, 2026-08-30). It used to freeze its figures at mount and that was
  deliberately reversed. The owner's words: _"There is no point of a stale handover."_ The reasoning
  in the file is worth preserving — **the paper is what holds still**, and it does so honestly with a
  full date on it, while a frozen screen beside a live printed sheet is two numbers for one thing in
  one room.
- **Every section prints an explicit "None" line rather than disappearing.** An absence is a fact
  worth handing over.

---

## 2. What is being asked for

A handover that can be **generated for a chosen scope, at any time, live** — so a coordinator can hand
over one ward, one site, one service or one emergency department without reading out the network.

---

## 3. ✅ RULED, 2026-09-09 — the handover filter EXCLUDES, and the chip rule does not govern this page

**This request collided head-on with a standing owner ruling. The owner has now ruled, and the
collision is settled.** Full record: [`owner-decisions-2026-09-09.md`](owner-decisions-2026-09-09.md).

His words: _"Update the rule.... I want the handover to be a page that is completely filterable... It
is filtered rapidly based on Service, Ward, ED, Community, etc. Fully filterable which is compact and
dynamic and filters to show a clear handover list for me."_

⚠️ **The change is scoped to the handover page ONLY.** Capacity, Delays and the bed board keep the
chip rule unchanged — he was asked about handover and answered about handover, and hiding a patient
on a working board is the harm that rule exists to prevent. Do not widen it from this plan.

> **"A CHIP HIGHLIGHTS. IT NEVER HIDES"** — owner ruling, recorded in `capacity-screen.tsx`,
> `capacity.module.css`, `ward-board.tsx` and extended to `delays-screen.tsx` on 2026-09-07. A filter
> that empties a group is wrong; the header carries two figures instead.

That rule is right for a working screen, where hiding a patient is how somebody gets missed. **It is
wrong for a handover sheet**, where the entire purpose of choosing "Bentley Adult Acute" is that the
other twenty-two wards are not read out.

**The three conditions below are part of the ruling, not a recommendation.** They carry forward what
the chip rule was protecting:

1. **The scope is named on the sheet and on the screen, always** — "Shift handover · Bentley Adult
   Acute · 14 of 61 open movements". Never a sheet that looks like the whole network but is not.
2. **The excluded count is stated, never silent.** "47 open movements are outside this scope" is a
   line on the sheet. A reader must be able to tell a quiet ward from a narrowed view.
3. **Anything urgent outside the scope is still named.** A breached legal deadline elsewhere in the
   network appears as a one-line "outside this scope" note. **A scoped handover must never be the
   reason a breach went unsaid.**

**The build may now start.**

---

## 4. The design

### 4.1 The scope selector

One control, in the bar, above the four sections. Third edition: a disclosure, not a row of chips —
one loud thing per screen, and the sections are the loud thing.

**Scopes, all verified against `Unit` on the live model:**

| Scope              | Backed by                                      | Status                                                                      |
| ------------------ | ---------------------------------------------- | --------------------------------------------------------------------------- |
| Whole network      | the default today                              | **verified**                                                                |
| One site           | `Unit.siteCode`                                | **verified**                                                                |
| One ward           | `Unit.id`                                      | **verified**                                                                |
| One emergency dept | `ward-sites.ts` / `edById`                     | **verified**                                                                |
| One health service | `ward-sites.ts` — every site carries `service` | **verified 2026-09-09** — East Metro, North Metro, South Metro and the rest |
| One community team | `communityTeamById`                            | **verified 2026-09-09** — named by the owner as a required filter           |
| Cohort             | `Unit.cohort`                                  | verified, but probably not a handover unit                                  |

**All four dimensions the owner named — Service, Ward, ED, Community — are verified present.** None
needs inventing, which is the outcome to want: the Command drawing invented a catchment rule this week
and it took an audit to find.

⚠️ **`ward-place.ts` already resolves a place id against `units` / `edById` / `communityTeamById`.**
Use that resolver. A place lookup written a second time is how two screens come to disagree about
what a place is.

**Do not add a fifth dimension the data cannot join**, whatever a drawing shows.

### 4.2 What stays exactly as it is

- The four sections and their order. They are owner-approved; a scope changes the population, never
  the shape.
- The live read. **Do not reintroduce a freeze** — that reopens OD-4.
- The explicit "None" line per section, which becomes more important under a scope, not less: "None
  in this scope" and "None anywhere" are different facts and must read differently.
- Print as the stabiliser, with the full date and now also the scope.

### 4.3 What the sheet gains

- A **header line**: scope, moment in full, and the two counts — in scope and excluded.
- An **"outside this scope" footer** carrying anything breached or legally urgent elsewhere.
- The existing governance banner, unchanged.

---

## 5. What must NOT be added — the honesty floor

These are already ruled and a handover screen is exactly where they get quietly broken:

- **No diagnosis, medication, risk score, progress note or observation.** None exist and each was
  refused deliberately.
- **No next of kin, carer, phone, email or emergency contact.**
- **Nothing derived from the free-text presentation reason** — no risk, no urgency, no summary.
- **Medical clearance has three states.** Absent means nobody looked, not "refused".
- **No verdict about a person.** Verdicts are about wards, beds, checks and movements.
- **A ward may not see where else a patient has been referred; the coordinator may.** If a scoped
  handover is ever given to a ward, that withholding must be STATED, never a silent blank — a ward
  shown an empty referrals section cannot tell "there are none" from "you may not see them".

---

## 6. Build order

1. ~~Get the ruling in section 3.~~ **Ruled 2026-09-09. Cleared.**
2. ~~Confirm the service join.~~ **Verified 2026-09-09, along with Community. Cleared.**
3. ~~Scope selector + population filter, whole-network default unchanged.~~ **DONE 2026-09-09**,
   folded at `57d7a3f86c`. The `"network"` case returns `true` unconditionally, so the default
   population is provably today's; mutating it to `false` reddened two tests.
4. ~~Header counts and the excluded count.~~ **DONE.** Verified live by Ward Lead on the running app:
   _"Shift handover · Royal Perth Hospital Emergency Department · 4 of 43 open movements"_ and
   _"39 open movements are outside this filter."_ — and 4 + 39 = 43 reconciles. Mutating the excluded
   count to a constant 0 reddened its own test.
5. ~~The "outside this scope" urgent footer.~~ **DONE, and it is the one that was mutation-proved by
   Ward Lead rather than taken from the builder.** Forcing the function to return `[]` — a handover
   silently claiming nothing urgent sits outside the filter — reddened three tests at three levels:
   a constructed fixture, the real fixture (WF-018), and the rendered page. Verified live: WF-018,
   flagged urgent at SCGH, is named on an RPH-filtered sheet.
6. ~~Phone.~~ **DONE.** Measured at 375px: no horizontal overflow (375 = 375), and the filter control
   and Print button are both exactly 48px tall.

7. ~~**PRINT.**~~ **CLOSED 2026-09-09 by Ward Lead, against the running app, with a working positive control.** See the verification block below.
   The builder was explicit that they verified the print CSS _source_ by text-scan, the convention
   this file already used, and **could not render in print mode** — labelled ASSUMED, not verified.
   ⚠️ **This step's own warning is that the print stylesheet is where scope headers get lost**, so a
   source scan is exactly the check that cannot see the failure: the filter name and the excluded
   count could be absent from the printed sheet while every test passes. **Verify on paper, or in a
   real print preview — not by reading the CSS.**

   **WHAT WAS RUN.** All five stylesheets walked (0 blocked), 50 `@media print` style rules
   collected, and each element tested against every print rule carrying `display:none` /
   `visibility:hidden` — by `matches()` AND `closest()`, so a hidden ANCESTOR counts. With the
   Royal Perth ED filter applied:

       CONTROL — the filter <select>, which MUST be hidden   ->  hidden by [data-print-hide], header
       "Shift handover · Royal Perth Hospital Emergency
        Department · 4 of 43 open movements"                 ->  NOT hidden
       "39 open movements are outside this filter."          ->  NOT hidden
       "Outside this filter" heading                         ->  NOT hidden
       "WF-018 — flagged urgent — Sir Charles Gairdner ..."  ->  NOT hidden

   🔴 **THE CONTROL IS THE POINT.** A probe that reports "nothing is hidden" is worthless unless it
   can report the opposite, and this one caught the dropdown. Without that line the four NOT-hidden
   results would be indistinguishable from a walk that matched nothing at all.

   ⚠️ **WHAT THIS DOES NOT COVER, STATED SO IT IS NOT READ WIDER THAN IT IS.** This proves no print
   rule HIDES the three owner conditions. It is not a rendered print preview, so page breaks, colour
   loss and content clipped by print margins remain unverified. **The risk this step named — "the
   print stylesheet is where scope headers get lost" — is closed; the rest of print is untested.**

   ✅ **OWNER TRIGGER, 2026-09-09.** Josh deferred the statistics work — _"drop the statistics work
   for now"_ — and, asked when to revisit, said **"remind me after the handover page is finished."**
   **This step was what "finished" meant, and it is now closed — so the handover page is complete and the statistics deferral is DUE to be raised with him.** Recorded here rather than in a chat because a
   deferral conditioned on nothing has nobody to un-defer it, and "finished" is untestable until it
   names a step.

## 7. How it must be proved

- **A test that the default scope changes nothing** — the whole-network sheet today and after must
  match.
- **A test that a breach outside the scope still appears.** Construct it; do not hope for one in the
  fixture. This is the test that matters.
- **One mutation per assertion**, and read which message came back. Two assertions in one test means
  the first failure stops the run and the second never executes, while the file goes red and reads as
  proof of both.
- **Do not accept a green on a skipped file.** Check the run reports executed cases, not just files.
