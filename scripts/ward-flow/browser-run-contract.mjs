import { requestedProjects } from "./journey-run-verdict.mjs";

// Independent unit controls pin these obligations. The browser specs keep their literal
// titles, so deleting or renaming a journey cannot also narrow the runtime obligation by accident.
export const REQUIRED_RELEASE_JOURNEYS = Object.freeze([
  "ED referral to bed offer: the ED raises a referral, the coordinator offers a ward, the ward accepts and pulls",
  "Morning bed meeting: a ward confirms its numbers and the coordinator's capacity board moves",
  "Transfer with transport: the ED books transport, the officer delivers, and the ward confirms arrival",
  "Discharge with bed release: a ward confirms a release, the person leaves, and the bed is ready on the board",
]);

// Phase 0 journeys that live in their own spec files, each pinned by file and literal title.
export const REQUIRED_RELEASE_JOURNEY_FILES = Object.freeze([
  {
    file: "release-gate-inpatient-transfer.spec.ts",
    title:
      "Inpatient transfer: a stay on one ward is referred, accepted and held at another, moved, and the sending bed frees",
  },
  {
    file: "release-gate-community-referral.spec.ts",
    title:
      "Community referral: a community team refers from its own desk, the ward it asked accepts into a held bed, and the coordinator's board and the team's desk agree",
  },
  // Tier 1 item 7 (Josh, 4 Nov 2026): filing a Mental Health Act form, with its Undo.
  {
    file: "release-gate-legal-form.spec.ts",
    title:
      "Legal form: a Form 1A gets its time written and is marked received, the receipt undoes, and the move shows the form",
  },
]);

// Independently pinned obligations for the release checks. Phone WebKit deliberately skips
// the desktop ED menus and layout-shift cases; every other check must pass exactly once.
const RELEASE_CHECK_ROUTES = Object.freeze([
  "",
  "/alerts",
  "/bed-meeting",
  "/bed-meeting/agenda",
  "/board/rph-adult-secure",
  "/capacity",
  "/hub/catchments",
  "/community/midland",
  "/waiting",
  "/discharges",
  "/ed",
  "/ed/peel-ed",
  "/governance",
  "/handover",
  "/hub",
  "/legal-forms",
  "/movements",
  "/movements/1nfzcp26wc0g",
  "/on-call",
  "/out-of-area",
  "/people/new",
  "/people/196zcp26wet0",
  "/referrals",
  "/referrals/new",
  "/reports/chronology",
  "/reports/downtime",
  "/search",
  "/seclusion",
  "/settings",
  "/statistics",
  "/statistics/community/bentley",
  "/statistics/compare",
  "/statistics/ed/rph-ed",
  "/statistics/eds",
  "/statistics/service/North%20Metro",
  "/statistics/services",
  "/statistics/teams",
  "/statistics/ward/rph-adult-secure",
  "/statistics/wards",
  "/statistics/weekly",
  "/transport",
  "/transport/officer",
  "/ward/rph-adult-secure",
  "/ward/rph-adult-secure/answer",
  "/wards",
  "/ward-flow-sign-in",
]);
const RELEASE_DARK_CHECK_ROUTES = Object.freeze([
  "",
  "/community/midland",
  "/discharges",
  "/ed/peel-ed",
  "/referrals/new",
  "/settings",
  "/statistics",
  "/transport/officer",
  "/ward/rph-adult-secure",
]);
const RELEASE_SHIFT_ROUTES = Object.freeze([
  "",
  "/community/midland",
  "/discharges",
  "/ed/peel-ed",
  "/movements",
  "/people/new",
  "/referrals",
  "/statistics",
  "/transport/officer",
  "/waiting",
  "/ward/rph-adult-secure",
  "/wards",
]);

export function releaseGateCheckCases(project) {
  const phone = project === "release-gate-phone";
  const titles = [
    ...RELEASE_CHECK_ROUTES.map((route) => `axe: ${route || "/"} has no serious or critical violation`),
    "axe: the header search palette with results open has no serious or critical violation",
    "axe: a ward's bed drawer when open has no serious or critical violation",
    "axe: the page tip card when showing has no serious or critical violation",
    ...RELEASE_DARK_CHECK_ROUTES.map((route) => `axe dark: ${route || "/"} has no serious or critical violation`),
    "axe dark: the header search palette with results open",
    "axe dark: the page tip card when showing",
    "axe dark: the Tools sheet, or the phone Menu sheet, when open",
    ...(!phone
      ? [
          "axe: the ED actions menu when open has no serious or critical violation",
          "axe dark: the ED actions menu when open",
          ...RELEASE_SHIFT_ROUTES.map(
            (route) => `layout shift: ${route || "/"} stays still as it loads, desktop and phone`,
          ),
        ]
      : []),
  ];
  return titles.map((title) => ({ project, file: "release-gate-axe-sweep.spec.ts", title }));
}

export const RELEASE_GATE_PROJECTS = Object.freeze(["release-gate-desktop", "release-gate-phone"]);

/**
 * The release gate's device project for one CI leg (WARD_RELEASE_GATE_PROJECT), or null for both.
 * Public CI runs desktop and phone as two parallel jobs; each leg must still run every journey on
 * its own project, and the workflow contract pins that the legs together name both projects.
 */
/** @param {string | null | undefined} value @returns {string | null} */
export function releaseGateProjectFor(value) {
  const project = value?.trim();
  if (!project) return null;
  if (!RELEASE_GATE_PROJECTS.includes(project))
    throw new Error(`WARD_RELEASE_GATE_PROJECT must be one of ${RELEASE_GATE_PROJECTS.join(", ")}; got "${project}".`);
  return project;
}

/**
 * Each device leg of the release gate runs as parallel CI jobs, one per part (Josh, 31 October
 * 2026: the phone leg ran 10.4 minutes in one job; split in two it still ran 10.2, so the journeys
 * were split again). The parts partition the release-gate spec files: together they run every file
 * once on each device. `journeys` (the four core bed-flow journeys) and `referrals` (inpatient
 * transfer, community referral and filing a legal form) each require their own named journeys,
 * seven in all. `checks` independently requires its applicable accessibility and layout-shift cases.
 */
export const RELEASE_GATE_PARTS = Object.freeze({
  journeys: Object.freeze(["release-gate-journeys.spec.ts"]),
  referrals: Object.freeze([
    "release-gate-inpatient-transfer.spec.ts",
    "release-gate-community-referral.spec.ts",
    "release-gate-legal-form.spec.ts",
  ]),
  checks: Object.freeze(["release-gate-axe-sweep.spec.ts"]),
});

/**
 * The release-gate part for one CI job (WARD_RELEASE_GATE_PART), or null for the whole gate.
 * @param {string | null | undefined} value @returns {"journeys" | "referrals" | "checks" | null}
 */
export function releaseGatePartFor(value) {
  const part = value?.trim();
  if (!part) return null;
  if (!Object.hasOwn(RELEASE_GATE_PARTS, part))
    throw new Error(
      `WARD_RELEASE_GATE_PART must be one of ${Object.keys(RELEASE_GATE_PARTS).join(", ")}; got "${part}".`,
    );
  return /** @type {"journeys" | "referrals" | "checks"} */ (part);
}

/**
 * Why a release-gate part cannot narrow these Playwright arguments, or null when it can. A part
 * replaces the file selection, so any file filter or test-selection option would run less than the
 * whole part.
 * @param {readonly string[]} args
 * @returns {string | null}
 */
export function releaseGatePartArgsProblem(args) {
  if (args.some((argument) => !argument.startsWith("-")))
    return "WARD_RELEASE_GATE_PART narrows the full release-gate preset only; remove file filters";
  const selection = args.find((argument) =>
    /^(?:-g|--grep|--grep-invert|--last-failed|--only-changed|--shard|--test-list|--test-list-invert)(?:=|$)/u.test(
      argument,
    ),
  );
  return selection ? `WARD_RELEASE_GATE_PART runs a whole part; remove the test-selection option ${selection}` : null;
}

/**
 * @param {boolean} required
 * @param {string | null} [only] one device project, or null for both
 * @param {string | null} [part] one release-gate part, or null for the whole gate
 */
export function releaseGateCases(required, only = null, part = null) {
  if (!required) return [];
  const projects = only === null ? RELEASE_GATE_PROJECTS : [releaseGateProjectFor(only)];
  const files = part === null ? null : RELEASE_GATE_PARTS[releaseGatePartFor(part) ?? ""];
  return projects
    .flatMap((project) => [
      ...REQUIRED_RELEASE_JOURNEYS.map((title) => ({ project, file: "release-gate-journeys.spec.ts", title })),
      ...REQUIRED_RELEASE_JOURNEY_FILES.map(({ file, title }) => ({ project, file, title })),
      ...releaseGateCheckCases(project),
    ])
    .filter((entry) => files === null || files.includes(entry.file));
}

/** The first CI group uses the existing app build for the separate, disjoint CSRF project. */
export function includeGroupCsrf(args, group) {
  if (!/^1\/\d+$/u.test(group ?? "")) return [...args];
  const projects = requestedProjects(args);
  if (!projects.includes("chromium-mockups")) throw new Error("CI Ward groups require chromium-mockups");
  return [...args, ...(projects.includes("chromium") ? [] : ["--project=chromium"]), "api-csrf-proxy.spec.ts"];
}

export const REQUIRED_SHARED_JOURNEYS = Object.freeze([
  "two signed-in desks share one workspace: a save on one reaches the other on its next poll",
  "a clash: two desks change the same record from the same revision, and the second is refused",
  "a workflow refusal from the server's engine reaches the screen as the engine's own reason",
  "keyboard focus: after a shared save the activated control still has focus",
  "different records at once: two desks change different records from the same revision, and both saves land on both desks",
  "a desk that loses its network says it is not connected, then catches up without a reload when it returns",
]);
/** Recovery/session journeys need the shared backend on both desktop and phone. */
export const REQUIRED_SHARED_RECOVERY_JOURNEYS = Object.freeze([
  "offline recovery: a save accepted before reload is checked by receipt and is never replayed",
  "stale board: five minutes without a successful refresh shows its time and one keyboard retry",
  "Activity Undo: a desk reviews its own bed closure and waits for the server to confirm the inverse",
  "sign-out return: cancelling preserves a waiting change and confirmed sign-out returns only to the authorised screen",
]);
export function sharedModeCases() {
  return [
    ...REQUIRED_SHARED_JOURNEYS.map((title) => ({
      project: "ward-shared-mode",
      file: "ward-shared-mode.spec.ts",
      title,
    })),
    ...["ward-shared-mode", "ward-shared-phone"].flatMap((project) =>
      REQUIRED_SHARED_RECOVERY_JOURNEYS.map((title) => ({ project, file: "ward-shared-recovery.spec.ts", title })),
    ),
  ];
}

/** Preserve option/value pairs while replacing only positional spec filters. */
export function splitPlaywrightArguments(args) {
  const options = [];
  const files = [];
  const valued = new Set([
    "-c",
    "--config",
    "-g",
    "--grep",
    "--grep-invert",
    "--workers",
    "-j",
    "--reporter",
    "--output",
    "--shard",
    "--timeout",
    "--retries",
    "--max-failures",
    "--repeat-each",
    "--global-timeout",
    "--trace",
    "--browser",
    "--device",
    "--test-list",
    "--test-list-invert",
    "--only-changed",
    "--update-snapshots",
    "--tsconfig",
    "--add-reporter",
  ]);
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (!argument.startsWith("-")) {
      files.push(argument);
      continue;
    }
    options.push(argument);
    if (argument === "--project") {
      while (args[index + 1] && !args[index + 1].startsWith("-") && !/[\\/]|\.[cm]?[jt]sx?$/.test(args[index + 1]))
        options.push(args[++index]);
    } else if (valued.has(argument) && args[index + 1] && !args[index + 1].startsWith("-")) {
      options.push(args[++index]);
    }
  }
  return { options, files };
}
