# What the 82 cases covered — the record, 2026-09-06

**Written BEFORE anything is retired, and it is the reason a retirement is recoverable.**
⚠️ **A retired test with no record of its subject is a deletion wearing a softer word.** Every
case below is reproduced in its own words — the `describe` and `it` text as the runner reports
it, not a paraphrase — so a revived screen can be re-covered from this file alone.

## The count, reconciled

**82 cases across 13 files**, read from vitest's own JSON reporter rather than counted
from source. ⚠️ **The figure in circulation was 79.** The difference is entirely
`ward-device-claim-reason.dom.test.tsx`, which the source count read as 5 and which runs 8.
Every other file matched its census row exactly. **79 + 3 = 82, and no file is in dispute.**

## ⚠️ The three `morning/` files are listed but NOT proposed for retirement

Re-measured against master `d50aa6c41` rather than taken from the earlier list: **`/morning` still
redirects to `/capacity`, and the only importer of `morning-page.tsx` anywhere in `src/` is
`morning-tour.tsx`, which is itself unreachable.** The reachability line has not moved. They are
excluded because Ward Builder Three holds those files, not because they are reachable.

## ⚠️ What this record rests on is a MEASUREMENT, and one has already gone stale here

**`DECLARED_UNREACHABLE` in `tests/ward-component-reachability.test.ts` is a list of measurements,
not a list of facts.** Ward Builder Three supplied the instance that proves it can decay:
`coordinator/flow-diagram.tsx` has no direct app-route reference and looked orphaned to one pass,
and is rendered by `CoordinatorScreen`, which has a route. **That verdict changed between one
session's measurement and the next.**

**Two things make this record safe against that, and both were checked rather than assumed:**

1. **The closure is transitive and reports `flow-diagram.tsx` as REACHABLE** — run as a positive
   control on the instrument, not on the tree. A scan that could not see that edge would declare live
   screens dead and its list would look exactly as tidy as this one.
2. **It follows type-only imports, which can only make the reachable set larger than the browser's.**
   So it can fail to notice an orphan; **it cannot invent one.** Everything retired below is
   unreachable under the stricter runtime rule as well. `morning-tour.tsx` reaches `morning-page.tsx`
   by exactly such a type-only import — no runtime edge at all — and both remain outside the
   closure.

**And the decay is what the guard's staleness assertion exists for**: if any of these becomes
reachable again, it reddens and names the declaration. **The measurement is allowed to go out of
date; what is not allowed is for it to go out of date quietly.**

**Proposed for retirement: 53 cases across 10 files. Held back: 29 across 3.**

---

## `ward-community-figures.dom.test.tsx` — 4 cases

**Renders `CommunityFigures`** — transitively dead — reached only from community-home

- CommunityFigures renders five tiles, with the label, value, unit and sub the fixture supplies -- not constants
- CommunityFigures carries `flagged` on exactly the two fixture tiles that ask for it, and no others
- CommunityFigures does not hardcode any figure -- a different fixture renders different values
- CommunityFigures refuses a fixture that flags a third tile, with WardFigureStrip's own message

---

## `ward-community-scope.dom.test.tsx` — 5 cases

**Renders `CommunityHome`** — /community renders CommunityIndex instead

- CommunityHome — the coordinator's scope switch defaults to the all-teams scope, with the All teams button pressed
- CommunityHome — the coordinator's scope switch switches scope when a team is chosen from the select
- CommunityHome — the coordinator's scope switch switches to the SAME team through the teams table's Open hub control -- one code path, asserted from both entry points
- CommunityHome — the coordinator's scope switch returns to the all-teams scope when the All teams button is pressed again
- CommunityHome — the coordinator's scope switch shows the all-teams table only in the all-teams scope, never in a single team's scope

---

## `ward-community-team-hub.dom.test.tsx` — 4 cases

**Renders `CommunityTeamHub`** — /community/[teamId] renders CommunityScreen instead

- CommunityTeamHub — the community role's own, restricted landing has a fixture that genuinely carries other destinations, so the absence assertions below are not vacuous
- CommunityTeamHub — the community role's own, restricted landing renders its own team's addressing, including a cancelled arm's own words
- CommunityTeamHub — the community role's own, restricted landing shows NOTHING about the referral's other destinations -- not a count, not a name, not the word 'elsewhere'
- CommunityTeamHub — the community role's own, restricted landing says plainly it does not name any other destination

---

## `ward-community-teams-table.dom.test.tsx` — 5 cases

**Renders `CommunityTeamsTable`** — transitively dead — reached only from community-home

- CommunityTeamsTable renders exactly one row per team the catchment source names -- comfortably more than a collapse could produce
- CommunityTeamsTable names the real teams from the catchment module -- a divergence here fails
- CommunityTeamsTable calls onOpenTeam with the row's own team id when its Open hub control is used
- CommunityTeamsTable renders an idle team as a worded state, "none", not a nought
- CommunityTeamsTable still renders a real digit for a team that does have somebody waiting

---

## `ward-device-claim-reason.dom.test.tsx` — 8 cases

**Renders `EscalationBoardPage`** — /escalation redirects to /delays

- a board's stated reason for not being a medical device walks both boards, or the loop below asserts nothing
- a board's stated reason for not being a medical device escalation board: still claims not to be a medical device
- a board's stated reason for not being a medical device escalation board: gives a reason that survives the software ranking
- a board's stated reason for not being a medical device escalation board: does not promise the software will never rank or suggest
- a board's stated reason for not being a medical device referral board: still claims not to be a medical device
- a board's stated reason for not being a medical device referral board: gives a reason that survives the software ranking
- a board's stated reason for not being a medical device referral board: does not promise the software will never rank or suggest
- a board's stated reason for not being a medical device the withdrawn promise appears on no ward surface at all

---

## `ward-ed-home.dom.test.tsx` — 12 cases

**Renders `EdHome`** — /ed/[edId] renders EdScreen instead

- EdHome renders its own landmarks: one h1 and one main, since the shell renders neither
- EdHome states there are eight real emergency departments, taken from the ED collection itself
- EdHome the model-limit note says plainly that these figures are counted from movements and referrals, not from the department's own record
- EdHome the totals strip renders five tiles, exactly two flagged
- EdHome the totals strip renders the real waiting, detained and longest-wait figures computed from the seed
- EdHome the two colliding 'N of M' tiles, disambiguated names the population on every 'of N' figure — never a bare 'of N'
- EdHome the two colliding 'N of M' tiles, disambiguated the departments tile says departments and the hero's says patients — different populations, stated
- EdHome the population is stated in words on every panel that carries a count states it on the totals section, the hero panel and every service-band panel
- EdHome this screen never claims anyone is or is not being looked for renders no 'declined by every ward' or 'nobody looking' text anywhere on the page
- EdHome the hero names the worst department computed from the seed, with five figures and no flags
- EdHome the hero links to that department's own hub
- EdHome every real emergency department appears exactly once, across the hero and the bands matches ward-sites.ts's own eight departments, not a hospital walk

---

## `ward-ed-service-bands.dom.test.tsx` — 5 cases

**Renders `EdServiceBands`** — reached only from ed-home

- EdServiceBands renders exactly three bands: East Metro, North Metro, South Metro
- EdServiceBands carries the note that a department shown as the hero is shown above, on whichever band it belongs to
- EdServiceBands states the population — patients physically present — on every band panel
- EdServiceBands names every real emergency department exactly once, across the hero and the three bands combined
- EdServiceBands links each row to that department's own hub

---

## `ward-escalation.dom.test.tsx` — 6 cases

**Renders `EscalationBoardPage`** — /escalation redirects to /delays

- EscalationBoardPage renders the root and both sections, in order
- EscalationBoardPage shows the real fixture's non-empty sections as tables, not the empty note, and names the measured movements
- EscalationBoardPage never renders a near-miss or ranking word anywhere on the page — it records and shows, it suggests nothing
- EscalationBoardPage stays live: the wait column advances when the shared clock advances
- EscalationBoardPage renders the explicit empty note for both sections, given an empty board escalated
- EscalationBoardPage renders the explicit empty note for both sections, given an empty board nowhere eligible

---

## `ward-morning-page.dom.test.tsx` — 20 cases — ⚠️ HELD BACK

**Renders `MorningPage, MorningBody`** — MERGE 02 — /morning redirects to /capacity

- MorningPage renders the governance banner, the headline and the remaining four figures for the real fixture after 08:00
- MorningPage renders the headline as availableNow alone, never mixing in confirmedToday, expectedToday or leaveUsable
- MorningPage renders the people-waiting figure beside the headline, from the same count the referral board uses
- MorningPage never hardcodes the people-waiting label in the page source — it is read from PEOPLE_WAITING_LABEL
- MorningPage renders every figure label from the one definition, so a model change is three strings
- MorningPage never hardcodes a figure-label literal in the page source — every label is read from CAPACITY_FIGURE_LABELS
- MorningPage reads 'Never confirmed' for a rollup with nothing confirmed, never a bare 0
- MorningPage states a partial rollup in words: N of M wards confirmed, and how many never confirmed
- MorningPage states a fully-confirmed rollup without a spurious 'never confirmed' clause
- MorningPage renders a site with no units as 'No units recorded', never omitting the site itself
- MorningPage suppresses the site-level figure grid for a no-unit site, but not for a site with units
- MorningPage renders the service-level freshness's oldest-confirmed instant next to the existing count, via the shared WardFreshness wording
- MorningPage carries WB-DB-10's dated change notice, saying by what RULE the figures moved
- MorningPage stamps the printed sheet with the moment it was printed, which is the only claim a sheet can keep
- MorningPage states the number of beds excluded beyond tonight from the real MorningBody call site, and keeps stating it even when the count is zero
- MorningPage states how many units could not be placed under a hospital, and renders nothing when there are none
- MorningPage carries a print control and a one-line cross-link naming the question each page answers
- MorningPage renders no duplicate data-testid on the page — every figure id carries its service/site/unit level
- MorningPage renders every hospital's figures as the sum of its own wards' figures — never a network total or one ward's alone
- MorningPage renders each ward row from its own breakdown, computed for that ward alone, not its hospital's rolled-up total

---

## `ward-morning-tour-paused.dom.test.tsx` — 2 cases — ⚠️ HELD BACK

**Renders `MorningPage`** — MERGE 02 — /morning redirects to /capacity

- the guided tour is paused mounts no tour on the morning page
- the guided tour is paused renders no tour control of any kind, which is the assertion that actually bites

---

## `ward-morning-tour.dom.test.tsx` — 7 cases — ⚠️ HELD BACK

**Renders `MorningTour`** — reached only from morning-page

- MorningTour dispatches every beat under exactly the role EVENT_ROLE permits (controller ruling R4)
- MorningTour begins with RESET_SCENARIO stated on screen, switches to the live view, and advances through all five beats before resetting back to idle
- MorningTour Stop halts at the current beat and does not advance further
- MorningTour under prefers-reduced-motion: reduce, the tour does not auto-advance and a Next control drives every beat instead
- MorningTour a refused dispatch surfaces as the existing Rejection and the tour stops at that beat rather than skipping ahead
- MorningTour resets the shared scenario on unmount while mid-run, but not when unmounted from idle (Finding 1)
- MorningTour every beat's caption states plainly that its figures are invented, and beats 1-3 describe what actually happened (Finding 4)

---

## `ward-statistics-primitives.dom.test.tsx` — 2 cases

**Renders `StatFootnote`** — referenced by nothing in src/ at all

- StatFootnote renders every group's heading and every one of its items
- StatFootnote keeps each group's items under its own heading, not merged across groups

---

## `ward-tracker-leg-badge.dom.test.tsx` — 2 cases

**Renders `LiveTracker`** — /transport redirects to /movements

- live tracker leg badges gives the in-vehicle leg a different treatment from a leg before collection
- live tracker leg badges keys the badge treatment to the leg, not to the individual row
