import { useEffect } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useWardFlow,
  WardFlowProvider,
  WARD_FLOW_DEMO_STORAGE_KEY,
} from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Live walkthrough, 25 September 2026: a reload threw away the whole day. `appendAudit`
 * (`ward-audit.ts`) numbers audit rows 1, 2, 3 … and stores the newest number as `auditSequence`,
 * so issued numbers run 1..auditSequence INCLUSIVE. The restore check refused any row numbered
 * `>= auditSequence`, which is always the newest row — so every saved day holding one audit row
 * (for example after "Refer" on Command) was refused on reload, replaced by a fresh day, and the
 * fresh day then overwrote the save.
 */
let current: ReturnType<typeof useWardFlow>;
function Probe() {
  const value = useWardFlow();
  useEffect(() => {
    current = value;
  }, [value]);
  return null;
}
function mount() {
  return render(
    <WardFlowProvider>
      <Probe />
    </WardFlowProvider>,
  );
}
function saved() {
  return JSON.parse(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)!);
}
const legalEvent = {
  type: "CHANGE_LEGAL_STATUS",
  role: "coordinator",
  movementId: "WF-009",
  legalStatus: "Voluntary",
  reason: "recorded_by_treating_team",
} as const;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 23, 10, 0));
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  vi.useRealTimers();
});

describe("a saved day that holds audit rows survives a reload", () => {
  it("restores a day whose newest audit row carries the stored auditSequence", () => {
    const view = mount();
    const rejectionsBefore = current.rejections.length;
    act(() => current.dispatch({ ...legalEvent, now: current.now }));
    expect(current.rejections, "the audited action itself must be accepted").toHaveLength(rejectionsBefore);
    const payload = saved();
    expect(payload.state.auditSequence).toBe(1);
    expect(payload.state.auditEvents.map((row: { sequence: number }) => row.sequence)).toEqual([1]);
    view.unmount();

    mount();
    expect(screen.queryByRole("status"), "no 'could not be restored' notice").toBeNull();
    expect(current.movements.find((movement) => movement.id === "WF-009")!.legalStatus).toBe("Voluntary");
    expect(saved().state.auditEvents).toHaveLength(1);
  });

  it("still refuses an audit row numbered beyond auditSequence, or numbered 0", () => {
    const audited = JSON.parse(JSON.stringify(wardFlowReducer(seedWardFlowStateAt(0), { ...legalEvent, now: NOW_ANCHOR })));
    expect(audited.auditSequence).toBe(1);
    expect(isValidStoredWardFlowState(audited)).toBe(true);

    const beyond = JSON.parse(JSON.stringify(audited));
    beyond.auditEvents[0].sequence = 2;
    expect(isValidStoredWardFlowState(beyond)).toBe(false);

    const zero = JSON.parse(JSON.stringify(audited));
    zero.auditEvents[0].sequence = 0;
    expect(isValidStoredWardFlowState(zero)).toBe(false);
  });
});
