# Spacing review, 2 Nov 2026

Main at 1212a0d7 (#1279), rendered locally from synthetic demo data, compared with the master artifact at 390, 820, 1280 and 1440, light and dark. Group headings on Home and Alerts are left to the ALERTS thread; phone tab bars and 40px controls to "Fix phone tabs, sizes and names". Q224 to Q230 are not repeated.

## Batch 1: Ward, Legal forms, Add a patient, Patient (Q232 to Q235 yes, built in #1283)

Ward and Add a patient match the master at every width, light and dark (16px gutters, same card padding). No vanishing dividers in dark.

Q232. Legal forms desktop rows are 44px, not the master's 56px, so three-line rows touch their dividers (1280 and 1440, light and dark). Cause: the screen's `.row { min-height: 56px }` (legal-forms.module.css:541) loses to the kit's `.row { min-height: var(--wf-row) }` (wf/table.module.css:4), same specificity, loaded later. Recommend: make the screen rule win (e.g. `.rowList > .row`) and add the 8px block padding 820 already has. Evidence: q232-legal-forms-rows-1280.jpg (master top, main bottom).

Q233. Patient phone hero: each figure's label is centred under a left-aligned number ("Since opened" starts 18px right of its number, "Stage" 35px). Master has them flush left. Cause: patient-now.module.css:2723 `justify-content: center` is not reset by the Round 2 block at :2750. Recommend: add `justify-content: flex-start` there. Evidence: q233-patient-hero-390.jpg (main, light and dark alike).

Q234. Patient "Cannot move" card at 820: the Transport owner label runs into the card's right border (0px gap) and squeezes "Secure adult bed" onto two lines. Fine at 1280 and up. Cause: patient-status-card.module.css:185 `.label` cannot wrap and `.ownerFoot` is `nowrap`. Recommend: let `.label` wrap so the owner drops under the title on narrow cells. Evidence: q234-patient-card-820.jpg (main).

Q235. Kit card header: a long aside never shrinks, so in a narrow desktop window the title collapses to one letter per line before the page loads (seen on Legal forms). The phone layout replaces it once loaded, so this is a first-paint flash. Cause: wf/card.module.css:59 `.aside { flex: 0 0 auto }`. Recommend: `min-width: 0; flex: 0 1 auto` in the kit, one change for every card header. Lower priority.

## Batch 2: Home, Capacity, Waiting, Discharges

Home (outside its group headings) matches the master at every width, with a 17px card gutter and rows lined up. Capacity, Waiting and Discharges match at 1280 and 1440, light and dark. The Capacity phone tabs covering "Mismatch" is Q224, already raised. Dark at 390 was not rechecked after load.

Q237. Capacity "Bed map" card at 820 (master and main alike): the title is squeezed to 0px wide and stacks one letter per line, and the Grid/Rows control runs off the right edge. Same kit cause as Q235 (wf/card.module.css: `.head` cannot wrap, `.aside` cannot shrink). Recommend: in the kit, let the card head wrap so a wide aside drops under the title, and give the title a minimum width. Check that #1283's Q235 fix covers this. Evidence: q237-capacity-bedmap-820.jpg (main).

Q238. Discharges phone: a long barrier wraps to its own line and starts with a stray "· " ("Expected" / "· Awaiting receiving-service acceptance"). Master keeps them on one line with the warning icon. Cause: discharges-third-edition.module.css:1978 `.stageCluster` wraps and :2009 `.blocker::before { content: "· " }`. Recommend: drop the dot when the barrier wraps (use a gap instead of the dot). Evidence: q238-discharges-dot-390.jpg (master left, main right).

Q239. Discharges phone rows are tighter than master: about 4px between the place line and the stage line (master about 20px), and rows 87px against 99px. Cause: phone `.interactiveRow` grid gap `2px 12px`, no row padding. Recommend: an 8 to 12px gap between those two lines, to match the master. Evidence: q239-discharges-rows-390.jpg. Medium confidence.

Q240. Waiting phone: the light content sheet stops about 35px above the dock, leaving a grey band under the footer note. Master is one continuous background. Recommend: let the sheet reach the dock. Evidence: q240-waiting-sheet-390.jpg. Medium confidence, small.

## Batch 3: Transport, Movements, ED, Handover (desktop and tablet; phone follows)

At 1280 and 1440, light and dark, all four match the master for padding, card gutters and table columns, and dark dividers stay visible. Movements matches the master at 820 and in dark at 390. ED's fourth hero figure wrapping is Q229, already raised. Phone layouts for Transport, ED and Handover are being recaptured after load and will follow.

Q241. Movements (and Waiting, same rule) "At a glance" strip at 820 and 1280, master and main alike: when the strip wraps, the second line starts 14px right of the first and opens with a stray divider. Cause: waiting-polish.module.css:29 `.strip + .strip { padding-left: 14px; border-left: ... }` also hits an item that wrapped to a new line. Recommend: space items with `gap` and hide the divider on the first item of each line, one fix for both screens. Evidence: q241-movements-strip-820.jpg (main).

Q242. ED board list at 820, master and main alike: "Log transport booking" is wider than its "Next" column, so it starts 8px left of the heading and sits 10px from the referral text. Recommend: give the Next column a minimum width that fits the longest button. Evidence: q242-ed-next-820.jpg (main). Medium confidence, small.

## Batch 4: Statistics, Community, Community team (Q243 to Q245 rechecked after load: all confirmed)

Statistics at 390 dark matches the master after load (12px gutter, rows about 54px). Community at 1280 matches the master.

Q243. Community team at 1280 (not just 820, see Q228): the four figure tiles are wider than their card, so "Follow-up" is cut off at the right edge. Cause: team-2026.module.css:538 `grid-template-columns: 1.7fr 1fr 1fr 1fr` without `minmax(0, …)`. Recommend: `minmax(0,1.7fr) repeat(3, minmax(0,1fr))`, dropping to 2 by 2 when the card is narrow; fix together with Q228. Evidence: q243-q244-community-team-1280.jpg (master left, main right).

Q244. Community team at 1280: the hero's glance strip wraps, so "Next home" starts on a second line behind a stray divider, and the tab-row tools stack onto two lines (row about 70px against 40px in the master). Cause: community-team-v6.module.css:583 (only the first item drops its divider) and ward.module.css:3485 `.tabTools { flex-wrap: wrap }`. Recommend: the same divider fix as Q241, and keep the tab tools on one line at desktop. Evidence: same image.

Q245. Statistics at 1280: main's new sixth column "Median" in Open ED journeys is cut to "Medi" at the card edge, with no padding and no sign the table scrolls. Recommend: fit all six columns at 1280 (or hide Median on narrow cards), and give the shared table wrapper an edge fade so scrolling tables show it. Evidence: q245-statistics-median-1280.jpg (main, after load).

## Batch 5: phone views after load (Transport, ED, Handover, Community, Community team, Weekly, Settings, Sign in)

Transport, Handover, Community, Weekly and Settings match the master on phone (same gutters, card padding and row heights). The dock and name differences are owned elsewhere (Q162, Q226). Community team has no phone mock-up, but main's phone layout is evenly spaced. Sign in: main is the newly approved page, so the master's older sign-in was not compared.

Q246. ED board phone, master and main alike: inside the "May pass 24 hours in ED" card, the patient row has no side padding, so the name, time, text and "Find a bed" button run flush to the card's edges, while the card heading above has 16px. Recommend: give that row the card's 16px side padding. Evidence: q246-ed-24h-card-390.jpg (master left, main right).

## Summary

15 issues (Q232 to Q235, Q237 to Q246). Q232 to Q235 are built in #1283. Shared fixes that clear several at once: the kit card head (Q235, Q237), the wrapped-strip divider (Q241, Q244) and the Community team tiles (Q243 with Q228).
Not covered: Alerts and Home group headings (ALERTS thread), phone tab bars and 40px controls (other thread), and dark mode at 390 after load for Home, Capacity, Waiting and Discharges. Desktop dark was checked on every screen.
Method note: phone screenshots must wait until "Loading, not live yet" clears, or they show the desktop layout squeezed to phone width.

## Batch 6: phone dark mode after load (Home, Capacity, Waiting, Discharges), checked on main b27fddcc plus #1285

Home, Capacity and Waiting match the master in dark on phone, top to bottom: same gutters, card padding and row heights, and dividers stay visible. #1285's Waiting sheet fix (Q240) shows correctly. #1280 could not be included: merged with current main it fails to load (next-rail-body.tsx imports `surnameFirst`, which main no longer exports), so /ward-flow returns 500. (Since fixed on #1280 in 858eccb1c.)

Q248. Discharges phone, after #1285: the stage and barrier now sit side by side with only a gap ("Confirmed Awaiting accommodation"). The master keeps the "·" between them when they share a line. Recommend: bring the dot back as a clipped pseudo-element (the same trick #1285 uses for the glance strips), so it shows mid-line and disappears when the barrier wraps. Built in #1285 (c7aa0b49). Evidence: q248-discharges-dot-dark-390.jpg (master left, main right).
