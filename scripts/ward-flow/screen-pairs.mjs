/**
 * 🔴 **THE SHARED MOCKUP ↔ ROUTE ↔ SCREEN ROSTER — one list, everything else imports it.**
 *
 * This module holds no logic, only the two hand-authored arrays that used to live inside
 * `scripts/ward-flow/screen-map.mjs`. Two copies of this list would drift, which is the exact
 * failure this whole estate keeps rediscovering — so `screen-map.mjs` and anything else that
 * needs the roster (`scripts/ward-flow/screen-verification.mjs` included) import it from here.
 *
 * Moved verbatim — including every comment — from `screen-map.mjs`. Do not reword, reorder or
 * "tidy" a single entry without also checking `docs/ward-flow/SCREEN-MAP.md` stays byte-identical.
 */

/**
 * mockup file · route · screen folder · in the build plan?
 * The 2026-09-13 commission covers 34 operational drawings; the remaining two current drawings
 * are design-system and Digest references. A reference drawing keeps `contract: false` and is
 * reported separately from screens that are required to be reachable and visually verified.
 */
export const PAIRS = [
  ["command-third-edition.html", "/", "coordinator", true],
  ["delays-third-edition.html", "/delays", "delays", true],
  ["movement-third-edition.html", "/movements", "movements", true],
  ["capacity-third-edition.html", "/capacity", "capacity", true],
  ["ward-third-edition.html", "/ward/[unitId]", "ward", true],
  ["wards-third-edition.html", "/wards", "wards", true],
  ["bed-board-third-edition.html", "/board/[unitId]", "board", true],
  ["emergency-department-third-edition.html", "/ed/[edId]", "ed", true],
  ["community-team-third-edition.html", "/community/[teamId]", "community", true],
  ["patient-search-third-edition.html", "/search", "search", true],
  ["patient-now-third-edition.html", "/people/[patientId]", "patients", true],
  ["search-hub-third-edition.html", "/hub", "hub", true],
  ["raise-a-referral-third-edition.html", "/referrals/new", "referrals", true],
  ["statistics-overview-third-edition.html", "/statistics/overview", "statistics", true],
  ["statistics-ward-third-edition.html", "/statistics/ward/[unitId]", "statistics", true],
  ["statistics-community-third-edition.html", "/statistics/community/[teamId]", "statistics", true],
  ["statistics-emergency-department-third-edition.html", "/statistics/ed/[edId]", "statistics", true],
  ["network-third-edition.html", "/network", "network", true],
  ["governance-third-edition.html", "/governance", "governance", true],
  ["handover-third-edition.html", "/handover", "handover", true],
  ["discharges-third-edition.html", "/discharges", "discharges", true],
  ["out-of-area-third-edition.html", "/out-of-area", "out-of-area", true],
  ["on-call-third-edition.html", "/on-call", "on-call", true],
  ["alerts-third-edition.html", "/alerts", "alerts", true],
  ["transport-officer-third-edition.html", "/transport/officer", "officer", true],
  ["legal-forms-third-edition.html", "/legal-forms", "legal-forms", true],
  ["add-a-patient-third-edition.html", "/people/new", "patients", true],
  ["referrals-third-edition.html", "/referrals", "referrals", true],
  ["settings-third-edition.html", "/settings", "settings", true],
  ["statistics-third-edition.html", "/statistics", "statistics", true],
  ["statistics-compare-third-edition.html", "/statistics/compare", "statistics", true],
  ["statistics-service-third-edition.html", "/statistics/service/[serviceId]", "statistics", true],
  ["sign-in-third-edition.html", "/ward-flow-sign-in", "../ward-flow-sign-in", true],
  ["design-system-third-edition.html", null, null, false],
  ["ward-answer-third-edition.html", "/ward/[unitId]/answer", "ward", true],
  ["ward-flow-digest.html", "/mockups/ward-flow-digest", null, false],
  // Added 2026-09-14/16 as REFERENCES, not build contracts.
  ["movement-gantt-third-edition.html", null, null, false],
  ["network-horizon-third-edition.html", null, null, false],
  ["sovereign-chrome-and-drawers-perfected.html", null, null, false],
  ["perfected-activity-drawer.html", null, null, false],
  ["perfected-drawers-showcase.html", null, null, false],
  ["perfected-service-popover.html", null, null, false],
  ["perfected-tasks-drawer.html", null, null, false],
  ["perfected-tools-drawer.html", null, null, false],
  ["settings-perfected-third-edition.html", null, null, false],
  ["add-a-patient-third-edition-claude-draft.html", null, null, false],
  ["patient-now-original-third-edition.html", null, null, false],
  ["sovereign-sidebar-ultimate.html", null, null, false],
  ["handover-perfected-third-edition.html", null, null, false],
  ["ward-perfected-third-edition.html", null, null, false],
  ["wards-cards-third-edition.html", null, null, false],
  ["patient-now-perfected.html", null, null, false],
  ["patient-search-perfected-third-edition.html", null, null, false],
  // Added 2026-09-18 by a session that did not author either drawing. Both arrived in the fifth
  // protective snapshot (`aa139ece55`, author unknown) with no entry here, which made the
  // screen-map gate red and blocked every commit touching any mockup, including unrelated ones.
  //
  // WARNING: `null, null, false` is the ONLY honest classification available to somebody who did
  // not draw them - this drawing exists, it has no route, and it is not in the build plan. It is
  // deliberately NOT a claim that they SHOULD have no route. Whoever authored them should say what
  // they pair with; changing these two lines is the whole of that correction.
  ["movement-service-filter-experiment.html", null, null, false],
  ["raise-a-referral-perfected-third-edition.html", null, null, false],
  // Header chrome text experiments (reference only — no build contract).
  ["header-text-5-variations.html", null, null, false],
  ["header-text-inside-capsule-variations.html", null, null, false],
  ["header-text-perfected-variations.html", null, null, false],
  ["header-text-redesign-mockups.html", null, null, false],
  ["header-text-clean-perfected.html", null, null, false],
  ["header-text-perfected-specification.html", null, null, false],
  ["header-badge-size-variations.html", null, null, false],
  ["ward-decisions-perfected-third-edition.html", null, null, false],
  ["delays-perfected-third-edition.html", null, null, false],
  ["notification-popup-third-edition.html", null, null, false],
  ["ward-before-after-redesign.html", null, null, false],
];

/** Superseded drawings — named so they are never treated as current. */
export const SUPERSEDED = ["patient-search-console.html", "patient-search-working.html"];

/**
 * Complete 53-route roster mapping every commissioned Ward Flow route (51 under
 * `/ward-flow/**` plus `/ward-flow-sign-in` and `/mockups/ward-flow-digest`)
 * to its screen folder and current React component file relative to
 * `src/components/ward-management/` (`null` for server redirect stubs and the HTML digest route handler).
 */
export const ROUTE_COMPONENTS = [
  { route: "/", folder: "coordinator", react: "coordinator/coordinator-screen.tsx" },
  { route: "/alerts", folder: "alerts", react: "alerts/alerts-screen.tsx" },
  { route: "/bed-meeting", folder: "bed-meeting", react: "bed-meeting/bed-meeting-tv.tsx" },
  { route: "/board/[unitId]", folder: "board", react: "board/ward-board.tsx" },
  { route: "/capacity", folder: "capacity", react: "capacity/capacity-screen.tsx" },
  { route: "/command", folder: "coordinator", react: null },
  { route: "/community", folder: "community", react: "community/community-index.tsx" },
  { route: "/community/[teamId]", folder: "community", react: "community/community-screen.tsx" },
  { route: "/constellation", folder: "network", react: null },
  { route: "/delays", folder: "delays", react: "delays/delays-screen.tsx" },
  { route: "/discharges", folder: "discharges", react: "discharges/discharge-board.tsx" },
  { route: "/ed", folder: "ed", react: "ed/ed-index.tsx" },
  { route: "/ed/[edId]", folder: "ed", react: "ed/ed-screen.tsx" },
  { route: "/escalation", folder: "delays", react: null },
  { route: "/exceptions", folder: "delays", react: null },
  { route: "/governance", folder: "governance", react: "ward-management-modes.tsx" },
  { route: "/handover", folder: "handover", react: "handover/handover-page.tsx" },
  { route: "/hub", folder: "hub", react: "hub/hub-screen.tsx" },
  { route: "/legal-forms", folder: "legal-forms", react: "legal-forms/legal-forms-screen.tsx" },
  { route: "/movements", folder: "movements", react: "movements/movements-screen.tsx" },
  { route: "/movements/[movementId]", folder: "patients", react: "patients/patient-now-screen.tsx" },
  { route: "/network", folder: "network", react: "ward-management-modes.tsx" },
  { route: "/on-call", folder: "on-call", react: "on-call/on-call-screen.tsx" },
  { route: "/out-of-area", folder: "out-of-area", react: "out-of-area/out-of-area-board.tsx" },
  { route: "/people/[patientId]", folder: "patients", react: "patients/patient-now-screen.tsx" },
  { route: "/people/new", folder: "patients", react: "patients/add-patient.tsx" },
  { route: "/queue", folder: "delays", react: null },
  { route: "/referrals", folder: "referrals", react: "referrals/referral-board.tsx" },
  { route: "/referrals/new", folder: "referrals", react: "referrals/referral-board.tsx" },
  { route: "/reports/chronology", folder: "reports", react: "reports/patient-chronology-screen.tsx" },
  { route: "/reports/downtime", folder: "reports", react: "reports/downtime-pack-screen.tsx" },
  { route: "/search", folder: "search", react: "search/patient-search.tsx" },
  { route: "/settings", folder: "settings", react: "settings/settings-screen.tsx" },
  { route: "/statistics", folder: "statistics", react: "statistics/statistics-screen.tsx" },
  {
    route: "/statistics/community/[teamId]",
    folder: "statistics",
    react: "statistics/statistics-community-screen.tsx",
  },
  { route: "/statistics/compare", folder: "statistics", react: "statistics/statistics-compare-screen.tsx" },
  { route: "/statistics/ed/[edId]", folder: "statistics", react: "statistics/statistics-ed-screen.tsx" },
  { route: "/statistics/eds", folder: "statistics", react: "statistics/statistics-eds-index.tsx" },
  { route: "/statistics/overview", folder: "statistics", react: "statistics/statistics-overview-screen.tsx" },
  {
    route: "/statistics/service/[serviceId]",
    folder: "statistics",
    react: "statistics/statistics-service-screen.tsx",
  },
  { route: "/statistics/services", folder: "statistics", react: "statistics/statistics-services-index.tsx" },
  { route: "/statistics/teams", folder: "statistics", react: "statistics/statistics-teams-index.tsx" },
  { route: "/statistics/ward/[unitId]", folder: "statistics", react: "statistics/statistics-ward-screen.tsx" },
  { route: "/statistics/wards", folder: "statistics", react: "statistics/statistics-wards-index.tsx" },
  { route: "/statistics/weekly", folder: "reports", react: "reports/weekly-report-screen.tsx" },
  { route: "/transport", folder: "movements", react: null },
  { route: "/transport/officer", folder: "officer", react: "officer/officer-screen.tsx" },
  { route: "/ward/[unitId]", folder: "ward", react: "ward/ward-screen.tsx" },
  { route: "/ward/[unitId]/answer", folder: "ward", react: "ward/ward-screen.tsx" },
  { route: "/wards", folder: "wards", react: "wards/ward-index.tsx" },
  {
    route: "/ward-flow-sign-in",
    folder: "../ward-flow-sign-in",
    react: "../ward-flow-sign-in/ward-flow-sign-in-screen.tsx",
  },
  { route: "/mockups/ward-flow-digest", folder: null, react: null },
];
