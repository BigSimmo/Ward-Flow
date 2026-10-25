import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  boardNotRefreshed,
  SAVE_NOT_CONFIRMED,
  SAVE_PROBLEMS,
  saveProblem,
  type SaveProblemKind,
} from "@/components/ward-management/ward-save-failure";

const SRC = path.join(__dirname, "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/u.test(name) ? [full] : [];
  });
}

describe("save problems say what happened, then what to do now (item 11)", () => {
  it.each(Object.keys(SAVE_PROBLEMS) as SaveProblemKind[])("%s has both parts as full sentences", (kind) => {
    const [happened, doNow] = SAVE_PROBLEMS[kind];
    for (const part of [happened, doNow]) {
      expect(part).toMatch(/^[A-Z]/u);
      expect(part).toMatch(/\.$/u);
      expect(part).not.toMatch(/!/u);
    }
    expect(saveProblem(kind)).toBe(`${happened} ${doNow}`);
  });

  it("uses the shared not-confirmed sentence as the fallback", () => {
    expect(SAVE_NOT_CONFIRMED).toBe(
      "Save is not confirmed. Check the board. If your change is not there, make it again.",
    );
    expect(boardNotRefreshed(true)).toMatch(/^The action was accepted, .* Press Retry to reload it/u);
    expect(boardNotRefreshed(false)).toMatch(/^The action was not applied, /u);
  });

  it("leaves no old save-problem sentence without its next step in screen code", () => {
    // These were said with no clear next step, or each screen wrote its own copy.
    const retired = [
      "Review the board before trying again",
      "Review the record before trying again",
      "Reconnect and review the board",
      "changes are disabled",
      "Review the workflow requirements",
      "Reconnect before making changes",
    ];
    const found = sourceFiles(SRC).flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return retired
        .filter((phrase) => text.includes(phrase))
        .map((phrase) => `${path.relative(SRC, file)}: ${phrase}`);
    });
    expect(found).toEqual([]);
  });
});
