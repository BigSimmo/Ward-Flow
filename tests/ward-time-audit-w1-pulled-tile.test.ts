import { describe, expect, it } from "vitest";

import { bedGonePhrase, pulledTileTiming } from "@/components/ward-management/board/ward-board-model";

/**
 * Time audit D15 (13 Nov 2026): the pulled-bed shift tile never says "0h ago", and never says
 * "Today" for a time nobody recorded. It reads the same hours the flow column's `bedGonePhrase` does.
 */
describe("pulled-bed tile timing (D15)", () => {
  it("says the time is not recorded when it is not", () => {
    expect(pulledTileTiming(null)).toEqual({ when: "Time not recorded", chip: "Pulled" });
    expect(bedGonePhrase(null)).toContain("not recorded");
  });

  it("says within the hour rather than 0h", () => {
    const timing = pulledTileTiming(0);
    expect(timing.when).toBe("Within the hour");
    expect(`${timing.when} ${timing.chip}`).not.toMatch(/\b0h\b/u);
  });

  it("keeps whole hours once an hour has passed", () => {
    expect(pulledTileTiming(3)).toEqual({ when: "3h ago", chip: "3h travelling" });
  });
});
