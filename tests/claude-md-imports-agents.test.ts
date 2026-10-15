import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

// Moved from the retired chat-control script: CLAUDE.md must pull in AGENTS.md first, so the
// repository rules cannot drift between the two entry points.
it("CLAUDE.md imports AGENTS.md as its first non-empty line", () => {
  const claude = readFileSync(path.resolve(__dirname, "../CLAUDE.md"), "utf8");
  const firstLine = claude.split(/\r?\n/).find((line) => line.trim() !== "");
  expect(firstLine?.trim()).toBe("@AGENTS.md");
});
