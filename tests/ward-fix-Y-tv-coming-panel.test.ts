import { describe, expect, it } from "vitest";

import { wardTvSheet } from "@/components/ward-management/bed-meeting/tv-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * C16 (design critique v2, Josh 13 Nov 2026): the ward TV said "Coming in 1" and then, in the panel
 * below, "Nobody asked of or accepted for this ward". The headline (D-115, kept) counts stays pulled or
 * waitlisted for the ward; the panel listed only open journeys, so a waitlisted stay with no journey
 * was counted and never listed. Every stay counted in "Coming in" now has a row.
 */
describe("ward TV: the Coming to this ward panel lists everyone the Coming in headline counts", () => {
  const state = seedWardFlowState();
  const sheetFor = (unitId: string, nameOfStay?: (id: string) => string) => {
    const unit = state.units.find((each) => each.id === unitId);
    if (!unit) throw new Error(`no unit ${unitId}`);
    return wardTvSheet({
      ...state,
      unit,
      now: NOW_ANCHOR,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      nameOf: (movement: Movement) => `Journey ${movement.id}`,
      namedHolds: [...state.movements, ...state.referrals],
      nameOfStay,
    });
  };

  it("the seeded waitlisted stay with no journey is listed, named, with no invented wait", () => {
    const stay = state.admissions.find(
      (admission) => admission.state === "waitlisted" && admission.movementId === null,
    );
    expect(stay, "the seed has a waitlisted stay with no journey").toBeDefined();
    if (!stay) return;
    const sheet = sheetFor(stay.unitId, (id) => (id === stay.id ? "Synthetic, Person" : ""));
    expect(sheet.incoming.total).toBeGreaterThan(0);
    const row = sheet.coming.rows.find((each) => each.id === stay.id);
    expect(row).toEqual({
      id: stay.id,
      name: "Synthetic, Person",
      where: "",
      stage: "Waiting, no bed given",
      waitMinutes: null,
    });
  });

  it("without a stay name the row still says who it is for, never a blank", () => {
    const stay = state.admissions.find(
      (admission) => admission.state === "waitlisted" && admission.movementId === null,
    );
    if (!stay) throw new Error("no waitlisted stay in the seed");
    expect(sheetFor(stay.unitId).coming.rows.find((each) => each.id === stay.id)?.name).toBe("Patient for this ward");
  });

  it("on every seeded ward, the panel holds at least the asked and the coming-in counts, and is never empty under a count", () => {
    let checked = 0;
    for (const unit of state.units) {
      const sheet = sheetFor(unit.id);
      const listed = sheet.coming.rows.length + sheet.coming.more;
      expect(listed, unit.id).toBeGreaterThanOrEqual(sheet.askedCount + sheet.incoming.total);
      // A pulled stay and its own journey never print twice.
      const ids = new Set(sheet.coming.rows.map((row) => row.id));
      for (const stay of state.admissions.filter((each) => each.unitId === unit.id && ids.has(each.id))) {
        const journey = state.movements.find((each) => each.id === stay.movementId || each.admissionId === stay.id);
        expect(journey !== undefined && ids.has(journey.id), `${unit.id} ${stay.id}`).toBe(false);
      }
      if (sheet.incoming.total > 0) {
        expect(sheet.coming.rows.length, unit.id).toBeGreaterThan(0);
        checked += 1;
      }
      expect(ids.size, `${unit.id} one row per id`).toBe(sheet.coming.rows.length);
    }
    expect(checked, "several wards have someone coming in").toBeGreaterThan(3);
  });
});
