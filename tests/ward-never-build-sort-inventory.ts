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
  // ---------------------------------------------------------------- ruled by Josh (D-126)
  {
    file: "wards/ward-index.tsx",
    match:
      'if (order === "a-z") return a.unit.name.localeCompare(b.unit.name); return serviceRank(a) - serviceRank(b);',
    list: "wards",
    key: "user choice: health service order (default) or ward name A to Z",
    order: "fixed order",
    reason:
      "D-126 (10 Nov 2026): the Wards index Order choice keeps only neutral orders, Service (default) and A to Z; 'Most ready' and 'Fullest' were removed, and the hero's 'Most ready: <ward>' chip and its sort became a 'Has ready' filter chip counting the wards with a ready bed.",
  },
  {
    file: "statistics/statistics-screen.tsx",
    match: "left.name.localeCompare(right.name)",
    list: "wards",
    key: "ward name, A to Z",
    order: "fixed order",
    reason:
      "D-126 (10 Nov 2026): the Statistics finder's Wards tab, where a person picks a ward to open, lists wards A to Z by name, not most ready beds first.",
  },
  {
    file: "night/night-view-figures.ts",
    match: "serviceRank(a.unit) - serviceRank(b.unit) || a.unit.name.localeCompare(b.unit.name)",
    list: "wards",
    key: "health service, then ward name",
    order: "fixed order",
    reason:
      "Feature plan item 29 (10 Nov 2026): Night view lists wards with ready beds in the fixed order (health service, then ward name, D-126), never most ready beds first (D-71).",
  },
  {
    file: "capacity/capacity-derivations.ts",
    match: "byServiceThenName(x.unit, y.unit)",
    list: "wards",
    key: "health service, then ward name",
    order: "fixed order",
    reason:
      "D-126 (10 Nov 2026): the Capacity mismatch pop-up's 'Ready beds that fit' list uses the fixed fit-list order (health service then ward name, as D-71 and D-110), not most fitting beds first.",
  },
  {
    file: "referrals/ward-referral-drawer-placement-step.tsx",
    match: "Number(b === catchmentTeam) - Number(a === catchmentTeam) || a.localeCompare(b)",
    list: "places",
    key: "the patient's catchment community team first; then A to Z",
    order: "fixed order",
    reason:
      "D-126 (10 Nov 2026): kept as it is by Josh. The community team pick list puts the catchment team first, then A to Z; teams are not wards and no bed figure orders it.",
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
    file: "referrals/referral-destination-options.ts",
    match: "DESTINATION_ORDER[a.kind] - DESTINATION_ORDER[b.kind]",
    list: "places",
    key: "a fixed table of destination kinds: Ward, Community team, ED",
    order: "fixed order",
    reason:
      "D-126 (Josh, 10 Nov 2026): referral destination kinds in the drawer switch's fixed order, with no catchment-first tier and no 'suggested' flag.",
  },
  {
    file: "movements/movement-horizon-gantt.tsx",
    match:
      "serviceRank(a.originEdId) - serviceRank(b.originEdId) || edName(a.originEdId).localeCompare(edName(b.originEdId))",
    list: "places",
    key: "health service, then ED name",
    order: "fixed order",
    reason:
      "D-126 (Josh, 10 Nov 2026): the Movements Corridors rail lists EDs in a fixed service-then-name order, never busiest first, and is labelled 'Corridors'.",
  },
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
    file: "statistics/statistics-map-view.tsx",
    match: "bySiteOrder",
    list: "places",
    key: "health service, then site name",
    order: "fixed order",
    reason:
      "D-126 (10 Nov 2026): the Statistics map's site list (was the numbered 'Most ready beds' rank) is in health service then site name order, with no rank numbers and a neutral title.",
  },
  {
    file: "statistics/statistics-map-view.tsx",
    match: "a.unit.name.localeCompare(b.unit.name)",
    list: "wards",
    key: "ward name A to Z; first row only",
    order: "fixed order",
    reason:
      "D-126 (10 Nov 2026): each site row names and opens the site's first ward A to Z, no longer the ward with most ready beds.",
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
    file: "handover/handover-model.ts",
    match: "(a, b) => a.name.localeCompare(b.name)",
    list: "wards",
    key: "ward name A to Z (within each health service)",
    order: "fixed order",
    reason:
      "Desktop handover Beds table and phone handover Beds view, both through wardsByService: each service's wards A to Z, no longer most ready beds first (D-126, 10 Nov 2026).",
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
