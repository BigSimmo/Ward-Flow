import { describe, expect, it } from "vitest";

import { wardAdmissions, WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { buildIncoming } from "@/components/ward-management/board/ward-board-model";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { withSampleLegalStatusFromForm } from "@/components/ward-management/ward-sample-legal-status";
import { SEEDED_PULL_HOLDS } from "@/components/ward-management/ward-seeded-pull-holds";
import { NOW_ANCHOR, allEmergencyDepartments, allUnits, siteByCode } from "@/components/ward-management/ward-sites";

/**
 * Fix package A2 (Audit 16, 13 Nov 2026): guards for the sample day's generators, so each fault the
 * audit traced to a builder cannot come back unnoticed. Synthetic data only.
 */

const ARRIVAL_PART_DAY_MINUTES = 90;
const minuteOfDay = (at: number) => ((at % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
const isGenerated = (id: string) => /^WF-3\d\d$/.test(id);

describe("A16-12: no two wards share a run of stays", () => {
  it("gives no two wards the same three stays in a row", () => {
    const runs = new Map<string, string>();
    const clashes: string[] = [];
    for (const unit of allUnits()) {
      const stays = wardAdmissions
        .filter((admission) => admission.unitId === unit.id && admission.state === "occupied")
        .map((admission) =>
          Math.round(
            (WARD_ADMISSIONS_ANCHOR - ARRIVAL_PART_DAY_MINUTES - (admission.arrivedAt as number)) / MINUTES_PER_DAY,
          ),
        )
        .filter((days) => days >= 1);
      for (let start = 0; start + 3 <= stays.length; start += 1) {
        const run = stays.slice(start, start + 3).join(",");
        const owner = runs.get(run);
        if (owner !== undefined && owner !== unit.id) clashes.push(`${owner} and ${unit.id}: ${run}`);
        else runs.set(run, unit.id);
      }
    }
    expect(clashes).toEqual([]);
  });
});

describe("A16-19: discharge dates and times", () => {
  const dated = wardAdmissions.filter(
    (admission) => admission.state === "occupied" && admission.expectedDischargeAt !== null,
  );

  it("never puts a past or today's date on the board time, and keeps it in working hours", () => {
    const today = Math.floor(NOW_ANCHOR / MINUTES_PER_DAY);
    const wrong = dated.filter((admission) => {
      const at = admission.expectedDischargeAt as number;
      const day = Math.floor(at / MINUTES_PER_DAY);
      if (day > today) return false;
      if (day === today) return at < NOW_ANCHOR || minuteOfDay(at) > 17 * 60;
      return minuteOfDay(at) < 8 * 60 || minuteOfDay(at) > 17 * 60;
    });
    expect(wrong.map((admission) => admission.id)).toEqual([]);
    const pastTimes = new Set(
      dated
        .filter((admission) => (admission.expectedDischargeAt as number) < NOW_ANCHOR)
        .map((a) => minuteOfDay(a.expectedDischargeAt as number)),
    );
    expect(pastTimes.size).toBeGreaterThan(3);
  });

  it("spreads the week ahead so no one day, or two days in a row, carries the bulk", () => {
    const today = Math.floor(NOW_ANCHOR / MINUTES_PER_DAY);
    const perDay = Array.from(
      { length: 7 },
      (_, offset) =>
        dated.filter(
          (admission) => Math.floor((admission.expectedDischargeAt as number) / MINUTES_PER_DAY) === today + offset + 1,
        ).length,
    );
    const week = perDay.reduce((total, count) => total + count, 0);
    expect(week).toBeGreaterThan(0);
    expect(Math.max(...perDay) / week).toBeLessThanOrEqual(0.25);
    const pairs = perDay.slice(1).map((count, index) => count + perDay[index]!);
    expect(Math.max(...pairs) / week).toBeLessThanOrEqual(0.4);
  });
});

describe("A16-13: every seeded pulled bed is held for a named ED stay", () => {
  const state = seedWardFlowState();
  const hold = defaultWardConfiguration().pullHoldMinutes;

  it("has a pulled stay for every pulled bed, on its ward, for the same person, pulled after reaching ED", () => {
    const pulled = state.admissions.filter((admission) => admission.state === "pulled");
    expect(pulled.length).toBe(SEEDED_PULL_HOLDS.length);
    for (const bed of pulled) {
      const stay = state.movements.find((movement) => movement.admissionId === bed.id);
      expect(stay, `${bed.id} is held for nobody`).toBeDefined();
      expect(stay!.stage).toBe("pulled");
      expect(stay!.acceptedUnitId).toBe(bed.unitId);
      expect(stay!.patientId).toBe(bed.patientId);
      expect(bed.pulledAt as number).toBeGreaterThan(stay!.openedAt);
      const extended = (stay!.pullExtensions ?? []).reduce((total, extension) => total + extension.minutes, 0);
      expect(stay!.pullExpiresAt).toBe((bed.pulledAt as number) + hold + extended);
      // The synthetic acceptance never lands after the bed was pulled.
      if (stay!.acceptedAt !== undefined) expect(stay!.acceptedAt).toBeLessThanOrEqual(bed.pulledAt as number);
    }
  });

  it("shows each seeded pull's limit on the ward board", () => {
    for (const bed of state.admissions.filter((admission) => admission.state === "pulled")) {
      const unit = state.units.find((candidate) => candidate.id === bed.unitId)!;
      const incoming = buildIncoming(unit, state.admissions, state.movements, NOW_ANCHOR).find(
        (row) => row.key === bed.id,
      );
      expect(incoming?.pullExpiresAt, `${bed.id} shows no pull limit`).not.toBeNull();
    }
  });
});

describe("A16-18: generated stages, reasons and trips agree", () => {
  it("never leaves a person who is accepted, pulled, on the road or arrived awaiting a destination response", () => {
    const wrong = wardMovements.filter(
      (movement) =>
        isGenerated(movement.id) &&
        movement.stage !== "placement_requested" &&
        movement.stage !== "destination_review" &&
        movement.blocker === "Awaiting destination response",
    );
    expect(wrong.map((movement) => movement.id)).toEqual([]);
  });

  it("makes a trip between sites longer than a trip within one, and a country trip hours long", () => {
    const eds = allEmergencyDepartments();
    const arrived = wardMovements.filter(
      (movement) =>
        isGenerated(movement.id) && movement.stage === "arrived" && movement.transport?.arrivedAt !== undefined,
    );
    expect(arrived.length).toBeGreaterThan(0);
    for (const movement of arrived) {
      const from = eds.find((ed) => ed.id === movement.originEdId)!.siteCode;
      const to = allUnits().find((unit) => unit.id === movement.acceptedUnitId)!.siteCode;
      const trip = (movement.transport!.arrivedAt as number) - (movement.transport!.collectedAt as number);
      const country = [from, to].some((code) => siteByCode(code)?.service === "WACHS");
      if (from === to) expect(trip).toBeLessThan(15);
      else if (country) expect(trip).toBeGreaterThanOrEqual(180);
      else expect(trip).toBeGreaterThanOrEqual(25);
      expect(movement.transport!.acceptedAt as number).toBeGreaterThan(movement.openedAt);
    }
  });
});

describe("A16-20: planned moves and GP or community referrals sit in working hours", () => {
  const state = seedWardFlowState();

  it("plans every move between 08:00 and 17:00, after now and within two days", () => {
    const planned = state.movements.filter((movement) => movement.plannedMoveAt !== undefined);
    expect(planned.length).toBeGreaterThan(0);
    for (const movement of planned) {
      const at = movement.plannedMoveAt as number;
      expect(minuteOfDay(at), movement.id).toBeGreaterThanOrEqual(8 * 60);
      expect(minuteOfDay(at), movement.id).toBeLessThanOrEqual(17 * 60);
      expect(at).toBeGreaterThan(NOW_ANCHOR);
      expect(at).toBeLessThan(NOW_ANCHOR + 2 * MINUTES_PER_DAY);
    }
  });

  it("raises every GP and community referral between 08:00 and 17:00", () => {
    const wrong = state.referrals.filter(
      (referral) =>
        (referral.source === "gp" || referral.source === "community") &&
        (minuteOfDay(referral.raisedAt) < 8 * 60 || minuteOfDay(referral.raisedAt) > 17 * 60),
    );
    expect(wrong.map((referral) => referral.id)).toEqual([]);
  });
});

describe("D-170 item 4: Form 4A with no examination reads referred for examination", () => {
  it("applies to every sample stay and leaves the 9 Oct 2026 arrival rule alone", () => {
    const state = seedWardFlowState();
    const onFourA = state.movements.filter((movement) => movement.legalForm?.code === "4A" && !movement.examination);
    expect(onFourA.length).toBeGreaterThan(0);
    expect(onFourA.filter((movement) => movement.legalStatus === "Involuntary inpatient").map((m) => m.id)).toEqual([]);
    // Generated arrivals that were referred stay involuntary inpatients, as ruled on 9 Oct 2026.
    expect(
      state.movements
        .filter(
          (movement) => isGenerated(movement.id) && movement.stage === "arrived" && movement.legalForm?.code === "1A",
        )
        .every((movement) => movement.legalStatus === "Involuntary inpatient"),
    ).toBe(true);
  });

  it("changes nothing but that pairing", () => {
    const base = wardMovements.find((movement) => movement.id === "WF-003")!;
    expect(withSampleLegalStatusFromForm(base)).toBe(base);
    const examined = {
      ...base,
      legalForm: { code: "4A", kind: "transport" as const },
      legalStatus: "Involuntary inpatient" as const,
      examination: { at: 1, outcome: "inpatient_order" as const },
    };
    expect(withSampleLegalStatusFromForm(examined).legalStatus).toBe("Involuntary inpatient");
  });
});
