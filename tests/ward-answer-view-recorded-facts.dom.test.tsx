// Audit 1, Josh 20 Oct 2026. The ward answer view shows recorded facts only (CS-02, NB-1), holds the
// request on screen by its journey id (CS-08, WP-01), and its accept dialog never implies a bed was
// allocated (WP-09). Synthetic seed data only.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { WardAnswerView } from "@/components/ward-management/ward/ward-answer-view";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => cleanup());

type Adjust = (movements: Movement[]) => Movement[];

let setAdjust: (adjust: Adjust) => void = () => undefined;

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
  return (
    <WardFlowOverride value={{ ...state, dispatch, movements: adjust(state.movements) }}>{children}</WardFlowOverride>
  );
}

function renderAnswer(unitId: string, start: Adjust = (movements) => movements) {
  const dispatch = vi.fn<(event: WardFlowEvent) => void>();
  const tree = (adjust: Adjust) => (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness dispatch={dispatch} adjust={adjust}>
        <WardAnswerView unitId={unitId} />
      </Harness>
    </WardFlowProvider>
  );
  const view = render(tree(start));
  setAdjust = (next) => view.rerender(tree(next));
  return dispatch;
}

const shownId = () => screen.getByTestId(/^ward-incoming-/).dataset.testid!.replace("ward-incoming-", "");
const noClearance: Adjust = (movements) =>
  movements.map((movement) => ({ ...movement, medicalClearance: undefined, referralId: undefined }));

describe("ward answer view: recorded facts only (CS-02)", () => {
  it.each(["sjgm-adult-open", "fsh-older-adult"])("shows no invented narrative or recommendation on %s", (unitId) => {
    renderAnswer(unitId, noClearance);
    const text = document.body.textContent ?? "";
    for (const invented of [
      "psychomotor",
      "Medically stabilised",
      "Admit to",
      "High-dependency observations",
      "Previous psychiatric admissions",
      "All clinical admission gates satisfied",
    ])
      expect(text).not.toContain(invented);
    const assessment = screen.getByTestId("ward-answer-assessment");
    expect(assessment).toHaveTextContent("Medical clearance: Not recorded.");
    expect(assessment).toHaveTextContent(/\d+ of \d+ checks met; \d+ for information only\./);
  });

  it("keeps the fixed narrative out of the source", () => {
    const source = readFileSync("src/components/ward-management/ward/ward-answer-view.tsx", "utf8");
    expect(source).not.toMatch(/psychomotor|Medically stabilised|Admit to \{|High-dependency observations/);
  });
});

describe("ward answer view: the accept dialog belongs to one request (CS-08, WP-09)", () => {
  const openDialog = () => {
    const ready = screen.getAllByRole("button", { name: /^Bed \d\d READY$/ })[0]!;
    fireEvent.click(ready);
    return screen.getByRole("dialog", { name: /accept/i });
  };

  it("closes with a notice, and accepts nobody, when its request is answered or withdrawn elsewhere", () => {
    const dispatch = renderAnswer("sjgm-adult-open");
    const id = shownId();
    openDialog();
    act(() => setAdjust((movements) => movements.filter((movement) => movement.id !== id)));
    expect(screen.queryByRole("dialog", { name: /accept/i })).not.toBeInTheDocument();
    expect(screen.getByText("This request was answered or withdrawn.")).toBeInTheDocument();
    expect(dispatch.mock.calls.some(([event]) => event.type === "ACCEPT_IN_PRINCIPLE")).toBe(false);
  });

  it("accepts the request it was opened for when another sorts ahead, and sends no bed number", () => {
    const dispatch = renderAnswer("sjgm-adult-open");
    const id = shownId();
    const dialog = openDialog();
    expect(dialog).toHaveTextContent("Accepting does not allocate a bed. No bed number is recorded.");
    act(() =>
      setAdjust((movements) => {
        const held = movements.find((movement) => movement.id === id)!;
        return [{ ...held, id: "WF-AUDIT-AHEAD", openedAt: held.openedAt - 60_000 }, ...movements];
      }),
    );
    expect(shownId()).toBe(id);
    fireEvent.click(screen.getByRole("button", { name: "Confirm Acceptance in Principle" }));
    const accepts = dispatch.mock.calls.map(([event]) => event).filter((event) => event.type === "ACCEPT_IN_PRINCIPLE");
    expect(accepts).toHaveLength(1);
    expect(accepts[0]).toMatchObject({ movementId: id });
    expect(accepts[0]).not.toHaveProperty("bedNumber");
  });

  it("sends the extra-travel bed hold only when the ward chooses it (D-72)", () => {
    const dispatch = renderAnswer("sjgm-adult-open");
    const dialog = openDialog();
    expect(dialog).not.toHaveTextContent(/not wired|not saved|nurse unit manager endorsement/i);
    const hold = screen.getByLabelText("Bed hold once pulled");
    expect(hold).toHaveValue("standard");
    fireEvent.change(hold, { target: { value: "extended" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Acceptance in Principle" }));
    const accepts = dispatch.mock.calls.map(([event]) => event).filter((event) => event.type === "ACCEPT_IN_PRINCIPLE");
    expect(accepts.at(-1)).toMatchObject({ extendedHold: true });

    // Reopened, the choice starts at the standard hold again.
    expect(openDialog()).toBeTruthy();
    expect(screen.getByLabelText("Bed hold once pulled")).toHaveValue("standard");
  });

  it("still steps with Previous and Next", () => {
    renderAnswer("sjgm-adult-open", (movements) => {
      const first = movements.find((movement) => movement.referredUnitIds.includes("sjgm-adult-open"))!;
      return [...movements, { ...first, id: "WF-AUDIT-NEXT", openedAt: first.openedAt + 60_000 }];
    });
    const first = shownId();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(shownId()).not.toBe(first);
    fireEvent.click(screen.getByRole("button", { name: /Previous/ }));
    expect(shownId()).toBe(first);
  });
});
