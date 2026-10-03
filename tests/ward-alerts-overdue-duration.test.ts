import { describe, expect, it } from "vitest";

import { extractOverdue } from "@/components/ward-management/alerts/alerts-screen";

describe("extractOverdue keeps the whole recorded duration", () => {
  it.each([
    ["Deadline passed 1d 3h overdue", "1d 3h overdue"],
    ["Hold expired 2d overdue", "2d overdue"],
    ["Deadline 3h 05m overdue", "3h 05m overdue"],
    ["Deadline 45m overdue", "45m overdue"],
  ])("%s", (detail, expected) => {
    expect(extractOverdue(detail)).toBe(expected);
  });

  it("returns null when nothing is overdue", () => {
    expect(extractOverdue("2h 10m left")).toBeNull();
  });
});
