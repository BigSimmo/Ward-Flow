import { describe, expect, it } from "vitest";

import { LEGACY_DECLINE_REASONS, upgradeLegacyDeclineReasons } from "@/components/ward-management/ward-decline-legacy";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  DECLINE_REASONS,
  ED_DECLINE_REASONS,
  MOVEMENT_DECLINE_REASONS,
  REFERRAL_DECLINE_REASONS,
  WARD_ONLY_DECLINE_REASONS,
  type DeclineReason,
  type Movement,
} from "@/components/ward-management/ward-model";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// D-78 (Josh, 21 Oct 2026): one decline list in the coordinator's wording, keeping the ward-only reasons.
describe("the one decline list (D-78)", () => {
  it("is the referral list too, with every reason labelled", () => {
    expect(REFERRAL_DECLINE_REASONS).toBe(DECLINE_REASONS);
    expect(Object.keys(DECLINE_REASON_LABELS).sort()).toEqual([...DECLINE_REASONS].sort());
    for (const reason of WARD_ONLY_DECLINE_REASONS) expect(DECLINE_REASONS).toContain(reason);
    expect(DECLINE_REASONS.at(-1)).toBe("another_reason");
  });

  it("maps every retired ward value onto a member of the list", () => {
    expect(LEGACY_DECLINE_REASONS).toEqual({
      no_bed: "no_suitable_bed",
      sex_mix: "sex_designation_unavailable",
      out_of_catchment: "belongs_to_another_service",
    });
    for (const retired of Object.keys(LEGACY_DECLINE_REASONS)) {
      expect(DECLINE_REASONS as readonly string[]).not.toContain(retired);
    }
  });

  it("offers a ward refusing a movement everything but the sex designation, and an ED none of the ward-only reasons", () => {
    expect(MOVEMENT_DECLINE_REASONS).toEqual(DECLINE_REASONS.filter((r) => r !== "sex_designation_unavailable"));
    for (const reason of WARD_ONLY_DECLINE_REASONS) expect(ED_DECLINE_REASONS).not.toContain(reason);
    expect(ED_DECLINE_REASONS).toEqual(["belongs_to_another_service", "referred_elsewhere", "another_reason"]);
  });
});

describe("saves and events from before the one decline list", () => {
  function savedMovement(reason: string): Movement {
    const source = seedWardFlowState().movements[0]!;
    return {
      ...source,
      id: "WF-LEGACY",
      declines: [{ unitId: "unit-a", at: NOW_ANCHOR - 30, reason: reason as DeclineReason }],
      stageChanges: [
        ...source.stageChanges,
        { at: NOW_ANCHOR - 30, from: "destination_review", to: "destination_review", by: "ward", reason },
      ],
    };
  }

  it("reads each retired value in a saved decline and its stage change as the merged reason", () => {
    for (const [retired, merged] of Object.entries(LEGACY_DECLINE_REASONS)) {
      const upgraded = upgradeLegacyDeclineReasons({ movements: [savedMovement(retired)] });
      expect(upgraded.movements[0]!.declines[0]!.reason).toBe(merged);
      expect(upgraded.movements[0]!.stageChanges.at(-1)!.reason).toBe(merged);
    }
  });

  it("returns a current save as the same object", () => {
    const state = { movements: [savedMovement("acuity_mix")] };
    expect(upgradeLegacyDeclineReasons(state)).toBe(state);
  });

  it("still takes a DECLINE carrying a retired value, recorded as the merged reason", () => {
    const seeded = seedWardFlowState();
    const unit = seeded.units[0]!;
    const source = seeded.movements.find((movement) => !movement.closure)!;
    const movement: Movement = {
      ...source,
      id: "WF-LEGACY-EVENT",
      stage: "destination_review",
      referredUnitIds: [unit.id],
      acceptedUnitId: undefined,
      admissionId: undefined,
      declines: [],
      waitlistedUnitIds: undefined,
      closure: undefined,
    };
    const before: WardFlowState = { ...seeded, movements: [...seeded.movements, movement] };
    const after = wardFlowReducer(before, {
      type: "DECLINE",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: movement.id,
      unitId: unit.id,
      reason: "out_of_catchment" as string as DeclineReason,
    });
    expect(after.rejections).toEqual([]);
    const updated = after.movements.find((candidate) => candidate.id === movement.id)!;
    expect(updated.declines.at(-1)!.reason).toBe("belongs_to_another_service");
  });
});
