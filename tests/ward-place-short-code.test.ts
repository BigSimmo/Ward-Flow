import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { placeShortCode } from "@/components/ward-management/ward-place-names";

/** Audit four item 24: the short code a tight Chase button uses, read from the ward's name. Synthetic seed only. */
describe("placeShortCode", () => {
  const units = seedWardFlowState().units;

  it("takes the leading capitals when the name opens with a code", () => {
    expect(placeShortCode("bty-adult-secure", units)).toBe("BTY");
    expect(placeShortCode("sjgs-adult-open", units)).toBe("SJGS");
  });

  it("falls back to the site code for a name with no code prefix", () => {
    expect(placeShortCode("bun-adult-open", units)).toBe("BUN");
    expect(placeShortCode("rph-adult-secure", units)).toBe("RPH");
  });

  it("reads the network catalogue when the screen's own list does not hold the ward", () => {
    expect(placeShortCode("bty-adult-secure", [])).toBe("BTY");
    expect(placeShortCode("bun-adult-open", [])).toBe("BUN");
  });

  it("falls back to the name when there is no site code to read", () => {
    const unknown = [{ id: "synthetic-ward", name: "Synthetic Ward", siteCode: "" }];
    expect(placeShortCode("synthetic-ward", unknown)).toBe("Synthetic Ward");
  });
});
