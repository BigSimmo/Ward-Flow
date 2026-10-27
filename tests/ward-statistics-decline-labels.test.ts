import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";

/**
 * A decline reason on Statistics reads as the words the ward chose, never a de-underscored code.
 * "another_reason" spaced out reads "Another reason" and loses "needs follow-up" (PC review,
 * 27 Oct 2026). The overview cannot be rendered with its own movements here (see
 * `ward-statistics-decline-reporting.dom.test.tsx`), so its source is read instead.
 */
const OVERVIEW = "src/components/ward-management/statistics/statistics-overview-screen.tsx";

describe("Statistics decline reasons use the shared labels", () => {
  it("keeps the follow-up wording on the shared label", () => {
    expect(DECLINE_REASON_LABELS.another_reason).toBe("Another reason — needs follow-up");
  });

  it("the overview labels each decline tally from DECLINE_REASON_LABELS", () => {
    const source = readFileSync(OVERVIEW, "utf8");
    expect(source.match(/label: DECLINE_REASON_LABELS\[tally\.reason\]/g)).toHaveLength(2);
    expect(source).not.toMatch(/sentenceCase\(tally\.reason\)/);
  });
});
