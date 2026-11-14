/**
 * Figure dictionary rows: EMERGENCY DEPARTMENTS (figures spec 3.2, D-220). Each row references its
 * function in its home module. No Statistics import here, so a route that shows ED figures does not
 * load Statistics (phone budget); the Statistics-only median is in `ed-statistics-figures.ts`.
 *
 * D-220: Statistics' over 8 h, over 24 h and wait bands count the Waiting in ED population, as
 * Waiting does; "ED journeys open" is its own figure (people in transit included).
 */
import { defineFigure } from "@/components/ward-management/figures/figure-row";
import { inEdOver, openEdJourneys, waitingInEds } from "@/components/ward-management/ward-shared-figures";
import {
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";

export const WAITING_IN_ED_FIGURE = defineFigure({
  id: "waiting-in-ed",
  name: "Waiting in ED",
  rule: "People still in an emergency department awaiting a bed: the journey is open, has no ED outcome, is not moving or arrived, and has no recorded departure.",
  window: "now",
  windowId: "now",
  population: "ED-origin journeys, people physically in the department",
  scope: "desk",
  status: "built",
  compute: waitingInEds,
  home: "`waitingInEds` (`ward-shared-figures.ts`), over `isWaitingInEd` (`ward-ed-presence.ts`)",
  how: [
    "People still in the department, including those accepted or with a bed pulled who are not yet collected.",
    "People in transit, ward transfers and community referrals are not counted.",
  ],
  basis: "L1 (12 Oct 2026); overall review 20 Oct 2026; D-220",
  rail: { id: "delays" },
});

export const ED_JOURNEYS_OPEN_FIGURE = defineFigure({
  id: "ed-journeys-open",
  name: "ED journeys open",
  rule: "Every open ED-origin journey, including people already on the road to a ward.",
  window: "now",
  windowId: "now",
  population: "ED-origin journeys, open",
  scope: "desk",
  status: "built",
  compute: openEdJourneys,
  home: "`openEdJourneys` (`ward-shared-figures.ts`)",
  how: ["People still in the department plus people in transit.", "Not the same figure as Waiting in ED."],
  basis: "D-220 (kept as its own labelled figure)",
});

export const IN_TRANSIT_FIGURE = defineFigure({
  id: "in-transit",
  name: "In transit",
  rule: "Open ED-origin journeys whose person has left the department for a ward.",
  window: "now",
  windowId: "now",
  population: "ED-origin journeys, open, left the department",
  scope: "desk",
  status: "built",
  compute: openEdJourneys,
  home: "`openEdJourneys(...).inTransit` (`ward-shared-figures.ts`)",
  how: ["ED journeys open less Waiting in ED."],
  basis: "D-220",
});

export const ED_OVER_8H_FIGURE = defineFigure({
  id: "ed-over-8h",
  name: `Over ${ED_SEVERE_PRESSURE_WAIT_MINUTES / 60} h in ED`,
  rule: `People waiting in ED who have been in the department ${ED_SEVERE_PRESSURE_WAIT_MINUTES / 60} hours or more, counted from the journey's start.`,
  window: "now",
  windowId: "ed-wait",
  population: "Waiting in ED",
  scope: "desk",
  status: "built",
  compute: inEdOver,
  home: "`inEdOver` (`ward-shared-figures.ts`) with `ED_SEVERE_PRESSURE_WAIT_MINUTES`",
  how: ["Counted from the journey's start in the ED (WF-02: time in ED).", "People in transit are not counted."],
  basis: "NA2-10; D-220 (Statistics counts the Waiting in ED population)",
});

export const ED_OVER_24H_FIGURE = defineFigure({
  id: "ed-over-24h",
  name: `Over ${LONG_WAIT_MINUTES / 60} h in ED`,
  rule: `People waiting in ED who have been in the department ${LONG_WAIT_MINUTES / 60} hours or more, counted from the journey's start.`,
  window: "now",
  windowId: "ed-wait",
  population: "Waiting in ED",
  scope: "desk",
  status: "built",
  compute: inEdOver,
  home: "`inEdOver` (`ward-shared-figures.ts`) with `LONG_WAIT_MINUTES`",
  how: ["Counted from the journey's start in the ED (WF-02: time in ED).", "People in transit are not counted."],
  basis: "NA3-03; D-220 (Statistics counts the Waiting in ED population)",
});
