import { useLayoutEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  WardFlowProvider,
  useWardFlow,
  type WardFlowContextValue,
} from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import {
  tryWriteDemoState,
  WARD_FLOW_DEMO_STORAGE_KEY,
  WARD_FLOW_DEMO_STORAGE_VERSION,
} from "@/components/ward-management/ward-flow-demo-storage";
import { absoluteWallClockMinutes, demoDayZero } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

type Message = { type: string; senderId: string; payload: string };
const channels = new Set<Channel>();
class Channel {
  onmessage: ((message: { data: Message }) => void) | null = null;
  constructor(readonly name: string) {
    channels.add(this);
  }
  postMessage(data: Message) {
    for (const channel of channels)
      if (channel !== this && channel.name === this.name)
        void Promise.resolve().then(() => channel.onmessage?.({ data }));
  }
  close() {
    channels.delete(this);
  }
}

let flow: WardFlowContextValue;
function Probe() {
  const value = useWardFlow();
  useLayoutEffect(() => {
    flow = value;
  });
  return null;
}
async function settle() {
  await act(async () => {
    await import("@/components/ward-management/ward-flow-demo-restore");
  });
  for (let i = 0; i < 8; i++) await act(async () => Promise.resolve());
}
function sendWorld(state: ReturnType<typeof seedWardFlowState>) {
  new Channel("ward-flow-sync").postMessage({
    type: "WARD_FLOW_DISPATCH",
    senderId: "synthetic-peer",
    payload: JSON.stringify({
      version: WARD_FLOW_DEMO_STORAGE_VERSION,
      dayZero: demoDayZero(new Date()).getTime(),
      worldGeneration: state.worldGeneration,
      now: NOW_ANCHOR,
      savedAtAbsolute: absoluteWallClockMinutes(),
      state,
    }),
  });
}
function savedState() {
  return JSON.parse(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)!).state;
}
beforeEach(() => {
  vi.stubGlobal("BroadcastChannel", Channel);
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  channels.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

it("retains accepted saved work when a delayed peer snapshot arrives, including after reopening", async () => {
  const seed = seedWardFlowState();
  const unit = seed.units[0]!;
  // A peer captured the common starting world before this tab's request existed.
  const peer = wardFlowReducer(seed, {
    type: "REQUEST_CAPACITY_REFRESH",
    role: "coordinator",
    now: NOW_ANCHOR,
    unitId: seed.units[1]!.id,
  });
  let view = render(
    <WardFlowProvider>
      <Probe />
    </WardFlowProvider>,
  );
  await settle();
  await act(async () => {
    const result = await flow.dispatch({
      type: "REQUEST_CAPACITY_REFRESH",
      role: "coordinator",
      now: flow.now,
      unitId: unit.id,
    });
    expect(result?.status).toBe("accepted");
  });
  await settle();
  expect(savedState().refreshRequests.some((entry: { unitId: string }) => entry.unitId === unit.id)).toBe(true);
  for (let delivery = 0; delivery < 2; delivery++) {
    sendWorld(peer);
    await settle();
    expect(flow.refreshRequests.some((entry) => entry.unitId === unit.id)).toBe(true);
    expect(savedState().refreshRequests.some((entry: { unitId: string }) => entry.unitId === unit.id)).toBe(true);
    if (delivery === 0) {
      view.unmount();
      view = render(
        <WardFlowProvider>
          <Probe />
        </WardFlowProvider>,
      );
      await settle();
    }
  }
});

it("continues to adopt valid peer snapshots while the tab has made no local changes", async () => {
  const seed = seedWardFlowState();
  const peer = wardFlowReducer(seed, {
    type: "REQUEST_CAPACITY_REFRESH",
    role: "coordinator",
    now: NOW_ANCHOR,
    unitId: seed.units[1]!.id,
  });
  render(
    <WardFlowProvider>
      <Probe />
    </WardFlowProvider>,
  );
  await settle();
  sendWorld(seed);
  await settle();
  sendWorld(peer);
  await settle();
  expect(flow.refreshRequests.some((entry) => entry.unitId === seed.units[1]!.id)).toBe(true);
});

it("keeps a locally reset day instead of replacing it from another tab", async () => {
  render(
    <WardFlowProvider>
      <Probe />
    </WardFlowProvider>,
  );
  await settle();
  await act(async () => flow.resetDemoState());
  await settle();
  const seed = seedWardFlowState();
  const peer = wardFlowReducer(
    { ...seed, worldGeneration: flow.worldGeneration },
    {
      type: "REQUEST_CAPACITY_REFRESH",
      role: "coordinator",
      now: NOW_ANCHOR,
      unitId: seed.units[0]!.id,
    },
  );
  sendWorld(peer);
  await settle();
  expect(flow.refreshRequests.some((entry) => entry.unitId === seed.units[0]!.id)).toBe(false);
});

it("protects a restored worked day even before another local action", async () => {
  const seed = seedWardFlowState();
  const worked = wardFlowReducer(seed, {
    type: "REQUEST_CAPACITY_REFRESH",
    role: "coordinator",
    now: NOW_ANCHOR,
    unitId: seed.units[0]!.id,
  });
  expect(tryWriteDemoState(worked, demoDayZero(new Date()), NOW_ANCHOR, absoluteWallClockMinutes())).toBe(true);
  render(
    <WardFlowProvider>
      <Probe />
    </WardFlowProvider>,
  );
  await settle();
  expect(flow.refreshRequests.some((entry) => entry.unitId === seed.units[0]!.id)).toBe(true);
  sendWorld(seed);
  await settle();
  expect(flow.refreshRequests.some((entry) => entry.unitId === seed.units[0]!.id)).toBe(true);
});
