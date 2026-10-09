import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EVENT_ROLE, type WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import type { WardFlowRole } from "../src/components/ward-management/ward-flow-roles";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import type { WardChromeRole } from "../src/components/ward-management/ward-chrome-role";
import {
  CROSS_ROLE_ALLOWED,
  canDispatch,
  dispatchPermission,
  rolesOnlyReason,
} from "../src/components/ward-management/ward-role-permissions";
import {
  buildPatientStatus,
  type PatientStatusContext,
} from "../src/components/ward-management/patients/patient-status-card";

/**
 * Feature 11, actions limited by role. The route gives the role (`wardChromeRole`); `EVENT_ROLE`
 * says what that role may do; `CROSS_ROLE_ALLOWED` is the one explicit list of borrowed-role pairs
 * kept working until Josh rules on each.
 */
type EventType = WardFlowEvent["type"];
const EVENT_TYPES = Object.keys(EVENT_ROLE) as EventType[];
const ROUTE_ROLES: WardChromeRole[] = ["coordinator", "ward", "ed", "officer", "community", "bed_manager", "executive"];

describe("canDispatch", () => {
  it("is EVENT_ROLE exactly, apart from the listed cross-role pairs", () => {
    for (const role of ROUTE_ROLES) {
      for (const type of EVENT_TYPES) {
        const listed = CROSS_ROLE_ALLOWED.some((entry) => entry.routeRole === role && entry.event === type);
        expect(canDispatch(role, type), `${role} ${type}`).toBe(EVENT_ROLE[type].includes(role) || listed);
      }
    }
  });

  it("limits strictly: a role outside EVENT_ROLE and outside the list is refused with a short reason", () => {
    expect(dispatchPermission("officer", "SET_ARRIVAL_DETAILS")).toEqual({
      allowed: false,
      reason: "Coordinator, ED, ward or community team only",
    });
    expect(dispatchPermission("ward", "REFER_TO_UNITS")).toEqual({ allowed: false, reason: "Coordinator only" });
    expect(dispatchPermission("ed", "CONFIRM_CAPACITY")).toEqual({ allowed: false, reason: "Ward only" });
    expect(dispatchPermission("coordinator", "REFER_TO_UNITS")).toEqual({ allowed: true });
  });

  it("never lets a route role take a demonstration-control event", () => {
    for (const role of ROUTE_ROLES) {
      expect(canDispatch(role, "ADVANCE_CLOCK")).toBe(false);
      expect(canDispatch(role, "RESET_SCENARIO")).toBe(false);
    }
  });
});

describe("CROSS_ROLE_ALLOWED", () => {
  it("lists only pairs EVENT_ROLE does not already permit, so a widening retires its entry", () => {
    for (const entry of CROSS_ROLE_ALLOWED) {
      expect(EVENT_ROLE[entry.event].includes(entry.routeRole), `${entry.routeRole} ${entry.event}`).toBe(false);
    }
  });

  it("has no duplicate pair, and every pair says why", () => {
    const keys = CROSS_ROLE_ALLOWED.map((entry) => `${entry.routeRole}:${entry.event}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of CROSS_ROLE_ALLOWED) expect(entry.reason.trim().length).toBeGreaterThan(10);
  });

  it("keeps today's cross-role flows working (coordinator brief, 9 Oct 2026)", () => {
    // Patient page (coordinator route).
    for (const type of [
      "ACCEPT_IN_PRINCIPLE",
      "BOOK_TRANSPORT",
      "HANDOVER_READY",
      "TRANSPORT_ACCEPTED",
      "TRANSPORT_EN_ROUTE",
      "PATIENT_COLLECTED",
      "PATIENT_ARRIVED",
      "END_LEAVE_BED",
      "RECORD_ABSENT_WITHOUT_LEAVE",
      "RECORD_ABSENCE_STEP",
      "RECORD_COMMUNITY_TREATMENT_ORDER",
      "END_COMMUNITY_TREATMENT_ORDER",
    ] as const) {
      expect(canDispatch("coordinator", type), type).toBe(true);
    }
    // Legal forms Mark received (coordinator route), ward Raise referral, New referral sheet.
    expect(canDispatch("coordinator", "RECORD_LEGAL_FORM_RECEIVED")).toBe(true);
    expect(canDispatch("ward", "RECEIVE_REFERRAL")).toBe(true);
    for (const role of ["coordinator", "ward", "ed", "officer", "community"] as const) {
      expect(canDispatch(role, "RECEIVE_REFERRAL"), role).toBe(true);
      expect(canDispatch(role, "ADD_PATIENT"), role).toBe(true);
    }
  });
});

describe("rolesOnlyReason", () => {
  it("names the permitted roles briefly and never the demonstration control", () => {
    expect(rolesOnlyReason(["coordinator"])).toBe("Coordinator only");
    expect(rolesOnlyReason(["ward", "coordinator"])).toBe("Ward or coordinator only");
    expect(rolesOnlyReason(["ed", "ward", "community"])).toBe("ED, ward or community team only");
    expect(rolesOnlyReason(["officer"])).toBe("Transport officer only");
    expect(rolesOnlyReason(["demo"])).toBe("Demonstration control only");
  });
});

describe("the reducer is still the gate", () => {
  it("refuses an event whose role EVENT_ROLE does not permit, and changes nothing else", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((m) => m.stage === "placement_requested") ?? state.movements[0];
    const next = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: movement.id,
      unitIds: [state.units[0].id],
    });
    expect(next.rejections).toHaveLength(state.rejections.length + 1);
    expect(next.rejections.at(-1)?.attempted).toBe("REFER_TO_UNITS");
    expect(next.movements).toEqual(state.movements);
  });
});

/**
 * Screens that render only on their own role's route. Every event they dispatch must be one that
 * route's role may take, so a new button cannot quietly borrow another role without either a
 * gate or an entry in `CROSS_ROLE_ALLOWED`.
 */
const ROLE_SCREENS: Record<string, WardChromeRole> = {
  "ward/ward-screen.tsx": "ward",
  "ward/ward-answer-view.tsx": "ward",
  "ward/ward-arrivals-corridor.tsx": "ward",
  "board/ward-board.tsx": "ward",
  "ed/ed-screen.tsx": "ed",
  "ed/ed-medical-placement-controls.tsx": "ed",
  "officer/officer-screen.tsx": "officer",
  "officer/officer-forms-pack.tsx": "officer",
  "community/community-screen.tsx": "community",
  "coordinator/shortlist-panel.tsx": "coordinator",
  "movements/movement-drawer.tsx": "coordinator",
  "movements/movement-workspace-cockpit.tsx": "coordinator",
  "movements/movement-workflow-actions.tsx": "coordinator",
  "alerts/alerts-screen.tsx": "coordinator",
  "capacity/capacity-screen.tsx": "coordinator",
  "capacity/planned-admissions-panel.tsx": "coordinator",
  "delays/delays-screen.tsx": "coordinator",
  "discharges/discharge-board.tsx": "coordinator",
  "out-of-area/out-of-area-board.tsx": "coordinator",
  "hub/hub-screen.tsx": "coordinator",
  "settings/settings-screen.tsx": "coordinator",
  "governance-registers.tsx": "coordinator",
  "patients/add-patient.tsx": "coordinator",
  "referrals/referral-match.tsx": "coordinator",
  "patients/patient-now-screen.tsx": "coordinator",
  "patients/patient-transit-operations.tsx": "coordinator",
  "legal-forms/legal-forms-screen.tsx": "coordinator",
};

describe("role screens dispatch only what their route's role may take", () => {
  const root = join(__dirname, "../src/components/ward-management");
  for (const [file, role] of Object.entries(ROLE_SCREENS)) {
    it(`${file} (${role} route)`, () => {
      const source = readFileSync(join(root, file), "utf8");
      const types = [...source.matchAll(/type: "([A-Z_]+)",?\s*role:/g)].map((match) => match[1] as EventType);
      expect(types.length, "no dispatch found; update this list if the screen moved").toBeGreaterThan(0);
      for (const type of new Set(types)) {
        expect(EVENT_TYPES).toContain(type);
        expect(canDispatch(role as WardFlowRole, type), `${file} dispatches ${type}`).toBe(true);
      }
    });
  }
});

describe("Patient status card actions follow the route's role", () => {
  const base: PatientStatusContext = {
    hasBedHold: false,
    now: NOW_ANCHOR,
    dayZero: new Date(0),
    onOpenPlacement: () => {},
    onClearance: () => {},
    onBookTransport: () => {},
    onArrivalTime: () => {},
    onRecordReturn: () => {},
    onMarkAbsent: () => {},
    onAbsenceStep: () => {},
    onRecordCto: () => {},
    onEndCto: () => {},
    patient: seedWardFlowState().patients[0],
  };

  it("shows an action as unavailable with its reason, never hidden", () => {
    const open = buildPatientStatus("idle", base).cells.find((cell) => cell.key === "legal")?.action;
    expect(open).toMatchObject({ kind: "button", label: "Record CTO" });
    const limited = buildPatientStatus("idle", {
      ...base,
      roleLimit: (type) => (type === "RECORD_COMMUNITY_TREATMENT_ORDER" ? "Community team only" : undefined),
    }).cells.find((cell) => cell.key === "legal")?.action;
    expect(limited).toEqual({ kind: "unavailable", label: "Record CTO", reason: "Community team only" });
  });

  it("leaves Record CTO available on the coordinator route through the listed pair", () => {
    const action = buildPatientStatus("idle", {
      ...base,
      roleLimit: (type) => {
        const permission = dispatchPermission("coordinator", type);
        return permission.allowed ? undefined : permission.reason;
      },
    }).cells.find((cell) => cell.key === "legal")?.action;
    expect(action).toMatchObject({ kind: "button", label: "Record CTO" });
  });
});
