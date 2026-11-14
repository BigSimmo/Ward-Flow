/**
 * Figure dictionary rows: BEDS (figures spec 3.2, D-220). Each row references its function in its
 * home module; nothing here works a figure out. See `figure-row.ts`.
 */
import { bedKindTotals } from "@/components/ward-management/capacity/capacity-derivations";
import { needsABed, noWardYet } from "@/components/ward-management/figures/bed-demand";
import { defineFigure } from "@/components/ward-management/figures/figure-row";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { overLineLabel } from "@/components/ward-management/shell-next/next-rail-parts";
import { occupancyPercent } from "@/components/ward-management/statistics/statistics-occupancy";
import { readyBedsNow, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { wardBedsInUse } from "@/components/ward-management/ward-occupancy";

export const BEDS_IN_USE_FIGURE = defineFigure({
  id: "beds-in-use",
  name: "Beds in use",
  rule: "Beds Occupied or Pulled. Leave is a marker inside Occupied, never a separate bed.",
  window: "now",
  windowId: "now",
  population: "Beds on the wards counted",
  scope: "desk",
  status: "built",
  compute: wardBedsInUse,
  home: "`wardBedsInUse` (`ward-occupancy.ts`)",
  how: ["Occupied beds plus beds pulled for an incoming patient.", "A bed on leave stays Occupied."],
  basis: "L1 (site review, 12 Oct 2026), WF-16",
});

export const OCCUPANCY_FIGURE = defineFigure({
  id: "occupancy",
  name: "In use %",
  rule: "Beds in use as a whole percentage of the beds counted; a ward with no beds reads No beds, never 0%.",
  window: "now",
  windowId: "now",
  population: "Beds on the wards counted",
  scope: "desk",
  status: "built",
  compute: occupancyPercent,
  home: "`occupancyPercent` and `occupancyText` (`statistics/statistics-occupancy.ts`)",
  how: [
    "Beds in use (Occupied plus Pulled), divided by the beds counted, rounded to a whole percent.",
    "The amber mark reads the same rounded percent (PR A's one tone helper).",
  ],
  basis: "L1, D-125, D-191 item 4",
});

export const AT_OR_OVER_LINE_FIGURE = defineFigure({
  id: "at-or-over-line",
  name: `At or over ${BED_ALERT_THRESHOLD_PERCENT}% full`,
  rule: `Services whose rounded occupancy is at or over ${BED_ALERT_THRESHOLD_PERCENT}%, counted over every service, not only the rows shown.`,
  window: "now",
  windowId: "now",
  population: "Every health service",
  scope: "network",
  status: "built",
  compute: overLineLabel,
  home: "`overLineLabel(...).over` (`shell-next/next-rail-parts.tsx`), over `isBedAlert` (`shell/ward-service-bed-alerts.ts`); PR A, RV1a-7",
  how: [
    `A service counts when its whole percent in use is ${BED_ALERT_THRESHOLD_PERCENT}% or more.`,
    "Every service is counted, whether or not its row is shown.",
  ],
  basis: "Signed threshold (D-109); RV1a-7 (PR A)",
});

export const READY_NOW_FIGURE = defineFigure({
  id: "ready-now",
  name: "Beds ready now",
  rule: "Beds ready to take a patient now, leaving out a bed pulled for an incoming patient and a bed named for an accepted referral.",
  window: "now",
  windowId: "now",
  population: "Beds on the desk's wards",
  scope: "desk",
  status: "built",
  compute: totalReadyBedsNow,
  home: "`totalReadyBedsNow` (`ward-bed-states.ts`), with the network's named holds (`networkNamedHolds`; PR A)",
  how: [
    "Free beds that are made up and not held.",
    "A bed pulled for an incoming patient, or named for an accepted referral, is not ready.",
  ],
  basis: "D-210, D-115, Audit 6 (20 Oct 2026)",
  rail: { id: "capacity" },
});

export const READY_ON_WARD_FIGURE = defineFigure({
  id: "ready-on-ward",
  name: "Ready, this ward",
  rule: "Beds ready now on one ward, by the same rule as Beds ready now.",
  window: "now",
  windowId: "now",
  population: "Beds on one ward",
  scope: "ward",
  status: "built",
  compute: readyBedsNow,
  home: "`readyBedsNow` (`ward-bed-states.ts`)",
  how: ["The same rule as Beds ready now, for one ward."],
  basis: "R-B-09",
});

export const NEED_A_BED_FIGURE = defineFigure({
  id: "need-a-bed",
  name: "Need a bed",
  rule: "Open journeys from any origin not yet holding a bed: no ward has accepted, or a ward accepted and no bed is pulled or named.",
  window: "now",
  windowId: "now",
  population: "Open journeys, any origin, network-wide",
  scope: "network",
  status: "built",
  compute: needsABed,
  home: "`needsABed` (`figures/bed-demand.ts`)",
  how: [
    "Every open journey, from an ED, a ward or the community, still waiting for a bed.",
    "A journey with an admission, an allocated bed or a named bed already holds one and is not counted.",
  ],
  basis: "Clinical owner ruling 14 Oct 2026; D-220 (the name)",
});

export const SHORT_FIGURE = defineFigure({
  id: "short",
  name: "Short",
  rule: "Need a bed less the ready beds that fit each person's bed kind, summed over the bed kinds.",
  window: "now",
  windowId: "now",
  population: "Open journeys needing a bed, against ready beds, network-wide",
  scope: "network",
  status: "built",
  compute: bedKindTotals,
  home: "`bedKindTotals(...).gap` over `bedKindGaps` (`capacity/capacity-derivations.ts`)",
  how: ["For each bed kind, the people needing that kind less the ready beds that fit it.", "Never below 0."],
  basis: "D-191 item 6",
});

export const NO_WARD_YET_FIGURE = defineFigure({
  id: "no-ward-yet",
  name: "No ward yet",
  rule: "Open journeys from any origin that no ward has accepted yet.",
  window: "now",
  windowId: "now",
  population: "Open journeys on the desk's list, any origin",
  scope: "desk",
  status: "built",
  compute: noWardYet,
  home: "`noWardYet` (`figures/bed-demand.ts`)",
  how: [
    "Open journeys still at referral or under review by a ward.",
    "Need a bed also counts journeys a ward has accepted that wait for the bed to be pulled.",
  ],
  basis: "D-220 (Home's stage tab and the TV lane become No ward yet)",
});
