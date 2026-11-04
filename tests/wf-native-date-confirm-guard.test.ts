// G1 and G4 guards (plan 2h, Josh, 3 Nov 2026, "Yes to all recommendations"): no new browser date
// or time box, and no new browser confirm box. The kit's DateField and `requestConfirm` are the way in.
// The files below still had one when this guard landed; each page group swaps its own and then
// removes its line here, so the list only shrinks. The drop-down ratchet is its own guard.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

/** Browser date, date and time, and time boxes still in use, by file, and how many each has. */
const KNOWN_DATE_BOXES: Record<string, number> = {
  "src/components/ward-management/board/ward-board-detail-panel.tsx": 1,
  "src/components/ward-management/capacity/planned-admissions-panel.tsx": 1,
  "src/components/ward-management/discharges/discharge-dependencies-panel.tsx": 1,
  "src/components/ward-management/discharges/discharge-detail-panes.tsx": 1,
  "src/components/ward-management/ed/ed-screen-row-forms.tsx": 1,
  "src/components/ward-management/patients/patient-ward-change-card.tsx": 1,
  "src/components/ward-management/referrals/ward-referral-drawer-referral-step.tsx": 1,
  "src/components/ward-management/tools/ward-tool-form-times.tsx": 1,
  "src/components/ward-management/ward/ward-drawer-discharge-date.tsx": 1,
};

/**
 * Browser confirm boxes. The kit's ConfirmDialog falls back to one when no styled host is mounted,
 * and the unsaved changes guard uses one for the browser's own leave prompt.
 */
const KNOWN_CONFIRMS: Record<string, number> = {
  "src/components/wf/confirm-dialog.tsx": 2,
  "src/components/ward-management/use-dirty-state-guard.ts": 2,
};

const DATE_BOX = /\btype\s*=\s*(?:"|'|\{\s*["'`])(?:date|datetime-local|time)["'`]/g;
const CONFIRM = /\b(?:window|globalThis|self)\s*\.\s*confirm\s*\(/g;

/** The source without comments, so a doc comment that names a box is not counted. */
export function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

export function countMatches(source: string, pattern: RegExp): number {
  return withoutComments(source).match(pattern)?.length ?? 0;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function scan(pattern: RegExp): Record<string, number> {
  const found: Record<string, number> = {};
  for (const path of sourceFiles(SRC)) {
    const count = countMatches(readFileSync(path, "utf8"), pattern);
    if (count > 0) found[relative(ROOT, path).split("\\").join("/")] = count;
  }
  return found;
}

describe("no new browser date boxes or confirm boxes", () => {
  it("finds each kind of box, and skips one named in a comment", () => {
    expect(countMatches('<input type="date" />', DATE_BOX)).toBe(1);
    expect(countMatches("<input type={'datetime-local'} />", DATE_BOX)).toBe(1);
    expect(countMatches('<input type="time" value={at} />', DATE_BOX)).toBe(1);
    expect(countMatches('<input type="text" />', DATE_BOX)).toBe(0);
    expect(countMatches('/** an `<input type="date">` */\n// <input type="time">', DATE_BOX)).toBe(0);
    expect(countMatches("if (window.confirm(message)) go();", CONFIRM)).toBe(1);
    expect(countMatches("globalThis.confirm('Leave?')", CONFIRM)).toBe(1);
    expect(countMatches("function confirm() {}\nconfirm();", CONFIRM)).toBe(0);
    expect(countMatches('const link = "https://example.test"; window.confirm(x)', CONFIRM)).toBe(1);
  });

  it("adds no browser date or time box outside the known list, which only shrinks", () => {
    // A new box: use the kit's DateField. One swapped: remove or lower its line above.
    expect(scan(DATE_BOX)).toEqual(KNOWN_DATE_BOXES);
  });

  it("adds no browser confirm box outside the known list, which only shrinks", () => {
    // A new box: use the kit's `requestConfirm`. One swapped: remove or lower its line.
    expect(scan(CONFIRM)).toEqual(KNOWN_CONFIRMS);
  });
});
