import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Lane E's Transport job panel (Josh, 31 October 2026: fix it in the kit). A disabled button with its
 * visible reason must not squeeze on a narrow panel: the button keeps its whole label, the reason wraps
 * rather than being cut with an ellipsis, and the pair may drop to two rows.
 */
const css = readFileSync(path.join(process.cwd(), "src/components/wf/button.module.css"), "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, "u").exec(css);
  expect(match, `${selector} rule`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("kit button with a visible reason", () => {
  it("lets the pair wrap to two rows", () => {
    expect(rule(".withReason")).toMatch(/flex-wrap:\s*wrap/u);
    expect(rule(".withReason")).toMatch(/max-width:\s*100%/u);
  });

  it("keeps the button's whole label", () => {
    expect(rule(".withReason > button")).toMatch(/flex:\s*none/u);
  });

  it("wraps the reason instead of cutting it", () => {
    const reason = rule(".reason");
    expect(reason).toMatch(/white-space:\s*normal/u);
    expect(reason).not.toMatch(/text-overflow:\s*ellipsis/u);
    expect(reason).not.toMatch(/overflow:\s*hidden/u);
  });
});
