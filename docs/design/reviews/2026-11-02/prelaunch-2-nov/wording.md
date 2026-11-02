# Check T: wording consistency

Covered: visible text, aria-labels, titles and placeholders from 30 routes at 1280x800 and 390x844 (main b27fddcc on :3460, Bed coordinator desk), plus the main pop-ups (Tools, Activity, Go to a desk, Statewide picker, phone Menu, phone Create sheet, Broadcast, Movement "what is recorded" drawer, ED patient actions, Switch ward, Arrange sheet), and a grep of `src/`. Counts below are occurrences in the captured text across both widths unless marked.
Passed: Australian spelling throughout (no -ize, color, center, canceled; "authorised" and "colour" used). Clock is 24-hour everywhere. Durations are consistently compact ("2d 14h", "4h 21m") in figures and in words in labels ("Over 24 hours"). Dates read "2 Nov" everywhere; DOB is DD/MM/YYYY (AU order). Visible patient names are always "Surname, First". No TODO, lorem, Q numbers, BL86, D-numbers or "undefined/null/NaN" reach the screen. Q226 (signed-in name) not re-reported.

### T1. The same label shows different numbers on the same screen

Where: Home and phone Menu (390 and 1280), Go to a desk, Alerts. Seen: "Waiting" means 62 people in ED (sidebar, phone Menu, Waiting page heading "62 waiting in ED") but the Home list tab beside it says "Waiting 70" (all open journeys). "Act now" is 4 on Home and Alerts but "Act-now alerts 3" in the phone Menu. "Community teams" is 64 on Community and Places but "58 teams" in Go to a desk. The bell and the Tasks dock say 12, while the Alerts page heading adds up to 13 ("4 act now, 9 waiting"). Evidence: evidence/T-1-phone-home-waiting70.jpg, evidence/T-1-phone-menu-waiting62.jpg. Cause: Home tab label coordinator-screen.tsx:1044 (Josh's words, 30 Oct); ward-phone-menu.tsx:265; operator-switcher-modal.tsx:822 counts a different team list from community-index.tsx:491. Recommend: keep "Waiting" for the 62 people in ED only, and rename the Home tab to "Open" (it matches "70 still open" in the sidebar); make the other three counts come from the same source. Severity: medium. Confidence: high.

### T2. Bed security is called both "Locked" and "Secure"

Where: ED board, Wards, Switch ward, Referrals, Broadcast, Patient. Seen: "Locked/locked" 62, "Secure/secure" 211 (about 150 of those are ward names like "FSH Adult Secure", which are fine). The same fact reads "Adult · Secure" on the ED board but "Adult · Locked" in Switch ward and Wards; Broadcast offers "Secure beds" and "Secure and forensic"; Patient shows "Locked adult secure". Cause: ed-screen-desktop.tsx:237 and ed-screen-referred.tsx:135 print the raw `security` value; ward-broadcast-model.ts:284, broadcast-audience.ts:36; patient-now-adapter.ts:235. The code already says "Locked" is the app's word (F-24, referral-board-sections.tsx:209). Recommend: "Locked" everywhere except inside proper ward names. Severity: medium. Confidence: high.

### T3. "Movements" and "journeys" name the same thing

Where: Home hero, sidebar, Statistics, Activity, Movements, Downtime pack, Legal forms. Seen: Movement(s) 218, journey(s) 39, move(s) about 10. Home's headline says "70 open ED journeys" right next to the sidebar's "Movements 70 still open". Statistics: "Open ED journeys". Activity: "New ED journeys". Downtime pack: "Pending moves". Legal forms: "33 forms on open moves". Recommend: "movement" for the record everywhere; keep "journey" out of headings and counts. Severity: medium. Confidence: high.

### T4. Discharge hold-ups have three names, discharges have four

Where: Ward page, Discharges, phone Menu, Movements. Seen: "held up" 116, "barrier(s)" 33, "blocker" 17 for the same state. The Ward page alone mixes "Discharge Barriers (2)", "Record a blocker", "Update blocker", "No longer blocked" and "Held up"; Discharges says "Held up by barrier". For the event itself: discharge(s) 79, release(s) 48, departure(s) 36, "Due out" 8 ("All Discharges", "Scheduled Departures", "Releases held up", "Due out" on one ward). Recommend: "held up" for the state (most used and plainest), and "discharge" for the event. Severity: medium. Confidence: high.

### T5. Ward page buttons and tabs use Title Case; one link names a tab that no longer exists

Where: Ward page discharge view and sub-views, 1280 and 390. Seen: "All Discharges (4)", "Scheduled Departures (3)", "Discharge Barriers (2)", "Active Discharge Barriers", "Catchment Team Lookup", "Confirm Ready" (x2), "Open visual Bed board →" (x3), while the rest of the app is sentence case ("Leave and absent without leave (1)" sits in the same row). "Back to Ward overview" (x3), but the tab is called "Ward home" (renamed 27 Oct). Also the Home hero chip "to check" is the only lower-case chip beside "Act now", "To decide", "Past target" (evidence/T-5-home-to-check.jpg). "My List" is Josh's capitalisation and is fine. Cause: ward-discharges-matrix.tsx:65-142 and 204; ward-screen-tab-sections.tsx:174, 185, 227, 238, 271, 282. Recommend: sentence case for every button and tab, and "Back to Ward home". Severity: medium. Confidence: high.

### T6. One board, five names: "Stays and discharges" / "board" / "Bed Board" / "Bed board"

Where: rail, Ward page, Movements, Statistics, browser tab. Seen: rail "Example stays and discharges"; page heading "STAYS AND DISCHARGES"; browser tab "Dabakarn board"; Movements links read "Open Dabakarn Bed Board" (14 aria-labels, Title Case); Ward page "Open visual Bed board →"; Statistics "Bed board". Recommend: "Bed board", sentence case, everywhere it is named. Severity: medium. Confidence: high.

### T7. Raising a referral is "New referral" in some places and "Raise referral" in others

Where: header, sidebar, Patient, ED, Ward, Community. Seen: "New referral" 6 pages plus the header button and rail; "Raise referral" on Ward, ED board and Community (5). The New referral page's browser tab says "New referral" but its heading says "Referrals". Recommend: "New referral" (shorter, already the header button). Severity: low. Confidence: high.

### T8. Adding a patient is worded three ways

Where: Create sheet, Patients, Add a patient page, referral form. Seen: "Add a patient" (page heading and tab, 2), "Add patient" (Create sheet, Patients search, form submit, 4), "New patient" (referral form, 2). Cause: add-patient.tsx:1076, patient-search.tsx:980 and 1016. Recommend: "Add patient". Severity: low. Confidence: high.

### T9. On phone, one page is called both "Tasks" and "Alerts"

Where: phone dock and phone Menu (390), desktop header (1280). Seen: the dock's "Tasks 12" and the Menu's "Alerts" row open the same /alerts page, whose browser tab says "Alerts"; desktop shows the bell as "Alerts 12". The code holds two Josh decisions that pull apart: "one name and one icon on every desk, the bell and Alerts" (31 Oct, ward-bar-controls.tsx:412) and "the dock says Tasks" (Q177, 1 Nov, ward-phone-menu.tsx:401). Recommend: Josh picks one; my pick is "Alerts" everywhere, since the page, bell and Menu already use it. Severity: low. Confidence: high.

### T10. Broadcast calls its recipients units, wards, desks, areas and screens

Where: Alerts > Broadcast, 1280 and 390. Seen in one dialog: "Choose units", "11 units" (x3, including the send button "Send bed call to 11 units"), "Ask wards for beds", "Metro adult wards", "Tell areas something", "Desks acknowledge", "ED desks", "Shows on 11 screens". Recipients include ED desks, so "units" and "wards" are both wrong for a mixed list. Evidence: evidence/T-10-broadcast-units.jpg. Cause: broadcast-composer.tsx:40, 42, 447, 467. Recommend: "desks" (the app's word for any recipient, as in "Go to a desk"). Severity: low. Confidence: high.

### T11. Internal or test words reach the screen

Where: Patient and Movement record ("Who to call" card), Tools, Activity, ED board tooltips, phone Menu. Seen: "Mock numbers" (2 screens, the only "mock" in the app; everywhere else says synthetic or invented). "Demo time 10:42" in Tools and Activity, while the header calls the same clock "Board time 10:42". ED tooltip "Flint, Oona is destination review, not bed pulled" reads a status code as a sentence (x2 per patient). Phone Menu "Data mode: Prototype". Cause: patient-now-layouts.tsx:101, patient-community-tab.tsx:530, ward-tasks-drawer.tsx:728 ("Mock numbers from On-call."); ward-bar.tsx:1299, ward-bar-activity.tsx:139. Recommend: say "Synthetic numbers" and "Board time", and phrase the tooltip as "Flint, Oona has no bed pulled yet". Severity: low. Confidence: high.

### T12. Screen-reader text says something different from the screen

Where: Movements (1280), ED board (1280 and 390), Home ED pressure strip. Seen: every visible name is "Flint, Oona", but 48 aria-labels say "Oona Flint" / "Sasha Quillcross" ("Actions for Oona Flint", "View patient details for Oona Flint", Movements timeline rows). On Home the ED tile shows "No forms due" while its spoken label says "No form due time recorded", which is a different fact (unknown, not none). Cause: home-ed-pressure.tsx:108; ED action menu and Movements timeline labels. Recommend: use "Surname, First" in labels too, and show "No due time recorded" on the tile. Severity: low. Confidence: high.

### T13. Page names drift between rail, browser tab and heading

Where: All EDs, Community, Weekly, Referrals/new, Home and Ward. Seen: rail and heading "All EDs" but tab "Emergency departments"; rail "Community", tab "All community teams", Places heading "Community mental health teams", Patient card "Catchment team" (community team 47, community mental health team 6, catchment team 3); Weekly heading "Weekly operations", tab "Weekly operations report", eyebrow "WEEKLY REPORT"; tab separator is "·" on Home and Ward ("Home · Ward Flow") but "—" on every other page. Cause: app/ward-flow/page.tsx:6 and app/ward-flow/ward/[unitId]/page.tsx:30. Recommend: browser tab equals the rail name plus " — Ward Flow", and "Community team" as the one term. Severity: low. Confidence: high.

## Could not check

Only 1280 and 390, light theme (wording does not change with theme). Only the Bed coordinator desk; Transport officer, Executive, ward and ED desks were not walked. These pop-ups did not open from my script, so their text is from source only: referral row drawer, ward bed drawer, ED patient details, Help, desktop More menu. Feature-flagged screens (other than Bed meeting TV) not seen. The Account desk "58 teams" versus 64 could be a deliberate subset; I did not trace the data.
