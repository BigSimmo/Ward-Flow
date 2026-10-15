import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { scopeWorkspace, smallNumberText } from "../src/components/ward-management/ward-access-scope";
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
} from "../src/components/ward-management/shell/ward-access-store";

/**
 * Role access plan PR 1 (Josh, 15 Oct 2026). The table is pinned to the plan's section 4, every
 * route answers to it, and the scoped workspace never hands a desk a patient outside its care.
 */
const BASE = "/mockups/ward-flow";
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
    const path = "/mockups/ward-flow/statistics/service/" + encodeURIComponent("North Metro");
    expect(screenForPath(path)).toMatchObject({ screen: "statistics", serviceId: "North Metro" });
    const north = { role: "executive", scope: { kind: "service", service: "North Metro" } } as const;
    const south = { role: "executive", scope: { kind: "service", service: "South Metro" } } as const;
    expect(screenDecision(north, screenForPath(path), places).open).toBe(true);
    expect(screenDecision(south, screenForPath(path), places)).toEqual({ open: false, why: "place" });
    expect(screenDecision(STATEWIDE_COORDINATOR, screenForPath(path), places).open).toBe(true);
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
  const root = join(process.cwd(), "src/app/mockups/ward-flow");
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name === "page.tsx") found.push(relative(root, dir));
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

  it("hides counts below the small-number threshold", () => {
    expect(smallNumberText(0)).toBe("0");
    expect(smallNumberText(3)).toMatch(/fewer than/i);
    expect(smallNumberText(40)).toBe("40");
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
});
