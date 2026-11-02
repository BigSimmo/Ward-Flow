# W. Small and in-between widths (main b27fddcc, 2 Nov 2026)

Covered: 29 routes at 320x640, 360x740, 667x375, 844x390, 768x1024, 1024x768, 1100x800 and 1180x820 (light), plus 1px either side of every shell breakpoint (639-641, 767-769, 999-1002, 1023-1025, 1199-1201) on 10 main routes. Most pop-ups were opened at 320, 667x375, 844x390, 926x428, 768 and 1024. I re-ran phone and tablet widths with a real iPhone and iPad identity, which gave the same results. I spot-checked dark mode at 844x390, 768, 1024 and 1180 on 10 routes, and it matches light structurally. Everything was measured after load.
Passed: no page scrolls sideways at any width. No visible text is under 12px. The shell switches cleanly at 768/769 (phone to tablet portrait), 1000/1001 (64px rail) and 1200/1201 (open rail), with no half-switched state at 640, 1024 or 1025. Every pop-up on a portrait phone and on 667x375 either fits or scrolls.
Known items seen again and not re-reported: Q225 kit sizes, Q228/Q243 Community team tiles (at 1025-1280 and 1201 the fourth tile, Follow-up, is fully hidden, not just cut), and Q242 ED Next column (also at 1201).

### W1. On a landscape phone wider than 768px, side drawers leave almost no room to scroll

Where: Ward bed drawer, New referral composer and Movement drawer, at 844x390 and 926x428 (iPhone landscape). Light and dark.
Seen: the bed drawer's header, figures, "why not left" line and tabs stay fixed and the footer is pinned, so the scrolling body is **28px tall** (541px of content). The referral composer body is 116px tall (154px at 926x428). The Movement drawer's pinned action bar covers the bottom 124px of 390. At 1024x768 the same drawers have 327 to 644px.
Cause: the short-screen fixes only sit inside phone rules, for example ward-referral-drawer.module.css:3251 `@media (max-height: 30rem)` sits within the `max-width: 48rem` block. The bed drawer has no short-height rule at all (ward-bed-dossier-drawer.module.css media at 503/604/618 only). At 844px wide these drawers use the tablet layout.
Recommend: below about 500px tall, let drawer headers scroll with the body and unpin the footers, whatever the width.
Severity: high. Confidence: high. Evidence: W-1-bed-drawer-844x390.jpg, W-1-bed-drawer-844x390-dark.jpg, W-1-referral-composer-844x390.jpg.

### W2. Landscape phones above 768px get tablet sizing: no dock and many 26-32px controls

Where: every page at 844x390 (and 926x428). Light.
Seen: there is no bottom dock, only the hamburger. Controls under 40px include the ED board filter chips (28), ED actions and full-screen buttons (28), the Ward and Community team tabs (32), Switch ward (32), the Waiting and Movements glance-strip buttons (26-28), the header demo clock (28), Transport fleet buttons (30) and Capacity route picker (30). The Home hero fills the first screen, with only about 90px of list showing. At 667x375 the phone layout applies and these are fine.
Cause: the shell and screens key only on width (`max-width: 48rem`). A sideways phone of 844 to 932px is treated as a tablet portrait (769-1000).
Recommend: treat coarse-pointer screens under about 500px tall as phones for control size and the dock.
Severity: medium. Confidence: high.

### W3. ED hero cuts off "Under a form" at two in-between desktop widths

Where: ED board (/ward-flow/ed/rph-ed), 1025-1060 and 1201-1260 (just after the rail opens). Light, and dark the same.
Seen: the fourth figure's label runs under the "On TV" button and is clipped, 16px over at 1025 and 35px over at 1201 ("Under a fo", "Under ."). At 1201 the list headers "Referral" and "Next" also run together.
Cause: the Q229 fix, ed-overview.module.css:225-233 (`@media (min-width: 64.0625rem)` with `flex-wrap: nowrap; flex: 0 0 auto`), stops the wrap but the figures cannot shrink.
Recommend: let the title column shrink first, or tighten the figure gutters, so all four figures fit from 1025px.
Severity: medium. Confidence: high. Evidence: W-3-ed-hero-1201.jpg.

### W4. Community team "Team list" is crushed on portrait tablets

Where: Community team (/ward-flow/community/midland), 769 to about 880px, including 820. Light and dark.
Seen: the row title column is 39px wide at 769, 70px at 800 and 90px at 820. Titles stack one word per line ("7-day / follow- / up / due / today") and names truncate to "Thor…" or "Sallowfield, …". This is separate from Q228's tab row and summary card.
Cause: team-2026.module.css:679 `.lr { grid-template-columns: 16px minmax(0,1fr) 110px auto }` in a half-width column (line 78, `1fr 1fr !important`), so the fixed 110px "when" column and the button take most of the row.
Recommend: stack the Team list and Team flow cards in one column below about 900px.
Severity: medium. Confidence: high. Evidence: W-4-team-list-769.jpg.

### W5. Waiting hero figures wrap at tablet landscape and small desktop, with overlapping rows and a stray divider

Where: Waiting, 1001-1199 and 1201 to beyond 1300. Light and dark.
Seen: "29 No update for 2h" drops to a second row and starts with a divider line. The two rows' buttons overlap by 8px, so "29" sits on "Over 8h" with no gap.
Cause: delays-board.module.css:334-359. `.stats` wraps, each `.stat` has `margin: -4px 0`, and every stat except the first keeps `border-left`.
Recommend: keep the four figures on one row (as on ED), or add a row gap and drop the divider at the start of a wrapped row.
Severity: low. Confidence: high. Evidence: W-5-waiting-hero-1100.jpg.

### W6. Portrait iPads at 768px get the phone layout; tablet starts at 769

Where: all pages at 768x1024 (iPad 9.7", iPad mini).
Seen: 768 shows the phone dock, hamburger and one-column phone screens stretched to 768 (Home, Search, Patient). 769 shows the tablet portrait layout. It works, but it is a different product from the 820 tablet that was designed.
Cause: phone rules use `max-width: 48rem`, which includes 768. TABLET_LANDSCAPE_RAIL_QUERY and the 769px rail rules start one pixel later.
Recommend: decide whether 744-768 iPads should get the tablet layout. If yes, move the phone breakpoint to 47.99rem everywhere.
Severity: medium (Josh wants tablets covered). Confidence: high. Evidence: W-6-home-768.jpg.

### W7. At exactly 768px two components use desktop layout inside the phone shell

Where: the broadcast answer banner and the access-reason picker, at 768.
Seen (source only): these two use `max-width: 47.99rem`, while the shell's phone layout uses 48rem. At 768 the broadcast banner keeps the desktop row and its answer buttons are not the phone 2-up grid. The reason buttons lose their 48px phone floor.
Cause: ward-broadcast-banner.module.css:139 and ward-access.module.css:73.
Recommend: use the same 48rem phone breakpoint as the shell (or move everything together under W6).
Severity: low. Confidence: medium. I did not send a live broadcast, because it would change state the other reviewers share.

### W8. Small kit buttons draw 32px on phones, below the 40px house rule

Where: Capacity "Open", Discharges "Chase", "Open" and "Confirm date", Waiting "Show list", Home "More for this list", "Call sheet" and the tour's "Start the tour" and "Not now", and Patient and Movement row buttons. At 320, 360, 667x375 and 768. Light and dark.
Seen: 32px tall. The kit gives them an invisible 48px tap cover (button.module.css:277-300), so taps work, but they are drawn below the 40px rule. This is not in the Q225 list.
Recommend: draw `.sm` at 40px on phones, like `.b`, or record the 32px small button as an approved exception next to Q231.
Severity: low. Confidence: high.

### W9. The first-visit page hint covers about 40% of a landscape phone and stays put while scrolling

Where: Referrals, ED board and other pages with the "More in Help / Got it" hint, at 844x390.
Seen: a 370x150 card pinned bottom right, over list rows, until it is dismissed.
Recommend: on short screens show the hint as a one-line strip, or anchor it in the page flow.
Severity: low. Confidence: high. Evidence: W-8-hint-card-844x390.jpg.

## Could not check

Real devices and Safari: this was Chromium emulation only, so iOS safe areas and the URL bar changing the height are untested. A live broadcast banner (W7, to avoid changing shared demo state). Widths above 1440. The app's own Appearance toggle: I used the system colour scheme. Most overlap flags turned out to be sticky bars over scrolled content or invisible stacked layers, and are not reported.
