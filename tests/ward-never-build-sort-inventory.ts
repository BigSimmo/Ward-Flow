/*
 * Never-build sort inventory (audit M116, 10 Nov 2026; ruling D-71, with D-110's neutral fit line).
 *
 * D-71: no suggested, ranked, capped or pre-selected ward anywhere; waiting lists in wait order;
 * candidate wards in a fixed order within each fit group; "nearest ready beds" only as distance.
 * This file declares the order of the lists of wards, beds and patients in
 * `src/components/ward-management`, one entry per `.sort(` or `.toSorted(` call, so the order is a
 * written decision rather than an accident. `ward-never-build-sort-inventory.test.ts` fails when a
 * comparator keyed on ready, free, occupancy, fit, score, rank or a like word appears without an
 * entry here, and when an entry no longer matches its file.
 *
 * Classes:
 * - "wait order": oldest first by a recorded time (D-32, D-71 item 3), or a recorded-time order.
 * - "fixed order": alphabetical, bed number, health service then name, or a fixed table of states.
 * - "capacity display": a statistics or capacity read-out ordered by a count, with no pick, pull
 *   or ask action on the list.
 * - "NEEDS JOSH": a capacity-ordered list next to a pick, pull or ask action, a "most ready" or
 *   "ranked" headline, or a catchment-first pick list. Listed for Josh to rule on; this audit does
 *   not change them. Once Josh rules and the list changes, its entry changes with it.
 *
 * `file` is relative to `src/components/ward-management`. `match` is text inside the call's
 * parentheses with runs of white space folded to one space; it must match exactly `occurrences`
 * calls in that file (default 1). Line numbers are worked out by the test, so an edit above a
 * call does not make an entry stale.
 */

export const SORT_ORDER_CLASSES = ["wait order", "fixed order", "capacity display", "NEEDS JOSH"] as const;
export type SortOrderClass = (typeof SORT_ORDER_CLASSES)[number];

export type SortedList = "wards" | "beds" | "patients" | "places" | "other";

export type SortInventoryEntry = {
  file: string;
  match: string;
  occurrences?: number;
  list: SortedList;
  key: string;
  order: SortOrderClass;
  reason: string;
};

export const SORT_INVENTORY: readonly SortInventoryEntry[] = [
  // ---------------------------------------------------------------- NEEDS JOSH
  {
    file: "handover/handover-beds.tsx",
    match: "b.ready - a.ready || a.name.localeCompare(b.name)",
    list: "wards",
    key: "ready beds, most first; then ward name (within each health service)",
    order: "NEEDS JOSH",
    reason:
      "The desktop handover Beds table puts the ward with most ready beds at the top of each service, under the 'waiting for a bed' count, and each row opens the ward.",
  },
  {
    file: "handover/handover-phone.tsx",
    match: "b.ready - a.ready || a.name.localeCompare(b.name)",
    list: "wards",
    key: "ready beds, most first; then ward name (within each health service)",
    order: "NEEDS JOSH",
    reason: "The phone handover Beds view orders each service's wards most ready beds first.",
  },
  {
    file: "wards/ward-index.tsx",
    match:
      'if (order === "most-ready") return b.ready - a.ready || serviceRank(a) - serviceRank(b); if (order === "fullest") return b.occupancy - a.occupancy',
    list: "wards",
    key: "user choice: service (default), 'Most ready' (ready beds, most first) or 'Fullest' (occupancy)",
    order: "NEEDS JOSH",
    reason:
      "The Wards index offers an Order choice labelled 'Most ready' that re-sorts the ward cards a person opens wards from by ready beds; the default is health service order.",
  },
  {
    file: "wards/ward-index.tsx",
    match: "b.ready - a.ready || a.unit.name.localeCompare(b.unit.name)",
    list: "wards",
    key: "ready beds, most first; then ward name; first row only",
    order: "NEEDS JOSH",
    reason:
      "Picks one ward for the Wards hero chip 'Most ready: <ward>', a one-tap link to that ward: a single named ward headlined by free beds.",
  },
  {
    file: "statistics/statistics-map-view.tsx",
    match: "compareSites(a, b, lens)",
    list: "places",
    key: "the map lens figure (ready beds on the Beds lens), most first; then site name",
    order: "NEEDS JOSH",
    reason:
      "The Statistics map's numbered rank list, titled 'Most ready beds' on the Beds lens, ranks sites 1, 2, 3 by ready beds and links each to a ward.",
  },
  {
    file: "statistics/statistics-map-view.tsx",
    match: "const left = score(a); const right = score(b);",
    list: "wards",
    key: "the map lens figure per ward (ready beds on the Beds lens), most first; first row only",
    order: "NEEDS JOSH",
    reason:
      "Chooses the 'lead ward' each ranked site row names and opens: on the Beds lens, the site's ward with most ready beds.",
  },
  {
    file: "statistics/statistics-screen.tsx",
    match: "right.ready - left.ready || left.name.localeCompare(right.name)",
    list: "wards",
    key: "ready beds, most first; then ward name",
    order: "NEEDS JOSH",
    reason:
      "The Statistics finder, where a person picks a ward to open, lists wards most ready beds first rather than A to Z.",
  },
  {
    file: "capacity/capacity-derivations.ts",
    match: "y.beds - x.beds || x.unit.name.localeCompare(y.unit.name)",
    list: "wards",
    key: "ready beds of the needed kind, most first; then ward name",
    order: "NEEDS JOSH",
    reason:
      "The Capacity mismatch pop-up lists 'Ready beds that fit' a waiting group most fitting beds first, beside those waiting people, and each ward row is a button.",
  },
  {
    file: "referrals/referral-destination-options.ts",
    match: "compareOptions",
    list: "places",
    key: "catchment-placed destination kind first, flagged 'suggested'; then label",
    order: "NEEDS JOSH",
    reason:
      "Orders the referral destination kinds (ward, ED, community team) catchment-first and marks that one 'suggested'; no screen calls it today, so nothing is shown yet.",
  },
  {
    file: "referrals/ward-referral-drawer-placement-step.tsx",
    match: "Number(b === catchmentTeam) - Number(a === catchmentTeam) || a.localeCompare(b)",
    list: "places",
    key: "the patient's catchment community team first; then A to Z",
    order: "NEEDS JOSH",
    reason:
      "The referral drawer's community team pick list puts the catchment team first, above a cut-off list of teams; teams are not wards, so D-71 may not reach it.",
  },
  {
    file: "movements/movement-horizon-gantt.tsx",
    match: "b.total - a.total || a.originEdId.localeCompare(b.originEdId)",
    list: "places",
    key: "patients on the corridor, most first; then ED id",
    order: "NEEDS JOSH",
    reason:
      "The Movements horizon side rail is labelled 'Ranked corridors' (its aria-label) and lists ED-to-ward corridors busiest first.",
  },

  // ---------------------------------------------------------------- capacity display
  {
    file: "movements/movement-horizon-gantt.tsx",
    match: "b.total - a.total)",
    list: "wards",
    key: "declines, most first",
    order: "capacity display",
    reason:
      "Declined corridors grouped by the declining ward, most declines first; a history count with no pick action.",
  },
  {
    file: "statistics/statistics-journey-view.tsx",
    match: "b.ready - a.ready || a.name.localeCompare(b.name)",
    occurrences: 2,
    list: "places",
    key: "ready beds, most first; then hospital name",
    order: "capacity display",
    reason:
      "Statistics journey view: hospitals with a ready bed, most first (desk and executive); a read-out with no pick action.",
  },
  {
    file: "statistics/statistics-summary-phone.tsx",
    match: "b.ready - a.ready || b.percent - a.percent || a.name.localeCompare(b.name)",
    occurrences: 2,
    list: "wards",
    key: "ready beds, most first; then occupancy; then name",
    order: "capacity display",
    reason:
      "Statistics phone summary lists hospitals and wards 'by beds ready', first eight then Show all; rows open statistics pages, not a placement.",
  },
  {
    file: "statistics/statistics-summary-phone.tsx",
    match: "(a, b) => b.percent - a.percent",
    list: "wards",
    key: "occupancy percent, fullest first",
    order: "capacity display",
    reason: "'Where the pressure is' sheet: wards over the alert line, fullest first, as its caption says.",
  },
  {
    file: "statistics/statistics-map-view.tsx",
    match: "b.ready - a.ready || a.service.localeCompare(b.service)",
    list: "places",
    key: "ready beds, most first; then service name",
    order: "capacity display",
    reason: "'Ready beds by health service' bar list on the Statistics map; services, not wards, and no pick action.",
  },
  {
    file: "statistics/statistics-map-view.tsx",
    match: 'compareSites(a, b, "ed")',
    list: "places",
    key: "open ED movements, most first; then longest wait; then name",
    order: "capacity display",
    reason: "EDs by open movements on the Statistics map; EDs are not a ward pick.",
  },
  {
    file: "statistics/statistics-capacity-chart.tsx",
    match:
      'sort === "ready" ? b.ready - a.ready : sort === "beds" ? b.beds - a.beds : sort === "occupancy" ? occupancyOf(b) - occupancyOf(a)',
    list: "wards",
    key: "user column: ready (default), beds, occupancy or name",
    order: "capacity display",
    reason: "Statistics capacity bar chart with a sort control; a chart of bed states with no pick action.",
  },
  {
    file: "statistics/hospital-capacity-matrix.tsx",
    match: "const av = value(a); const bv = value(b);",
    list: "wards",
    key: "user column, default occupancy rate descending",
    order: "capacity display",
    reason: "Sortable hospital capacity table in Statistics; column headers sort it, no pick action.",
  },
  {
    file: "statistics/statistics-wards-card.tsx",
    match: "const vA = value(a); const vB = value(b);",
    list: "wards",
    key: "user column, default occupancy",
    order: "capacity display",
    reason: "Sortable wards table in Statistics; column headers sort it, no pick action.",
  },
  {
    file: "statistics/statistics-wards-index.tsx",
    match: "b.rate - a.rate || a.name.localeCompare(b.name)",
    list: "wards",
    key: "occupancy rate, fullest first; then name",
    order: "capacity display",
    reason: "Statistics wards index, fullest first (redesign order approved 1 Nov 2026, Q135).",
  },
  {
    file: "statistics/statistics-overview-screen.tsx",
    match: "b.rate - a.rate || a.name.localeCompare(b.name)",
    list: "wards",
    key: "occupancy rate, fullest first; then name",
    order: "capacity display",
    reason: "Statistics overview phone ward list, fullest first; rows open statistics.",
  },
  {
    file: "statistics/statistics-service-screen.tsx",
    match: "b.rate - a.rate || a.unit.name.localeCompare(b.unit.name)",
    list: "wards",
    key: "occupancy rate, fullest first; then name",
    order: "capacity display",
    reason: "A service's wards on its Statistics page, fullest first.",
  },
  {
    file: "capacity/capacity-expected-occupancy.tsx",
    match: "byLastHorizonFullness",
    list: "wards",
    key: "expected occupancy at the last forecast hour, fullest first",
    order: "capacity display",
    reason: "Expected occupancy forecast table, folded after a few wards; a forecast read-out with no pick action.",
  },
  {
    file: "forecast/forecast-levers.ts",
    match: "b.likelyUplift - a.likelyUplift || b.beds - a.beds",
    list: "other",
    key: "likely beds freed, most first",
    order: "capacity display",
    reason: "Forecast levers (kinds of discharge work), not wards or patients.",
  },
  {
    file: "shell/ward-rail-parts.tsx",
    match: "b.occupancyPercent - a.occupancyPercent",
    list: "places",
    key: "service occupancy, fullest first; first row only",
    order: "capacity display",
    reason: "Rail capacity card names the fullest service as a pressure figure; no pick action.",
  },
  {
    file: "shell/ward-rail.tsx",
    match: "b.occupancyPercent - a.occupancyPercent",
    list: "places",
    key: "service occupancy, fullest first; first row only",
    order: "capacity display",
    reason: "Rail capacity card names the fullest service as a pressure figure; no pick action.",
  },
  {
    file: "shell-next/next-rail-body.tsx",
    match: "b.occupancyPercent - a.occupancyPercent",
    list: "places",
    key: "service occupancy, fullest first; first row only",
    order: "capacity display",
    reason: "Next shell rail capacity card, the same fullest-service figure.",
  },
  {
    file: "shell-next/next-rail-parts.tsx",
    match: "b.occupancyPercent - a.occupancyPercent",
    list: "places",
    key: "service occupancy, fullest first; first row only",
    order: "capacity display",
    reason: "Next shell rail capacity card, the same fullest-service figure.",
  },
  {
    file: "shell/ward-executive-chrome.tsx",
    match: "servicePercent(b) - servicePercent(a) || a.service.localeCompare(b.service)",
    list: "places",
    key: "service occupancy, fullest first; then name",
    order: "capacity display",
    reason: "Executive rail capacity card from the public report; services, read-only.",
  },
  {
    file: "ed/ed-index.tsx",
    match: 'if (order === "most") return b.summary.waiting - a.summary.waiting || serviceRank(a) - serviceRank(b);',
    list: "places",
    key: "user choice: longest wait (default), most waiting or service",
    order: "capacity display",
    reason: "EDs on the ED index ordered by pressure; EDs are where people wait, not a ward pick.",
  },
  {
    file: "coordinator/home-ed-pressure.tsx",
    match: "b.longestWaitMinutes - a.longestWaitMinutes || b.waiting - a.waiting",
    list: "places",
    key: "longest wait, then waiting count",
    order: "capacity display",
    reason: "Home ED pressure card: EDs by longest wait; not a ward pick.",
  },
  {
    file: "ward-pressure.ts",
    match: "b.breaching - a.breaching || b.longestWaitMinutes - a.longestWaitMinutes",
    list: "places",
    key: "people past the access target, then longest wait, then waiting",
    order: "capacity display",
    reason: "ED pressure ordering; EDs, not a ward pick.",
  },

  // ---------------------------------------------------------------- fixed order
  {
    file: "bed-meeting/tv-derivations.ts",
    match: "a.unit.name.localeCompare(b.unit.name)",
    list: "wards",
    key: "ward name A to Z (wards with a ready bed only)",
    order: "fixed order",
    reason:
      "D-126 (10 Nov 2026): the ED wall TV's 'Beds ready in <service>' panel lists wards A to Z, not most beds first, so the row cut beside the waiting list favours no ward.",
  },
  {
    file: "ward-derivations-shortlist.ts",
    match: "rankOf(a.availability) - rankOf(b.availability) || byServiceThenName(a.unit, b.unit)",
    list: "wards",
    key: "fit group (eligible, overridable, unavailable), then health service, then ward name",
    order: "fixed order",
    reason:
      "D-71 item 6 and D-110: fit groups with a fixed service-then-name order inside each; no free-bed or catchment tier.",
  },
  {
    file: "ward-derivations-shortlist.ts",
    match: "Number(b.verdict.eligible) - Number(a.verdict.eligible) || byServiceThenName(a.unit, b.unit)",
    list: "wards",
    key: "eligible first (fit group), then health service, then ward name",
    order: "fixed order",
    reason:
      "Eligible candidates: the fit group then a fixed order; every ward kept, no cap (pinned by the drift guard).",
  },
  {
    file: "out-of-area/out-of-area-model.ts",
    match: "(ROAD_RANK[a.band] ?? 0) - (ROAD_RANK[b.band] ?? 0) || a.unit.name.localeCompare(b.unit.name",
    list: "wards",
    key: "road-time band, then ward name A to Z",
    order: "fixed order",
    reason:
      "Closer beds for a patient away from home: D-71 item 6's distance-only order, A to Z within each band, never most beds first.",
  },
  {
    file: "referrals/find-a-ward.tsx",
    match: "byName",
    occurrences: 2,
    list: "wards",
    key: "fit group (fits / to review), then ward name",
    order: "fixed order",
    reason: "Find a ward: the two fit groups each A to Z.",
  },
  {
    file: "referrals/referral-ask-more-wards.tsx",
    match: "a.name.localeCompare(b.name)",
    list: "wards",
    key: "ward name",
    order: "fixed order",
    reason: "Ask more wards: wards not yet asked, A to Z (D-71 item 2).",
  },
  {
    file: "referrals/use-ward-referral-drawer-state.ts",
    match: '(a.healthService ?? "~").localeCompare(b.healthService ?? "~") || a.name.localeCompare(b.name)',
    list: "wards",
    key: "health service, then ward name",
    order: "fixed order",
    reason: "Referral drawer ward choices: fixed neutral order, never catchment first or most ready (D-71 item 6).",
  },
  {
    file: "referrals/referral-commitments-panel.tsx",
    match: "a.name.localeCompare(b.name)",
    list: "wards",
    key: "ward name",
    order: "fixed order",
    reason: "Wards a referral is committed to, A to Z.",
  },
  {
    file: "referrals/referral-owner-and-calls-panel.tsx",
    match: "(a, b) => a.name.localeCompare(b.name)",
    occurrences: 2,
    list: "wards",
    key: "ward name; community team name",
    order: "fixed order",
    reason: "Ward and community team choices for an owner or call, each A to Z.",
  },
  {
    file: "ward-step-down.ts",
    match: "a.unit.name.localeCompare(b.unit.name)",
    list: "wards",
    key: "ward name",
    order: "fixed order",
    reason: "Step-down destination wards, A to Z.",
  },
  {
    file: "ward-derivations.ts",
    match: "serviceOf(a.unit).localeCompare(serviceOf(b.unit)) || a.unit.name.localeCompare(b.unit.name)",
    list: "wards",
    key: "health service, then ward name",
    order: "fixed order",
    reason: "Ward rows in a fixed service-then-name order.",
  },
  {
    file: "patients/patient-transit-operations.tsx",
    match: "a.unit.name.localeCompare(b.unit.name)",
    list: "wards",
    key: "ward name",
    order: "fixed order",
    reason: "Transit wards on a patient record, A to Z.",
  },
  {
    file: "bed-meeting/bed-meeting-tv.tsx",
    match: "(a, b) => a.name.localeCompare(b.name)",
    occurrences: 2,
    list: "wards",
    key: "ward name; ED name",
    order: "fixed order",
    reason: "Bed meeting TV ward and ED pickers, each A to Z.",
  },
  {
    file: "shell/ward-my-wards.tsx",
    match: 'left.name.localeCompare(right.name, "en-AU")',
    list: "wards",
    key: "ward name",
    order: "fixed order",
    reason: "My wards menu, A to Z.",
  },
  {
    file: "hub/hub-screen.tsx",
    match: "a.name.localeCompare(b.name)",
    list: "places",
    key: "name",
    order: "fixed order",
    reason: "Hub places A to Z.",
  },
  {
    file: "settings/workstation-desks.ts",
    match: "serviceRank(a.service) - serviceRank(b.service) || a.site.localeCompare(b.site)",
    list: "places",
    key: "fixed health service order, then site",
    order: "fixed order",
    reason: "Workstation desks in the fixed service order; 'rank' here is the service's place in a fixed list.",
  },
  {
    file: "ward/ward-walk-round.tsx",
    match: "left.bedNumber - right.bedNumber",
    list: "beds",
    key: "bed number",
    order: "fixed order",
    reason: "Walk round in bed number order.",
  },
  {
    file: "ward/ward-phone-round-list.tsx",
    match: "Number(left.bed.bedNumber) - Number(right.bed.bedNumber)",
    list: "beds",
    key: "bed number",
    order: "fixed order",
    reason: "Phone round list in bed number order.",
  },
  {
    file: "ward/ward-screen-derivations.ts",
    match: "(left, right) => left.bedNumber - right.bedNumber",
    list: "beds",
    key: "bed number",
    order: "fixed order",
    reason: "Ward bed tiles in bed number order.",
  },
  {
    file: "ward/ward-screen-derivations.ts",
    match: "acceptedRank(left) - acceptedRank(right)",
    list: "beds",
    key: "position of the pulling movement in the accepted list",
    order: "fixed order",
    reason: "Pulled beds keep their movements' order (CS-01); 'rank' is a list index, not a score.",
  },
  {
    file: "bed-meeting/tv-clinical-derivations.ts",
    match: "left.bedNumber - right.bedNumber || left.name.localeCompare(right.name)",
    list: "beds",
    key: "bed number, then name",
    order: "fixed order",
    reason: "Clinical TV rows in bed number order.",
  },
  {
    file: "ward/ward-beds-matrix.tsx",
    match: "return aNum - bNum;",
    list: "beds",
    key: "bed number (default); user choices stay or attention",
    order: "fixed order",
    reason: "Ward beds matrix defaults to room number.",
  },
  {
    file: "restrictive-practice/seclusion-screen.tsx",
    match: "ROOM_ORDER[a.state] - ROOM_ORDER[b.state] || a.index - b.index",
    list: "other",
    key: "fixed room-state table, then room index",
    order: "fixed order",
    reason: "Seclusion rooms by a fixed state table; rooms, not wards or beds offered to a patient.",
  },
  {
    file: "restrictive-practice/seclusion-summary.ts",
    match: "ROOM_ORDER[a.state] - ROOM_ORDER[b.state] || a.index - b.index",
    list: "other",
    key: "fixed room-state table, then room index",
    order: "fixed order",
    reason: "Seclusion rooms by a fixed state table.",
  },
  {
    file: "referrals/referral-patient-rank.ts",
    match: "a.rank - b.rank || a.index - b.index",
    list: "patients",
    key: "where the typed text matches the name (family, given, other), then original order",
    order: "fixed order",
    reason: "Search-text relevance on names only (F6); no clinical or capacity score.",
  },
  {
    file: "officer/officer-screen.tsx",
    match: "return priority(a) - priority(b) || stageSince(a) - stageSince(b);",
    list: "patients",
    key: "default: fixed job state (late, pack outstanding, transport leg), then time in stage; user: wait or ETA",
    order: "fixed order",
    reason: "Transport officer job list by job state and recorded times; no score.",
  },
  {
    file: "ed/ed-screen-derivations.ts",
    match: "PRIORITY_TONE_RANK[a.tone] - PRIORITY_TONE_RANK[b.tone]",
    list: "other",
    key: "fixed flag tone table",
    order: "fixed order",
    reason: "Orders a patient's flags by tone; it does not move patient rows (D-71 item 3).",
  },
  {
    file: "alerts/global-alert-view.ts",
    match: "TONE_RANK[a.tone] - TONE_RANK[b.tone]",
    list: "other",
    key: "act now, needs an answer, fixed tone table, then newest",
    order: "fixed order",
    reason: "Alerts, not wards or patients.",
  },
  {
    file: "shell/ward-rail-entries.ts",
    match: "rank(left.id) - rank(right.id)",
    list: "other",
    key: "fixed menu position",
    order: "fixed order",
    reason: "Rail menu entries.",
  },
  {
    file: "help/ward-help-howto.ts",
    match: "b.score - a.score || a.order - b.order,",
    list: "other",
    key: "help search word hits",
    order: "fixed order",
    reason: "Help topics by search hits; not wards or patients.",
  },
  {
    file: "help/ward-help-howto.ts",
    match: "b.score - a.score || Number(b.forThisDesk) - Number(a.forThisDesk) || a.order - b.order",
    list: "other",
    key: "help search score",
    order: "fixed order",
    reason: "Help topics by text-match score; not wards or patients.",
  },
  {
    file: "help/ward-help-search-index.ts",
    match: "b.hits - a.hits || b.score - a.score || a.order - b.order",
    list: "other",
    key: "help search hits and score",
    order: "fixed order",
    reason: "Help search results; not wards or patients.",
  },

  {
    file: "triage/triage-risk-start.tsx",
    match: "urgencyRank(a.referral.urgency) - urgencyRank(b.referral.urgency)",
    list: "patients",
    key: "default longest waiting; opt-in 'Urgency asked' tier as the referrer typed it, then wait",
    order: "fixed order",
    reason:
      "The matched comparator is the opt-in urgency view: a fixed table of the referrer's recorded tiers (A first, none asked last), longest waiting within a tier, no score. The default view is wait order (D-71 item 3).",
  },
  // ---------------------------------------------------------------- wait order
  {
    file: "capacity/shift-confirmations.ts",
    match: "a.allocatable.confirmedAt - b.allocatable.confirmedAt || a.name.localeCompare(b.name)",
    list: "wards",
    key: "time the ward last confirmed its bed figure, oldest first; then name",
    order: "wait order",
    reason:
      "Wards still to confirm their beds this shift, longest unconfirmed first; a recorded time, not a bed count.",
  },
  {
    file: "ward-board-derivations.ts",
    match: "a.nearestDays - b.nearestDays || b.count - a.count",
    list: "places",
    key: "soonest due day, then arrivals count, then fixed region order",
    order: "wait order",
    reason: "Home regions of a ward's arrivals by soonest due date; regions, not a ward or bed pick.",
  },
  {
    file: "ward/ward-ready-for-next-lines.tsx",
    match: "a.readyForNextAt! - b.readyForNextAt! || a.name.localeCompare(b.name)",
    list: "wards",
    key: "time the ward said it was ready for the next patient, earliest first",
    order: "wait order",
    reason: "Wards that said 'ready for next', in the order they said it; a recorded time, not a bed count.",
  },
  {
    file: "coordinator/call-sheet.tsx",
    match: "rank(a) - rank(b) || (rank(a) === 1 ? a.nextCallbackAt! - b.nextCallbackAt! : 0) || oldest(a) - oldest(b)",
    list: "wards",
    key: "callback due, then soonest callback, then oldest referral",
    order: "wait order",
    reason: "Ward call sheet in call order by recorded times only (Josh's notes 4, 9 Nov 2026).",
  },
  {
    file: "search/patient-search.tsx",
    match: "const rank: Record<string, number>",
    list: "patients",
    key: "longest wait (the only order in use)",
    order: "wait order",
    reason: "sortBy is fixed to wait-desc; the other branches are unreachable.",
  },
  {
    file: "ward/ward-wait-list.tsx",
    match: "waitListSince(a) - waitListSince(b) || a.id.localeCompare(b.id)",
    list: "patients",
    key: "time on the wait list, oldest first",
    order: "wait order",
    reason: "Ward wait list, first in first out (D-32, D-71 item 3).",
  },
  {
    file: "bed-meeting/tv-derivations.ts",
    match: "byWaitThenId",
    occurrences: 3,
    list: "patients",
    key: "wait, longest first, then id",
    order: "wait order",
    reason: "Bed meeting TV patient lists in wait order.",
  },
  {
    file: "movements/movements-derivations.ts",
    match: "byWait",
    occurrences: 2,
    list: "patients",
    key: "wait",
    order: "wait order",
    reason: "Movements by stage, in wait order.",
  },
  {
    file: "movements/movements-derivations.ts",
    match: "waitedMinutes(b, now) - waitedMinutes(a, now)",
    list: "patients",
    key: "minutes waited, longest first, then id",
    order: "wait order",
    reason: "Movements in wait order.",
  },
  {
    file: "delays/delays-board.tsx",
    match: "byWait",
    occurrences: 4,
    list: "patients",
    key: "wait",
    order: "wait order",
    reason: "Delays board groups in wait order.",
  },
  {
    file: "ed/ed-screen-model.ts",
    match: "a.openedAt - b.openedAt || a.id.localeCompare(b.id)",
    list: "patients",
    key: "time the movement opened, oldest first",
    order: "wait order",
    reason: "ED movements first in first out.",
  },
  {
    file: "ed/ed-screen-derivations.ts",
    match: 'if (patientSort === "longest") return a.openedAt - b.openedAt;',
    list: "patients",
    key: "default longest waiting; user name order",
    order: "wait order",
    reason: "ED patient list defaults to wait order.",
  },
  {
    file: "ward-step-down.ts",
    match: "a.incomingMovement.openedAt - b.incomingMovement.openedAt",
    list: "patients",
    key: "time the incoming movement opened, oldest first, then id",
    order: "wait order",
    reason: "Step-down candidates longest wait first (CS-04, NB-7).",
  },
  {
    file: "referrals/accepted-awaiting-pull.ts",
    match: "a.decidedAt - b.decidedAt",
    list: "patients",
    key: "time accepted, oldest first",
    order: "wait order",
    reason: "Accepted and awaiting a pull, in the order accepted.",
  },
  {
    file: "referrals/home-ward-offers.ts",
    match: "(a.referredAt ?? a.openedAt) - (b.referredAt ?? b.openedAt)",
    list: "patients",
    key: "time referred, oldest first",
    order: "wait order",
    reason: "Home ward offers in referral order.",
  },
  {
    file: "referrals/referral-ed-desk.ts",
    match: "(a.referredAt ?? a.openedAt) - (b.referredAt ?? b.openedAt)",
    list: "patients",
    key: "time referred, oldest first",
    order: "wait order",
    reason: "ED desk referrals in referral order.",
  },
  {
    file: "ward-referrals.ts",
    match: "a.referral.raisedAt - b.referral.raisedAt",
    occurrences: 3,
    list: "patients",
    key: "time raised, oldest first",
    order: "wait order",
    reason: "Referral lists first in first out.",
  },
  {
    file: "ward-referrals.ts",
    match: "a.raisedAt - b.raisedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)",
    list: "patients",
    key: "time raised, oldest first, then id",
    order: "wait order",
    reason: "Referral list first in first out.",
  },
];
