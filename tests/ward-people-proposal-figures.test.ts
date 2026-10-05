import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { hubEntries, networkBeds } from "@/components/ward-management/hub/hub-derivations";
import { isOpen } from "@/components/ward-management/ward-derivations";
import {
  PATIENT_FILTERS,
  filterCounts,
  hubSummary,
  journeyFor,
  matchesText,
  patientRows,
} from "@/components/ward-management/people-proposal/people-proposal-figures";

const state = seedWardFlowState();
const now = 10 * 60 + 42;
const today = new Date("2026-08-15T00:00:00Z");

describe("search and patient redesign proposal figures", () => {
  it("the hub's four bed boxes add up to the network's beds and match networkBeds", () => {
    const entries = hubEntries({
      units: state.units,
      bedReleases: state.bedReleases,
      admissions: state.admissions,
      leaveBeds: state.leaveBeds,
      now,
    });
    const summary = hubSummary(entries);
    expect(summary.boxesTotal).toBe(summary.beds);
    expect(summary.ready).toBe(networkBeds(entries).ready);
    expect(summary.wardsWithReady).toBeLessThanOrEqual(summary.wards);
  });

  it("the patient list is every open journey plus every ED referral awaiting a decision", () => {
    const rows = patientRows({ ...state, now, today });
    const open = state.movements.filter(isOpen).length;
    expect(rows.filter((row) => row.kind === "movement")).toHaveLength(open);
    expect(rows.length).toBe(open + rows.filter((row) => row.kind === "referral").length);
  });

  it("each filter figure is exactly the number of rows the filter shows", () => {
    const rows = patientRows({ ...state, now, today });
    const counts = filterCounts(rows);
    for (const filter of PATIENT_FILTERS) {
      expect(counts[filter.id]).toBe(rows.filter(filter.test).length);
    }
    expect(counts.all).toBe(rows.length);
  });

  it("reads the health service from the site table, never guessing one from a name", () => {
    const rows = patientRows({ ...state, now, today });
    const known = new Set(["North Metro", "East Metro", "South Metro", "WACHS", "CAHS", "Private", "Not recorded"]);
    for (const row of rows) expect(known.has(row.service)).toBe(true);
    const rockingham = rows.find((row) => row.from.startsWith("RGH") || row.from.startsWith("Rockingham"));
    if (rockingham) expect(rockingham.service).toBe("South Metro");
  });

  it("finds a patient's open journey through the sanctioned identity join", () => {
    const journey = journeyFor("PT-001", state);
    expect(journey.patient?.id).toBe("PT-001");
    expect(journey.open).toBe(true);
    expect(journey.movement && isOpen(journey.movement)).toBe(true);
    expect(journeyFor("PT-NOPE", state).movement).toBeUndefined();
  });

  it("text search matches record number and ignores an empty query", () => {
    const rows = patientRows({ ...state, now, today });
    expect(rows.filter((row) => matchesText(row, "   "))).toHaveLength(rows.length);
    const first = rows[0];
    expect(matchesText(first, first.umrn.toLowerCase())).toBe(true);
  });
});
