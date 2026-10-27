import type { BedRelease } from "@/components/ward-management/ward-model";
import type { DischargeDependency, DischargePlanChange, PlannedDischargeDestination } from "./discharge-dependencies";

/**
 * Closing-the-loop package B (24 Oct 2026): AUTHORED SYNTHETIC demo facts, so the discharge
 * dependency list, the weekend and holiday preparation list, "needs checking again" and the
 * confirmation ages each have something to show on the standard scenario. Invented arrangements on
 * seeded stays; no admission field implies them. Times are relative to `anchor` (`NOW_ANCHOR`).
 */
type Logistics = {
  dependencies?: DischargeDependency[];
  plannedDestination?: PlannedDischargeDestination;
  planChanges?: DischargePlanChange[];
};

function seededLogistics(anchor: number, release: BedRelease): Logistics | null {
  const ward = "Ward manager";
  const coordinator = "Bed coordinator";
  switch (release.id) {
    // Expected time moved AFTER pharmacy confirmed: pharmacy needs checking again.
    case "derived-expected-AD-RGHS-07":
      return {
        dependencies: [
          { kind: "pharmacy", owner: "pharmacy", state: "done", at: anchor - 240, by: ward },
          { kind: "transport", owner: "patient_transport", state: "outstanding", at: anchor - 200, by: ward },
          { kind: "community_follow_up", owner: "community_team", state: "outstanding", at: anchor - 190, by: ward },
        ],
        plannedDestination: { leavingDestination: "discharged-to-the-community", at: anchor - 400, by: ward },
        planChanges: [
          {
            fact: "expected_date",
            previousExpectedAt: release.expectedAt - 150,
            expectedAt: release.expectedAt,
            at: anchor - 60,
            by: coordinator,
          },
        ],
      };
    // Destination changed AFTER transport confirmed: transport needs checking again.
    case "derived-expected-AD-SJGA-01":
      return {
        dependencies: [
          { kind: "transport", owner: "patient_transport", state: "done", at: anchor - 300, by: ward },
          { kind: "destination", owner: "social_work", state: "done", at: anchor - 80, by: ward },
          { kind: "pharmacy", owner: "pharmacy", state: "outstanding", at: anchor - 280, by: ward },
        ],
        plannedDestination: { leavingDestination: "moved-to-residential-care", at: anchor - 90, by: ward },
        planChanges: [
          {
            fact: "destination",
            previousLeavingDestination: "discharged-to-the-community",
            leavingDestination: "moved-to-residential-care",
            at: anchor - 90,
            by: ward,
          },
        ],
      };
    // The single recorded blocker stays, with the list beside it.
    case "derived-expected-AD-BTYS-05":
      return {
        dependencies: [
          { kind: "transport", owner: "patient_transport", state: "outstanding", at: anchor - 600, by: ward },
          { kind: "pharmacy", owner: "pharmacy", state: "done", at: anchor - 30, by: ward },
          { kind: "destination", owner: "ward", state: "not_needed", at: anchor - 30, by: ward },
        ],
      };
    case "derived-expected-AD-SCGA-03":
      return {
        dependencies: [
          { kind: "transport", owner: "patient_transport", state: "outstanding", at: anchor - 120, by: coordinator },
          { kind: "community_follow_up", owner: "community_team", state: "done", at: anchor - 500, by: ward },
        ],
      };
    default:
      return null;
  }
}

/** The seeded releases, four of them carrying authored discharge logistics. */
export function withSeededDischargeLogistics(releases: BedRelease[], anchor: number): BedRelease[] {
  return releases.map((release) => {
    const logistics = seededLogistics(anchor, release);
    return logistics ? { ...release, ...logistics } : release;
  });
}
