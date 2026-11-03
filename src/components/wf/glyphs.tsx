import { createLucideIcon, type LucideIcon } from "lucide-react";

/**
 * Ward Flow's own glyphs for the places and jobs in the menus (icon overhaul, 3 Nov 2026).
 *
 * Drawn on Lucide's 24px grid with round caps and joins, so they sit beside the Lucide utility icons
 * (chevrons, copy, close) at the same 1.75 stroke. Each one adds a soft tone layer under the line,
 * in the current colour, the way SF Symbols draws hierarchical icons: the shape reads at 16px and the
 * selected item can deepen its tone (`--wf-glyph-tone`) instead of swapping to a different icon.
 *
 * They are `LucideIcon` components, so they drop into any map or prop that takes a Lucide icon.
 * Decoration only: the label beside each one carries the meaning.
 */

type Node = Parameters<typeof createLucideIcon>[0] extends infer T ? (T extends { node: infer N } ? N : never) : never;

/** The tone layer: filled, no line, faint by default and stronger where a surface sets the variable. */
const TONE = { fill: "currentColor", stroke: "none", style: { opacity: "var(--wf-glyph-tone, 0.2)" } } as const;

function tone(d: string) {
  return ["path", { d, ...TONE }] as const;
}

function line(d: string) {
  return ["path", { d }] as const;
}

function glyph(name: string, node: readonly (readonly [string, Record<string, unknown>])[]): LucideIcon {
  // Lucide renders the node list as React children, so each part carries its own key, as Lucide's own icons do.
  const keyed = node.map(([tag, attrs], index) => [tag, { ...attrs, key: `${name}-${index}` }] as const);
  return createLucideIcon({ name, node: keyed as unknown as Node });
}

const HOUSE = "M4 10.2 12 3.8l8 6.4V19a1.5 1.5 0 0 1-1.5 1.5H15V15.5a3 3 0 0 0-6 0v5H5.5A1.5 1.5 0 0 1 4 19Z";

/** Home: a house with an arched door. */
export const GlyphHome = glyph("wf-home", [tone(HOUSE), line(HOUSE)]);

/** Capacity and finding a bed: a single hospital bed with its pillow, the mattress in tone. */
export const GlyphBed = glyph("wf-bed", [
  tone("M10.5 10.5H19a2 2 0 0 1 2 2v3H10.5Z"),
  line("M3 5v14.5"),
  line("M3 15.5h18v4"),
  line("M10.5 15.5v-5H19a2 2 0 0 1 2 2v3"),
  ["circle", { cx: "6.75", cy: "12.25", r: "1.75" }],
]);

/** Waiting: an hourglass with the sand run down, time spent waiting for a bed. */
export const GlyphWaiting = glyph("wf-waiting", [
  tone("M9 20.5v-1.4c0-1.3 1.3-2.6 3-2.6s3 1.3 3 2.6v1.4Z"),
  tone("M9.7 7.5h4.6L12 9.9Z"),
  line("M6.5 3.5h11"),
  line("M6.5 20.5h11"),
  line("M8 3.5v2.8a4 4 0 0 0 1.4 3L12 12l2.6-2.7A4 4 0 0 0 16 6.3V3.5"),
  line("M8 20.5v-2.8a4 4 0 0 1 1.4-3L12 12l2.6 2.7a4 4 0 0 1 1.4 3v2.8"),
]);

/** Movements: one patient arriving and one leaving, each from a bed. */
export const GlyphMovements = glyph("wf-movements", [
  ["circle", { cx: "5", cy: "7.5", r: "2", ...TONE }],
  ["circle", { cx: "19", cy: "16.5", r: "2", ...TONE }],
  ["circle", { cx: "5", cy: "7.5", r: "2" }],
  ["circle", { cx: "19", cy: "16.5", r: "2" }],
  line("M8.5 7.5h11"),
  line("M16.5 4.5l3 3-3 3"),
  line("M15.5 16.5h-11"),
  line("M7.5 13.5l-3 3 3 3"),
]);

/** All EDs: an emergency beacon, the dome in tone. */
export const GlyphEmergency = glyph("wf-emergency", [
  tone("M7 18v-4.5a5 5 0 0 1 10 0V18Z"),
  line("M7 18v-4.5a5 5 0 0 1 10 0V18"),
  line("M5 18h14a1 1 0 0 1 1 1v1.5H4V19a1 1 0 0 1 1-1Z"),
  line("M12 12.5v3"),
  line("M12 3v2"),
  line("M4.6 5.6 6 7"),
  line("M19.4 5.6 18 7"),
  line("M2.5 11h1.5"),
  line("M20 11h1.5"),
]);

const BELL = "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2.1a.6.6 0 0 1-.5.9H4.9a.6.6 0 0 1-.5-.9Z";

/** Alerts: a bell, the same one the phone dock and the top bar use. */
export const GlyphAlerts = glyph("wf-alerts", [tone(BELL), line(BELL), line("M10 21.5a2.2 2.2 0 0 0 4 0")]);

const TRIANGLE = "M10.3 4.2a2 2 0 0 1 3.4 0l7.4 12.8a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3Z";

/** Escalation: the act-now triangle. */
export const GlyphEscalation = glyph("wf-escalation", [
  tone(TRIANGLE),
  line(TRIANGLE),
  line("M12 9.5v4"),
  line("M12 16.75h.01"),
]);

const HOSPITAL = "M4 20.5V8.5A1.5 1.5 0 0 1 5.5 7H8V4.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1V7h2.5A1.5 1.5 0 0 1 20 8.5v12";

/** All wards: a hospital with its cross, the building in tone. */
export const GlyphHospital = glyph("wf-hospital", [
  tone(`${HOSPITAL}Z`),
  line(HOSPITAL),
  line("M2.5 20.5h19"),
  line("M12 6v4"),
  line("M10 8h4"),
  line("M10 20.5V17h4v3.5"),
  line("M6.75 12.5h.01"),
  line("M17.25 12.5h.01"),
]);

/** One ward: a block of rooms with a door. */
export const GlyphWard = glyph("wf-ward", [
  tone("M5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 19 5v15.5Z"),
  line("M5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 19 5v15.5"),
  line("M3 20.5h18"),
  line("M9 7.5h1.5M13.5 7.5H15M9 11h1.5M13.5 11H15M9 14.5h1.5M13.5 14.5H15"),
  line("M10.5 20.5V18h3v2.5"),
]);

/** Community: a team of two people, the front one in tone. */
export const GlyphTeam = glyph("wf-team", [
  ["circle", { cx: "9", cy: "8", r: "3.25", ...TONE }],
  tone("M3.5 19.5a5.5 5.5 0 0 1 11 0Z"),
  ["circle", { cx: "9", cy: "8", r: "3.25" }],
  line("M3.5 19.5a5.5 5.5 0 0 1 11 0"),
  line("M15.5 4.9a3.25 3.25 0 0 1 0 6.2"),
  line("M17 14.2a5.5 5.5 0 0 1 3.5 5.3"),
]);

/** Transport: a patient transport van with its cross. */
export const GlyphTransport = glyph("wf-transport", [
  tone("M4 6h9a1.5 1.5 0 0 1 1.5 1.5v10H4A1.5 1.5 0 0 1 2.5 16V7.5A1.5 1.5 0 0 1 4 6Z"),
  line("M5 17.5H4A1.5 1.5 0 0 1 2.5 16V7.5A1.5 1.5 0 0 1 4 6h9a1.5 1.5 0 0 1 1.5 1.5v10"),
  line("M14.5 10h3.3a1.5 1.5 0 0 1 1.2.6l2.2 3a1.5 1.5 0 0 1 .3.9V16a1.5 1.5 0 0 1-1.5 1.5H19"),
  line("M9 17.5h6"),
  line("M8.5 8.5v4M6.5 10.5h4"),
  ["circle", { cx: "7", cy: "17.5", r: "2" }],
  ["circle", { cx: "17", cy: "17.5", r: "2" }],
]);

const BOARD =
  "M6.5 4.5h11A1.5 1.5 0 0 1 19 6v13.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5V6a1.5 1.5 0 0 1 1.5-1.5Z";

/** Handover: a clipboard with the notes being passed on. */
export const GlyphHandover = glyph("wf-handover", [
  tone(BOARD),
  line("M8 4.5H6.5A1.5 1.5 0 0 0 5 6v13.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H16"),
  ["rect", { x: "8", y: "3", width: "8", height: "3", rx: "1" }],
  line("M8.5 10.5h7"),
  line("M8.5 14h4"),
  line("M8.5 17.5h4.5"),
  line("M14.5 16l1.5 1.5-1.5 1.5"),
]);

/** Patients: the census, a person beside their row. */
export const GlyphPatients = glyph("wf-patients", [
  ["circle", { cx: "8", cy: "8.5", r: "2.75", ...TONE }],
  tone("M3.5 18a4.5 4.5 0 0 1 9 0Z"),
  ["circle", { cx: "8", cy: "8.5", r: "2.75" }],
  line("M3.5 18a4.5 4.5 0 0 1 9 0"),
  line("M15.5 7.5h5"),
  line("M15.5 12h5"),
  line("M15.5 16.5h3"),
]);

const PIN = "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z";

/** Places: a map pin. */
export const GlyphPlaces = glyph("wf-places", [tone(PIN), line(PIN), ["circle", { cx: "12", cy: "10", r: "2.25" }]]);

/** Discharges: out through an open door, freeing the bed. */
export const GlyphDischarge = glyph("wf-discharge", [
  tone("M4 4.2 9 5.8a1 1 0 0 1 .7.9v13.8H4Z"),
  line("M14 8V5a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 4 5v15.5"),
  line("M14 16v4.5"),
  line("M2.5 20.5h13"),
  line("M12.5 12h9"),
  line("M18.5 9l3 3-3 3"),
]);

/** Seclusion: a closed door with its observation window. */
export const GlyphSeclusion = glyph("wf-seclusion", [
  tone("M6 20.5V4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16Z"),
  line("M6 20.5V4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16"),
  line("M4 20.5h16"),
  ["rect", { x: "9.5", y: "6.5", width: "5", height: "3.5", rx: ".75" }],
  line("M15 13.5v1.5"),
]);

const TRAY = "M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19Z";

/** Referrals: a letter landing in the tray. */
export const GlyphReferrals = glyph("wf-referrals", [
  tone(TRAY),
  line(
    "M3.5 13.5 6 5.5a1.5 1.5 0 0 1 1.4-1h9.2a1.5 1.5 0 0 1 1.4 1l2.5 8V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19Z",
  ),
  line("M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5"),
  line("M9.5 8h5"),
  line("M9 10.75h6"),
]);

const PAGE = "M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h5.5";

/** New referral: a fresh page with a plus. */
export const GlyphNewReferral = glyph("wf-new-referral", [
  tone("M7 3.5h6.5L18.5 8.5v3.5a6 6 0 0 0-6 8.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z"),
  line(PAGE),
  line("M13.5 3.5 18.5 8.5V12"),
  line("M13.5 3.5v5h5"),
  line("M8.5 12h4"),
  line("M8.5 15.5h2.5"),
  line("M17.5 15v6"),
  line("M14.5 18h6"),
]);

/** Statistics: three columns, rising. */
export const GlyphStatistics = glyph("wf-statistics", [
  ["rect", { x: "4", y: "12.5", width: "3.5", height: "8", rx: "1", ...TONE }],
  ["rect", { x: "10.25", y: "7.5", width: "3.5", height: "13", rx: "1", ...TONE }],
  ["rect", { x: "16.5", y: "3.5", width: "3.5", height: "17", rx: "1", ...TONE }],
  ["rect", { x: "4", y: "12.5", width: "3.5", height: "8", rx: "1" }],
  ["rect", { x: "10.25", y: "7.5", width: "3.5", height: "13", rx: "1" }],
  ["rect", { x: "16.5", y: "3.5", width: "3.5", height: "17", rx: "1" }],
]);

/** Out of area: a signpost pointing two ways, how far from home. Never a map pin (Phase 8). */
export const GlyphOutOfArea = glyph("wf-out-of-area", [
  tone("M12 4.5h6.5l2 2-2 2H12Z"),
  tone("M12 10.5H5.5l-2 2 2 2H12Z"),
  line("M12 21.5V2.5"),
  line("M12 4.5h6.5l2 2-2 2H12"),
  line("M12 10.5H5.5l-2 2 2 2H12"),
  line("M9.5 21.5h5"),
]);

/** Legal forms: a form with its seal, the instrument rather than the court. */
export const GlyphLegalForm = glyph("wf-legal-form", [
  ["circle", { cx: "15.5", cy: "15", r: "3", ...TONE }],
  line("M13.5 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5H10"),
  line("M13.5 3.5 19 9v1.5"),
  line("M13.5 3.5V9H19"),
  line("M8 12.5h3"),
  line("M8 9h2.5"),
  ["circle", { cx: "15.5", cy: "15", r: "3" }],
  line("M13.7 17.4 13 21.5l2.5-1.2 2.5 1.2-.7-4.1"),
]);

/** Bed meeting TV: a screen read from across the room. */
export const GlyphMeetingScreen = glyph("wf-meeting-screen", [
  ["rect", { x: "2.5", y: "4", width: "19", height: "13", rx: "2", ...TONE }],
  ["rect", { x: "2.5", y: "4", width: "19", height: "13", rx: "2" }],
  line("M8 21h8"),
  line("M12 17v4"),
  line("M7 13.5v-2M10.33 13.5V9M13.67 13.5v-3M17 13.5V8"),
]);

const SHIELD = "M12 3 19 6v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6Z";

/** Governance: a shield with a tick. */
export const GlyphGovernance = glyph("wf-governance", [tone(SHIELD), line(SHIELD), line("M9 12l2.2 2.2L15.5 10")]);

/** Board: the ward's beds as tiles, one taken. */
export const GlyphBoard = glyph("wf-board", [
  ["rect", { x: "4", y: "4", width: "7", height: "7", rx: "1.5", ...TONE }],
  ["rect", { x: "4", y: "4", width: "7", height: "7", rx: "1.5" }],
  ["rect", { x: "13", y: "4", width: "7", height: "7", rx: "1.5" }],
  ["rect", { x: "4", y: "13", width: "7", height: "7", rx: "1.5" }],
  ["rect", { x: "13", y: "13", width: "7", height: "7", rx: "1.5" }],
]);

/** Activity: the shift's changes as a trace on a panel. */
export const GlyphActivity = glyph("wf-activity", [
  ["rect", { x: "3", y: "4", width: "18", height: "16", rx: "4", ...TONE }],
  ["rect", { x: "3", y: "4", width: "18", height: "16", rx: "4" }],
  line("M6.5 12.5h2.5l1.75-4 2.5 7.5 1.75-3.5h2.5"),
]);
