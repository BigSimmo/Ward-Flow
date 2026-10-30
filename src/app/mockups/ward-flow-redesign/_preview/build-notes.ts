/**
 * Preview only: what each React mock-up reuses from the app, what is new, and what is still open.
 * Shown under the design review's notes in the viewer.
 */
export const GROUND =
  "Built in React on 29 October 2026 from branch claude/core-pages-design-review-f5vf4g, which carries main at b6aa5cd (with #1109 Help) merged in. Each page reads the same synthetic world as /ward-flow, pinned to the 10:42 demo night, and is drawn inside the app's real menu and header. Synthetic data only. Nothing here is built into the app until Josh approves that page (D-74).";

export const BUILD_NOTES: Readonly<Record<string, readonly string[]>> = {
  movements: [
    "**Built from a copy of today's Movements screen**, so the timeline, worklist, drawer and every action work as they do now.",
    '**New:** the stage pipeline under the hero (each stage\'s count and oldest wait; choosing one highlights its rows), Tier 1 now in the side column above Transport now, every timeline name in full, and worklist rows that wrap instead of ending in "…".',
    "**Kept:** Compact and Roomy, the 12h/24h/48h zoom, corridors, Next in my queue and the phone layout.",
    "**Not yet redesigned:** the movement drawer that opens from a row is today's drawer (see Movement drawer under Page popups).",
  ],
  waiting: [
    "**Built from a copy of today's Waiting page** (the board and its wrapper), so filters, the person panel, escalation and the graphs work as they do now.",
    "**New:** Longest wait grouped by wait (over 24 hours all shown, over 8 hours the first four, under 8 hours folded), rows naming the ED by its short name, the daily check as one line, and the header's figures in one row with nothing overlapping.",
    '**Kept as today:** a recorded legal time still shows as time left ("6h 40m left"). The HTML mock-up showed "due 17:21, as recorded" instead. Which you prefer is your call under D-70.',
  ],
  eds: [
    "**Built from a copy of today's All EDs page**, so Cards, Table, Lanes, the filters and the preview drawer work as now.",
    '**New:** the title counts every department ("62 waiting across 10 EDs", with "8 have someone waiting" beside it), hospital names wrap on the cards, and departments with nobody waiting share one line with an Enter button each.',
  ],
  referrals: [
    "**Built from a copy of today's Referrals board**, so the queue, History, highlights, the keyboard shortcuts, the decline-reason rule and Accept presentation all work as now.",
    "**New:** queue rows wrap instead of cutting the patient line off, and Offered to wards is a table (patient, ward offered to, waiting time and what the wards have answered so far).",
    "**Decision pane:** Written history and Corrections fold behind one button, so Decline and Accept sit higher. The Timeline tab still shows them in full.",
    "**Kept as today:** the waiting chart already marks the 1, 4 and 24 hour due times, so it is unchanged here.",
    "**Your 30 October feedback:** the Filter queue box is gone on every device. On a phone the highlight chips wrap onto a second row instead of running off the edge, and the empty strip under Queue and History is gone.",
  ],
  "new-referral": [
    "**Built from a copy of today's referral slide-out**, in the same panel and steps, so finding a patient, the four steps, the Before you send list, Save draft and the ask-before-closing guard all work as now.",
    '**New:** the Catchment card says what is known in one line, then the four fields, then one row with Catchment not known and Confirm catchment. Today it says "not known" three ways before the first field. The suggested team box shows only once a team has been found.',
    "**Phone:** unchanged; the step list already reads well.",
  ],
  handover: [
    "**Built from a copy of today's Handover page**, so the shift switcher, the meeting-order groups, highlights, Copy summary, the downtime pack, Present and Print all work as now.",
    "**New:** Since previous handover is one line of figures instead of four large boxes. The hero's Changed since chip still hides and shows it.",
    "**New:** a sign-off bar stays at the foot of the screen while the table scrolls. It says how many checks are clear, names the ones still open, and has Open checklist and Sign off. Sign off sends the same command as the panel and is available exactly when the panel's is.",
    "**New:** Due by shows its first 4 rows, with the rest behind Show more.",
    "**Phone:** unchanged; it already keeps Sign off at the foot.",
  ],
  ward: [
    "**Today's My ward screen, with a redesign stylesheet on top.** Its main file and the bed tiles are each over the repository's 1,500-line limit, so they cannot be copied whole. Every bed, the filters, Place or move, This shift and Confirm numbers work exactly as now.",
    "**Applied here:** bed tiles show the whole name on up to two lines; the desktop toolbar shows On TV, Raise referral and Referral form, with Notices, Shift brief and Handover in More; Ward flow opens on its busiest list instead of an empty one.",
    "**To change in the real files once approved (not drawn here):** the heading states the ward's position (\"1 bed ready, 16 occupied\") with the facts line moved into the eyebrow; Ward flow's busiest-list default set where the list choice lives.",
    '**Found while building:** bed tiles and Notices write names first name first ("Gareth Ferrowmoor"). D-83 says surname first everywhere, so this needs a fix in the real tile.',
  ],
  stays: [
    "**Built from a copy of today's Stays and discharges board**, so the filters, the order, the length-of-stay bands, the bed record, the shift brief and Change ward all work as now.",
    "**New:** the same full-width hero as Ward home. It still carries everything the old card did: the ward name, site, locked split, Ready now and the band figures, the being-made-ready and constraint sentences, and the As at time.",
    "**New:** the ten day figures are one Also on this ward line, without the two the hero already shows. Worth a look and Your part in tomorrow's forecast sit in one notice. Bed cards are five to a row and names wrap.",
    "**The record column:** it stays on screen, as your ruling of 30 August keeps it, and now opens on the first bed that needs a look instead of sitting empty (point 16). Close leaves it empty for the rest of the visit.",
  ],
  "ed-board": [
    "**Built from a copy of today's ED board**, so the ED peer strip, the access-target card, the filter chips, Record exam, Log transport booking, the row menus, the patient record and On TV all work as now.",
    "**New:** one table. The Lists section under it repeated the same nine people, so on desktop it folds behind one closed row; nothing in it is lost. The Form column shows the form number, with the description in the record and the tooltip. Statewide capacity and Seen in the last 24 hours are one footer line.",
    "**To change in the real files once approved:** Medical clearance, Expects and Referred become chips on the board itself, which needs three new board filters; then the folded Lists can go.",
    '**Found while building:** the Lists write names first name first ("Noor Tremalow"). The board and D-83 put the surname first.',
  ],
  transport: [
    "**Built from a copy of today's Transport desk**, so Jobs and History, the escort and involuntary filters, both sort orders, the job panel, the forms pack and Copy handover all work as now.",
    '**New:** names are surname first at every width (D-83). The title stays "Transport" (your ruling of 27 October), with "13 jobs open · 8 moving, 5 waiting" beside it instead of a repeated eyebrow.',
    '**New:** routes read from first, then the ward ("PEEL → Maali (Ward 4.2)"), missing forms are marked under the count, and the Next column is wide enough that "Arrived at ward" is never cut off.',
  ],
  patients: [
    "**Today's Patients page, with a redesign stylesheet on top.** The review kept almost all of it, so the search with date of birth, the stage chips, highlights, the groups with Show all, and This shift all work as now.",
    '**New:** table cells wrap instead of ending in "…" ("Sent to 1 place", "RPH Community"), and the highlight chips wrap instead of running off the edge.',
    "**Tablet:** today's tablet table already drops the Heading to column and reads well, so it is unchanged.",
  ],
  discharges: [
    "**Built from a copy of today's Discharges page**, so the five filters, Now and History, Copy counts, Print list, Blocked first order and the release panel all work as now.",
    '**The totals (point 20, my pick for you to confirm):** the headline counts the rows listed, "59 to work now", with "of 207 open · 148 due in 2+ days, not listed" beside it. From the code: 207 is every release not yet gone; 59 are those due by tomorrow, past their date or held up; the filter\'s 63 is those 59 plus 4 discharged in the last day.',
    "**New:** each row leads with the person, then the ward and service, and has one action named for what it needs (Chase, Confirm date, Open). Each opens the release panel, where today's real actions are recorded.",
    "**New:** on wide screens the blocker counts sit beside the list; choosing one lights its rows. The Barriers tab still gives the full table.",
  ],
  wards: [
    "**Built from a copy of today's All wards page**, so the cards, the Table view, Occupancy by service, Counts to check and every filter work as now.",
    "**New:** Status, Cohort and Order are three menus beside the service tabs, so the controls take two short rows instead of four. The bed key and the ward count share one line above the cards.",
    '**New:** card text wraps ("Sir Charles Gairdner · Older adult") instead of ending in "…". The stale-count warning was already on the card and stays.',
    "**Point 21 (my pick for you to confirm):** All wards stays as the page to compare wards side by side. Capacity's bed map shows where the free beds are now, and Places becomes the directory to find a place.",
  ],
  statistics: [
    "**Built from a copy of today's Statistics page**, so the Network, Compare, Services, Wards, EDs, Teams and Weekly tabs, the 85% alert line, Samples and Export all work as now.",
    "**New:** Bed board, Journey and Map are one switch instead of three large cards, and Open a unit is one button beside it that shows today's unit finder in place, instead of a panel repeating the menu.",
    "**New:** summary first. Occupancy by service (with Empty to ready and Admission stages, which come with it) sits at the top, and the hospital chart lists its first 7 hospitals with Show all.",
  ],
  alerts: [
    "**Built from a copy of today's Alerts page**, so Now, Broadcast, Notices and History, the Urgency, Lanes and Owner views, Notify me, Copy for handover and every row action work as now.",
    '**New:** the Checking strip is one chip ("8 checks raised · 4 clear") that opens today\'s full list in place. The owner highlight is one menu instead of chips that ran off the panel.',
    '**New (point 17):** three or more alerts of one recorded kind in a row become one group row ("Transport awaiting departure · 5 people"), opened with Show each. It groups by kind only, never by wording, and each alert keeps its own row and action inside.',
    '**New:** the detail panel has one Release (for the pulled bed), with "Choose a reason first" written under it until a reason is chosen. The second button that also said Release meant handing the alert back, so it now says Hand back, on one row with More actions.',
    "**Not done here:** a Chase all button for a group. Each person's Chase transport is inside the group; one button acting on all five needs a new command, so it waits for your yes.",
  ],
  "legal-forms": [
    "**Built from a copy of today's Legal forms page** (split into two files to stay under the line cap), so Clocks, Checklist, History, Record a form, Add the time and Record and tell all work as now.",
    '**Kept word for word (point 22, D-77):** the "Not legally checked" notice. My pick is to keep it; say if you decide otherwise.',
    "**New (point 18, D5, D-70):** times show only as typed: \"Ends 11:42, as typed on the form\". The countdown, the band word and the progress bar that were worked out from the typed time are gone, here and on the phone. The rows' warning glyph and the Act now edge are today's own rules and stay.",
    '**New:** the form number stays in its tag and Form 1A\'s name is shortened to "Referral for examination" (the full title is in the record and the tooltip). Time not written shows its first 6 rows with Show more. Copy for handover and Record and tell are drawn as buttons, apart from the figures.',
  ],
  "out-of-area": [
    "**Built from a copy of today's Out of area page**, so Away now and History, the Days away, Region and Name orders, the filters, Plan next return, This shift and Ready to go home all work as now.",
    "**New (D-83):** every list and notice names the person surname first; the Name order now sorts by surname.",
    '**New:** the hero drops the hard-to-read "since the 08:30 bed meeting" strip (This shift carries the shift\'s changes) and the Checking line drops "Other records without home area or travel time 200", which was not about this list.',
    "**New:** Home regions is a column of bars that highlight their rows; a region's nearby confirmed beds open when you choose it, instead of every region listing its wards at once.",
  ],
  "bed-meeting-tv": [
    "**Built from a copy of today's bed meeting TV**, so Change screen, Full screen, Lock as TV, Leave TV view, the ward and ED screens, the live refresh and the read-only footer all work as now.",
    '**New:** each tile is one big figure and one short line ("7 locked · 3 bed types short"). What the tiles used to add in small print (the ward count not confirmed, beds being made ready, referrals with no reply) is one line under the tiles, or under the controls on a TV.',
    "**New (D-83):** Longest ED waits names people surname first. A long wait is marked with a red triangle instead of a red underline, which read as a link, in the waits list and the service table.",
    "**New on a laptop or desktop:** By health service, Beds that fit and Longest ED waits as three equal tables, so the service table no longer runs the full width with an empty middle; then Waiting by cause beside the Brief, whose four lines sit two by two in larger type.",
    "**On a TV:** today's 1080p layout (DR-02) is kept. With one-line tiles every panel, the Brief included, now shows in full on a 1080p screen; today's cuts the Brief off. Only the one-line footer sits just below.",
    '**Kept:** the phone\'s "needs a larger screen" message, the Act now and Watch tags, and the read-only footer.',
  ],
  governance: [
    "**Built from a copy of today's Governance workbench**, so the hero counts, the five header tabs (Review, Gaps by site, Audit trail, Registers, Reports), the filters, PIR chronology, Record review, Reviewed and Follow-up, and the phone layout all work as now.",
    "**Already done in today's screen:** the tabs moved into the header and outcomes show as a tick, cross or circle after the review was written, so those points needed no change.",
    '**New:** the review pane opens on the newest event waiting, with its facts, who opened the record and Reviewed or Follow-up, instead of "Choose an event". Closing it keeps it closed. On a phone or a portrait tablet the event still opens only when chosen, because there it covers the list.',
    '**New:** the What and Record cells wrap instead of ending in "…", and the list runs the height of the screen. On a phone the Review, Gaps and Reviewed switch is 48 px tall.',
    '**Kept:** the review count, PIR chronology and "Safety incidents not recorded here".',
    '**Still open:** on a portrait tablet the session summary under the list says "Choose an event" until one is chosen. It is the screen\'s resting state, so it is left as it is.',
  ],
  seclusion: [
    "**Built from a copy of today's Seclusion screen**, so the room status buttons (each asking first), Record start, Record end, Record incident, the typed-time checks and the ward-only recording rule (D-80) all work as now.",
    "**New:** one table of every secure ward's seclusion room (in use, available, out of service or not recorded), with what is in use, the last day's incident count and who last marked the room. The header counts rooms in each state. Rows needing a look come first.",
    "**New:** choosing a ward opens its record beside the table, on the first ward that needs a look rather than an empty panel. On a phone the record sits under the table and the page scrolls to it.",
    "**Which wards:** a secure ward here is one with locked beds, plus any ward with something recorded, so no record is hidden. Please confirm that is the right list.",
    "**Kept word for word:** the Operational view only notice. Nothing works out an order length, a review or a legal limit; times show as typed.",
    "**Demo night:** nothing is recorded yet, so every room starts as Not recorded. Marking a room or recording a start updates the table and header at once.",
  ],
  "on-call": [
    "**Today's On-call page, with a redesign stylesheet on top.** The review found it the right shape, so cover at Now, 22:00 and later, My list, Copy who is on, the downtime card, the directory and the detail pane (status, both numbers, email and escalation order, with Copy buttons) all work as now.",
    '**New:** the seven service lines are a compact two-line strip (line and number). "Until 20:00" shows on the chosen line and in its detail, rather than repeated on every card. On a laptop or phone the strip scrolls sideways instead of squeezing.',
    "**Not done here:** the filters still take two rows at 1440 px; one row needs the filter labels shortened in the real file.",
  ],
  home: [
    "**Built from a copy of today's Home screen**, so every list, filter, sheet and button works as it does now. The difference between the two files is the design change.",
    "**Changed from the HTML mock-up:** Placement no longer opens on the first item. Your Home v7 rule (22 October) says it opens only for the person the coordinator chooses, so the name is checked first. The card now names the oldest alert to place, with one button to open that person.",
    "**New:** Beds that fit as a small table (bed type by now and tomorrow), and the Checking line folded into one header chip that opens it.",
    "**Phone:** Registers and Alerts history sit under one More button beside the list tabs.",
  ],
  capacity: [
    "**Figures:** every number comes from the derivations today's Capacity page uses (bed gaps, the network ward rows, the beds forecast and the forecast model). The 48-hour figure is now the real forecast, so it is no longer illustrative.",
    "**New components:** the mismatch cards with a range line, the full-width bed forecast with a 7-day bar chart and a By ward view, the bed map cards with one square per bed, and the side column.",
    "**Reused unchanged:** the hero parts, Ready beds by road time, the ward panel that opens from a bed map card, Planned admissions and the Step down board.",
    "**Working actions:** Ask the ward sends the app's own request for a ward update; Try a scenario uses the app's scenario sum and saves nothing; the hero's ready figures and the Highlight chips light the matching wards.",
    "**Changed from the HTML mock-up:** the bed map has Grid and Rows. The Table layout is dropped because All wards is that table, so each ward is listed once.",
    '**Still open:** Planned admissions writes a typed name first name first ("Feodora Blennerhast"). That comes from the shared planned admissions panel, so it is fixed there, not on this page.',
  ],
};
