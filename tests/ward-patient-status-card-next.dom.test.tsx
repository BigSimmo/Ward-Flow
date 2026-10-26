import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  PatientStatusCard,
  buildPatientStatus,
  type PatientStatusContext,
} from "@/components/ward-management/patients/patient-status-card";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import type { SenderMovementPartialView } from "@/components/ward-management/ward-partial-view-contract";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Qodo review, 13 Oct 2026: a pulled bed with every gate clear shows its next step on desktop. Synthetic data. */
const noop = () => {};
const sender = vi.hoisted(() => ({
  summary: undefined as SenderMovementPartialView | null | undefined,
  access: { role: "coordinator", scope: { kind: "statewide" } } as WardAccess,
  role: "coordinator" as WardChromeRole,
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => sender.access,
}));
vi.mock("@/components/ward-management/ward-role-gate", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/ward-role-gate")>()),
  useRouteRole: () => sender.role,
}));
vi.mock("@/components/ward-management/ward-sender-presentation", () => ({
  useSenderPresentation: () => ({ required: sender.summary !== undefined, movementFor: () => sender.summary }),
}));
afterEach(() => {
  sender.summary = undefined;
  sender.access = { role: "coordinator", scope: { kind: "statewide" } };
  sender.role = "coordinator";
});

function contextFor(movement: Movement, overrides: Partial<PatientStatusContext> = {}): PatientStatusContext {
  return {
    movement,
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
    ...overrides,
  };
}

it.each([
  ["awaiting_answer", "Awaiting answer"],
  ["none_found", "None found"],
  ["escalated", "Escalated"],
] as const)("renders truthful %s progress without destination counts or coordinator actions", (progress, label) => {
  const movement = {
    ...seedWardFlowState().movements[0]!,
    stage: "destination_review" as const,
    referredUnitIds: [],
    declines: [],
  };
  const context: PatientStatusContext = {
    movement,
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
  sender.summary = {
    id: movement.id,
    kind: "sender",
    visibleUntil: null,
    destinationStatus: progress === "escalated" ? "none_found" : progress,
    progress,
    nextStep: "wait",
  };
  render(<PatientStatusCard mode="find" context={context} />);
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.queryByText("No ward asked")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Ask.*wards/ })).not.toBeInTheDocument();
});

it("shows unavailable progress without falling back to an empty destination array", () => {
  const movement = { ...seedWardFlowState().movements[0]!, referredUnitIds: [], declines: [] };
  const status = buildPatientStatus("find", contextFor(movement), null);
  expect(status.verdict).toBe("Progress unavailable");
  expect(status.cells[0]?.action).toBeUndefined();
  expect(buildPatientStatus("find", contextFor(movement)).cells[0]?.value).toBe("No ward asked");
});

it.each(["find", "held", "transit"] as const)(
  "shows unavailable progress in %s mode when the sender has no entry for the movement",
  (mode) => {
    const movement = { ...seedWardFlowState().movements[0]!, referredUnitIds: [], declines: [] };
    expect(buildPatientStatus(mode, contextFor(movement), null).verdict).toBe("Progress unavailable");
  },
);

it("keeps a leave status when the movement has no sender progress (closed or hidden movement)", () => {
  const movement = { ...seedWardFlowState().movements[0]!, referredUnitIds: [], declines: [] };
  const leaveBed = {
    id: "LB-test",
    kind: "leave",
    confirmedAt: NOW_ANCHOR - 60 * 60_000,
    expectedReturn: NOW_ANCHOR + 60 * 60_000,
  } as unknown as NonNullable<PatientStatusContext["leaveBed"]>;
  const status = buildPatientStatus("leave", contextFor(movement, { leaveBed }), null);
  expect(status.verdict).toBe("On leave");
  expect(status.verdict).not.toBe("Progress unavailable");
});

it.each([
  [false, "Pull the bed"],
  [true, "Move or release"],
] as const)("keeps the known own accepting ward action with hold=%s", (hasBedHold, label) => {
  const seed = seedWardFlowState();
  const accepting = seed.units[1];
  const movement = {
    ...seed.movements[0]!,
    stage: hasBedHold ? ("pulled" as const) : ("accepted_awaiting_bed" as const),
    acceptedUnitId: accepting.id,
    pullExpiresAt: NOW_ANCHOR - 5,
  };
  const onOpenPlacement = vi.fn();
  const context = contextFor(movement, { hasBedHold, acceptedUnitName: accepting.name, onOpenPlacement });
  sender.role = "ward";
  sender.access = { role: "ward", scope: { kind: "ward", unitIds: [seed.units[0].id, accepting.id] } };
  sender.summary = {
    id: movement.id,
    kind: "sender",
    visibleUntil: null,
    destinationStatus: "accepted",
    progress: "accepted",
    nextStep: "pull",
  };
  render(<PatientStatusCard mode="held" context={context} />);
  fireEvent.click(screen.getByRole("button", { name: label }));
  expect(onOpenPlacement).toHaveBeenCalledOnce();
});

it.each(["ward", "bed_manager"] as const)("keeps foreign accepting placement unavailable to a %s sender", (role) => {
  const seed = seedWardFlowState();
  const movement: Movement = {
    ...seed.movements[0]!,
    stage: "accepted_awaiting_bed",
    acceptedUnitId: seed.units[1].id,
  };
  const onOpenPlacement = vi.fn();
  sender.role = role;
  sender.access =
    role === "ward"
      ? { role, scope: { kind: "ward", unitIds: [seed.units[0].id] } }
      : { role, scope: { kind: "site", siteCode: seed.units[1].siteCode } };
  sender.summary = {
    id: movement.id,
    kind: "sender",
    visibleUntil: null,
    destinationStatus: "accepted",
    progress: "accepted",
    nextStep: "pull",
  };
  render(
    <PatientStatusCard
      mode="held"
      context={contextFor(movement, { acceptedUnitName: seed.units[1].name, onOpenPlacement })}
    />,
  );
  expect(screen.getByText(seed.units[1].name)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Pull the bed" })).not.toBeInTheDocument();
  expect(onOpenPlacement).not.toHaveBeenCalled();
});

describe("patient status card next step on desktop", () => {
  it("renders Mark handover ready as the card's one primary when no gate holds an action", () => {
    const base = seedWardFlowState().movements[0]!;
    const movement: Movement = {
      ...base,
      stage: "pulled",
      pullExpiresAt: NOW_ANCHOR + 60,
      medicalClearance: { cleared: true, at: NOW_ANCHOR - 5 } as Movement["medicalClearance"],
      transportNeed: { needed: false } as Movement["transportNeed"],
    };
    const onHandoverReady = vi.fn();
    const context: PatientStatusContext = {
      movement,
      hasBedHold: true,
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
      onHandoverReady,
    };
    const status = buildPatientStatus("held", context);
    expect(status.verdict).toBe("Ready to move");
    expect(status.next).toBeDefined();
    render(<PatientStatusCard mode="held" context={context} />);
    const button = screen.getByRole("button", { name: "Mark handover ready" });
    fireEvent.click(button);
    expect(onHandoverReady).toHaveBeenCalledOnce();
  });
});
