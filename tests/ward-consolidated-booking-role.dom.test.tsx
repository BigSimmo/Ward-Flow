import { act, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { ToastProvider } from "@/components/wf";
import type { WardFlowKey } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { PlannedAdmissionsPanel } from "@/components/ward-management/capacity/planned-admissions-panel";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const captured = vi.hoisted(() => ({ events: [] as WardFlowEvent[] }));
vi.mock("@/components/ward-management/ward-flow-provider", async (original) => {
  const actual = await original<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlowSelect: (...keys: readonly WardFlowKey[]) => {
      const selected = actual.useWardFlowSelect(...keys);
      return {
        ...selected,
        dispatch: (event: WardFlowEvent) => {
          captured.events.push(event);
          return selected.dispatch(event);
        },
      };
    },
  };
});

afterEach(() => {
  captured.events.length = 0;
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("planned booking command role", () => {
  it("uses the site bed manager's own role for book, change and cancel", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } });
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardAccessScope>
          <PlannedAdmissionsPanel now={NOW_ANCHOR} />
        </WardAccessScope>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-planned-book"));
    fireEvent.change(screen.getByTestId("ward-planned-who"), { target: { value: "initials" } });
    fireEvent.change(screen.getByTestId("ward-planned-initials"), { target: { value: "ZZ" } });
    for (const id of ["ward-planned-reason", "ward-planned-unit", "ward-planned-legal"]) {
      const select = screen.getByTestId(id) as HTMLSelectElement;
      const first = Array.from(select.options).find((option) => option.value && !option.disabled)!;
      fireEvent.change(select, { target: { value: first.value } });
    }
    fireEvent.change(screen.getByTestId("ward-planned-unit"), { target: { value: "rph-adult-secure" } });
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    expect(captured.events.find((event) => event.type === "BOOK_PLANNED_ADMISSION")?.role).toBe("bed_manager");
    await screen.findByTestId("ward-planned-PA-01");
    const row = screen.getByTestId("ward-planned-PA-SEED-01");
    fireEvent.click(within(row).getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    await waitFor(() =>
      expect(captured.events.find((event) => event.type === "CHANGE_PLANNED_ADMISSION")?.role).toBe("bed_manager"),
    );
    await waitFor(() => expect(screen.queryByTestId("ward-planned-submit")).toBeNull());
    fireEvent.click(within(screen.getByTestId("ward-planned-PA-SEED-01")).getByRole("button", { name: "Cancel" }));
    const reasons = screen.getByTestId("ward-planned-cancel-reason") as HTMLSelectElement;
    fireEvent.change(reasons, { target: { value: reasons.options[1]!.value } });
    fireEvent.click(screen.getByTestId("ward-planned-cancel-confirm"));
    expect(captured.events.find((event) => event.type === "CANCEL_PLANNED_ADMISSION")?.role).toBe("bed_manager");
    await waitFor(() => expect(screen.queryByTestId("ward-planned-PA-SEED-01")).toBeNull());
  });
  it("uses the receiving ward's own actor for book, change, cancel, Undo and arrival", async () => {
    const unitId = "fre-adult-open";
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [unitId] } });
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <WardAccessScope>
            <PlannedAdmissionsPanel now={NOW_ANCHOR} unitId={unitId} />
          </WardAccessScope>
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-planned-book"));
    fireEvent.change(screen.getByTestId("ward-planned-who"), { target: { value: "initials" } });
    fireEvent.change(screen.getByTestId("ward-planned-initials"), { target: { value: "ZZ" } });
    for (const id of ["ward-planned-reason", "ward-planned-unit", "ward-planned-legal"]) {
      const select = screen.getByTestId(id) as HTMLSelectElement;
      const option = Array.from(select.options).find((entry) => entry.value && !entry.disabled)!;
      fireEvent.change(select, { target: { value: option.value } });
    }
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    const booked = await screen.findByTestId("ward-planned-PA-01");
    fireEvent.click(within(booked).getByRole("button", { name: "Change" }));
    fireEvent.change(screen.getByTestId("ward-planned-stay"), { target: { value: "8" } });
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    await waitFor(() => expect(screen.queryByTestId("ward-planned-submit")).toBeNull());
    expect(screen.getByTestId("ward-planned-PA-01")).toHaveTextContent(/8\s*d/u);
    fireEvent.click(within(screen.getByTestId("ward-planned-PA-01")).getByRole("button", { name: "Cancel" }));
    fireEvent.change(screen.getByTestId("ward-planned-cancel-reason"), { target: { value: "rebooked" } });
    fireEvent.click(screen.getByTestId("ward-planned-cancel-confirm"));
    await waitFor(() => expect(screen.queryByTestId("ward-planned-PA-01")).toBeNull());
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await screen.findByTestId("ward-planned-PA-01");
    fireEvent.click(within(screen.getByTestId("ward-planned-PA-SEED-03")).getByRole("button", { name: "Arrived" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm arrival" }));
    await waitFor(() => expect(screen.queryByTestId("ward-planned-PA-SEED-03")).toBeNull());
    for (const type of [
      "BOOK_PLANNED_ADMISSION",
      "CHANGE_PLANNED_ADMISSION",
      "CANCEL_PLANNED_ADMISSION",
      "UNDO_RELEASE_STEP",
      "CONVERT_PLANNED_ADMISSION",
    ]) {
      expect(
        captured.events.find((event) => event.type === type),
        type,
      ).toMatchObject({ role: "ward", actingUnitId: unitId });
    }
  });
});
