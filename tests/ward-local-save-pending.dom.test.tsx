import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLayoutEffect } from "react";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardDemoNotSavedNote } from "@/components/ward-management/shell/ward-demo-saving";
import { demoSaveIsCurrent } from "@/components/ward-management/ward-flow-demo-save-marker";
import { WARD_FLOW_DEMO_STORAGE_KEY } from "@/components/ward-management/ward-flow-demo-storage";
import { TRANSPORT_PROVIDERS } from "@/components/ward-management/ward-model";

const held = vi.hoisted(() => ({ loaded: false, finish: undefined as (() => void) | undefined, restore: true }));
vi.mock("@/components/ward-management/ward-flow-demo-storage", async (original) => {
  const actual = await original<typeof import("@/components/ward-management/ward-flow-demo-storage")>();
  return {
    ...actual,
    useDemoStateRead: () => (held.restore ? {} : undefined),
    deviceCopyOf: (...args: Parameters<typeof actual.deviceCopyOf>) =>
      args[1].typedTextSeen && !held.loaded ? undefined : actual.deviceCopyOf(...args),
    loadTypedTextScrub: () =>
      new Promise<void>((resolve) => {
        held.finish = () => {
          void actual.loadTypedTextScrub().then(() => {
            held.loaded = true;
            resolve();
          });
        };
      }),
  };
});
let current: ReturnType<typeof useWardFlow>;
function Capture() {
  const flow = useWardFlow();
  useLayoutEffect(() => {
    current = flow;
  });
  return <WardDemoNotSavedNote />;
}
function tree() {
  return (
    <WardFlowProvider>
      <Capture />
    </WardFlowProvider>
  );
}
function unloadPrevented() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 17, 10, 42, 0));
  sessionStorage.clear();
  held.loaded = false;
  held.restore = true;
  held.finish = undefined;
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.useRealTimers();
});

it("protects an accepted transport booking until its scrubbed device copy is actually written", async () => {
  render(tree());
  await waitFor(() => expect(current.savingOnDevice).toBe(true));
  expect(demoSaveIsCurrent()).toBe(true);
  const before = sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
  const movement = current.movements.find((row) => row.stage === "pulled")!;
  act(() => {
    expect(
      current.dispatch({
        type: "BOOK_TRANSPORT",
        role: "ed",
        now: current.now,
        movementId: movement.id,
        provider: TRANSPORT_PROVIDERS[0],
        escortRequired: true,
        cadNumber: "CAD-2026-0917",
        transportLegalStatus: "voluntary",
        estimatedAt: current.now + 30,
      }),
    ).toMatchObject({ status: "accepted" });
  });
  expect(sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).toBe(before);
  expect(demoSaveIsCurrent()).toBe(false);
  expect(current.savingOnDevice).toBe(false);
  expect(unloadPrevented()).toBe(true);
  expect(await screen.findByTestId("ward-demo-save-pending")).toHaveTextContent("not yet saved");
  await act(async () => {
    held.finish!();
  });
  await waitFor(() => expect(current.savingOnDevice).toBe(true));
  expect(demoSaveIsCurrent()).toBe(true);
  expect(unloadPrevented()).toBe(false);
  const saved = sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)!;
  expect(saved).not.toContain("CAD-2026-0917");
  expect(saved).not.toBe(before);
});

it("keeps a queued early command protected before restoration and releases it after adoption", async () => {
  held.restore = false;
  const view = render(tree());
  let answer!: ReturnType<typeof current.dispatch>;
  act(() => {
    answer = current.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current.now, minutes: 15 });
  });
  expect(answer).toBeInstanceOf(Promise);
  expect(sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).toBeNull();
  expect(unloadPrevented()).toBe(true);
  held.restore = true;
  await act(async () => {
    view.rerender(tree());
  });
  await expect(answer).resolves.toMatchObject({ status: "accepted" });
  await waitFor(() => expect(current.savingOnDevice).toBe(true));
  expect(unloadPrevented()).toBe(false);
});
