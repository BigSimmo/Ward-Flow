import { describe, expect, it } from "vitest";

import "@/components/ward-management/ward-scenario-networks";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { lockedBedsFree, numberedBedKind } from "@/components/ward-management/ward-bed-designation";
import { bedKindFiguresAgree, bedKindSeatConflicts, isMixedWard } from "@/components/ward-management/ward-bed-numbers";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import { demoDayZero } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { withInboxStreamADefaults } from "@/components/ward-management/ward-flow-stored-state-migration";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { WARD_SCENARIOS, activateScenarioNetwork } from "@/components/ward-management/ward-scenarios";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";
import { NOW_ANCHOR, STANDARD_WARD_SITES, activateWardNetwork } from "@/components/ward-management/ward-sites";
import { seatStays, wardStaySeats } from "@/components/ward-management/ward/ward-bed-layout";
import { wardBedRoster } from "@/components/ward-management/ward/ward-screen-derivations";
import { nextEvent, seededRandom } from "./helpers/ward-engine-fuzz";

/**
 * H10 (mechanics audit, 14 Nov 2026), D-210 (Josh, 14 Nov 2026), ruling 9: a stay's locked or open
 * bed kind and its bed number are one fact. Synthetic seeded worlds only.
 */

const current = (admission: Admission) => admission.state === "pulled" || admission.state === "occupied";

/** Every rule this fix holds, on every ward: an empty list is a world that agrees with itself. */
function bedKindProblems(state: WardFlowState): string[] {
  return state.units.flatMap((unit) => [
    ...bedKindSeatConflicts(unit, state.admissions).map((id) => `${unit.id}: ${id} sits outside its bed kind`),
    ...(bedKindFiguresAgree(unit, state.admissions)
      ? []
      : [`${unit.id}: free locked/open figures promise a bed the bed numbers do not have`]),
  ]);
}

function send(state: WardFlowState, event: Record<string, unknown>): WardFlowState {
  return wardFlowReducer(state, { now: NOW_ANCHOR, ...event } as unknown as WardFlowEvent);
}

/** A Secure journey pulled to `unitId`, through the coordinator's refer, the ward's accept and the pull. */
function pullSecureTo(unitId: string) {
  activateWardNetwork(STANDARD_WARD_SITES);
  const seed = seedWardFlowState();
  for (const movement of seed.movements) {
    if (movement.closure || movement.security !== "Secure" || movement.acceptedUnitId) continue;
    let state = send(seed, { type: "REFER_TO_UNITS", role: "coordinator", movementId: movement.id, unitIds: [unitId] });
    state = send(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      movementId: movement.id,
      unitId,
      actingUnitId: unitId,
    });
    const pulled = send(state, {
      type: "PULL_PATIENT",
      role: "ward",
      movementId: movement.id,
      unitId,
      actingUnitId: unitId,
      overrideReason: OVERRIDE_REASONS[0],
      numConsulted: true,
    });
    const admissionId = pulled.movements.find((row) => row.id === movement.id)?.admissionId;
    if (admissionId && pulled.rejections.length === seed.rejections.length)
      return { before: seed, after: pulled, admission: pulled.admissions.find((row) => row.id === admissionId)! };
  }
  throw new Error(`no seeded Secure journey could be pulled to ${unitId}`);
}

describe("H10: bed kind and bed number are one fact", () => {
  it("every seeded world gives each current stay a kind, a bed of that kind on a mixed ward, and figures that agree", () => {
    for (const scenario of WARD_SCENARIOS) {
      activateScenarioNetwork(scenario);
      const state = seedWardFlowState(scenario);
      expect(bedKindProblems(state), scenario).toEqual([]);
      for (const admission of state.admissions.filter(current)) {
        const unit = state.units.find((row) => row.id === admission.unitId)!;
        expect(admission.bedKind, `${scenario} ${admission.id}`).toBeDefined();
        if (!isMixedWard(unit)) continue;
        expect(numberedBedKind(unit, admission.bedNumber!), `${scenario} ${admission.id}`).toBe(admission.bedKind);
      }
    }
  });

  it("a Secure pull onto a mixed ward takes a locked bed number with the locked kind (audit PL4 F)", () => {
    const { before, after, admission } = pullSecureTo("fsh-adult-secure");
    const unit = before.units.find((row) => row.id === "fsh-adult-secure")!;
    expect(lockedBedsFree(unit)).toBeGreaterThan(0);
    expect(admission.bedKind).toBe("locked");
    expect(admission.bedNumber).toBeDefined();
    expect(numberedBedKind(unit, admission.bedNumber!)).toBe("locked");
    expect(bedKindProblems(after)).toEqual([]);
  });

  it("labels a stay's tile by its recorded kind and number, and the Ready tiles by the ward's free split", () => {
    const { after: state, admission } = pullSecureTo("fsh-adult-secure");
    const unit = state.units.find((row) => row.id === "fsh-adult-secure")!;
    const holds = [...state.movements, ...state.referrals];
    const states = bedStates(unit, state.admissions, state.bedReleases, state.leaveBeds, holds);
    const { bedsList } = wardBedRoster({
      unit,
      unitLeaveBeds: state.leaveBeds.filter((bed) => bed.unitId === unit.id),
      admissions: state.admissions,
      bedReleases: state.bedReleases,
      states,
      accepted: state.movements.filter((row) => row.acceptedUnitId === unit.id && row.closure === undefined),
      movements: state.movements,
      resolvePatientIdentity: createPatientResolver(state),
      now: NOW_ANCHOR,
      criteriaLedOn: false,
      patients: state.patients,
      plannedAdmissions: state.plannedAdmissions,
      dayZero: demoDayZero(new Date("2026-10-19T00:00:00Z")),
      wardReferralInbox: () => [],
    });
    const tile = bedsList.find((bed) => bed.stayAdmissionId === admission.id)!;
    expect(tile).toMatchObject({ bedNumber: admission.bedNumber, designation: "Locked", podId: "locked" });
    for (const bed of bedsList) {
      const stay = state.admissions.find((row) => row.id === bed.stayAdmissionId);
      if (stay?.bedNumber !== undefined) expect(bed.bedNumber, stay.id).toBe(stay.bedNumber);
      if (stay?.bedKind !== undefined)
        expect(bed.designation, stay.id).toBe(stay.bedKind === "locked" ? "Locked" : "Open");
    }
    const ready = bedsList.filter((bed) => bed.status === "ready");
    expect(ready.filter((bed) => bed.designation === "Locked")).toHaveLength(
      Math.min(lockedBedsFree(unit), ready.length),
    );
    for (const bed of ready)
      expect(bed.designation).toBe(numberedBedKind(unit, bed.bedNumber) === "locked" ? "Locked" : "Open");
  });

  it("never seats a stay with a recorded kind in the other kind's beds; it is named as a conflict instead", () => {
    const stay = (id: string, bedKind: "locked" | "open", at: number) => ({
      id,
      state: "occupied",
      pulledAt: at,
      arrivedAt: at,
      leftAt: null,
      bedKind,
    });
    // Two beds, bed 1 locked: two locked stays, one locked bed.
    const seats = seatStays(2, [stay("first", "locked", 1), stay("second", "locked", 2)], 1);
    expect(seats.get("first")).toBe(1);
    expect(seats.has("second")).toBe(false);

    activateWardNetwork(STANDARD_WARD_SITES);
    const seed = seedWardFlowState();
    const unit = seed.units.find((row) => row.id === "brm-adult-secure")!;
    const template = seed.admissions.find((row) => row.unitId === unit.id && row.state === "occupied")!;
    const extra: Admission = {
      ...template,
      id: "mca-extra-locked",
      bedKind: "locked",
      bedNumber: undefined,
      pulledAt: NOW_ANCHOR,
      arrivedAt: NOW_ANCHOR,
    };
    const admissions = [...seed.admissions, extra];
    // brm-adult-secure has every locked bed taken in the seed, so the stay has no locked seat.
    expect(wardStaySeats(unit, admissions).has(extra.id)).toBe(false);
    expect(bedKindSeatConflicts(unit, admissions)).toEqual([extra.id]);
  });

  it("an older save with no bed kinds or numbers takes them once on restore, on both restore paths", () => {
    for (const scenario of ["standard", "emhs-demo"] as const) {
      activateScenarioNetwork(scenario);
      const seeded = seedWardFlowState(scenario);
      const old: WardFlowState = {
        ...seeded,
        admissions: seeded.admissions.map((admission) => {
          const older = { ...admission };
          delete older.bedKind;
          delete older.bedNumber;
          return older;
        }),
      };
      const restored = withInboxStreamADefaults(old);
      expect(restored.admissions.filter(current).every((row) => row.bedKind !== undefined)).toBe(true);
      expect(bedKindProblems(restored), scenario).toEqual([]);
      // Derived once: a second restore changes nothing.
      expect(withInboxStreamADefaults(restored).admissions).toEqual(restored.admissions);

      const shared = JSON.parse(JSON.stringify(old)) as WardFlowState;
      expect(isValidSharedWardFlowState(shared)).toBe(true);
      expect(bedKindProblems(shared), `${scenario} shared`).toEqual([]);
    }
  });

  it("repatriation asks for the bed type the stay holds, not whether the ward has locked beds (ruling 9)", () => {
    activateWardNetwork(STANDARD_WARD_SITES);
    const seed = seedWardFlowState();
    const tried: string[] = [];
    for (const kind of ["open", "locked"] as const) {
      const stay = seed.admissions.find((row) => {
        const unit = seed.units.find((candidate) => candidate.id === row.unitId)!;
        return row.state === "occupied" && row.bedKind === kind && isMixedWard(unit) && row.patientId !== null;
      });
      expect(stay, kind).toBeDefined();
      let accepted: WardFlowState | undefined;
      for (const homeHospital of ["RPH", "SCGH", "FSH", "JHC", "AH"]) {
        const after = send(seed, {
          type: "RECORD_REPATRIATION",
          role: "coordinator",
          admissionId: stay!.id,
          homeHospital,
          receivingWardAgreed: true,
          mode: "road",
          cadNumber: "",
          transportLegalStatus: "involuntary",
        });
        if (after.rejections.length === seed.rejections.length) {
          accepted = after;
          break;
        }
        tried.push(after.rejections.at(-1)!.reason);
      }
      expect(accepted, tried.join(" | ")).toBeDefined();
      const created = accepted!.movements.filter((row) => !seed.movements.some((old) => old.id === row.id));
      expect(created).toHaveLength(1);
      expect(created[0].security).toBe(kind === "open" ? "Open" : "Secure");
    }
  });

  it("a coordinator transfer onto a mixed ward records the bed kind it takes with a bed of that kind", () => {
    activateWardNetwork(STANDARD_WARD_SITES);
    const targetId = "fsh-adult-secure";
    const seed = seedWardFlowState();
    const care = (s: WardFlowState, admission: Admission, step: "accepted" | "handover" | "arrived") => ({
      type: "RECORD_ADMISSION_CARE",
      role: "coordinator",
      admissionId: admission.id,
      patientId: admission.patientId!,
      expectedGeneration: s.worldGeneration,
      expectedRevision: s.dischargeRevisions[admission.id] ?? 0,
      change: { kind: "transfer", receivingUnitId: targetId, step },
    });
    const fresh: WardFlowState = {
      ...seed,
      units: seed.units.map((unit) => ({
        ...unit,
        allocatable: { ...unit.allocatable, confirmedAt: NOW_ANCHOR },
        empty: { ...unit.empty, confirmedAt: NOW_ANCHOR },
      })),
    };
    const candidates = fresh.admissions.filter(
      (row) =>
        row.state === "occupied" &&
        row.patientId !== null &&
        row.unitId !== targetId &&
        fresh.units.find((unit) => unit.id === row.unitId)?.cohort === "Adult",
    );
    const reasons: string[] = [];
    for (const candidate of candidates) {
      // A linked placement record, as a ward referral leaves one (the WF-INV-01 set-up): a voluntary
      // journey that arrived on the sending ward.
      const linked = structuredClone(fresh);
      const admission = linked.admissions.find((row) => row.id === candidate.id)!;
      const movement = linked.movements.find((row) => row.cohort === "Adult" && row.id !== admission.movementId)!;
      movement.legalStatus = "Voluntary";
      movement.security = "Open";
      movement.sex = admission.sex;
      movement.gender = admission.gender;
      movement.observation = admission.observation;
      movement.highAcuity = false;
      movement.admissionId = admission.id;
      movement.patientId = admission.patientId!;
      movement.stage = "arrived";
      movement.acceptedUnitId = admission.unitId;
      admission.movementId = movement.id;
      const patient = linked.patients.find((row) => row.id === admission.patientId)!;
      patient.legalStatus = "Voluntary";
      patient.communityTreatmentOrder = undefined;
      let state = send(linked, care(linked, admission, "accepted"));
      state = send(state, care(state, admission, "handover"));
      const arrived = send(state, care(state, admission, "arrived"));
      const created = arrived.admissions.find((row) => row.id.startsWith(`transfer-${admission.id}-`));
      if (!created) {
        reasons.push(arrived.rejections.map((rejection) => rejection.reason).join(" > "));
        continue;
      }
      const unit = arrived.units.find((row) => row.id === targetId)!;
      expect(created.bedKind).toBe("open");
      expect(created.bedNumber).toBeDefined();
      expect(numberedBedKind(unit, created.bedNumber!)).toBe("open");
      expect(bedKindProblems(arrived)).toEqual([]);
      return;
    }
    throw new Error(`no seeded stay could be transferred to the mixed ward: ${[...new Set(reasons)].join(" | ")}`);
  });

  it("an Open journey arriving unpulled on a closed mixed ward takes a free open bed, not a locked kind with no bed (seed 9)", () => {
    // Property seed 9: the ward's locked beds were all taken and its Ready figures were 0 (closed to
    // admissions), so the arrival read as a locked stay with no locked bed left, while open beds stood empty.
    activateScenarioNetwork("scarce");
    const unitId = "bty-adult-secure";
    let state = seedWardFlowState("scarce");
    expect(state.movements.find((row) => row.id === "WF-313")).toMatchObject({ stage: "moving", security: "Open" });
    state = send(state, {
      type: "CLOSE_WARD_TO_ADMISSIONS",
      unitId,
      actingUnitId: unitId,
      reason: "other_operational",
      role: "ward",
    });
    const arrived = send(state, { type: "PATIENT_ARRIVED", movementId: "WF-313", actingUnitId: unitId, role: "ward" });
    expect(arrived.rejections).toEqual(state.rejections);
    const stay = arrived.admissions.find((row) => row.movementId === "WF-313")!;
    const unit = arrived.units.find((row) => row.id === unitId)!;
    expect(stay.bedKind).toBe("open");
    expect(stay.bedNumber).toBeDefined();
    expect(numberedBedKind(unit, stay.bedNumber!)).toBe("open");
    expect(bedKindProblems(arrived)).toEqual([]);
  });

  it("random pulls, arrivals, transfers, discharges and closures never part a stay's kind from its bed (property)", () => {
    let pulls = 0;
    let arrivals = 0;
    let transfers = 0;
    let departures = 0;
    let closures = 0;
    for (let seed = 1; seed <= 24; seed += 1) {
      const scenario = WARD_SCENARIOS[seed % WARD_SCENARIOS.length];
      activateScenarioNetwork(scenario);
      const random = seededRandom(seed * 7919);
      let state = seedWardFlowState(scenario);
      for (let step = 0; step < 160; step += 1) {
        const event = nextEvent(state, random, step, seed, 160);
        // A ward's own Ready figure (`CONFIRM_CAPACITY`) is its word, not a bed record: it may say
        // more beds are ready than the numbers hold, which is outside this rule by design.
        if (event.type === "CONFIRM_CAPACITY") continue;
        const next = wardFlowReducer(state, event);
        if (event.type === "SET_SCENARIO") activateScenarioNetwork(next.scenario);
        const accepted = next.rejections.length === state.rejections.length;
        state = next;
        if (!accepted) continue;
        if (event.type === "PULL_PATIENT") pulls += 1;
        if (event.type === "PATIENT_ARRIVED" || event.type === "CONVERT_PLANNED_ADMISSION") arrivals += 1;
        if (state.admissions.some((row) => row.id.startsWith("transfer-") && row.pulledAt === event.now))
          transfers += 1;
        if (event.type === "RECORD_PATIENT_DISCHARGE" || event.type === "RECORD_LEAVING") departures += 1;
        if (event.type === "SET_BED_CLOSED") closures += 1;
        expect(bedKindProblems(state), `seed ${seed} (${scenario}) step ${step} after ${event.type}`).toEqual([]);
      }
    }
    expect({ pulls, arrivals, transfers, departures, closures }).toEqual({
      pulls: expect.any(Number),
      arrivals: expect.any(Number),
      transfers: expect.any(Number),
      departures: expect.any(Number),
      closures: expect.any(Number),
    });
    // Transfers are rare in a random run (three ordered steps); the directed test above covers one.
    expect(Math.min(pulls, arrivals, departures, closures)).toBeGreaterThan(0);
  }, 120_000);
});
