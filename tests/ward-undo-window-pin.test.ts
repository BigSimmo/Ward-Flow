import { describe, expect, it } from "vitest";

import { HOW_TOS } from "../src/components/ward-management/help/ward-help-howto";
import { UNDO_WINDOW_MINUTES } from "../src/components/ward-management/ward-operational-defaults";

/**
 * Deep-DP5-2 (master stress test, 14 Nov 2026). The Undo window is 5 minutes (AK-V-87; D-176 F3;
 * D-192 item 3). Every other test reads `UNDO_WINDOW_MINUTES` rather than the number, so the 14 Nov
 * run changed it from 5 to 6 in a throwaway copy and nothing failed, while the Help page, which types
 * the number by hand, would have gone on saying 5 while the engine allowed 6.
 *
 * THE 5 BELOW IS WRITTEN OUT BY HAND ON PURPOSE. Do not derive it from the constant: that would
 * reproduce the hole this closes. It is a software safety window, not a clinical or legal limit, but
 * a change is still Josh's decision. If he rules a new window, change the constant, this number and
 * the Help text together, and record the ruling as the next D entry in `docs/ward-flow/decisions.md`.
 */
const SIGNED_UNDO_WINDOW_MINUTES = 5;
const CHANGE_NEEDS_JOSH = `The Undo window is ${SIGNED_UNDO_WINDOW_MINUTES} minutes (D-176 F3, D-192 item 3). A change needs Josh's decision, recorded as the next D entry. Update ward-operational-defaults.ts, this test and the Help text (ward-help-howto.ts, "undo") together; never change the number silently.`;

describe("the Undo window is pinned (Deep-DP5-2)", () => {
  it("is 5 minutes", () => {
    expect(UNDO_WINDOW_MINUTES, CHANGE_NEEDS_JOSH).toBe(SIGNED_UNDO_WINDOW_MINUTES);
  });

  it("is the number the Help page tells people", () => {
    const answer = HOW_TOS.find((howTo) => howTo.id === "undo")?.answer ?? "";
    expect(answer, CHANGE_NEEDS_JOSH).toContain(`Undo works for ${UNDO_WINDOW_MINUTES} minutes`);
    expect(answer, CHANGE_NEEDS_JOSH).toContain(`Undo works for ${SIGNED_UNDO_WINDOW_MINUTES} minutes`);
  });
});
