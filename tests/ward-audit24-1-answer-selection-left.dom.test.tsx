// Audit 24-1 D-01 and B-08: when the request on the ward answer view is answered or withdrawn at
// another desk, the panel names who left and shows nobody until the user picks the next request;
// the one-step Accept in principle toast names the person. Synthetic seed data only.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useLayoutEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { WardAnswerView } from "@/components/ward-management/ward/ward-answer-view";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => cleanup());

type Adjust = (movements: Movement[]) => Movement[];

let setAdjust: (adjust: Adjust) => void = () => undefined;
let nameOf: (movementId: string) => string = () => "";

function Harness({
  dispatch,
  adjust,
  children,
}: {
  dispatch: (event: WardFlowEvent) => void;
  adjust: Adjust;
  children: ReactNode;
}) {
  const state = useWardFlow();
  const movements = adjust(state.movements);
  useLayoutEffect(() => {
    nameOf = (id) => state.resolvePatientIdentity(movements.find((movement) => movement.id === id)!).displayName;
  });
  return <WardFlowOverride value={{ ...state, dispatch, movements }}>{children}</WardFlowOverride>;
}

function renderAnswer(unitId: string, start: Adjust = (movements) => movements, initialMovementId?: string) {
  const dispatch = vi.fn<(event: WardFlowEvent) => void>();
  const tree = (adjust: Adjust) => (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness dispatch={dispatch} adjust={adjust}>
        <WardAnswerView unitId={unitId} initialMovementId={initialMovementId} />
      </Harness>
    </WardFlowProvider>
  );
  const view = render(tree(start));
  setAdjust = (next) => view.rerender(tree(next));
  return dispatch;
}

const shownId = () => screen.getByTestId(/^ward-incoming-/).dataset.testid!.replace("ward-incoming-", "");
const UNIT = "sjgm-adult-open";
const withSecond: Adjust = (movements) => {
  const first = movements.find((movement) => movement.referredUnitIds.includes(UNIT))!;
  return [...movements, { ...first, id: "WF-AUDIT-NEXT", openedAt: first.openedAt + 60_000 }];
};

describe("ward answer view: a request that leaves elsewhere is named, not swapped (D-01)", () => {
  it("shows nobody and names who left, so Accept cannot reach the next person", () => {
    const dispatch = renderAnswer(UNIT, withSecond);
    const id = shownId();
    const name = nameOf(id);
    act(() => setAdjust((movements) => withSecond(movements).filter((movement) => movement.id !== id)));

    expect(screen.getByTestId("ward-answer-selection-left")).toHaveTextContent(
      `${name}’s request was answered or withdrawn elsewhere.`,
    );
    expect(screen.queryByTestId(/^ward-incoming-/)).not.toBeInTheDocument();
    expect(screen.queryByTestId(/^ward-accept-/)).not.toBeInTheDocument();
    expect(dispatch.mock.calls.some(([event]) => event.type === "ACCEPT_IN_PRINCIPLE")).toBe(false);

    // The user picks the next request on purpose.
    fireEvent.click(screen.getByRole("button", { name: /^Show request 1 of / }));
    expect(screen.queryByTestId("ward-answer-selection-left")).not.toBeInTheDocument();
    expect(shownId()).not.toBe(id);
  });

  it("does not open someone else when a linked request has already left", () => {
    const left = seedWardFlowState().movements.find((movement) => movement.referredUnitIds.includes(UNIT))!.id;
    const answered: Adjust = (movements) =>
      withSecond(movements).map((movement) => (movement.id === left ? { ...movement, referredUnitIds: [] } : movement));
    renderAnswer(UNIT, answered, left);
    expect(screen.getByTestId("ward-answer-selection-left")).toHaveTextContent(
      `${nameOf(left)}’s request was answered or withdrawn elsewhere.`,
    );
    expect(screen.queryByTestId(/^ward-accept-/)).not.toBeInTheDocument();
  });

  it("still lands on the oldest when a link names no record", () => {
    renderAnswer(UNIT, withSecond, "not-a-record");
    expect(screen.queryByTestId("ward-answer-selection-left")).not.toBeInTheDocument();
    expect(screen.getByTestId(/^ward-incoming-/)).toBeInTheDocument();
  });

  it("names the linked person when their request leaves elsewhere", () => {
    renderAnswer(UNIT, withSecond, "WF-AUDIT-NEXT");
    expect(shownId()).toBe("WF-AUDIT-NEXT");
    const name = nameOf("WF-AUDIT-NEXT");
    // Answered at another desk: still on record, no longer waiting here.
    act(() =>
      setAdjust((movements) =>
        withSecond(movements).map((movement) =>
          movement.id === "WF-AUDIT-NEXT" ? { ...movement, referredUnitIds: [] } : movement,
        ),
      ),
    );
    expect(screen.getByTestId("ward-answer-selection-left")).toHaveTextContent(`${name}’s request`);
    expect(screen.queryByTestId(/^ward-accept-/)).not.toBeInTheDocument();
  });

  it("treats a refused accept as no answer, so a later answer elsewhere is still named", () => {
    const dispatch = vi.fn<(event: WardFlowEvent) => void>();
    let refuse = false;
    function Refusing({ children }: { children: ReactNode }) {
      const state = useWardFlow();
      const movements = withSecond(state.movements);
      const id = movements.find((movement) => movement.referredUnitIds.includes(UNIT))!.id;
      const shown = refuse ? movements.filter((movement) => movement.id !== id) : movements;
      const rejections = refuse
        ? [
            ...state.rejections,
            {
              id: "WF-R",
              at: NOW_ANCHOR,
              movementId: id,
              attempted: "ACCEPT_IN_PRINCIPLE" as const,
              reason: "Refused.",
            },
          ]
        : state.rejections;
      return (
        <WardFlowOverride value={{ ...state, dispatch, movements: shown, rejections }}>{children}</WardFlowOverride>
      );
    }
    const tree = () => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Refusing>
          <WardAnswerView unitId={UNIT} />
        </Refusing>
      </WardFlowProvider>
    );
    const view = render(tree());
    const id = shownId();
    fireEvent.click(screen.getByTestId(`ward-accept-${id}`));
    // The engine refused it, then another desk answered the same request.
    refuse = true;
    act(() => view.rerender(tree()));
    expect(screen.getByTestId("ward-answer-selection-left")).toBeInTheDocument();
    expect(screen.queryByTestId(/^ward-accept-/)).not.toBeInTheDocument();
  });

  it("lands on the next request after a refused accept and then a decline here", async () => {
    const dispatch = vi.fn<(event: WardFlowEvent) => WardCommandOutcome>(() => ({
      commandId: "WF-C",
      status: "accepted",
    }));
    let stage: "open" | "refused" | "declined" = "open";
    let id = "";
    function Declining({ children }: { children: ReactNode }) {
      const state = useWardFlow();
      const all = withSecond(state.movements);
      id ||= all.find((movement) => movement.referredUnitIds.includes(UNIT))!.id;
      const movements = stage === "declined" ? all.filter((movement) => movement.id !== id) : all;
      const refusal = {
        id: "WF-R",
        at: NOW_ANCHOR,
        movementId: id,
        attempted: "ACCEPT_IN_PRINCIPLE" as const,
        reason: "Refused.",
      };
      const rejections = stage === "open" ? state.rejections : [...state.rejections, refusal];
      return <WardFlowOverride value={{ ...state, dispatch, movements, rejections }}>{children}</WardFlowOverride>;
    }
    const tree = () => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Declining>
          <WardAnswerView unitId={UNIT} />
        </Declining>
      </WardFlowProvider>
    );
    const view = render(tree());
    fireEvent.click(screen.getByTestId(`ward-accept-${shownId()}`));
    stage = "refused";
    act(() => view.rerender(tree()));
    fireEvent.click(screen.getByTestId(`ward-decline-toggle-${id}`));
    const form = screen.getByTestId(`ward-decline-form-${id}`);
    fireEvent.click(within(form).getByRole("radio", { name: "Capability mismatch" }));
    await act(async () => {
      fireEvent.click(within(form).getByRole("button", { name: /^Decline for \S/u }));
    });
    stage = "declined";
    act(() => view.rerender(tree()));
    expect(screen.queryByTestId("ward-answer-selection-left")).not.toBeInTheDocument();
    expect(shownId()).not.toBe(id);
  });

  it("still lands on the next request after this desk's own answer", () => {
    renderAnswer(UNIT, withSecond);
    const id = shownId();
    fireEvent.click(screen.getByTestId(`ward-accept-${id}`));
    act(() => setAdjust((movements) => withSecond(movements).filter((movement) => movement.id !== id)));
    expect(screen.queryByTestId("ward-answer-selection-left")).not.toBeInTheDocument();
    expect(shownId()).not.toBe(id);
  });
});

describe("ward answer view: the Accept in principle toast names the person (B-08)", () => {
  it("says who was accepted", async () => {
    renderAnswer(UNIT);
    const id = shownId();
    const name = nameOf(id);
    fireEvent.click(screen.getByTestId(`ward-accept-${id}`));
    expect(await screen.findByText(`Accepted ${name} in principle.`)).toBeInTheDocument();
  });
});
