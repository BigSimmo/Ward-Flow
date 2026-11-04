// tests/ward-home-outlook.test.ts
//
// WH3 (Josh, 4 Nov 2026): Ward home's Tomorrow card is the Capacity bed forecast run on one ward.
// Hand-built synthetic records, as in ward-beds-forecast.test.ts, so each figure can be reached alone.
import { describe, expect, it } from "vitest";

import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import type { Admission, PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import type { BedRelease, Movement } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import {
  outlookHeadline,
  outlookPlannedLaterNote,
  outlookSentence,
  wardTomorrowOutlook,
  type WardTomorrowOutlook,
} from "@/components/ward-management/ward/ward-home-outlook";

const NOW = NOW_ANCHOR;
const [unit, other] = allUnits().filter((candidate) => !candidate.isClosed);

let nextId = 0;
function release(overrides: Partial<BedRelease>): BedRelease {
  nextId += 1;
  return {
    id: `WR-WH3-${nextId}`,
    unitId: unit!.id,
    admissionId: `AD-WH3-${nextId}`,
    state: "expected",
    expectedAt: NOW + 120,
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW,
    confirmedBy: "NUM Test Unit",
    ...overrides,
  };
}

const occupied = wardAdmissions.find((admission) => admission.state === "occupied")!;
function admission(overrides: Partial<Admission>): Admission {
  return { ...occupied, unitId: unit!.id, expectedDischargeAt: null, ...overrides } as Admission;
}

function acceptedFor(id: string): Movement {
  return {
    ...wardMovements[0],
    id,
    closure: undefined,
    stage: "accepted_awaiting_bed",
    admissionId: undefined,
    allocatedBed: undefined,
    patientId: undefined,
  } as Movement;
}

function booking(overrides: Partial<PlannedAdmission>): PlannedAdmission {
  return {
    id: `PA-WH3-${(nextId += 1)}`,
    state: "booked",
    unitId: unit!.id,
    expectedArrivalAt: NOW + 240,
    patientId: null,
    ...overrides,
  } as PlannedAdmission;
}

describe("wardTomorrowOutlook (WH3)", () => {
  it("counts only this ward's records and matches the forecast run on the ward alone", () => {
    const mine = [release({ state: "confirmed" }), release({})];
    const theirs = release({ unitId: other!.id });
    const stays = [...mine, theirs].map((entry) =>
      admission({ id: entry.admissionId, unitId: entry.unitId, expectedDischargeAt: NOW + 120 }),
    );
    const outlook = wardTomorrowOutlook(unit!, [...mine, theirs], stays, [], [], NOW)!;
    const own = bedsForecast([unit!], mine, stays.slice(0, 2), [], NOW).horizons[0]!;
    expect(outlook).toMatchObject({ likely: own.likely, low: own.low, high: own.high, until: own.until });
    expect(outlook.likelyOut).toBe(2);
    expect(outlook.unconfirmed).toBe(1);
    expect(outlook.bookedIn).toBe(0);
  });

  it("subtracts people accepted for this ward and this ward's booked admissions", () => {
    const base = wardTomorrowOutlook(unit!, [], [], [], [], NOW)!;
    const outlook = wardTomorrowOutlook(
      unit!,
      [],
      [],
      [acceptedFor("MV-WH3-1")],
      [booking({}), booking({ unitId: other!.id }), booking({ expectedArrivalAt: NOW + 3 * 24 * 60 })],
      NOW,
    )!;
    expect(outlook.bookedIn).toBe(2);
    expect(outlook.likely).toBe(base.likely - 2);
  });

  it("counts a planned date with no release flagged as not flagged, best case only", () => {
    const outlook = wardTomorrowOutlook(unit!, [], [admission({ expectedDischargeAt: NOW + 60 })], [], [], NOW)!;
    expect(outlook.notFlagged).toBe(1);
    expect(outlook.high - outlook.likely).toBe(1);
  });

  it("counts discharges flagged for today whose stay is now planned after tomorrow", () => {
    const movedOn = release({ expectedAt: NOW });
    const stillToday = release({ expectedAt: NOW, state: "confirmed" });
    const held = release({ expectedAt: NOW, blocker: "Awaiting clean" });
    const theirs = release({ expectedAt: NOW, unitId: other!.id });
    const stays = [
      admission({ id: movedOn.admissionId, expectedDischargeAt: NOW + 3 * 24 * 60 }),
      admission({ id: stillToday.admissionId, expectedDischargeAt: NOW + 30 }),
      admission({ id: held.admissionId, expectedDischargeAt: NOW + 3 * 24 * 60 }),
      admission({ id: theirs.admissionId, unitId: other!.id, expectedDischargeAt: NOW + 3 * 24 * 60 }),
    ];
    const outlook = wardTomorrowOutlook(unit!, [movedOn, stillToday, held, theirs], stays, [], [], NOW)!;
    expect(outlook.flaggedTodayPlannedLater).toBe(1);
    expect(outlook.likelyOut).toBe(1);
  });

  it("is 0 when every discharge flagged for today still falls by tomorrow", () => {
    const today = release({ expectedAt: NOW });
    const stays = [admission({ id: today.admissionId, expectedDischargeAt: NOW + 30 })];
    expect(wardTomorrowOutlook(unit!, [today], stays, [], [], NOW)!.flaggedTodayPlannedLater).toBe(0);
  });

  it("is null for a closed ward", () => {
    expect(wardTomorrowOutlook({ ...unit!, isClosed: true }, [], [], [], [], NOW)).toBeNull();
  });
});

describe("Tomorrow card words", () => {
  const outlook = (overrides: Partial<WardTomorrowOutlook>): WardTomorrowOutlook => ({
    until: NOW + 24 * 60,
    likely: 0,
    low: 0,
    high: 0,
    likelyOut: 0,
    unconfirmed: 0,
    notFlagged: 0,
    bookedIn: 0,
    flaggedTodayPlannedLater: 0,
    ...overrides,
  });

  it("says a shortfall as one and a zero as the digit", () => {
    expect(outlookHeadline(-1)).toEqual({ lead: "Likely", figure: 1, tail: "short" });
    expect(outlookHeadline(0)).toEqual({ lead: "", figure: 0, tail: "likely free" });
    expect(outlookSentence(outlook({ likely: 0 }))).toBe("0 beds likely free tomorrow.");
  });

  it("reads as one plain line with what would firm it up", () => {
    expect(outlookSentence(outlook({ likely: -1, unconfirmed: 2 }))).toBe(
      "Likely 1 short tomorrow. 2 discharges unconfirmed.",
    );
    expect(outlookSentence(outlook({ likely: 1, unconfirmed: 1, notFlagged: 3 }))).toBe(
      "1 bed likely free tomorrow. 1 discharge unconfirmed, 3 dates not flagged.",
    );
  });

  it("notes discharges now planned later only when there are some", () => {
    expect(outlookPlannedLaterNote(outlook({}))).toBeNull();
    expect(outlookPlannedLaterNote(outlook({ flaggedTodayPlannedLater: 2 }))).toBe(
      "2 flagged for today now planned later",
    );
  });
});
