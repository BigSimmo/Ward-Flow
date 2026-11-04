import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ward-management/shell/ward-access", () => ({
  useCanOpenHref: () => () => true,
}));
vi.mock("@/components/ward-management/use-ward-nav-counts", () => ({
  useWardNavCounts: () => ({ role: "coordinator", placeId: undefined }),
}));

import { ActivityPanel } from "@/components/ward-management/coordinator/activity-panel";
import { useExplicitReview } from "@/components/ward-management/coordinator/activity-changes";
import { useSinceLastLook } from "@/components/ward-management/coordinator/since-last-look-panel";
import { LAST_LOOK_STORAGE_KEY } from "@/components/ward-management/coordinator/since-last-look";
import { useWardFlow, WardFlowOverride, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  endAccessPreview,
  resetWardAccessStoreForTests,
  setWardAccess,
  startAccessPreview,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";

const state = seedWardFlowState();
function Wrapper({ children }: { children: ReactNode }) {
  return <WardFlowProvider initialNow={NOW_ANCHOR}>{children}</WardFlowProvider>;
}
function ShiftWorld({ children }: { children: ReactNode }) {
  const world = useWardFlow();
  const movement = { ...world.movements[0]!, openedAt: 415, closure: undefined, escalation: undefined };
  return (
    <WardFlowOverride value={{ ...world, movements: [movement], referrals: [], admissions: [] }}>
      {children}
    </WardFlowOverride>
  );
}
function ShiftWrapper({ children }: { children: ReactNode }) {
  return (
    <Wrapper>
      <ShiftWorld>{children}</ShiftWorld>
    </Wrapper>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  resetWardAccessStoreForTests();
  setWardFeatureFlagOnDevice("role-access", true);
});
afterEach(() => {
  cleanup();
  resetWardAccessStoreForTests();
  setWardFeatureFlagOnDevice("role-access", null);
});

describe("consolidated Activity context repairs", () => {
  it("labels the actual scope and omits EDs whose records are withheld", async () => {
    setWardAccess({ role: "coordinator", scope: { kind: "service", service: "East Metro" } });
    render(
      <Wrapper>
        <ActivityPanel open onClose={() => undefined} initialTab="recent" />
      </Wrapper>,
    );
    const panel = screen.getByTestId("home-activity-panel");
    expect(panel).toHaveTextContent("Activity · East Metro");
    fireEvent.click(within(panel).getByText("Live tally"));
    const table = await within(panel).findByRole("table", { name: "Emergency departments" });
    expect(table).toHaveTextContent("RPH");
    expect(table).not.toHaveTextContent("SCGH");
  });

  it("Preview cannot replace or clear the real review baseline, including via a retained callback", () => {
    const { result } = renderHook(() => useSinceLastLook(state, NOW_ANCHOR, { explicit: true }), { wrapper: Wrapper });
    act(() => result.current.markSeen());
    const baseline = window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY);
    expect(baseline).not.toBeNull();
    const realSave = result.current.saveReview;
    act(() => startAccessPreview({ role: "ed", scope: { kind: "ed", edId: "rph-ed" } }));
    expect(result.current.canReview).toBe(false);
    const previewSave = result.current.saveReview;
    act(() => {
      result.current.saveReview(undefined);
      result.current.markSeen();
      realSave({ ...result.current.current, at: NOW_ANCHOR + 10 });
    });
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBe(baseline);
    act(() => endAccessPreview());
    expect(result.current.canReview).toBe(true);
    act(() => previewSave(undefined));
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBe(baseline);
  });

  it("keeps the captured shift basis at 07:00 until the rows are explicitly refreshed", () => {
    const { result, rerender } = renderHook(({ now }) => useExplicitReview(now), {
      initialProps: { now: 419 },
      wrapper: ShiftWrapper,
    });
    act(() => result.current.capture());
    const rows = result.current.shown;
    expect(rows.some((row) => row.at === 415)).toBe(true);
    const originalShift = result.current.shiftStart;
    rerender({ now: 420 });
    expect(result.current.shown).toEqual(rows);
    expect(result.current.shiftStart).toBe(originalShift);
    expect(result.current.shiftStart).not.toBe(420);
    act(() => result.current.showArrived());
    expect(result.current.shiftStart).toBe(420);
    expect(result.current.shown.some((row) => row.at === 415)).toBe(false);
  });
});
