import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { DischargeOpenHandle } from "@/components/ward-management/ward-discharge-records";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const coordinator = { role: "coordinator" } as const;
let current: ReturnType<typeof useWardFlow>;
function Probe({ page, capture }: { page: string; capture: (flow: ReturnType<typeof useWardFlow>) => void }) {
  capture(useWardFlow());
  return <span>{page}</span>;
}
const world = (page: string) => (
  <WardFlowProvider initialNow={NOW_ANCHOR + 137}>
    <Probe
      page={page}
      capture={(flow) => {
        current = flow;
      }}
    />
  </WardFlowProvider>
);
function firstRecord() {
  const list = current.readDischargeRecords(coordinator);
  if (list.status !== "allowed" || !list.value.length) throw new Error("Discharge fixture required");
  return list.value[0];
}
afterEach(() => vi.restoreAllMocks());

describe("provider session record API", () => {
  it("opens only from an explicit handler, retains capture across navigation and never touches storage/network", () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const fetch = vi.spyOn(globalThis, "fetch");
    const mounted = render(world("capacity"));
    const record = firstRecord();
    expect(current.readAuditEvents(coordinator)).toEqual({ status: "allowed", value: [] });
    expect(current.readDischargeRecord(coordinator, record.admissionId, null)).toEqual({ status: "denied" });
    let handle: DischargeOpenHandle | null = null;
    act(() => {
      handle = current.openDischargeRecord(coordinator, record.admissionId);
      expect(current.readDischargeRecord(coordinator, record.admissionId, handle)).toEqual({ status: "denied" });
    });
    expect(current.readDischargeRecord(coordinator, record.admissionId, handle).status).toBe("allowed");
    mounted.rerender(world("governance"));
    const capture = current.readAuditEvents(coordinator);
    if (capture.status !== "allowed") throw new Error("Coordinator audit denied");
    expect(capture.value).toHaveLength(1);
    expect(capture.value[0]).toMatchObject({ category: "record-access", outcome: "accepted", at: NOW_ANCHOR + 137 });
    expect(current).not.toHaveProperty("auditEvents");
    expect(current).not.toHaveProperty("auditReviews");
    expect(storage).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps allocation monotonic across reset and scenario but rejects the old generation handle", () => {
    render(world("discharges"));
    const record = firstRecord();
    let oldHandle!: DischargeOpenHandle;
    act(() => {
      oldHandle = current.openDischargeRecord(coordinator, record.admissionId);
    });
    act(() => current.dispatch({ type: "RESET_SCENARIO", role: "demo", now: current.now }));
    expect(current.worldGeneration).toBe(1);
    expect(current.readAuditEvents(coordinator)).toEqual({ status: "allowed", value: [] });
    let newHandle!: DischargeOpenHandle;
    act(() => {
      newHandle = current.openDischargeRecord(coordinator, record.admissionId);
    });
    expect(newHandle.requestId).toBeGreaterThan(oldHandle.requestId);
    expect(newHandle.generation).toBe(1);
    expect(current.readDischargeRecord(coordinator, record.admissionId, oldHandle)).toEqual({ status: "denied" });
    expect(current.readDischargeRecord(coordinator, record.admissionId, newHandle).status).toBe("allowed");
    act(() => current.dispatch({ type: "SET_SCENARIO", role: "demo", now: current.now, scenario: "standard" }));
    expect(current.worldGeneration).toBe(2);
    expect(current.readAuditEvents(coordinator)).toEqual({ status: "allowed", value: [] });
    expect(current.readAuditReviews(coordinator)).toEqual({ status: "allowed", value: [] });
  });

  it("remount recreates world and allocator, while wrong-role or changed-selection handles stay denied", () => {
    const mounted = render(world("capacity"));
    const record = firstRecord();
    let first!: DischargeOpenHandle;
    act(() => {
      first = current.openDischargeRecord(coordinator, record.admissionId);
    });
    expect(current.readDischargeRecord({ role: "ed" }, record.admissionId, first)).toEqual({ status: "denied" });
    expect(current.readDischargeRecord(coordinator, "other-record", first)).toEqual({ status: "denied" });
    mounted.unmount();
    render(world("capacity"));
    expect(current.worldGeneration).toBe(0);
    expect(current.readAuditEvents(coordinator)).toEqual({ status: "allowed", value: [] });
    let remounted!: DischargeOpenHandle;
    act(() => {
      remounted = current.openDischargeRecord(coordinator, record.admissionId);
    });
    expect(remounted.requestId).toBe(first.requestId);
    // Handles are deliberately local to a provider subtree; none is persisted across remount.
  });
});
