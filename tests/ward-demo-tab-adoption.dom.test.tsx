import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { absoluteWallClockMinutes, demoDayZero } from "@/components/ward-management/ward-clock";
import { tryWriteDemoState, WARD_FLOW_DEMO_STORAGE_KEY } from "@/components/ward-management/ward-flow-demo-storage";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Design audit DA-01: opening a new tab must not reset the day in the tabs already open. A fresh
// tab asks the open tabs for their day and adopts it; it never broadcasts its untouched seed.

type Message = { type?: string; eventType?: string; senderId?: string; payload?: string };
const posted: Message[] = [];
const channels = new Set<FakeChannel>();

class FakeChannel {
  onmessage: ((event: { data: Message }) => void) | null = null;
  constructor(readonly name: string) {
    channels.add(this);
  }
  postMessage(data: Message) {
    posted.push(data);
    for (const other of channels) {
      if (other !== this && other.name === this.name) {
        void Promise.resolve().then(() => other.onmessage?.({ data }));
      }
    }
  }
  close() {
    channels.delete(this);
  }
}

// The day a tab is on, as its own saved copy shows it.
function savedOffset(): number | undefined {
  const raw = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
  return raw ? JSON.parse(raw).state.clockOffsetMinutes : undefined;
}

// The saved-session read loads on demand, so a tab joins the others once that read has landed.
async function settle() {
  await act(async () => {
    await import("@/components/ward-management/ward-flow-demo-restore");
  });
  for (let i = 0; i < 5; i++) await act(async () => Promise.resolve());
}

function savedDayWithOffset(offset: number): string {
  const state = { ...seedWardFlowState(), clockOffsetMinutes: offset };
  expect(tryWriteDemoState(state, demoDayZero(new Date()), NOW_ANCHOR + offset, absoluteWallClockMinutes() - 1)).toBe(
    true,
  );
  const raw = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
  expect(raw).toBeTruthy();
  return raw as string;
}

beforeEach(() => {
  posted.length = 0;
  channels.clear();
  vi.stubGlobal("BroadcastChannel", FakeChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("a newly opened demo tab", () => {
  it("asks the open tabs for their day and never broadcasts its untouched seed", async () => {
    render(
      <WardFlowProvider>
        <p>Ward Flow</p>
      </WardFlowProvider>,
    );
    await settle();
    expect(posted.some((m) => m.eventType === "REQUEST_SAVED_STATE")).toBe(true);
    expect(posted.some((m) => m.eventType === "SYNC_SAVED_STATE")).toBe(false);
  });

  it("adopts the day an open tab answers with", async () => {
    const raw = savedDayWithOffset(15);
    window.sessionStorage.clear();
    const openTab = new FakeChannel("ward-flow-sync");
    openTab.onmessage = ({ data }) => {
      if (data.eventType === "REQUEST_SAVED_STATE")
        openTab.postMessage({
          type: "WARD_FLOW_DISPATCH",
          eventType: "SYNC_SAVED_STATE",
          senderId: "open-tab",
          payload: raw,
        });
    };
    render(
      <WardFlowProvider>
        <p>Ward Flow</p>
      </WardFlowProvider>,
    );
    await settle();
    expect(savedOffset()).toBe(15);
  });
});

describe("an open demo tab with a worked day", () => {
  it("answers a new tab's request with its saved day", async () => {
    savedDayWithOffset(30);
    render(
      <WardFlowProvider>
        <p>Ward Flow</p>
      </WardFlowProvider>,
    );
    await settle();
    expect(savedOffset()).toBe(30);
    const newTab = new FakeChannel("ward-flow-sync");
    posted.length = 0;
    newTab.postMessage({ type: "WARD_FLOW_DISPATCH", eventType: "REQUEST_SAVED_STATE", senderId: "new-tab" });
    await settle();
    const answer = posted.find((m) => m.eventType === "SYNC_SAVED_STATE");
    expect(answer?.payload).toBe(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY));
  });
});
