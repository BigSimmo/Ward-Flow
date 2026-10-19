import { describe, expect, it } from "vitest";

import { missedRequestCheck } from "@/components/ward-management/coordinator/missed-requests-check";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "@/components/ward-management/ward-model";

const NOW = 2 * 24 * 60;
const WINDOW = CLINICAL_VALUES.missedRequestWindow.value;

function fixture() {
  const state = seedWardFlowState();
  const base = state.movements[0]!;
  const movement = (id: string, patch: Partial<Movement>): Movement => ({
    ...base,
    id: id as Movement["id"],
    patientId: undefined,
    referralId: undefined,
    stage: "placement_requested",
    stageChanges: [],
    unwinds: [],
    referredUnitIds: [],
    waitlistedUnitIds: undefined,
    acceptedUnitId: undefined,
    heldBedNumber: undefined,
    closure: undefined,
    openedAt: NOW - 10,
    ...patch,
  });
  const check = (movements: Movement[], referrals: Referral[] = []) =>
    missedRequestCheck({ movements, referrals, patients: state.patients, now: NOW });
  return { state, movement, check };
}

describe("missedRequestCheck", () => {
  it("lists an open request with no ward asked once the window has passed", () => {
    const f = fixture();
    const items = f.check([
      f.movement("MV-old", { openedAt: NOW - WINDOW }),
      f.movement("MV-new", { openedAt: NOW - WINDOW + 1 }),
      f.movement("MV-asked", { openedAt: NOW - WINDOW * 3, referredUnitIds: [f.state.units[0]!.id] }),
      f.movement("MV-closed", {
        openedAt: NOW - WINDOW * 3,
        closure: { at: NOW - 5, outcome: "did_not_proceed", reason: "no_longer_required" } as Movement["closure"],
      }),
    ]);
    expect(items.map((item) => item.key)).toEqual(["no_ward_asked:MV-old"]);
    expect(items[0]!.since).toBe(NOW);
  });

  it("lists the same recorded person with two open requests, by the person link only", () => {
    const f = fixture();
    const personId = f.state.patients[0]!.id;
    const items = f.check([
      f.movement("MV-a", { patientId: personId, referredUnitIds: [f.state.units[0]!.id] }),
      f.movement("MV-b", { patientId: personId, referredUnitIds: [f.state.units[1]!.id] }),
      f.movement("MV-c", { referredUnitIds: [f.state.units[1]!.id] }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "two_requests", movementIds: ["MV-a", "MV-b"] });
  });

  it("lists one numbered bed held for two open requests", () => {
    const f = fixture();
    const unitId = f.state.units[0]!.id;
    const held = (id: string, heldBedNumber: number) =>
      f.movement(id, { stage: "pulled", acceptedUnitId: unitId, heldBedNumber, referredUnitIds: [unitId] });
    const items = f.check([held("MV-1", 4), held("MV-2", 4), held("MV-3", 5)]);
    expect(items.map((item) => item.kind)).toEqual(["bed_held_twice"]);
    expect(items[0]!.movementIds).toEqual(["MV-1", "MV-2"]);
  });

  it("lists a bed referral an ED accepted with no bed request raised from it", () => {
    const f = fixture();
    const template = f.state.referrals[0]!;
    const edReferral = (id: string, decidedAt: number): Referral => ({
      ...template,
      id,
      destinations: [
        {
          destination: { kind: "emergency_department", edId: "RPH", purpose: "bed" },
          state: "accepted",
          decidedAt,
        } as Referral["destinations"][number],
      ],
    });
    const items = f.check(
      [f.movement("MV-raised", { referralId: "RF-raised", referredUnitIds: [f.state.units[0]!.id] })],
      [edReferral("RF-missed", NOW - WINDOW), edReferral("RF-raised", NOW - WINDOW), edReferral("RF-recent", NOW - 5)],
    );
    expect(items.map((item) => item.key)).toEqual(["no_bed_request:RF-missed"]);
  });

  it("says nothing on a network where every request is asked and none is doubled", () => {
    const f = fixture();
    expect(f.check([f.movement("MV-ok", { referredUnitIds: [f.state.units[0]!.id] })])).toEqual([]);
  });
});
