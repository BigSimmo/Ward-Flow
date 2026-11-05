import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
import { ActivityPanel } from "@/components/ward-management/coordinator/activity-panel";
import { useExplicitReview } from "@/components/ward-management/coordinator/activity-changes";
import { LAST_LOOK_STORAGE_KEY } from "@/components/ward-management/coordinator/since-last-look";
import { useSinceLastLook } from "@/components/ward-management/coordinator/since-last-look-panel";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR as now } from "@/components/ward-management/ward-sites";
import {
  resetWardAccessStoreForTests,
  setWardAccess,
  startAccessPreview,
  endAccessPreview,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";
import type { SharedActivityAuditPage } from "@/components/ward-management/ward-shared-client";
const wrapper = ({ children }: { children: ReactNode }) => (
  <WardFlowProvider initialNow={now}>{children}</WardFlowProvider>
);
beforeEach(() => {
  sessionStorage.clear();
  resetWardAccessStoreForTests();
});
afterEach(() => {
  cleanup();
  setWardFeatureFlagOnDevice("role-access", null);
  resetWardAccessStoreForTests();
  vi.useRealTimers();
});

describe("Activity review boundaries", () => {
  it("keeps a real-desk review unchanged while viewing and reviewing a preview", () => {
    const world = seedWardFlowState();
    const { result } = renderHook(() => useSinceLastLook(world, now, { explicit: true }), { wrapper });
    act(() => result.current.saveReview(result.current.current));
    const before = sessionStorage.getItem(LAST_LOOK_STORAGE_KEY);
    expect(before).not.toBeNull();
    act(() => startAccessPreview({ role: "ward", scope: { kind: "ward", unitIds: [world.units[0]!.id] } }));
    act(() => result.current.saveReview({ ...result.current.current, at: now + 1 }));
    act(() => result.current.saveReview(undefined));
    expect(sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBe(before);
    act(() => endAccessPreview());
    act(() => result.current.saveReview({ ...result.current.current, at: now + 2 }));
    expect(sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).not.toBe(before);
  });
  it("keeps captured changes attached to their original interval across a shift boundary", () => {
    const { result, rerender } = renderHook(({ time }) => useExplicitReview(time), {
      initialProps: { time: now },
      wrapper,
    });
    act(() => result.current.capture());
    const shift = result.current.shiftStart;
    const shown = result.current.shown;
    rerender({ time: now + 24 * 60 });
    expect(result.current.shiftStart).toBe(shift);
    expect(result.current.shown).toBe(shown);
    act(() => result.current.showArrived());
    expect(result.current.shiftStart).not.toBe(shift);
  });
  it("names a scoped Activity desk and omits other ED populations", async () => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "coordinator", scope: { kind: "service", service: "North Metro" } });
    render(
      <WardFlowProvider initialNow={now}>
        <ActivityPanel open initialTab="recent" onClose={() => {}} />
      </WardFlowProvider>,
    );
    expect(await screen.findByRole("dialog", { name: "Activity · Your desk" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Activity · Statewide" })).toBeNull();
    fireEvent.click(screen.getByText("Live tally"));
    const table = await screen.findByRole("table", { name: "Emergency departments" });
    expect(within(table).queryByText("FSH")).toBeNull();
    expect(within(table).getByText("SCGH")).toBeInTheDocument();
  });
});

describe("Activity sparse audit history", () => {
  it("lets a desk continue beyond the bounded sparse scan and retain the expanded result", async () => {
    const readActivityAuditPage = vi.fn<(before?: string) => Promise<SharedActivityAuditPage>>(async (before) => {
      if (before === "980")
        return {
          events: [
            { sequence: "900", action: "CLOSE_UNIT", outcome: "accepted", committed_at: "2026-11-04T12:00:00Z" },
          ],
          complete: true,
          nextCursor: null,
        };
      return { events: [], complete: false, nextCursor: String(Number(before ?? 1000) - 1) };
    });
    const api = { readActivityAuditPage } as unknown as SharedAccessApi;
    render(
      <WardFlowProvider initialNow={now}>
        <SharedAccessContext.Provider value={{ actorId: "synthetic-account", api }}>
          <ActivityPanel open initialTab="recent" onClose={() => {}} />
        </SharedAccessContext.Provider>
      </WardFlowProvider>,
    );
    const more = await screen.findByRole("button", { name: "Load older activity" });
    expect(readActivityAuditPage).toHaveBeenCalledTimes(20);
    fireEvent.click(more);
    expect(await screen.findByText("Close unit.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load older activity" })).toBeNull();
    vi.useFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(readActivityAuditPage).toHaveBeenCalledTimes(21);
    expect(screen.getByText("Close unit.")).toBeInTheDocument();
  });
});
