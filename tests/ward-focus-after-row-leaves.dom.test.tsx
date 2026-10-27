import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BedMeetingAgendaScreen } from "@/components/ward-management/bed-meeting/bed-meeting-agenda-screen";
import { DueActions } from "@/components/ward-management/bed-meeting/meeting-actions-due-list";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

/** RB-N01, NB-02 and A1K-04: a button that closes its own row hands focus on, never to the page. */
function press(button: HTMLElement, detail = 1) {
  act(() => button.focus());
  fireEvent.click(button, { detail });
}

function recordTwoActions() {
  const waits = screen.getByTestId("bed-meeting-agenda-ed-waits");
  for (const index of [0, 1]) {
    const toggle = within(waits).getAllByTestId("bed-meeting-add-action")[index]!;
    press(toggle);
    fireEvent.change(screen.getByTestId("bed-meeting-action-kind"), { target: { value: "book_transport" } });
    press(screen.getByTestId("bed-meeting-action-record"));
    // The form closes with its Record button; focus goes back to the row's Add action.
    expect(document.activeElement).toBe(within(waits).getAllByTestId("bed-meeting-add-action")[index]);
  }
}

describe("focus after a row's own button closes it", () => {
  it("moves from Done to the next action, then to the summary once none are left (bed meeting agenda)", () => {
    vi.useFakeTimers();
    try {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <BedMeetingAgendaScreen />
        </WardFlowProvider>,
      );
      recordTwoActions();
      const list = screen.getByTestId("bed-meeting-action-list");
      press(within(list).getAllByTestId("bed-meeting-action-done")[0]!);
      const [left] = within(list).getAllByTestId("bed-meeting-action-done");
      expect(document.activeElement).toBe(left);
      // Past the double-click pause, the last Done hands focus to the summary line.
      act(() => vi.advanceTimersByTime(2_000));
      press(left!);
      expect(screen.queryByTestId("bed-meeting-action-list")).toBeNull();
      expect(document.activeElement).toBe(screen.getByTestId("bed-meeting-action-summary"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves from Mark done to the next action on a desk's own list", () => {
    const movement = movementById("WF-002")!;
    function Seeded() {
      const { dispatch, now } = useWardFlow();
      return (
        <button
          type="button"
          data-testid="seed-actions"
          onClick={() => {
            for (const action of ["book_transport", "chase_ndis"] as const)
              dispatch({
                type: "RECORD_BED_MEETING_ACTION",
                role: "coordinator",
                now,
                subject: { kind: "movement", id: movement.id },
                action,
                owner: "coordinator",
                dueAt: now + 120,
              });
          }}
        />
      );
    }
    function Due() {
      const { movements } = useWardFlow();
      const open = (movements.find((entry) => entry.id === movement.id)?.meetingActions ?? []).filter(
        (action) => action.doneAt === undefined,
      );
      return open.length === 0 ? null : (
        <DueActions subject={{ kind: "movement", id: movement.id }} desk="coordinator" actions={open} />
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Seeded />
        <Due />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("seed-actions"));
    const buttons = screen.getAllByTestId("meeting-action-mark-done");
    expect(buttons).toHaveLength(2);
    press(buttons[0]!);
    expect(screen.getAllByTestId("meeting-action-mark-done")).toHaveLength(1);
    expect(document.activeElement).toBe(screen.getByTestId("meeting-action-mark-done"));
  });

  it("moves from Accept in principle to the next request, never to the page (Ward answer)", () => {
    const movement = movementById("WF-002")!;
    const unit = unitById("fsh-older-adult")!;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={unit.id} presentation="answer" />
      </WardFlowProvider>,
    );
    press(screen.getByTestId(`ward-accept-${movement.id}`));
    expect(screen.queryByTestId(`ward-accept-${movement.id}`)).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    const awaiting = screen.getByRole("region", { name: "Awaiting your answer" });
    expect(awaiting.contains(document.activeElement)).toBe(true);
  });
});
