import { describe, expect, it } from "vitest";

import { TIER_LONG } from "@/components/ward-management/triage/triage-record";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { seeBy, seeByWindowUnsigned } from "@/components/ward-management/triage/triage-see-by";

const today = new Date(2026, 10, 9, 10, 50);

describe("seeBy", () => {
  it("counts from the reviewed time with the tier's window", () => {
    expect(seeBy("B", "09/11/2026 10:42", today, TIER_LONG.B)).toEqual({
      when: "12:42 today",
      basis: "B, within 2 hours of review at 10:42",
      unsigned: false, // D-209 item 7: B to E signed 14 Nov 2026
    });
  });

  it("names tomorrow and later days", () => {
    expect(seeBy("C", "09/11/2026 18:00", today, TIER_LONG.C)?.when).toBe("06:00 tomorrow");
    expect(seeBy("D", "09/11/2026 10:42", today, TIER_LONG.D)?.when).toBe("Wed 11 Nov 10:42");
  });

  it("counts tier E in days", () => {
    expect(seeBy("E", "09/11/2026 10:42", today, TIER_LONG.E)).toEqual({
      when: "Mon 23 Nov 10:42",
      basis: `E, ${TIER_LONG.E.toLowerCase()} of review at 10:42`,
      unsigned: false, // D-209 item 7
    });
  });

  it("ignores daylight saving on the device", () => {
    // Sydney clocks go forward on 4 Oct 2026; a Perth review window must not move with them.
    const day = new Date(2026, 9, 4, 1, 30);
    expect(seeBy("B", "04/10/2026 01:30", day, TIER_LONG.B)?.when).toBe("03:30 today");
  });

  it("says Now for A, even before a reviewed time", () => {
    expect(seeBy("A", "", today, TIER_LONG.A)?.when).toBe("Now");
  });

  it("gives nothing for F, G, no urgency or no reviewed time", () => {
    expect(seeBy("F", "09/11/2026 10:42", today, TIER_LONG.F)).toBeNull();
    expect(seeBy("G", "09/11/2026 10:42", today, TIER_LONG.G)).toBeNull();
    expect(seeBy(null, "09/11/2026 10:42", today, "")).toBeNull();
    expect(seeBy("B", "", today, TIER_LONG.B)).toBeNull();
    expect(seeBy("B", "31/02/2026 10:42", today, TIER_LONG.B)).toBeNull();
  });

  it("marks a window as not signed while its register entry is unsigned (clinical check pack C6)", () => {
    for (const tier of ["B", "C", "D", "E"] as const) {
      const entry: { status: string } = CLINICAL_VALUES[`triageUrgency${tier}`];
      expect(seeByWindowUnsigned(tier)).toBe(entry.status !== "signed");
    }
    expect(seeByWindowUnsigned("A")).toBe(false);
  });

  it("reads B to E as signed by Josh on 14 Nov 2026 (D-209 item 7)", () => {
    for (const tier of ["B", "C", "D", "E"] as const) {
      expect(CLINICAL_VALUES[`triageUrgency${tier}`]).toMatchObject({
        status: "signed",
        signedBy: "Josh (product owner)",
        signedOn: "2026-11-14",
      });
      expect(seeByWindowUnsigned(tier)).toBe(false);
    }
  });
});
