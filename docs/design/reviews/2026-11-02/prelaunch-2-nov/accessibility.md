# A. Accessibility check, 2 Nov 2026

Build: main b27fddcc at localhost:3460, synthetic demo data. I covered all 29 main routes at 390 and 1280 in light and dark, with tablet spot checks at 820 (light and dark) and 1024x768 (dark), and reflow at 320 and 640. Tools: axe-core 4 (WCAG 2.0/2.1/2.2 AA plus best practice), my own computed-colour sweep of every visible text node, keyboard Tab walks (40 to 45 stops a page), open, Tab, Esc and focus-return tests on 25 pop-ups, and a 200% text test. Phone and tablet runs used a mobile identity (isMobile, hasTouch, mobile user agent) and waited for "Loading, not live yet" to clear.

What passed: axe found no colour-contrast, button-name, label, ARIA, dialog-name or link-name failures on any page, width or theme. The ones I could confirm on screen also hold up when measured by pixel, for example "Arrived" at 5.75:1 and "Not arrived" at 5.89:1. axe left about 4,300 items undecided, mostly text under pseudo-elements, and I did not check those one by one (see the end). The skip link is the first Tab stop on every page and is clearly drawn in both themes. Choosing it moves focus into `main`. Home also has "Skip to Act now". Modal pop-ups are named, set `aria-modal`, take focus, keep Tab inside, close on Esc and return focus to the opener. That covers Broadcast, Tools, Go to a desk, Bed drawer, Referrals, Record a form, Call sheet, Movement destination, phone Menu, Create and phone Statewide. Status is never shown by colour alone: bed tiles, alert marks and legends use a shape plus words, and bed buttons say the status ("Past expected date", "Held up"). Text inputs and their borders pass 3:1 (3.5 light, 4.0 dark). At 200% browser zoom (1280 becomes 640) and at 320 wide, no page scrolls sideways. The focus ring is visible on light, dark and the navy hero band.

### A1. With text set to 200% on phone and tablet, labels and safety lines are cut off or overlap

Where: every page at 390 (light, dark is the same layout) and at 820, worst on Waiting, Alerts, Ward, Movements, Handover, Legal forms and Downtime. Seen: I doubled every font size, which is what Android Chrome's text scaling does. Then:

- The top bar title is cut off at the top ("Waiting", "Alerts").
- The dock labels run into each other ("Home Referra", "Tasks Activity").
- Hero figure labels are cut ("Over 24", "Form du").
- The segment and select faces cut to "Sh…".
- "By blocker" is overlapped by "Longest wait".
- Kit button labels are cut top and bottom ("Log booking", "Add patient", "Start the round").
- At 820 the Legal forms headers "ENDS, AS TYPED" and "TO RECORD" overlap, and its "Colours compare the time as typed…" line ends in "…".

The axe-style clipping count ran to 121 elements on one page. Desktop zoom at 200% is fine. Cause: fixed heights with `overflow: hidden` and `nowrap` plus ellipsis in the kit button label (`button_label`), the dock label (`ward-phone-menu_dockLabel`), the phone top bar and the segment items, rather than one screen. Recommend: let the kit button, segment, dock and top-bar text wrap or grow when text is large (min-height in place of height), and never truncate the legal-forms safety note. Severity: medium. Confidence: medium (simulated text scaling; check on a real Android phone at its largest font). Evidence: a-1-text200-waiting-390.jpg, a-6-text200-alerts-390.jpg, a-2-text200-legal-forms-820.jpg.

### A2. Add a patient: the choice buttons show no focus ring

Where: /ward-flow/people/new, all widths, light and dark (Gender row and the other choice-button rows). Seen: tabbing onto "Female" gives `:focus-visible`, but computed `box-shadow: none` and `outline: none`, so there is no visible sign of focus. Every other screen's segments show the kit's inset ring. Cause: add-patient.module.css:511 `.segmented.segmented > button { box-shadow: none }` is more specific than the kit's `.segItem:focus-visible` ring (wf/choice.module.css:180). Recommend: add a `.segmented.segmented > button:focus-visible` rule that brings back the kit ring. Severity: medium (keyboard users cannot see where they are on a form). Confidence: high. Evidence: a-3-add-patient-focus-1280.jpg (Female is focused).

### A3. Closing two panels with Esc drops focus to the top of the page

Where: (1) the header "Statewide" service picker at 1280 and 820, light and dark, on every page that has it, after tabbing into the list; (2) Referrals on phone (390), after opening a referral and pressing Esc. Seen: focus lands on `<body>`, so the next Tab starts again at the skip link and a screen reader announces nothing. Cause: (1) the Esc path in ward-bar.tsx:784 focuses `serviceTriggerRef`, which does not seem to be the button drawn on desktop (`ward-bar_scopeBadgeBtn`). (2) referral-board.tsx:383 only refocuses the row if `triggerRef` is still connected, and on phone the list row is redrawn when the detail opens. Recommend: return focus to the button that opened the panel, or to the referral's row found again by id. Severity: medium. Confidence: high for what was seen, medium for cause.

### A4. Switch ward panel: Tab leaves the open panel and jumps to the top of the page

Where: /ward-flow/ward/<unitId> at 1280, light and dark. Seen: the panel opens with focus on the second ward. One Tab moves focus to "Ward Flow WA — home" at the top of the rail, while the panel stays open over the page. The current ward row cannot be reached by keyboard. The panel is `role="dialog"` without `aria-modal`. Cause: ward-switch-menu.tsx (about :123–145) is a portalled panel with no Tab handling or focus-out close. Recommend: either keep Tab inside the panel like the other pop-ups, or close it when focus leaves and return focus to "Switch ward". Severity: low. Confidence: high. Evidence: a-4-switch-ward-focus-1280.jpg.

### A5. Statewide picker tells screen readers it is a menu, but it is a plain group

Where: header "Statewide" button, 820 and up, both themes. Seen: the button has `aria-haspopup="true"`, which means "menu". The panel is `role="group"` ("Choose a health service") and focus stays on the button when it opens. A screen reader user hears "menu" but gets no menu. On phone the same control is a proper named modal dialog. Cause: ward-bar-controls.tsx:223–276. Recommend: use the phone version's pattern on desktop too (`aria-haspopup="dialog"`, a named dialog, focus moved to the selected service). Severity: low. Confidence: high.

### A6. Phone ward hero count badge fails contrast in dark

Where: /ward-flow/ward/<unitId>, 390, dark, the red "1" on the bell. Seen: white 11–12px text on #e27a68 is 2.91:1 (needs 4.5). In light it passes. Cause: ward.module.css:4046–4056 `.phoneHeroBadge` uses `--wf-danger` with `--wf-on-accent`. Recommend: use dark ink on the dark-theme danger colour, or a deeper red fill in dark. Severity: low. Confidence: high (pixel-checked). Evidence: a-5-ward-badge-dark-390.jpg.

### A7. Headings skip levels on three pages

Where: Wards (h1 to h3 for ward titles, all widths), Movements desktop and tablet (an empty `<h4>` group head in "Collected"), Community team (h3 "How to reach" without an h2). Seen: axe heading-order, both themes. Cause: Movements is `movement-flow_trGroupHead` with no text, and the others use the wrong heading level. Recommend: use h2 for those headings and drop the empty h4. Severity: low. Confidence: high.

### A8. Small kit and screen issues found by axe at tablet

Where: 820, light and dark. Seen: (1) the Capacity "Bed types, now and tomorrow" strip (`capacity-page_mmStrip`) scrolls sideways but cannot take keyboard focus, so a keyboard user cannot scroll it. (2) On the Alerts "Today" band, four "Transport awaiting departure" marks overlap and leave 21.8 by 24px targets (WCAG 2.2 target size). (3) Duplicate landmark names on Capacity (five map groups), Settings (three) and Governance, which is noise for screen-reader landmark lists. Recommend: give the strip `tabindex="0"` and a label, space the Today marks (or group marks that land together), and make the section labels unique. Severity: low. Confidence: high.

## Could not check

- A real screen reader (VoiceOver, TalkBack, NVDA). Reading order and announcements were checked from the accessibility tree and ARIA only.
- Real device text size. A1 is simulated by doubling every font size, and iOS Safari's text setting zooms the page instead.
- Pop-ups and drawers other than the 25 tested, focus order past the first 40 to 45 Tab stops on long pages, and landscape phone (844x390).
- The roughly 4,300 text items axe could not decide (mostly text under pseudo-elements). My own computed sweep found no real failures among them apart from A6, but it cannot see gradients or images.
- Windows High Contrast / forced-colours mode and reduced motion.
