import { describe, expect, it } from "vitest";

import { extractOverdue } from "@/components/ward-management/alerts/alerts-screen";

describe("extractOverdue keeps the whole recorded duration", () => {
  it.each([
    ["Deadline passed 1 d 3 h overdue", "1 d 3 h overdue"],
    ["Hold expired 2 d overdue", "2 d overdue"],
    ["Deadline 3 h 05 min overdue", "3 h 05 min overdue"],
    ["Deadline 45 min overdue", "45 min overdue"],
  ])("%s", (detail, expected) => {
    expect(extractOverdue(detail)).toBe(expected);
  });

  it("returns null when nothing is overdue", () => {
    expect(extractOverdue("2 h 10 min left")).toBeNull();
  });
});
