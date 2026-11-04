import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { HomeServiceReturnRecord } from "@/components/ward-management/out-of-area/home-service-return";

const command = vi.hoisted(() => ({ raise: vi.fn() }));
vi.mock("@/components/ward-management/ward-flow-raise", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/ward-flow-raise")>()),
  useWardRaise: () => command.raise,
}));

import { CheckFoot } from "@/components/ward-management/on-call/on-call-check-foot";
import { buildOnCallDirectory } from "@/components/ward-management/on-call/on-call-directory";
import { HomeServiceReturnPanel } from "@/components/ward-management/out-of-area/home-service-return-panel";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, siteDirectory } from "@/components/ward-management/ward-sites";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { activeWardNetwork } from "@/components/ward-management/ward-sites";
import { standingFigures } from "@/components/ward-management/ward-standing-strip";
import { PlannedAdmissionsPanel } from "@/components/ward-management/capacity/planned-admissions-panel";
import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";

const STAY = "synthetic-return-stay";
const DIRECTORY = buildOnCallDirectory();
const homeHospital = siteDirectory[0]!.code;
const asked: HomeServiceReturnRecord = {
  admissionId: STAY,
  homeHospital,
  requestedAt: NOW_ANCHOR,
  requestedBy: "coordinator",
  prerequisites: [],
};

function Records({ children, records = [] }: { children: ReactNode; records?: HomeServiceReturnRecord[] }) {
  const state = useWardFlow();
  return <WardFlowOverride value={{ ...state, homeServiceReturns: records }}>{children}</WardFlowOverride>;
}
function view(children: ReactNode, records?: HomeServiceReturnRecord[]) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Records records={records}>{children}</Records>
    </WardFlowProvider>
  );
}

beforeEach(() => command.raise.mockReturnValue({ status: "accepted", commandId: "synthetic-save" }));
afterEach(() => {
  cleanup();
  command.raise.mockReset();
});

describe("operational forms wait for their own recorded outcome", () => {
  it.each(["refused", "failed"] as const)("does not claim a %s directory check was recorded", (status) => {
    command.raise.mockReturnValue({ status, commandId: "synthetic-check", message: "Synthetic check not recorded." });
    render(view(<CheckFoot entry={DIRECTORY[0]!} />));
    fireEvent.click(screen.getByTestId("ward-on-call-mark-checked"));
    expect(screen.queryByText("Check recorded.")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(/not recorded/i);
  });

  it("does not carry a successful check to the next directory entry", () => {
    const rendered = render(view(<CheckFoot entry={DIRECTORY[0]!} />));
    fireEvent.click(screen.getByTestId("ward-on-call-mark-checked"));
    expect(screen.getByText("Check recorded.")).toBeInTheDocument();
    rendered.rerender(view(<CheckFoot entry={DIRECTORY[1]!} />));
    expect(screen.queryByText("Check recorded.")).toBeNull();
  });

  it("blocks a second check while awaiting confirmation and ignores an obsolete answer", async () => {
    let resolve!: (answer: WardCommandOutcome) => void;
    command.raise.mockReturnValue(
      new Promise<WardCommandOutcome>((done) => {
        resolve = done;
      }),
    );
    const rendered = render(view(<CheckFoot entry={DIRECTORY[0]!} />));
    fireEvent.click(screen.getByTestId("ward-on-call-mark-checked"));
    fireEvent.click(screen.getByTestId("ward-on-call-mark-checked"));
    expect(command.raise).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Check recorded.")).toBeNull();
    rendered.rerender(view(<CheckFoot entry={DIRECTORY[1]!} />));
    await act(async () => resolve({ status: "accepted", commandId: "synthetic-check" }));
    expect(screen.queryByText("Check recorded.")).toBeNull();
  });

  it("retains the requested return's review date after refusal", () => {
    command.raise.mockReturnValue({
      status: "refused",
      commandId: "synthetic-return",
      message: "Synthetic request refused.",
    });
    render(view(<HomeServiceReturnPanel admissionId={STAY} presetHospital={homeHospital} />));
    const review = screen.getByLabelText("Next review");
    fireEvent.change(review, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Record return requested" }));
    expect(review).toHaveValue("3");
    expect(screen.queryByText(/^Return requested from/)).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(/refused/i);
  });

  it("retains answer choices until a matching late confirmation and sends only once", async () => {
    let resolve!: (answer: WardCommandOutcome) => void;
    command.raise.mockReturnValue({
      status: "failed",
      commandId: "synthetic-answer",
      confirmation: new Promise<WardCommandOutcome>((done) => {
        resolve = done;
      }),
    });
    render(view(<HomeServiceReturnPanel admissionId={STAY} />, [asked]));
    fireEvent.click(screen.getByRole("radio", { name: /^Agreed$/ }));
    const review = screen.getByLabelText("Next review");
    fireEvent.change(review, { target: { value: "2" } });
    const record = screen.getByRole("button", { name: "Record home service answer" });
    fireEvent.click(record);
    fireEvent.click(record);
    expect(command.raise).toHaveBeenCalledTimes(1);
    expect(review).toHaveValue("2");
    expect(screen.queryByText(/^Home service answer recorded:/)).toBeNull();
    await act(async () => resolve({ status: "accepted", commandId: "synthetic-answer" }));
    expect(review).toHaveValue("");
    expect(screen.getByText("Home service answer recorded: Agreed.")).toBeInTheDocument();
  });

  it("counts only current recorded legal deadlines in copied operational figures", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((candidate) => candidate.closure === undefined && candidate.legalForm)!;
    expect(Boolean(movement)).toBe(true);
    const current = {
      ...movement,
      legalStatus: "Involuntary inpatient" as const,
      examination: undefined,
      legalForm: { ...movement.legalForm!, code: "1A" as const, dueAt: NOW_ANCHOR - 5 },
    };
    const figures = (ended: boolean) =>
      standingFigures(
        {
          ...state,
          now: NOW_ANCHOR,
          chromeRole: "coordinator",
          movements: [
            {
              ...current,
              ...(ended ? { examination: { at: NOW_ANCHOR - 10, outcome: "inpatient_order" as const } } : {}),
            },
          ],
        },
        DEFAULT_DUE_SOON_THRESHOLDS,
        activeWardNetwork(),
      );
    expect(figures(false).find((figure) => figure.key === "passed")?.value).toBe("1");
    expect(figures(true).find((figure) => figure.key === "passed")?.value).toBe("0");
  });

  it("keeps a planned booking form open when unrelated data refreshes before its command answers", () => {
    const dispatch = vi.fn(() => new Promise<WardCommandOutcome>(() => {}));
    function Refreshable() {
      const world = useWardFlow();
      const [refresh, setRefresh] = useState(0);
      return (
        <WardFlowOverride
          value={{
            ...world,
            dispatch,
            admissions: refresh ? [...world.admissions] : world.admissions,
            shared: { enabled: true, status: "ready", error: null },
          }}
        >
          <button onClick={() => setRefresh((value) => value + 1)}>Refresh unrelated synthetic data</button>
          <PlannedAdmissionsPanel now={NOW_ANCHOR} />
        </WardFlowOverride>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Refreshable />
      </WardFlowProvider>,
    );
    fireEvent.click(within(screen.getByTestId("ward-planned-PA-SEED-01")).getByRole("button", { name: /^Cancel$/ }));
    fireEvent.change(screen.getByTestId("ward-planned-cancel-reason"), { target: { value: "rebooked" } });
    fireEvent.click(screen.getByTestId("ward-planned-cancel-confirm"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Refresh unrelated synthetic data" }));
    expect(screen.getByTestId("ward-planned-cancel-reason")).toHaveValue("rebooked");
  });

  it("preserves a refused return-plan draft and does not claim that it was recorded", () => {
    const dispatch = vi.fn((): WardCommandOutcome => ({
      commandId: "synthetic-return-plan",
      status: "refused",
      message: "Synthetic return plan refused.",
    }));
    function Board() {
      const state = useWardFlow();
      return (
        <WardFlowOverride value={{ ...state, dispatch }}>
          <OutOfAreaBoard admissions={wardAdmissions} />
        </WardFlowOverride>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Board />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getAllByTestId(/^ward-out-of-area-row-/)[0]!);
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-home-hospital"), { target: { value: "RPH" } });
    fireEvent.click(within(screen.getByTestId("ward-out-of-area-repat-mode")).getByLabelText("Road"));
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-provider"), {
      target: { value: "Ambulance (St John)" },
    });
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-cad"), { target: { value: "CAD-SYN-4410" } });
    fireEvent.click(screen.getByLabelText("Voluntary"));
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-estimated-time"), { target: { value: "14:30" } });
    fireEvent.click(screen.getByTestId("ward-out-of-area-repat-send"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("ward-out-of-area-repat-cad")).toHaveValue("CAD-SYN-4410");
    expect(screen.queryByText(/^Return recorded for/)).toBeNull();
    expect(screen.getAllByText(/Synthetic return plan refused/).length > 0).toBe(true);
  });

  it("keeps a pending withdrawal owned when an unrelated referral candidate changes", () => {
    const state = seedWardFlowState();
    const liveUnitId = state.units[0]!.id;
    const base = state.movements.find((movement) => movement.stage === "placement_requested")!;
    const movement = { ...base, referredUnitIds: [liveUnitId], acceptedUnitId: undefined };
    const dispatch = vi.fn(() => new Promise<WardCommandOutcome>(() => {}));
    render(
      <ShortlistPanel
        movement={movement}
        now={NOW_ANCHOR}
        units={state.units}
        bedReleases={state.bedReleases}
        leaveBeds={state.leaveBeds}
        admissions={state.admissions}
        referrals={state.referrals}
        selectedUnitId={undefined}
        onSelectUnit={() => {}}
        dispatch={dispatch}
        parallelReferralCap={state.configuration.parallelReferralCap}
      />,
    );
    fireEvent.click(screen.getByTestId(`ward-shortlist-withdraw-toggle-${liveUnitId}`));
    const reason = screen.getByTestId(`ward-shortlist-withdraw-reason-${liveUnitId}`) as HTMLSelectElement;
    fireEvent.change(reason, { target: { value: reason.options[1]!.value } });
    fireEvent.click(screen.getByTestId(`ward-shortlist-withdraw-submit-${liveUnitId}`));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const candidate = screen
      .getAllByTestId(/^ward-shortlist-candidate-/)
      .find((node) => node.dataset.testid !== `ward-shortlist-candidate-${liveUnitId}`);
    expect(Boolean(candidate)).toBe(true);
    fireEvent.click(candidate!);
    fireEvent.click(screen.getByTestId(`ward-shortlist-withdraw-submit-${liveUnitId}`));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
