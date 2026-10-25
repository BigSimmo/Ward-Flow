import { describe, expect, it } from "vitest";
import { validSharedCommand } from "../backend/ward-flow/command-schemas";
import { commandScopeRefusal } from "@/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function fixture() {
  let state = seedWardFlowState();
  const [origin, ...targets] = state.units.slice(0, 5);
  const referral: Referral = {
    ...state.referrals[0],
    source: "psychiatric_ward",
    originUnitId: origin.id,
    originSiteCode: origin.siteCode,
    destinations: targets.map((unit) => ({
      state: "queued",
      destination: {
        kind: "psychiatric_ward",
        unitId: unit.id,
        sex: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    })),
  };
  state = { ...state, referrals: state.referrals.map((row) => (row.id === referral.id ? referral : row)) };
  for (const unit of targets) {
    state = wardFlowReducer(state, {
      type: "REQUEST_REFERRAL_INFORMATION",
      role: "ward",
      now: NOW_ANCHOR,
      referralId: referral.id,
      unitId: unit.id,
      actingUnitId: unit.id,
      needs: ["bloods_or_ecg", "drug_screen"],
    });
  }
  expect(state.rejections).toEqual([]);
  const command = {
    type: "MARK_REFERRAL_INFORMATION_MET",
    role: "ward",
    now: NOW_ANCHOR + 1,
    referralId: referral.id,
    allRequestingWards: true,
    need: "bloods_or_ecg",
  } as const;
  return { state, origin, targets, command };
}

describe("recipient-free sender information supplied", () => {
  it("supplies one category to every current matching request without recipient identifiers", () => {
    const { state, command } = fixture();
    const before = structuredClone(state);
    const next = wardFlowReducer(state, command);
    expect(next.rejections).toEqual([]);
    const referral = next.referrals.find((row) => row.id === command.referralId)!;
    for (const arm of referral.destinations) {
      expect(arm.state).toBe("queued");
      expect(arm.decidedAt).toBeUndefined();
      expect(arm.informationNeeds).toEqual([
        { need: "bloods_or_ecg", at: NOW_ANCHOR, by: "Ward manager", metAt: NOW_ANCHOR + 1, metBy: "Ward manager" },
        { need: "drug_screen", at: NOW_ANCHOR, by: "Ward manager" },
      ]);
    }
    expect(state).toEqual(before);
    expect(Object.keys(command)).not.toContain("wardUnitId");
  });

  it("leaves answered and withdrawn requests closed and preserves the per-recipient command", () => {
    const { state, command, targets } = fixture();
    const referral = state.referrals.find((row) => row.id === command.referralId)!;
    const closed = {
      ...referral,
      destinations: referral.destinations.map((arm, index) =>
        index === 2
          ? {
              ...arm,
              state: "declined" as const,
              decidedAt: NOW_ANCHOR,
              declineReason: "belongs_to_another_service" as const,
            }
          : index === 3
            ? { ...arm, withdrawnAt: NOW_ANCHOR }
            : arm,
      ),
    };
    const source = { ...state, referrals: state.referrals.map((row) => (row.id === referral.id ? closed : row)) };
    const one = wardFlowReducer(source, {
      type: command.type,
      role: command.role,
      now: command.now,
      referralId: command.referralId,
      wardUnitId: targets[0].id,
      need: command.need,
    });
    expect(one.rejections).toEqual([]);
    const next = wardFlowReducer(one, command);
    expect(next.rejections).toEqual([]);
    const arms = next.referrals.find((row) => row.id === referral.id)!.destinations;
    expect(arms[0].informationNeeds?.[0].metAt).toBe(command.now);
    expect(arms[1].informationNeeds?.[0].metAt).toBe(command.now);
    expect(arms[2]).toEqual(closed.destinations[2]);
    expect(arms[3]).toEqual(closed.destinations[3]);
  });

  it("refuses a stale category generically without disclosing any recipient", () => {
    const { state, command, targets } = fixture();
    const once = wardFlowReducer(state, command);
    const again = wardFlowReducer(once, command);
    expect(again.rejections).toHaveLength(1);
    const refusal = JSON.stringify(again.rejections.at(-1));
    for (const unit of targets) expect(refusal).not.toContain(unit.id);
    expect(again.referrals).toEqual(once.referrals);
  });

  it("keeps the existing full-source sender boundary and bed-manager refusal", () => {
    const { state, command, origin, targets } = fixture();
    const options = { now: NOW_ANCHOR, places: wardPlaceLookup(state.units) };
    expect(
      commandScopeRefusal(state, { role: "ward", scope: { kind: "ward", unitIds: [origin.id] } }, command, options),
    ).toBeNull();
    expect(
      commandScopeRefusal(state, { role: "ward", scope: { kind: "ward", unitIds: [targets[0].id] } }, command, options),
    ).not.toBeNull();
    expect(validSharedCommand({ ...command, role: "bed_manager" })).toBe(false);
  });

  it("validates exactly one target shape and the existing fixed information vocabulary", () => {
    const { command, targets } = fixture();
    expect(validSharedCommand(command)).toBe(true);
    const legacy: Record<string, unknown> = { ...command };
    delete legacy.allRequestingWards;
    expect(validSharedCommand({ ...legacy, wardUnitId: targets[0].id })).toBe(true);
    for (const invalid of [
      legacy,
      { ...command, wardUnitId: targets[0].id },
      { ...command, allRequestingWards: false },
      { ...command, allRequestingWards: "all" },
      { ...command, need: "unknown" },
    ])
      expect(validSharedCommand(invalid)).toBe(false);
  });
});
