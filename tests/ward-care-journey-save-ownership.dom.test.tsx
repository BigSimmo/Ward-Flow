import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DischargeCareJourney } from "@/components/ward-management/discharges/discharge-care-journey";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { selectDischargeRecord } from "@/components/ward-management/ward-discharge-records";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const dispatch = vi.hoisted(() => vi.fn());
vi.mock("@/components/ward-management/ward-flow-provider", async (load) => ({
  ...(await load<typeof import("@/components/ward-management/ward-flow-provider")>()),
  useWardFlowSelect: () => ({ ...state, dayZero: new Date("2026-01-01T00:00:00Z"), dispatch }),
  useWardFlowClock: () => NOW_ANCHOR,
}));
const state = seedWardFlowState();
function start() {
  const admission = state.admissions.find((row) => row.state === "occupied" && row.patientId)!;
  const record = selectDischargeRecord(state, { role: "coordinator" }, admission.id);
  if (record.status !== "allowed") throw new Error("Synthetic admission must be readable");
  render(<DischargeCareJourney record={record.value} actor={{ role: "coordinator" }} />);
}
function edit(label: string, value: string) {
  const field = screen.getByRole("combobox", { name: label });
  fireEvent.change(field, { target: { value } });
  fireEvent.input(field);
}
function warns() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
beforeEach(() => dispatch.mockReset());
describe("care section save ownership", () => {
  it("keeps section B dirty when its second save is suppressed and A accepts", async () => {
    let accept!: (value: WardCommandOutcome) => void;
    dispatch.mockReturnValue(
      new Promise<WardCommandOutcome>((resolve) => {
        accept = resolve;
      }),
    );
    start();
    // Choose valid options from the same production controls.
    const status = screen.getByRole("combobox", { name: "Planning status" }) as HTMLSelectElement;
    edit("Planning status", status.options[1]!.value);
    const item = screen.getByRole("combobox", { name: "Planning item" }) as HTMLSelectElement;
    edit("Planning item", item.options[1]!.value);
    fireEvent.submit(screen.getByRole("button", { name: "Record planning item" }).closest("form")!);
    const document = screen.getByRole("combobox", { name: "Document" }) as HTMLSelectElement;
    edit("Document", document.options[1]!.value);
    const documentStatus = screen.getByRole("combobox", { name: "Document status" }) as HTMLSelectElement;
    edit("Document status", documentStatus.options[1]!.value);
    fireEvent.submit(screen.getByRole("button", { name: "Record clinical document" }).closest("form")!);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(warns()).toBe(true);
    await act(async () => accept({ commandId: "care-a", status: "accepted" }));
    expect(warns()).toBe(true);
    dispatch.mockReturnValue({ commandId: "care-b", status: "accepted" });
    fireEvent.submit(screen.getByRole("button", { name: "Record clinical document" }).closest("form")!);
    expect(warns()).toBe(false);
  });
  it("does not clear newer content in the accepted section", async () => {
    let accept!: (value: WardCommandOutcome) => void;
    dispatch.mockReturnValue(
      new Promise<WardCommandOutcome>((resolve) => {
        accept = resolve;
      }),
    );
    start();
    const item = screen.getByRole("combobox", { name: "Planning item" }) as HTMLSelectElement;
    const status = screen.getByRole("combobox", { name: "Planning status" }) as HTMLSelectElement;
    edit("Planning item", item.options[1]!.value);
    edit("Planning status", status.options[1]!.value);
    fireEvent.submit(screen.getByRole("button", { name: "Record planning item" }).closest("form")!);
    edit("Planning status", status.options[2]!.value);
    await act(async () => accept({ commandId: "care-a", status: "accepted" }));
    expect(warns()).toBe(true);
  });
});
