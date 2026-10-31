import { describe, expect, it } from "vitest";

import { commandRefusal, seedWorld } from "../backend/ward-flow/engine";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { commandScopeRefusal } from "@/components/ward-management/ward-access-state";
import { inboxOwnerRoles } from "@/components/ward-management/ward-act-now-items";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { selectDischargeRecord, selectDischargeRecords } from "@/components/ward-management/ward-discharge-records";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/** Role access plan v2 (D-80): the site bed manager acts on its own wards' bed flow. */
describe("the site bed manager's bed flow actions (D-80)", () => {
  const state = seedWardFlowState();
  const places = wardPlaceLookup(state.units);
  const own = state.units[0]!;
  const site = own.siteCode;
  const elsewhere = state.units.find((unit) => unit.siteCode !== site)!;
  const bedManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: site } };
  const options = { now: NOW, places };

  it("may take the approved bed flow actions, and no seclusion record or handover sign-off", () => {
    for (const type of [
      "CONFIRM_CAPACITY",
      "CONFIRM_MORNING_ROLLUP",
      "SET_BED_PREPARATION",
      "FLAG_BED_RELEASE",
      "CONFIRM_BED_RELEASE",
      "REVERT_BED_RELEASE",
      "BLOCK_BED_RELEASE",
      "CLEAR_BED_RELEASE_BLOCK",
      "RECORD_STAY_DISCHARGE_BLOCKER",
      "CLEAR_STAY_DISCHARGE_BLOCKER",
      "CLOSE_WARD_TO_ADMISSIONS",
      "REOPEN_WARD_TO_ADMISSIONS",
      "COMPLETE_BED_MEETING_ACTION",
      "REPLY_BROADCAST_ALERT",
      "MARK_NOTICE_READ",
    ] as const) {
      expect(EVENT_ROLE[type], type).toContain("bed_manager");
    }
    for (const type of [
      "RECORD_RESTRICTIVE_PRACTICE_START",
      "RECORD_RESTRICTIVE_PRACTICE_END",
      "RECORD_WARD_INCIDENT",
      // A sign-off carries no site yet, so one site's would mark every site's sheet.
      "RECORD_HANDOVER_SIGN_OFF",
      "UNDO_HANDOVER_SIGN_OFF",
    ] as const) {
      expect(EVENT_ROLE[type], type).not.toContain("bed_manager");
    }
    // It keeps the operational view's room status, and clinical acceptance stays with the ward.
    expect(EVENT_ROLE.SET_SECLUSION_ROOM_STATUS).toContain("bed_manager");
    expect(EVENT_ROLE.ACCEPT_IN_PRINCIPLE).not.toContain("bed_manager");
    expect(EVENT_ROLE.RECORD_PATIENT_DISCHARGE).not.toContain("bed_manager");
    expect(EVENT_ROLE.UPDATE_EXPECTED_DISCHARGE).not.toContain("bed_manager");
  });

  it("confirms beds and closes a ward on its own site only", () => {
    const confirm = (unitId: string) => ({
      type: "CONFIRM_CAPACITY",
      role: "bed_manager",
      unitId,
      actingUnitId: unitId,
      value: 2,
    });
    expect(commandScopeRefusal(state, bedManager, confirm(own.id), options)).toBeNull();
    expect(commandScopeRefusal(state, bedManager, confirm(elsewhere.id), options)).toMatch(/outside/);
    const close = (unitId: string) => ({ type: "CLOSE_WARD_TO_ADMISSIONS", role: "bed_manager", unitId });
    expect(commandScopeRefusal(state, bedManager, close(own.id), options)).toBeNull();
    expect(commandScopeRefusal(state, bedManager, close(elsewhere.id), options)).toMatch(/outside/);

    const closed = wardFlowReducer(state, {
      type: "CLOSE_WARD_TO_ADMISSIONS",
      role: "bed_manager",
      now: NOW,
      unitId: own.id,
      reason: "staffing",
    });
    expect(closed.rejections).toEqual(state.rejections);
    expect(closed.units.find((unit) => unit.id === own.id)!.isClosed).toBe(true);
  });

  it("completes a bed meeting action owned by a ward it acts for, and no other", () => {
    const admission = state.admissions.find((candidate) => candidate.state === "occupied")!;
    const subject = { kind: "admission" as const, id: admission.id };
    const withAction = (owner: "ward" | "ed") =>
      wardFlowReducer(state, {
        type: "RECORD_BED_MEETING_ACTION",
        role: "coordinator",
        now: NOW,
        subject,
        action: "chase_ndis",
        owner,
        ...(owner === "ward" ? { unitId: admission.unitId } : {}),
        dueAt: NOW + 120,
      });
    const complete = (recorded: ReturnType<typeof withAction>, actingUnitId?: string) =>
      wardFlowReducer(recorded, {
        type: "COMPLETE_BED_MEETING_ACTION",
        role: "bed_manager",
        now: NOW + 10,
        subject,
        action: "chase_ndis",
        ...(actingUnitId ? { actingUnitId } : {}),
      });

    const wardOwned = withAction("ward");
    expect(wardOwned.rejections).toEqual(state.rejections);
    const done = complete(wardOwned, admission.unitId);
    expect(done.rejections).toEqual(wardOwned.rejections);
    expect(done.admissions.find((candidate) => candidate.id === admission.id)!.meetingActions![0]).toMatchObject({
      doneAt: NOW + 10,
      doneBy: "Site bed manager",
    });
    expect(complete(wardOwned).rejections).toHaveLength(wardOwned.rejections.length + 1);
    expect(complete(wardOwned, "some-other-ward").rejections).toHaveLength(wardOwned.rejections.length + 1);

    const edOwned = withAction("ed");
    expect(complete(edOwned, admission.unitId).rejections).toHaveLength(edOwned.rejections.length + 1);
  });

  it("owns the task rows that name the bed manager", () => {
    expect(inboxOwnerRoles("Bed manager")).toEqual(["bed_manager"]);
    expect(inboxOwnerRoles("Bed coordinator")).toEqual(["coordinator"]);
  });

  it("is refused every referral change on the server, in its own name or the coordinator's", () => {
    const at = new Date("2026-10-20T10:00:00Z");
    const world = seedWorld(at);
    const referralId = world.state.referrals[0]!.id;
    for (const type of [
      "RAISE_REFERRAL",
      "RECEIVE_REFERRAL",
      "ACCEPT_IN_PRINCIPLE",
      "UNDO_ACCEPT_IN_PRINCIPLE",
      "DECLINE",
      "ACCEPT_REFERRAL",
      "DECLINE_REFERRAL",
      "UNDO_REFERRAL_DECISION",
      "REFER_TO_UNITS",
      "UNDO_REFER_TO_UNITS",
      "REFER_TO_COMMUNITY_TEAM",
      "ASK_MORE_WARDS",
      "RECORD_ESCALATION",
      "RAISE_PULL_NOW",
      "ASSIGN_REFERRAL",
      "LOG_REFERRAL_CONTACT",
      "REQUEST_REFERRAL_INFORMATION",
      "MARK_REFERRAL_INFORMATION_MET",
      "FLAG_REFERRAL_TURNAROUND_PRIORITY",
      "ADD_REFERRAL_CORRECTION",
      "RECORD_LOCAL_BED_SOUGHT",
      "WITHDRAW_REFERRAL",
      "WITHDRAW_ACCEPTANCE",
      "RECORD_REFERRER_WITHDRAWAL",
      "CHANGE_URGENCY",
    ] as const) {
      expect(EVENT_ROLE[type], type).not.toContain("bed_manager");
      for (const role of ["bed_manager", "coordinator"])
        expect(commandRefusal(world, bedManager, { type, role, now: NOW, referralId }, at), `${type} as ${role}`).toBe(
          "This change is not part of your role.",
        );
    }
  });

  it("opens its own site's discharge records in its own name, with typed criteria as placeholders", () => {
    const at = new Date("2026-10-20T10:00:00Z");
    const world = seedWorld(at);
    const unitSite = (unitId: string) => world.state.units.find((unit) => unit.id === unitId)?.siteCode;
    const ownStay = world.state.admissions.find((admission) => unitSite(admission.unitId) === site)!;
    const otherStay = world.state.admissions.find((admission) => unitSite(admission.unitId) !== site)!;
    const open = (admissionId: string) => ({
      type: "OPEN_DISCHARGE_RECORD",
      role: "bed_manager",
      now: NOW,
      admissionId,
      expectedGeneration: world.state.worldGeneration,
      requestId: 1,
    });
    expect(commandRefusal(world, bedManager, open(ownStay.id), at)).toBeNull();
    expect(commandRefusal(world, bedManager, open(otherStay.id), at)).toMatch(/outside/);

    const opened = wardFlowReducer(state, {
      type: "OPEN_DISCHARGE_RECORD",
      role: "bed_manager",
      now: NOW,
      admissionId: state.admissions[0]!.id,
      expectedGeneration: state.worldGeneration,
      requestId: 1,
    });
    expect(opened.rejections).toEqual(state.rejections);
    expect(opened.auditEvents.at(-1)).toMatchObject({
      action: "OPEN_DISCHARGE_RECORD",
      outcome: "accepted",
      actor: { role: "bed_manager", actingUnitId: null },
    });

    const typed = structuredClone(state);
    typed.admissions[0]!.dischargeCriteria = {
      setAt: NOW,
      items: [{ criterion: "Synthetic typed criterion", patientSpecific: true, metAt: null }],
    };
    const read = selectDischargeRecord(typed, { role: "bed_manager" }, typed.admissions[0]!.id);
    expect(read.status).toBe("allowed");
    expect(read.status === "allowed" && read.value.dischargeCriteria?.items[0]?.criterion).toBe(
      "Patient specific criterion 1",
    );
    expect(selectDischargeRecords(state, { role: "bed_manager" }).status).toBe("allowed");
  });
});
