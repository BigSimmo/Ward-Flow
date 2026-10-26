import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * Audit F-05: the downtime pack's "last sync" is the shared workspace's last successful read, not
 * every clock tick while the browser reports online. Synthetic values only.
 */
const world = vi.hoisted(() => ({
  now: 1_000_000,
  online: true,
  shared: { enabled: true, status: "ready", error: null, receivedAt: 0 } as {
    enabled: boolean;
    status: string;
    error: string | null;
    receivedAt?: number;
  },
}));
vi.mock("@/components/ward-management/ward-flow-provider", () => ({
  useWardFlowClock: () => world.now,
  useWardFlowSelect: () => ({
    units: [],
    admissions: [],
    bedReleases: [],
    leaveBeds: [],
    movements: [],
    worldGeneration: 1,
    shared: world.shared,
  }),
}));
vi.mock("@/components/ward-management/use-online-status", () => ({ useOnlineStatus: () => world.online }));
vi.mock("@/components/ward-management/ward-patient-name", () => ({ usePatientOf: () => () => ({}) }));
vi.mock("@/components/ward-management/reports/downtime-pack-context", () => ({
  useDowntimePackAccess: () => ({ owner: null, ready: true }),
}));
vi.mock("@/components/ward-management/reports/use-own-units", () => ({ useOwnUnits: () => [] }));

import { forgetDowntimePack, lastDowntimeSyncAt } from "@/components/ward-management/reports/downtime-pack";
import { useTakeDowntimePack } from "@/components/ward-management/reports/use-take-downtime-pack";

const MINUTE = 60_000;

afterEach(() => {
  cleanup();
  forgetDowntimePack();
  world.now = 1_000_000;
  world.online = true;
  world.shared = { enabled: true, status: "ready", error: null, receivedAt: 0 };
});

describe("downtime pack last sync (shared workspace)", () => {
  it("records the time of a successful read and does not advance while no new read arrives", () => {
    const { rerender } = renderHook(() => useTakeDowntimePack());
    // No read yet: nothing recorded, however long the browser is online.
    expect(lastDowntimeSyncAt(1)).toBeNull();
    world.shared = { ...world.shared, receivedAt: 5 };
    rerender();
    expect(lastDowntimeSyncAt(1)).toBe(1_000_000);
    // The server drops; the browser still says online and the board still says ready until the next
    // refresh fails. The clock moves on, but no read came back.
    world.now += 2 * MINUTE;
    rerender();
    world.now += 3 * MINUTE;
    rerender();
    expect(lastDowntimeSyncAt(1)).toBe(1_000_000);
    // The next successful read moves it on.
    world.shared = { ...world.shared, receivedAt: 6 };
    rerender();
    expect(lastDowntimeSyncAt(1)).toBe(1_000_000 + 5 * MINUTE);
  });

  it("does not record a read while the browser is offline or the board is not ready", () => {
    const { rerender } = renderHook(() => useTakeDowntimePack());
    world.online = false;
    world.shared = { ...world.shared, receivedAt: 7 };
    rerender();
    expect(lastDowntimeSyncAt(1)).toBeNull();
    world.online = true;
    world.shared = { ...world.shared, status: "unavailable", receivedAt: 8 };
    rerender();
    expect(lastDowntimeSyncAt(1)).toBeNull();
  });

  it("without a shared workspace keeps the clock while online, as before", () => {
    world.shared = { enabled: false, status: "ready", error: null };
    const { rerender } = renderHook(() => useTakeDowntimePack());
    expect(lastDowntimeSyncAt(1)).toBe(1_000_000);
    world.now += MINUTE;
    rerender();
    expect(lastDowntimeSyncAt(1)).toBe(1_000_000 + MINUTE);
  });
});
