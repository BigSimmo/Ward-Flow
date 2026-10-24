import { describe, expect, it } from "vitest";

import { parseAccess } from "../backend/ward-flow/engine";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { commandScopeRefusal, scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import { seedWardFlowState, type WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { HEALTH_SERVICES, type Movement, type Referral } from "../src/components/ward-management/ward-model";
import type { Notice } from "../src/components/ward-management/ward-model";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { parseStoredAccess } from "../src/components/ward-management/shell/ward-access-store";
import { placeOptions } from "../src/components/ward-management/shell/ward-access-labels";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/** D-80 item 7: a granted transport officer works its own service's jobs, with the referral's risk flags. */
const state = seedWardFlowState();
const places = wardPlaceLookup(state.units);
const options = { now: NOW_ANCHOR, places };
const isJob = (movement: Movement) =>
  movement.transport !== undefined && movement.transport.arrivedAt === undefined && movement.closure === undefined;
const jobs = state.movements.filter(isJob);
const officerOf = (service?: (typeof HEALTH_SERVICES)[number]): WardAccess => ({
  role: "officer",
  scope: service === undefined ? { kind: "jobs" } : { kind: "jobs", service },
});
const serviceOf = (movement: Movement) =>
  (movement.originEdId === undefined ? undefined : places.edService(movement.originEdId)) ??
  (movement.acceptedUnitId === undefined ? undefined : places.unitService(movement.acceptedUnitId));
const jobIds = (world: WardFlowState, access: WardAccess) =>
  scopeWardFlowState(world, access, options)
    .state.movements.map((movement) => movement.id)
    .sort();

describe("transport officer jobs by service (D-80 item 7)", () => {
  it("gives the demo officer desk every open job and a service officer only its own", () => {
    expect(jobs.length).toBeGreaterThan(1);
    expect(jobIds(state, officerOf())).toEqual(jobs.map((job) => job.id).sort());
    const withJobs = HEALTH_SERVICES.filter((service) => jobs.some((job) => serviceOf(job) === service));
    expect(withJobs.length, "the seed has jobs in more than one service").toBeGreaterThan(1);
    for (const service of HEALTH_SERVICES) {
      const seen = jobIds(state, officerOf(service));
      const own = jobs.filter(
        (job) =>
          (job.originEdId !== undefined && places.edService(job.originEdId) === service) ||
          (job.acceptedUnitId !== undefined && places.unitService(job.acceptedUnitId) === service),
      );
      expect(seen, service).toEqual(own.map((job) => job.id).sort());
    }
  });

  it("refuses a service officer's change to another service's job", () => {
    const [service] = HEALTH_SERVICES.filter((candidate) => jobs.some((job) => serviceOf(job) === candidate));
    const elsewhere = jobs.find(
      (job) =>
        serviceOf(job) !== service &&
        (job.acceptedUnitId === undefined || places.unitService(job.acceptedUnitId) !== service),
    )!;
    const own = jobs.find((job) => serviceOf(job) === service)!;
    const officer = officerOf(service);
    expect(commandScopeRefusal(state, officer, { type: "TRANSPORT_EN_ROUTE", movementId: elsewhere.id }, options)).toBe(
      "This change names a record outside your role's place.",
    );
    expect(commandScopeRefusal(state, officer, { type: "TRANSPORT_EN_ROUTE", movementId: own.id }, options)).toBeNull();
  });

  it("keeps another service's job notices from a service officer", () => {
    const [service] = HEALTH_SERVICES.filter((candidate) => jobs.some((job) => serviceOf(job) === candidate));
    const elsewhere = jobs.find((job) => serviceOf(job) !== service)!;
    const own = jobs.find((job) => serviceOf(job) === service)!;
    const notice = (movementId: string, id: string) =>
      ({
        id,
        raisedAt: NOW_ANCHOR,
        to: { role: "officer" },
        about: { movementId },
        kind: "transport_cancelled_officer",
        text: `Transport for ${movementId} was cancelled.`,
      }) as unknown as Notice;
    const world = {
      ...state,
      notices: [...state.notices, notice(elsewhere.id, "N-OFFICER-ELSEWHERE"), notice(own.id, "N-OFFICER-OWN")],
    };
    const ids = scopeWardFlowState(world, officerOf(service), options).state.notices.map((item) => item.id);
    expect(ids).toContain("N-OFFICER-OWN");
    expect(ids).not.toContain("N-OFFICER-ELSEWHERE");
    expect(scopeWardFlowState(world, officerOf(), options).state.notices.map((item) => item.id)).toContain(
      "N-OFFICER-ELSEWHERE",
    );
  });

  it("puts the referral's risk categories on the collection, and nothing else of the referral", () => {
    const job = jobs[0];
    const referral = state.referrals[0];
    const intake = { riskFlags: ["aggression", "suicide"] } as unknown as NonNullable<Referral["intake"]>;
    const world = {
      ...state,
      movements: state.movements.map((movement) =>
        movement.id === job.id ? { ...movement, referralId: referral.id } : movement,
      ),
      referrals: state.referrals.map((candidate) =>
        candidate.id === referral.id ? { ...candidate, intake } : candidate,
      ),
    };
    const scoped = scopeWardFlowState(world, officerOf(), options).state;
    const copy = scoped.movements.find((movement) => movement.id === job.id)!;
    expect(copy.collectionRiskFlags).toEqual(["aggression", "suicide"]);
    expect(scoped.referrals).toEqual([]);
    // No flags recorded means no flags field, never an inferred "none".
    const plain = scopeWardFlowState(state, officerOf(), options).state.movements;
    expect(plain.every((movement) => movement.collectionRiskFlags === undefined)).toBe(true);
    // The stored record itself never gains the field.
    expect(world.movements.find((movement) => movement.id === job.id)!.collectionRiskFlags).toBeUndefined();
  });

  it("keeps the jobs and flags when the browser scopes the server's officer copy again", () => {
    const [service] = HEALTH_SERVICES.filter((candidate) => jobs.some((job) => serviceOf(job) === candidate));
    const stay = state.admissions.find((admission) => places.unitService(admission.unitId) === service)!;
    const elsewhereWard = state.units.find((unit) => places.unitService(unit.id) !== service)!;
    const job = jobs[0];
    const referral = state.referrals[0];
    const intake = { riskFlags: ["absconding"] } as unknown as NonNullable<Referral["intake"]>;
    // A ward to ward journey from this service's ward to another service's ward.
    const wardToWard = {
      ...job,
      originEdId: undefined,
      sourceAdmissionId: stay.id,
      acceptedUnitId: elsewhereWard.id,
      referralId: referral.id,
    } as Movement;
    const world = {
      ...state,
      movements: state.movements.map((movement) => (movement.id === job.id ? wardToWard : movement)),
      referrals: state.referrals.map((candidate) =>
        candidate.id === referral.id ? { ...candidate, intake } : candidate,
      ),
    };
    const officer = officerOf(service);
    const server = scopeWardFlowState(world, officer, options).state;
    const browser = scopeWardFlowState(server, officer, options).state;
    expect(browser.movements.map((movement) => movement.id)).toEqual(server.movements.map((movement) => movement.id));
    const copy = browser.movements.find((movement) => movement.id === job.id)!;
    expect(copy.collectionRiskFlags).toEqual(["absconding"]);
    expect(copy.collectionFromUnitId).toBe(stay.unitId);
  });

  it("makes the server require a service, and the admin offer only service officer places", () => {
    expect(parseAccess("officer", { kind: "jobs" })).toBeNull();
    expect(parseAccess("officer", { kind: "jobs", service: "Not a service" })).toBeNull();
    expect(parseAccess("officer", { kind: "jobs", service: HEALTH_SERVICES[0] })).toEqual(
      officerOf(HEALTH_SERVICES[0]),
    );
    expect(parseStoredAccess(JSON.stringify(officerOf()))).toEqual(officerOf());
    expect(parseStoredAccess(JSON.stringify(officerOf(HEALTH_SERVICES[1])))).toEqual(officerOf(HEALTH_SERVICES[1]));
    expect(parseStoredAccess(JSON.stringify({ role: "officer", scope: { kind: "jobs", service: 4 } }))).toBeNull();
    const offered = placeOptions("officer", state.units).map((option) => option.scope);
    expect(offered).toEqual(HEALTH_SERVICES.map((service) => ({ kind: "jobs", service })));
  });
});
