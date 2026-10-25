import { describe, expect, it } from "vitest";
import { isExecutiveNetworkAggregate } from "../src/components/ward-management/statistics/executive-statistics-contract";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { occupiedBeds } from "../src/components/ward-management/statistics/statistics-occupancy";
import { totalReadyBedsNow } from "../src/components/ward-management/ward-bed-states";
import { waitingInEds } from "../src/components/ward-management/ward-shared-figures";
import { projectExecutiveNetworkStatistics } from "../src/components/ward-management/statistics/executive-statistics-projector";
import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { DECLINE_REASONS, type HealthService, type Movement } from "../src/components/ward-management/ward-model";
import { seedWorld, validWorld } from "../backend/ward-flow/engine";
import { projectExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-projector";
import { isExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-contract";
import { wardStatistics } from "../src/components/ward-management/ward-statistics";
import { edWaitFigures } from "../src/components/ward-management/statistics/statistics-ed-waits";
import { allEmergencyDepartments } from "../src/components/ward-management/ward-sites";
import { selectExecutiveReportingSnapshot } from "../src/components/ward-management/statistics/executive-statistics-context";
import { reportWeek, weeklyOperationsReport } from "../src/components/ward-management/reports/weekly-report";
import { pilotMeasures } from "../src/components/ward-management/reports/pilot-measures";

function reporting(state = seedWardFlowState(), service?: HealthService) {
  return projectExecutiveReportingFoundation(
    state,
    { role: "executive", scope: service ? { kind: "service", service } : { kind: "statewide" } },
    {
      now: NOW_ANCHOR,
      dayZero: "2026-10-24T00:00:00.000Z",
      startedAt: "2026-10-24T00:00:00.000Z",
      places: wardPlaceLookup(state.units),
    },
  );
}

describe("the inactive expanded reporting foundation", () => {
  it("accepts only the transport's positive revision and lowercase context-hash shape", () => {
    const binding = { actorId: "synthetic-actor", accessContext: "a".repeat(64), epoch: 0, revision: 1 };
    const dto = reporting();
    const snapshot = { binding, receivedAt: 100, expiresAt: 200, data: dto };
    expect(selectExecutiveReportingSnapshot(binding, snapshot, 150)).toBe(dto);
    for (const invalid of [
      { ...binding, accessContext: "synthetic-context" },
      { ...binding, accessContext: "A".repeat(64) },
      { ...binding, revision: 0 },
      { ...binding, revision: 1.5 },
      { ...binding, epoch: -1 },
      { ...binding, epoch: Infinity },
    ])
      expect(selectExecutiveReportingSnapshot(invalid, { ...snapshot, binding: invalid }, 150)).toBeNull();
  });

  it("validates its positive public contract and declares missing coverage", () => {
    const dto = reporting();
    expect(isExecutiveReportingFoundation(dto)).toBe(true);
    expect(dto.coverage).toBe("reporting-foundation");
    expect(dto.omittedFamilies).toContain("community-membership");
    expect(dto.omittedFamilies).toContain("cross-route-numeric-release");
    expect(dto).not.toHaveProperty("complete");
    expect(dto).not.toHaveProperty("state");
  });

  it("uses the genuine ward and ED selectors without exporting their records", () => {
    const state = seedWardFlowState();
    const before = JSON.stringify(state);
    const dto = reporting(state);
    const ward = dto.wards[0]!;
    const stats = wardStatistics(ward.id, state.admissions, NOW_ANCHOR);
    expect(ward.statistics.averageLengthOfStayDays).toBe(stats.averageLengthOfStayDays);
    expect(ward.statistics.averageEmptyBedMinutes).toBe(stats.averageEmptyBedMinutes);
    expect(ward.beds).toEqual(project(state).wards.find((item) => item.id === ward.id)!.beds);
    const ed = dto.emergencyDepartments[0]!;
    const waits = edWaitFigures(state.movements, ed.id, NOW_ANCHOR);
    expect(ed.longestWaitMinutes).toBe(waits.longestWait?.waitMinutes ?? null);
    expect(ed.onTheList).toEqual(waits.onTheList === 0 ? { kind: "exact", value: 0 } : { kind: "withheld" });
    expect(dto.emergencyDepartments).toHaveLength(allEmergencyDepartments().length);
    expect(JSON.stringify(state)).toBe(before);
    for (const key of ["patientId", "movementId", "admissionId", "referralId", "waitingMovements", "stageChanges"])
      expect(JSON.stringify(dto)).not.toContain(`"${key}"`);
  });

  it("keeps all nine report weeks, genuine missing durations, and protected coverage counts", () => {
    const dto = reporting();
    expect(dto.weeks.map((week) => week.week.offset)).toEqual([-1, 0, 1, 2, 3, 4, 5, 6, 7]);
    expect(dto.weeks[0]!.pilot.steps.map((step) => step.id)).toEqual(["ask", "answer", "hold", "leave", "travel"]);
    expect(dto.weeks[0]!.report.delayedDischarge).toHaveProperty("recordedFrom");
    expect(dto.weeks[0]!.report.delayedDischarge).toHaveProperty("unmeasuredStays");
    expect(dto.weeks.at(-1)!.pilot.requestToBedHeld.median).toBeNull();
  });

  it("preserves current weekly and pilot duration/bed facts while dropping rows, reasons and sample totals", () => {
    const state = seedWardFlowState();
    const dto = reporting(state);
    const week = reportWeek(-1, NOW_ANCHOR, new Date("2026-10-24T00:00:00.000Z"));
    const report = weeklyOperationsReport(
      { ...state, now: NOW_ANCHOR, edAccessTargetMinutes: state.configuration.edAccessTargetMinutes },
      week,
    );
    const pilot = pilotMeasures(
      { ...state, now: NOW_ANCHOR, pullHoldMinutes: state.configuration.pullHoldMinutes },
      week,
    );
    const shown = dto.weeks[0]!;
    expect(shown.week).toEqual(week);
    expect(shown.report.occupancy).toEqual(report.occupancy);
    expect(shown.report.edWaits.longestMinutes).toBe(report.edWaits.longestMinutes);
    expect(shown.report.outOfArea.bedDays).toBe(report.outOfArea.bedDays);
    expect(shown.report.delayedDischarge.recordedFrom).toBe(report.delayedDischarge.recordedFrom);
    expect(shown.pilot.requestToBedHeld.median).toBe(pilot.requestToBedHeld.median ?? null);
    expect(shown.pilot.requestToBedHeld.p90).toBe(pilot.requestToBedHeld.p90 ?? null);
    expect(shown.report.edWaits).not.toHaveProperty("rows");
    expect(shown.report.overrides).not.toHaveProperty("byReason");
    expect(shown.report.declines).not.toHaveProperty("byReason");
    expect(typeof shown.pilot.requestToBedHeld.sampleSize).toBe("object");
    expect(typeof shown.pilot.requestToBedHeld.population).toBe("object");
  });

  it("protects a small ward stage and every related positive Network total together", () => {
    const dto = reporting(validAdmissionSource(1, 7));
    expect(dto.network.people.admissionsRecorded).toEqual({ kind: "withheld" });
    expect(dto.network.admissionStages["no-bed-yet"]).toEqual({ kind: "withheld" });
    expect(dto.network.admissionStages["in-the-bed"]).toEqual({ kind: "withheld" });
    expect(dto.network.admissionStages.ended).toEqual({ kind: "exact", value: 0 });
  });

  it("contains every service-scoped public catalogue and ward entry", () => {
    const state = seedWardFlowState();
    const service = wardPlaceLookup(state.units).unitService(state.units[0]!.id)!;
    const dto = reporting(state, service);
    expect(dto.wards.length).toBeGreaterThan(0);
    expect(dto.wards.every((ward) => ward.service === service)).toBe(true);
    expect(dto.emergencyDepartments.every((ed) => ed.service === service)).toBe(true);
    expect(dto.catalogue.sites.every((site) => site.service === service)).toBe(true);
  });

  it.each(["patientId", "narrative", "rawCount", "rows"])("rejects an added %s at any reporting boundary", (key) => {
    const dto = reporting();
    expect(isExecutiveReportingFoundation({ ...dto, [key]: "synthetic private marker" })).toBe(false);
    expect(isExecutiveReportingFoundation({ ...dto, wards: [{ ...dto.wards[0], [key]: "private" }] })).toBe(false);
  });

  it("rejects a positive exact reporting count even when it exceeds the small-number floor", () => {
    const dto = reporting();
    Object.assign(dto.weeks[0]!.pilot.requests, { raised: { kind: "exact", value: 12 } });
    expect(isExecutiveReportingFoundation(dto)).toBe(false);
  });

  it("rejects invented band labels and a report period that differs from the actual calendar selector", () => {
    const dto = reporting();
    const changedLabel = structuredClone(dto);
    changedLabel.emergencyDepartments[0]!.bands[0]!.label = "Synthetic private narrative";
    expect(isExecutiveReportingFoundation(changedLabel)).toBe(false);
    const changedPeriod = structuredClone(dto);
    changedPeriod.weeks[0]!.week.start += 1;
    expect(isExecutiveReportingFoundation(changedPeriod)).toBe(false);
  });
});

function validAdmissionSource(waitlisted = 1, occupied = 7, departed = 0, arrivedEarlier = 0) {
  let world = seedWorld(new Date("2026-10-24T00:00:00Z"));
  const { units, patients, admissions } = world.state;
  for (const [key, value] of Object.entries(world.state))
    if (Array.isArray(value)) Object.assign(world.state, { [key]: [] });
  world.state.units = units.map((unit) => ({
    ...unit,
    restrictivePractice: { ...unit.restrictivePractice, episodes: [], incidents: [] },
  }));
  world.state.patients = patients;
  const size = waitlisted + occupied + departed;
  world.state.admissions = admissions.slice(0, size).map((admission, index) => ({
    ...admission,
    state: index < waitlisted ? "waitlisted" : index < waitlisted + occupied ? "occupied" : "departed",
    arrivedAt: index < waitlisted ? null : index >= size - arrivedEarlier ? NOW_ANCHOR - 1441 : NOW_ANCHOR - 1,
    pulledAt: index < waitlisted ? null : index >= size - arrivedEarlier ? NOW_ANCHOR - 1442 : NOW_ANCHOR - 2,
    leftAt: index >= waitlisted + occupied ? NOW_ANCHOR : null,
    movementId: null,
    referralId: null,
  }));
  for (const admission of world.state.admissions) delete admission.bedNumber;
  world = JSON.parse(JSON.stringify(world));
  expect(validWorld(world), "the synthetic reproduction must pass the actual world validator").toBe(true);
  return world.state;
}

function validMovementSource(size: number, refused: number, escalated: number, leftEd = 0) {
  let world = seedWorld(new Date("2026-10-24T00:00:00Z"));
  const { units, patients, movements } = world.state;
  const template = movements.find((movement) => movement.originEdId !== undefined)!;
  for (const [key, value] of Object.entries(world.state))
    if (Array.isArray(value)) Object.assign(world.state, { [key]: [] });
  world.state.units = units.map((unit) => ({
    ...unit,
    restrictivePractice: { ...unit.restrictivePractice, episodes: [], incidents: [] },
  }));
  world.state.patients = patients;
  const required = [
    "originEdId",
    "openedAt",
    "flaggedUrgent",
    "urgency",
    "cohort",
    "security",
    "sex",
    "observation",
    "highAcuity",
    "legalStatus",
    "owner",
    "blocker",
  ] as const;
  const common = Object.fromEntries(required.map((key) => [key, template[key]])) as Pick<
    Movement,
    (typeof required)[number]
  >;
  world.state.movements = movements.slice(0, size).map((source, index) => ({
    ...common,
    id: source.id,
    patientId: source.patientId,
    stage: "destination_review",
    openedAt: NOW_ANCHOR - 10,
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    referredUnitIds: [],
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    declines: index < refused ? [{ unitId: units[0]!.id, at: NOW_ANCHOR - 1, reason: DECLINE_REASONS[0] }] : [],
    ...(index >= refused && index < refused + escalated
      ? { escalation: { at: NOW_ANCHOR - 1, triedUnitIds: [units[0]!.id], contact: "Synthetic coordination" } }
      : {}),
    ...(index < leftEd ? { leftDepartmentAt: NOW_ANCHOR - 1 } : {}),
  }));
  world = JSON.parse(JSON.stringify(world));
  expect(validWorld(world), "the synthetic movement source must pass the actual world validator").toBe(true);
  return world.state;
}

function project(state: WardFlowState, service?: HealthService) {
  return projectExecutiveNetworkStatistics(
    state,
    { role: "executive", scope: service ? { kind: "service", service } : { kind: "statewide" } },
    {
      now: NOW_ANCHOR,
      dayZero: "2026-10-24T00:00:00.000Z",
      startedAt: "2026-10-24T00:00:00.000Z",
      places: wardPlaceLookup(state.units),
    },
  );
}

const emptyAggregate = {
  kind: "executive-statistics",
  version: 1,
  coverage: "network-foundation",
  threshold: 5,
  scope: { kind: "statewide" },
  asAt: { now: 0, dayZero: "2026-10-24T00:00:00.000Z", startedAt: "2026-10-24T00:00:00.000Z" },
  wards: [],
  beds: { total: 0, ready: 0, pulled: 0, closed: 0, occupied: 0, inUse: 0, beingMadeReady: 0, onLeave: 0 },
  people: {
    waitingInEd: { kind: "exact", value: 0 },
    stillOpen: { kind: "exact", value: 0 },
    admissionsArrivedToday: { kind: "exact", value: 0 },
    admissionsEndedToday: { kind: "exact", value: 0 },
    admissionsRecorded: { kind: "exact", value: 0 },
    refused: { kind: "exact", value: 0 },
    escalated: { kind: "exact", value: 0 },
  },
  admissionStages: {
    "no-bed-yet": { kind: "exact", value: 0 },
    "bed-given-not-arrived": { kind: "exact", value: 0 },
    "in-the-bed": { kind: "exact", value: 0 },
    ended: { kind: "exact", value: 0 },
  },
};

describe("the executive Network aggregate boundary", () => {
  it("accepts an honestly measured empty aggregate without operational records", () => {
    expect(isExecutiveNetworkAggregate(emptyAggregate)).toBe(true);
  });

  it("rejects an exact small patient count even when the rest of the payload is valid", () => {
    expect(
      isExecutiveNetworkAggregate({
        ...emptyAggregate,
        people: { ...emptyAggregate.people, admissionsEndedToday: { kind: "exact", value: 2 } },
      }),
    ).toBe(false);
  });

  it("projects actual Network figures with no operational rows and without changing the source", async () => {
    const { projectExecutiveNetworkStatistics } =
      await import("../src/components/ward-management/statistics/executive-statistics-projector");
    const state = seedWardFlowState();
    const before = JSON.stringify(state);
    const projected = projectExecutiveNetworkStatistics(
      state,
      { role: "executive", scope: { kind: "statewide" } },
      {
        now: NOW_ANCHOR,
        dayZero: emptyAggregate.asAt.dayZero,
        startedAt: emptyAggregate.asAt.startedAt,
        places: wardPlaceLookup(state.units),
      },
    );
    const occupancy = occupiedBeds(state.units, state.admissions, state.bedReleases, state.leaveBeds);
    expect(projected.beds).toMatchObject({
      total: occupancy.beds,
      occupied: occupancy.occupied,
      pulled: occupancy.pulled,
      inUse: occupancy.inUse,
    });
    expect(projected.beds.ready).toBe(totalReadyBedsNow(state.units, state.admissions, state.bedReleases));
    // The seed's linked movement family has protected information. Its large waiting figure
    // must no longer remain exact beside that family; unsuppressed source parity is checked below.
    expect(waitingInEds(state.movements, NOW_ANCHOR).total).toBeGreaterThan(0);
    expect(projected.people.waitingInEd).toEqual({ kind: "withheld" });
    expect(projected.coverage).toBe("network-foundation");
    expect(isExecutiveNetworkAggregate(JSON.parse(JSON.stringify(projected)))).toBe(true);
    for (const record of [...state.patients, ...state.movements, ...state.admissions, ...state.referrals]) {
      expect(JSON.stringify(projected)).not.toContain(JSON.stringify(record.id));
    }
    expect(JSON.stringify(state)).toBe(before);
  });

  it("rejects a supplied lower threshold rather than accepting exact patient counts under the real policy", () => {
    expect(
      isExecutiveNetworkAggregate({
        ...emptyAggregate,
        threshold: 2,
        people: { ...emptyAggregate.people, admissionsEndedToday: { kind: "exact", value: 2 } },
      }),
    ).toBe(false);
  });

  it("rejects a breakdown that reconstructs its sole hidden count from an exact total", () => {
    expect(
      isExecutiveNetworkAggregate({
        ...emptyAggregate,
        people: { ...emptyAggregate.people, admissionsRecorded: { kind: "exact", value: 8 } },
        admissionStages: {
          ...emptyAggregate.admissionStages,
          "no-bed-yet": { kind: "small" },
          "in-the-bed": { kind: "exact", value: 6 },
        },
      }),
    ).toBe(false);
  });

  it("withholds nonzero admission-family counters beside protected stages in an actual valid source", () => {
    const state = validAdmissionSource();
    const before = JSON.stringify(state);
    const result = project(state);
    expect(result.admissionStages["no-bed-yet"]).toEqual({ kind: "small" });
    expect(result.admissionStages["in-the-bed"]).toEqual({ kind: "withheld" });
    expect(result.people.admissionsRecorded).toEqual({ kind: "withheld" });
    expect(result.people.admissionsArrivedToday).toEqual({ kind: "withheld" });
    expect(result.people.admissionsEndedToday).toEqual({ kind: "exact", value: 0 });
    expect(isExecutiveNetworkAggregate(result)).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each([1, 9])(
    "protects a small daily count or daily complement with exact stages (arrived today=%i)",
    (arrivedToday) => {
      const result = project(validAdmissionSource(0, 5, 5, 10 - arrivedToday));
      expect(Object.values(result.admissionStages).every((figure) => figure.kind === "exact")).toBe(true);
      expect(result.people.admissionsRecorded).toEqual({ kind: "withheld" });
      expect(result.people.admissionsArrivedToday).toEqual({ kind: "withheld" });
      expect(result.people.admissionsEndedToday).toEqual({ kind: "withheld" });
    },
  );

  it("rejects exact admission counters that expose a small daily complement", () => {
    expect(
      isExecutiveNetworkAggregate({
        ...emptyAggregate,
        admissionStages: {
          ...emptyAggregate.admissionStages,
          "in-the-bed": { kind: "exact", value: 5 },
          ended: { kind: "exact", value: 5 },
        },
        people: {
          ...emptyAggregate.people,
          admissionsRecorded: { kind: "exact", value: 10 },
          admissionsArrivedToday: { kind: "exact", value: 9 },
          admissionsEndedToday: { kind: "exact", value: 5 },
        },
      }),
    ).toBe(false);
  });

  it.each(["admissionsRecorded", "admissionsArrivedToday", "admissionsEndedToday"] as const)(
    "rejects exact-positive or small %s whenever any admission stage is protected",
    (field) => {
      for (const stage of [{ kind: "small" }, { kind: "withheld" }]) {
        const aggregate = {
          ...emptyAggregate,
          admissionStages: {
            ...emptyAggregate.admissionStages,
            "no-bed-yet": stage,
            "in-the-bed": { kind: "withheld" },
          },
          people: {
            ...emptyAggregate.people,
            admissionsRecorded: { kind: "withheld" },
            admissionsArrivedToday: { kind: "withheld" },
            admissionsEndedToday: { kind: "exact", value: 0 },
          },
        };
        expect(isExecutiveNetworkAggregate(aggregate)).toBe(true);
        for (const exposed of [{ kind: "exact", value: 6 }, { kind: "small" }])
          expect(isExecutiveNetworkAggregate({ ...aggregate, people: { ...aggregate.people, [field]: exposed } })).toBe(
            false,
          );
      }
    },
  );

  it.each(["waitingInEd", "stillOpen", "refused", "escalated"] as const)(
    "rejects exact-positive or small %s beside a protected movement-family counter",
    (field) => {
      const aggregate = {
        ...emptyAggregate,
        people: {
          ...emptyAggregate.people,
          waitingInEd: { kind: "withheld" },
          stillOpen: { kind: "withheld" },
          refused: { kind: "withheld" },
          escalated: { kind: "withheld" },
        },
      };
      expect(isExecutiveNetworkAggregate(aggregate)).toBe(true);
      for (const exposed of [{ kind: "exact", value: 6 }, { kind: "small" }])
        expect(isExecutiveNetworkAggregate({ ...aggregate, people: { ...aggregate.people, [field]: exposed } })).toBe(
          false,
        );
    },
  );

  it("preserves authorised source escalation figures when no movement-family value needs protection", () => {
    const state = validMovementSource(10, 5, 5);
    const before = JSON.stringify(state);
    const result = project(state);
    expect(result.people.refused).toEqual({ kind: "exact", value: 5 });
    expect(result.people.escalated).toEqual({ kind: "exact", value: 5 });
    expect(result.people.stillOpen).toEqual({ kind: "exact", value: 10 });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("protects the small difference between exact waiting and open figures from a valid source", () => {
    const result = project(validMovementSource(6, 0, 0, 1));
    expect(result.people.waitingInEd).toEqual({ kind: "withheld" });
    expect(result.people.stillOpen).toEqual({ kind: "withheld" });
    expect(result.people.refused).toEqual({ kind: "exact", value: 0 });
    expect(result.people.escalated).toEqual({ kind: "exact", value: 0 });
  });

  it.each([
    [6, 1, 5],
    [11, 5, 5],
  ] as const)(
    "protects small refusal cells or the open/refused/escalated residual (%i,%i,%i)",
    (size, refused, escalated) => {
      const result = project(validMovementSource(size, refused, escalated));
      for (const field of ["waitingInEd", "stillOpen", "refused", "escalated"] as const)
        expect(result.people[field]).toEqual({ kind: "withheld" });
      expect(isExecutiveNetworkAggregate(result)).toBe(true);
    },
  );

  it("rejects an exact movement-family payload exposing a small unshown complement", () => {
    expect(
      isExecutiveNetworkAggregate({
        ...emptyAggregate,
        people: {
          ...emptyAggregate.people,
          waitingInEd: { kind: "exact", value: 5 },
          stillOpen: { kind: "exact", value: 6 },
        },
      }),
    ).toBe(false);
  });

  it("rejects negative or small residuals in either exact movement relationship", () => {
    for (const [waiting, open, refused, escalated] of [
      [10, 5, 0, 0],
      [0, 5, 5, 5],
      [0, 11, 5, 5],
    ])
      expect(
        isExecutiveNetworkAggregate({
          ...emptyAggregate,
          people: {
            ...emptyAggregate.people,
            waitingInEd: { kind: "exact", value: waiting },
            stillOpen: { kind: "exact", value: open },
            refused: { kind: "exact", value: refused },
            escalated: { kind: "exact", value: escalated },
          },
        }),
      ).toBe(false);
  });

  it("keeps service ward and bed aggregates within the requested service", () => {
    const state = seedWardFlowState();
    const places = wardPlaceLookup(state.units);
    const service = places.unitService(state.units[0]!.id)!;
    const own = state.units.filter((unit) => places.unitService(unit.id) === service);
    expect(own.length).toBeGreaterThan(0);
    expect(own.length).toBeLessThan(state.units.length);
    const result = project(state, service);
    expect(result.scope).toEqual({ kind: "service", service });
    expect(result.wards.map((ward) => ward.id)).toEqual(own.map((ward) => ward.id));
    expect(result.wards.every((ward) => ward.service === service)).toBe(true);
    expect(result.beds.total).toBe(own.reduce((sum, unit) => sum + unit.beds, 0));
    expect(result.beds.total).toBeLessThan(project(state).beds.total);
  });

  it.each([
    [0, { kind: "exact", value: 0 }],
    [1, { kind: "withheld" }],
    [4, { kind: "withheld" }],
    [5, { kind: "exact", value: 5 }],
  ] as const)("releases %i ended admissions using the existing patient-count policy", (size, expected) => {
    const state = seedWardFlowState();
    const ended = state.admissions.slice(0, size).map((admission) => ({
      ...admission,
      state: "departed" as const,
      arrivedAt: NOW_ANCHOR - 100,
      leftAt: NOW_ANCHOR,
    }));
    const result = project({ ...state, admissions: ended });
    expect(result.people.admissionsEndedToday).toEqual(expected);
    expect(result.people.admissionsRecorded).toEqual(expected);
    expect(isExecutiveNetworkAggregate(result)).toBe(true);
  });

  it("withholds the complementary stage and linked total beside a protected admission stage", () => {
    const state = seedWardFlowState();
    const admissions = state.admissions.slice(0, 8).map((admission, index) => ({
      ...admission,
      state: index < 2 ? ("waitlisted" as const) : ("occupied" as const),
      arrivedAt: index < 2 ? null : NOW_ANCHOR - 100,
      leftAt: null,
    }));
    const result = project({ ...state, admissions });
    // Keeping this total exact was unsafe once same-bundle daily subset counts were included.
    expect(result.people.admissionsRecorded).toEqual({ kind: "withheld" });
    expect(result.admissionStages).toEqual({
      "no-bed-yet": { kind: "small" },
      "bed-given-not-arrived": { kind: "exact", value: 0 },
      "in-the-bed": { kind: "withheld" },
      ended: { kind: "exact", value: 0 },
    });
    expect(isExecutiveNetworkAggregate(result)).toBe(true);
  });

  it("permits exact small bed counts while rejecting protected-count values and operational extras", () => {
    expect(
      isExecutiveNetworkAggregate({ ...emptyAggregate, beds: { ...emptyAggregate.beds, total: 2, ready: 2 } }),
    ).toBe(true);
    const invalid = [
      { ...emptyAggregate, state: seedWardFlowState() },
      { ...emptyAggregate, patients: [] },
      { ...emptyAggregate, coverage: "all-statistics" },
      { ...emptyAggregate, people: { ...emptyAggregate.people, admissionsEndedToday: { kind: "small", value: 2 } } },
      {
        ...emptyAggregate,
        admissionStages: { ...emptyAggregate.admissionStages, ended: { kind: "withheld", raw: 6 } },
      },
      { ...emptyAggregate, asAt: { ...emptyAggregate.asAt, patientId: "PT-SYNTHETIC" } },
    ];
    for (const candidate of invalid) expect(isExecutiveNetworkAggregate(candidate)).toBe(false);
  });

  it("rejects non-executive roles instead of borrowing coordinator reporting authority", () => {
    const state = seedWardFlowState();
    expect(() =>
      projectExecutiveNetworkStatistics(
        state,
        { role: "coordinator", scope: { kind: "statewide" } },
        {
          ...emptyAggregate.asAt,
          places: wardPlaceLookup(state.units),
        },
      ),
    ).toThrow("requires an executive reporting scope");
  });

  it("rejects foreign or duplicate public ward rows inside a service-scoped aggregate", () => {
    const state = seedWardFlowState();
    const result = project(state, wardPlaceLookup(state.units).unitService(state.units[0]!.id)!);
    const foreign = project(state).wards.find((ward) => ward.service !== result.wards[0]!.service)!;
    expect(foreign).toBeDefined();
    expect(isExecutiveNetworkAggregate({ ...result, wards: [...result.wards, foreign] })).toBe(false);
    expect(isExecutiveNetworkAggregate({ ...result, wards: [...result.wards, result.wards[0]] })).toBe(false);
  });

  it("does not let another service's admission change the service's released figures", () => {
    const state = seedWardFlowState();
    const places = wardPlaceLookup(state.units);
    const service = places.unitService(state.units[0]!.id)!;
    const foreign = state.admissions.find((admission) => places.unitService(admission.unitId) !== service)!;
    expect(foreign).toBeDefined();
    const before = project(state, service);
    const altered = {
      ...state,
      admissions: state.admissions.map((admission) =>
        admission.id === foreign.id
          ? { ...admission, state: "departed" as const, arrivedAt: NOW_ANCHOR - 20, leftAt: NOW_ANCHOR }
          : admission,
      ),
    };
    expect(project(altered, service)).toEqual(before);
  });

  it("never carries narrative or identity through the public projection seam", () => {
    const state = seedWardFlowState();
    const marker = "SYNTHETIC-PRIVATE-NARRATIVE";
    state.patients[0] = { ...state.patients[0]!, givenName: marker, familyName: marker };
    state.movements[0] = { ...state.movements[0]!, blocker: marker, owner: marker };
    state.referrals[0] = { ...state.referrals[0]!, history: marker };
    const result = project(state);
    expect(JSON.stringify(result)).not.toContain(marker);
    expect(isExecutiveNetworkAggregate(JSON.parse(JSON.stringify(result)))).toBe(true);
  });
});
