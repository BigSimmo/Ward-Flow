import { describe, expect, it } from "vitest";
import {
  officerRefusalText,
  UNDO_MOVED_ON_LINE,
} from "@/components/ward-management/officer/use-transport-command-feedback";
import { estimatedTimeProblem } from "@/components/ward-management/transport/transport-booking-form";

describe("officer refusal wording (R-MOVE-4)", () => {
  const clash = "Another desk changed this movement first. Review the latest board before trying again.";
  it("keeps the board's words for a real clash on a step", () => {
    expect(officerRefusalText(clash, "En route")).toBe(clash);
  });
  it("says what blocks a refused Undo, without blaming a desk", () => {
    expect(officerRefusalText(clash, "Undo")).toBe(UNDO_MOVED_ON_LINE);
    expect(UNDO_MOVED_ON_LINE).not.toMatch(/desk/i);
  });
});

describe("estimated time at the field (R-MOVE-13)", () => {
  it("accepts blank and readable times", () => {
    expect(estimatedTimeProblem("")).toBeUndefined();
    expect(estimatedTimeProblem("14:40")).toBeUndefined();
  });
  it("names 24:00 and tells what to type", () => {
    expect(estimatedTimeProblem("24:00")).toBe("24:00 is not a clock time. Type 00:00 and choose Tomorrow.");
  });
  it("names other unreadable entries", () => {
    expect(estimatedTimeProblem("25:61")).toMatch(/^25:61 is not a clock time\./u);
  });
});
