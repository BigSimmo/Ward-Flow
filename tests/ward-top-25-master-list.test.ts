import { describe, expect, it } from "vitest";
import {
  DEFAULT_BROADCAST_DURATION_MINUTES,
  DEFAULT_BROADCAST_EXTENSION_MINUTES,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import {
  extendBroadcastAlert,
  initialWardBroadcastState,
  wardBroadcastReducer,
} from "@/components/ward-management/alerts/ward-broadcast-reducer";
import {
  DISCHARGE_DELAY_REASONS,
  dischargeDelayMetadata,
  dischargeDelayReasonLabels,
} from "@/components/ward-management/ward-change-reasons";
import {
  deriveAfternoonDischarges,
  deriveRefusalRecoveryAction,
  deriveSilentWards,
  deriveTopCompatibleWards,
} from "@/components/ward-management/ward-derivations";
import {
  CLD_DEFAULT_CONDITIONS,
  deriveEddDriftBadge,
  evaluateCriteriaLedDischarge,
} from "@/components/ward-management/ward-discharge-dates";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { dispatchParallelDischargeSupport } from "@/components/ward-management/ward-support-notifications";
import {
  PHONE_WALK_ROUND_VIEWPORT,
  canPreMatchCleaningBed,
  completeCleanAndOpenBed,
  createUndoWindowState,
  deriveAwolTrackerSummary,
  deriveCtoFollowUpHandshake,
  deriveEdBreachLadder,
  deriveGhostPreparingBeds,
  deriveInterWardStepDownSwaps,
  deriveMaroonedPatientDossier,
  derivePaperLegalExpiryRadar,
  derivePreFlightAdmissionsPacket,
  deriveRoleNeedsYouItems,
  deriveStepDownPullBoard,
  deriveStuckHandoverSla,
  deriveTMinus24hDischargePrompts,
} from "@/components/ward-management/ward-top25-features";

describe("Perfected Top 25 Ward Flow Master List — Pure Domain & Derivation Suite", () => {
  const seeded = seedWardFlowState();
  const seededNow = seeded.auditCaptureStartedAt;
  const NOW_ISO = "2026-10-15T10:00:00.000Z";

  it("#1 Afternoon Discharge & Parallel Support-Service Unblocker", () => {
    const afternoonList = deriveAfternoonDischarges(seeded.admissions, seededNow);
    expect(afternoonList.length).toBeGreaterThan(0);
    expect(deriveAfternoonDischarges([], seededNow)).toEqual([]);

    const dispatches = dispatchParallelDischargeSupport({
      admissionId: afternoonList[0]!.id,
      unitId: afternoonList[0]!.unitId,
      now: NOW_ISO,
    });
    expect(dispatches).toHaveLength(3);
    expect(dispatches.map((d) => d.service)).toEqual(["pharmacy", "transport", "cleaning"]);
    expect(dispatches.every((d) => d.status === "queued")).toBe(true);
    expect(dispatchParallelDischargeSupport({ admissionId: "   ", unitId: "rph", now: NOW_ISO })).toEqual([]);
  });

  it("#2 One-Tap Multi-Ward Parallel Referral Fan-Out", () => {
    const referrable = seeded.movements.find((m) => m.referredUnitIds.length === 0) ?? seeded.movements[0]!;
    const top3 = deriveTopCompatibleWards(referrable, seeded.units, 3);
    expect(top3.length).toBeGreaterThan(0);
    expect(top3.length).toBeLessThanOrEqual(3);
    expect(top3.every((c) => c.failingGates.length === 0)).toBe(true);
    expect(deriveTopCompatibleWards(referrable, seeded.units, 0)).toEqual([]);
  });

  it("#3 Inline Refusal Recovery & Guided Next-Best Action", () => {
    const genderRec = deriveRefusalRecoveryAction("sex_designation_unavailable");
    expect(genderRec.targetFilter).toBe("gender_compatible");
    expect(genderRec.actionLabel).toContain("compatible wards");

    const bedRec = deriveRefusalRecoveryAction("no_suitable_bed");
    expect(bedRec.targetFilter).toBe("open_or_waitlist");

    const authRec = deriveRefusalRecoveryAction("authorised_destination_required");
    expect(authRec.targetFilter).toBe("authorisation_check");

    const fallbackRec = deriveRefusalRecoveryAction("other_unknown_reason");
    expect(fallbackRec.targetFilter).toBe("alternative_ward");
  });

  it("#4 Preparing / Cleaning Ghost-Bed Auto-Expiry & One-Tap Clear", () => {
    const beds = [
      {
        id: "bed-ghost-1",
        unitId: "rph-adult-open",
        status: "preparing" as const,
        preparingStartedAt: "2026-10-15T08:00:00.000Z",
      },
      {
        id: "bed-fresh-2",
        unitId: "rph-adult-open",
        status: "preparing" as const,
        preparingStartedAt: "2026-10-15T09:00:00.000Z",
      },
    ];
    const alerts = deriveGhostPreparingBeds(beds, NOW_ISO);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toBe("bed-ghost-1");
    expect(alerts[0]!.elapsedMinutes).toBe(120);
    expect(alerts[0]!.actionLabel).toBe("Cleaning Complete — Open Bed");

    const opened = completeCleanAndOpenBed(
      { id: "rph-adult-open", availableBeds: 1, preparingBeds: 2, allocatable: 1 },
      "bed-ghost-1",
    );
    expect(opened.availableBeds).toBe(2);
    expect(opened.preparingBeds).toBe(1);
    expect(opened.allocatable).toBe(2);
    // Repeated completion for the same bedId is an idempotent no-op
    const repeated = completeCleanAndOpenBed(opened, "bed-ghost-1");
    expect(repeated.availableBeds).toBe(2);
    expect(repeated.preparingBeds).toBe(1);
  });

  it("#5 T-Minus 24h Discharge Prep & Early Barrier Tagging", () => {
    expect(DISCHARGE_DELAY_REASONS).toHaveLength(8);
    for (const code of DISCHARGE_DELAY_REASONS) {
      expect(dischargeDelayReasonLabels[code]).toBeTruthy();
      expect(dischargeDelayMetadata[code].code).toBe(code);
    }

    const prompts = deriveTMinus24hDischargePrompts(
      [
        { id: "adm-due-18h", unitId: "rph", edd: "2026-10-16T04:00:00.000Z" },
        { id: "adm-due-48h", unitId: "rph", edd: "2026-10-17T12:00:00.000Z" },
        { id: "adm-past", unitId: "rph", edd: "2026-10-15T08:00:00.000Z" },
      ],
      NOW_ISO,
    );
    expect(prompts.map((p) => p.id)).toEqual(["adm-due-18h"]);
  });

  it("#6 Role-Scoped Needs You Action Inbox", () => {
    const items = [
      { id: "1", role: "coordinator", title: "Escalate silent ward", priority: 2 },
      { id: "2", role: "ward", title: "Confirm morning TTO", priority: 1 },
      { id: "3", role: "coordinator", title: "Review 24h ED wait", priority: 1 },
    ];
    const coord = deriveRoleNeedsYouItems(items, "coordinator");
    expect(coord.map((i) => i.id)).toEqual(["3", "1"]);
    expect(deriveRoleNeedsYouItems(items, "unknown_role")).toEqual([]);
  });

  it("#7 Automated Silent-Ward Escalation & Re-Allocation Loop", () => {
    const baseMov = seeded.movements.find((m) => !m.closure && m.acceptedUnitId === undefined) ?? seeded.movements[0]!;
    const unansweredMov = {
      ...baseMov,
      id: "WF-999" as const,
      stage: "destination_review" as const,
      closure: undefined,
      acceptedUnitId: undefined,
      referredAt: seededNow - 300,
      referralDecisionOpenedAt: seededNow - 300,
      openedAt: seededNow - 300,
      stageChanges: [],
      referredUnitIds: ["rph-adult-open"],
      declines: [],
      withdrawnReferrals: [],
    };
    const silent = deriveSilentWards([...seeded.movements, unansweredMov], seededNow + 300);
    expect(silent.length).toBeGreaterThan(0);
    expect(silent.some((s) => s.escalationTier === "escalate_4h")).toBe(true);
  });

  it("#8 HDU / Secure-to-Acute Step-Down Pull Board", () => {
    const matches = deriveStepDownPullBoard(
      [
        { id: "cand-ready", fromUnitId: "fsh-hdu", securityLevel: "HDU", stepDownReady: true, cohort: "Adult" },
        { id: "cand-not-ready", fromUnitId: "fsh-hdu", securityLevel: "HDU", stepDownReady: false, cohort: "Adult" },
      ],
      [
        { id: "fsh-open", securityLevel: "Open", availableBeds: 2, cohort: "Adult" },
        { id: "fsh-full", securityLevel: "Open", availableBeds: 0, cohort: "Adult" },
        { id: "rph-unit-obj", security: "Open", allocatable: { value: 1 }, ageBand: "Adult" },
      ],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]!.candidateId).toBe("cand-ready");
    expect(matches[0]!.compatibleOpenUnitIds).toEqual(["fsh-open", "rph-unit-obj"]);
  });

  it("#9 Criteria-Led Discharge (CLD) Weekend & Morning Unlocker", () => {
    expect(CLD_DEFAULT_CONDITIONS).toHaveLength(3);
    const ready = evaluateCriteriaLedDischarge({
      consultantAuthorised: true,
      conditionsMet: {
        [CLD_DEFAULT_CONDITIONS[0]]: true,
        [CLD_DEFAULT_CONDITIONS[1]]: true,
        [CLD_DEFAULT_CONDITIONS[2]]: true,
      },
    });
    expect(ready.canNurseExecuteDischarge).toBe(true);
    expect(ready.unmetConditions).toHaveLength(0);

    const incomplete = evaluateCriteriaLedDischarge({
      consultantAuthorised: true,
      conditionsMet: {
        [CLD_DEFAULT_CONDITIONS[0]]: true,
        [CLD_DEFAULT_CONDITIONS[1]]: false,
        [CLD_DEFAULT_CONDITIONS[2]]: true,
      },
    });
    expect(incomplete.canNurseExecuteDischarge).toBe(false);
    expect(incomplete.unmetConditions).toEqual([CLD_DEFAULT_CONDITIONS[1]]);
  });

  it("#11 Community Treatment Order (CTO) & 7-Day Follow-Up Handshake", () => {
    const missing = deriveCtoFollowUpHandshake({
      admissionId: "adm-1",
      isCto: true,
      assignedCaseManager: null,
      followUpAppointmentAt: null,
    });
    expect(missing.warningActive).toBe(true);
    expect(missing.blocksDischarge).toBe(false);
    expect(missing.missingFields).toEqual(["assignedCaseManager", "followUpAppointmentAt"]);

    const placeholderFollowUp = deriveCtoFollowUpHandshake({
      admissionId: "adm-placeholder",
      isCto: true,
      assignedCaseManager: "Mirrabooka CMHT",
      followUpAppointmentAt: "TBD",
    });
    expect(placeholderFollowUp.warningActive).toBe(true);
    expect(placeholderFollowUp.missingFields).toEqual(["followUpAppointmentAt"]);

    const complete = deriveCtoFollowUpHandshake({
      admissionId: "adm-2",
      isCto: true,
      assignedCaseManager: "Mirrabooka CMHT",
      followUpAppointmentAt: "2026-10-20T10:00:00.000Z",
    });
    expect(complete.warningActive).toBe(false);
    expect(complete.blocksDischarge).toBe(false);
  });

  it("#12 Stuck-Handover SLA Timer & Escalation Nudge", () => {
    const stuck = deriveStuckHandoverSla(
      { movementId: "mov-1", acceptedAt: "2026-10-15T06:00:00.000Z", stage: "accepted" },
      NOW_ISO,
    );
    expect(stuck.elapsedMinutes).toBe(240);
    expect(stuck.isStuck).toBe(true);
    expect(stuck.promptsNudge).toBe(true);
  });

  it("#13 ED 8h / 12h / 24h Breach Prevention Escalation Ladder", () => {
    const ladder = deriveEdBreachLadder(
      [
        { id: "ed-9h", arrivedAt: "2026-10-15T01:00:00.000Z" },
        { id: "ed-26h", arrivedAt: "2026-10-14T08:00:00.000Z" },
        { id: "ed-14h", arrivedAt: "2026-10-14T20:00:00.000Z" },
        { id: "ed-3h", arrivedAt: "2026-10-15T07:00:00.000Z" },
      ],
      NOW_ISO,
    );
    expect(ladder.map((x) => x.id)).toEqual(["ed-26h", "ed-14h", "ed-9h", "ed-3h"]);
    expect(ladder[0]!.tier).toBe("24h_critical");
    expect(ladder[1]!.tier).toBe("12h_escalate");
    expect(ladder[2]!.tier).toBe("8h_warning");
    expect(ladder[3]!.tier).toBe("normal");
  });

  it("#14 Pre-Flight Admissions Packet (4-Tick Clearance Card)", () => {
    const partial = derivePreFlightAdmissionsPacket({
      medicalClearance: true,
      legalPaperwork: true,
      contrabandSearch: false,
      medicationChart: true,
    });
    expect(partial.allComplete).toBe(false);
    expect(partial.completedCount).toBe(3);
    expect(partial.missingItems).toEqual(["contrabandSearch"]);

    const full = derivePreFlightAdmissionsPacket({
      medicalClearance: true,
      legalPaperwork: true,
      contrabandSearch: true,
      medicationChart: true,
    });
    expect(full.allComplete).toBe(true);
    expect(full.completedCount).toBe(4);
  });

  it("#15 Cleaning-Bed Pre-Match (Transport-During-Clean Overlap)", () => {
    expect(canPreMatchCleaningBed({ id: "b1", status: "preparing" })).toBe(true);
    expect(canPreMatchCleaningBed({ id: "b2", status: "available" })).toBe(true);
    expect(canPreMatchCleaningBed({ id: "b3", status: "occupied" })).toBe(false);
    expect(canPreMatchCleaningBed({ id: "b4", status: "blocked" })).toBe(false);
  });

  it("#16 Inter-Ward Step-Down Swap Matcher (1-for-1 Mutual Exchange)", () => {
    const swaps = deriveInterWardStepDownSwaps([
      { id: "req-1", fromUnitId: "fsh-hdu", toUnitId: "fsh-open", reason: "step_down" },
      { id: "req-2", fromUnitId: "fsh-open", toUnitId: "fsh-hdu", reason: "step_up_acuity" },
      { id: "req-3", fromUnitId: "rph-open", toUnitId: "scgh-open", reason: "catchment" },
    ]);
    expect(swaps).toHaveLength(1);
    expect(swaps[0]!.requestA.id).toBe("req-1");
    expect(swaps[0]!.requestB.id).toBe("req-2");
  });

  it("#17 8-Second Undo Hairline Window on Destructive Decisions", () => {
    const undo = createUndoWindowState({
      actionId: "act-1",
      label: "Declined referral",
      createdAtMs: 1000,
    });
    expect(undo.durationMs).toBe(8000);
    expect(undo.canUndo).toBe(true);
  });

  it("#19 Paper-Form Statutory Expiry Radar (4h Amber / 1h Red)", () => {
    const radar = derivePaperLegalExpiryRadar(
      [
        { id: "f-crit", formType: "Form 1A", expiresAt: "2026-10-15T10:45:00.000Z" },
        { id: "f-warn", formType: "Form 3B", expiresAt: "2026-10-15T13:00:00.000Z" },
        { id: "f-norm", formType: "Form 6A", expiresAt: "2026-10-15T18:00:00.000Z" },
      ],
      NOW_ISO,
    );
    expect(radar.find((f) => f.id === "f-crit")?.urgency).toBe("critical_1h");
    expect(radar.find((f) => f.id === "f-warn")?.urgency).toBe("warning_4h");
    expect(radar.find((f) => f.id === "f-norm")?.urgency).toBe("normal");
  });

  it("#20 Marooned Long-Stay Patient Escalation Dossier", () => {
    const dossier = deriveMaroonedPatientDossier([
      { id: "m-21", daysDelayed: 21, barrierCategory: "ndis_support", clinicallyReadyForDischarge: true },
      { id: "m-35", daysDelayed: 35, barrierCategory: "sat_hearing", clinicallyReadyForDischarge: true },
      { id: "m-3", daysDelayed: 3, barrierCategory: "transport", clinicallyReadyForDischarge: true },
    ]);
    expect(dossier.map((d) => d.id)).toEqual(["m-35", "m-21"]);
    expect(dossier[0]!.estimatedBedDaysSaved).toBe(35);
  });

  it("#21 EDD Drift & Confidence Indicator", () => {
    const low = deriveEddDriftBadge({
      eddRevisions: ["2026-10-10", "2026-10-12", "2026-10-14", "2026-10-16"],
    });
    expect(low.revisionCount).toBe(3);
    expect(low.confidence).toBe("low");
    expect(low.requiresConsultantReview).toBe(true);
    expect(low.label).toContain("Moved ×3");

    const high = deriveEddDriftBadge({ dischargeDateMoves: 0 });
    expect(high.confidence).toBe("high");
    expect(high.requiresConsultantReview).toBe(false);
  });

  it("#23 Mobile Walk-Round Bottom-Sheet (390x844 Thumb-Zone Mode)", () => {
    expect(PHONE_WALK_ROUND_VIEWPORT).toEqual({
      width: 390,
      height: 844,
      rowHeightPx: 52,
    });
  });

  it("#24 AWOL / Unauthorised Leave Immediate Safety & Bed-Hold Tracker", () => {
    const summary = deriveAwolTrackerSummary(
      {
        patientId: "SYNTH-AWOL-1",
        unitId: "gyl-secure",
        reportedAt: "2026-10-15T05:00:00.000Z",
        wapolNotified: true,
        nextOfKinNotified: false,
        bedHeld: true,
      },
      NOW_ISO,
    );
    expect(summary.elapsedMinutes).toBe(300);
    expect(summary.bedStatus).toBe("held_on_awol");
    expect(summary.holdWarningActive).toBe(true);
  });

  it("#25 Broadcast Alert Auto-Expiry & Stand-Down Lifecycle", () => {
    expect(DEFAULT_BROADCAST_DURATION_MINUTES).toBe(240);
    expect(DEFAULT_BROADCAST_EXTENSION_MINUTES).toBe(120);

    // Standalone reducer lifecycle
    const created = wardBroadcastReducer(initialWardBroadcastState, {
      type: "CREATE_BROADCAST_ALERT",
      id: "bcast-1",
      message: "Statewide HDU surge",
      severity: "critical",
      author: "Coordinator",
      now: "2026-10-15T08:00:00.000Z",
    });
    expect(created.activeAlert?.expiresAt).toBe("2026-10-15T12:00:00.000Z");

    // An elapsed alert cannot be revived by extending it.
    const lateExtend = wardBroadcastReducer(created, {
      type: "EXTEND_BROADCAST_ALERT",
      now: "2026-10-15T12:30:00.000Z",
    });
    expect(lateExtend.activeAlert?.expiresAt).toBe("2026-10-15T12:00:00.000Z");

    const extended = wardBroadcastReducer(created, {
      type: "EXTEND_BROADCAST_ALERT",
      now: "2026-10-15T09:00:00.000Z",
    });
    expect(extended.activeAlert?.expiresAt).toBe("2026-10-15T14:00:00.000Z");

    const cleared = wardBroadcastReducer(extended, {
      type: "CLEAR_BROADCAST_ALERT",
    });
    expect(cleared.activeAlert).toBeNull();

    // Main WardFlowState extendBroadcastAlert helper
    const withAlert = wardFlowReducer(seeded, {
      type: "DISPATCH_BROADCAST_ALERT",
      role: "coordinator",
      now: seededNow,
      title: "Surge Directive",
      message: "Review morning discharges",
      severity: "critical",
      category: "capacity_gridlock",
      targetScope: "all",
      targetScopeLabel: "All units",
      durationMinutes: DEFAULT_BROADCAST_DURATION_MINUTES,
      dispatchedByName: "State Bed Desk",
    });
    const alertId = withAlert.broadcastAlerts[0]!.id;
    const afterExtend = extendBroadcastAlert(withAlert, alertId, seededNow);
    expect(afterExtend.broadcastAlerts[0]!.expiresAt).toBe(
      withAlert.broadcastAlerts[0]!.expiresAt + DEFAULT_BROADCAST_EXTENSION_MINUTES,
    );
  });

  it("review hardening: preparing flag, resumedAt 0, swap order, CTO manager and 7-day slot, step-down readiness", () => {
    // #4 the preparing flag follows the count: the last preparing bed opening clears it, whatever the bed id.
    const lastBed = completeCleanAndOpenBed(
      { id: "u-1", preparingBeds: 1, preparing: true, availableBeds: 0 },
      "bed-9",
    );
    expect(lastBed.preparing).toBe(false);
    expect(lastBed.preparingBeds).toBe(0);
    const stillPreparing = completeCleanAndOpenBed({ id: "u-2", preparingBeds: 2, preparing: true }, "bed-9");
    expect(stillPreparing.preparing).toBe(true);

    // #15 a recorded resumption at instant 0 is a resumption.
    expect(
      canPreMatchCleaningBed({
        id: "b-0",
        status: "preparing",
        medicalDeterioration: { at: -10, resumedAt: 0 },
      }),
    ).toBe(true);

    // #16 the step-down chain pairs the same two requests in either order.
    const stepDown = { id: "r-sd", fromUnitId: "hdu", toUnitId: "acute", reason: "step_down" };
    const edToHdu = { id: "r-ed", fromUnitId: "ed", toUnitId: "hdu", reason: "ed_to_hdu" };
    expect(deriveInterWardStepDownSwaps([stepDown, edToHdu])).toHaveLength(1);
    expect(deriveInterWardStepDownSwaps([edToHdu, stepDown])).toHaveLength(1);

    // #11 a clinic is a place, not a case manager; with a departure time the follow-up must fall within 7 days.
    const clinicOnly = deriveCtoFollowUpHandshake({
      admissionId: "adm-clinic",
      isCto: true,
      assignedCaseManager: null,
      followUpAppointmentAt: "2026-10-20T10:00:00.000Z",
      communityTreatmentOrder: { clinic: "Mirrabooka CMHT" },
    });
    expect(clinicOnly.missingFields).toEqual(["assignedCaseManager"]);
    const lateSlot = deriveCtoFollowUpHandshake({
      admissionId: "adm-late",
      isCto: true,
      assignedCaseManager: "A. Nurse",
      followUpAppointmentAt: "2026-11-30T10:00:00.000Z",
      referenceAt: "2026-10-15T10:00:00.000Z",
    });
    expect(lateSlot.missingFields).toEqual(["followUpAppointmentAt"]);
    const inWeek = deriveCtoFollowUpHandshake({
      admissionId: "adm-week",
      isCto: true,
      assignedCaseManager: "A. Nurse",
      followUpAppointmentAt: "2026-10-20T10:00:00.000Z",
      referenceAt: "2026-10-15T10:00:00.000Z",
    });
    expect(inWeek.warningActive).toBe(false);

    // #8 a planned destination alone is not step-down readiness.
    const board = deriveStepDownPullBoard(
      [
        {
          id: "cand-dest",
          fromUnitId: "fsh-hdu",
          securityLevel: "HDU",
          dischargeDestination: "mental_health_step_down",
          cohort: "Adult",
        },
        {
          id: "cand-denied",
          fromUnitId: "fsh-hdu",
          securityLevel: "HDU",
          stepDownReady: false,
          dischargeDestination: "mental_health_step_down",
          cohort: "Adult",
        },
      ],
      [{ id: "open-1", securityLevel: "Open", availableBeds: 2, cohort: "Adult" }],
    );
    expect(board).toEqual([]);
  });

  it("handles edge cases across #9 custom CLD keys, #15 medical deterioration, #19 malformed dates, #20 >72h UMRN, #21 driftDays, and #24 6-step fraction", () => {
    // #9 Custom consultant CLD condition keys
    const customCld = evaluateCriteriaLedDischarge({
      consultantAuthorised: true,
      conditionsMet: {
        custom_family_meeting: true,
        custom_depot_administered: false,
      },
    });
    // The three standard conditions stay required, so 3 missing standard + 1 unmet custom stay unmet.
    expect(customCld.totalCount).toBe(5);
    expect(customCld.metCount).toBe(1);
    expect(customCld.canNurseExecuteDischarge).toBe(false);
    expect(customCld.unmetConditions).toEqual([...CLD_DEFAULT_CONDITIONS, "custom_depot_administered"]);

    // A partial record (or an empty one) can never unlock a nurse-led discharge.
    const partial = evaluateCriteriaLedDischarge({
      consultantAuthorised: true,
      conditionsMet: { [CLD_DEFAULT_CONDITIONS[0]]: true },
    });
    expect(partial.canNurseExecuteDischarge).toBe(false);
    expect(partial.totalCount).toBe(3);
    expect(partial.unmetConditions).toEqual([CLD_DEFAULT_CONDITIONS[1], CLD_DEFAULT_CONDITIONS[2]]);
    expect(
      evaluateCriteriaLedDischarge({ consultantAuthorised: true, conditionsMet: {} }).canNurseExecuteDischarge,
    ).toBe(false);

    // Extra consultant conditions that are all met do not replace the standard ones.
    const allMetWithExtra = evaluateCriteriaLedDischarge({
      consultantAuthorised: true,
      conditionsMet: {
        [CLD_DEFAULT_CONDITIONS[0]]: true,
        [CLD_DEFAULT_CONDITIONS[1]]: true,
        [CLD_DEFAULT_CONDITIONS[2]]: true,
        custom_family_meeting: true,
      },
    });
    expect(allMetWithExtra.canNurseExecuteDischarge).toBe(true);
    expect(allMetWithExtra.totalCount).toBe(4);

    // #15 Medical deterioration (D-34) blocks cleaning pre-match until resumed
    expect(
      canPreMatchCleaningBed({
        id: "b-det",
        status: "preparing",
        medicalDeterioration: { at: "2026-10-15T08:00:00.000Z" },
      }),
    ).toBe(false);
    expect(
      canPreMatchCleaningBed({
        id: "b-resumed",
        status: "preparing",
        medicalDeterioration: {
          at: "2026-10-15T08:00:00.000Z",
          resumedAt: "2026-10-15T09:00:00.000Z",
        },
      }),
    ).toBe(true);

    // #19 Malformed date string returns "unrecorded" urgency, sorted last
    const radar = derivePaperLegalExpiryRadar(
      [
        { id: "f-later", formType: "Form 6A", expiresAt: "2026-10-15T18:00:00.000Z" },
        { id: "f-bad", formType: "Form 1A", expiresAt: "not-a-valid-date" },
        { id: "f-soon", formType: "Form 3B", expiresAt: "2026-10-15T10:30:00.000Z" },
      ],
      NOW_ISO,
    );
    // A date that cannot be read is "unrecorded", never a passed deadline, and sorts after the dated forms.
    expect(radar.map((r) => r.id)).toEqual(["f-soon", "f-later", "f-bad"]);
    expect(radar[2]).toMatchObject({
      id: "f-bad",
      remainingMinutes: 0,
      urgency: "unrecorded",
      edgeAct: false,
    });

    // #20 >72h hoursDelayed and UMRN (D-39) in escalationSummary
    const marooned = deriveMaroonedPatientDossier([
      {
        id: "m-80h",
        umrn: "UMRN-904112",
        daysDelayed: 4,
        hoursDelayed: 80,
        barrierCategory: "ndis_support",
        clinicallyReadyForDischarge: true,
      },
    ]);
    expect(marooned).toHaveLength(1);
    expect(marooned[0]!.escalationSummary).toContain("[UMRN-904112]");

    // #21 Cumulative driftDays and rememberedReason
    const drift = deriveEddDriftBadge({
      eddRevisions: ["2026-10-10", "2026-10-12", "2026-10-15"],
      dischargeDelayReason: "ndis_support",
    });
    expect(drift.driftDays).toBe(5);
    expect(drift.rememberedReason).toBe("ndis_support");
    expect(drift.label).toContain("EDD +5d");

    // #24 6-step fraction summary
    const awol = deriveAwolTrackerSummary(
      {
        patientId: "SYNTH-AWOL-2",
        unitId: "gyl-secure",
        reportedAt: "2026-10-15T09:00:00.000Z",
        wapolNotified: true,
        nextOfKinNotified: true,
        bedHeld: true,
        completedSteps: 4,
      },
      NOW_ISO,
    );
    expect(awol.totalSteps).toBe(6);
    expect(awol.completedSteps).toBe(4);
    expect(awol.fractionLabel).toBe("4/6 steps done");
  });
});
