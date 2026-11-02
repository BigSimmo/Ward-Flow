# Pre-launch checks, 2 Nov 2026

Main at b27fddcc (#1284), production build run locally from synthetic demo data. The live site (Railway) cannot be reached from the cloud, so this build stands in for it. #1280 and #1285 are not in it. Review only: nothing is built until Josh approves.
Widths: phone 320, 360, 390 and landscape; tablet 768, 820, 1024 and 1180 in both orientations; desktop 1280 and 1440; light and dark. Detail and evidence for each check are in this folder (wording.md, accessibility.md, states.md, data.md, widths.md and evidence/).
Not repeated: Q224 to Q246 (design and spacing reviews).

## Batch 1: Wording (Q260 to Q272)

Passed: Australian spelling, 24-hour times, short durations ("2d 14h"), dates as "2 Nov", names shown "Surname, First", and no TODO, lorem or code names on screen.

Q260. The same label shows different numbers. "Waiting" is 62 in the sidebar but 70 on the Home tab; "Act now" is 4 on Home but 3 in the phone Menu; Community teams 64 against 58 in Go to a desk; Alerts badge 12 against 13 on the page. Recommend: keep "Waiting" for the 62 in ED, rename the Home tab "Open", and feed every count from one source. Medium.
Q261. Bed security is "Locked" in some places and "Secure" in others ("Adult · Secure" on the ED board, "Adult · Locked" in Switch ward). Recommend: "Locked" everywhere except inside ward names. Medium.
Q262. "Movements" and "journeys" name the same thing ("70 open ED journeys" next to "Movements 70 still open"). Recommend: "movement" everywhere. Medium.
Q263. A held-up discharge is "held up", "barrier" or "blocker"; a discharge is also "release", "departure" or "due out". Recommend: "held up" for the state and "discharge" for the event. Medium.
Q264. The Ward page uses Title Case ("Discharge Barriers", "Confirm Ready"), and "Back to Ward overview" names a tab now called "Ward home". Recommend: sentence case and "Back to Ward home". Medium.
Q265. One board has five names ("Stays and discharges", "board", "Bed Board", "Bed board", "Example stays and discharges"). Recommend: "Bed board" everywhere. Medium.
Q266. "New referral" and "Raise referral" are the same action; the New referral page's heading says "Referrals". Recommend: "New referral" everywhere, including the heading. Low.
Q267. "Add a patient", "Add patient" and "New patient" are the same action. Recommend: "Add patient". Low.
Q268. On phone the same page is "Tasks" in the dock and "Alerts" in the Menu (Q177 and the 31 Oct decision pull apart). Recommend: "Alerts" everywhere, since the page, bell and Menu already use it. Low, needs Josh's pick.
Q269. Broadcast calls its recipients units, wards, desks, areas and screens in one dialog. Recommend: "desks". Low.
Q270. Test words reach the screen: "Mock numbers", "Demo time" (the header calls it "Board time"), and a status code read out as a sentence in an ED tooltip. Recommend: "Synthetic numbers", "Board time", and plain tooltip wording. Low.
Q271. Screen readers hear "First Surname" (48 labels) while the screen shows "Surname, First"; the Home ED tile shows "No forms due" but reads "No form due time recorded". Recommend: labels match the screen. Low.
Q272. Page names drift between sidebar, browser tab and heading ("All EDs" against "Emergency departments", Community, Weekly), and tab titles mix "·" and "—". Recommend: browser tab = sidebar name + " — Ward Flow", and "Community team" as the one term. Low.

Not checked in wording: roles other than Bed coordinator, and a few pop-ups the script could not open (referral drawer, ward bed drawer, ED patient details, Help).

## Batch 2: Empty, loading and error states (Q273 to Q278)

Passed: no "undefined", "NaN", "null" or raw error text anywhere; empty pages explain themselves in plain words; offline mostly works well. Method: the demo build has no data API (records live in the browser), so empty was tested by clearing that saved copy, and slow or failed loads by holding back or failing the page code. Detail: states.md.

Q273. Offline, a tapped link says "This page will open when the connection is back", but it never opens; the tap is dropped. It also blocks pages already loaded that could have opened. Recommend: open pages that are already loaded, and for the rest say "You're offline. Tap again once you're back online." Medium.
Q274. If the page code never arrives, "Loading, not live yet" stays forever, with no time limit and no Reload button. Recommend: after about 15 seconds, change it to "Still loading. Check the connection." with a Reload button. Medium.
Q275. A page change that never finishes shows "Loading page" forever. Recommend: after about 10 seconds, add "This is taking longer than usual." with Try again. Low.
Q276. The "Loading, not live yet" note covers the page title on phone; on Waiting at 390 it hides the "62 waiting in ED" count. Recommend: rest the note at the foot of the window, above the phone dock, as tablet does. Low.
Q277. With no data at all, Patients says "No patient matches the current search" with a Clear search button, and Discharges says "No releases match these filters", though nothing is set. Recommend: "No patients yet." and "No discharges open." with no Clear button (wording follows Q263). Low.
Q278. Going offline before the first keyboard focus throws an error, and the helper that keeps a focused control from hiding under the header or dock never loads. Recommend: load that helper early when the page is idle, and catch a failed load. Low.

Not checked here: the live backend (save, conflict, sign-in expiry), the app's real server error pages, landscape phone, 1024, 1180 and 1440.

## Batch 3: Long and odd data (Q279 to Q287)

Method: the demo seed was rewritten as it loaded (long synthetic names, a ward with 48 beds), counts and waits were raised on the page (128, 1,204, "14d 23h"), and a broadcast was sent with a long unbroken word. Q279 to Q281 also happen with today's normal demo data. Detail and evidence: data.md, evidence/D-*.

Q279. Waiting group tiles at tablet (820): the "longest" time runs into the next tile, with today's data. Recommend: let "longest" drop under the group name when the tile is narrow. High.
Q280. Phone top bar: a long page name runs off the screen and pushes Search out of reach; it already happens on the Broome ward. Cause: ward-bar.module.css:114 not reset on phones. Recommend: let the title shrink with an ellipsis so Search always shows. High.
Q281. Wards table view at 820: the whole page slides sideways. Cause: a hidden column header (ward-index.tsx:1398) escapes the scrolling table. Recommend: keep the hidden text inside the table's scroll area. Medium.
Q282. Broadcast composer: a long ward name in "Shows on N screens" is cut at the drawer edge with no ellipsis. Recommend: end it with an ellipsis and show the full name on hover. Medium.
Q283. A long unbroken word in typed text runs out of the live broadcast card at every width. Recommend: let typed text break anywhere, as the bed grid already does (ward-beds-matrix.module.css:422), on all note and barrier fields. Medium.
Q284. Ward bed tiles: one long name makes the whole row tall and breaks words mid-way. Recommend: two lines with an ellipsis, full name on hover and in the bed drawer. Low.
Q285. Shortened "Surname, First" names drop the first name, so two people with the same long surname look alike. Recommend: shorten the surname and always keep the first name. Low.
Q286. ED handover table at 1024 and 1280: a long name gets an ellipsis part-way and then keeps wrapping. Recommend: two lines and an ellipsis, as on the other tables. Low.
Q287. Waiting on phone: a 3-digit group count cuts off the group heading. Recommend: let the count note wrap below and keep the heading whole. Low.

Not checked here: long notes saved on records (typed text isn't kept in the demo), print views, 1440 and landscape phone.

## Batch 4: Small and in-between widths (Q288 to Q296)

Checked 320, 360, 667x375 and 844x390 phones, 768, 820, 1024 and 1180 tablets in both orientations, 1024 to 1100 desktop windows, and 1px either side of every breakpoint, with real iPhone and iPad identities. Passed: no page scrolls sideways, no text under 12px, the shell switches cleanly at each breakpoint, dark matches light, and every pop-up fits or scrolls on a portrait phone and at 667x375. Detail and evidence: widths.md, evidence/W-*.

Q288. Landscape phones wider than 768px: side drawers leave almost no room to scroll (the bed drawer's scroll area is 28px tall at 844x390, the referral composer's 116px). Recommend: on screens under about 500px tall, let drawer headers scroll with the body and unpin the footers. High.
Q289. Landscape phones from 844 to 932 wide get the tablet layout: no dock, and controls of 26 to 32px. Recommend: treat touch screens under about 500px tall as phones for control size and the dock. Medium.
Q290. ED board hero cuts off "Under a form" at 1025 to 1060 and 1201 to 1260 wide, a side effect of the Q229 no-wrap fix. Recommend: let the title column shrink first so all four figures fit from 1025px. Medium.
Q291. Community team "Team list" is crushed on portrait tablets from 769 to about 880 (including 820): titles stack one word per line. Recommend: stack the Team list and Team flow cards in one column below about 900px. Medium.
Q292. Portrait iPads at exactly 768 (and iPad mini at 744) get the phone layout, because the tablet layout starts at 769. Recommend: give them the tablet layout by moving the phone breakpoint to 47.99rem everywhere. Medium, needs Josh's pick.
Q293. Waiting hero figures wrap from 1001 to beyond 1300 wide; the rows overlap by 8px and the second row starts with a stray divider. Recommend: keep the four figures on one row, as on ED. Low.
Q294. At exactly 768, the broadcast banner and the access-reason picker keep their desktop layout inside the phone shell (47.99rem against the shell's 48rem). Recommend: one breakpoint value, moved together with Q292. Low, from source only.
Q295. Small kit buttons draw 32px tall on phones (tap area 48px), below the 40px rule and not in Q225's list. Recommend: draw them at 40px on phones. Low.
Q296. The first-visit page hint covers about 40% of a landscape phone and stays pinned while scrolling. Recommend: on short screens show it as a one-line strip. Low.

Not checked: real devices or Safari (Chromium emulation only), a live broadcast banner, widths above 1440, and the app's own Appearance toggle.

## Batch 5: Accessibility (Q297 to Q304)

All 29 main routes at 390 and 1280 in light and dark, plus 820 and 1024. Passed: axe-core found no contrast, label, name or dialog failures at any width or theme; the skip link is the first Tab stop everywhere; pop-ups take focus, keep Tab inside, close on Esc and return focus; status is never shown by colour alone; at 200% zoom and at 320 wide nothing scrolls sideways. Detail: accessibility.md, evidence/a-*.

Q297. With text set to 200% on phone and tablet, labels and safety lines are cut off or overlap (kit buttons, dock, top bar, segments), and the Legal forms "Colours compare…" safety note ends in "…". Recommend: let kit controls grow with text (minimum height, not fixed height) and never shorten the legal-forms safety note. Medium; simulated, confirm on a real phone.
Q298. Add a patient: the choice buttons show no focus ring (add-patient.module.css:511 removes it). Recommend: bring back the kit focus ring there. Medium.
Q299. Closing the Statewide picker (desktop, tablet) or an open referral (phone Referrals) with Esc drops focus to the top of the page. Recommend: return focus to the button or row that opened it. Medium.
Q300. Switch ward panel: one Tab leaves the open panel and jumps to the top of the page. Recommend: keep Tab inside the panel like the other pop-ups. Low.
Q301. The Statewide picker tells screen readers it is a menu, but it is a plain panel. Recommend: use the phone version's dialog pattern on desktop too. Low.
Q302. Phone ward bell badge fails contrast in dark (2.91:1, needs 4.5). Recommend: a deeper red fill in dark. Low.
Q303. Headings skip levels on Wards, Movements and Community team. Recommend: use h2 for those headings and drop the empty h4. Low.
Q304. Tablet: the Capacity bed-type strip can't be scrolled by keyboard, the Alerts "Today" marks overlap into small targets, and some landmark names repeat. Recommend: make the strip focusable, space the Today marks, and give each section a unique name. Low.

Not checked: a real screen reader, real-device text size, landscape phone, forced-colours mode.

## Summary

45 issues: Q260 to Q287 approved and building (5 PRs); Q288 to Q304 waiting on Josh (Q292 needs his pick).
