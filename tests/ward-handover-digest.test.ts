import { describe, expect, it } from "vitest";

import {
  buildHandoverDigest,
  handoverDigestText,
  type HandoverDigestInput,
} from "@/components/ward-management/handover/handover-digest-model";
import { groupOf, toHandoverRow } from "@/components/ward-management/handover/handover-model";
import { openPromiseCounts } from "@/components/ward-management/handover/handover-open-promises";
import { handoverSinceItems } from "@/components/ward-management/handover/handover-since-items";
import { commitmentsDueBy } from "@/components/ward-management/referrals/referral-commitments-model";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Feature 15, Shift digest. Synthetic seed world only. The digest must read the hero's own figures
 * and its copied text must carry no patient names, record numbers or record ids.
 */
const NOW = NOW_ANCHOR;
const seed = seedWardFlowState();
const rows = seed.movements
  .filter(isOpen)
  .map((movement) => toHandoverRow(movement, seed.units, seed.patients, seed.referrals, seed.admissions));
const cutoff = NOW + 240;
const sinceAt = NOW - 240;
const counts = {
  act: rows.filter((row) => groupOf(row, NOW, cutoff) === "act").length,
  urg: rows.filter((row) => groupOf(row, NOW, cutoff) === "urg").length,
  due: rows.filter((row) => groupOf(row, NOW, cutoff) === "due").length,
  bed: rows.filter((row) => groupOf(row, NOW, cutoff) === "bed").length,
};
const sinceItems = handoverSinceItems({
  admissions: seed.admissions,
  wards: seed.units,
  units: seed.units,
  rows,
  scopeKind: "network",
  newSince: sinceAt,
  now: NOW,
  edDesk: false,
});
const longest = rows.reduce((best, row) => (row.openedAt < best.openedAt ? row : best), rows[0]!);

function input(overrides: Partial<HandoverDigestInput> = {}): HandoverDigestInput {
  return {
    now: NOW,
    shiftLabel: "Day to evening",
    shiftAt: cutoff,
    cutoff,
    sinceAt,
    scopeLabel: "Whole network",
    sinceItems,
    scopedMovements: rows.map((row) => row.movement),
    counts,
    beds: { ready: 4, needed: counts.bed },
    longest: { movementId: longest.id, openedAt: longest.openedAt, place: longest.edShort },
    referrals: seed.referrals,
    units: seed.units,
    admissions: seed.admissions,
    ...overrides,
  };
}

describe("buildHandoverDigest", () => {
  it("reads the hero's counts, replies and since figures", () => {
    const digest = buildHandoverDigest(input());
    const value = (id: string) => digest.pending.find((line) => line.id === id)?.value ?? 0;
    expect(value("act")).toBe(counts.act);
    expect(value("urg")).toBe(counts.urg);
    expect(value("due")).toBe(counts.due);
    expect(value("bed")).toBe(counts.bed);
    expect(value("replies")).toBe(openPromiseCounts(seed.referrals, NOW).total);
    for (const item of sinceItems.filter((entry) => entry.value > 0)) {
      expect(digest.changed.find((line) => line.id === item.id)?.value).toBe(item.value);
    }
  });

  it("lists promises due by handover, at most five, with the rest counted", () => {
    const due = commitmentsDueBy(seed.referrals, cutoff).length;
    expect(due).toBeGreaterThan(0);
    const digest = buildHandoverDigest(input());
    expect(digest.promises.length).toBe(Math.min(5, due));
    expect(digest.promisesMore).toBe(Math.max(0, due - 5));
  });

  it("shows no staff line until a staff count is passed", () => {
    expect(buildHandoverDigest(input()).pending.some((line) => line.id === "staff")).toBe(false);
    expect(buildHandoverDigest(input({ staffRequests: 2 })).pending.find((line) => line.id === "staff")?.value).toBe(2);
    const record = {
      id: "SR-1",
      unitId: seed.units[0]!.id,
      shiftStartAt: NOW - 60,
      count: 2 as const,
      reasons: [],
      requestedAt: NOW - 30,
      requestedBy: "ward" as const,
    };
    const scoped = (wardIds: string[]) =>
      buildHandoverDigest(input({ staffRequestRecords: [record], wardIds })).pending.find(
        (line) => line.id === "staff",
      );
    expect(scoped([record.unitId])?.value).toBe(1);
    expect(scoped([])).toBeUndefined();
  });
});

describe("handoverDigestText", () => {
  it("carries no patient names, record numbers or record ids", () => {
    const text = handoverDigestText(buildHandoverDigest(input()));
    for (const patient of seed.patients) {
      for (const name of [patient.familyName, patient.givenName]) expect(text).not.toMatch(new RegExp(`\\b${name}\\b`));
      expect(text).not.toContain(patient.umrn);
    }
    for (const row of rows) {
      expect(text).not.toContain(row.umrn);
      expect(text).not.toContain(row.id);
    }
    for (const referral of seed.referrals) expect(text).not.toMatch(new RegExp(`\\b${referral.id}\\b`));
    expect(text).toContain("Synthetic demonstration");
  });

  it("says None for each empty group", () => {
    const text = handoverDigestText(
      buildHandoverDigest(
        input({
          sinceItems: [],
          scopedMovements: [],
          counts: { act: 0, urg: 0, due: 0, bed: 0 },
          longest: null,
          referrals: [],
        }),
      ),
    );
    expect(text.match(/^- None$/gm)).toHaveLength(3);
  });
});
