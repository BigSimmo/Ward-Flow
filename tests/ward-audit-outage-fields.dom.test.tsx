import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WardSharedAccess, type WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import { WardFlowProvider, WardFlowOverride, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardDrawerDischargeDate } from "@/components/ward-management/ward/ward-drawer-discharge-date";
import { WardObservationControl } from "@/components/ward-management/ward/ward-observation-control";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { ReactNode } from "react";
vi.mock("next/navigation", () => ({ usePathname: () => "/ward-flow" }));
const seed = seedWardFlowState();
const admission = seed.admissions.find((row) => row.state === "occupied")!;

function Override({
  children,
  dispatch,
}: {
  children: ReactNode;
  dispatch: ReturnType<typeof useWardFlow>["dispatch"];
}) {
  const flow = useWardFlow();
  return <WardFlowOverride value={{ ...flow, dispatch }}>{children}</WardFlowOverride>;
}

describe("unresolved values under the real shared outage parent", () => {
  it.each(["date", "observation"].flatMap((kind) => ["accepted", "refused"].map((status) => ({ kind, status }))))(
    "locks $kind through an outage and handles $status",
    async ({ kind, status }) => {
      const user = userEvent.setup();
      let finish!: (outcome: WardCommandOutcome) => void;
      const confirmation = new Promise<WardCommandOutcome>((done) => {
        finish = done;
      });
      const dispatch = vi.fn(() => ({ commandId: "outage-form", status: "failed" as const, confirmation }));
      const connection = {
        enabled: true,
        signedIn: true,
        actorId: "synthetic-test",
        access: { role: "coordinator", scope: { kind: "statewide" } },
        accessUntil: Date.now() + 600000,
        status: "ready",
        error: null,
        eventLog: [],
        receivedAt: Date.now(),
        snapshot: {
          dataMode: "prototype",
          accessContext: "a".repeat(64),
          revision: 1,
          now: NOW_ANCHOR,
          payload: { version: 1, state: seed, dayZero: "2026-11-04T00:00:00Z", startedAt: "2026-11-04T10:00:00Z" },
        },
        dispatch,
        signIn: vi.fn(),
        signOut: vi.fn(),
        retry: vi.fn(),
      } as unknown as WardSharedConnection;
      const tree = () => (
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardSharedAccess connection={connection}>
            <Override dispatch={dispatch}>
              {kind === "date" ? (
                <WardDrawerDischargeDate admissionId={admission.id} unitId={admission.unitId} recordedAt={null} />
              ) : (
                <WardObservationControl observation={GENERAL_OBSERVATION} now={NOW_ANCHOR} onSave={dispatch} />
              )}
            </Override>
          </WardSharedAccess>
        </WardFlowProvider>
      );
      const view = render(tree());
      fireEvent.click(
        screen.getByTestId(kind === "date" ? "ward-drawer-discharge-date-open" : "ward-observation-change"),
      );
      const input =
        kind === "date"
          ? screen.getByLabelText("Expected discharge time")
          : screen.getByTestId("ward-observation-review-time");
      fireEvent.change(input, { target: { value: "12:00" } });
      fireEvent.click(
        kind === "date"
          ? screen.getByRole("button", { name: "Save date" })
          : screen.getByTestId("ward-observation-save"),
      );
      connection.status = "unavailable";
      view.rerender(tree());
      expect(input).toBeDisabled();
      await user.type(input, "13:00");
      expect(input).toHaveValue("12:00");
      if (kind === "date") {
        const day = screen.getByTestId("ward-drawer-discharge-day");
        const before = day.textContent;
        await user.click(screen.getByRole("button", { name: "Increase discharge day" }));
        expect(day.textContent).toBe(before);
      } else {
        expect(
          within(screen.getByTestId("ward-observation-level"))
            .getAllByRole("button")
            .every((button) => (button as HTMLButtonElement).disabled || button.matches(":disabled")),
        ).toBe(true);
      }
      await act(async () =>
        finish({
          commandId: "outage-form",
          status: status as "accepted" | "refused",
          message: status === "refused" ? "Review the board" : undefined,
        }),
      );
      expect(dispatch).toHaveBeenCalledOnce();
      if (status === "accepted") expect(input).not.toBeInTheDocument();
      else {
        expect(input).not.toBeDisabled();
        expect(input).toHaveValue("12:00");
      }
      view.unmount();
    },
  );
});
