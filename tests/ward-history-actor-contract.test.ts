import { describe, expect, it } from "vitest";
import { appendAudit, isHistoryLine, type AuditEvent } from "@/components/ward-management/ward-audit";
import { AUDIT_CATEGORY, isHistoryExclusion } from "@/components/ward-management/ward-audit-categories";
import { deskFor } from "@/components/ward-management/ward-desk";
import { COORDINATOR_STEP_ROLES, stampDesk } from "@/components/ward-management/ward-desk-stamp";
import { eventDesk } from "@/components/ward-management/ward-desk-stamp-shape";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { historyActorLabel } from "@/components/ward-management/ward-history-lines";
import { STATEWIDE_COORDINATOR, type WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { startsAcceptedJourneyAtEd } from "@/components/ward-management/referrals/accepted-awaiting-pull";
import { acceptedAddressing } from "@/components/ward-management/ward-referrals";
import { observationAt } from "@/components/ward-management/ward-observation";

/**
 * D-222 (R-STRUCT-6): every save names the desk that sent it. For every event type, sent as two
 * desks (the statewide coordinator, and the first other desk the type allows), the reducer boundary
 * writes exactly one History line, and that line names the sender's desk from the session stamp,
 * never the role a screen typed. Excluded types write none. Synthetic seed only.
 */
type EventType = WardFlowEvent["type"];
const EVENT_TYPES = Object.keys(EVENT_ROLE) as EventType[];

const seed = seedWardFlowState();
const wardUnit = seed.units[0]!.id;
const DESK_ACCESS: Record<string, WardAccess> = {
  ward: { role: "ward", scope: { kind: "ward", unitIds: [wardUnit] } },
  ed: { role: "ed", scope: { kind: "ed", edId: allEmergencyDepartments()[0]!.id } },
  community: { role: "community", scope: { kind: "team", teamName: "Synthetic community team" } },
  officer: { role: "officer", scope: { kind: "jobs" } },
  bed_manager: { role: "bed_manager", scope: { kind: "site", siteCode: "SYN" } },
};

/** The first desk other than the coordinator that `EVENT_ROLE` lets send `type`, else a ward desk. */
function otherDesk(type: EventType): WardAccess {
  const role = EVENT_ROLE[type].find(
    (candidate) => candidate !== "coordinator" && Object.hasOwn(DESK_ACCESS, candidate),
  );
  return DESK_ACCESS[role ?? "ward"]!;
}

/** A bare change as a screen would type it: the screen's role is deliberately not the sender's. */
function bare(type: EventType): WardFlowEvent {
  const typed = EVENT_ROLE[type].includes("ward") ? "ward" : EVENT_ROLE[type][0]!;
  return { type, role: typed, now: NOW_ANCHOR } as unknown as WardFlowEvent;
}

/** A save the reducer accepted: the state changed and nothing was refused. */
function changed(state: WardFlowState): WardFlowState {
  return { ...state, units: [...state.units] };
}

function linesFor(event: WardFlowEvent): AuditEvent[] {
  const after = appendAudit(seed, changed(seed), event, { outcome: "denied", reasonCode: "transition" });
  return after.auditEvents.slice(seed.auditEvents.length);
}

describe("Every save writes one History line naming the desk that sent it (D-222)", () => {
  it("covers every event type", () => {
    expect(EVENT_TYPES.length).toBeGreaterThan(200);
    expect(Object.keys(AUDIT_CATEGORY).sort()).toEqual([...EVENT_TYPES].sort());
  });

  for (const type of EVENT_TYPES) {
    const excluded = isHistoryExclusion(AUDIT_CATEGORY[type]);
    it(`${type}: ${excluded ? "writes no line" : "one line per desk, naming the sender"}`, () => {
      for (const access of [STATEWIDE_COORDINATOR, otherDesk(type)]) {
        const desk = deskFor(access);
        const event = stampDesk(bare(type), desk);
        expect(eventDesk(event)?.role, type).toBe(desk.role);
        const lines = linesFor(event);
        if (excluded) {
          expect(lines, `${type} as ${access.role}`).toHaveLength(0);
          continue;
        }
        expect(lines, `${type} as ${access.role}`).toHaveLength(1);
        const [line] = lines;
        expect(line!.actor.role, `${type} as ${access.role}`).toBe(desk.role);
        expect(line!.actor.attribution).toBe("desk-session");
        expect(line!.actor.scope).toEqual(access.scope);
      }
    });
  }

  it("keeps an unstamped change's actor as the typed role (stored rows read as before)", () => {
    const [line] = linesFor(bare("SET_BED_CLOSED"));
    expect(line!.actor).toMatchObject({ role: "ward", attribution: "declared-prototype-role" });
  });

  it("replaces a stamp the sender supplied, so a change never names a desk it did not come from", () => {
    const forged = { ...bare("SET_BED_CLOSED"), desk: { role: "coordinator", scope: { kind: "statewide" } } };
    const event = stampDesk(forged as WardFlowEvent, deskFor(DESK_ACCESS.ward!));
    expect(eventDesk(event)).toEqual({ role: "ward", scope: DESK_ACCESS.ward!.scope });
  });

  it("pins the coordinator's kept step roles: Delivered stays the officer's step and names the coordinator", () => {
    expect(COORDINATOR_STEP_ROLES.map(({ type, role }) => `${type}:${role}`)).toEqual([
      "PATIENT_ARRIVED:officer",
      "MARK_NOTICE_READ:coordinator",
    ]);
    const delivered = stampDesk(
      { type: "PATIENT_ARRIVED", role: "officer", now: NOW_ANCHOR, movementId: "x" } as WardFlowEvent,
      deskFor(STATEWIDE_COORDINATOR),
    );
    expect(delivered.role).toBe("officer");
    const [line] = linesFor(delivered);
    expect(line!.actor).toMatchObject({ role: "coordinator", asRole: "officer", attribution: "desk-session" });
    expect(historyActorLabel(line!.actor)).toBe("Bed coordinator, as transport officer");
    // Any other desk records under its own role.
    const officer = stampDesk(delivered, deskFor(DESK_ACCESS.ward!));
    expect(officer.role).toBe("ward");
  });

  it("records a coordinator's step on a ward page as the coordinator, for that ward", () => {
    const unitName = (id: string) => seed.units.find((unit) => unit.id === id)?.name;
    const event = stampDesk(
      { ...bare("SET_BED_CLOSED"), actingUnitId: wardUnit } as WardFlowEvent,
      deskFor(STATEWIDE_COORDINATOR),
    );
    expect(event.role).toBe("coordinator");
    const [line] = linesFor(event);
    expect(line!.actor).toMatchObject({ role: "coordinator", actingUnitId: wardUnit });
    expect(historyActorLabel(line!.actor, { unit: unitName })).toBe(`Bed coordinator, for ${unitName(wardUnit)}`);
  });
});

describe("History lines through the reducer (D-222 findings)", () => {
  const unit = seed.units.find((candidate) => !candidate.intakeWindow)!;
  const coordinator = deskFor(STATEWIDE_COORDINATOR);
  const intake = (role: "ward" | "coordinator") =>
    stampDesk(
      {
        type: "SET_INTAKE_WINDOW",
        role,
        now: NOW_ANCHOR,
        unitId: unit.id,
        actingUnitId: unit.id,
        intake: { from: NOW_ANCHOR + 180, to: NOW_ANCHOR + 360 },
      } as WardFlowEvent,
      role === "coordinator" ? coordinator : deskFor({ role: "ward", scope: { kind: "ward", unitIds: [unit.id] } }),
    );

  it("RV2-8: intake hours from the ward page write one line naming the coordinator, and the record says so", () => {
    const after = wardFlowReducer(seed, intake("coordinator"));
    expect(after.rejections).toEqual([]);
    const lines = after.auditEvents.slice(seed.auditEvents.length);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      category: "beds-and-wards",
      action: "SET_INTAKE_WINDOW",
      outcome: "accepted",
      subject: { kind: "unit", unitId: unit.id },
      actor: { role: "coordinator", actingUnitId: unit.id, attribution: "desk-session" },
    });
    expect(isHistoryLine(lines[0]!)).toBe(true);
    expect(after.units.find((candidate) => candidate.id === unit.id)?.intakeWindow?.by).toBe("Bed coordinator");
  });

  it("a History line cannot be put on the Review list", () => {
    const after = wardFlowReducer(seed, intake("coordinator"));
    const [line] = after.auditEvents.slice(seed.auditEvents.length);
    const reviewed = wardFlowReducer(after, {
      type: "REVIEW_AUDIT_EVENT",
      role: "coordinator",
      now: NOW_ANCHOR,
      eventId: line!.id,
      expectedGeneration: after.worldGeneration,
      expectedReviewCount: 0,
      decision: "reviewed",
    } as WardFlowEvent);
    expect(reviewed.auditReviews).toHaveLength(after.auditReviews.length);
    expect(reviewed.auditEvents.at(-1)).toMatchObject({ action: "REVIEW_AUDIT_EVENT", outcome: "denied" });
  });

  it("the ward's own save names the ward", () => {
    const after = wardFlowReducer(seed, intake("ward"));
    const [line] = after.auditEvents.slice(seed.auditEvents.length);
    expect(line!.actor).toMatchObject({ role: "ward", actingUnitId: unit.id, attribution: "desk-session" });
  });

  it("a refused History-only save writes no line", () => {
    const refused = stampDesk(
      {
        type: "SET_INTAKE_WINDOW",
        role: "ward",
        now: NOW_ANCHOR,
        unitId: "no-such-ward",
        intake: null,
      } as WardFlowEvent,
      coordinator,
    );
    const after = wardFlowReducer(seed, refused);
    expect(after.rejections.length).toBeGreaterThan(0);
    expect(after.auditEvents).toHaveLength(seed.auditEvents.length);
  });

  it("Pull the bed writes one line for the one tap, and releasing the pulled bed writes its own (A2-4)", () => {
    const [item] = acceptedReferralsAwaitingPull(seed.referrals, seed.units, seed.movements);
    const { referral, unitId } = item!;
    const destination = acceptedAddressing(referral)!.destination;
    if (destination.kind !== "psychiatric_ward") throw new Error("seed referral was not accepted at a ward");
    const ed = startsAcceptedJourneyAtEd(referral.source)
      ? allEmergencyDepartments().find((place) => place.siteCode === referral.originSiteCode)
      : undefined;
    const raise = stampDesk(
      {
        type: "RAISE_REFERRAL",
        role: "coordinator",
        now: NOW_ANCHOR,
        ...(ed ? { edId: ed.id } : {}),
        referralId: referral.id,
        acceptedUnitId: unitId,
        pullBed: true,
        draft: {
          cohort: referral.ageBand!,
          security: destination.secureBedNeeded ? "Secure" : "Open",
          sex: destination.sex,
          gender: destination.gender,
          highAcuity: destination.highAcuityNursingNeeded === true,
          observation: observationAt("general"),
          legalStatus: "Voluntary",
          legalFormCode: null,
          urgency: referral.urgency,
          atsCategory: referral.atsCategory,
        },
      } as WardFlowEvent,
      coordinator,
    );
    const pulled = wardFlowReducer(seed, raise);
    expect(pulled.rejections).toEqual([]);
    const lines = pulled.auditEvents.slice(seed.auditEvents.length);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ action: "RAISE_REFERRAL", outcome: "accepted", actor: { role: "coordinator" } });
    const journey = pulled.movements.find((movement) => movement.referralId === referral.id)!;
    const released = wardFlowReducer(
      pulled,
      stampDesk(
        {
          type: "RELEASE_PULL",
          role: "coordinator",
          now: NOW_ANCHOR,
          movementId: journey.id,
          reason: "pull_made_in_error",
        } as WardFlowEvent,
        coordinator,
      ),
    );
    expect(released.rejections).toEqual([]);
    const [release] = released.auditEvents.slice(pulled.auditEvents.length);
    expect(release).toMatchObject({
      category: "pulled-bed",
      action: "RELEASE_PULL",
      outcome: "accepted",
      subject: { kind: "movement", movementId: journey.id },
      details: { kind: "history-line", line: { unitId, reason: "pull_made_in_error" } },
    });
  });
});
