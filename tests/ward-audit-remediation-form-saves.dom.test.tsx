import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/PT-001",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ward-management/shell/ward-access", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access")>()),
  useWardRecordActors: () => [{ role: "coordinator" }],
}));
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { DischargeDependenciesPanel } from "@/components/ward-management/discharges/discharge-dependencies-panel";
import { AcceptanceConditionsPanel } from "@/components/ward-management/loop-checks/movement-loop-checks";
import { WardRestrictionReviews } from "@/components/ward-management/loop-checks/ward-closure-loop-checks";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { CircleAlert } from "lucide-react";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";

afterEach(cleanup);
const state = seedWardFlowState();
const stay = state.admissions.find(
  (item) =>
    item.state === "occupied" &&
    item.patientId &&
    item.awayAtEmergencyDepartmentSince === null &&
    !state.leaveBeds.some((bed) => bed.admissionId === item.id),
)!;
const release = state.bedReleases.find((item) => item.state !== "discharged")!;
const accepted = { commandId: "audit-save", status: "accepted" } as const;
const refused = { commandId: "audit-save", status: "refused", message: "Synthetic refusal" } as const;
function deferred() {
  let resolve!: (value: WardCommandOutcome) => void;
  const promise = new Promise<WardCommandOutcome>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function Shared({ dispatch, children }: { dispatch: WardCommandDispatch; children: ReactNode }) {
  const context = useWardFlow();
  return <WardFlowOverride value={{ ...context, dispatch }}>{children}</WardFlowOverride>;
}
function wrap(children: ReactNode, dispatch: WardCommandDispatch) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Shared dispatch={dispatch}>{children}</Shared>
    </WardFlowProvider>,
  );
}
function openPatientForm(kind: "leave" | "date") {
  const card = screen.getByTestId("ward-patient-change-card");
  fireEvent.click(within(card).getByRole("button", { name: kind === "leave" ? "Start leave" : "Discharge date" }));
  fireEvent.change(within(card).getByLabelText("Day"), { target: { value: "1" } });
  const input = within(card).getByLabelText(
    kind === "leave" ? "Expected back time" : "Expected discharge time",
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { value: "09:30" } });
  fireEvent.click(within(card).getByRole("button", { name: kind === "leave" ? "Record leave" : "Save date" }));
  return { card, input };
}

describe("patient ward change completion", () => {
  it.each(["leave", "date"] as const)("keeps the %s draft while pending and after refusal", async (kind) => {
    const pending = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => pending.promise);
    wrap(<PatientNowScreen patientId={stay.patientId!} />, dispatch);
    const { card, input } = openPatientForm(kind);
    expect(input.isConnected && input.value.length > 0).toBe(true);
    const submit = within(card).getByRole("button", { name: kind === "leave" ? "Record leave" : "Save date" });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(dispatch).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(refused));
    expect(input.isConnected && input.value.length > 0).toBe(true);
    expect(within(card).getByRole("alert")).toBeVisible();
  });

  it("closes the original form only when an uncertain command is later accepted", async () => {
    const later = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => ({
      commandId: "audit-save",
      status: "failed",
      confirmation: later.promise,
    }));
    wrap(<PatientNowScreen patientId={stay.patientId!} />, dispatch);
    const { card, input } = openPatientForm("date");
    expect(input.isConnected && input.value.length > 0).toBe(true);
    fireEvent.click(within(card).getByRole("button", { name: "Save date" }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    await act(async () => later.resolve(accepted));
    expect(input.isConnected).toBe(false);
  });
});

describe("discharge arrangement completion", () => {
  it("retains its date draft while pending and on refusal", async () => {
    const pending = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => pending.promise);
    render(
      <DischargeDependenciesPanel
        release={release}
        now={NOW_ANCHOR}
        dayZero={new Date(0)}
        role="coordinator"
        dispatch={dispatch}
      />,
    );
    const input = screen.getByLabelText("Time (hh:mm)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "15:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Change expected out" }));
    expect(input.value.length > 0).toBe(true);
    expect(screen.getByRole("button", { name: "Change expected out" })).toBeDisabled();
    await act(async () => pending.resolve(refused));
    expect(input.value.length > 0).toBe(true);
    expect(screen.getByRole("alert")).toBeVisible();
  });

  it("holds an uncertain command and clears only when its matching retry accepts", async () => {
    const later = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => ({
      commandId: "audit-save",
      status: "failed",
      confirmation: later.promise,
    }));
    render(
      <DischargeDependenciesPanel
        release={release}
        now={NOW_ANCHOR}
        dayZero={new Date(0)}
        role="coordinator"
        dispatch={dispatch}
      />,
    );
    const input = screen.getByLabelText("Time (hh:mm)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "15:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Change expected out" }));
    expect(input.value.length > 0).toBe(true);
    expect(screen.getByRole("button", { name: "Change expected out" })).toBeDisabled();
    await act(async () => later.resolve(accepted));
    expect(input.value.length === 0).toBe(true);
  });
});

describe("loop-check completion", () => {
  it("preserves acceptance-condition choices when recording is refused", async () => {
    const movement = state.movements.find((item) => item.acceptedUnitId && !item.closure)!;
    const pending = deferred();
    wrap(<AcceptanceConditionsPanel movement={movement} now={NOW_ANCHOR} />, () => pending.promise);
    const kind = screen.getByTestId("acceptance-condition-kind") as HTMLSelectElement;
    const value = Array.from(kind.options).find((item) => item.value && item.value !== "bed_after_time")!.value;
    fireEvent.change(kind, { target: { value } });
    fireEvent.change(screen.getByTestId("acceptance-condition-agreed-with"), { target: { value: "ed" } });
    fireEvent.click(screen.getByTestId("acceptance-condition-add"));
    expect(kind.value.length > 0).toBe(true);
    await act(async () => pending.resolve(refused));
    expect(kind.value.length > 0).toBe(true);
    expect(screen.getByRole("alert")).toBeVisible();
  });

  it("keeps the restriction review open on refusal", async () => {
    const unit = state.units.find((item) => item.id === "gry-adult-secure")!;
    const pending = deferred();
    wrap(
      <WardRestrictionReviews unit={unit} now={NOW_ANCHOR} actor={{ role: "coordinator" }} />,
      () => pending.promise,
    );
    fireEvent.click(screen.getByTestId("ward-restriction-review-open-intake_constraints"));
    fireEvent.change(screen.getByTestId("ward-restriction-reviewer-intake_constraints"), {
      target: { value: "consultant_psychiatrist" },
    });
    fireEvent.change(screen.getByTestId("ward-restriction-review-after-intake_constraints"), {
      target: { value: "24" },
    });
    fireEvent.click(screen.getByTestId("ward-restriction-review-save-intake_constraints"));
    expect(screen.queryByTestId("ward-restriction-reviewer-intake_constraints")).not.toBeNull();
    await act(async () => pending.resolve(refused));
    expect(screen.queryByTestId("ward-restriction-reviewer-intake_constraints")).not.toBeNull();
    expect(screen.getByRole("alert")).toBeVisible();
  });

  it("starts a newly selected movement's acceptance-condition draft empty", () => {
    const movement = state.movements.find((item) => item.acceptedUnitId && !item.closure)!;
    const dispatch = vi.fn<WardCommandDispatch>(() => accepted);
    const tree = (id: Movement["id"]) => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Shared dispatch={dispatch}>
          <AcceptanceConditionsPanel movement={{ ...movement, id }} now={NOW_ANCHOR} />
        </Shared>
      </WardFlowProvider>
    );
    const view = render(tree(movement.id));
    const kind = screen.getByTestId("acceptance-condition-kind") as HTMLSelectElement;
    fireEvent.change(kind, { target: { value: Array.from(kind.options).find((item) => item.value)!.value } });
    view.rerender(tree("WF-AUDIT-NEXT"));
    expect((screen.getByTestId("acceptance-condition-kind") as HTMLSelectElement).value.length === 0).toBe(true);
  });
});

it("keeps a task escalation contact until its command accepts", async () => {
  const movement = state.movements.find((item) => !item.closure && item.stage !== "arrived")!;
  const item = {
    id: "synthetic-escalation",
    kind: "fact",
    tone: "warning",
    icon: CircleAlert,
    title: "Synthetic review",
    detail: "Synthetic fixture",
    movementId: movement.id,
    owner: movement.owner,
  } as InboxItem;
  const pending = deferred();
  const dispatch = vi.fn<WardCommandDispatch>(() => pending.promise);
  wrap(
    <WardTasksDrawer
      alertsScreenOpen={false}
      items={[item]}
      acknowledgements={{}}
      completions={{}}
      role="coordinator"
      now={NOW_ANCHOR}
      dispatch={dispatch}
      onClose={() => {}}
      onSelectMovement={() => {}}
      records={state}
    />,
    dispatch,
  );
  fireEvent.click(screen.getByTestId(`ward-task-${item.id}`));
  fireEvent.click(screen.getByRole("button", { name: "Escalate" }));
  const input = screen.getByPlaceholderText("Contact name or service") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "Synthetic service" } });
  fireEvent.click(screen.getByRole("button", { name: "Record escalation" }));
  expect(input.isConnected && input.value.length > 0).toBe(true);
  expect(screen.getByRole("button", { name: "Record escalation" })).toBeDisabled();
  await act(async () => pending.resolve(refused));
  expect(input.isConnected && input.value.length > 0).toBe(true);
  expect(screen.getByRole("alert")).toBeVisible();
});
