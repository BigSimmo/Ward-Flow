// tests/helpers/community-screen-sources.ts
//
// The community team screen's source files, for the guards that read its text.
//
// On 15 Oct 2026 (fix list 2.5 and 9.6) `community-screen.tsx` was split, as a pure refactor, into
// sections and hooks beside it. A guard that read the one file would now read about a sixth of the
// screen and keep passing over the rest, so every source-text guard on this screen reads the whole
// list below instead. The list is written out rather than globbed, so a new file has to be added
// here on purpose; `tests/ward-community-corrected-claims.test.ts` fails if a file matching
// `COMMUNITY_SCREEN_FILE_PATTERN` exists in the folder and is missing from it.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const COMMUNITY_DIR = "src/components/ward-management/community";

/** The screen itself. Kept first, and kept the module routes and tests import. */
export const COMMUNITY_SCREEN_MAIN = `${COMMUNITY_DIR}/community-screen.tsx`;

/** Every file of the community team screen, repo-relative, the screen itself first. */
export const COMMUNITY_SCREEN_FILES: readonly string[] = [
  COMMUNITY_SCREEN_MAIN,
  `${COMMUNITY_DIR}/community-screen-helpers.ts`,
  `${COMMUNITY_DIR}/community-screen-panels.tsx`,
  `${COMMUNITY_DIR}/community-screen-phone.tsx`,
  `${COMMUNITY_DIR}/community-screen-hero.tsx`,
  `${COMMUNITY_DIR}/community-screen-sent-tab.tsx`,
  `${COMMUNITY_DIR}/community-screen-waiting-tab.tsx`,
  `${COMMUNITY_DIR}/community-screen-in-bed-tab.tsx`,
  `${COMMUNITY_DIR}/community-screen-back-tab.tsx`,
  `${COMMUNITY_DIR}/community-screen-caseload-tab.tsx`,
  `${COMMUNITY_DIR}/community-screen-transport-dialogs.tsx`,
  `${COMMUNITY_DIR}/community-screen-modals.tsx`,
  `${COMMUNITY_DIR}/community-screen-drawer.tsx`,
  `${COMMUNITY_DIR}/use-community-screen-demo-lists.ts`,
  `${COMMUNITY_DIR}/use-community-screen-overlays.ts`,
];

/** A file name that belongs to the screen: `community-screen*.ts(x)` or `use-community-screen*.ts`. */
export const COMMUNITY_SCREEN_FILE_PATTERN = /^(?:use-)?community-screen(?:-[a-z0-9-]+)?\.tsx?$/u;

/** The files in the community folder whose names say they belong to the screen, repo-relative. */
export function communityScreenFilesOnDisk(repoRoot: string = process.cwd()): string[] {
  return readdirSync(join(repoRoot, COMMUNITY_DIR))
    .filter((name) => COMMUNITY_SCREEN_FILE_PATTERN.test(name))
    .map((name) => `${COMMUNITY_DIR}/${name}`)
    .sort();
}

/** The whole screen's source, every file in `COMMUNITY_SCREEN_FILES` order. A missing file throws. */
export function communityScreenSource(repoRoot: string = process.cwd()): string {
  return COMMUNITY_SCREEN_FILES.map((file) => readFileSync(join(repoRoot, file), "utf8")).join("\n");
}
