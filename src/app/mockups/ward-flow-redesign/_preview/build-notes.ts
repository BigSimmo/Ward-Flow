/**
 * Preview only: what each React mock-up reuses from the app, what is new, and what is still open.
 * Shown under the design review's notes in the viewer.
 */
export const GROUND =
  "Built in React on 29 October 2026 from branch claude/core-pages-design-review-f5vf4g, which carries main at b6aa5cd (with #1109 Help) merged in. Each page reads the same synthetic world as /ward-flow, pinned to the 10:42 demo night, and is drawn inside the app's real menu and header. Synthetic data only. Nothing here is built into the app until Josh approves that page (D-74).";

export const BUILD_NOTES: Readonly<Record<string, readonly string[]>> = {
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
