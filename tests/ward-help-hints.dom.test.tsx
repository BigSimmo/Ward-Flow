import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const route = vi.hoisted(() => ({ path: "/ward-flow/capacity", role: "coordinator", toured: true }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
vi.mock("../src/components/ward-management/help/ward-help-store", async (original) => ({
  ...(await original<object>()),
  useTourRole: () => route.role,
  useTourSeen: () => route.toured,
}));
import {
  HELP_HINTS_KEY,
  markHelpHint,
  parseHelpHints,
  WardHelpHints,
} from "../src/components/ward-management/help-content/ward-help-hints";
import { pushSheet, popSheet } from "../src/components/wf/sheet-focus";

beforeEach(() => {
  vi.useFakeTimers();
  route.path = "/ward-flow/capacity";
  route.role = "coordinator";
  route.toured = true;
  localStorage.removeItem(HELP_HINTS_KEY);
  localStorage.removeItem("ward_flow_choice_tour_auto_done");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1700);
  });
}
describe("quiet first-visit Help hints", () => {
  it("stores only known role and topic ids and refuses raw paths or text", () => {
    expect(
      parseHelpHints(
        "coordinator:capacity,ward:ward,coordinator:/ward-flow/patient/TEST-ID,unknown:capacity,ed:ed:extra",
      ),
    ).toEqual(["coordinator:capacity", "ward:ward"]);
    expect(markHelpHint("coordinator", "/ward-flow/patient/TEST-ID")).toBe(false);
    expect(localStorage.getItem(HELP_HINTS_KEY)).toBeNull();
  });
  it("does not interrupt the first tour or an existing modal", async () => {
    route.toured = false;
    const ui = render(<WardHelpHints />);
    await settle();
    expect(screen.queryByTestId("ward-help-hint")).toBeNull();
    route.toured = true;
    pushSheet("synthetic-hint-test");
    try {
      ui.rerender(<WardHelpHints />);
      await settle();
      expect(screen.queryByTestId("ward-help-hint")).toBeNull();
    } finally {
      await act(async () => popSheet("synthetic-hint-test"));
    }
    await settle();
    expect(screen.getByTestId("ward-help-hint")).toBeTruthy();
  });
  it("dismisses once per role/topic without stealing focus or reappearing on remount", async () => {
    const ui = render(
      <>
        <button>Work control</button>
        <WardHelpHints />
      </>,
    );
    screen.getByRole("button", { name: "Work control" }).focus();
    await settle();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Work control" }));
    expect(screen.getByTestId("ward-help-hint").textContent).toContain("Ask for an update");
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    ui.unmount();
    render(<WardHelpHints />);
    await settle();
    expect(screen.queryByTestId("ward-help-hint")).toBeNull();
    expect(localStorage.getItem(HELP_HINTS_KEY)).toBe("coordinator:capacity");
  });
  it("offers later-screen guidance after a declined tour and gives display guidance in Settings", async () => {
    route.toured = false;
    localStorage.setItem("ward_flow_choice_tour_auto_done", "coordinator");
    const ui = render(<WardHelpHints />);
    await settle();
    expect(screen.getByTestId("ward-help-hint")).toBeTruthy();
    route.path = "/ward-flow/settings";
    ui.rerender(<WardHelpHints />);
    await settle();
    expect(screen.getByTestId("ward-help-hint").textContent).toContain("Open Settings, then Display.");
    expect(screen.getByTestId("ward-help-hint").textContent).not.toContain("Change a rule");
  });
  it.each(["coordinator", "ward", "ed", "community", "officer", "bed_manager", "executive", "admin"])(
    "limits legacy declined-tour guidance to the coordinator (role=%s)",
    async (role) => {
      route.path = "/ward-flow/settings";
      route.role = role;
      route.toured = false;
      localStorage.setItem("ward_flow_choice_tour_auto_done", "yes");
      render(<WardHelpHints />);
      await settle();
      expect(screen.queryByTestId("ward-help-hint") !== null).toBe(role === "coordinator");
      expect(localStorage.getItem(HELP_HINTS_KEY)).toBe(role === "coordinator" ? "coordinator:settings" : null);
    },
  );
  it("does not revive an undismissed hint after navigating away and back", async () => {
    const ui = render(<WardHelpHints />);
    await settle();
    expect(screen.getByTestId("ward-help-hint")).toBeTruthy();
    route.path = "/ward-flow/statistics";
    ui.rerender(<WardHelpHints />);
    expect(screen.queryByTestId("ward-help-hint")).toBeNull();
    route.path = "/ward-flow/capacity";
    ui.rerender(<WardHelpHints />);
    expect(screen.queryByTestId("ward-help-hint")).toBeNull();
    await settle();
    expect(screen.queryByTestId("ward-help-hint")).toBeNull();
    expect(localStorage.getItem(HELP_HINTS_KEY)).toBe("coordinator:capacity");
  });
  it("does not revive an undismissed hint after changing role away and back", async () => {
    const ui = render(<WardHelpHints />);
    await settle();
    expect(screen.getByTestId("ward-help-hint")).toBeTruthy();
    route.role = "executive";
    ui.rerender(<WardHelpHints />);
    expect(screen.queryByTestId("ward-help-hint")).toBeNull();
    route.role = "coordinator";
    ui.rerender(<WardHelpHints />);
    expect(screen.queryByTestId("ward-help-hint")).toBeNull();
    await settle();
    expect(screen.queryByTestId("ward-help-hint")).toBeNull();
    expect(localStorage.getItem(HELP_HINTS_KEY)).toBe("coordinator:capacity");
  });
  it("suppresses offers if preference storage cannot be written", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<WardHelpHints />);
    await settle();
    expect(screen.queryByTestId("ward-help-hint")).toBeNull();
  });
  it("waits until the tour/What's new card has closed", async () => {
    const card = document.createElement("section");
    card.dataset.testid = "ward-whats-new";
    document.body.append(card);
    render(<WardHelpHints />);
    await settle();
    expect(screen.queryByTestId("ward-help-hint")).toBeNull();
    await act(async () => card.remove());
    await settle();
    expect(screen.getByTestId("ward-help-hint")).toBeTruthy();
  });
});
