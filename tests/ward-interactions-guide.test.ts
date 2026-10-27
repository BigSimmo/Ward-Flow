import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KEYBOARD_SHORTCUTS } from "@/components/ward-management/help/ward-help-content";

const guide = readFileSync("docs/ward-flow/desk-guides/interactions.md", "utf8");

describe("keys and interactions desk guide (P3)", () => {
  const rows = [...guide.matchAll(/^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|/gm)].map((m) => ({ keys: m[1], action: m[2] }));

  it("lists every Help shortcut word for word, in order", () => {
    expect(rows).toEqual(KEYBOARD_SHORTCUTS.map(({ keys, action }) => ({ keys, action })));
  });
});
