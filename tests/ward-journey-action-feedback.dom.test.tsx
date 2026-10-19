import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/alerts",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { showWardTable } from "./helpers/capacity-ward-table";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { WardAnswerView } from "@/components/ward-management/ward/ward-answer-view";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardAccessScope, useWardRecordActors } from "@/components/ward-management/shell/ward-access";
import {
  resetWardAccessStoreForTests,
  setWardAccess,
  startAccessPreview,
  breakGlass,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { TransportExceptionDialog } from "@/components/ward-management/transport-exception-dialog";
import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { DischargeRecordDetail } from "@/components/ward-management/discharges/discharge-detail-panes";
import { useDischargeWorkspaceState } from "@/components/ward-management/discharges/use-discharge-workspace-state";
import { DischargePopulationSwitch } from "@/components/ward-management/discharges/discharge-board-filters";

function Override({
  dispatch,
  children,
  sessionAdopted,
}: {
  dispatch: WardCommandDispatch;
  children: ReactNode;
  sessionAdopted?: boolean;
}) {
  const state = useWardFlow();
  return (
    <WardFlowOverride value={{ ...state, dispatch, ...(sessionAdopted === undefined ? {} : { sessionAdopted }) }}>
      {children}
    </WardFlowOverride>
  );
}
function PopulationHarness() {
  const workspace = useDischargeWorkspaceState({});
  return <DischargePopulationSwitch s={workspace} />;
}
function deferred() {
  let finish!: (outcome: WardCommandOutcome) => void;
  let fail!: (reason?: unknown) => void;
  const promise = new Promise<WardCommandOutcome>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return { promise, finish, fail };
}
function renderCommand(children: ReactNode, dispatch: WardCommandDispatch) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Override dispatch={dispatch}>{children}</Override>
    </WardFlowProvider>,
  );
}
afterEach(() => {
  cleanup();
  delete document.body.dataset.commandOutcome;
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("command-specific action feedback", () => {
  it("holds population navigation until the client session is adopted", () => {
    const dispatch = vi.fn();
    const content = (adopted: boolean) => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Override dispatch={dispatch} sessionAdopted={adopted}>
          <PopulationHarness />
        </Override>
      </WardFlowProvider>
    );
    const view = render(content(false));
    const history = screen.getByTestId("ward-discharge-history");
    expect(history).toBeDisabled();
    expect(screen.getByTestId("ward-discharge-now")).toBeDisabled();
    expect(screen.getByText("Preparing discharge workspace…")).toBeInTheDocument();
    expect(screen.getByText("Preparing discharge workspace…").closest('[aria-busy="true"]')).toBeNull();
    fireEvent.click(history);
    expect(history).toHaveAttribute("aria-pressed", "false");
    view.rerender(content(true));
    expect(history).toBeEnabled();
    expect(screen.queryByText("Preparing discharge workspace…")).not.toBeInTheDocument();
    fireEvent.click(history);
    expect(history).toHaveAttribute("aria-pressed", "true");
  });
  it.each(["accepted", "refused", "failed", "cancelled"] as const)(
    "waits for transport's %s completion instead of counting reducer refusals",
    async (status) => {
      const command = deferred();
      const dispatch = vi.fn(() => command.promise);
      renderCommand(<OfficerScreen />, dispatch);
      fireEvent.click(screen.getByTestId("ward-officer-select-WF-005"));
      const button = screen.getByTestId("ward-officer-enroute-WF-005");
      fireEvent.click(button);
      expect(screen.queryByText(/^Transport en route for/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
      fireEvent.click(button);
      expect(dispatch).toHaveBeenCalledTimes(1);
      await act(async () =>
        command.finish({
          commandId: "controlled",
          status,
          message: status === "accepted" ? undefined : "Not accepted by the workspace.",
        }),
      );
      if (status === "accepted") {
        expect(screen.getByText(/^Transport en route for/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
      } else {
        expect(screen.getByText("Not accepted by the workspace.")).toBeInTheDocument();
        expect(screen.queryByText(/^Transport en route for/)).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
      }
    },
  );

  it("handles a transport promise rejection without success", async () => {
    const command = deferred();
    renderCommand(<OfficerScreen />, () => command.promise);
    fireEvent.click(screen.getByTestId("ward-officer-select-WF-005"));
    fireEvent.click(screen.getByTestId("ward-officer-enroute-WF-005"));
    await act(async () => command.fail(new Error("Synthetic offline failure")));
    expect(screen.getByText(/En route was not confirmed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("keeps a ward decline reason and open form after refusal, then completes on accepted retry", async () => {
    const first = deferred();
    const dispatch = vi
      .fn<WardCommandDispatch>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValue({ commandId: "retry", status: "accepted" });
    renderCommand(<WardAnswerView unitId="fsh-older-adult" />, dispatch);
    fireEvent.click(screen.getByTestId("ward-decline-toggle-WF-002"));
    const form = screen.getByTestId("ward-decline-form-WF-002");
    const reason = within(form).getByRole("radio", { name: "capability mismatch" });
    fireEvent.click(reason);
    fireEvent.submit(form);
    expect(screen.getByTestId("ward-decline-form-WF-002")).toBeInTheDocument();
    expect(screen.queryByText("Referral declined.")).not.toBeInTheDocument();
    await act(async () => first.finish({ commandId: "first", status: "refused", message: "The request changed." }));
    expect(reason).toBeChecked();
    expect(screen.getByTestId("ward-decline-form-WF-002")).toBeInTheDocument();
    await act(async () => fireEvent.submit(form));
    expect(screen.queryByTestId("ward-decline-form-WF-002")).not.toBeInTheDocument();
    expect(screen.getByText("Referral declined.")).toBeInTheDocument();
  });

  it("keeps the collection exception reason while pending and after refusal", async () => {
    let finish!: (accepted: boolean) => void;
    const confirm = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <TransportExceptionDialog
        open
        who="Synthetic person"
        action="Collected"
        gaps={["fit_to_travel_missing"]}
        onConfirm={confirm}
        onClose={vi.fn()}
      />,
    );
    const select = screen.getByLabelText("Reason");
    const option = within(select)
      .getAllByRole("option")
      .find((entry) => entry.getAttribute("value"));
    fireEvent.change(select, { target: { value: option!.getAttribute("value") } });
    const value = (select as HTMLSelectElement).value;
    fireEvent.click(screen.getByRole("button", { name: "Collected, record reason" }));
    expect(select).toHaveValue(value);
    await act(async () => finish(false));
    expect(select).toHaveValue(value);
  });
});

function PreviewCommand({ baseDispatch }: { baseDispatch: WardCommandDispatch }) {
  return (
    <Override dispatch={baseDispatch}>
      <WardAccessScope>
        <ScopedCommand />
      </WardAccessScope>
    </Override>
  );
}
function ScopedCommand() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      onClick={async () => {
        const outcome = await dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 1 });
        document.body.dataset.commandOutcome = outcome?.status;
      }}
    >
      Attempt preview write
    </button>
  );
}
function GlassCommand({ patientId }: { patientId: `PT-${string}` }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      onClick={async () => {
        const outcome = await dispatch({ type: "END_COMMUNITY_TREATMENT_ORDER", role: "coordinator", now, patientId });
        document.body.dataset.commandOutcome = outcome?.status;
      }}
    >
      Attempt glass write
    </button>
  );
}
function ActorProbe() {
  const actors = useWardRecordActors();
  return <output data-testid="actors">{JSON.stringify(actors)}</output>;
}
function DischargeProbe() {
  const s = useDischargeWorkspaceState({});
  const record = s.records.find((entry) => entry.unitId === "rph-adult-secure" && entry.admissionState === "occupied");
  return (
    <>
      <output data-testid="record-actor">{JSON.stringify(record && s.recordActorFor(record.unitId))}</output>
      <output data-testid="records">{s.records.length}</output>
      <button
        onClick={() => {
          s.setPopulation("records");
          s.openRecord(record!);
        }}
      >
        Open own discharge
      </button>
      <output data-testid="opened-record">{s.activeRecord?.admissionId ?? "none"}</output>
      {s.activeRecord ? <DischargeRecordDetail key={s.activeRecord.id} s={s} activeRecord={s.activeRecord} /> : null}
    </>
  );
}

describe("role restrictions and record actors", () => {
  it("returns a refusal for preview writes without calling the base dispatcher", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      startAccessPreview({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
    });
    const dispatch = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PreviewCommand baseDispatch={dispatch} />
      </WardFlowProvider>,
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Attempt preview write" })));
    expect(document.body.dataset.commandOutcome).toBe("refused");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("returns a refusal for a break-glass write and forwards allowed command outcomes", async () => {
    const state = seedWardFlowState();
    const admission = state.admissions.find((entry) => entry.unitId !== "rph-adult-secure" && entry.patientId)!;
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
      breakGlass({
        patientId: admission.patientId!,
        now: NOW_ANCHOR,
        windowMinutes: 60,
        reason: "handover",
        placeLabel: "Synthetic ward",
      });
    });
    const dispatch = vi.fn(() => Promise.resolve({ commandId: "allowed", status: "accepted" as const }));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Override dispatch={dispatch}>
          <WardAccessScope>
            <GlassCommand patientId={admission.patientId!} />
            <ScopedCommand />
          </WardAccessScope>
        </Override>
      </WardFlowProvider>,
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Attempt glass write" })));
    expect(document.body.dataset.commandOutcome).toBe("refused");
    expect(dispatch).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Attempt preview write" })));
    expect(document.body.dataset.commandOutcome).toBe("accepted");
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("declares each ward in a multiward desk without lending coordinator identity", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure", "fsh-adult-secure"] } });
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ActorProbe />
        <DischargeProbe />
      </WardFlowProvider>,
    );
    expect(JSON.parse(screen.getByTestId("actors").textContent!)).toEqual([
      { role: "ward", actingUnitId: "rph-adult-secure" },
      { role: "ward", actingUnitId: "fsh-adult-secure" },
    ]);
    expect(screen.getByTestId("record-actor")).toHaveTextContent('"role":"ward"');
    expect(screen.getByTestId("record-actor")).toHaveTextContent('"actingUnitId":"rph-adult-secure"');
    expect(Number(screen.getByTestId("records").textContent)).toBeGreaterThan(0);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open own discharge" })));
    expect(screen.getByTestId("opened-record")).not.toHaveTextContent("none");
  });

  it("updates a discharge date as its ward and retains the time after refusal", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
    });
    const command = deferred();
    const dispatch = vi
      .fn<WardCommandDispatch>()
      .mockReturnValueOnce(command.promise)
      .mockReturnValue({ commandId: "retry", status: "accepted" });
    renderCommand(<DischargeProbe />, dispatch);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open own discharge" })));
    fireEvent.click(screen.getByRole("tab", { name: "Dossier" }));
    fireEvent.click(screen.getByTestId("ward-discharge-update-date-btn"));
    const input = screen.getByTestId("ward-discharge-new-time-input");
    fireEvent.change(input, { target: { value: "23:15" } });
    fireEvent.click(screen.getByTestId("ward-discharge-save-time-btn"));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "UPDATE_EXPECTED_DISCHARGE", role: "ward", actingUnitId: "rph-adult-secure" }),
    );
    expect(input).toHaveValue("23:15");
    await act(async () => command.finish({ commandId: "first", status: "refused", message: "The discharge changed." }));
    expect(input).toHaveValue("23:15");
    expect(screen.getByText("The discharge changed.")).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByTestId("ward-discharge-save-time-btn")));
    expect(screen.queryByTestId("ward-discharge-new-time-input")).not.toBeInTheDocument();
    expect(screen.getByText("Expected departure updated.")).toBeInTheDocument();
  });

  it("explains coordinator-only capacity requests at the table and sidebar", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
    });
    const dispatch = vi.fn();
    renderCommand(<CapacityScreen />, dispatch);
    showWardTable();
    const request = screen.getByTestId("ward-capacity-refresh-rph-adult-secure");
    expect(request).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(request);
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("ward-capacity-network-row-rph-adult-secure"));
    expect(screen.getByRole("button", { name: "Request ward update" })).toHaveAttribute("aria-disabled", "true");
  });

  it("makes coordinator alert operations unavailable to a ward desk with an explanation", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
    });
    const dispatch = vi.fn();
    renderCommand(<AlertsScreen />, dispatch);
    const row = [...document.querySelectorAll<HTMLElement>("li[data-alert-id]")].find((entry) =>
      entry.textContent?.includes("ED mental health team"),
    )!;
    fireEvent.click(within(row).getByTestId("ward-alerts-open"));
    const take = screen.getByRole("button", { name: /^Take / });
    expect(take).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(take);
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getAllByText("Only the coordinator can change alerts.").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("More actions"));
    expect(screen.getByRole("button", { name: /^Acknowledge / })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /^Snooze / })).toHaveAttribute("aria-disabled", "true");
  });
});
