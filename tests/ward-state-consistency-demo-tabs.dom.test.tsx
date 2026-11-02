import { act, cleanup, render } from "@testing-library/react";
import { StrictMode, useContext, useEffect, useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import { WardRecoveryNoticeContext } from "@/components/ward-management/shell/ward-recovery-notice";
import { WARD_FLOW_DEMO_STORAGE_KEY } from "@/components/ward-management/ward-flow-demo-storage";

type WorldView = ReturnType<typeof useWardFlow>;
class TabStorage implements Storage {
  private values = new Map<string, string>();
  denied = false;
  get length() {
    return this.values.size;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.denied) throw new DOMException("Synthetic quota refusal", "QuotaExceededError");
    this.values.set(key, String(value));
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  clear() {
    this.values.clear();
  }
}
type Message = { data: { type?: string; eventType?: string; senderId?: string; payload?: string } };
let activeTab = 0;
let stores: TabStorage[];
let channels: QueuedChannel[];
let messages: Message[];
let current: WorldView[];
let notices: (string | null)[];
let mounted: ReturnType<typeof render>[];
let early: Map<number, { unitId: string; value: number }>;
let earlySent: Set<number>;
const storageDescriptor = Object.getOwnPropertyDescriptor(window, "sessionStorage")!;
const channelDescriptor = Object.getOwnPropertyDescriptor(window, "BroadcastChannel");
class QueuedChannel {
  owner = activeTab;
  closed = false;
  onmessage: ((message: Message) => void) | null = null;
  constructor(readonly name: string) {
    channels.push(this);
  }
  postMessage(data: Message["data"]) {
    messages.push({ data: structuredClone(data) });
  }
  close() {
    this.closed = true;
  }
}
function Probe({ tab }: { tab: number }) {
  const value = useWardFlow();
  const notice = useContext(WardRecoveryNoticeContext);
  useLayoutEffect(() => {
    current[tab] = value;
    notices[tab] = notice;
  }, [tab, value, notice]);
  useEffect(() => {
    const pending = early.get(tab);
    if (!pending || earlySent.has(tab)) return;
    earlySent.add(tab);
    const unit = current[tab].units.find((candidate) => candidate.id === pending.unitId)!;
    void current[tab].dispatch({
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: current[tab].now,
      unitId: unit.id,
      actingUnitId: unit.id,
      expectedRevision: unit.allocatable.revision ?? 0,
      value: pending.value,
    });
  }, [tab]);
  return (
    <p role="status" data-testid={`tab-${tab}-notice`}>
      {notice}
    </p>
  );
}
async function settle() {
  await act(async () => {
    await import("@/components/ward-management/ward-flow-demo-restore");
    await Promise.resolve();
  });
}
async function mount(tab: number, strict = false) {
  activeTab = tab;
  stores[tab] ??= new TabStorage();
  await act(async () => {
    const provider = (
      <WardFlowProvider sharedConnection={{ enabled: false } as WardSharedConnection}>
        <Probe tab={tab} />
      </WardFlowProvider>
    );
    mounted[tab] = render(strict ? <StrictMode>{provider}</StrictMode> : provider);
  });
  await settle();
}
async function deliver(batch: Message[], target?: number) {
  for (const message of batch) {
    for (const channel of channels) {
      if (channel.closed || (target !== undefined && channel.owner !== target)) continue;
      activeTab = channel.owner;
      await act(async () => {
        channel.onmessage?.(message);
      });
    }
    await settle();
  }
}
async function deliverTogether(batch: Message[], target: number) {
  activeTab = target;
  await act(async () => {
    for (const message of batch)
      for (const channel of channels) if (!channel.closed && channel.owner === target) channel.onmessage?.(message);
    await Promise.resolve();
  });
  await settle();
}
function saved(tab: number) {
  return JSON.parse(stores[tab].getItem(WARD_FLOW_DEMO_STORAGE_KEY)!);
}
function takePayloads() {
  const held = messages.filter((message) => message.data.payload);
  messages.length = 0;
  return held;
}
function capacity(tab: number, unitId: string) {
  return current[tab].units.find((unit) => unit.id === unitId)!.allocatable.value;
}
async function change(tab: number, unitId: string, value: number) {
  activeTab = tab;
  const view = current[tab];
  const unit = view.units.find((candidate) => candidate.id === unitId)!;
  await act(async () => {
    const outcome = await view.dispatch({
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: view.now,
      unitId,
      actingUnitId: unitId,
      expectedRevision: unit.allocatable.revision ?? 0,
      value,
    });
    if (!outcome) throw new Error("The synthetic action returned no completion");
    expect(outcome.status).toBe("accepted");
  });
  await settle();
}
async function startPair(strict = false) {
  await mount(0, strict);
  await mount(1, strict);
  messages.length = 0;
  return current[0].units.filter((unit) => unit.empty.value + 2 <= unit.beds).slice(0, 2);
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T02:42:00Z"));
  stores = [];
  channels = [];
  messages = [];
  current = [];
  notices = [];
  mounted = [];
  early = new Map();
  earlySent = new Set();
  Object.defineProperty(window, "sessionStorage", { configurable: true, get: () => stores[activeTab] });
  Object.defineProperty(window, "BroadcastChannel", { configurable: true, writable: true, value: QueuedChannel });
  vi.stubGlobal("BroadcastChannel", QueuedChannel);
});
afterEach(() => {
  for (let tab = 0; tab < mounted.length; tab++) {
    activeTab = tab;
    mounted[tab]?.unmount();
  }
  cleanup();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "sessionStorage", storageDescriptor);
  if (channelDescriptor) Object.defineProperty(window, "BroadcastChannel", channelDescriptor);
  else Reflect.deleteProperty(window, "BroadcastChannel");
  vi.useRealTimers();
});

describe("local demo tab causality", () => {
  it.each([false, true])(
    "keeps both acknowledged disjoint branches and reports conflict, reverse=%s",
    async (reverse) => {
      const [first, second] = await startPair();
      await change(0, first.id, first.empty.value + 1);
      await change(1, second.id, second.empty.value + 1);
      const pending = takePayloads();
      expect(pending).toHaveLength(2);
      await deliver(reverse ? pending.reverse() : pending);
      expect(capacity(0, first.id)).toBe(first.empty.value + 1);
      expect(capacity(1, second.id)).toBe(second.empty.value + 1);
      expect(saved(0).state.units.find((unit: { id: string }) => unit.id === first.id).allocatable.value).toBe(
        first.empty.value + 1,
      );
      expect(saved(1).state.units.find((unit: { id: string }) => unit.id === second.id).allocatable.value).toBe(
        second.empty.value + 1,
      );
      expect(notices[0]).toMatch(/tabs.*differ/i);
      expect(notices[1]).toMatch(/tabs.*differ/i);
      expect(notices[0]).toContain("Save to file");
      expect(notices[0]).toContain("Load from file");
    },
  );

  it("keeps competing changes to the same unit explicit", async () => {
    const [unit] = await startPair();
    await change(0, unit.id, unit.empty.value + 1);
    await change(1, unit.id, unit.empty.value + 2);
    await deliver(takePayloads());
    expect(capacity(0, unit.id)).toBe(unit.empty.value + 1);
    expect(capacity(1, unit.id)).toBe(unit.empty.value + 2);
    expect(notices.every((notice) => /tabs.*differ/i.test(notice ?? ""))).toBe(true);
  });

  it.each([false, true])(
    "converges serial edits and ignores duplicate or late ancestor saves, strict=%s",
    async (strict) => {
      const [first, second] = await startPair(strict);
      await change(0, first.id, first.empty.value + 1);
      const ancestor = takePayloads();
      await deliver(ancestor);
      await change(1, second.id, second.empty.value + 1);
      const descendant = takePayloads();
      await deliver(descendant);
      await deliver([...ancestor, ...descendant]);
      for (const tab of [0, 1]) {
        expect(capacity(tab, first.id)).toBe(first.empty.value + 1);
        expect(capacity(tab, second.id)).toBe(second.empty.value + 1);
        expect(notices[tab] ?? "").not.toMatch(/tabs.*differ/i);
      }
    },
  );

  it("retains the chosen tab's own branch and conflict across reload", async () => {
    const [first, second] = await startPair();
    await change(0, first.id, first.empty.value + 1);
    await change(1, second.id, second.empty.value + 1);
    await deliver(takePayloads());
    activeTab = 0;
    mounted[0].unmount();
    await mount(0);
    expect(capacity(0, first.id)).toBe(first.empty.value + 1);
    expect(notices[0]).toMatch(/tabs.*differ/i);
  });

  it("shows the unresolved fork to a fresh third tab without replacing its first adopted copy", async () => {
    const [first, second] = await startPair();
    await change(0, first.id, first.empty.value + 1);
    await change(1, second.id, second.empty.value + 1);
    const branches = takePayloads();
    await deliver(branches);
    await mount(2);
    await deliver(branches, 2);
    expect(capacity(2, first.id)).toBe(first.empty.value + 1);
    expect(notices[2]).toMatch(/tabs.*differ/i);
  });

  it("keeps the in-memory branch and warns if recording the conflict cannot be saved", async () => {
    const [first, second] = await startPair();
    await change(0, first.id, first.empty.value + 1);
    await change(1, second.id, second.empty.value + 1);
    stores[1].denied = true;
    await deliver(takePayloads());
    expect(capacity(1, second.id)).toBe(second.empty.value + 1);
    expect(notices[1]).toMatch(/storage.*unavailable/i);
    expect(notices[1]).toMatch(/tabs.*differ/i);
  });

  it("compares batched deliveries against the staged world in StrictMode", async () => {
    const [first, second] = await startPair();
    await change(0, first.id, first.empty.value + 1);
    const ancestor = takePayloads();
    await deliver(ancestor, 1);
    await change(1, second.id, second.empty.value + 1);
    const descendant = takePayloads();
    await mount(2, true);
    await deliverTogether([...ancestor, ...descendant], 2);
    expect(capacity(2, first.id)).toBe(first.empty.value + 1);
    expect(capacity(2, second.id)).toBe(second.empty.value + 1);
    expect(notices[2] ?? "").not.toMatch(/tabs.*differ/i);
  });

  it("does not let a second batched fork overwrite the first copy adopted by a fresh tab", async () => {
    const [first, second] = await startPair();
    await change(0, first.id, first.empty.value + 1);
    await change(1, second.id, second.empty.value + 1);
    const branches = takePayloads();
    await mount(2, true);
    await deliverTogether(branches, 2);
    expect(capacity(2, first.id)).toBe(first.empty.value + 1);
    expect(notices[2]).toMatch(/tabs.*differ/i);
  });

  it("extends the restored lineage for an accepted action replayed before adoption", async () => {
    const [first, second] = await startPair();
    await change(0, first.id, first.empty.value + 1);
    const parent = saved(0).sync.head;
    activeTab = 0;
    mounted[0].unmount();
    early.set(0, { unitId: second.id, value: second.empty.value + 1 });
    await mount(0);
    expect(capacity(0, first.id)).toBe(first.empty.value + 1);
    expect(capacity(0, second.id)).toBe(second.empty.value + 1);
    expect(saved(0).sync.head).not.toBe(parent);
    expect(saved(0).sync.ancestors).toContain(parent);
  });

  it("keeps lineage stable for refused actions and ordinary clock ticks", async () => {
    const [unit] = await startPair();
    await change(0, unit.id, unit.empty.value + 1);
    const head = saved(0).sync.head;
    activeTab = 0;
    await act(async () => {
      const view = current[0];
      const held = view.units.find((candidate) => candidate.id === unit.id)!;
      const outcome = await view.dispatch({
        type: "CONFIRM_CAPACITY",
        role: "ward",
        now: view.now,
        unitId: unit.id,
        actingUnitId: unit.id,
        expectedRevision: held.allocatable.revision ?? 0,
        value: unit.beds + 1,
      });
      if (!outcome) throw new Error("The synthetic refusal returned no completion");
      expect(outcome.status).toBe("refused");
      vi.advanceTimersByTime(30_000);
    });
    await settle();
    expect(saved(0).sync.head).toBe(head);
  });

  it("preserves both exports and resolves only through the user's explicit chosen file", async () => {
    const [first, second] = await startPair();
    await change(0, first.id, first.empty.value + 1);
    await change(1, second.id, second.empty.value + 1);
    const oldBranches = takePayloads();
    await deliver(oldBranches);
    const copies = await Promise.all([current[0].saveScenarioFile!(), current[1].saveScenarioFile!()]);
    expect(copies.every((copy) => copy.ok)).toBe(true);
    const chosen = copies[0];
    if (!chosen.ok) throw new Error("Synthetic scenario export failed");
    activeTab = 1;
    mounted[1].unmount();
    activeTab = 0;
    await act(async () => {
      expect(await current[0].loadScenarioFile!(chosen.json)).toEqual({ ok: true });
    });
    await settle();
    expect(notices[0] ?? "").not.toMatch(/tabs.*differ/i);
    expect(saved(0).sync.conflicted).toBeUndefined();
    await deliver(oldBranches, 0);
    expect(notices[0] ?? "").not.toMatch(/tabs.*differ/i);
    expect(capacity(0, first.id)).toBe(first.empty.value + 1);
  });
});
