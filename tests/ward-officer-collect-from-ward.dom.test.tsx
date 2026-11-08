import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { OfficerScreen, isOfficerJob } from "@/components/ward-management/officer/officer-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { SENDING_WARD_NOT_RECORDED, sourceWardName } from "@/components/ward-management/ward-movement-origin";

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * WF-J03 (8 Nov 2026): a ward-to-ward journey is collected from the sending ward, as Handover
 * already shows, never from the ED or community team the patient first came from. Synthetic seed only.
 */
describe("transport officer collects a ward-to-ward journey from the sending ward", () => {
  it("names the source admission's ward on the job row", () => {
    const state = seedWardFlowState();
    const job = state.movements.find(isOfficerJob);
    if (!job) throw new Error("no seeded officer job");
    const stay = state.admissions.find((row) => row.state === "occupied" && row.unitId !== job.acceptedUnitId)!;
    const wardName = state.units.find((unit) => unit.id === stay.unitId)!.name;
    const live = movementById(job.id);
    if (!live) throw new Error(`${job.id} is missing from the seed`);
    // The seed copies the movement when the provider mounts, so the link is in place first.
    const saved = live.sourceAdmissionId;
    live.sourceAdmissionId = stay.id;
    try {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <OfficerScreen />
        </WardFlowProvider>,
      );
      const row = screen.getByTestId(`ward-officer-select-${job.id}`).closest("tr")!;
      expect(row.textContent).toMatch(new RegExp(`${escape(wardName)}\\s*→`));
      expect(within(row).queryByText(/ED\b/)).toBeNull();
    } finally {
      live.sourceAdmissionId = saved;
    }
  });

  it("says the sending ward is not recorded when the source stay cannot be found", () => {
    expect(sourceWardName({ sourceAdmissionId: "missing" }, [], [])).toBe(SENDING_WARD_NOT_RECORDED);
    expect(sourceWardName({}, [], [])).toBeUndefined();
  });
});
