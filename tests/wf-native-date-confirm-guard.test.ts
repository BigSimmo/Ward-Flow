import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// 2h guard (Josh, 4 Nov 2026): the app uses its own date and time fields and its own confirm
// dialog. This test fails on any NEW browser date or time box (`type="date"`, `"time"`,
// `"datetime-local"`, `"month"`, `"week"`) or `window.confirm(` in `src`. The list below is the
// set that already existed. It may only shrink: fix one, then lower or delete its entry.
// Never add a file or raise a count to make this pass; use the wf date field or confirm dialog.

const KNOWN: Record<string, { dateBoxes?: number; confirms?: number }> = {
  "src/components/ward-management/board/ward-board-detail-panel.tsx": { dateBoxes: 1 },
  "src/components/ward-management/capacity/planned-admissions-panel.tsx": { dateBoxes: 1 },
  "src/components/ward-management/discharges/discharge-dependencies-panel.tsx": { dateBoxes: 1 },
  "src/components/ward-management/discharges/discharge-detail-panes.tsx": { dateBoxes: 1 },
  "src/components/ward-management/referrals/ward-referral-drawer-referral-step.tsx": { dateBoxes: 1 },
  "src/components/ward-management/tools/ward-tool-form-times.tsx": { dateBoxes: 1 },
  "src/components/ward-management/use-dirty-state-guard.ts": { confirms: 2 },
  "src/components/ward-management/ward/ward-drawer-discharge-date.tsx": { dateBoxes: 1 },
  "src/components/wf/confirm-dialog.tsx": { confirms: 2 },
};

const SRC = join(process.cwd(), "src");
// Any JSX spelling: spaces round `=`, either quote, bare or in braces (`type = "date"`, `type={'date'}`).
const DATE_BOX = /\btype\s*=\s*\{?\s*(["'`])(?:date|time|datetime-local|month|week)\1\s*\}?/g;
const CONFIRM = /window\.confirm\(/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|jsx?)$/.test(name) ? [full] : [];
  });
}

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function scan() {
  const found: Record<string, { dateBoxes: number; confirms: number }> = {};
  for (const file of sourceFiles(SRC)) {
    const text = withoutComments(readFileSync(file, "utf8"));
    const dateBoxes = (text.match(DATE_BOX) ?? []).length;
    const confirms = (text.match(CONFIRM) ?? []).length;
    if (dateBoxes || confirms) found[relative(process.cwd(), file).split(sep).join("/")] = { dateBoxes, confirms };
  }
  return found;
}

describe("the date-box pattern", () => {
  it("matches every JSX spelling of a native date or time box", () => {
    for (const spelling of [`type="date"`, `type = "date"`, `type={'date'}`, `type={"time"}`, "type={`week`}"])
      expect(spelling.match(DATE_BOX), spelling).not.toBeNull();
    expect(`type="text"`.match(DATE_BOX)).toBeNull();
    expect(`inputType="datetime"`.match(DATE_BOX)).toBeNull();
  });
});

describe("2h guard: no new browser date or time boxes, no new window.confirm", () => {
  const found = scan();

  it("adds no date or time box and no window.confirm outside the known list", () => {
    const extra = Object.entries(found).flatMap(([file, now]) => {
      const was = KNOWN[file] ?? {};
      return [
        now.dateBoxes > (was.dateBoxes ?? 0)
          ? `${file}: ${now.dateBoxes} date or time box(es), allowed ${was.dateBoxes ?? 0}`
          : "",
        now.confirms > (was.confirms ?? 0)
          ? `${file}: ${now.confirms} window.confirm, allowed ${was.confirms ?? 0}`
          : "",
      ].filter(Boolean);
    });
    expect(extra).toEqual([]);
  });

  it("keeps the known list honest: fixed files must be removed from it", () => {
    const stale = Object.entries(KNOWN).flatMap(([file, was]) => {
      const now = found[file] ?? { dateBoxes: 0, confirms: 0 };
      return [
        (was.dateBoxes ?? 0) > now.dateBoxes ? `${file}: lower dateBoxes to ${now.dateBoxes}` : "",
        (was.confirms ?? 0) > now.confirms ? `${file}: lower confirms to ${now.confirms}` : "",
      ].filter(Boolean);
    });
    expect(stale).toEqual([]);
  });
});
