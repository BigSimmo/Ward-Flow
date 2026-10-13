import { describe, expect, it } from "vitest";

import { isbarLines, situationState, type HandoverRow } from "@/components/ward-management/handover/handover-model";

/** Audit A4-26 (13 Oct 2026): Situation reads the latest state; Recommendation is owner and next step. */
const row = (fields: Partial<HandoverRow>) =>
  ({
    id: "WF-X",
    name: "Synthetic Person",
    umrn: "UM000001",
    tier: 2,
    edShort: "SCGH ED",
    openedAt: 0,
    stage: "destination_review",
    owner: "Flow coordinator",
    ownerShort: "Coordinator",
    legalStatus: "Involuntary inpatient",
    formCode: "4C",
    obs: "Standard",
    asked: [],
    declines: [],
    escalated: false,
    urgent: false,
    ...fields,
  }) as HandoverRow;

describe("ISBAR from the latest state", () => {
  it("does not say a ward is reviewing when every ward declined and none is asked", () => {
    const wren = row({
      declines: Array.from({ length: 5 }, (_, index) => ({
        unitId: `u${index}`,
        name: `Ward ${index}`,
        reason: "Full",
        at: 10,
      })),
    });
    expect(situationState(wren, 100)).toBe("5 declined, none asked");
    const lines = isbarLines(wren, 100);
    expect(lines.find((line) => line.key === "S")!.text).not.toContain("Ward reviewing");
    expect(lines.find((line) => line.key === "R")!.text).toBe("Coordinator: Ask another ward, 5 declined");
  });

  it("says a bed pull expired rather than 'Bed pulled', and recommends move or release", () => {
    const cadwaller = row({ stage: "pulled", to: { unitId: "bty", name: "BTY ward" }, pullExpiresAt: 50 });
    expect(situationState(cadwaller, 80)).toBe("Bed pull at BTY ward expired 30m ago");
    expect(isbarLines(cadwaller, 80).find((line) => line.key === "R")!.text).toBe(
      "Coordinator: Pull expired 30m ago. Move or release",
    );
  });
});
