import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WardAnswerView } from "@/components/ward-management/ward/ward-answer-view";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// The answer view's back link goes through contextual history (ContextualBackLink), which reads
// the app router; jsdom has none mounted.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>()),
  useWardFlow: () => context,
  useWardFlowClock: () => NOW_ANCHOR,
}));

const context = {
  ...seedWardFlowState(),
  dispatch: vi.fn(),
  resolvePatientIdentity: (subject: Parameters<typeof resolveSubjectPatient>[0]) =>
    resolveSubjectPatient(subject, context),
};
beforeEach(() => {
  Object.assign(context, seedWardFlowState());
  context.dispatch.mockClear();
});

describe("capacity observations on the answer screen", () => {
  it("replaces an old draft when a resource change advances the observation", () => {
    const unit = context.units[0];
    const view = render(<WardAnswerView unitId={unit.id} />);
    // v10: allocatable is a stepper only. Step the draft away from the confirmed figure.
    fireEvent.click(screen.getByRole("button", { name: "Increase allocatable beds" }));
    expect(screen.getByTestId("ward-capacity-input")).toHaveAttribute(
      "aria-valuenow",
      String(Math.min(unit.beds, unit.allocatable.value + 1)),
    );
    context.units = context.units.map((item) =>
      item.id === unit.id
        ? { ...item, allocatable: { ...item.allocatable, value: 2, revision: (item.allocatable.revision ?? 0) + 1 } }
        : item,
    );
    view.rerender(<WardAnswerView unitId={unit.id} />);
    expect(screen.getByTestId("ward-capacity-input")).toHaveAttribute("aria-valuenow", "2");
    fireEvent.click(screen.getByTestId("ward-capacity-submit"));
    expect(context.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CONFIRM_CAPACITY",
        unitId: unit.id,
        value: 2,
        expectedRevision: (unit.allocatable.revision ?? 0) + 1,
      }),
    );
    expect(
      screen.getAllByRole("status").filter((region) => region.textContent?.includes("Capacity confirmation requested")),
    ).toHaveLength(1);
  });

  it("does not carry one ward's draft into another ward", () => {
    const [first, second] = context.units;
    const view = render(<WardAnswerView unitId={first.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase allocatable beds" }));
    view.rerender(<WardAnswerView unitId={second.id} />);
    expect(screen.getByTestId("ward-capacity-input")).toHaveAttribute(
      "aria-valuenow",
      String(second.allocatable.value),
    );
    fireEvent.click(screen.getByTestId("ward-capacity-submit"));
    expect(context.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CONFIRM_CAPACITY",
        unitId: second.id,
        value: second.allocatable.value,
        expectedRevision: second.allocatable.revision ?? 0,
      }),
    );
  });
});

// D-39: a journey linked to its patient only through a referral still shows that patient's UMRN.
describe("answer history identity", () => {
  it("names a referral-linked journey by its UMRN", () => {
    const unit = context.units[0];
    const linked = context.movements.find(
      (movement) =>
        resolveSubjectPatient(movement, { patients: context.patients, movements: context.movements }).umrn ===
          "UMRN not recorded" && resolveSubjectPatient(movement, context).umrn !== "UMRN not recorded",
    );
    expect(linked, "the seed holds a referral-linked journey").toBeDefined();
    context.movements = context.movements.map((movement) =>
      movement.id === linked!.id ? { ...movement, acceptedUnitId: unit.id, acceptedAt: NOW_ANCHOR } : movement,
    );
    render(<WardAnswerView unitId={unit.id} />);
    const row = screen.getByTestId(`ward-answer-history-${linked!.id}-accepted`);
    expect(row).toHaveTextContent(resolveSubjectPatient(linked!, context).umrn);
    expect(row).not.toHaveTextContent(linked!.id);
  });
});
