// H-0096 / H-0700 (27 Oct 2026): a community team sees a catchment client's stay with ward and dates
// only. The projection fills observation with General to keep the record's shape, so the patient
// page must say the level is withheld, never "General".
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildPatientStatus } from "@/components/ward-management/patients/patient-status-card";
import { WardAccessScope, useIsDatesOnlyStay } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  cleanup();
  setWardFeatureFlagOnDevice("role-access", null);
  resetWardAccessStoreForTests();
});

function Probe() {
  const { admissions } = useWardFlowSelect("admissions");
  const datesOnly = useIsDatesOnlyStay();
  return <span data-testid="dates-only">{admissions.filter((admission) => datesOnly(admission.id)).length}</span>;
}

function renderAs(access: Parameters<typeof setWardAccess>[0]) {
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess(access);
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <Probe />
      </WardAccessScope>
    </WardFlowProvider>,
  );
  return Number(screen.getByTestId("dates-only").textContent);
}

describe("community view of a catchment client's stay", () => {
  it("marks the team's catchment stays as dates only", () => {
    expect(
      renderAs({ role: "community", scope: { kind: "team", teamName: "Midland Community Team" } }),
    ).toBeGreaterThan(0);
  });

  it("marks nothing for the statewide desk", () => {
    expect(renderAs({ role: "coordinator", scope: { kind: "statewide" } })).toBe(0);
  });

  it("shows the observation as withheld, not General", () => {
    const admission = seedWardFlowState().admissions.find((candidate) => candidate.state === "occupied")!;
    const noop = () => undefined;
    const base = {
      admission,
      hasBedHold: false,
      now: NOW_ANCHOR,
      dayZero: new Date(0),
      onOpenPlacement: noop,
      onClearance: noop,
      onBookTransport: noop,
      onArrivalTime: noop,
      onRecordReturn: noop,
      onMarkAbsent: noop,
      onAbsenceStep: noop,
      onRecordCto: noop,
      onEndCto: noop,
    };
    const cell = (withheld: boolean) =>
      buildPatientStatus("ward", { ...base, stayWithheld: withheld }).cells.find(
        (entry) => entry.key === "observation",
      )!;
    expect(cell(true).value).toBe("Withheld");
    expect(cell(true).sub).toBe("Your team sees the ward and dates only");
    expect(cell(false).value).not.toBe("Withheld");
  });
});
