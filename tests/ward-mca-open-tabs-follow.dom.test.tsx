import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { absoluteWallClockMinutes, demoDayZero } from "@/components/ward-management/ward-clock";
import { tryWriteDemoState, WARD_FLOW_DEMO_STORAGE_KEY } from "@/components/ward-management/ward-flow-demo-storage";
import { DEMO_SAVE_CURRENT_KEY } from "@/components/ward-management/ward-flow-demo-save-marker";
import { dayIsFollowed } from "@/components/ward-management/ward-flow-open-tabs-day";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardOtherTabDayNote, resetOtherTabDayForTests } from "@/components/ward-management/shell/ward-other-tab-day";

// Mechanics and clock audit L8 (14 Nov 2026), demo tabs: a tab that only followed another tab's
// day still follows after its own reload (it does not become the day's owner and report a split),
// and an open tab whose save is not its latest day does not answer a new tab with that older day.

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
    for (const other of channels)
      if (other !== this && other.name === this.name) void Promise.resolve().then(() => other.onmessage?.({ data }));
  }
  close() {
    channels.delete(this);
  }
}
const savedOffset = () => {
  const raw = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
  return raw ? (JSON.parse(raw).state.clockOffsetMinutes as number) : undefined;
};
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
  return window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)!;
}
beforeEach(() => {
  posted.length = 0;
  channels.clear();
  vi.stubGlobal("BroadcastChannel", FakeChannel);
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  resetOtherTabDayForTests();
});

it("a tab that only followed another tab's day still follows after its own reload", async () => {
  const firstDay = savedDayWithOffset(15);
  const laterDay = savedDayWithOffset(45);
  window.sessionStorage.clear();
  const openTab = new FakeChannel("ward-flow-sync");
  openTab.onmessage = ({ data }) => {
    if (data.eventType === "REQUEST_SAVED_STATE")
      openTab.postMessage({
        type: "WARD_FLOW_DISPATCH",
        eventType: "SYNC_SAVED_STATE",
        senderId: "open-tab",
        payload: firstDay,
      });
  };
  const first = render(
    <WardFlowProvider>
      <p>Ward Flow</p>
    </WardFlowProvider>,
  );
  await settle();
  expect(savedOffset()).toBe(15);
  expect(dayIsFollowed()).toBe(true);
  first.unmount();

  // Reload: the followed day is restored, and the other tab's next day is still taken, not reported as a split.
  render(
    <WardFlowProvider>
      <WardOtherTabDayNote />
    </WardFlowProvider>,
  );
  await settle();
  expect(savedOffset()).toBe(15);
  openTab.postMessage({
    type: "WARD_FLOW_DISPATCH",
    eventType: "SYNC_SAVED_STATE",
    senderId: "open-tab",
    payload: laterDay,
  });
  await settle();
  expect(savedOffset()).toBe(45);
  expect(screen.queryByTestId("ward-other-tab-day")).toBeNull();
});

it("a tab whose save is not its latest day does not answer a new tab with it", async () => {
  savedDayWithOffset(30);
  render(
    <WardFlowProvider>
      <p>Ward Flow</p>
    </WardFlowProvider>,
  );
  await settle();
  // A later change could not be saved (`keepLastSafeDemoSave`): the stored day is older than the tab's.
  window.sessionStorage.removeItem(DEMO_SAVE_CURRENT_KEY);
  posted.length = 0;
  const newTab = new FakeChannel("ward-flow-sync");
  newTab.postMessage({ type: "WARD_FLOW_DISPATCH", eventType: "REQUEST_SAVED_STATE", senderId: "new-tab" });
  await settle();
  expect(posted.some((message) => message.eventType === "SYNC_SAVED_STATE")).toBe(false);
});
