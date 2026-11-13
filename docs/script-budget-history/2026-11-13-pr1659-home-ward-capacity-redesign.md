# 13 Nov 2026, Home, Ward and Capacity redesign (PR #1659, wave 4, D-191)

Measured with a local `npm run build` and `scripts/check-script-budget.mjs`. Each new limit is the
largest local measurement over three builds plus 0.2. Every rise is under the 5 KB allowance.

Raised:

- Coordinator `/ward-flow`: 585.2 to 589.9 (measured 589.5 to 589.7). Act now's Pull the bed rows
  are new first-screen content: the Pull the bed step's hook and toast (3.3 KB raw), the kept pulled
  row with its Undo (2.8), the shared command-completion helper (2.3), the phone row (1.8) and the
  pull facts (1.4). The sheet itself already loads on first open. The kept row was not made lazy:
  focus after a pull looks for it, so a late row would move focus somewhere else.
- Ward `/ward-flow/ward/rph-adult-secure`: 618.2 to 622.3 (measured 621.6 to 622.1). Coming and
  going (7.4 KB raw plus 3.9 of row logic), the bed squares (4.1) and the decline reasons as kit rows
  (2.0) are new page content; the old Today tab and home section they replace gave back about 21 KB
  raw.
- Referrals `/ward-flow/referrals`: 589.9 to 590.1 (measured 589.4 to 589.9). No new code reaches
  this page. Webpack regroups shared chunks between builds; one build of this PR copied the
  `next/dynamic` runtime and ten icons (about 7 KB raw) into the Referrals chunk as well as the shared
  one. The 0.2 is margin for that.
- ED board `/ward-flow/ed/arm-ed`: 677.9 to 678.5 and Bed meeting `/ward-flow/bed-meeting`: 596.3 to
  596.6 (measured up to 678.3 and 596.4). No new code; the new on-open chunks below add entries to
  the webpack runtime's chunk map, and builds vary by about 0.3.

Lowered:

- Capacity `/ward-flow/capacity`: 662.4 to 617.9 (measured 617.4, before trims 665.8).

What was trimmed first: wave 4 moved the forecast chart behind the Forecast card's Open and Planned
moves onto their own tab, which always starts closed, so both now load on first open
(`BedForecast` through `capacity-open-parts.ts`, `ComingIn` on its own). The "What would help
tomorrow" helpers moved to `capacity-forecast-help.ts` so the Forecast card no longer pulls the chart
in. The Ward page's pull step bed choice (`ward-pull-bed-choice-sheet.tsx`) loads when Confirm
arrival opens it. Capacity dropped about 48 KB; Ward about 1.5 KB.

## Trim after the review fixes (13 Nov 2026, evening)

The review fixes put Home at 591.0 KB, over its limit. Unused class names were removed from Home's and the
referral board's style modules (`coordinator/home.module.css`, `home-cards.module.css`, `referrals/referrals.module.css`,
`referral-board.module.css`, `referral-panel.module.css`); each name was checked as read nowhere in `src`, and the
two shortlist rules the overlay test guards were kept. Every class name a module exports ships in the page script,
so this shrinks first loads without changing any screen. Measured on a local production build: Home 589.4,
Referrals 588.0, Ward 621.5, Capacity 616.2, ED arm 676.9, Bed meeting 594.6, Statistics 636.0. No budget changes.
A first attempt that lazy-loaded Home's pinned card moved shared code into Referrals and Statistics (+2 KB each)
and was dropped.
