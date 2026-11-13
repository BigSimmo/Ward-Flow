import { describe, expect, it } from "vitest";

import type { Admission } from "@/components/ward-management/ward-admissions";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { BedRelease, Movement } from "@/components/ward-management/ward-model";
import type { BedItem } from "@/components/ward-management/ward/ward-bed-tone";
import {
  arrivalLegalTag,
  arrivalRows,
  arrivalsExpectedToday,
  arrivalTransportLine,
  dischargeTodayRows,
  needsALookRows,
  shortDateLabel,
} from "@/components/ward-management/ward/ward-coming-and-going-rows";
import { legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import { obsNotRecordedCount } from "@/components/ward-management/ward/ward-screen-derivations";

/**
 * Wave 4 (D-191) review fixes on the Ward page's counts and arrival rows, as pure rules:
 * F-3 "Arrivals · today" counts only people expected today; F-4 "Obs not recorded" lives in a model
 * file; F-12 arrival rows carry the legal tag as recorded and the transport line. Synthetic seed only.
 */
const state = seedWardFlowState();
const seedMovement = state.movements.find((movement) => movement.transport?.collectedAt !== undefined)!;
const day = 1440;
const now = 3 * day + 600; // Day 3, 10:00.

function bare(over: Partial<Movement> = {}): Movement {
  const movement: Movement = structuredClone(seedMovement);
  delete movement.arrivalDetails;
  delete movement.transport;
  delete movement.plannedMoveAt;
  return { ...movement, ...over };
}

const eta = (at: number): Movement["arrivalDetails"] => ({
  mode: "ambulance",
  estimatedArrivalAt: at,
  recordedAt: at - 60,
  recordedBy: "coordinator",
});

describe("F-3: Arrivals · today counts only people expected today", () => {
  it("leaves out a recorded expected time on a later day and keeps today, late and unrecorded", () => {
    const today = bare({ id: "WF-today", arrivalDetails: eta(now + 120) });
    const late = bare({ id: "WF-late", arrivalDetails: eta(now - day) });
    const unrecorded = bare({ id: "WF-none" });
    const tomorrowEta = bare({ id: "WF-tomorrow-eta", arrivalDetails: eta(now + day) });
    const tomorrowPlan = bare({ id: "WF-tomorrow-plan", plannedMoveAt: now + day });
    const kept = arrivalsExpectedToday([today, late, unrecorded, tomorrowEta, tomorrowPlan], now);
    expect(kept.map((movement) => movement.id)).toEqual(["WF-today", "WF-late", "WF-none"]);
  });

  it("reads the recorded ETA before the transport's and the planned move time", () => {
    const etaToday = bare({ id: "WF-a", arrivalDetails: eta(now + 30), plannedMoveAt: now + day });
    expect(arrivalsExpectedToday([etaToday], now)).toHaveLength(1);
  });
});

describe("F-12: arrival rows keep the legal tag as recorded and say the transport", () => {
  it("tags the recorded form only, else the recorded status", () => {
    expect(arrivalLegalTag(bare())).toMatch(/^Form /);
    expect(arrivalLegalTag(bare())).not.toMatch(/involuntary/i);
    const noForm = bare({ legalForm: undefined, legalStatus: "Voluntary" });
    expect(arrivalLegalTag(noForm)).toBe("Voluntary");
    // D-187 item 4: Arrivals use the shared chip, so whatever it says for a Voluntary person with a
    // form on file (status and form together, once that ruling lands) shows here too.
    const voluntaryWithForm = bare({ legalStatus: "Voluntary" });
    expect(arrivalLegalTag(voluntaryWithForm)).toBe(legalStatusShort(voluntaryWithForm));
  });

  it("reads the transport line from the transport record, quiet when none is booked", () => {
    const collected = structuredClone(seedMovement);
    expect(arrivalTransportLine(collected, now)).toEqual({
      text: `${collected.transport!.provider} · collected ${formatInstantWithDay(collected.transport!.collectedAt!, now)}`,
      quiet: false,
    });
    expect(arrivalTransportLine(bare({ stage: "accepted_awaiting_bed" }), now)).toEqual({
      text: "No transport booked",
      quiet: true,
    });
    expect(arrivalTransportLine(bare({ stage: "handover_ready" }), now)).toEqual({
      text: "Transport not recorded",
      quiet: true,
    });
  });

  it("puts the tag on the row and a quiet transport line beside No bed pulled", () => {
    const unit = state.units.find((candidate) => candidate.id === seedMovement.acceptedUnitId) ?? state.units[0]!;
    const [row] = arrivalRows({
      accepted: [bare({ stage: "accepted_awaiting_bed", legalForm: undefined, legalStatus: "Voluntary" })],
      beds: [],
      unit,
      now,
      nameOf: () => "Surname, Given",
      desk: "ward",
    });
    expect(row!.tag).toBe("Voluntary");
    expect(row!.quietLine).toBe("No bed pulled · No transport booked");
  });
});

describe("F-4: Obs not recorded is a model rule, not a page's", () => {
  it("counts this ward's current stays (occupied or pulled) with no level recorded", () => {
    const seed = state.admissions[0]!;
    const stay = (over: Partial<Admission>): Admission => ({ ...structuredClone(seed), ...over });
    const notRecorded = { level: "not_recorded", intervalMinutes: null, reviewAt: null } as Admission["observation"];
    const admissions = [
      stay({ id: "WF-a", unitId: "u1", state: "occupied", observation: notRecorded }),
      stay({ id: "b", unitId: "u1", state: "pulled", observation: notRecorded }),
      stay({ id: "c", unitId: "u1", state: "departed", observation: notRecorded }),
      stay({ id: "d", unitId: "u2", state: "occupied", observation: notRecorded }),
      stay({ id: "e", unitId: "u1", state: "occupied" }),
    ];
    expect(obsNotRecordedCount("u1", admissions)).toBe(2);
  });
});

describe("FS-2 and FS-9: Needs a look agrees with the hero and says dates", () => {
  // Day 0 is Perth midnight on Wed 11 Nov 2026, so `now` (day 3, 10:00) is Sat 14 Nov.
  const dayZero = new Date("2026-11-10T16:00:00Z");
  const rowDate = shortDateLabel(dayZero, now);
  const bed = (over: Partial<BedItem>): BedItem => ({
    bedNumber: 1,
    bedLabel: "Bed 01",
    status: "occupied",
    statusText: "",
    ...over,
  });
  const release = (over: Partial<BedRelease>): BedRelease =>
    ({
      id: "r",
      unitId: "u1",
      admissionId: "a",
      state: "expected",
      expectedAt: now,
      blocker: null,
      ...over,
    }) as BedRelease;
  const beds = [
    bed({
      bedNumber: 8,
      admissionId: "a8",
      patientAlias: "Surname, Held",
      pastDate: true,
      expectedDischargeAt: now - 2 * day,
    }),
    bed({
      bedNumber: 2,
      admissionId: "a2",
      patientAlias: "Surname, Past",
      pastDate: true,
      expectedDischargeAt: now - day,
    }),
    bed({ bedNumber: 13, admissionId: "a13", patientAlias: "Surname, Also", pastDate: true }),
  ];
  const releases = [
    release({ id: "r8", admissionId: "a8", expectedAt: now - 2 * day, blocker: "Awaiting accommodation" }),
  ];

  it("lists a held-up bed once but counts every past-date bed, as the hero's Past date does", () => {
    const look = needsALookRows(releases, beds, now, rowDate);
    expect(look.rows.map((row) => row.bedNumber)).toEqual([8, 2, 13]);
    expect(look.heldUp).toBe(1);
    expect(look.pastDate).toBe(beds.filter((item) => item.pastDate).length);
  });

  it('says a short date ("12 Nov") in the time column, a clock time today, and "Date not recorded" when none', () => {
    const look = needsALookRows(releases, beds, now, rowDate);
    expect(look.rows.map((row) => row.when)).toEqual(["12 Nov", "13 Nov", undefined]);
    expect(look.rows[2]!.quietLine).toBe("Date not recorded");
    expect(rowDate(now + 330)).toBe("15:30");
    const out = dischargeTodayRows(
      [release({ id: "r2", admissionId: "a2", expectedAt: now - day })],
      beds,
      now,
      rowDate,
    );
    expect(out[0]!.when).toBe("13 Nov");
  });
});
