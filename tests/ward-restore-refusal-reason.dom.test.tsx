// A refused restore says why (Josh, 5 Nov 2026): when a saved board breaks a record-ownership rule,
// the restore notice and the scenario file loader name the rule in plain words. Synthetic data only.
import { useEffect } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WardFlowProvider,
  WARD_FLOW_DEMO_STORAGE_KEY,
  useWardFlow,
} from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WARD_FLOW_STORED_STATE_VERSION } from "@/components/ward-management/ward-flow-storage-validation";
import { buildScenarioFile, readScenarioFile } from "@/components/ward-management/ward-flow-scenario-file";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardRecoveryNotice } from "@/components/ward-management/shell/ward-recovery-notice";

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
      <WardRecoveryNotice />
      <Probe />
    </WardFlowProvider>,
  );
}
function saved() {
  return JSON.parse(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)!);
}
/** Two occupied stays on one ward both claim bed 1. */
function shareOneBed(state: WardFlowState) {
  const first = state.admissions.find((row) => row.state === "occupied")!;
  const second = state.admissions.find(
    (row) => row.id !== first.id && row.unitId === first.unitId && row.state === "occupied",
  )!;
  expect(second).toBeDefined();
  first.bedNumber = 1;
  second.bedNumber = 1;
}

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

describe("a refused restore names the problem", () => {
  it("tells the person the saved board could not be restored and why", () => {
    const view = mount();
    const payload = saved();
    shareOneBed(payload.state);
    window.sessionStorage.setItem(WARD_FLOW_DEMO_STORAGE_KEY, JSON.stringify(payload));
    view.unmount();
    mount();
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("could not be restored safely");
    expect(notice).toHaveTextContent("two records hold the same numbered bed");
    expect(notice).toHaveTextContent("A fresh synthetic demonstration has started.");
    expect(current.now).toBe(NOW_ANCHOR);
  });

  it("keeps the generic refusal for a save that is simply damaged", () => {
    const view = mount();
    const payload = saved();
    payload.state.admissionSequence = 1.5;
    window.sessionStorage.setItem(WARD_FLOW_DEMO_STORAGE_KEY, JSON.stringify(payload));
    view.unmount();
    mount();
    expect(screen.getByRole("status")).toHaveTextContent(
      "The saved demonstration could not be restored safely. A fresh synthetic demonstration has started.",
    );
  });

  it("names the problem when a scenario file is refused", () => {
    const built = buildScenarioFile(
      seedWardFlowState(),
      NOW_ANCHOR + 1440,
      WARD_FLOW_STORED_STATE_VERSION,
      new Date("2026-11-04T00:00:00Z"),
    );
    if (!built.ok) throw new Error(built.reason);
    const envelope = JSON.parse(built.json);
    shareOneBed(envelope.state);
    const read = readScenarioFile(JSON.stringify(envelope), WARD_FLOW_STORED_STATE_VERSION);
    expect(read).toEqual({
      ok: false,
      reason: "This scenario could not be restored: two records hold the same numbered bed. Nothing was loaded.",
    });
  });
});
