import { useEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { ScenarioFileRead } from "@/components/ward-management/ward-flow-scenario-file";
import { useWardCommandCompletion } from "@/components/ward-management/ward/use-ward-command-completion";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

const reads = vi.hoisted(() => new Map<string, (read: ScenarioFileRead) => void>());
vi.mock("@/components/ward-management/ward-flow-demo-storage", async (original) => ({
  ...(await original<object>()),
  readScenarioFileLater: (text: string) => new Promise<ScenarioFileRead>((resolve) => reads.set(text, resolve)),
}));
let current: ReturnType<typeof useWardFlow>;
let complete: ReturnType<typeof useWardCommandCompletion>;
function Capture() {
  const value = useWardFlow();
  const command = useWardCommandCompletion();
  useEffect(() => {
    current = value;
    complete = command;
  }, [value, command]);
  return null;
}
function mount() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Capture />
    </WardFlowProvider>,
  );
}
const imported = (offset: number): ScenarioFileRead => ({
  ok: true,
  now: NOW_ANCHOR + offset,
  state: seedWardFlowStateAt(0),
});
afterEach(() => {
  cleanup();
  reads.clear();
});

describe("scenario import ownership", () => {
  it.each(["confirmed", "confirmation-rejected", "completion-rejected"] as const)(
    "reset retires an old command without releasing the replacement command: %s",
    async (oldResult) => {
      mount();
      let confirmOld!: (outcome: WardCommandOutcome) => void;
      let rejectOld!: () => void;
      const oldPromise = new Promise<WardCommandOutcome>((resolve, reject) => {
        confirmOld = resolve;
        rejectOld = () => reject(new Error("Old world ended"));
      });
      const oldSettled = vi.fn();
      act(() => {
        complete(
          "departure:ADM-1",
          () =>
            oldResult === "completion-rejected"
              ? oldPromise
              : { commandId: "old", status: "failed", confirmation: oldPromise },
          oldSettled,
        );
        current.resetDemoState();
      });
      let confirmNew!: (outcome: WardCommandOutcome) => void;
      const newPromise = new Promise<WardCommandOutcome>((resolve) => {
        confirmNew = resolve;
      });
      const newRecord = vi.fn(() => newPromise);
      const newSettled = vi.fn();
      act(() => complete("departure:ADM-1", newRecord, newSettled));
      expect(newRecord).toHaveBeenCalledOnce();
      await act(async () => {
        if (oldResult === "confirmed") confirmOld({ commandId: "old", status: "accepted" });
        else rejectOld();
      });
      expect(oldSettled).toHaveBeenCalledTimes(oldResult === "completion-rejected" ? 0 : 1);
      const duplicate = vi.fn();
      act(() => complete("departure:ADM-1", duplicate, newSettled));
      expect(duplicate).not.toHaveBeenCalled();
      const accepted: WardCommandOutcome = { commandId: "new", status: "accepted" };
      await act(async () => confirmNew(accepted));
      expect(newSettled).toHaveBeenCalledExactlyOnceWith(accepted);
    },
  );
  it("keeps the newer import when the older read finishes last", async () => {
    mount();
    let first!: ReturnType<NonNullable<typeof current.loadScenarioFile>>;
    let second!: ReturnType<NonNullable<typeof current.loadScenarioFile>>;
    // The file text is awaited before the read starts, so let the older read begin before the newer import.
    await act(async () => {
      first = current.loadScenarioFile!("first");
      await vi.waitFor(() => expect(reads.has("first")).toBe(true));
    });
    await act(async () => {
      second = current.loadScenarioFile!("second");
      await vi.waitFor(() => expect(reads.has("second")).toBe(true));
    });
    await act(async () => {
      reads.get("second")!(imported(15));
      await second;
    });
    const adopted = current.worldGeneration;
    await act(async () => {
      reads.get("first")!(imported(30));
      expect((await first).ok).toBe(false);
    });
    expect(current.worldGeneration).toBe(adopted);
    expect(current.now).toBe(NOW_ANCHOR + 15);
  });
  it("refuses a pending import after the local day is reset", async () => {
    mount();
    let pending!: ReturnType<NonNullable<typeof current.loadScenarioFile>>;
    await act(async () => {
      pending = current.loadScenarioFile!("first");
      await vi.waitFor(() => expect(reads.has("first")).toBe(true));
    });
    act(() => current.resetDemoState());
    const generation = current.worldGeneration;
    await act(async () => {
      reads.get("first")!(imported(30));
      expect((await pending).ok).toBe(false);
    });
    expect(current.worldGeneration).toBe(generation);
  });
});
