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
