import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import * as legalClockModule from "@/components/ward-management/ward-legal-clock";
import {
  form3CRefusedAfter3D,
  isArrivalLate,
  leaveBedNeedsOpenWarning,
  ARRIVAL_LATE_AFTER_MINUTES,
  EXPECT_FLAG_INVOLUNTARY_MINUTES,
  EXPECT_FLAG_VOLUNTARY_MINUTES,
  GENDER_MISMATCH_DECLINE_REASON,
  LEAVE_BED_OPEN_WARNING_MINUTES,
  WAITLIST_INSTEAD_OF_DECLINE_REASONS,
} from "@/components/ward-management/ward-legal-clock";
import { expectFlagKindFor } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const HOUR = 60;
const DAY = 24 * HOUR;

// Owner rulings 2026-09-25 (Josh): Ward Flow computes no legal time limit; a form's expiry is only
// ever the typed paper time, shown as not legally checked. The duration, country-extension and
// reminder arithmetic these tests used to pin (computeLegalClock, extendLegalClockForCountry,
// maximumDurationMinutes, reminderOffsetsBeforeExpiry) had no caller outside this file, carried
// wrong durations, and was removed; its old tests went with it. Kept on
// backup/2026-09-25-legal-clock-arithmetic.
describe("ward-legal-clock computes no legal time (owner rulings 2026-09-25)", () => {
  it("exports no duration, extension or reminder arithmetic", () => {
    const exported = Object.keys(legalClockModule);
    for (const removed of [
      "computeLegalClock",
      "extendLegalClockForCountry",
      "maximumDurationMinutes",
      "reminderOffsetsBeforeExpiry",
      "reminderInstants",
    ]) {
      expect(exported, removed).not.toContain(removed);
    }
  });

  it("carries no Act section numbers", () => {
    const source = readFileSync("src/components/ward-management/ward-legal-clock.ts", "utf8");
    expect(source).not.toMatch(/\bs\.\s?\d/);
  });

  it("Form 3C is still refused after Form 3D", () => {
    expect(form3CRefusedAfter3D("3D")).toBe(true);
    expect(form3CRefusedAfter3D("3A")).toBe(false);
  });
});

describe("waitlist and gender decline rules", () => {
  it("exports the decline reasons that waitlist instead of ending the referral", () => {
    expect([...WAITLIST_INSTEAD_OF_DECLINE_REASONS]).toEqual(["no_bed", "bed_pulled_for_earlier_referral"]);
    expect(GENDER_MISMATCH_DECLINE_REASON).toBe("sex_mix");
  });

  it("DECLINE with no_bed waitlists the ward and does not remove the referral", () => {
    const seeded = seedWardFlowState();
    const unit = seeded.units.find((candidate) => candidate.sexDesignation === "Undesignated") ?? seeded.units[0]!;
    const source = seeded.movements.find((movement) => !movement.closure);
    expect(source).toBeDefined();
    const movementId = "WF-WAITLIST-NOBED";
    const movement: Movement = {
      ...source!,
      id: movementId,
      stage: "destination_review",
      referredUnitIds: [unit.id],
      acceptedUnitId: undefined,
      admissionId: undefined,
      declines: [],
      waitlistedUnitIds: undefined,
      closure: undefined,
    };
    const before: WardFlowState = {
      ...seeded,
      movements: [...seeded.movements, movement],
    };
    const after = wardFlowReducer(before, {
      type: "DECLINE",
      role: "ward",
      now: NOW,
      movementId,
      unitId: unit.id,
      reason: "no_bed",
    });
    expect(after.rejections).toEqual([]);
    const updated = after.movements.find((candidate) => candidate.id === movementId)!;
    expect(updated.referredUnitIds).toContain(unit.id);
    expect(updated.waitlistedUnitIds).toEqual([unit.id]);
    expect(updated.closure).toBeUndefined();
    expect(after.notices.some((notice) => notice.kind === "referral_waitlisted")).toBe(true);
  });

  it("DECLINE with sex_mix is refused — gender filters beds, it does not decline", () => {
    const seeded = seedWardFlowState();
    const unit = seeded.units[0]!;
    const source = seeded.movements.find((movement) => !movement.closure)!;
    const movementId = "WF-SEX-MIX-DECLINE";
    const before: WardFlowState = {
      ...seeded,
      movements: [
        ...seeded.movements,
        {
          ...source,
          id: movementId,
          stage: "destination_review",
          referredUnitIds: [unit.id],
          acceptedUnitId: undefined,
          admissionId: undefined,
          declines: [],
          closure: undefined,
        },
      ],
    };
    const after = wardFlowReducer(before, {
      type: "DECLINE",
      role: "ward",
      now: NOW,
      movementId,
      unitId: unit.id,
      reason: "sex_mix",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0]!.reason).toMatch(/Gender mismatch does not decline/i);
    const updated = after.movements.find((candidate) => candidate.id === movementId)!;
    expect(updated.waitlistedUnitIds).toBeUndefined();
    expect(updated.declines).toHaveLength(0);
  });
});

describe("late arrival notices", () => {
  it("isArrivalLate is true more than 60 minutes past estimate before arrival", () => {
    const estimated = NOW - (ARRIVAL_LATE_AFTER_MINUTES + 1);
    expect(isArrivalLate(estimated, "pulled", NOW)).toBe(true);
    expect(isArrivalLate(estimated, "arrived", NOW)).toBe(false);
    expect(isArrivalLate(NOW - 30, "pulled", NOW)).toBe(false);
  });

  it("EVALUATE_ARRIVAL_LATENESS notifies the referrer and the destination ward once", () => {
    const seeded = seedWardFlowState();
    const unit = seeded.units[0]!;
    const source = seeded.movements.find((movement) => movement.originEdId && !movement.closure)!;
    const movementId = "WF-ARRIVAL-LATE";
    const estimated = NOW - 90;
    const before: WardFlowState = {
      ...seeded,
      movements: [
        ...seeded.movements,
        {
          ...source,
          id: movementId,
          stage: "pulled",
          acceptedUnitId: unit.id,
          arrivalDetails: {
            mode: "ambulance",
            estimatedArrivalAt: estimated,
            recordedAt: NOW - 120,
            recordedBy: "ed",
          },
          arrivalLateNotifiedAt: undefined,
          closure: undefined,
        },
      ],
    };
    const after = wardFlowReducer(before, {
      type: "EVALUATE_ARRIVAL_LATENESS",
      role: "coordinator",
      now: NOW,
      movementId,
    });
    expect(after.rejections).toEqual([]);
    const updated = after.movements.find((candidate) => candidate.id === movementId)!;
    expect(updated.arrivalLateNotifiedAt).toBe(NOW);
    expect(after.notices.filter((notice) => notice.kind === "arrival_late_referrer")).toHaveLength(1);
    expect(after.notices.filter((notice) => notice.kind === "arrival_late_ward")).toHaveLength(1);

    const again = wardFlowReducer(after, {
      type: "EVALUATE_ARRIVAL_LATENESS",
      role: "coordinator",
      now: NOW + 10,
      movementId,
    });
    expect(again.notices.filter((notice) => notice.kind === "arrival_late_referrer")).toHaveLength(1);
  });
});

describe("gender pull hard-stop", () => {
  it("refuses pulling a Male referral into a Female-only ward", () => {
    const seeded = seedWardFlowState();
    const femaleOnly = seeded.units.find((unit) => unit.sexDesignation === "Female only");
    expect(femaleOnly, "seed must include a Female-only ward").toBeDefined();
    const source = seeded.movements.find((movement) => !movement.closure)!;
    const movementId = "WF-GENDER-PULL";
    const before: WardFlowState = {
      ...seeded,
      movements: [
        ...seeded.movements,
        {
          ...source,
          id: movementId,
          gender: "Male",
          sex: "Male",
          stage: "accepted_awaiting_bed",
          acceptedUnitId: femaleOnly!.id,
          referredUnitIds: [],
          admissionId: undefined,
          declines: [],
          closure: undefined,
        },
      ],
    };
    const after = wardFlowReducer(before, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId,
      unitId: femaleOnly!.id,
    });
    expect(after.rejections.length).toBeGreaterThan(0);
    expect(after.rejections[0]!.reason).toMatch(/bed designation|gender|no longer suits|Female only/i);
    expect(after.movements.find((candidate) => candidate.id === movementId)!.stage).toBe("accepted_awaiting_bed");
  });
});

describe("leave warning and expect flags", () => {
  it("leave bed warns after 24 hours and does not auto-free", () => {
    expect(LEAVE_BED_OPEN_WARNING_MINUTES).toBe(24 * HOUR);
    expect(leaveBedNeedsOpenWarning(NOW - 24 * HOUR, undefined, NOW)).toBe(true);
    expect(leaveBedNeedsOpenWarning(NOW - 23 * HOUR, undefined, NOW)).toBe(false);
    expect(leaveBedNeedsOpenWarning(NOW - 48 * HOUR, NOW - 1, NOW)).toBe(false);
  });

  it("expect flags fire at 48h voluntary and 7d involuntary", () => {
    expect(EXPECT_FLAG_VOLUNTARY_MINUTES).toBe(48 * HOUR);
    expect(EXPECT_FLAG_INVOLUNTARY_MINUTES).toBe(7 * DAY);
    expect(expectFlagKindFor("Voluntary", NOW - 48 * HOUR, NOW)).toBe("voluntary_48h");
    expect(expectFlagKindFor("Voluntary", NOW - 47 * HOUR, NOW)).toBeNull();
    expect(expectFlagKindFor("Involuntary inpatient", NOW - 7 * DAY, NOW)).toBe("involuntary_7d");
  });
});

describe("legal form written and received through the reducer", () => {
  function movementWithForm(code: string): { before: WardFlowState; movementId: string } {
    const seeded = seedWardFlowState();
    const source = seeded.movements.find((movement) => !movement.closure)!;
    const movementId: `WF-${string}` = `WF-LEGAL-${code}`;
    const before: WardFlowState = {
      ...seeded,
      movements: [
        ...seeded.movements,
        {
          ...source,
          id: movementId,
          legalForm: { code, kind: code === "1A" ? "examination" : undefined },
          legalClock: undefined,
          legalFormReceivedAt: undefined,
          closure: undefined,
        },
      ],
    };
    return { before, movementId };
  }

  it("RECORD_LEGAL_FORM_WRITTEN records the written time and form identity, never a computed clock", () => {
    const { before, movementId } = movementWithForm("1A");
    const after = wardFlowReducer(before, {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "ed",
      now: NOW,
      movementId,
      formCode: "1A",
      writtenAt: NOW,
    });
    expect(after.rejections).toEqual([]);
    const updated = after.movements.find((candidate) => candidate.id === movementId)!;
    expect(updated.formedAt).toBe(NOW);
    expect(updated.legalForm?.code).toBe("1A");
    expect(updated.legalForm?.dueAt).toBeUndefined();
    // Ruling "form end times come from the time written on the form": no statutory deadline is
    // computed by the reducer — `RECORD_LEGAL_FORM_EXPIRY` (typed) is the only `dueAt` writer.
    expect(updated.legalClock).toBeUndefined();
  });

  it("RECORD_LEGAL_FORM_RECEIVED records the receipt instant only, never a computed clock", () => {
    const { before, movementId } = movementWithForm("1A");
    const written = wardFlowReducer(before, {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "ed",
      now: NOW,
      movementId,
      formCode: "1A",
      writtenAt: NOW - 10,
    });
    const after = wardFlowReducer(written, {
      type: "RECORD_LEGAL_FORM_RECEIVED",
      role: "ed",
      now: NOW,
      movementId,
      region: "metro",
    });
    expect(after.rejections).toEqual([]);
    const updated = after.movements.find((candidate) => candidate.id === movementId)!;
    expect(updated.legalFormReceivedAt).toBe(NOW);
    expect(updated.legalClock).toBeUndefined();
  });

  it("RECORD_LEGAL_FORM_WRITTEN refuses Form 3C after 3D", () => {
    const { before, movementId } = movementWithForm("3D");
    const with3D = wardFlowReducer(before, {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "ed",
      now: NOW,
      movementId,
      formCode: "3D",
      writtenAt: NOW,
    });
    expect(with3D.rejections).toEqual([]);
    const after = wardFlowReducer(with3D, {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "ed",
      now: NOW + 1,
      movementId,
      formCode: "3C",
      writtenAt: NOW + 1,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0]!.reason).toMatch(/3C.*3D/i);
  });
});

describe("RELEASE_AND_REOPEN_SEARCH", () => {
  it("releases a held bed and reopens search in one action", () => {
    const seeded = seedWardFlowState();
    const source = seeded.movements.find((movement) => !movement.closure)!;
    const unit = seeded.units.find((candidate) => candidate.allocatable.value > 0)!;
    const existingAdmission = seeded.admissions.find(
      (admission) => admission.state === "pulled" || admission.state === "occupied",
    );
    expect(existingAdmission, "seed must include an admission shape to clone").toBeDefined();
    const movementId = "WF-RELEASE-REOPEN";
    const admissionId = "ADM-RELEASE-REOPEN";
    const before: WardFlowState = {
      ...seeded,
      admissions: [
        ...seeded.admissions,
        {
          ...existingAdmission!,
          id: admissionId,
          unitId: unit.id,
          state: "pulled",
          pulledAt: NOW - 30,
          arrivedAt: null,
        },
      ],
      movements: [
        ...seeded.movements,
        {
          ...source,
          id: movementId,
          stage: "pulled",
          acceptedUnitId: unit.id,
          admissionId,
          pullExpiresAt: NOW + 60,
          referredUnitIds: [],
          closure: undefined,
        },
      ],
      units: seeded.units.map((candidate) =>
        candidate.id === unit.id
          ? {
              ...candidate,
              allocatable: {
                ...candidate.allocatable,
                value: Math.max(0, candidate.allocatable.value - 1),
              },
            }
          : candidate,
      ),
    };
    const after = wardFlowReducer(before, {
      type: "RELEASE_AND_REOPEN_SEARCH",
      role: "coordinator",
      now: NOW,
      movementId,
      actingUnitId: unit.id,
      reason: "patient_no_longer_coming",
    });
    expect(after.rejections).toEqual([]);
    const updated = after.movements.find((candidate) => candidate.id === movementId)!;
    expect(updated.stage).toBe("placement_requested");
    expect(updated.admissionId).toBeUndefined();
    expect(updated.acceptedUnitId).toBeUndefined();
  });
});
