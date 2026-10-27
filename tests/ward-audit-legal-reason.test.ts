import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { reasonLabel } from "@/components/ward-management/reports/patient-chronology";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * A legal status change keeps its chosen reason in the app's own audit, as the movement's history
 * already does (PC review, 27 Oct 2026). Older entries without one still read.
 */
describe("legal status audit reason", () => {
  it("records the chosen reason on the audit entry", () => {
    const after = wardFlowReducer(seedWardFlowState(), {
      type: "CHANGE_LEGAL_STATUS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: "WF-009",
      legalStatus: "Voluntary",
      reason: "correcting_an_error",
    });
    const entry = after.auditEvents.at(-1)!;
    expect(entry.category).toBe("legal-status");
    expect(entry.category === "legal-status" && entry.details.reason).toBe("correcting_an_error");
  });

  it("reads the reason in words in the chronology, and nothing for an older entry", () => {
    expect(reasonLabel("correcting_an_error")).toBe("Correcting an error");
    expect(reasonLabel(undefined)).toBe("");
  });
});
