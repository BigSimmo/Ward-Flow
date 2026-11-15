import { describe, expect, it } from "vitest";

import { durMinutes } from "@/components/wf";
import { splitDuration } from "@/components/ward-management/ward-clock";

// R-HOME-3: elapsed time reads in plain words with a space, never "45m", "15h 52m" or "2d 14h".
describe("plain duration words", () => {
  it.each([
    [45, "45 min"],
    [15 * 60 + 52, "15 h 52 min"],
    [2 * 1440 + 14 * 60, "2 d 14 h"],
    [3 * 60, "3 h 00 min"],
  ])("splitDuration(%i) reads %s", (minutes, text) => {
    expect(splitDuration(minutes)).toBe(text);
  });

  it("the kit's durMinutes reads the same words", () => {
    expect(durMinutes(45)).toBe("45 min");
    expect(durMinutes(15 * 60 + 52)).toBe("15 h 52 min");
    expect(durMinutes(2 * 1440 + 14 * 60)).toBe("2 d 14 h");
    expect(durMinutes(4 * 60 + 18)).toBe("4 h 18 min");
  });
});
