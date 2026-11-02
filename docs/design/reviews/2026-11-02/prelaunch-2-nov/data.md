# Check D: long and odd data, 2 Nov 2026

Build: main b27fddcc at localhost:3460, light at 390, 820, 1024 and 1280, dark spot-checked (Handover 390, Ward 1024). Phone and tablet runs were redone with a mobile identity (isMobile, hasTouch, iPhone/iPad user agent) after load; every finding below reproduces that way. No squeezed first paint is reported.
Covered 23 pages: Home, Wards (cards and table), Ward, Capacity, Waiting, Discharges, Movements and a movement, Transport, All EDs and SCGH ED, Handover, Alerts with the Broadcast composer and live card, Legal forms, Patient, Referrals, Community and a team, Statistics and Weekly, Search, Downtime, Governance, Bed meeting.
Injection methods:

- **Chunk:** Playwright route interception rewrote the bundled demo seed in the JS chunks. Every seeded given name became "Alexandrina-Maximiliana". Every seeded family name gained "-Wolfeschlegelsteinhausen-Bergerdorff". SCGH "Mental Health Unit" was renamed "...and Extended Assessment Service (Synthetic East Wing, Level 4)" and given 48 beds.
- **DOM:** after load, page.evaluate rewrote text nodes. Bare counts became 128 (and 1,204 on one run), durations became "14d 23h", and percentages became 100.0%. The team name was also lengthened this way.
- **Typed:** a broadcast with an unbroken 70-character token.
- **Real:** the unchanged demo data.

**Passed:**

- Long names end in an ellipsis on Waiting, Handover, Movements (list and timeline bars), Referrals, Transport, Home rows and the Patient hero.
- Long ward names wrap cleanly in the Ward hero, the Wards cards and Discharges.
- Statistics, Capacity, Bed meeting and the ED cards absorb 3-digit counts and 14-day waits.
- A 48-bed ward draws 48 tiles and correct counts.
- Zero counts on a community team read fine.
- The broadcast message is capped at 240 characters.
- Nothing dark-specific.

### D1. Waiting group tiles: the "longest" time runs into the next tile on tablets, with today's data

Where: Waiting, 820 (portrait tablet), light and dark. Seen: **Real** data. "Transport · longest 14h 01m" ends at x=623 inside a tile that ends at 607, so it collides with "1 Other" ("14h 01m1 Other"). With a 14-day wait (**DOM**), three of the four tiles spill, up to 12px past the card edge. At 1024 and above it fits. Cause: `.ownLongest { white-space: nowrap; margin-left: auto }` in src/components/ward-management/delays/waiting-polish.module.css:125, inside a fixed 4-column grid (`.ownGrid`, line 112), drawn by delays/waiting-owner-tiles.tsx:53. Recommend: let "longest ..." drop to its own line under the group name when the tile is narrow. Severity: high. Confidence: high. Evidence: evidence/D-1-waiting-tiles-820.jpg

### D2. Phone top bar: a long page name runs off the screen and pushes Search out of reach

Where: every phone page with a Back arrow (Ward, ED detail, Community team, Patient, Movement), 390, light. Seen: **Real** data. "Mabu Liyan / Broome Mental Health Unit" pushes the Search icon half off the edge. With the long ward name (**chunk**), the title box is 631px wide in a 390px bar. The title is cut with no ellipsis, and Search sits at x=687, off screen. The in-page hero title below does end in an ellipsis. Cause: `.deskBack + .title { flex-shrink: 0 }` in src/components/ward-management/shell/ward-bar.module.css:114. It applies at every width. Back is hidden on phones but is still the title's sibling, and the reset at line 616 covers only widths of 48.0625rem and up. Recommend: let the title shrink on phones too, so it ends in an ellipsis and Search always stays visible. Severity: high. Confidence: high. Evidence: evidence/D-2-phone-title-390.jpg

### D3. Wards table view makes the whole page slide sideways on tablets

Where: Wards, Table view, 820 portrait tablet (mobile identity), light. Seen: **Real** data. The document is 918px wide in an 820px screen, so the hero, filters and table all pan sideways. The table card itself scrolls (988 of 786px), but its hidden "Open" column header escapes it. At 1024 and 1180 the page stays put. Cause: the visually hidden header `<span className={styles.srOnly}>Open</span>` (src/components/ward-management/wards/ward-index.tsx:1398, `.srOnly` at wards/ward-index.module.css:653). It is `position: absolute` with no positioned ancestor inside the scrolling card, so it lands at x=918. Recommend: make the table card (or the header cell) `position: relative` so hidden text stays inside the scroller. Severity: medium. Confidence: high. Evidence: evidence/D-3-wards-table-sideways-820.jpg

### D4. Broadcast composer: a long ward name in "Shows on N screens" is cut at the drawer edge with no ellipsis

Where: Alerts > Broadcast alert, preview column, 1280 (and narrower), light. Seen: **Chunk**. The tag "Mental Health Unit and Extended Assessment Service (S" stops at the drawer's right edge, mid-word. Cause: `.tag` in src/components/ward-management/alerts/broadcast.module.css:342 is a fixed 20px-high inline-flex with no max-width or ellipsis, rendered at broadcast-composer.tsx:420. Recommend: cap the tag at the column width, end it with an ellipsis, and add the full name as a tooltip. Severity: medium. Confidence: high. Evidence: evidence/D-4-broadcast-chip-1280.jpg

### D5. Free text with a long unbroken string is clipped in the live broadcast card

Where: Alerts > Broadcast tab, live card body, 390, 820, 1024 and 1280, light. Seen: **Typed** text, a 70-character reference with no spaces. At 1024 it is clipped 11px past the card edge, and at 390 by 191px. It never wraps and cannot be read in full. The top banner handles the same text with an ellipsis. Cause: `.body > p` in src/components/ward-management/alerts/broadcast-tab.module.css:93 has no `overflow-wrap`, and `.card` (line 11) is `overflow: hidden`. Recommend: add `overflow-wrap: anywhere` to typed-text paragraphs. The bed matrix already does this (ward/ward-beds-matrix.module.css:422), so the same rule fits other note and barrier fields. Severity: medium. Confidence: high. Evidence: evidence/D-5-unbroken-text-1024.jpg

### D6. Ward bed tiles: one long name makes the whole row of tiles tall and breaks words mid-way with no hyphen

Where: Ward, Every bed grid, 820, 1024 and 1280, light and dark. Seen: **Chunk**. A 60-character name wraps to five lines inside a tile ("Wolfeschlegelst / einhausen-"). That stretches every tile in the row to about 200px. With 48 beds the grid becomes very long to scan. Cause: tile names use `overflow-wrap: anywhere` with no line limit (ward bed tile name style). Recommend: clamp tile names to two lines with an ellipsis and show the full name on hover and in the bed drawer. Severity: low. Confidence: medium. Evidence: evidence/D-6-bed-tiles-820.jpg

### D7. Truncated "Family, Given" names lose the given name entirely

Where: Handover (phone rows and ward promises), Waiting, Movements, Referrals, Home rows, 390 to 1280, light. Seen: **Chunk**. Every long-surname row shows only "Oquinn-Wolfeschlegelsteinhau…", so two people with the same long surname look identical apart from the UMRN. The movement timeline code already calls a cut surname "ambiguous" (movements/movement-horizon-gantt.tsx:631). Recommend: truncate the family name and keep the given name visible, for example by middle-truncating the family name, or put the given name on the second line. Severity: low. Confidence: medium. Evidence: evidence/D-7-names-cut-390.jpg

### D8. ED handover table: a long name is cut with an ellipsis mid-line and then carries on wrapping

Where: SCGH ED, ED handover table Patient cell, 1024 and 1280, light. Seen: **Chunk**. The cell reads "Finchgrove- / Wolfeschlegelsteinha… / Bergerdorff, / Alexandrina- / Maximiliana". One word is ellipsised while the rest wraps to five lines, which looks broken. On phone and at 820 the same cell ellipsises cleanly on one line. Recommend: pick one behaviour for this cell: two lines and an ellipsis, as on the other tables. Severity: low. Confidence: medium. Evidence: evidence/D-8-ed-name-cell-1024.jpg

### D9. Waiting (phone): a 3-digit group count truncates the group heading

Where: Waiting, Longest wait groups, 390, light. Seen: **DOM**, with counts set to 128. "Over 24 hou… 128" loses the end of the heading, because the right-hand note "past the access target" keeps its full width. Recommend: let the right-hand note wrap or drop below on phones, and keep the heading whole. Severity: low. Confidence: medium.

Not reported, because the data is unrealistic or by design:

- Tier chips ("T128") and the patient stage-step circles overflow only with impossible values.
- The Capacity "nearest" rank column overlaps only with 4-digit ranks.
- 1,204 in a bed-number column overlaps the name. Real bed labels are short, but a 4-character label such as "12A" was not tried.

Could not check:

- Real long data saved through the app, for example a long barrier or discharge note typed into a record. Typed text is not kept on this device (D-18), so it could only be stressed in the broadcast composer.
- Editing the browser-storage demo world.
- Print views.
- 1440 width, and landscape phone.
- Physical devices. All of this is Playwright Chromium emulation.
