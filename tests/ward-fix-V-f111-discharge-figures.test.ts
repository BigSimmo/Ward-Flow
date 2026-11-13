// F-111 (Audit 14, area 10): a test that would have caught "after a discharge is recorded the
// Discharges page does not change" (A14-20, part of F-105). The Discharges page counts the live bed
// releases through `groupDischarges` with held-up at any date (`use-discharge-workspace-state.tsx`);
// recording a person's departure must move their release out of what is still to come and into
// "discharged today", on that same count. Synthetic seed records only.
import { describe, expect, it } from "vitest";

import { groupDischarges } from "@/components/ward-management/discharges/discharge-board-model";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/** The four figures the Discharges page's highlight strip prints, from its own grouping call. */
function pageCounts(releases: Parameters<typeof groupDischarges>[0]) {
  const groups = groupDischarges(releases, NOW, { heldUpAnyDate: true });
  return {
    blocked: groups.blocked.length,
    confirmed: groups.confirmed.length,
    expected: groups.expected.length,
    departed: groups["discharged-today"].length,
  };
}

describe("F-111 / A14-20: recording a discharge changes the Discharges page's figures", () => {
  it.each(["confirmed", "expected"] as const)(
    "moves a %s release with a linked person to discharged today",
    (group) => {
      const seed = seedWardFlowState();
      const before = pageCounts(seed.bedReleases);
      const counted = new Set(
        groupDischarges(seed.bedReleases, NOW, { heldUpAnyDate: true })[group].map((release) => release.id),
      );
      const release = seed.bedReleases.find((candidate) => {
        if (!counted.has(candidate.id)) return false;
        const stay = seed.admissions.find((admission) => admission.id === candidate.admissionId);
        return stay?.state === "occupied" && stay.patientId !== null;
      });
      // Anti-vacuity: the seed has a discharge in this group with a linked person.
      expect(release).toBeDefined();
      const stay = seed.admissions.find((admission) => admission.id === release!.admissionId)!;

      const after = wardFlowReducer(seed, {
        type: "RECORD_PATIENT_DISCHARGE",
        role: "ward",
        now: NOW,
        actingUnitId: stay.unitId,
        admissionId: stay.id,
        patientId: stay.patientId!,
        expectedGeneration: seed.worldGeneration,
        expectedRevision: seed.dischargeRevisions[stay.id] ?? 0,
        leavingDestination: "discharged-to-the-community",
      });
      expect(after.rejections).toEqual(seed.rejections);
      expect(after.bedReleases.find((row) => row.id === release!.id)?.state).toBe("discharged");
      expect(pageCounts(after.bedReleases)).toEqual({
        ...before,
        [group]: before[group] - 1,
        departed: before.departed + 1,
      });
    },
  );
});
