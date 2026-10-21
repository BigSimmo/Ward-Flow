import { describe, expect, it } from "vitest";

import { sessionTrends } from "@/components/ward-management/statistics/statistics-session-trends";
import type { EventLogEntry } from "@/components/ward-management/ward-event-log";

/*
 * Fix plan item 6, session-only step (21 Oct 2026): hour by hour counts from this session's event
 * log, checked here against events counted by hand.
 */

const NOW = 10_000 * 60 + 35; // 35 minutes into an hour.
const HOUR = Math.floor(NOW / 60) * 60;

let sequence = 0;
function entry(type: EventLogEntry["type"], now: number | undefined, accepted = true): EventLogEntry {
  return { sequence: sequence++, type, role: "coordinator", now, accepted };
}

describe("sessionTrends", () => {
  it("counts accepted events in each hour, oldest first, and matches a hand count", () => {
    const log = [
      entry("PATIENT_ARRIVED", HOUR + 5),
      entry("PATIENT_ARRIVED", HOUR + 30),
      entry("PATIENT_ARRIVED", HOUR - 60 + 10),
      entry("RECORD_LEAVING", HOUR - 2 * 60),
      entry("RECORD_PATIENT_DISCHARGE", HOUR - 2 * 60 + 59),
      entry("REFER_TO_UNITS", HOUR - 5 * 60),
      entry("RECEIVE_REFERRAL", HOUR + 1),
      entry("DECLINE_REFERRAL", HOUR - 3 * 60 + 15),
      entry("ACCEPT_REFERRAL", HOUR - 4 * 60 + 40),
    ];
    const trends = sessionTrends(log, NOW, 6);
    expect(trends.hours).toEqual([5, 4, 3, 2, 1, 0].map((back) => HOUR - back * 60));
    const counts = Object.fromEntries(trends.rows.map((row) => [row.id, row.counts]));
    expect(counts).toEqual({
      referrals: [1, 0, 0, 0, 0, 1],
      accepted: [0, 1, 0, 0, 0, 0],
      declined: [0, 0, 1, 0, 0, 0],
      arrivals: [0, 0, 0, 0, 1, 2],
      departures: [0, 0, 0, 2, 0, 0],
    });
    expect(trends.counted).toBe(9);
  });

  it("shows the last four hours by default", () => {
    expect(sessionTrends([], NOW).hours).toEqual([3, 2, 1, 0].map((back) => HOUR - back * 60));
  });

  it("counts a ward's acceptance in principle beside a referral acceptance, as Declined counts both kinds", () => {
    const trends = sessionTrends([entry("ACCEPT_IN_PRINCIPLE", HOUR + 5), entry("DECLINE", HOUR + 6)], NOW);
    const counts = Object.fromEntries(trends.rows.map((row) => [row.id, row.total]));
    expect(counts).toMatchObject({ accepted: 1, declined: 1 });
  });

  it("leaves out an event stamped later in the current hour than now", () => {
    const trends = sessionTrends([entry("ACCEPT_REFERRAL", HOUR + 40), entry("ACCEPT_REFERRAL", NOW)], NOW);
    expect(trends.rows.find((row) => row.id === "accepted")?.counts).toEqual([0, 0, 0, 1]);
  });

  it("leaves out refused events, events with no time, other event types and anything outside the hours shown", () => {
    const log = [
      entry("PATIENT_ARRIVED", HOUR + 5, false),
      entry("PATIENT_ARRIVED", undefined),
      entry("SET_DISCHARGE_BARRIER", HOUR + 5),
      entry("PATIENT_ARRIVED", HOUR - 6 * 60),
      entry("PATIENT_ARRIVED", HOUR + 60),
    ];
    expect(sessionTrends(log, NOW, 6).counted).toBe(0);
  });
});
