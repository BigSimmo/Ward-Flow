import "@testing-library/jest-dom/vitest";
import { cleanup, configure, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { PatientChronologyScreen } from "@/components/ward-management/reports/patient-chronology-screen";
import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

vi.mock("next/navigation", () => ({ usePathname: () => "/ward-flow/reports/chronology" }));
vi.mock("@/components/ward-management/ward-clipboard", () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));
configure({
  getElementError: () => new Error("Audit history/return query failed; record-bearing diagnostics suppressed."),
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

function StatusChange() {
  const { dispatch } = useWardFlow();
  return (
    <>
      <button
        onClick={() =>
          dispatch({
            type: "RECORD_LEGAL_FORM_WRITTEN",
            role: "ed",
            now: NOW_ANCHOR,
            movementId: "WF-014",
            formCode: "1A",
            writtenAt: NOW_ANCHOR - 10,
            paperExpiresAt: NOW_ANCHOR + 900,
          })
        }
      >
        Record form
      </button>
      <button
        onClick={() =>
          dispatch({
            type: "CHANGE_LEGAL_STATUS",
            role: "coordinator",
            now: NOW_ANCHOR + 1,
            movementId: "WF-014",
            legalStatus: "Voluntary",
            reason: "recorded_by_treating_team",
          })
        }
      >
        Change status
      </button>
    </>
  );
}

it("retains the open typed-time event and copies that event after another category is appended", () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatusChange />
      <PatientChronologyScreen initialPatientId="PT-013" />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Record form" }));
  const table = screen.getByTestId("ward-chronology-table");
  fireEvent.click(within(table).getByRole("button", { name: /Legal form made \(typed time\)/ }));
  expect(
    within(screen.getByRole("complementary", { name: "Event" })).getByRole("heading", {
      name: "Legal form made (typed time)",
    }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Change status" }));
  const detail = screen.getByRole("complementary", { name: "Event" });
  expect(within(detail).getByRole("heading", { name: "Legal form made (typed time)" })).toBeInTheDocument();
  fireEvent.click(within(detail).getByRole("button", { name: "Copy row" }));
  expect(copyTextToClipboard).toHaveBeenCalledWith(expect.stringContaining("Legal form made (typed time)"));
  expect(copyTextToClipboard).not.toHaveBeenCalledWith(expect.stringContaining("Legal status changed"));
});

function Snapshot({ state, children }: { state: WardFlowState; children: ReactNode }) {
  const value = useWardFlow();
  return <WardFlowOverride value={{ ...value, ...state }}>{children}</WardFlowOverride>;
}

it("reopens a withdrawn return as a new blank plan with terminal wording and no closed-journey action", () => {
  let state = seedWardFlowState();
  const admissionId = outOfAreaLedger(state.admissions, state.units, NOW_ANCHOR).entries[0]!.admission.id;
  state = wardFlowReducer(state, {
    type: "RECORD_REPATRIATION",
    role: "coordinator",
    now: NOW_ANCHOR,
    admissionId,
    homeHospital: "RPH",
    receivingWardAgreed: true,
    mode: "road",
    provider: "Ambulance service",
    cadNumber: "CAD-4410",
    transportLegalStatus: "voluntary",
    estimatedAt: NOW_ANCHOR + 120,
  });
  const attempt = state.movements.at(-1)!;
  state = {
    ...state,
    movements: state.movements.map((movement) =>
      movement.id === attempt.id ? { ...movement, referredUnitIds: [state.units[0]!.id] } : movement,
    ),
  };
  state = wardFlowReducer(state, {
    type: "WITHDRAW_REFERRAL",
    role: "coordinator",
    now: NOW_ANCHOR + 1,
    movementId: attempt.id,
  });
  expect(state.rejections).toEqual([]);
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR + 2}>
      <Snapshot state={state}>
        <OutOfAreaBoard />
      </Snapshot>
    </WardFlowProvider>,
  );
  const row = screen.getByTestId(`ward-out-of-area-row-${admissionId}`);
  expect(row).toHaveTextContent("Return closed");
  fireEvent.click(row);
  expect(screen.getByText(/The previous return journey is closed/)).toBeInTheDocument();
  expect(screen.getByTestId("ward-out-of-area-repat-home-hospital")).toHaveValue("");
  expect(screen.queryByRole("link", { name: "Open movement" })).not.toBeInTheDocument();
  expect(screen.queryByTestId("ward-out-of-area-recorded")).not.toBeInTheDocument();
});
