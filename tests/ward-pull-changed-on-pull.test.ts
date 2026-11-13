import { describe, expect, it } from "vitest";

import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { startsAcceptedJourneyAtEd } from "@/components/ward-management/referrals/accepted-awaiting-pull";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { observationAt } from "@/components/ward-management/ward-observation";
import { acceptedAddressing } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";

type RaiseReferral = Extract<WardFlowEvent, { type: "RAISE_REFERRAL" }>;

/**
 * D-191 (Josh, 13 Nov 2026): a change on the pull form stays on the pull, shown as "changed by …"
 * with the desk's role, and never updates the patient record. `RAISE_REFERRAL.changedOnPull` names
 * which facts changed; the pull's own `to: "pulled"` stage change keeps it with its `by` and `at`.
 * Synthetic seed only.
 */
function onePull(state: WardFlowState): { event: RaiseReferral; referralId: string } {
  const [item] = acceptedReferralsAwaitingPull(state.referrals, state.units, state.movements);
  expect(item).toBeDefined();
  const { referral, unitId } = item!;
  const destination = acceptedAddressing(referral)!.destination;
  if (destination.kind !== "psychiatric_ward") throw new Error("seed referral was not accepted at a ward");
  const ed = startsAcceptedJourneyAtEd(referral.source)
    ? allEmergencyDepartments().find((place) => place.siteCode === referral.originSiteCode)
    : undefined;
  const event: RaiseReferral = {
    type: "RAISE_REFERRAL",
    role: "coordinator",
    now: NOW_ANCHOR,
    ...(ed ? { edId: ed.id } : {}),
    referralId: referral.id,
    acceptedUnitId: unitId,
    pullBed: true,
    draft: {
      cohort: referral.ageBand!,
      security: destination.secureBedNeeded ? "Secure" : "Open",
      sex: destination.sex,
      gender: destination.gender,
      highAcuity: destination.highAcuityNursingNeeded === true,
      observation: observationAt("general"),
      legalStatus: "Voluntary",
      legalFormCode: null,
      urgency: referral.urgency,
      atsCategory: referral.atsCategory,
    },
  };
  return { event, referralId: referral.id };
}

/** The state as a save holds it: plain JSON. */
const asSaved = (state: WardFlowState): unknown => JSON.parse(JSON.stringify(state));

function pullEntry(state: WardFlowState, referralId: string) {
  const journey = state.movements.find((movement) => movement.referralId === referralId);
  return { journey, entry: journey?.stageChanges.findLast((change) => change.to === "pulled") };
}

describe("the pull names the facts its desk changed on the pull form (D-191)", () => {
  it("keeps the changed facts on the pull's own stage change, with the desk's role and time", () => {
    const state = seedWardFlowState();
    const { event, referralId } = onePull(state);
    const next = wardFlowReducer(state, { ...event, changedOnPull: ["legalStatus", "observation"] });
    expect(next.rejections).toEqual(state.rejections);
    const { journey, entry } = pullEntry(next, referralId);
    expect(journey?.stage).toBe("pulled");
    expect(entry).toMatchObject({ to: "pulled", by: "coordinator", at: NOW_ANCHOR });
    expect(entry?.changedOnPull).toEqual(["legalStatus", "observation"]);
    // Only the pull entry carries it.
    expect(journey?.stageChanges.filter((change) => change.changedOnPull !== undefined)).toHaveLength(1);
    expect(isValidStoredWardFlowState(asSaved(next))).toBe(true);
  });

  it("changes none of the record's own facts", () => {
    const state = seedWardFlowState();
    const { event, referralId } = onePull(state);
    const plain = wardFlowReducer(state, event);
    const changed = wardFlowReducer(state, { ...event, changedOnPull: ["legalStatus", "legalForm", "observation"] });
    const before = pullEntry(plain, referralId).journey!;
    const after = pullEntry(changed, referralId).journey!;
    expect({ ...after, stageChanges: [] }).toEqual({ ...before, stageChanges: [] });
    expect(changed.referrals).toEqual(plain.referrals);
    expect(changed.admissions).toEqual(plain.admissions);
  });

  it("stores nothing when no change is sent, or the list is empty", () => {
    const state = seedWardFlowState();
    const { event, referralId } = onePull(state);
    for (const sent of [event, { ...event, changedOnPull: [] }]) {
      const next = wardFlowReducer(state, sent);
      const { journey, entry } = pullEntry(next, referralId);
      expect(journey?.stage).toBe("pulled");
      expect(entry).toBeDefined();
      expect(entry && "changedOnPull" in entry).toBe(false);
    }
  });

  it.each([
    ["an unknown fact", ["legalStatus", "diagnosis"]],
    ["a repeated fact", ["observation", "observation"]],
    ["not a list", "legalStatus"],
  ])("refuses %s and starts nothing", (_label, changedOnPull) => {
    const state = seedWardFlowState();
    const { event, referralId } = onePull(state);
    const next = wardFlowReducer(state, { ...event, changedOnPull } as unknown as WardFlowEvent);
    expect(next.movements).toEqual(state.movements);
    expect(next.movements.some((movement) => movement.referralId === referralId)).toBe(false);
    expect(next.rejections).toHaveLength(state.rejections.length + 1);
    expect(next.rejections.at(-1)?.attempted).toBe("RAISE_REFERRAL");
    expect(next.rejections.at(-1)?.reason).toMatch(/pull form/u);
  });

  it("refuses a pull form change on a journey started without the pull", () => {
    const state = seedWardFlowState();
    const { event, referralId } = onePull(state);
    const raiseOnly: RaiseReferral = { ...event, changedOnPull: ["legalForm"] };
    delete raiseOnly.pullBed;
    const next = wardFlowReducer(state, raiseOnly);
    expect(next.movements.some((movement) => movement.referralId === referralId)).toBe(false);
    expect(next.rejections.at(-1)?.reason).toMatch(/only when the bed is pulled/u);
  });

  it("refuses a stored pull entry naming a fact off the list", () => {
    const state = seedWardFlowState();
    const { event, referralId } = onePull(state);
    const next = wardFlowReducer(state, { ...event, changedOnPull: ["legalForm"] });
    const tampered: WardFlowState = {
      ...next,
      movements: next.movements.map((movement) =>
        movement.referralId === referralId
          ? {
              ...movement,
              stageChanges: movement.stageChanges.map((change) =>
                change.to === "pulled" ? { ...change, changedOnPull: ["typed words"] as never } : change,
              ),
            }
          : movement,
      ),
    };
    expect(isValidStoredWardFlowState(asSaved(next))).toBe(true);
    expect(isValidStoredWardFlowState(asSaved(tampered))).toBe(false);
  });
});
