import { describe, expect, it } from "vitest";

import { boardCardLine } from "@/components/ward-management/board/ward-board";

/** Synthetic names only. */
const PERSON = { familyName: "Example", givenName: "Sam" };

describe("the line that leads an occupied /board card", () => {
  it("leads with a recorded bed number, then surname and given name in full (D-83)", () => {
    expect(boardCardLine(4, PERSON)).toBe("Bed 4 · Example, Sam");
  });

  it("shows the name alone when no bed number is recorded", () => {
    expect(boardCardLine(undefined, PERSON)).toBe("Example, Sam");
  });

  it("shows the bed alone when no person is linked", () => {
    expect(boardCardLine(7, null)).toBe("Bed 7");
  });

  it("shows nothing when neither is recorded", () => {
    expect(boardCardLine(undefined, null)).toBe("");
    expect(boardCardLine(undefined, { familyName: "Example", givenName: "" })).toBe("Example");
  });
});
