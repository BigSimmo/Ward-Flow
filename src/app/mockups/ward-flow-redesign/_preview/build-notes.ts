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
