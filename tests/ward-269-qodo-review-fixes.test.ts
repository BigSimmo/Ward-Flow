import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { bedKindGaps } from "../src/components/ward-management/capacity/capacity-derivations";
import { bedsForecast } from "../src/components/ward-management/capacity/beds-forecast";
import { boundedBedAvailability } from "../src/components/ward-management/ward-ready-beds";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

describe("#269 qodo review, 13 Oct 2026", () => {
  it("bed-kind supply at a ward never exceeds its bounded Ready, even when the feed over-reports allocatable", () => {
    const state = seedWardFlowState();
    for (const unit of state.units) {
      const inflated = { ...unit, allocatable: { ...unit.allocatable, value: unit.beds + 50 } };
      const total = bedKindGaps([], [inflated], NOW).reduce((sum, row) => sum + row.bedsThatFit, 0);
      expect(total, unit.id).toBeLessThanOrEqual(boundedBedAvailability(inflated).available);
    }
  });

  it("a zero-bed ward adds no projected supply: the forecast equals one without that ward", () => {
    const state = seedWardFlowState();
    const releasing = new Set(state.bedReleases.map((release) => release.unitId));
    const target = state.units.find((unit) => releasing.has(unit.id)) ?? state.units[0]!;
    const zeroBed = state.units.map((unit) => (unit.id === target.id ? { ...unit, beds: 0 } : unit));
    const without = state.units.filter((unit) => unit.id !== target.id);
    const withZero = bedsForecast(zeroBed, state.bedReleases, state.admissions, state.movements, NOW);
    const withoutWard = bedsForecast(without, state.bedReleases, state.admissions, state.movements, NOW);
    expect(withZero.horizons.map(({ confirmed, expected }) => [confirmed, expected])).toEqual(
      withoutWard.horizons.map(({ confirmed, expected }) => [confirmed, expected]),
    );
  });

  describe("an ED-raised journey on a ward-sent referral", () => {
    function wardReferralJourney() {
      const state = seedWardFlowState();
      const open = state.movements.find(
        (m) => m.referralId && m.referredUnitIds.length > 0 && !m.acceptedUnitId && !m.closure && !m.sourceAdmissionId,
      )!;
      const sendingUnit = state.units.find((unit) => !open.referredUnitIds.includes(unit.id))!.id;
      return {
        open,
        sendingUnit,
        state: {
          ...state,
          referrals: state.referrals.map((r) =>
            r.id === open.referralId ? { ...r, source: "psychiatric_ward" as const, originUnitId: sendingUnit } : r,
          ),
        },
      };
    }

    it("lets the ED that owns the journey withdraw it", () => {
      const { state, open } = wardReferralJourney();
      const next = wardFlowReducer(state, {
        type: "WITHDRAW_REFERRAL",
        role: "ed",
        actingPlaceId: open.originEdId,
        now: NOW,
        movementId: open.id,
      });
      expect(next.rejections).toEqual(state.rejections);
      expect(next.movements.find((m) => m.id === open.id)!.closure).toBeDefined();
    });

    it("lets the sending ward withdraw it, and refuses another ward or ED", () => {
      const { state, open, sendingUnit } = wardReferralJourney();
      const otherWard = state.units.find((unit) => unit.id !== sendingUnit)!.id;
      for (const [role, place] of [
        ["ward", otherWard],
        ["ed", "another-ed"],
      ] as const) {
        const refused = wardFlowReducer(state, {
          type: "WITHDRAW_REFERRAL",
          role,
          actingPlaceId: place,
          now: NOW,
          movementId: open.id,
        });
        expect(refused.rejections.length, `${role} ${place}`).toBe(state.rejections.length + 1);
      }
      const byWard = wardFlowReducer(state, {
        type: "WITHDRAW_REFERRAL",
        role: "ward",
        actingPlaceId: sendingUnit,
        now: NOW,
        movementId: open.id,
      });
      expect(byWard.rejections).toEqual(state.rejections);
    });
  });
});
