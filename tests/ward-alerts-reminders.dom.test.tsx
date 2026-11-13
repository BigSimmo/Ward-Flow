import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlertsRemindersGroup } from "@/components/ward-management/alerts/alerts-reminders-group";
import { addReminder, removeReminder } from "@/components/ward-management/tools/ward-tool-remind-store";
import type { Instant } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const now = NOW_ANCHOR as Instant;
const HOUR = 60;

afterEach(() => {
  // The store keeps reminders in memory as well as in this browser, so empty both.
  const saved: { id: string }[] = JSON.parse(window.localStorage.getItem("wf-mock-tools-reminders") ?? "[]");
  act(() => {
    for (const reminder of saved) removeReminder(reminder.id);
  });
  window.localStorage.clear();
});

describe("Alerts shows due Remind me reminders", () => {
  it("lists only reminders that are due, and Done clears one", () => {
    act(() => {
      addReminder({
        kind: "ward",
        targetId: "w1",
        targetLabel: "Ward 3B",
        reason: "Call back",
        dueAt: (now - HOUR) as Instant,
        dayZero: 0,
      });
      addReminder({
        kind: "ward",
        targetId: "w2",
        targetLabel: "Ward 4A",
        reason: "Check the bed",
        dueAt: (now + HOUR) as Instant,
        dayZero: 0,
      });
    });
    render(<AlertsRemindersGroup now={now} />);
    const group = screen.getByRole("region", { name: "Your reminders" });
    expect(within(group).getByText("Call back")).toBeTruthy();
    expect(within(group).getByText("Ward 3B")).toBeTruthy();
    expect(within(group).queryByText("Ward 4A")).toBeNull();

    fireEvent.click(within(group).getByRole("button", { name: /^Done: Call back, Ward 3B/u }));
    expect(screen.queryByRole("region", { name: "Your reminders" })).toBeNull();
  });

  it("shows nothing when no reminder is due", () => {
    act(() => {
      addReminder({
        kind: "ward",
        targetId: "w2",
        targetLabel: "Ward 4A",
        reason: "Check the bed",
        dueAt: (now + HOUR) as Instant,
        dayZero: 0,
      });
    });
    const { container } = render(<AlertsRemindersGroup now={now} />);
    expect(container.textContent).toBe("");
  });
});
