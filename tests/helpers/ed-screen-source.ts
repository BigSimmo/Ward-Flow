// tests/helpers/ed-screen-source.ts
//
// The ED screen's source text, read as one piece.
//
// WHY THIS EXISTS. Fix list 2.5 and 9.6 (15 Oct 2026) split `ed/ed-screen.tsx`, a 6,500 line file,
// into sibling files (`ed-screen-*.ts(x)` and `use-ed-screen-*.ts`) with no change to behaviour or
// markup. Several tests read the screen's source and assert that it carries a control, a dispatch
// or a class name. A test that kept reading `ed-screen.tsx` alone would now fail for the wrong
// reason, and a test narrowed to one split file would stop catching the control moving elsewhere
// on the screen. Reading every file of the screen keeps each assertion at the strength it had
// against the one file.
//
// The list is found from the folder rather than written out, so a later split file joins it
// without anyone remembering to add it. `ed-screen.tsx` comes first and must be present.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ED_SCREEN_DIR = "src/components/ward-management/ed";

const SPLIT_FILE = /^(ed-screen-[a-z0-9-]+|use-ed-screen-[a-z0-9-]+)\.tsx?$/;

/** Every file of the ED screen, relative to the repository root: `ed-screen.tsx` first, then each
 *  split file in name order. Throws if `ed-screen.tsx` is missing, so a rename cannot leave a
 *  caller scanning an empty or partial screen. */
export function edScreenSourceFiles(): string[] {
  const names = readdirSync(ED_SCREEN_DIR);
  if (!names.includes("ed-screen.tsx")) {
    throw new Error(`${ED_SCREEN_DIR}/ed-screen.tsx is missing; the ED screen source cannot be read`);
  }
  const split = names.filter((name) => SPLIT_FILE.test(name) && !/\.test\.tsx?$/.test(name)).sort();
  return ["ed-screen.tsx", ...split].map((name) => join(ED_SCREEN_DIR, name));
}

/** The whole ED screen's source: every file from `edScreenSourceFiles()`, joined by a newline. */
export function edScreenSource(): string {
  return edScreenSourceFiles()
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}
