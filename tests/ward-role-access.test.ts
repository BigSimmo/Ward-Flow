import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { directiveAcknowledgements } from "../src/components/ward-management/alerts/global-alert-view";
import type { BroadcastAlert } from "../src/components/ward-management/alerts/ward-broadcast-model";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR, allEmergencyDepartments } from "../src/components/ward-management/ward-sites";
import { GENDER_PLACEMENT_REASONS } from "../src/components/ward-management/ward-change-reasons";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { commandScopeRefusal, scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import { isValidSharedWardFlowState } from "../src/components/ward-management/ward-shared-state-validation";
import {
  coordinatorRecordScope,
  scopeBroadcastAlerts,
  scopeWorkspace,
  SMALL_NUMBER_NOT_SHOWN,
  smallNumberParts,
  smallNumberText,
} from "../src/components/ward-management/ward-access-scope";
import {
  ROLE_SCREENS,
  STATEWIDE_COORDINATOR,
  WARD_ACCESS_ROLES,
  WARD_SCREEN_IDS,
  accessIsValid,
  canBreakGlass,
  homeHrefFor,
  screenDecision,
  screenForPath,
  type WardAccess,
} from "../src/components/ward-management/ward-role-access";
import {
  breakGlass,
  lockWardDesk,
  parseStoredAccess,
  readWardAccessSnapshot,
  resetWardAccessStoreForTests,
  setWardAccess,
  startAccessPreview,
  endAccessPreview,
} from "../src/components/ward-management/shell/ward-access-store";

/**
 * Role access plan PR 1 (Josh, 15 Oct 2026). The table is pinned to the plan's section 4, every
 * route answers to it, and the scoped workspace never hands a desk a patient outside its care.
 */
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
const BASE = "/ward-flow";
const state = seedWardFlowState();
const places = wardPlaceLookup(state.units);
const unitId = state.units[0].id;
const wardDesk: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [unitId] } };

describe("the access table", () => {
  it("gives the coordinator every screen, whole", () => {
    for (const screen of WARD_SCREEN_IDS) expect(ROLE_SCREENS.coordinator[screen], screen).toBe("all");
  });

  it("gives the transport officer only transport, alerts, on-call and settings", () => {
    expect(Object.keys(ROLE_SCREENS.officer).sort()).toEqual(["alerts", "officer", "on-call", "settings"]);
  });

  it("lets the bed manager open patient pages at their own site (Josh, 15 Oct 2026)", () => {
    expect(ROLE_SCREENS.bed_manager.patient).toBe("own");
    expect(ROLE_SCREENS.bed_manager.search).toBe("own");
  });

  it("never gives the executive or access admin a patient page", () => {
    expect(ROLE_SCREENS.executive.patient).toBeUndefined();
    expect(ROLE_SCREENS.admin.patient).toBeUndefined();
    expect(ROLE_SCREENS.admin.search).toBeUndefined();
  });

  it("opens a service's statistics only to that service or the whole network", () => {
    const path = "/ward-flow/statistics/service/" + encodeURIComponent("North Metro");
    expect(screenForPath(path)).toMatchObject({ screen: "statistics", serviceId: "North Metro" });
    const north = { role: "executive", scope: { kind: "service", service: "North Metro" } } as const;
    const south = { role: "executive", scope: { kind: "service", service: "South Metro" } } as const;
    expect(screenDecision(north, screenForPath(path), places).open).toBe(true);
    expect(screenDecision(south, screenForPath(path), places)).toEqual({ open: false, why: "place" });
    expect(screenDecision(STATEWIDE_COORDINATOR, screenForPath(path), places).open).toBe(true);
  });

  it("reads the record id behind a coded patient or movement address, so the access check sees the person", () => {
    // D-39 links carry a code, never the id. The page check compares ids, so the code is read first.
    expect(screenForPath(patientHref("PT-0001"))).toEqual({ screen: "patient", patientId: "PT-0001" });
    expect(screenForPath(movementHref("WF-012"))).toEqual({ screen: "movements", movementId: "WF-012" });
    // An old link with the raw id still names the same record.
    expect(screenForPath(`${BASE}/people/PT-0001`)).toEqual({ screen: "patient", patientId: "PT-0001" });
  });

  it("keeps a one-ED or one-team desk out of the index of every ED or team", () => {
    const ed = { role: "ed", scope: { kind: "ed", edId: "x" } } as const;
    expect(screenDecision(ed, screenForPath(`${BASE}/ed`), places)).toEqual({ open: false, why: "place" });
    expect(screenDecision(ed, screenForPath(`${BASE}/ed/x`), places).open).toBe(true);
    const team = { role: "community", scope: { kind: "team", teamName: "Any team" } } as const;
    expect(screenDecision(team, screenForPath(`${BASE}/community`), places)).toEqual({ open: false, why: "place" });
  });

  it("lets only clinical roles break glass", () => {
    expect(WARD_ACCESS_ROLES.filter(canBreakGlass).sort()).toEqual(["bed_manager", "community", "ed", "ward"]);
  });

  it("refuses a scope a role may not hold", () => {
    expect(accessIsValid({ role: "ward", scope: { kind: "statewide" } })).toBe(false);
    expect(accessIsValid(wardDesk)).toBe(true);
  });
});

/** Every page the app has, with a sample id in each dynamic segment. */
function appRoutes(): string[] {
  const root = join(process.cwd(), "src/app/ward-flow");
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name === "page.tsx") found.push(relative(root, dir).replace(/\\/g, "/"));
    }
  };
  walk(root);
  return found.map((route) => `${BASE}${route ? `/${route.replace(/\[[^\]]+\]/g, "sample")}` : ""}`);
}

describe("every route answers to the table", () => {
  it("maps each page to a screen, so a new page is closed to every role but the coordinator until listed", () => {
    // The design showcase is a developer page (shell-20): coordinator only, by default deny.
    const developerOnly = new Set([`${BASE}/sovereign`]);
    const unmapped = appRoutes().filter((route) => !developerOnly.has(route) && screenForPath(route) === undefined);
    expect(unmapped).toEqual([]);
  });

  it("closes another ward's page to a ward desk, and opens its own", () => {
    const other = state.units.find((unit) => unit.id !== unitId)!;
    expect(screenDecision(wardDesk, screenForPath(`${BASE}/ward/${unitId}`), places)).toEqual({
      open: true,
      grant: "own",
    });
    expect(screenDecision(wardDesk, screenForPath(`${BASE}/ward/${other.id}`), places)).toEqual({
      open: false,
      why: "place",
    });
    expect(screenDecision(wardDesk, screenForPath(`${BASE}/governance`), places)).toEqual({ open: false, why: "role" });
  });

  it("closes an unknown address to everyone but the coordinator", () => {
    expect(screenDecision(wardDesk, screenForPath(`${BASE}/not-a-page`), places).open).toBe(false);
    expect(screenDecision(STATEWIDE_COORDINATOR, screenForPath(`${BASE}/governance`), places).open).toBe(true);
  });

  it("sends each desk home to its own place", () => {
    expect(homeHrefFor(wardDesk, (name) => name)).toBe(`${BASE}/ward/${unitId}`);
    expect(homeHrefFor({ role: "officer", scope: { kind: "jobs" } }, (name) => name)).toBe(`${BASE}/transport/officer`);
  });
});

describe("the scoped workspace", () => {
  const scope = (access: WardAccess, grants?: { patientId: string; until: number }[]) =>
    scopeWorkspace(state, access, { now: NOW_ANCHOR, places, grants });

  it("returns the whole workspace to the statewide coordinator", () => {
    const whole = scope(STATEWIDE_COORDINATOR);
    expect(whole.patients).toBe(state.patients);
    expect(whole.movements).toBe(state.movements);
  });

  it("gives a ward desk only its own ward's movements and stays, and only their patients", () => {
    const scoped = scope(wardDesk);
    for (const movement of scoped.movements)
      expect([movement.acceptedUnitId, ...movement.referredUnitIds]).toContain(unitId);
    for (const admission of scoped.admissions) expect(admission.unitId).toBe(unitId);
    const linked = new Set(
      [...scoped.movements, ...scoped.admissions, ...scoped.referrals].map((item) => item.patientId).filter(Boolean),
    );
    for (const patient of scoped.patients) expect(linked.has(patient.id), patient.id).toBe(true);
    for (const referral of scoped.referrals)
      for (const line of referral.destinations) expect(line.destination.kind).toBe("psychiatric_ward");
  });

  it("canary: a patient with nothing at the desk's ward never reaches it, until glass is broken", () => {
    const scoped = scope(wardDesk);
    const outside = state.patients.find((patient) => !scoped.patients.some((seen) => seen.id === patient.id));
    expect(outside, "the seed needs a patient outside the ward").toBeDefined();
    expect(scoped.patients.map((patient) => patient.id)).not.toContain(outside!.id);
    const glass = scope(wardDesk, [{ patientId: outside!.id, until: NOW_ANCHOR + 60 }]);
    expect(glass.patients.map((patient) => patient.id)).toContain(outside!.id);
    expect(glass.breakGlassPatientIds.has(outside!.id)).toBe(true);
    const expired = scope(wardDesk, [{ patientId: outside!.id, until: NOW_ANCHOR }]);
    expect(expired.patients.map((patient) => patient.id)).not.toContain(outside!.id);
  });

  it("marks as read only only a patient seen through a grant, not one already in care", () => {
    const own = scope(wardDesk).patients[0];
    expect(own, "the seed needs a patient at the ward").toBeDefined();
    const glass = scope(wardDesk, [{ patientId: own.id, until: NOW_ANCHOR + 60 }]);
    expect(glass.breakGlassPatientIds.size).toBe(0);
  });

  it("shows a ward only its own lines of a referral sent to several wards", () => {
    const source = state.referrals.find((referral) =>
      referral.destinations.some((line) => line.destination.kind === "psychiatric_ward"),
    )!;
    const line = source.destinations.find((item) => item.destination.kind === "psychiatric_ward")!;
    const other = state.units.find((unit) => unit.id !== unitId)!;
    const asWard = (id: string) => ({
      ...line,
      acceptedUnitId: undefined,
      destination: { ...line.destination, unitId: id },
    });
    const parallel = { ...source, destinations: [asWard(unitId), asWard(other.id)] } as typeof source;
    const scoped = scopeWorkspace({ ...state, referrals: [parallel] }, wardDesk, { now: NOW_ANCHOR, places });
    const seen = scoped.referrals.find((referral) => referral.id === parallel.id);
    expect(seen?.destinations).toHaveLength(1);
    expect(seen?.destinations[0].destination).toMatchObject({ unitId });
  });

  it("gives a community team its catchment clients' stays as ward and dates only", () => {
    const admission = state.admissions.find((item) => item.patientId !== null)!;
    const patient = state.patients.find((item) => item.id === admission.patientId)!;
    const team = "Synthetic catchment team";
    const workspace = {
      ...state,
      referrals: [],
      patients: state.patients.map((item) =>
        item.id === patient.id ? { ...item, catchmentCommunityTeam: team } : item,
      ),
    };
    const scoped = scopeWorkspace(
      workspace,
      { role: "community", scope: { kind: "team", teamName: team } },
      { now: NOW_ANCHOR, places },
    );
    const seen = scoped.admissions.find((item) => item.id === admission.id)!;
    expect(seen.unitId).toBe(admission.unitId);
    expect(seen.tentativeDiagnosis).toBeNull();
    expect(seen.careJourney).toBeUndefined();
    expect(seen.followUp).toBeNull();
    expect(seen.referralId).toBeNull();
    expect(seen.movementId).toBeNull();
  });

  it("matches a community desk to its catchment team however the team is spelt", () => {
    const admission = state.admissions.find((item) => item.patientId !== null)!;
    const workspace = {
      ...state,
      referrals: [],
      patients: state.patients.map((item) =>
        item.id === admission.patientId ? { ...item, catchmentCommunityTeam: "Synthetic Community Team" } : item,
      ),
    };
    const scoped = scopeWorkspace(
      workspace,
      { role: "community", scope: { kind: "team", teamName: "Synthetic" } },
      { now: NOW_ANCHOR, places },
    );
    expect(scoped.admissions.map((item) => item.id)).toContain(admission.id);
  });

  it("lets a ward's old referral lines lapse with the hand-off window, and keeps open ones", () => {
    const source = state.referrals.find((referral) =>
      referral.destinations.some((line) => line.destination.kind === "psychiatric_ward"),
    )!;
    const line = source.destinations.find((item) => item.destination.kind === "psychiatric_ward")!;
    const atWard = { ...line, acceptedUnitId: undefined, destination: { ...line.destination, unitId } };
    const old = {
      ...source,
      id: "synthetic-old",
      destinations: [{ ...atWard, state: "declined" as const, decidedAt: NOW_ANCHOR - 30 * 24 * 60 }],
    } as typeof source;
    const open = {
      ...source,
      id: "synthetic-open",
      destinations: [{ ...atWard, state: "queued" as const }],
    } as typeof source;
    const scoped = scopeWorkspace({ ...state, movements: [], admissions: [], referrals: [old, open] }, wardDesk, {
      now: NOW_ANCHOR,
      places,
    });
    expect(scoped.referrals.map((referral) => referral.id)).toEqual(["synthetic-open"]);
  });

  it("never tells a ward which other wards a movement was sent to", () => {
    const other = state.units.find((unit) => unit.id !== unitId)!;
    const movement = { ...state.movements[0], closure: undefined, referredUnitIds: [unitId, other.id] };
    const scoped = scopeWorkspace({ ...state, movements: [movement] }, wardDesk, { now: NOW_ANCHOR, places });
    expect(scoped.movements.find((item) => item.id === movement.id)?.referredUnitIds).toEqual([unitId]);
  });

  it("names no patient to the executive", () => {
    const scoped = scope({ role: "executive", scope: { kind: "statewide" } });
    // Every patient with a movement, stay or referral is counted; none is named.
    expect(scoped.patients.length).toBeGreaterThan(0);
    for (const patient of scoped.patients) {
      expect(patient.givenName).toBe("Hidden");
      expect(patient.familyName).toBe("");
      expect(patient.umrn).toBe("");
      expect(patient.dateOfBirth).toMatch(/^\d{4}-01-01$/u);
    }
    for (const referral of scoped.referrals) {
      expect("intake" in referral).toBe(false);
      expect("corrections" in referral).toBe(false);
      expect("tentativeDiagnosis" in referral).toBe(false);
      expect(referral.history).toBe("");
    }
    for (const movement of scoped.movements) expect("tentativeDiagnosis" in movement).toBe(false);
    for (const admission of scoped.admissions) expect(admission.tentativeDiagnosis).toBeNull();
  });

  it("gives the access admin no patient data at all", () => {
    const scoped = scope({ role: "admin", scope: { kind: "statewide" } });
    expect(scoped.patients).toEqual([]);
    expect(scoped.movements).toEqual([]);
    expect(scoped.referrals).toEqual([]);
    expect(scoped.admissions).toEqual([]);
  });

  it("gives the transport officer open jobs only, and no record number", () => {
    const scoped = scope({ role: "officer", scope: { kind: "jobs" } });
    for (const movement of scoped.movements) {
      expect(movement.transport).toBeDefined();
      expect(movement.closure).toBeUndefined();
      expect(movement.tentativeDiagnosis).toBeUndefined();
    }
    for (const patient of scoped.patients) expect(patient.umrn).toBe("");
    expect(scoped.referrals).toEqual([]);
  });

  it("trims an officer's job to what the collection needs", () => {
    const job = state.movements.find((movement) => movement.transport !== undefined)!;
    const open = {
      ...job,
      transport: { ...job.transport!, arrivedAt: undefined },
      closure: undefined,
      owner: "Synthetic owner",
      blocker: "Synthetic typed note",
      referredUnitIds: [unitId],
      declines: [{ unitId, at: NOW_ANCHOR, reason: "no_bed" }],
      unwinds: [
        { at: NOW_ANCHOR, kind: "stage_corrected", by: "coordinator" },
        { at: NOW_ANCHOR, kind: "transport_cancelled", by: "officer" },
      ],
    } as unknown as typeof job;
    const [trimmed] = scopeWorkspace(
      { ...state, movements: [open] },
      { role: "officer", scope: { kind: "jobs" } },
      {
        now: NOW_ANCHOR,
        places,
      },
    ).movements;
    expect(trimmed.transport).toEqual(open.transport);
    expect(trimmed.legalStatus).toBe(open.legalStatus);
    expect(trimmed.originEdId).toBe(open.originEdId);
    expect(trimmed.owner).toBe("");
    expect(trimmed.blocker).toBe("");
    expect(trimmed.referredUnitIds).toEqual([]);
    expect(trimmed.declines).toEqual([]);
    expect(trimmed.statusChanges).toEqual([]);
    expect(trimmed.tentativeDiagnosis).toBeUndefined();
    expect(trimmed.unwinds.map((unwind) => unwind.kind)).toEqual(["transport_cancelled"]);
  });

  it("keeps a service coordinator's records to its own service", () => {
    const service = places.unitService(unitId)!;
    const own = (id: string) => places.unitService(id) === service;
    const otherUnit = state.units.find((unit) => !own(unit.id))!;
    const scoped = scope({ role: "coordinator", scope: { kind: "service", service } });
    const records = coordinatorRecordScope(scoped, state.bedReleases, own);
    const outside = state.movements.find((movement) => !scoped.movements.some((kept) => kept.id === movement.id));
    if (scoped.movements[0]) {
      expect(records.subject({ kind: "movement", movementId: scoped.movements[0].id, patientId: null })).toBe(true);
      expect(
        records.logEntry({
          type: "PULL_PATIENT",
          role: "coordinator",
          now: undefined,
          accepted: true,
          movementId: scoped.movements[0].id,
          sequence: 0,
        }),
      ).toBe(true);
    }
    if (outside) {
      expect(records.subject({ kind: "movement", movementId: outside.id, patientId: null })).toBe(false);
      expect(records.movementIds.has(outside.id)).toBe(false);
    }
    expect(records.subject({ kind: "configuration" })).toBe(false);
    const entry = { type: "PULL_PATIENT", role: "coordinator", now: undefined, accepted: true, sequence: 0 } as const;
    expect(records.logEntry({ ...entry, unitId })).toBe(true);
    expect(records.logEntry({ ...entry, unitId: otherUnit.id })).toBe(false);
    expect(records.logEntry({ ...entry, unitId, actingUnitId: otherUnit.id })).toBe(false);
    expect(records.logEntry(entry)).toBe(false);
    expect(records.logEntry({ ...entry, unitId, plannedAdmissionId: "synthetic" })).toBe(false);
    // A review is an audit event about another audit event, and follows the event it reviews.
    const releaseId = state.bedReleases.find((release) => own(release.unitId))?.id;
    if (releaseId) {
      const about = { kind: "bed-release", releaseId, unitId } as const;
      const events = [
        { id: "kept", subject: about },
        { id: "review", subject: { kind: "audit-event", eventId: "kept" } as const },
        { id: "config", subject: { kind: "configuration" } as const },
        { id: "review-of-config", subject: { kind: "audit-event", eventId: "config" } as const },
      ];
      expect(records.auditEvents(events).map((event) => event.id)).toEqual(["kept", "review"]);
      // An event acted by, or naming, another service's ward is left out whole.
      const foreign = [
        { id: "acted", subject: about, actor: { actingUnitId: otherUnit.id } },
        { id: "target", subject: about, details: { targets: [{ unitId }, { unitId: otherUnit.id }] } },
        { id: "own", subject: about, actor: { actingUnitId: unitId }, details: { targets: [{ unitId }] } },
      ];
      expect(records.auditEvents(foreign).map((event) => event.id)).toEqual(["own"]);
      // A refused record command names no subject, so it follows the audit row written with it.
      const refused = records.refusals([
        { id: "audit-1", subject: about },
        { id: "audit-2", subject: about, actor: { actingUnitId: otherUnit.id } },
      ]);
      const refusal = { id: "record-rejection-1", movementId: "none" };
      expect(refused(refusal)).toBe(true);
      expect(refused({ ...refusal, id: "record-rejection-2" })).toBe(false);
      expect(refused({ ...refusal, id: "record-rejection-3" })).toBe(false);
      expect(refused({ id: "rejection-x", movementId: unitId })).toBe(true);
      expect(refused({ id: "rejection-y", movementId: otherUnit.id })).toBe(false);
      // A refused undo of a review on a seeded entry follows that entry, once the seeds are in the list.
      const undo = { id: "audit-5", subject: { kind: "audit-event", eventId: "seeded" } as const };
      expect(records.refusals([undo])({ ...refusal, id: "record-rejection-5" })).toBe(false);
      expect(records.refusals([{ id: "seeded", subject: about }, undo])({ ...refusal, id: "record-rejection-5" })).toBe(
        true,
      );
    }
    expect(records.rejectionSubject("none")).toBe(true);
    expect(records.rejectionSubject(unitId)).toBe(true);
    expect(records.rejectionSubject(otherUnit.id)).toBe(false);
    // A refused leave bed end on the desk's own ward stays with it. A person alone does not.
    const withLeave = coordinatorRecordScope(scoped, state.bedReleases, own, undefined, [
      { id: "leave-own", unitId },
      { id: "leave-other", unitId: otherUnit.id },
    ]);
    expect(withLeave.rejectionSubject("leave-own")).toBe(true);
    expect(withLeave.rejectionSubject("leave-other")).toBe(false);
    expect(withLeave.rejectionSubject(scoped.patients[0]?.id ?? "synthetic-person")).toBe(false);
    // A refused community treatment order names only the person, so it stays when this desk already
    // sees that person, and never for anyone else or for any other command.
    const seen = scoped.patients[0]!.id;
    const unseen = state.patients.find((patient) => !scoped.patients.some((kept) => kept.id === patient.id))!.id;
    const cto = records.refusals([]);
    const ctoRefusal = { id: "rejection-cto", movementId: seen, attempted: "RECORD_COMMUNITY_TREATMENT_ORDER" };
    expect(cto(ctoRefusal)).toBe(true);
    expect(cto({ ...ctoRefusal, attempted: "END_COMMUNITY_TREATMENT_ORDER" })).toBe(true);
    expect(cto({ ...ctoRefusal, movementId: unseen })).toBe(false);
    expect(cto({ ...ctoRefusal, attempted: "PULL_PATIENT" })).toBe(false);
  });

  it("hides counts below the small-number threshold", () => {
    expect(smallNumberText(0)).toBe("0");
    expect(smallNumberText(3)).toMatch(/fewer than/i);
    expect(smallNumberText(40)).toBe("40");
  });

  it("hides a breakdown's parts together, so a hidden part cannot be worked back from the total", () => {
    const NS = SMALL_NUMBER_NOT_SHOWN;
    // One worded part: the smallest other part above zero is not shown either.
    expect(smallNumberParts([3, 12, 7, 0])).toEqual(["fewer than 5", 12, NS, 0]);
    // Two worded parts whose gap pins them (2 is only 1 and 1, 8 only 4 and 4) hide one more.
    expect(smallNumberParts([6, 1, 1])).toEqual([NS, "fewer than 5", "fewer than 5"]);
    expect(smallNumberParts([4, 4, 10])).toEqual(["fewer than 5", "fewer than 5", NS]);
    // A gap of 6 beside a withheld 5 is only 1 and 5, so the 9 goes too.
    expect(smallNumberParts([1, 5, 9])).toEqual(["fewer than 5", NS, NS]);
    // A gap that can split more than one way stays as it is.
    expect(smallNumberParts([3, 2, 9])).toEqual(["fewer than 5", "fewer than 5", 9]);
    // Nothing left to withhold: none is said to be under the line.
    expect(smallNumberParts([4, 4, 0])).toEqual([NS, NS, 0]);
    expect(smallNumberParts([4, 4])).toEqual([NS, NS]);
    // Nothing worded, nothing hidden. A total under the line is worded itself, so nothing more hides.
    expect(smallNumberParts([5, 0, 8])).toEqual([5, 0, 8]);
    expect(smallNumberParts([1, 2, 0])).toEqual(["fewer than 5", "fewer than 5", 0]);
  });
});

describe("broadcast alerts for a desk", () => {
  const other = state.units.find((unit) => unit.id !== unitId)!;
  const base = {
    id: "synthetic-alert",
    title: "Synthetic",
    message: "Synthetic message",
    severity: "critical",
    category: "capacity_gridlock",
    targetScope: "all",
    targetScopeLabel: "2 wards",
    durationMinutes: 60,
    dispatchedAt: NOW_ANCHOR,
    expiresAt: NOW_ANCHOR + 60,
    dispatchedByRole: "coordinator",
    dispatchedByName: "Synthetic coordinator",
    status: "active",
    acknowledgedUnits: [unitId, other.id],
  } satisfies BroadcastAlert;

  it("keeps only the desk's own ward, answers and acknowledgements on a bed call", () => {
    const call = {
      ...base,
      kind: "bed_call" as const,
      targetUnitIds: [unitId, other.id],
      replies: [
        { unitId, answer: "can_take" as const, at: NOW_ANCHOR, role: "ward" as const },
        { unitId: other.id, answer: "can_take" as const, at: NOW_ANCHOR, role: "ward" as const },
      ],
    };
    const [seen] = scopeBroadcastAlerts([call], wardDesk, state.units, places);
    expect(seen.targetUnitIds).toEqual([unitId]);
    expect(seen.acknowledgedUnits).toEqual([unitId]);
    expect(seen.replies?.map((reply) => reply.unitId)).toEqual([unitId]);
    expect(seen.targetScopeLabel).toBe(state.units[0].name);
  });

  it("drops a directive whose target covers none of the desk's places", () => {
    const edOnly = { ...base, acknowledgedUnits: [], targetScope: "ed_liaison" as const };
    expect(scopeBroadcastAlerts([edOnly], wardDesk, state.units, places)).toEqual([]);
    const everyone = { ...base, acknowledgedUnits: [] };
    expect(scopeBroadcastAlerts([everyone], wardDesk, state.units, places)).toHaveLength(1);
  });

  it("keeps only the desk's own acknowledgements on a directive", () => {
    const [seen] = scopeBroadcastAlerts([base], wardDesk, state.units, places);
    expect(seen.acknowledgedUnits).toEqual([unitId]);
  });

  it("counts a directive's acknowledgements against the desk's own desks", () => {
    const [seen] = scopeBroadcastAlerts([base], wardDesk, state.units, places);
    expect(directiveAcknowledgements(seen, state.units, (id) => id === unitId)).toEqual({ acknowledged: 1, of: 1 });
  });

  it("trims a bed call to a service coordinator's own service", () => {
    const service = places.unitService(unitId)!;
    const elsewhere = state.units.find((unit) => places.unitService(unit.id) !== service)!;
    const desk: WardAccess = { role: "coordinator", scope: { kind: "service", service } };
    const call = { ...base, kind: "bed_call" as const, targetUnitIds: [elsewhere.id] };
    expect(scopeBroadcastAlerts([call], desk, state.units, places)).toEqual([]);
  });
});

describe("the desk store", () => {
  beforeEach(() => resetWardAccessStoreForTests());

  it("reads back only a known role with a scope that role may hold", () => {
    expect(parseStoredAccess(JSON.stringify(wardDesk))).toEqual(wardDesk);
    expect(parseStoredAccess(JSON.stringify({ role: "root", scope: { kind: "statewide" } }))).toBeNull();
    expect(parseStoredAccess(JSON.stringify({ role: "ward", scope: { kind: "statewide" } }))).toBeNull();
    expect(parseStoredAccess("{not json")).toBeNull();
    expect(parseStoredAccess(null)).toBeNull();
  });

  it("ends every open grant when the desk changes or locks, and keeps the record", () => {
    setWardAccess(wardDesk);
    const record = breakGlass({
      patientId: "P-1",
      now: NOW_ANCHOR,
      windowMinutes: 60,
      reason: "other",
      otherText: "Typed words",
      placeLabel: "Ward",
    });
    expect(record?.until).toBe(NOW_ANCHOR + 60);
    expect(record?.otherText).toBe("Typed words");
    setWardAccess({ role: "ed", scope: { kind: "ed", edId: "x" } });
    const changed = readWardAccessSnapshot();
    expect(changed.access.role).toBe("ed");
    expect(changed.records).toHaveLength(1);
    expect(changed.records[0].until).toBeLessThanOrEqual(NOW_ANCHOR);
    // A preview is the coordinator's only.
    startAccessPreview(wardDesk);
    expect(readWardAccessSnapshot().previewOf).toBeNull();
  });

  it("locks without ever widening the desk's access, and closes every grant", () => {
    setWardAccess(wardDesk);
    breakGlass({ patientId: "P-2", now: NOW_ANCHOR, windowMinutes: 60, reason: "handover", placeLabel: "Ward" });
    lockWardDesk();
    const locked = readWardAccessSnapshot();
    expect(locked.access).toEqual(wardDesk);
    expect(locked.records[0].until).toBeLessThanOrEqual(NOW_ANCHOR);
  });

  it("lets only the coordinator preview, and remembers the way back", () => {
    startAccessPreview(wardDesk);
    expect(readWardAccessSnapshot().access).toEqual(wardDesk);
    expect(readWardAccessSnapshot().previewOf).toEqual(STATEWIDE_COORDINATOR);
  });

  it("returns to the coordinator who began it, even after a preview of another coordinator desk", () => {
    const service = { role: "coordinator", scope: { kind: "service", service: "North Metro" } } as const;
    setWardAccess(service);
    startAccessPreview(STATEWIDE_COORDINATOR);
    startAccessPreview(wardDesk);
    expect(readWardAccessSnapshot().previewOf).toEqual(service);
    endAccessPreview();
    expect(readWardAccessSnapshot().access).toEqual(service);
    expect(readWardAccessSnapshot().previewOf).toBeNull();
  });

  it("never breaks glass during a preview, so nothing is logged as the previewed desk", () => {
    startAccessPreview(wardDesk);
    const record = breakGlass({
      patientId: "P-3",
      now: NOW_ANCHOR,
      windowMinutes: 60,
      reason: "handover",
      placeLabel: "Ward",
    });
    expect(record).toBeNull();
    expect(readWardAccessSnapshot().records).toHaveLength(0);
  });

  it("retains outbound referrals and write access for sending wards, EDs, and community teams while keeping FD-23 trimming for receiving wards", () => {
    const sendingUnit = state.units[0];
    const receivingUnitA = state.units[1];
    const receivingUnitB = state.units[2];
    const baseReferral = state.referrals.find((r) =>
      r.destinations.some((d) => d.destination.kind === "psychiatric_ward"),
    )!;
    const wardLine = baseReferral.destinations.find((d) => d.destination.kind === "psychiatric_ward")!;
    const wardDest = (targetUnitId: string) => ({
      kind: "psychiatric_ward" as const,
      unitId: targetUnitId,
      sex: "Female" as const,
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      highAcuityNursingNeeded: false,
    });
    const wardOutboundReferral = {
      ...baseReferral,
      id: "ref-outbound-ward-1",
      source: "psychiatric_ward" as const,
      originUnitId: sendingUnit.id,
      originSiteCode: sendingUnit.siteCode,
      raisedAt: NOW_ANCHOR - 10,
      destinations: [
        {
          ...wardLine,
          id: "dest-a",
          acceptedUnitId: undefined,
          destination: wardDest(receivingUnitA.id),
          state: "queued" as const,
        },
        {
          ...wardLine,
          id: "dest-b",
          acceptedUnitId: undefined,
          destination: wardDest(receivingUnitB.id),
          state: "queued" as const,
        },
      ],
    };
    const edId = state.movements[0].originEdId;
    const edSiteCode = places.edSiteCode(edId) ?? sendingUnit.siteCode;
    const edOutboundReferral = {
      ...baseReferral,
      id: "ref-outbound-ed-1",
      source: "ed_medical" as const,
      originSiteCode: edSiteCode,
      raisedAt: NOW_ANCHOR - 10,
      destinations: [
        {
          ...wardLine,
          id: "dest-ed-a",
          acceptedUnitId: undefined,
          destination: wardDest(receivingUnitA.id),
          state: "queued" as const,
        },
      ],
    };
    const communityOutboundReferral = {
      ...baseReferral,
      id: "ref-outbound-comm-1",
      source: "community" as const,
      sendingTeamName: "Midland Community Team",
      raisedAt: NOW_ANCHOR - 10,
      destinations: [
        {
          ...wardLine,
          id: "dest-comm-a",
          acceptedUnitId: undefined,
          destination: wardDest(receivingUnitA.id),
          state: "queued" as const,
        },
      ],
    };
    const customState = {
      ...state,
      edDepartments: [{ id: edId, siteCode: edSiteCode }],
      referrals: [...state.referrals, wardOutboundReferral, edOutboundReferral, communityOutboundReferral],
    };
    const opts = { now: NOW_ANCHOR, places };

    const sendingWardDesk: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [sendingUnit.id] } };
    const receivingWardADesk: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [receivingUnitA.id] } };
    const edDesk: WardAccess = { role: "ed", scope: { kind: "ed", edId } };
    const communityDesk: WardAccess = { role: "community", scope: { kind: "team", teamName: "Midland" } };

    const sendingScoped = scopeWorkspace(customState, sendingWardDesk, opts);
    expect(sendingScoped.referrals.find((r) => r.id === wardOutboundReferral.id)?.destinations).toHaveLength(2);
    expect(
      commandScopeRefusal(
        customState,
        sendingWardDesk,
        { type: "RECORD_REFERRER_WITHDRAWAL", role: "ward", referralId: wardOutboundReferral.id },
        opts,
      ),
    ).toBeNull();

    // Receiving ward A only sees its own destination line (FD-23 preserved)
    const receivingScoped = scopeWorkspace(customState, receivingWardADesk, opts);
    expect(receivingScoped.referrals.find((r) => r.id === wardOutboundReferral.id)?.destinations).toHaveLength(1);

    const edScoped = scopeWorkspace(customState, edDesk, opts);
    expect(edScoped.referrals.some((r) => r.id === edOutboundReferral.id)).toBe(true);
    expect(
      commandScopeRefusal(
        customState,
        edDesk,
        { type: "RECORD_REFERRER_WITHDRAWAL", role: "ed", referralId: edOutboundReferral.id },
        opts,
      ),
    ).toBeNull();

    const communityScoped = scopeWorkspace(customState, communityDesk, opts);
    expect(communityScoped.referrals.some((r) => r.id === communityOutboundReferral.id)).toBe(true);
    // A ward or ED typing the team's name on another source's referral does not hand it the referral.
    const namedByWard = { ...communityOutboundReferral, id: "ref-named-by-ward-1", source: "gp" as const };
    const namedScoped = scopeWorkspace(
      { ...customState, referrals: [...customState.referrals, namedByWard] },
      communityDesk,
      opts,
    );
    expect(namedScoped.referrals.some((r) => r.id === namedByWard.id)).toBe(false);
    // The stay a sent referral led to is ward and dates only, never the receiving ward's record.
    const sentStay = { ...state.admissions[0], id: "adm-outbound-comm-1", referralId: communityOutboundReferral.id };
    const withSentStay = { ...customState, admissions: [...customState.admissions, sentStay] };
    const sentStayScoped = scopeWorkspace(withSentStay, communityDesk, opts);
    expect(sentStayScoped.admissions.some((a) => a.id === sentStay.id)).toBe(true);
    expect(sentStayScoped.datesOnlyAdmissionIds.has(sentStay.id)).toBe(true);
    expect(
      commandScopeRefusal(
        customState,
        communityDesk,
        { type: "RECORD_REFERRER_WITHDRAWAL", role: "community", referralId: communityOutboundReferral.id },
        opts,
      ),
    ).toBeNull();
  });

  it("upgrades a community catchment datesOnlyAdmission to full details on break-glass and marks it read-only", () => {
    const catchmentPatient = state.patients.find((p) => p.catchmentCommunityTeam)!;
    const fullAdmission = {
      ...state.admissions.find((a) => a.patientId !== null)!,
      id: "adm-catchment-bg-1",
      patientId: catchmentPatient.id,
      referralId: null,
      movementId: null,
      tentativeDiagnosis: "F30–F39" as const,
    };
    const customState = {
      ...state,
      admissions: [...state.admissions.filter((a) => a.patientId !== catchmentPatient.id), fullAdmission],
      movements: state.movements.filter((m) => m.patientId !== catchmentPatient.id),
      referrals: state.referrals.filter((r) => r.patientId !== catchmentPatient.id),
    };
    const communityDesk: WardAccess = {
      role: "community",
      scope: { kind: "team", teamName: catchmentPatient.catchmentCommunityTeam! },
    };
    const withoutGrant = scopeWardFlowState(customState, communityDesk, { now: NOW_ANCHOR, places });
    expect(withoutGrant.scoped.datesOnlyAdmissionIds.has(fullAdmission.id)).toBe(true);
    expect(withoutGrant.state.admissions.find((a) => a.id === fullAdmission.id)?.tentativeDiagnosis).toBeNull();

    const withGrant = scopeWardFlowState(customState, communityDesk, {
      now: NOW_ANCHOR,
      places,
      grants: [{ patientId: catchmentPatient.id, until: NOW_ANCHOR + 60 }],
    });
    expect(withGrant.scoped.datesOnlyAdmissionIds.has(fullAdmission.id)).toBe(false);
    expect(withGrant.state.admissions.find((a) => a.id === fullAdmission.id)?.tentativeDiagnosis).toBe("F30–F39");
    expect(withGrant.breakGlassPatientIds.has(catchmentPatient.id)).toBe(true);
    expect(isValidSharedWardFlowState(withGrant.state)).toBe(true);
    expect(
      commandScopeRefusal(
        customState,
        communityDesk,
        { type: "RECORD_ADMISSION_FOLLOW_UP", role: "community", admissionId: fullAdmission.id },
        { now: NOW_ANCHOR, places, grants: [{ patientId: catchmentPatient.id, until: NOW_ANCHOR + 60 }] },
      ),
    ).toMatch(/outside/);
  });
});

describe("a receiving desk learns nothing about other wards on a journey (FD-23, D-80)", () => {
  const ownSite = places.unitSiteCode(unitId)!;
  const otherUnit = state.units.find((unit) => places.unitSiteCode(unit.id) !== ownSite)!;
  const otherEd = allEmergencyDepartments().find((ed) => ed.siteCode !== ownSite)!;
  const bedManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: ownSite } };
  const GENDER_REASON = GENDER_PLACEMENT_REASONS[0];
  const base = state.movements[0];
  const shared = {
    ...base,
    originEdId: otherEd.id,
    sourceAdmissionId: undefined,
    referralId: undefined,
    closure: undefined,
    referredUnitIds: [unitId, otherUnit.id],
    acceptedUnitId: otherUnit.id,
    acceptedAt: NOW_ANCHOR,
    heldBedNumber: 4,
    allocatedBed: 4,
    declines: [
      { unitId, at: NOW_ANCHOR, reason: "no_bed" },
      { unitId: otherUnit.id, at: NOW_ANCHOR, reason: "no_bed" },
    ],
    withdrawnReferrals: [
      { unitId, at: NOW_ANCHOR, reason: "another_unit_accepted" },
      { unitId: otherUnit.id, at: NOW_ANCHOR, reason: "another_unit_accepted" },
    ],
    overrides: [
      {
        at: NOW_ANCHOR,
        by: "coordinator",
        reason: "Clinical urgency outweighs the mismatch",
        unitIds: [unitId, otherUnit.id],
      },
      { at: NOW_ANCHOR, by: "coordinator", reason: "Clinical urgency outweighs the mismatch", unitIds: [otherUnit.id] },
    ],
    escalation: { at: NOW_ANCHOR, triedUnitIds: [unitId, otherUnit.id], contact: "Synthetic contact" },
    referralAnswerHistory: [
      { unitId, at: NOW_ANCHOR, answer: "declined" },
      { unitId: otherUnit.id, at: NOW_ANCHOR, answer: "waitlisted" },
    ],
    waitlistedUnitIds: [unitId, otherUnit.id],
    unwinds: [
      { at: NOW_ANCHOR, kind: "acceptance_withdrawn", by: "coordinator", reason: "Synthetic", unitId: otherUnit.id },
    ],
    legalMismatch: { at: NOW_ANCHOR, unitId: otherUnit.id, kind: "involuntary_on_voluntary_ward" },
    genderPlacements: [
      { at: NOW_ANCHOR, by: "coordinator", unitIds: [unitId, otherUnit.id], reason: GENDER_REASON, wardChecked: true },
      { at: NOW_ANCHOR, by: "coordinator", unitIds: [otherUnit.id], reason: GENDER_REASON, wardChecked: true },
    ],
  } as unknown as typeof base;
  const trimmedFor = (access: WardAccess, movement = shared) =>
    scopeWorkspace({ ...state, movements: [movement] }, access, { now: NOW_ANCHOR, places }).movements.find(
      (item) => item.id === movement.id,
    )!;

  for (const [label, access] of [
    ["ward", wardDesk],
    ["bed manager", bedManager],
  ] as const) {
    describe(`for a ${label}`, () => {
      const trimmed = trimmedFor(access);
      it("keeps only its own wards asked", () => expect(trimmed.referredUnitIds).toEqual([unitId]));
      it("keeps only its own declines", () => expect(trimmed.declines.map((item) => item.unitId)).toEqual([unitId]));
      it("keeps only its own withdrawn requests", () =>
        expect(trimmed.withdrawnReferrals.map((item) => item.unitId)).toEqual([unitId]));
      it("keeps only overrides that touched its own wards, naming only those", () =>
        expect(trimmed.overrides.map((item) => item.unitIds)).toEqual([[unitId]]));
      it("keeps the escalation but names only its own wards tried", () =>
        expect(trimmed.escalation?.triedUnitIds).toEqual([unitId]));
      it("keeps only its own answers", () =>
        expect(trimmed.referralAnswerHistory?.map((item) => item.unitId)).toEqual([unitId]));
      it("keeps only its own waitlist place", () => expect(trimmed.waitlistedUnitIds).toEqual([unitId]));
      it("never names the ward that accepted or its bed", () => {
        expect(trimmed.acceptedUnitId).toBeUndefined();
        expect(trimmed.heldBedNumber).toBeUndefined();
        expect(trimmed.allocatedBed).toBeUndefined();
        expect(trimmed.stage).toBe(shared.stage);
      });
      it("drops another ward's withdrawn acceptance", () => expect(trimmed.unwinds).toEqual([]));
      it("drops another ward's legal mismatch", () => expect(trimmed.legalMismatch).toBeUndefined());
      it("keeps only gender placements that named its own wards, naming only those", () =>
        expect(trimmed.genderPlacements?.map((item) => item.unitIds)).toEqual([[unitId]]));
      it("never carries another ward's id anywhere on the copy", () =>
        expect(JSON.stringify(trimmed)).not.toContain(otherUnit.id));
    });
  }

  it("keeps its own acceptance and bed", () => {
    const own = trimmedFor(wardDesk, { ...shared, acceptedUnitId: unitId } as typeof shared);
    expect(own.acceptedUnitId).toBe(unitId);
    expect(own.heldBedNumber).toBe(4);
    const mismatch = { at: NOW_ANCHOR, unitId, kind: "involuntary_on_voluntary_ward" as const };
    expect(trimmedFor(wardDesk, { ...shared, legalMismatch: mismatch } as typeof shared).legalMismatch).toEqual(
      mismatch,
    );
  });

  it("leaves the ward that sent the person knowing where they were accepted", () => {
    const admission = state.admissions.find((item) => item.unitId === unitId && item.leftAt === null)!;
    const sent = trimmedFor(wardDesk, { ...shared, sourceAdmissionId: admission.id } as typeof shared);
    expect(sent.acceptedUnitId).toBe(otherUnit.id);
    expect(sent.declines).toHaveLength(2);
  });

  it("leaves a bed manager whose own ED sent the person knowing where they were accepted", () => {
    const ownEd = allEmergencyDepartments().find((ed) => ed.siteCode === ownSite)!;
    expect(trimmedFor(bedManager, { ...shared, originEdId: ownEd.id } as typeof shared).acceptedUnitId).toBe(
      otherUnit.id,
    );
  });
});
