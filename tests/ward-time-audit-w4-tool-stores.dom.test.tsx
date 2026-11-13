// Time audit C4 (13 Nov 2026): Tools' Remind me and Call and log entries hold board-clock instants,
// which count from the demo's day 0. An entry kept from an earlier demo day is not read as today's.
import { useEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import {
  addCallLog,
  removeCallLog,
  useCallLog,
  type CallLogEntry,
} from "@/components/ward-management/tools/ward-tool-call-log-store";
import {
  addReminder,
  removeReminder,
  useReminders,
  type Reminder,
} from "@/components/ward-management/tools/ward-tool-remind-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const YESTERDAY = Date.UTC(2026, 10, 11, 16); // Perth midnight, 12 Nov 2026
const TODAY = YESTERDAY + 86_400_000;

let reminders: readonly Reminder[] = [];
let calls: readonly CallLogEntry[] = [];
function Probe() {
  const shownReminders = useReminders();
  const shownCalls = useCallLog();
  useEffect(() => {
    reminders = shownReminders;
    calls = shownCalls;
  }, [shownReminders, shownCalls]);
  return null;
}

afterEach(() => {
  cleanup();
  act(() => {
    for (const reminder of JSON.parse(window.localStorage.getItem("wf-mock-tools-reminders") ?? "[]"))
      removeReminder(reminder.id);
    for (const entry of JSON.parse(window.localStorage.getItem("wf-mock-tools-call-log") ?? "[]"))
      removeCallLog(entry.id);
  });
  window.localStorage.clear();
});

it("shows only this demo day's reminders and calls, and drops an earlier day's on the next save", () => {
  act(() => {
    addReminder({
      kind: "ward",
      targetId: "w1",
      targetLabel: "Ward 3B",
      reason: "Call back",
      dueAt: NOW_ANCHOR + 30,
      dayZero: YESTERDAY,
    });
    addCallLog({ wardId: "w1", wardLabel: "Ward 3B", outcome: "none", at: NOW_ANCHOR, dayZero: YESTERDAY });
  });
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR} initialDayZero={TODAY}>
      <Probe />
    </WardFlowProvider>,
  );
  expect(reminders).toEqual([]);
  expect(calls).toEqual([]);

  act(() => {
    addReminder({
      kind: "ward",
      targetId: "w2",
      targetLabel: "Ward 4A",
      reason: "Check the bed",
      dueAt: NOW_ANCHOR + 60,
      dayZero: TODAY,
    });
    addCallLog({ wardId: "w2", wardLabel: "Ward 4A", outcome: "as-shown", at: NOW_ANCHOR, dayZero: TODAY });
  });
  expect(reminders.map((reminder) => reminder.targetLabel)).toEqual(["Ward 4A"]);
  expect(calls.map((entry) => entry.wardLabel)).toEqual(["Ward 4A"]);
  // The earlier day's entries go from this browser when today's are written.
  expect(window.localStorage.getItem("wf-mock-tools-reminders")).not.toContain("Ward 3B");
  expect(window.localStorage.getItem("wf-mock-tools-call-log")).not.toContain("Ward 3B");
});
