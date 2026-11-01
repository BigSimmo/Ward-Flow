import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ward-management/shell/ward-command-activity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/shell/ward-command-activity")>();
  return { ...actual, deriveCommandActivity: vi.fn(actual.deriveCommandActivity) };
});
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlowClock: vi.fn(actual.useWardFlowClock),
    useWardFlowSelect: vi.fn(actual.useWardFlowSelect),
  };
});

import { ActivityPanel } from "@/components/ward-management/coordinator/activity-panel";
import { LAST_LOOK_STORAGE_KEY } from "@/components/ward-management/coordinator/since-last-look";
import { deriveCommandActivity } from "@/components/ward-management/shell/ward-command-activity";
import {
  useWardFlow,
  useWardFlowClock,
  useWardFlowSelect,
  WardFlowProvider,
} from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

type World = ReturnType<typeof useWardFlow>;
const probe: { world?: World } = {};
function WorldProbe() {
  const world = useWardFlow();
  useEffect(() => {
    probe.world = world;
  }, [world]);
  return null;
}
const onClose = vi.fn();
function Fixture({ open, now = NOW_ANCHOR }: { open: boolean; now?: number }) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WorldProbe />
      <ActivityPanel open={open} now={now} onClose={onClose} />
    </WardFlowProvider>
  );
}
function clearWorkCounts() {
  vi.mocked(deriveCommandActivity).mockClear();
  vi.mocked(useWardFlowClock).mockClear();
  vi.mocked(useWardFlowSelect).mockClear();
}

beforeEach(() => {
  window.sessionStorage.clear();
  probe.world = undefined;
  clearWorkCounts();
});

describe("closed Activity panel performance", () => {
  it("does not subscribe to board or clock inputs or derive activity before opening", () => {
    render(<Fixture open={false} />);
    expect(deriveCommandActivity).not.toHaveBeenCalled();
    expect(useWardFlowClock).not.toHaveBeenCalled();
    expect(useWardFlowSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Activity · Statewide" })).toBeNull();
  });

  it("stops closed work, then recaptures current changes without marking them reviewed", async () => {
    const view = render(<Fixture open />);
    const dialog = await screen.findByRole("dialog", { name: "Activity · Statewide" });
    expect(deriveCommandActivity).toHaveBeenCalled();
    expect(within(dialog).getByRole("tab", { name: /^Changes/u })).toHaveAttribute("aria-selected", "true");
    const stored = window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY);
    view.rerender(<Fixture open={false} />);
    clearWorkCounts();
    const target = probe.world!.movements.find((movement) => !movement.closure && !movement.escalation)!;
    act(() =>
      probe.world!.dispatch({
        type: "RECORD_ESCALATION",
        role: "coordinator",
        now: NOW_ANCHOR,
        movementId: target.id,
        triedUnitIds: [],
        contact: "Synthetic duty contact",
      }),
    );
    view.rerender(<Fixture open={false} now={NOW_ANCHOR + 1} />);
    expect(deriveCommandActivity).not.toHaveBeenCalled();
    expect(useWardFlowClock).not.toHaveBeenCalled();
    expect(useWardFlowSelect).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBe(stored);
    view.rerender(<Fixture open now={NOW_ANCHOR + 1} />);
    const reopened = await screen.findByRole("dialog", { name: "Activity · Statewide" });
    await waitFor(() => expect(within(reopened).getByText("escalated to Synthetic duty contact")).toBeInTheDocument());
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBe(stored);
    fireEvent.click(within(reopened).getByRole("button", { name: /^Mark these \d+ reviewed$/u }));
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).not.toBe(stored);
  });
});
