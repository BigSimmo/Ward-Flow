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
]);

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

/** @param {boolean} required @param {string | null} [only] one device project, or null for both */
export function releaseGateCases(required, only = null) {
  if (!required) return [];
  const projects = only === null ? RELEASE_GATE_PROJECTS : [releaseGateProjectFor(only)];
  return projects.flatMap((project) => [
    ...REQUIRED_RELEASE_JOURNEYS.map((title) => ({ project, file: "release-gate-journeys.spec.ts", title })),
    ...REQUIRED_RELEASE_JOURNEY_FILES.map(({ file, title }) => ({ project, file, title })),
  ]);
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
export function sharedModeCases() {
  return REQUIRED_SHARED_JOURNEYS.map((title) => ({
    project: "ward-shared-mode",
    file: "ward-shared-mode.spec.ts",
    title,
  }));
}
