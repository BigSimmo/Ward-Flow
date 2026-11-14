/**
 * Figure dictionary rows: DISCHARGES (figures spec 3.2, D-220). Each row references its function in
 * its home module; see `figure-row.ts`.
 *
 * D-220: "Held up" on Statistics is the D-191 item 5 figure (by tomorrow), as on Capacity; every
 * any-date count reads "Held up · any date".
 *
 * Four rows are RESERVED for PR A (R-FIGS-12, R-FIGS-16): it builds Left today, Expected to leave
 * today, Average completed stay and Stay so far. The rows hold the names so nothing else takes them;
 * `compute` is `null` until PR A lands and the row wraps its function.
 */
import { defineFigure } from "@/components/ward-management/figures/figure-row";
import { blockedDischargesByReason } from "@/components/ward-management/statistics/statistics-derivations";
import {
  HELD_UP_ANY_DATE_LABEL,
  HELD_UP_BY_TOMORROW_LABEL,
  heldUpDueByTomorrow,
} from "@/components/ward-management/ward-held-up";

export const HELD_UP_FIGURE = defineFigure({
  id: "held-up",
  name: HELD_UP_BY_TOMORROW_LABEL,
  rule: "Open bed releases with a recorded blocker, due by tomorrow: an overdue date, today or tomorrow.",
  window: "by tomorrow",
  windowId: "by-tomorrow",
  population: "Bed releases not yet discharged",
  scope: "desk",
  status: "built",
  compute: heldUpDueByTomorrow,
  home: "`heldUpDueByTomorrow` (`ward-held-up.ts`, rule in `ward-bed-availability.ts`)",
  how: [
    "A release with a blocker recorded, due on an overdue date, today or tomorrow.",
    "A later date is not counted.",
  ],
  basis: "D-191 item 5; D-220 (Statistics too)",
  rail: { id: "discharges" },
});

export const HELD_UP_ANY_DATE_FIGURE = defineFigure({
  id: "held-up-any-date",
  name: HELD_UP_ANY_DATE_LABEL,
  rule: "Current stays with a recorded discharge blocker, whatever the date.",
  window: "any date",
  windowId: "any-date",
  population: "Stays that have not ended",
  scope: "desk",
  status: "built",
  compute: blockedDischargesByReason,
  home: "`blockedDischargesByReason(...).totalCount` (`statistics/statistics-derivations.ts`)",
  how: ["Every current stay with a blocker recorded, whatever its planned date."],
  basis: "D-191 item 5; D-220",
});

export const LEFT_TODAY_FIGURE = defineFigure({
  id: "left-today",
  name: "Left today",
  rule: "Reserved: PR A builds this figure and its rule (R-FIGS-12).",
  window: "today",
  windowId: "today",
  population: "Reserved for PR A",
  scope: "desk",
  status: "reserved",
  compute: null,
  home: "PR A",
  how: [],
  basis: "Reserved: PR A builds (R-FIGS-12)",
});

export const EXPECTED_TO_LEAVE_TODAY_FIGURE = defineFigure({
  id: "expected-to-leave-today",
  name: "Expected to leave today",
  rule: "Reserved: PR A builds this figure and its rule (R-FIGS-12).",
  window: "today",
  windowId: "today",
  population: "Reserved for PR A",
  scope: "desk",
  status: "reserved",
  compute: null,
  home: "PR A",
  how: [],
  basis: "Reserved: PR A builds (R-FIGS-12)",
});

export const AVERAGE_COMPLETED_STAY_FIGURE = defineFigure({
  id: "average-completed-stay",
  name: "Average completed stay",
  rule: "Reserved: PR A builds this figure and its rule (R-FIGS-16).",
  window: "any date",
  windowId: "any-date",
  population: "Reserved for PR A",
  scope: "desk",
  status: "reserved",
  compute: null,
  home: "PR A",
  how: [],
  basis: "Reserved: PR A builds (R-FIGS-16); window to rule",
});

export const STAY_SO_FAR_FIGURE = defineFigure({
  id: "stay-so-far",
  name: "Stay so far",
  rule: "Reserved: PR A builds this figure and its rule (R-FIGS-16).",
  window: "now",
  windowId: "now",
  population: "Reserved for PR A",
  scope: "desk",
  status: "reserved",
  compute: null,
  home: "PR A",
  how: [],
  basis: "Reserved: PR A builds (R-FIGS-16)",
});
