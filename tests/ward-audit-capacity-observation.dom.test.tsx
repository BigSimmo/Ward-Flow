import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WardAnswerView } from "@/components/ward-management/ward/ward-answer-view";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>()),
  useWardFlow: () => context,
  useWardFlowClock: () => NOW_ANCHOR,
}));

const context = { ...seedWardFlowState(), dispatch: vi.fn() };
beforeEach(() => {
  Object.assign(context, seedWardFlowState());
  context.dispatch.mockClear();
});

describe("capacity observations on the answer screen", () => {
  it("replaces an old draft when a resource change advances the observation", () => {
    const unit = context.units[0];
    const view = render(<WardAnswerView unitId={unit.id} />);
    fireEvent.change(screen.getByTestId("ward-capacity-input"), { target: { value: "7" } });
    context.units = context.units.map((item) =>
      item.id === unit.id
        ? { ...item, allocatable: { ...item.allocatable, value: 2, revision: (item.allocatable.revision ?? 0) + 1 } }
        : item,
    );
    view.rerender(<WardAnswerView unitId={unit.id} />);
    expect(screen.getByTestId("ward-capacity-input")).toHaveValue(2);
    fireEvent.click(screen.getByTestId("ward-capacity-submit"));
    expect(context.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CONFIRM_CAPACITY",
        unitId: unit.id,
        value: 2,
        expectedRevision: (unit.allocatable.revision ?? 0) + 1,
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Capacity confirmation requested");
  });

  it("does not carry one ward's draft into another ward", () => {
    const [first, second] = context.units;
    const view = render(<WardAnswerView unitId={first.id} />);
    fireEvent.change(screen.getByTestId("ward-capacity-input"), { target: { value: "7" } });
    view.rerender(<WardAnswerView unitId={second.id} />);
    expect(screen.getByTestId("ward-capacity-input")).toHaveValue(second.allocatable.value);
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
