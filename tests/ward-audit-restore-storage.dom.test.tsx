import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  WardFlowProvider,
  useWardFlow,
  WARD_FLOW_DEMO_STORAGE_KEY,
} from "@/components/ward-management/ward-flow-provider";

function mount() {
  let current!: ReturnType<typeof useWardFlow>;
  function Capture() {
    current = useWardFlow();
    return null;
  }
  const view = render(
    <WardFlowProvider>
      <Capture />
    </WardFlowProvider>,
  );
  return {
    ...view,
    get current() {
      return current;
    },
  };
}
describe("scenario restore saves generic Undo copies consistently", () => {
  it.each(["blocker", "clearance"] as const)("export, fresh import and refresh preserve %s safely", async (kind) => {
    const original = mount();
    await waitFor(() => expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).not.toBeNull());
    if (kind === "blocker") {
      await act(async () => {
        expect(
          await original.current.dispatch({
            type: "RECORD_MOVEMENT_BLOCKER",
            role: "coordinator",
            now: original.current.now,
            movementId: "WF-001",
            blocker: "Synthetic restore marker 7kq",
          }),
        ).toMatchObject({ status: "accepted" });
      });
      await act(async () => {
        expect(
          await original.current.dispatch({
            type: "RECORD_LEGAL_FORM_RECEIVED",
            role: "coordinator",
            now: original.current.now,
            movementId: "WF-001",
          }),
        ).toMatchObject({ status: "accepted" });
      });
    } else
      await act(async () => {
        expect(
          await original.current.dispatch({
            type: "RECORD_MEDICAL_CLEARANCE",
            role: "ed",
            now: original.current.now,
            referralId: "RF-009",
            cleared: true,
          }),
        ).toMatchObject({ status: "accepted" });
      });
    const exported = await original.current.saveScenarioFile!();
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("Expected a synthetic scenario export");
    if (kind === "blocker")
      expect(JSON.stringify(JSON.parse(exported.json).state.undoRecords)).toContain("Synthetic restore marker 7kq");
    const expectedClearance = original.current.referrals.find((row) => row.id === "RF-009")!.medicalClearance;
    original.unmount();
    window.sessionStorage.clear();
    const restored = mount();
    await act(async () => {
      expect(await restored.current.loadScenarioFile!(exported.json)).toEqual({ ok: true });
    });
    await waitFor(() => {
      expect(restored.current.savingOnDevice).toBe(true);
      const stored = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
      expect(stored).not.toBeNull();
      expect(stored).not.toContain("Synthetic restore marker 7kq");
      expect(JSON.parse(stored!).state.worldGeneration).toBe(restored.current.worldGeneration);
      expect(JSON.parse(stored!).state.undoRecords.length).toBeGreaterThan(0);
    });
    const unrelated = restored.current.units;
    restored.unmount();
    const refreshed = mount();
    await waitFor(() =>
      expect(refreshed.current.referrals.find((row) => row.id === "RF-009")!.medicalClearance).toEqual(
        expectedClearance,
      ),
    );
    expect(refreshed.current.units).toEqual(unrelated);
    expect(refreshed.current.savingOnDevice).toBe(true);
    refreshed.unmount();
  });
});
