import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlannedAdmissionsPanel } from "@/components/ward-management/capacity/planned-admissions-panel";
import { WardDrawerDischargeDate } from "@/components/ward-management/ward/ward-drawer-discharge-date";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { dayOf, MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";

const clock = vi.hoisted(() => ({ now: 1439 }));
vi.mock("@/components/ward-management/ward-flow-provider", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/ward-flow-provider")>()),
  useWardFlowClock: () => clock.now,
}));
afterEach(() => setDeskRole("coordinator"));

function Panel({ now, dispatch }: { now: number; dispatch: WardCommandDispatch }) {
  const world = useWardFlow();
  return (
    <WardFlowOverride value={{ ...world, dispatch }}>
      <PlannedAdmissionsPanel now={now} />
    </WardFlowOverride>
  );
}
function accepted() {
  return vi.fn(() => ({ commandId: "synthetic", status: "accepted" as const }));
}

describe("planned commands retain the working desk", () => {
  it.each(["book", "change", "cancel"] as const)("submits %s as the site bed manager", (action) => {
    setDeskRole("bed_manager");
    const dispatch = accepted();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Panel now={NOW_ANCHOR} dispatch={dispatch} />
      </WardFlowProvider>,
    );
    if (action === "book") {
      fireEvent.click(screen.getByTestId("ward-planned-book"));
      fireEvent.change(screen.getByTestId("ward-planned-who"), { target: { value: "initials" } });
      fireEvent.change(screen.getByTestId("ward-planned-initials"), { target: { value: "ZZ" } });
      for (const id of ["ward-planned-reason", "ward-planned-unit", "ward-planned-legal"]) {
        const select = screen.getByTestId(id) as HTMLSelectElement;
        fireEvent.change(select, {
          target: { value: Array.from(select.options).find((o) => o.value && !o.disabled)!.value },
        });
      }
      fireEvent.click(screen.getByTestId("ward-planned-submit"));
    } else {
      const row = screen.getByTestId("ward-planned-PA-SEED-01");
      fireEvent.click(within(row).getByRole("button", { name: action === "change" ? "Change" : "Cancel" }));
      if (action === "cancel") {
        fireEvent.change(screen.getByTestId("ward-planned-cancel-reason"), { target: { value: "rebooked" } });
        fireEvent.click(screen.getByTestId("ward-planned-cancel-confirm"));
      } else {
        fireEvent.change(screen.getByTestId("ward-planned-stay"), { target: { value: "9" } });
        fireEvent.click(screen.getByTestId("ward-planned-submit"));
      }
    }
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: `${action.toUpperCase()}_PLANNED_ADMISSION`, role: "bed_manager" }),
    );
  });

  it("submits arrival as the receiving ward, including its own ward claim", () => {
    setDeskRole("ward");
    const dispatch = accepted();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Panel now={NOW_ANCHOR} dispatch={dispatch} />
      </WardFlowProvider>,
    );
    fireEvent.click(within(screen.getByTestId("ward-planned-PA-SEED-03")).getByRole("button", { name: "Arrived" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm arrival" }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CONVERT_PLANNED_ADMISSION",
        role: "ward",
        actingUnitId: "fre-adult-open",
        unitId: "fre-adult-open",
      }),
    );
  });
});

it("keeps an open changed booking's arrival date when midnight passes", () => {
  const dispatch = accepted();
  const before = dayOf(NOW_ANCHOR) * MINUTES_PER_DAY + 1439;
  const view = render(
    <WardFlowProvider initialNow={before}>
      <Panel now={before} dispatch={dispatch} />
    </WardFlowProvider>,
  );
  fireEvent.click(within(screen.getByTestId("ward-planned-PA-SEED-01")).getByRole("button", { name: "Change" }));
  const offset = Number((screen.getByTestId("ward-planned-day") as HTMLSelectElement).value);
  const time = (screen.getByTestId("ward-planned-time") as HTMLInputElement).value.split(":").map(Number);
  const selected = (dayOf(before) + offset) * MINUTES_PER_DAY + time[0] * 60 + time[1];
  view.rerender(
    <WardFlowProvider initialNow={before}>
      <Panel now={before + 1} dispatch={dispatch} />
    </WardFlowProvider>,
  );
  fireEvent.change(screen.getByTestId("ward-planned-stay"), { target: { value: "9" } });
  fireEvent.click(screen.getByTestId("ward-planned-submit"));
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ type: "CHANGE_PLANNED_ADMISSION", now: before + 1, expectedArrivalAt: selected }),
  );
});

it("keeps an untouched discharge date unchanged across midnight", () => {
  const recordedAt = 1440 + 600;
  clock.now = 1439;
  const element = (
    <WardFlowProvider initialNow={1439}>
      <WardDrawerDischargeDate admissionId="AD-SYNTHETIC" unitId="rph-adult-open" recordedAt={recordedAt} />
    </WardFlowProvider>
  );
  const view = render(element);
  fireEvent.click(screen.getByTestId("ward-drawer-discharge-date-open"));
  expect(screen.getByRole("button", { name: "Save date" })).toBeDisabled();
  clock.now = 1440;
  view.rerender(
    <WardFlowProvider initialNow={1439}>
      <WardDrawerDischargeDate admissionId="AD-SYNTHETIC" unitId="rph-adult-open" recordedAt={recordedAt} />
    </WardFlowProvider>,
  );
  expect(screen.getByRole("button", { name: "Save date" })).toBeDisabled();
  expect(screen.getByTestId("ward-drawer-discharge-date")).toHaveTextContent("Change the day or time to save");
});
