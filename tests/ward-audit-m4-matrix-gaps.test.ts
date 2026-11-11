import { describe, expect, it } from "vitest";

import { applyCommand, deskCommand, seedWorld, STATEWIDE, worldNow } from "../backend/ward-flow/engine";
import {
  noticeIsMarkableByChrome,
  wardTasksAreActionableForRole,
  type WardChromeRole,
} from "../src/components/ward-management/ward-chrome-role";
import { EVENT_ROLE, type WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { Notice } from "../src/components/ward-management/ward-model";
import { CROSS_ROLE_ALLOWED, canDispatch } from "../src/components/ward-management/ward-role-permissions";
import {
  ROLE_SCREENS,
  WARD_ACCESS_ROLES,
  canBreakGlass,
  type WardAccess,
  type WardScreenId,
} from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Master audit M4 (10 Nov 2026): the three gaps `docs/ward-flow/permission-matrix.md` lists under
 * "Not covered" that a test can close. Synthetic seed only; offline.
 *
 * 1. Screen gates written by hand agree with the engine's `EVENT_ROLE` and the reducer.
 * 2. Screens reached only by typing their address open to exactly the roles the engine lets act there.
 * 3. A coordinator acting from another desk's route is recorded, in the event and its audit row, as
 *    the coordinator. The server's own audit table takes the role from the membership
 *    (`view.access.role` in `postgres.mjs`), which `postgres.test.mjs` checks against a real database.
 */
type EventType = WardFlowEvent["type"];
const EVENT_TYPES = Object.keys(EVENT_ROLE) as EventType[];
const CHROME_ROLES: WardChromeRole[] = [
  "coordinator",
  "ward",
  "ed",
  "officer",
  "community",
  "bed_manager",
  "executive",
];

describe("M4 gap 1: hand-written screen gates agree with the engine", () => {
  it("offers the Tasks queue's actions to exactly the roles EVENT_ROLE lets take every one of them", () => {
    const inbox = EVENT_TYPES.filter((type) => type.endsWith("_INBOX_ITEM") && type !== "RELEASE_INBOX_ITEM_OWNERSHIP");
    expect(inbox.length).toBeGreaterThanOrEqual(5);
    for (const role of CHROME_ROLES) {
      const engine = inbox.every((type) => (EVENT_ROLE[type] as readonly string[]).includes(role));
      expect(wardTasksAreActionableForRole(role), role).toBe(engine);
    }
  });

  it("shows Mark read exactly when the reducer would accept MARK_NOTICE_READ from that chrome", () => {
    const base = seedWardFlowState();
    const unitId = base.units[0]!.id;
    const otherUnitId = base.units[1]!.id;
    const notices: Notice[] = [
      {
        id: "NT-SYN-M4-W",
        raisedAt: NOW_ANCHOR - 5,
        to: { role: "ward", placeId: unitId },
        about: {},
        kind: "transport_cancelled_officer",
        sentence: "Synthetic.",
      },
      {
        id: "NT-SYN-M4-O",
        raisedAt: NOW_ANCHOR - 5,
        to: { role: "officer" },
        about: {},
        kind: "transport_cancelled_officer",
        sentence: "Synthetic.",
      },
    ] as unknown as Notice[];
    const state = { ...base, notices: [...base.notices, ...notices] };
    const roles = EVENT_ROLE.MARK_NOTICE_READ as readonly WardChromeRole[];
    let accepted = 0;
    for (const notice of notices)
      for (const role of roles)
        for (const placeId of [undefined, unitId, otherUnitId]) {
          const next = wardFlowReducer(state, {
            type: "MARK_NOTICE_READ",
            role,
            now: NOW_ANCHOR,
            noticeId: notice.id,
            actingPlaceId: placeId,
          } as WardFlowEvent);
          const reducerAccepts = next.rejections.length === state.rejections.length;
          if (reducerAccepts) accepted++;
          expect(noticeIsMarkableByChrome(notice, role, placeId, NOW_ANCHOR), `${notice.id} ${role} ${placeId}`).toBe(
            reducerAccepts,
          );
        }
    // One addressee each: the test can see both answers.
    expect(accepted).toBe(2);
  });

  it("offers break glass only to clinical desks that open patient pages for their own place", () => {
    for (const role of WARD_ACCESS_ROLES) {
      const opensOwnPatients = ROLE_SCREENS[role].patient === "own";
      expect(canBreakGlass(role), role).toBe(opensOwnPatients && role !== "coordinator");
    }
  });
});

describe("M4 gap 2: screens reached only by typing their address", () => {
  // Each address-only form and the one event it exists to send.
  const FORM_EVENT: Partial<Record<WardScreenId, EventType>> = {
    "referral-new": "RECEIVE_REFERRAL",
    "patient-new": "ADD_PATIENT",
    "triage-new": "RECORD_TRIAGE_SIGNED",
  };

  it("opens each form to exactly the desks whose role may send its event", () => {
    for (const [screen, event] of Object.entries(FORM_EVENT) as [WardScreenId, EventType][])
      for (const role of WARD_ACCESS_ROLES) {
        const opens = ROLE_SCREENS[role][screen] !== undefined;
        const chrome = role === "admin" ? undefined : (role as WardChromeRole);
        const mayAct = chrome !== undefined && canDispatch(chrome, event);
        expect(opens, `${role} typed ${screen}`).toBe(mayAct);
      }
  });

  it("never lets a cross-role pair act on a screen its desk cannot open", () => {
    for (const entry of CROSS_ROLE_ALLOWED) {
      const screen = (Object.entries(FORM_EVENT) as [WardScreenId, EventType][]).find(
        ([, event]) => event === entry.event,
      )?.[0];
      if (screen) expect(ROLE_SCREENS[entry.routeRole][screen], `${entry.routeRole} ${entry.event}`).toBeDefined();
    }
  });
});

describe("M4 gap 3: a coordinator acting from another desk's route", () => {
  const at = new Date("2026-10-20T10:00:00Z");
  const service: WardAccess = { role: "coordinator", scope: { kind: "service", service: "East Metro" } };

  it("stamps every non-demo event a borrowed route role sends as the coordinator's", () => {
    for (const access of [STATEWIDE, service])
      for (const type of EVENT_TYPES)
        for (const routeRole of CHROME_ROLES.filter((role) => role !== "coordinator")) {
          const stamped = deskCommand(access, { type, role: routeRole }) as { role: string };
          const expected = type === "MARK_NOTICE_READ" ? routeRole : "coordinator";
          expect(stamped.role, `${access.scope.kind} ${routeRole} ${type}`).toBe(expected);
        }
  });

  it("writes the coordinator into the audit row of a change made from a ward's page", () => {
    const world = seedWorld(at);
    const unit = world.state.units[0]!;
    const occupant = world.state.admissions.find(
      (a) =>
        a.unitId === unit.id &&
        a.state === "occupied" &&
        !world.state.bedReleases.some((r) => r.admissionId === a.id && r.state !== "discharged"),
    );
    expect(occupant, "the seed needs an occupant without a live release").toBeDefined();
    // The ward page's button sends the ward's role; the server stamps the signed-in coordinator.
    const sent = {
      type: "FLAG_BED_RELEASE",
      role: "ward",
      unitId: unit.id,
      actingUnitId: unit.id,
      admissionId: occupant!.id,
      expectedAt: worldNow(world, at) + 60,
      waitingOn: "Nothing outstanding",
    };
    const result = applyCommand(world, deskCommand(STATEWIDE, sent), at);
    expect(result.outcome, result.reason ?? undefined).toBe("accepted");
    const row = result.world.state.auditEvents.at(-1)!;
    expect(row.action).toBe("FLAG_BED_RELEASE");
    expect(row.actor.role).toBe("coordinator");
    // The same ward-role command sent unstamped would be recorded as the ward's.
    const unstamped = applyCommand(world, sent, at);
    expect(unstamped.world.state.auditEvents.at(-1)!.actor.role).toBe("ward");
  });
});
