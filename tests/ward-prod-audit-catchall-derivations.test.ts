import { describe, expect, it } from "vitest";

import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import {
  buildActionInbox,
  deriveAfternoonDischarges,
  eligibleCandidatesAmong,
} from "@/components/ward-management/ward-derivations";
import {
  INBOX_CATEGORIES,
  seedWardFlowState,
  seedWardFlowStateAt,
} from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("production audit catch-all: ward derivations", () => {
  it("EDR-09: a non-finite now finds no discharge rather than reading as minute zero", () => {
    const state = seedWardFlowStateAt(0);
    const stay = state.admissions.find((admission) => admission.state === "occupied")!;
    const due = [{ ...stay, expectedDischargeAt: CLINICAL_VALUES.dischargePrepWindow.value - 1 }];
    expect(deriveAfternoonDischarges(due, 0)).toHaveLength(1);
    expect(deriveAfternoonDischarges(due, Number.NaN)).toHaveLength(0);
    // @ts-expect-error EDR-09: `now` is an Instant (minutes from day zero), never a date string.
    expect(deriveAfternoonDischarges(due, "2026-10-25T10:00:00Z")).toHaveLength(0);
  });

  it("no eligible bed says the patient stays on the waiting list", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((row) => row.id === "WF-302")!;
    const unit = eligibleCandidatesAmong(movement, state.units, NOW_ANCHOR, state.units.length).find(
      (row) => row.verdict.eligible,
    )!.unit;
    const full = { ...unit, allocatable: { ...unit.allocatable, value: 0 }, allocatableLocked: 0 };
    const row = buildActionInbox([movement], NOW_ANCHOR, [full]).find((item) =>
      item.id.startsWith(INBOX_CATEGORIES.no_eligible_bed.idPrefix),
    )!;
    expect(row.detail).toBe("No ward in the network is currently eligible; the patient stays on the waiting list");
  });
});
