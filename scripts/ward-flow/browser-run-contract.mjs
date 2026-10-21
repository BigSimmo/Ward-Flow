import { requestedProjects } from "./journey-run-verdict.mjs";

// Independent unit controls pin these four obligations. The browser specs keep their literal
// titles, so deleting or renaming a journey cannot also narrow the runtime obligation by accident.
export const REQUIRED_RELEASE_JOURNEYS = Object.freeze([
  "ED referral to bed offer: the ED raises a referral, the coordinator offers a ward, the ward accepts and pulls",
  "Morning bed meeting: a ward confirms its numbers and the coordinator's capacity board moves",
  "Transfer with transport: the ED books transport, the officer delivers, and the ward confirms arrival",
  "Discharge with bed release: a ward confirms a release, the person leaves, and the bed is ready on the board",
]);

export function releaseGateCases(required) {
  if (!required) return [];
  return ["release-gate-desktop", "release-gate-phone"].flatMap((project) =>
    REQUIRED_RELEASE_JOURNEYS.map((title) => ({ project, file: "release-gate-journeys.spec.ts", title })),
  );
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
