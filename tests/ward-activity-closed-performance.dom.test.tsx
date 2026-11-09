import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode, useEffect, useRef, type ContextType } from "react";
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
import { SHEET_INERT_MARKER } from "@/components/wf/sheet-focus";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";
import type { SharedActivityAuditEvent } from "@/components/ward-management/ward-shared-client";
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

function CyclingPanel({ open }: { open: boolean }) {
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={returnFocusRef}>Synthetic Activity opener</button>
      <ActivityPanel open={open} onClose={onClose} returnFocusRef={returnFocusRef} />
    </>
  );
}

function StrictFixture({ open }: { open: boolean }) {
  return (
    <StrictMode>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CyclingPanel open={open} />
      </WardFlowProvider>
    </StrictMode>
  );
}

type AuditAccount = NonNullable<ContextType<typeof SharedAccessContext>>;
type AuditReader = () => Promise<SharedActivityAuditEvent[]>;
function auditAccount(actorId: string, readActivityAudit: AuditReader): AuditAccount {
  // This synthetic context exposes only the audit-read seam exercised by the panel.
  const api = { readActivityAudit } as SharedAccessApi & { readActivityAudit: AuditReader };
  return { actorId, api };
}
function AuditFixture({ open, account }: { open: boolean; account: AuditAccount }) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <SharedAccessContext.Provider value={account}>
        <ActivityPanel open={open} onClose={onClose} />
      </SharedAccessContext.Provider>
    </WardFlowProvider>
  );
}

describe("Activity lifetime stress", () => {
  it("balances focus and inert state across twenty StrictMode open-close cycles without recording review", async () => {
    const overflow = document.body.style.overflow;
    const view = render(<StrictFixture open={false} />);
    const opener = screen.getByRole("button", { name: "Synthetic Activity opener" });
    opener.focus();
    const stored = window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY);
    for (let cycle = 0; cycle < 20; cycle += 1) {
      view.rerender(<StrictFixture open />);
      const dialog = await screen.findByRole("dialog", { name: "Activity · Statewide" });
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
      view.rerender(<StrictFixture open={false} />);
      await waitFor(() => expect(opener).toHaveFocus());
      expect(document.body.style.overflow).toBe(overflow);
      expect(document.querySelectorAll(`[${SHEET_INERT_MARKER}="true"]`)).toHaveLength(0);
      expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBe(stored);
    }
    clearWorkCounts();
    view.rerender(<StrictFixture open={false} />);
    expect(deriveCommandActivity).not.toHaveBeenCalled();
    expect(useWardFlowClock).not.toHaveBeenCalled();
    expect(useWardFlowSelect).not.toHaveBeenCalled();
  });

  it("ignores an old actor's late audit reply after close and reopening with a new account", async () => {
    let resolveOld!: (events: SharedActivityAuditEvent[]) => void;
    const oldRead = vi.fn<AuditReader>(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const newRead = vi
      .fn<AuditReader>()
      .mockResolvedValue([
        { sequence: "2", action: "CLOSE_UNIT", outcome: "accepted", committed_at: "2026-11-01T02:00:00Z" },
      ]);
    const oldAccount = auditAccount("synthetic-actor-a", oldRead);
    const newAccount = auditAccount("synthetic-actor-b", newRead);
    const view = render(<AuditFixture open account={oldAccount} />);
    await waitFor(() => expect(oldRead).toHaveBeenCalledTimes(1));
    view.rerender(<AuditFixture open={false} account={oldAccount} />);
    view.rerender(<AuditFixture open={false} account={newAccount} />);
    expect(newRead).not.toHaveBeenCalled();
    view.rerender(<AuditFixture open account={newAccount} />);
    const dialog = await screen.findByRole("dialog", { name: "Activity · Statewide" });
    fireEvent.click(within(dialog).getByRole("tab", { name: /^Recent/u }));
    await waitFor(() => expect(within(dialog).getByText("Close unit.")).toBeInTheDocument());
    await act(async () => {
      resolveOld([
        { sequence: "1", action: "CONFIRM_CAPACITY", outcome: "accepted", committed_at: "2026-11-01T01:00:00Z" },
      ]);
    });
    expect(within(dialog).getByText("Close unit.")).toBeInTheDocument();
    expect(within(dialog).queryByText("Confirm capacity.")).toBeNull();
    expect(newRead).toHaveBeenCalledTimes(1);
    view.rerender(<AuditFixture open={false} account={newAccount} />);
  });

  it("undoes the reopened capture to the saved review from before a closed-time change", async () => {
    const view = render(<Fixture open />);
    let dialog = await screen.findByRole("dialog", { name: "Activity · Statewide" });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Mark these \d+ reviewed$/u }));
    const firstReview = window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY);
    expect(firstReview).not.toBeNull();
    view.rerender(<Fixture open={false} />);
    const target = probe.world!.movements.find((movement) => !movement.closure && !movement.escalation)!;
    act(() =>
      probe.world!.dispatch({
        type: "RECORD_ESCALATION",
        role: "coordinator",
        now: NOW_ANCHOR + 1,
        movementId: target.id,
        triedUnitIds: [],
        contact: "Synthetic later contact",
      }),
    );
    view.rerender(<Fixture open={false} now={NOW_ANCHOR + 1} />);
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBe(firstReview);
    view.rerender(<Fixture open now={NOW_ANCHOR + 1} />);
    dialog = await screen.findByRole("dialog", { name: "Activity · Statewide" });
    expect(within(dialog).getByText("escalated to Synthetic later contact")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark these 1 reviewed" }));
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).not.toBe(firstReview);
    fireEvent.click(within(dialog).getByRole("button", { name: "Undo" }));
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBe(firstReview);
    expect(within(dialog).getByRole("button", { name: "Mark these 1 reviewed" })).toBeInTheDocument();
  });
});
