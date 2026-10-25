import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PatientHistoryTab } from "@/components/ward-management/patients/patient-dossier-tabs";
import type { PatientNowRecord } from "@/components/ward-management/patients/patient-now-records";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Q16 (owner, 16 Sept 2026): withdrawing an acceptance while a bed is held releases the bed in the
// same act. The patient's History tab lists both facts, not only the stage change. Synthetic data.
afterEach(() => {
  cleanup();
});

describe("the History tab after withdrawing an acceptance that held a bed", () => {
  it("lists the withdrawal and the bed release, naming the ward", () => {
    const seeded = seedWardFlowState();
    const after = wardFlowReducer(seeded, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: "WF-004",
      reason: "the_bed_was_lost",
    });
    expect(after.rejections).toEqual(seeded.rejections);
    const movement = after.movements.find((candidate) => candidate.id === "WF-004")!;
    const unitName = (id: string) => after.units.find((unit) => unit.id === id)?.name;

    render(
      <PatientHistoryTab
        record={{ presentations: [] } as unknown as PatientNowRecord}
        movement={movement}
        dayZero={new Date(2026, 9, 21)}
        unitName={unitName}
        open
        onBackToNow={() => undefined}
      />,
    );

    const ward = unitName(seeded.movements.find((candidate) => candidate.id === "WF-004")!.acceptedUnitId!)!;
    expect(screen.getByText(`Acceptance withdrawn, ${ward}, by coordinator`)).toBeInTheDocument();
    expect(screen.getByText(`Pulled bed released, ${ward}, by coordinator`)).toBeInTheDocument();
  });
});
