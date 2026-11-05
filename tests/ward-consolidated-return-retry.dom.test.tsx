import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, configure } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it } from "vitest";
import { WardFlowProvider, WardFlowOverride, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, type RepatriationRecord } from "@/components/ward-management/ward-flow-reducer";
import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

configure({ getElementError: () => new Error("Synthetic return retry query failed; record text suppressed.") });
afterEach(cleanup);

it("reopens the return plan form after the earlier agreed journey is withdrawn", () => {
  const seed = seedWardFlowState();
  const { entries } = outOfAreaLedger(seed.admissions, seed.units, NOW_ANCHOR);
  const stay = entries[0].admission;
  const returning: Movement = {
    ...seed.movements[0],
    id: "WF-SYNTHETIC-RETURN",
    sourceAdmissionId: stay.id,
    openedAt: NOW_ANCHOR,
    closure: { at: NOW_ANCHOR + 1, outcome: "did_not_proceed" as const, reason: "Synthetic withdrawal" },
  };
  const record: RepatriationRecord = {
    admissionId: stay.id,
    at: NOW_ANCHOR,
    by: "coordinator",
    homeHospital: "RPH",
    receivingWardAgreed: true,
    mode: "road",
    provider: "Ambulance service",
    cadNumber: "SYN-CAD-RETRY",
    transportLegalStatus: "involuntary",
    estimatedAt: NOW_ANCHOR + 120,
  };
  function Boundary({ children }: { children: ReactNode }) {
    const value = useWardFlow();
    return (
      <WardFlowOverride value={{ ...value, repatriations: [record], movements: [...value.movements, returning] }}>
        {children}
      </WardFlowOverride>
    );
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Boundary>
        <OutOfAreaBoard admissions={seed.admissions} />
      </Boundary>
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${stay.id}`));
  expect(screen.getByTestId("ward-out-of-area-repat-home-hospital")).toBeVisible();
  expect(screen.getByTestId("ward-out-of-area-repat-cad")).toBeVisible();
});
