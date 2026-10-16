import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { commandScopeRefusal, scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { INBOX_CATEGORIES } from "../src/components/ward-management/ward-inbox-reducer";
import { syntheticGovernanceAuditEvents } from "../src/components/ward-management/ward-governance-seed";
import { STATEWIDE_COORDINATOR, type WardAccess } from "../src/components/ward-management/ward-role-access";
import { isValidSharedWardFlowState } from "../src/components/ward-management/ward-shared-state-validation";
import { mixSexOf } from "../src/components/ward-management/ward-eligibility";
import { unitHealthService } from "../src/components/ward-management/ward-service-scope";
import { WARD_SCENARIOS } from "../src/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const state = seedWardFlowState();
const places = wardPlaceLookup(state.units);
const options = { now: NOW_ANCHOR, places };
/** Checked as the wire carries it: JSON drops the `undefined` fields the seed builds with. */
const validOnTheWire = (value: WardFlowState) => isValidSharedWardFlowState(JSON.parse(JSON.stringify(value)));
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

describe("clinical contacts", () => {
  it("reach only the contacted team's own desk", () => {
    const community = desksFor(state).community;
    const teamName = community.scope.kind === "team" ? community.scope.teamName : "";
    const withContacts: WardFlowState = {
      ...state,
      clinicalContacts: [
        { teamId: places.teamSlug(teamName), at: NOW_ANCHOR, by: "ed" },
        { teamId: "another-team", at: NOW_ANCHOR, by: "ed" },
      ],
    };
    const contacts = (access: WardAccess) =>
      scopeWardFlowState(withContacts, access, options).state.clinicalContacts.map((contact) => contact.teamId);
    expect(contacts(community)).toEqual([places.teamSlug(teamName)]);
    expect(contacts(ward)).toEqual([]);
    expect(contacts(STATEWIDE_COORDINATOR)).toHaveLength(2);
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

  it("acts only from its own team, ED, sending ward or the coordinator desk", () => {
    const desks = desksFor(state);
    const community = desks.community;
    const teamName = community.scope.kind === "team" ? community.scope.teamName : "";
    const ownTeam = places.teamSlug(teamName);
    const book = (actingPlaceId: string) =>
      commandScopeRefusal(state, community, { type: "BOOK_TRANSPORT", role: "community", actingPlaceId }, options);
    expect(book(ownTeam)).toBeNull();
    expect(book(teamName)).toBeNull();
    expect(book("another-team")).toMatch(/outside/);
    // The coordinator desk withdraws a referral as "coordinator"; a ward desk may not claim it.
    const withdraw = (access: WardAccess, role: string) =>
      commandScopeRefusal(state, access, { type: "WITHDRAW_REFERRAL", role, actingPlaceId: "coordinator" }, options);
    expect(withdraw(desks.serviceCoordinator, "coordinator")).toBeNull();
    expect(withdraw(ward, "ward")).toMatch(/outside/);
    // A referral's origin is the desk's own ED or ward; its destinations may be anywhere.
    const ed = desks.ed;
    const ownEd = ed.scope.kind === "ed" ? ed.scope.edId : "";
    const otherEd = state.movements.find((movement) => movement.originEdId !== ownEd)!.originEdId;
    const raise = (edId: string) =>
      commandScopeRefusal(state, ed, { type: "RAISE_REFERRAL", role: "ed", edId }, options);
    expect(raise(ownEd)).toBeNull();
    expect(raise(otherEd)).toMatch(/outside/);
    const other = state.units.find((unit) => unit.id !== ownUnit)!.id;
    const receive = (originUnitId: string) =>
      commandScopeRefusal(
        state,
        ward,
        { type: "RECEIVE_REFERRAL", role: "community", originUnitId, destinations: [{ kind: "unit", unitId: other }] },
        options,
      );
    expect(receive(ownUnit)).toBeNull();
    expect(receive(other)).toMatch(/outside/);
  });

  it("is refused when a service coordinator names an audit entry or review outside its service", () => {
    const service = unitHealthService(state.units.find((unit) => unit.id === ownUnit)!)!;
    const serviceCoordinator: WardAccess = { role: "coordinator", scope: { kind: "service", service } };
    const stayIn = (inService: boolean) =>
      state.admissions.find(
        (admission) =>
          admission.patientId !== null &&
          (unitHealthService(state.units.find((unit) => unit.id === admission.unitId)!) === service) === inService,
      )!;
    const entry = (id: string, admission: (typeof state.admissions)[number]) =>
      ({
        id,
        sequence: 1,
        generation: state.worldGeneration,
        at: NOW_ANCHOR,
        actor: { role: "ward", actingUnitId: admission.unitId, attribution: "declared-prototype-role" },
        subject: {
          kind: "admission",
          admissionId: admission.id,
          unitId: admission.unitId,
          patientId: admission.patientId,
        },
        outcome: "accepted",
        reasonCode: "none",
        origin: "captured-this-session",
      }) as unknown as WardFlowState["auditEvents"][number];
    const review = (id: string, eventId: string) =>
      ({
        id,
        eventId,
        generation: state.worldGeneration,
        at: NOW_ANCHOR,
        byRole: "coordinator",
        decision: "reviewed",
      }) as const;
    const world: WardFlowState = {
      ...state,
      auditEvents: [entry("audit-in", stayIn(true)), entry("audit-out", stayIn(false))],
      auditReviews: [review("review-in", "audit-in"), review("review-out", "audit-out")],
    };
    const send = (command: Record<string, unknown>) =>
      commandScopeRefusal(world, serviceCoordinator, { role: "coordinator", ...command }, options);
    expect(send({ type: "REVIEW_AUDIT_EVENT", eventId: "audit-in" })).toBeNull();
    expect(send({ type: "REVIEW_AUDIT_EVENT", eventId: "audit-out" })).toMatch(/outside/);
    expect(send({ type: "UNDO_AUDIT_REVIEW", reviewId: "review-in" })).toBeNull();
    expect(send({ type: "UNDO_AUDIT_REVIEW", reviewId: "review-out" })).toMatch(/outside/);
  });

  it("lets a service coordinator see and review just the seeded governance entries its own screens show", () => {
    const withReviews = (world: WardFlowState): WardFlowState => ({
      ...world,
      auditReviews: syntheticGovernanceAuditEvents(world).map((event, index) => ({
        id: `review-seed-${index}`,
        eventId: event.id,
        generation: world.worldGeneration,
        at: NOW_ANCHOR,
        byRole: "coordinator",
        decision: "reviewed",
      })),
    });
    const verdicts = (world: WardFlowState, access: WardAccess) => {
      const sent = scopeWardFlowState(world, access, options).state;
      // The browser derives its seeded entries from the workspace it was sent.
      const shown = new Set(syntheticGovernanceAuditEvents(sent).map((event) => event.id));
      return syntheticGovernanceAuditEvents(world).map((event) => {
        const allowed =
          commandScopeRefusal(
            world,
            access,
            { type: "REVIEW_AUDIT_EVENT", role: "coordinator", eventId: event.id },
            options,
          ) === null;
        expect(sent.auditReviews.some((review) => review.eventId === event.id)).toBe(shown.has(event.id));
        expect(allowed).toBe(shown.has(event.id));
        return { id: event.id, allowed };
      });
    };
    const services = [...new Set(state.units.map((unit) => unitHealthService(unit)!))];
    for (const service of services)
      verdicts(withReviews(state), { role: "coordinator", scope: { kind: "service", service } });
    // A service with no referral of its own shows no referral entry, so it is neither sent its review
    // nor may it review it, though the whole network still has one.
    const service = services[0];
    const access: WardAccess = { role: "coordinator", scope: { kind: "service", service } };
    const own = new Set(scopeWardFlowState(state, access, options).state.referrals.map((referral) => referral.id));
    const world = withReviews({ ...state, referrals: state.referrals.filter((referral) => !own.has(referral.id)) });
    expect(verdicts(world, access).find((verdict) => verdict.id.startsWith("audit-seed-referral-override:"))).toEqual(
      expect.objectContaining({ allowed: false }),
    );
  });

  it("keeps each desk's review of a seeded entry to the record it is about", () => {
    const services = [...new Set(state.units.map((unit) => unitHealthService(unit)!))];
    const desks = services.map((service): WardAccess => ({ role: "coordinator", scope: { kind: "service", service } }));
    const shownBy = desks.map(
      (access) =>
        new Set(syntheticGovernanceAuditEvents(scopeWardFlowState(state, access, options).state).map((e) => e.id)),
    );
    // Each desk reviews every seeded entry its own screens show.
    const world: WardFlowState = {
      ...state,
      auditReviews: shownBy.flatMap((shown, desk) =>
        [...shown].map((eventId) => ({
          id: `review-${desk}-${eventId}`,
          eventId,
          generation: state.worldGeneration,
          at: NOW_ANCHOR,
          byRole: "coordinator" as const,
          decision: "reviewed" as const,
        })),
      ),
    };
    // Two desks show the same kind of entry about different records, so it has two ids.
    const legal = shownBy.map((shown) => [...shown].find((id) => id.startsWith("audit-seed-legal-status:")));
    expect(new Set(legal.filter(Boolean)).size).toBeGreaterThan(1);
    // The whole workspace accepts a review of every entry a desk shows, not only its own first records.
    for (const eventId of shownBy.flatMap((shown) => [...shown])) {
      const reviewed = wardFlowReducer(state, {
        type: "REVIEW_AUDIT_EVENT",
        role: "coordinator",
        now: NOW_ANCHOR,
        eventId,
        expectedGeneration: state.worldGeneration,
        expectedReviewCount: 0,
        decision: "reviewed",
      } as WardFlowEvent);
      expect(reviewed.auditReviews.map((review) => review.eventId)).toEqual([eventId]);
    }
    // A desk may name only the entries its own screens show, never another desk's.
    desks.forEach((access, desk) => {
      for (const eventId of shownBy.flatMap((shown) => [...shown]).filter((id) => !shownBy[desk].has(id)))
        expect(
          commandScopeRefusal(state, access, { type: "REVIEW_AUDIT_EVENT", role: "coordinator", eventId }, options),
        ).toMatch(/outside/);
    });
    // An entry no desk can show is not found: a record never sits further forward in a desk's part.
    const invented = wardFlowReducer(state, {
      type: "REVIEW_AUDIT_EVENT",
      role: "coordinator",
      now: NOW_ANCHOR,
      eventId: `audit-seed-refer-to-units:${state.movements[0].id}`,
      expectedGeneration: state.worldGeneration,
      expectedReviewCount: 0,
      decision: "reviewed",
    } as WardFlowEvent);
    expect(invented.auditReviews).toEqual([]);
    desks.forEach((access, desk) => {
      const sent = scopeWardFlowState(world, access, options).state.auditReviews;
      // A desk is sent a review only when its own screens show that entry, never another desk's
      // review of an entry about a record it cannot see.
      for (const review of sent) expect(shownBy[desk].has(review.eventId)).toBe(true);
      expect(sent.some((review) => review.id.startsWith(`review-${desk}-`))).toBe(true);
    });
  });

  it("is never refused for the statewide coordinator", () => {
    expect(
      commandScopeRefusal(state, STATEWIDE_COORDINATOR, { type: "X", admissionId: otherAdmission.id }, options),
    ).toBeNull();
  });

  it("clamps unit.sexMix when closeReferences drops another ward's arrivalCapacityConflicts", () => {
    const targetUnit = state.units.find(
      (unit) =>
        unit.id !== ownUnit &&
        state.admissions.some((admission) => admission.unitId === unit.id && admission.state === "occupied"),
    )!;
    const targetAdmission = state.admissions.find(
      (admission) => admission.unitId === targetUnit.id && admission.state === "occupied",
    )!;
    const arrivedAt = targetAdmission.arrivedAt ?? NOW_ANCHOR - 10;
    // Outside the generated `WF-9…` namespace, so the fixture does not need the sequence advanced.
    const syntheticMovementId = "WF-0991" as const;
    const baseTemplate = state.movements[0];
    const syntheticConflictMovement = {
      ...baseTemplate,
      id: syntheticMovementId,
      sex: "Female" as const,
      gender: undefined,
      patientId: targetAdmission.patientId ?? undefined,
      referralId: targetAdmission.referralId ?? undefined,
      referralAbsence: targetAdmission.referralId ? undefined : { reason: "not_asked" as const, at: arrivedAt },
      acceptedUnitId: targetUnit.id,
      referredUnitIds: [targetUnit.id],
      stage: "arrived" as const,
      closure: { outcome: "arrived" as const, reason: "Arrived on ward", at: arrivedAt },
      admissionId: targetAdmission.id,
    };
    const overCapacityState: WardFlowState = {
      ...state,
      movements: [...state.movements, syntheticConflictMovement],
      admissions: state.admissions.map((admission) =>
        admission.id === targetAdmission.id
          ? {
              ...admission,
              movementId: syntheticMovementId,
              arrivedAt,
            }
          : admission,
      ),
      units: state.units.map((unit) =>
        unit.id === targetUnit.id
          ? {
              ...unit,
              sexMix: { Female: unit.beds, Male: 1 },
              arrivalCapacityConflicts: [
                {
                  movementId: syntheticMovementId,
                  admissionId: targetAdmission.id,
                  at: arrivedAt,
                },
              ],
            }
          : unit,
      ),
    };
    expect(validOnTheWire(overCapacityState)).toBe(true);
    const { state: scopedState } = scopeWardFlowState(overCapacityState, ward, options);
    const scopedTarget = scopedState.units.find((unit) => unit.id === targetUnit.id)!;
    expect(
      scopedTarget.arrivalCapacityConflicts?.some((conflict) => conflict.movementId === syntheticMovementId),
    ).toBeFalsy();
    expect(scopedTarget.sexMix.Female + scopedTarget.sexMix.Male).toBeLessThanOrEqual(scopedTarget.beds);
    // Only the cut arrival comes out, from its own recorded sex's bucket: never a guessed one.
    const arrivedSex = mixSexOf(syntheticConflictMovement.gender, syntheticConflictMovement.sex)!;
    const otherSex = arrivedSex === "Female" ? "Male" : "Female";
    const before = overCapacityState.units.find((unit) => unit.id === targetUnit.id)!.sexMix;
    expect(scopedTarget.sexMix[arrivedSex]).toBe(before[arrivedSex] - 1);
    expect(scopedTarget.sexMix[otherSex]).toBe(before[otherSex]);
    expect(validOnTheWire(scopedState)).toBe(true);
    // A desk that is sent the arrival keeps the authoritative counts.
    const statewideView = scopeWardFlowState(overCapacityState, STATEWIDE_COORDINATOR, options).state;
    expect(statewideView.units.find((unit) => unit.id === targetUnit.id)!.sexMix).toEqual(before);
  });

  it("validates and accepts supportNotifications in isValidSharedWardFlowState", () => {
    const arrivedMovementId = "WF-0992" as const;
    const arrivedMovement = {
      ...state.movements[0],
      id: arrivedMovementId,
      patientId: occupied.patientId ?? undefined,
      referralId: occupied.referralId ?? undefined,
      referralAbsence: occupied.referralId ? undefined : { reason: "not_asked" as const, at: NOW_ANCHOR - 10 },
      acceptedUnitId: ownUnit,
      referredUnitIds: [ownUnit],
      legalStatus: "Involuntary inpatient" as const,
      stage: "arrived" as const,
      closure: { outcome: "arrived" as const, reason: "Arrived on ward", at: NOW_ANCHOR - 10 },
      admissionId: occupied.id,
    };
    const arrivedSeed: WardFlowState = {
      ...state,
      movements: [...state.movements, arrivedMovement],
      admissions: state.admissions.map((admission) =>
        admission.id === occupied.id ? { ...admission, movementId: arrivedMovementId } : admission,
      ),
    };
    const withNotification = wardFlowReducer(arrivedSeed, {
      type: "RECORD_SUPPORT_NOTIFICATION",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: arrivedMovementId,
      occasion: "admission",
      party: "carer",
      outcome: "told",
      who: "Primary carer",
      contactedAt: NOW_ANCHOR - 5,
    });
    expect(withNotification.supportNotifications?.length).toBeGreaterThan(0);
    expect(validOnTheWire(withNotification)).toBe(true);
    const { state: scopedWithNotification } = scopeWardFlowState(withNotification, ward, options);
    expect(scopedWithNotification.supportNotifications?.length).toBeGreaterThan(0);
    expect(validOnTheWire(scopedWithNotification)).toBe(true);

    const malformed: WardFlowState = {
      ...withNotification,
      supportNotifications: [
        {
          ...withNotification.supportNotifications![0],
          who: "",
        },
      ],
    };
    expect(validOnTheWire(malformed)).toBe(false);
  });
  it("keeps a receiving ward's arrival notifications from the sending ward", () => {
    const ownService = places.unitService(ownUnit);
    const otherUnit = state.units.find((unit) => places.unitService(unit.id) !== ownService)!;
    const outboundId = "WF-0993" as const;
    const outbound = {
      ...state.movements[0],
      id: outboundId,
      patientId: occupied.patientId ?? undefined,
      sourceAdmissionId: occupied.id,
      acceptedUnitId: otherUnit.id,
      referredUnitIds: [otherUnit.id],
      stage: "arrived" as const,
      closure: { outcome: "arrived" as const, reason: "Arrived on ward", at: NOW_ANCHOR - 10 },
      admissionId: undefined,
    };
    const withOutbound: WardFlowState = {
      ...state,
      movements: [...state.movements, outbound],
      supportNotifications: [
        {
          id: "SN-1",
          occasion: "transfer",
          subjectId: outboundId,
          party: "carer",
          outcome: "told",
          who: "Primary carer",
          contactedAt: NOW_ANCHOR - 5,
          at: NOW_ANCHOR,
          by: "ward",
        },
      ],
    };
    const { state: senderView } = scopeWardFlowState(withOutbound, ward, options);
    // The sending ward still sees its outbound move, but not the receiving ward's notes about it.
    expect(senderView.movements.some((movement) => movement.id === outboundId)).toBe(true);
    expect(senderView.supportNotifications).toEqual([]);
    expect(
      commandScopeRefusal(
        withOutbound,
        ward,
        {
          type: "RECORD_SUPPORT_NOTIFICATION",
          role: "ward",
          now: NOW_ANCHOR,
          occasion: "transfer",
          movementId: outboundId,
          party: "carer",
          outcome: "not_applicable",
          reason: "Synthetic",
        },
        options,
      ),
    ).not.toBeNull();
    const receiver: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [otherUnit.id] } };
    const { state: receiverView } = scopeWardFlowState(withOutbound, receiver, options);
    expect(receiverView.supportNotifications?.map((record) => record.id)).toEqual(["SN-1"]);
    // Nor does the sending service's coordinator see another service's ward notes.
    const sendingCoordinator: WardAccess = { role: "coordinator", scope: { kind: "service", service: ownService! } };
    const { state: coordinatorView } = scopeWardFlowState(withOutbound, sendingCoordinator, options);
    expect(coordinatorView.supportNotifications).toEqual([]);
    const { state: statewideView } = scopeWardFlowState(withOutbound, STATEWIDE_COORDINATOR, options);
    expect(statewideView.supportNotifications?.map((record) => record.id)).toEqual(["SN-1"]);
  });
});
