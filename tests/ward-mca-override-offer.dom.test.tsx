/**
 * M14 (mechanics and clock audit, 14 Nov 2026; D-210 (Josh, 14 Nov 2026)):
 * (a) "Accept anyway, record why" is offered only when every failing check is one a recorded reason
 *     can answer, the engine's own rule;
 * (b) a community team's acceptance does not block a ward's accept or decline;
 * (c) a ward closed to admissions never reads as having a bed on the next-ward list or the ward desk.
 * Built from the audit's reviewer script `zz-audit-placement-community.test.ts`. Synthetic data only.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MatchRow } from "@/components/ward-management/referrals/referral-match-rows";
import {
  CLOSED_TO_ADMISSIONS_LINE,
  referralFit,
  wardStateLine,
} from "@/components/ward-management/ward/ward-referral-fit";
import { sharedReadyLookup } from "@/components/ward-management/ward-bed-states";
import { closureAwareVerdict, deriveNextWardsAfterRefusal } from "@/components/ward-management/ward-derivations";
import {
  eligibility,
  referralEligibility,
  type EligibilityVerdict,
} from "@/components/ward-management/ward-eligibility";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { ReferralAddressing, WardReferralDestination } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR, STANDARD_WARD_SITES, activateWardNetwork } from "@/components/ward-management/ward-sites";

activateWardNetwork(STANDARD_WARD_SITES);

function row(verdict: EligibilityVerdict) {
  const unit = seedWardFlowState().units[0]!;
  render(
    <MatchRow
      candidate={{ unit, verdict }}
      bandText="Band"
      onAccept={() => {}}
      needsGenderPlacement={false}
      now={NOW_ANCHOR}
    />,
  );
  return unit;
}

describe("M14(a): the override is offered only where the engine would take it", () => {
  it("no bed now: no reason select, and says no recorded reason can override it", () => {
    const unit = row({
      eligible: false,
      gates: [
        { gate: "age", pass: true, detail: "Adult" },
        { gate: "allocatable_bed", pass: false, detail: "0 ready" },
      ],
    });
    expect(screen.queryByTestId(`ward-referral-match-override-reason-${unit.id}`)).toBeNull();
    expect(screen.getByTestId(`ward-referral-match-no-override-${unit.id}`).textContent).toBe(
      "No recorded reason can override this.",
    );
  });

  it("a suitability check alone still offers Accept anyway", () => {
    const unit = row({
      eligible: false,
      gates: [
        { gate: "age", pass: false, detail: "Youth unit" },
        { gate: "allocatable_bed", pass: true, detail: "2 ready" },
      ],
    });
    expect(screen.getByTestId(`ward-referral-match-override-reason-${unit.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`ward-referral-match-no-override-${unit.id}`)).toBeNull();
  });
});

describe("M14(b): a community team's acceptance does not block the ward's answer", () => {
  it("a ward that declined may still accept on reassessment after the community team accepted", () => {
    const s = seedWardFlowState("standard");
    const comm = s.referrals.flatMap((r) => r.destinations).find((a) => a.destination.kind === "community_team")!;
    expect(comm, "the standard seed has a community team request to copy").toBeDefined();
    const ready = sharedReadyLookup(s);
    let checked = 0;
    for (const r of s.referrals) {
      const wi = r.destinations.findIndex(
        (a) => a.destination.kind === "psychiatric_ward" && a.state === "queued" && a.withdrawnAt === undefined,
      );
      if (wi < 0) continue;
      const ward = r.destinations[wi]!.destination as WardReferralDestination;
      const unit = s.units.find(
        (u) =>
          !u.isClosed &&
          (ward.unitId ? u.id === ward.unitId : true) &&
          referralEligibility(r, ward, u, NOW_ANCHOR, ready).eligible,
      );
      if (!unit) continue;
      const declined = {
        ...r.destinations[wi]!,
        state: "declined",
        declineReason: "no_suitable_bed",
        decidedAt: NOW_ANCHOR - 30,
      } as ReferralAddressing;
      const community = {
        ...comm,
        state: "accepted",
        decidedAt: NOW_ANCHOR - 10,
        withdrawnAt: undefined,
      } as ReferralAddressing;
      const r2 = {
        ...r,
        destinations: [...r.destinations.slice(0, wi), declined, ...r.destinations.slice(wi + 1), community],
      };
      const s2 = { ...s, referrals: s.referrals.map((x) => (x.id === r.id ? r2 : x)) };
      const s3 = wardFlowReducer(s2, {
        type: "ACCEPT_REFERRAL",
        role: "coordinator",
        now: NOW_ANCHOR,
        referralId: r.id,
        destinationKind: "psychiatric_ward",
        unitId: unit.id,
        reassessment: true,
      } as never);
      const reasons = s3.rejections.slice(s2.rejections.length).map((x) => x.reason);
      expect(reasons.join(" "), r.id).not.toMatch(/already been accepted elsewhere/u);
      expect(reasons, r.id).toEqual([]);
      checked += 1;
      break;
    }
    expect(checked, "a referral with a fitting ward request was found").toBe(1);
  });
});

describe("M14(c): a ward closed to admissions never reads as having a bed", () => {
  it("the next-ward list leaves out a closed ward that would otherwise fit", () => {
    const state = seedWardFlowState("standard");
    const ready = sharedReadyLookup(state);
    const movement = state.movements.find((m) => !m.closure && m.acceptedUnitId === undefined)!;
    const declined = {
      ...movement,
      declines: [...movement.declines, { unitId: "no-such-ward", at: NOW_ANCHOR - 5, reason: undefined }],
    } as typeof movement;
    const open = deriveNextWardsAfterRefusal(declined, state.units, NOW_ANCHOR, ready)!.candidates;
    expect(open.length).toBeGreaterThan(0);
    const target = open[0]!.unit.id;
    const units = state.units.map((u) => (u.id === target ? { ...u, isClosed: true } : u));
    const closed = deriveNextWardsAfterRefusal(declined, units, NOW_ANCHOR, ready)!.candidates;
    expect(closed.map((c) => c.unit.id)).not.toContain(target);
  });

  it("the ward desk's bed check and state line say closed, not a free bed", () => {
    const state = seedWardFlowState("standard");
    const movement = state.movements.find((m) => !m.closure && m.acceptedUnitId === undefined)!;
    const unit = { ...state.units.find((u) => !u.isClosed && u.allocatable.value > 0)!, isClosed: true };
    const verdict = closureAwareVerdict(unit, eligibility(movement, unit, NOW_ANCHOR));
    expect(verdict.gates.find((g) => g.gate === "allocatable_bed")!.pass).toBe(false);
    expect(wardStateLine(referralFit(verdict.gates, unit, NOW_ANCHOR), NOW_ANCHOR, unit)).toBe(
      CLOSED_TO_ADMISSIONS_LINE,
    );
  });
});
