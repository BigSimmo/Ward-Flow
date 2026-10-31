import { describe, expect, it } from "vitest";

import { buildCensus } from "@/components/ward-management/search/patient-census";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { foldPatientSearchText } from "@/components/ward-management/ward-patients";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
const NOW = 642;
const DAY_ZERO = new Date("2026-10-01T00:00:00+08:00");

function census(state: ReturnType<typeof seedWardFlowState>) {
  return buildCensus({
    movements: state.movements,
    referrals: state.referrals,
    units: state.units,
    patients: state.patients,
    admissions: state.admissions,
    now: NOW,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    dayZero: DAY_ZERO,
  });
}

describe("patient census", () => {
  it("finds a row by the formal name it displays, surname first", () => {
    const rows = census(seedWardFlowState()).rows.filter((row) => row.name.includes(", "));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.searchText).toContain(foldPatientSearchText(row.name));
    }
  });

  it("gives one row per record key", () => {
    const keys = census(seedWardFlowState()).rows.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("shows a ward patient on an open transfer once, as the movement", () => {
    const seed = seedWardFlowState();
    const occupied = seed.admissions.find((admission) => admission.state === "occupied");
    const open = seed.movements.find(isOpen);
    expect(occupied).toBeDefined();
    expect(open).toBeDefined();
    const state = {
      ...seed,
      movements: seed.movements.map((movement) =>
        movement.id === open!.id ? { ...movement, sourceAdmissionId: occupied!.id } : movement,
      ),
    };
    const rows = census(state).rows;
    expect(rows.some((row) => row.key === `adm:${occupied!.id}`)).toBe(false);
    expect(rows.some((row) => row.key === open!.id)).toBe(true);
  });
});

describe("patient census locations and next steps", () => {
  it("shows a ward patient away at ED as at ED, with the ward bed kept", () => {
    const seed = seedWardFlowState();
    const occupied = seed.admissions.find((admission) => admission.state === "occupied")!;
    const state = {
      ...seed,
      admissions: seed.admissions.map((admission) =>
        admission.id === occupied.id ? { ...admission, awayAtEmergencyDepartmentSince: NOW - 30 } : admission,
      ),
    };
    const row = census(state).rows.find((candidate) => candidate.key === `adm:${occupied.id}`);
    expect(row?.where).toBe("At ED");
    expect(row?.whereSub).toMatch(/bed kept$/);
  });

  it("never asks to book transport for a journey that already has a live job", () => {
    const rows = census(seedWardFlowState()).rows;
    const booked = rows.filter((row) => {
      if (row.kind !== "movement") return false;
      const job = seedWardFlowState().movements.find((movement) => movement.id === row.key)?.transport;
      return job !== undefined && job.cancelledAt === undefined;
    });
    expect(booked.length).toBeGreaterThan(0);
    expect(booked.filter((row) => row.next === "Book transport")).toEqual([]);
  });

  it("does not place a journey stopped after collection back at its origin", () => {
    const seed = seedWardFlowState();
    const open = seed.movements.find((movement) => isOpen(movement) && movement.transport !== undefined)!;
    const job = open.transport!;
    const state = {
      ...seed,
      movements: seed.movements.map((movement) =>
        movement.id === open.id
          ? { ...movement, transport: { ...job, collectedAt: NOW - 20, stoppedAt: NOW - 10, cancelledAt: NOW - 10 } }
          : movement,
      ),
    };
    const row = census(state).rows.find((candidate) => candidate.key === open.id);
    expect(row?.where).toBe("Location not recorded");
  });

  it("drops a referral whose every arm was withdrawn", () => {
    const seed = seedWardFlowState();
    const queued = seed.referrals.find((referral) =>
      referral.destinations.some((arm) => arm.state === "queued" && arm.withdrawnAt === undefined),
    )!;
    expect(census(seed).rows.some((row) => row.key === queued.id)).toBe(true);
    const state = {
      ...seed,
      referrals: seed.referrals.map((referral) =>
        referral.id === queued.id
          ? {
              ...referral,
              destinations: referral.destinations.map((arm) =>
                arm.state === "queued" ? { ...arm, withdrawnAt: NOW - 5 } : arm,
              ),
            }
          : referral,
      ),
    };
    expect(census(state).rows.some((row) => row.key === queued.id)).toBe(false);
  });
});

describe("patient census legal status on referral rows (from #1114, 31 Oct 2026)", () => {
  it("shows the referral's recorded legal status instead of Not recorded", () => {
    const seed = seedWardFlowState();
    const referralRow = census(seed).rows.find((row) => row.kind === "referral");
    expect(referralRow, "the seed has no waiting referral, so this proves nothing").toBeDefined();
    const withStatus = {
      ...seed,
      referrals: seed.referrals.map((referral) =>
        referral.id === referralRow!.key
          ? { ...referral, intake: { ...referral.intake, legalStatus: "Voluntary" } }
          : referral,
      ),
    } as typeof seed;
    const row = census(withStatus).rows.find((entry) => entry.key === referralRow!.key)!;
    expect(row.legal).toBe("Voluntary");
    expect(row.legalSub).toBe("On the referral");
  });

  it("says Not recorded only when neither the referral nor the person's record has a status", () => {
    const seed = seedWardFlowState();
    const referralRow = census(seed).rows.find((row) => row.kind === "referral")!;
    const blank = {
      ...seed,
      referrals: seed.referrals.map((referral) =>
        referral.id === referralRow.key
          ? { ...referral, intake: { ...referral.intake, legalStatus: undefined } }
          : referral,
      ),
      patients: seed.patients.map((patient) => ({ ...patient, legalStatus: undefined })),
    } as typeof seed;
    const row = census(blank).rows.find((entry) => entry.key === referralRow.key)!;
    expect(row.legal).toBe("Not recorded");
    expect(row.legalSub).toBe("On the referral");
  });
});
