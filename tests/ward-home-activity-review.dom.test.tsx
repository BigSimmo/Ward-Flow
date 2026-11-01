import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardBar } from "@/components/ward-management/shell/ward-bar";
import {
  LAST_LOOK_STORAGE_KEY,
  parseLastLookSnapshot,
  takeLastLookSnapshot,
} from "@/components/ward-management/coordinator/since-last-look";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Home's Activity panel (Home and Activity design, approved by Josh 31 Oct 2026): review is
 * explicit. Opening, switching tabs and closing mark nothing; only "Mark these N reviewed" saves
 * the picture taken when the panel opened, and Undo puts the previous review back. Synthetic seed
 * data only. Since Q99 (Josh, 1 Nov 2026) the panel is the app bar's one Activity panel, so Home is
 * drawn under the real bar and its changes button opens the bar's panel.
 */
const NOW = NOW_ANCHOR;

type World = ReturnType<typeof useWardFlow>;
const probe: { world?: World } = {};
function WorldProbe() {
  const world = useWardFlow();
  useEffect(() => {
    probe.world = world;
  }, [world]);
  return null;
}

function renderHome() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <WorldProbe />
      <WardBar />
      <CoordinatorScreen />
    </WardFlowProvider>,
  );
}

/** A remembered picture one hour into the shift, missing one referral and one ready bed. */
function storeEarlierReview() {
  const state = seedWardFlowState();
  const snapshot = takeLastLookSnapshot(
    {
      scenario: state.scenario,
      referrals: state.referrals,
      movements: state.movements,
      units: state.units,
      bedReleases: state.bedReleases,
      admissions: state.admissions,
    },
    NOW,
    DEFAULT_DUE_SOON_THRESHOLDS,
  );
  const droppedReferral = snapshot.referralIds[snapshot.referralIds.length - 1]!;
  const unitId = Object.keys(snapshot.readyByUnit).find((id) => snapshot.readyByUnit[id]! > 0)!;
  const stored = JSON.stringify({
    ...snapshot,
    at: NOW - 60,
    referralIds: snapshot.referralIds.filter((id) => id !== droppedReferral),
    readyByUnit: { ...snapshot.readyByUnit, [unitId]: snapshot.readyByUnit[unitId]! - 1 },
  });
  window.sessionStorage.setItem(LAST_LOOK_STORAGE_KEY, stored);
  return stored;
}

/** The desktop hero's changes chip (jsdom reports a desktop width). */
const changesChip = () => screen.getByRole("button", { name: /· (Review|Activity)$/u });
const panel = () => screen.getByTestId("ward-bar-activity-sheet");
/** The panel's code loads on demand, so the first open waits for it. */
async function openFromChip() {
  fireEvent.click(changesChip());
  return screen.findByTestId("ward-bar-activity-sheet");
}
const closePanel = () => fireEvent.click(within(panel()).getByRole("button", { name: "Close" }));

describe("Home's Activity panel: explicit review", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    probe.world = undefined;
  });

  it("marks nothing when the panel is opened, its tabs switched and it is closed", async () => {
    const stored = storeEarlierReview();
    renderHome();
    expect(changesChip()).toHaveTextContent(/^2\s*changes since your review at 09:42 · Review$/u);
    await openFromChip();
    expect(within(panel()).getByRole("button", { name: "Mark these 2 reviewed" })).toBeInTheDocument();
    fireEvent.click(within(panel()).getByRole("tab", { name: /Recent activity/u }));
    fireEvent.click(within(panel()).getByRole("tab", { name: /Notices/u }));
    fireEvent.click(within(panel()).getByRole("tab", { name: /Changes/u }));
    closePanel();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBe(stored);
    expect(changesChip()).toHaveTextContent(/^2\s*changes since your review at 09:42 · Review$/u);
  });

  it("copies the changes as handover text: synthetic line first, no names or record numbers", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    storeEarlierReview();
    renderHome();
    await openFromChip();
    fireEvent.click(within(panel()).getByRole("button", { name: "Copy as handover text" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const text = writeText.mock.calls[0]![0];
    const lines = text.split("\n");
    expect(lines[0]).toBe("Synthetic prototype.");
    expect(lines[1]).toBe("Changes since your review at 09:42: 2");
    expect(lines.length, "the copy lists the changes, not just a heading").toBeGreaterThan(3);
    expect(text).not.toMatch(/UM\d{6}/u);
    // Josh (31 Oct 2026): no names in the copy. Every synthetic person's surname stays out of it.
    for (const patient of probe.world!.patients) {
      expect(text).not.toContain(patient.familyName);
    }
    expect(await within(panel()).findByText("Copied as handover text.")).toBeInTheDocument();
  });

  it("saves the picture on Mark reviewed, so the hero count drops to 0, and Undo restores it", async () => {
    const stored = storeEarlierReview();
    renderHome();
    await openFromChip();
    expect(panel()).toHaveTextContent("Since your review at 09:42");
    fireEvent.click(within(panel()).getByRole("button", { name: "Mark these 2 reviewed" }));

    const saved = parseLastLookSnapshot(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY));
    expect(saved?.at).toBe(NOW);
    expect(changesChip()).toHaveTextContent(/^No new changes · Activity$/u);
    expect(within(panel()).getByRole("status")).toHaveTextContent("2 changes to synthetic records reviewed at 10:42");
    expect(within(panel()).queryByRole("button", { name: /^Mark these/u })).toBeNull();

    fireEvent.click(within(panel()).getByRole("button", { name: "Undo" }));
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBe(stored);
    expect(changesChip()).toHaveTextContent(/^2\s*changes since your review at 09:42 · Review$/u);
    expect(within(panel()).getByRole("button", { name: "Mark these 2 reviewed" })).toBeInTheDocument();
  });

  it("Undo of a first review this shift clears it, so lines count from the shift start again", async () => {
    renderHome();
    const firstLabel = changesChip().textContent;
    expect(firstLabel).toMatch(/^\d+\s*changes? since 07:00 · Review$/u);
    await openFromChip();
    expect(panel()).toHaveTextContent("Since 07:00, the start of your shift");
    fireEvent.click(within(panel()).getByRole("button", { name: /^Mark these \d+ reviewed$/u }));
    expect(parseLastLookSnapshot(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY))?.at).toBe(NOW);
    expect(changesChip()).toHaveTextContent(/^No new changes · Activity$/u);

    fireEvent.click(within(panel()).getByRole("button", { name: "Undo" }));
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBeNull();
    expect(changesChip().textContent).toBe(firstLabel);
  });

  it("shows a change that arrives while open as new, and Mark reviewed does not cover it", async () => {
    storeEarlierReview();
    renderHome();
    await openFromChip();
    const markTwo = within(panel()).getByRole("button", { name: "Mark these 2 reviewed" });

    // A synthetic escalation recorded while the panel is open.
    const target = probe.world!.movements.find((movement) => !movement.closure && !movement.escalation)!;
    act(() => {
      probe.world!.dispatch({
        type: "RECORD_ESCALATION",
        role: "coordinator",
        now: probe.world!.now,
        movementId: target.id,
        triedUnitIds: [],
        contact: "Duty psychiatrist",
      });
    });
    expect(probe.world!.movements.find((movement) => movement.id === target.id)?.escalation).toBeDefined();
    expect(
      within(panel()).getByText("1 more change to synthetic records arrived since you opened this"),
    ).toBeInTheDocument();
    // The captured list and its button are unchanged; the hero already counts the arrival.
    expect(markTwo).toHaveAccessibleName("Mark these 2 reviewed");
    expect(changesChip()).toHaveTextContent(/^3\s*changes since your review at 09:42 · Review$/u);

    fireEvent.click(markTwo);
    expect(changesChip()).toHaveTextContent(/^1\s*change since your review at 10:42 · Review$/u);
    const saved = parseLastLookSnapshot(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY));
    expect(saved?.escalatedMovementIds).not.toContain(target.id);
  });
});
