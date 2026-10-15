import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { commandScopeRefusal, scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { INBOX_CATEGORIES } from "../src/components/ward-management/ward-inbox-reducer";
import { STATEWIDE_COORDINATOR, type WardAccess } from "../src/components/ward-management/ward-role-access";
import { isValidSharedWardFlowState } from "../src/components/ward-management/ward-shared-state-validation";
import { unitHealthService } from "../src/components/ward-management/ward-service-scope";
import { WARD_SCENARIOS } from "../src/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const state = seedWardFlowState();
const places = wardPlaceLookup(state.units);
const options = { now: NOW_ANCHOR, places };
const occupied = state.admissions.find((admission) => admission.patientId !== null && admission.leftAt === null)!;
const ownUnit = occupied.unitId;
const otherAdmission = state.admissions.find(
  (admission) =>
    admission.unitId !== ownUnit && admission.patientId !== null && admission.patientId !== occupied.patientId,
)!;
const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [ownUnit] } };

/** One desk of every kind, placed where the given workspace has people. */
function desksFor(world: WardFlowState): Record<string, WardAccess> {
  const where = wardPlaceLookup(world.units);
  const stay = world.admissions.find((admission) => admission.leftAt === null) ?? world.admissions[0];
  const unit = stay?.unitId ?? world.units[0].id;
  const serviceOf = unitHealthService(world.units.find((candidate) => candidate.id === unit)!)!;
  const catchment = world.patients.find((patient) => patient.catchmentCommunityTeam)?.catchmentCommunityTeam;
  return {
    ward: { role: "ward", scope: { kind: "ward", unitIds: [unit] } },
    ed: { role: "ed", scope: { kind: "ed", edId: world.movements[0]?.originEdId ?? "none" } },
    community: { role: "community", scope: { kind: "team", teamName: catchment ?? "None" } },
    officer: { role: "officer", scope: { kind: "jobs" } },
    bedManager: { role: "bed_manager", scope: { kind: "site", siteCode: where.unitSiteCode(unit)! } },
    serviceCoordinator: { role: "coordinator", scope: { kind: "service", service: serviceOf } },
    executive: { role: "executive", scope: { kind: "statewide" } },
    serviceExecutive: { role: "executive", scope: { kind: "service", service: serviceOf } },
    admin: { role: "admin", scope: { kind: "statewide" } },
  };
}

/** Every people record id in a state, so a scoped copy can be searched for any that should be gone. */
function peopleIds(from: WardFlowState): Set<string> {
  return new Set([
    ...from.patients.map((patient) => patient.id),
    ...from.movements.map((movement) => movement.id),
    ...from.admissions.map((admission) => admission.id),
    ...from.referrals.map((referral) => referral.id),
  ]);
}

describe("the saved workspace scoped to a desk", () => {
  it("sends the statewide coordinator the state itself", () => {
    expect(scopeWardFlowState(state, STATEWIDE_COORDINATOR, options).state).toBe(state);
  });

  for (const scenario of WARD_SCENARIOS) {
    it(`gives every desk in the ${scenario} scenario a workspace the screens accept, naming nobody outside its care`, () => {
      const world =
        scenario === "standard"
          ? state
          : wardFlowReducer(state, { type: "SET_SCENARIO", role: "demo", now: NOW_ANCHOR, scenario });
      const scopeOptions = { now: NOW_ANCHOR, places: wardPlaceLookup(world.units) };
      for (const [name, access] of Object.entries(desksFor(world))) {
        // As the browser receives it: through JSON.
        const scoped = JSON.parse(
          JSON.stringify(scopeWardFlowState(world, access, scopeOptions).state),
        ) as WardFlowState;
        expect(isValidSharedWardFlowState(scoped), name).toBe(true);
        const kept = peopleIds(scoped);
        const gone = [...peopleIds(world)].filter((id) => !kept.has(id));
        const text = JSON.stringify(scoped);
        const leaks = gone.filter(
          (id) =>
            text.includes(JSON.stringify(id)) ||
            Object.values(INBOX_CATEGORIES).some(({ idPrefix }) => text.includes(JSON.stringify(idPrefix + id))),
        );
        expect(leaks, name).toEqual([]);
        expect(scoped.rejections, name).toEqual([]);
        expect(scoped.undoRecords ?? [], name).toEqual([]);
      }
    });
  }

  it("keeps a ward's own record-access receipts so an opened discharge record still reads", () => {
    const receipts = state.auditEvents.filter((event) => event.category === "record-access");
    const { state: scoped } = scopeWardFlowState(state, ward, options);
    expect(scoped.auditEvents.every((event) => event.category === "record-access")).toBe(true);
    expect(scoped.auditEvents.length).toBeLessThanOrEqual(receipts.length);
  });
});

describe("a coordinator's own bookings", () => {
  it("keep the person they name, even when nothing else links that person to its service", () => {
    const service = unitHealthService(state.units.find((unit) => unit.id === ownUnit)!)!;
    const coordinator: WardAccess = { role: "coordinator", scope: { kind: "service", service } };
    const before = scopeWardFlowState(state, coordinator, options).state;
    const outsider = state.patients.find((patient) => !before.patients.some((shown) => shown.id === patient.id))!;
    expect(outsider).toBeDefined();
    const booking = { ...state.plannedAdmissions[0], id: "PA-SCOPE-TEST", unitId: ownUnit, patientId: outsider.id };
    const world = { ...state, plannedAdmissions: [...state.plannedAdmissions, booking] };
    const scoped = scopeWardFlowState(world, coordinator, options).state;
    expect(scoped.plannedAdmissions.map((kept) => kept.id)).toContain("PA-SCOPE-TEST");
    expect(scoped.patients.map((patient) => patient.id)).toContain(outsider.id);
    // A ward desk is sent no bookings, so it learns nobody from them.
    expect(scopeWardFlowState(world, ward, options).state.patients.map((patient) => patient.id)).not.toContain(
      outsider.id,
    );
  });
});

describe("a community team's catchment clients", () => {
  it("are sent as ward and dates only, with no leave, bed release or discharge history", () => {
    const client = state.admissions.find((admission) => {
      const patient = state.patients.find((candidate) => candidate.id === admission.patientId);
      return admission.leftAt === null && patient?.catchmentCommunityTeam;
    })!;
    expect(client).toBeDefined();
    const teamName = state.patients.find((patient) => patient.id === client.patientId)!.catchmentCommunityTeam!;
    const team: WardAccess = { role: "community", scope: { kind: "team", teamName } };
    const leave = { ...(state.leaveBeds[0] ?? { id: "LB-SCOPE-TEST" }), id: "LB-SCOPE-TEST", unitId: client.unitId };
    const release = { ...state.bedReleases[0], id: "BR-SCOPE-TEST", unitId: client.unitId, admissionId: client.id };
    const world = {
      ...state,
      leaveBeds: [...state.leaveBeds, { ...leave, admissionId: client.id }] as WardFlowState["leaveBeds"],
      bedReleases: [...state.bedReleases, release],
      dischargeRevisions: { ...state.dischargeRevisions, [client.id]: state.dischargeRevisions[client.id] ?? [] },
    };
    const scoped = scopeWardFlowState(world, team, options).state;
    expect(scoped.admissions.map((admission) => admission.id)).toContain(client.id);
    expect(scoped.leaveBeds.map((bed) => bed.id)).not.toContain("LB-SCOPE-TEST");
    expect(scoped.bedReleases.map((bed) => bed.id)).not.toContain("BR-SCOPE-TEST");
    expect(Object.keys(scoped.dischargeRevisions)).not.toContain(client.id);
  });
});

describe("a command from a desk", () => {
  it("may name its own patient and stay", () => {
    expect(
      commandScopeRefusal(
        state,
        ward,
        { type: "FLAG_BED_RELEASE", role: "ward", admissionId: occupied.id, actingUnitId: ownUnit },
        options,
      ),
    ).toBeNull();
  });

  it("is refused when it names another ward's stay or patient, however deep", () => {
    expect(
      commandScopeRefusal(
        state,
        ward,
        { type: "FLAG_BED_RELEASE", role: "ward", admissionId: otherAdmission.id },
        options,
      ),
    ).toMatch(/outside your role's place/);
    expect(
      commandScopeRefusal(
        state,
        ward,
        { type: "X", role: "ward", nested: [{ id: otherAdmission.patientId }] },
        options,
      ),
    ).toMatch(/outside/);
  });

  it("is refused when it acts from another ward", () => {
    const other = state.units.find((unit) => unit.id !== ownUnit)!.id;
    expect(commandScopeRefusal(state, ward, { type: "X", role: "ward", actingUnitId: other }, options)).toMatch(
      /outside/,
    );
  });

  it("is refused when it aims at another ward, even with no acting place", () => {
    const other = state.units.find((unit) => unit.id !== ownUnit)!.id;
    const site = places.unitSiteCode(ownUnit)!;
    const bedManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: site } };
    const elsewhere = state.units.find((unit) => places.unitSiteCode(unit.id) !== site)!.id;
    expect(
      commandScopeRefusal(
        state,
        bedManager,
        { type: "SEND_WARD_BUZZ", role: "bed_manager", unitId: elsewhere },
        options,
      ),
    ).toMatch(/outside/);
    expect(
      commandScopeRefusal(state, bedManager, { type: "SEND_WARD_BUZZ", role: "bed_manager", unitId: ownUnit }, options),
    ).toBeNull();
    expect(
      commandScopeRefusal(state, ward, { type: "CONFIRM_MORNING_ROLLUP", role: "ward", unitId: other }, options),
    ).toMatch(/outside/);
    // A service coordinator refers only to wards in its own service.
    const service = unitHealthService(state.units.find((unit) => unit.id === ownUnit)!)!;
    const serviceCoordinator: WardAccess = { role: "coordinator", scope: { kind: "service", service } };
    const otherService = state.units.find((unit) => unitHealthService(unit) !== service)!.id;
    const refer = (unitIds: string[]) =>
      commandScopeRefusal(state, serviceCoordinator, { type: "REFER_TO_UNITS", role: "coordinator", unitIds }, options);
    expect(refer([ownUnit, otherService])).toMatch(/outside/);
    expect(refer([ownUnit])).toBeNull();
  });

  it("is refused for a patient seen only through break glass", () => {
    const grants = [{ patientId: otherAdmission.patientId!, until: NOW_ANCHOR + 60 }];
    const withGrant = { ...options, grants };
    expect(scopeWardFlowState(state, ward, withGrant).breakGlassPatientIds.has(otherAdmission.patientId!)).toBe(true);
    expect(
      commandScopeRefusal(state, ward, { type: "X", role: "ward", admissionId: otherAdmission.id }, withGrant),
    ).toMatch(/outside/);
  });

  it("is never refused for the statewide coordinator", () => {
    expect(
      commandScopeRefusal(state, STATEWIDE_COORDINATOR, { type: "X", admissionId: otherAdmission.id }, options),
    ).toBeNull();
  });
});
