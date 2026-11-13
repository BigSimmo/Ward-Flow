// Free the right bed (Josh, 8 Nov 2026): today's planned discharges that free a bed of one type,
// in expected time order only. Synthetic seed data.
import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { BED_KIND_LABEL, bedKindOfBed } from "@/components/ward-management/forecast/forecast-by-kind";
import { dischargesThatFree, freeTheRightBedTitle } from "@/components/ward-management/capacity/free-the-right-bed";
import { dayOf } from "@/components/ward-management/ward-clock";
import type { BedKindId } from "@/components/ward-management/capacity/capacity-derivations";

const KINDS: BedKindId[] = ["locked_adult", "open_adult", "older_adult", "youth"];

describe("dischargesThatFree", () => {
  const now = NOW_ANCHOR;
  const { bedReleases, units, admissions } = seedWardFlowState();

  it("lists only today's undischarged releases of the bed type, in expected time order", () => {
    let total = 0;
    for (const kind of KINDS) {
      const rows = dischargesThatFree(kind, bedReleases, units, admissions, now);
      total += rows.length;
      for (const [index, row] of rows.entries()) {
        const release = bedReleases.find((item) => item.id === row.releaseId)!;
        expect(release.state).not.toBe("discharged");
        expect(dayOf(release.expectedAt)).toBe(dayOf(now));
        const admission = admissions.find((item) => item.id === release.admissionId);
        expect(bedKindOfBed(row.unit, admission)).toBe(kind);
        if (index > 0) expect(row.expectedAt).toBeGreaterThanOrEqual(rows[index - 1]!.expectedAt);
        expect(row.heldUp).toBe(release.blocker);
        expect(row.waitingOn).not.toBe("Nothing outstanding");
      }
    }
    // A16-05: a time already passed today is overdue, not freeing.
    const today = bedReleases.filter(
      (release) =>
        release.state !== "discharged" && release.expectedAt >= now && dayOf(release.expectedAt) === dayOf(now),
    );
    expect(total).toBeGreaterThan(0);
    // Every release freeing today lands under exactly one bed type.
    expect(total).toBe(today.filter((release) => units.some((unit) => unit.id === release.unitId)).length);
  });

  it("carries no patient field", () => {
    for (const kind of KINDS)
      for (const row of dischargesThatFree(kind, bedReleases, units, admissions, now))
        expect(Object.keys(row).sort()).toEqual(
          ["confirmed", "expectedAt", "heldUp", "releaseId", "reportedAt", "unit", "waitingOn"].sort(),
        );
  });

  it("uses the signed-off heading", () => {
    expect(freeTheRightBedTitle(BED_KIND_LABEL.locked_adult)).toBe(
      "Planned discharges that could free a locked adult bed today",
    );
    expect(freeTheRightBedTitle(BED_KIND_LABEL.older_adult)).toBe(
      "Planned discharges that could free an older adult bed today",
    );
  });
});
