import { isAbsolute, relative } from "node:path";

/**
 * The redesign mock-ups' design-only code (draft PR #1118; D-89, D-91).
 *
 * - `src/components/ward-redesign/` holds "fork" copies of today's screens. Each is a copy of a real
 *   screen with the design change applied, so the difference between the two files is the work to
 *   build. A page build deletes its own copy (`docs/mockup-retirement-policy.md`).
 * - `src/app/mockups/ward-flow-redesign/` is the viewer that draws them inside the real shell and
 *   synthetic world. Like every `/mockups` route it is blocked in production, by the proxy and by its
 *   own layout (`shouldBlockProductionMockups`).
 *
 * Structural guards written for the real app (the seam, one source of truth, the override-surface
 * scan, the never-build mail link) would otherwise count every copy as a second real surface. They
 * skip these paths, and only these: no real-app file is ever matched here, and each guard keeps
 * judging the real screens the copies came from. Delete this file, and every use of it, when the last
 * page is built and both folders are gone.
 */
const REDESIGN_FORKS = "src/components/ward-redesign/";
const REDESIGN_VIEWER = "src/app/mockups/ward-flow-redesign/";

/** Repo-relative, forward slashes, whether the caller walked with absolute or relative paths. */
function toRepoPath(path: string): string {
  const repoRelative = isAbsolute(path) ? relative(process.cwd(), path) : path;
  return repoRelative.split("\\").join("/").replace(/^\.\//u, "");
}

/** True for a design-only fork copy under `src/components/ward-redesign/`. */
export function isRedesignFork(path: string): boolean {
  return toRepoPath(path).startsWith(REDESIGN_FORKS);
}

/** True for a fork copy or the mock-up viewer route that draws them. */
export function isRedesignMockup(path: string): boolean {
  const repoPath = toRepoPath(path);
  return repoPath.startsWith(REDESIGN_FORKS) || repoPath.startsWith(REDESIGN_VIEWER);
}
