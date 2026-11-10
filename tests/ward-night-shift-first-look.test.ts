import { describe, expect, it } from "vitest";

import { changesSinceInstant } from "@/components/ward-management/coordinator/since-last-look";
import { nightMovementChanges } from "@/components/ward-management/coordinator/night-movement-changes";
import type { Admission } from "@/components/ward-management/ward-admissions";
import {
  previousShiftStartInstant,
  shiftLookLabel,
  shiftLookWindowStart,
} from "@/components/ward-management/coordinator/shift-first-look";
import { buildHandoverDigest, handoverDigestText } from "@/components/ward-management/handover/handover-digest-model";
import { toHandoverRow } from "@/components/ward-management/handover/handover-model";
import { handoverSinceItems } from "@/components/ward-management/handover/handover-since-items";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

/*
 * Item 11, night shift on the morning look. Synthetic seed world only. The day coordinator's first
 * look at 07:05 covers the night shift from 23:00; a second look covers only the new shift.
 */
const DAY = 24 * 60;
const at = (hours: number, minutes = 0) => DAY + hours * 60 + minutes;
const FIRST_LOOK = at(7, 5);
const SECOND_LOOK = at(7, 40);
const NIGHT_START = DAY - 60; // 23:00 the evening before
const DAY_START = at(7);

const seed = seedWardFlowState();
const template = seed.movements.find(isOpen)!;
// One synthetic journey opened at 00:30 and escalated at 02:00, during the night shift.
const night: Movement = {
  ...template,
  id: "WF-NIGHT-ITEM11",
  openedAt: at(0, 30),
  escalation: { at: at(2), triedUnitIds: [], contact: "Duty consultant" },
};
const movements = [...seed.movements.filter(isOpen), night];
const world = { referrals: [], movements, admissions: seed.admissions, units: seed.units };

// One synthetic absence recorded at 03:00 and one transfer out at 04:00, during the night shift.
const stays = seed.admissions.filter((admission) => admission.state === "occupied");
const absentStay = stays[0]!;
const movedStay: Admission = {
  ...stays[1]!,
  id: "AD-NIGHT-ITEM11",
  state: "departed",
  leftAt: at(4),
  leavingDestination: "transferred-to-a-general-hospital",
};
const absence = {
  admissionId: absentStay.id,
  unitId: absentStay.unitId,
  absentWithoutLeave: { since: at(3), steps: [] },
};
const stayWorld = { admissions: [...seed.admissions, movedStay], leaveBeds: [absence], units: seed.units };

describe("the look window", () => {
  it("starts at the night shift's start on the first look at 07:05", () => {
    expect(previousShiftStartInstant(FIRST_LOOK)).toBe(NIGHT_START);
    expect(shiftLookWindowStart(undefined, FIRST_LOOK)).toBe(NIGHT_START);
    // A look made during the night shift is not a look in the day shift.
    expect(shiftLookWindowStart(at(5), FIRST_LOOK)).toBe(NIGHT_START);
    expect(shiftLookLabel(NIGHT_START, FIRST_LOOK)).toBe("Since last night at 23:00");
  });

  it("covers only the new shift on a second look", () => {
    expect(shiftLookWindowStart(FIRST_LOOK, SECOND_LOOK)).toBe(DAY_START);
    expect(shiftLookLabel(DAY_START, SECOND_LOOK)).toBe("Since 07:00, the start of your shift");
  });

  it("names the earlier shift by name outside the morning", () => {
    expect(shiftLookLabel(previousShiftStartInstant(at(15, 5)), at(15, 5))).toBe(
      "Since 07:00, the start of the day shift",
    );
  });
});

describe("the change list", () => {
  it("lists the night's escalation and journey on the first look, and not on the second", () => {
    const first = changesSinceInstant(world, shiftLookWindowStart(undefined, FIRST_LOOK), FIRST_LOOK);
    expect(first.since).toBe(NIGHT_START);
    expect(first.newEscalationIds).toContain(night.id);
    expect(first.newMovementIds).toContain(night.id);
    const second = changesSinceInstant(world, shiftLookWindowStart(FIRST_LOOK, SECOND_LOOK), SECOND_LOOK);
    expect(second.newEscalationIds).not.toContain(night.id);
    expect(second.newMovementIds).not.toContain(night.id);
  });
});

describe("absences without leave and transfers", () => {
  it("are listed on the first look at 07:05 and not on a second look", () => {
    const first = nightMovementChanges(stayWorld, shiftLookWindowStart(undefined, FIRST_LOOK), FIRST_LOOK);
    expect(first.map((move) => [move.kind, move.admissionId, move.at])).toEqual([
      ["absence", absentStay.id, at(3)],
      ["transfer", movedStay.id, at(4)],
    ]);
    expect(first[1]!.text).toMatch(/^transferred to a general hospital, from /u);
    expect(nightMovementChanges(stayWorld, shiftLookWindowStart(FIRST_LOOK, SECOND_LOOK), SECOND_LOOK)).toEqual([]);
  });
});

describe("the shift digest", () => {
  const rows = movements.map((movement) =>
    toHandoverRow(movement, seed.units, seed.patients, seed.referrals, seed.admissions),
  );
  const itemsFor = (now: number) => (since: number) =>
    handoverSinceItems({
      admissions: seed.admissions,
      wards: seed.units,
      units: seed.units,
      rows,
      scopeKind: "network",
      newSince: since,
      now,
      edDesk: false,
    });
  const digestAt = (now: number, firstLookOfShift: boolean) =>
    buildHandoverDigest({
      now,
      shiftLabel: "Day to evening",
      shiftAt: at(15),
      cutoff: at(15),
      sinceAt: DAY_START,
      scopeLabel: "Whole network",
      sinceItems: itemsFor(now)(DAY_START),
      sinceItemsFor: itemsFor(now),
      firstLookOfShift,
      nightMovesFor: (since: number) => nightMovementChanges(stayWorld, since, now),
      scopedMovements: movements,
      counts: { act: 0, urg: 0, due: 0, bed: 0 },
      beds: null,
      longest: null,
      referrals: seed.referrals,
      units: seed.units,
      admissions: seed.admissions,
    });

  it("reads from the night shift's start on the first read at 07:05", () => {
    const digest = digestAt(FIRST_LOOK, true);
    expect(digest.sinceClock).toBe("23:00 yesterday");
    expect(digest.changed.find((line) => line.id === "escalated")?.value).toBe(1);
    expect(digest.changed.find((line) => line.id === "opened")?.value).toBeGreaterThanOrEqual(1);
    expect(digest.changed.find((line) => line.id === "absent")?.value).toBe(1);
    expect(digest.changed.find((line) => line.id === "transferred")?.value).toBe(1);
  });

  it("reads only the new shift on a later read", () => {
    const digest = digestAt(SECOND_LOOK, false);
    expect(digest.sinceClock).toBe("07:00");
    expect(digest.changed.find((line) => line.id === "escalated")).toBeUndefined();
    expect(digest.changed.find((line) => line.id === "absent")).toBeUndefined();
    expect(digest.changed.find((line) => line.id === "transferred")).toBeUndefined();
  });

  it("keeps a chosen earlier handover's own window", () => {
    const digest = buildHandoverDigest({ ...digestAtInput(), sinceAt: at(3) });
    expect(digest.sinceClock).toBe("03:00");
  });

  it("copies no names or record numbers on the widened read", () => {
    const text = handoverDigestText(digestAt(FIRST_LOOK, true));
    expect(text).toContain("What changed since 23:00 yesterday");
    expect(text).toMatch(/1 absent without leave \(1 /u);
    expect(text).toMatch(/1 transfer out \(1 /u);
    expect(text).not.toContain(movedStay.id);
    for (const patient of seed.patients) {
      for (const name of [patient.familyName, patient.givenName]) expect(text).not.toMatch(new RegExp(`\\b${name}\\b`));
      expect(text).not.toContain(patient.umrn);
    }
    for (const row of rows) {
      expect(text).not.toContain(row.umrn);
      expect(text).not.toContain(row.id);
    }
  });

  function digestAtInput() {
    return {
      now: FIRST_LOOK,
      shiftLabel: "Night to day",
      shiftAt: at(7),
      cutoff: at(15),
      sinceAt: DAY_START,
      scopeLabel: "Whole network",
      sinceItems: itemsFor(FIRST_LOOK)(at(3)),
      sinceItemsFor: itemsFor(FIRST_LOOK),
      firstLookOfShift: true,
      scopedMovements: movements,
      counts: { act: 0, urg: 0, due: 0, bed: 0 },
      beds: null,
      longest: null,
      referrals: seed.referrals,
      units: seed.units,
      admissions: seed.admissions,
    };
  }
});
