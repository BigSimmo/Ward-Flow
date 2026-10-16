import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import {
  answerSilenceReminder,
  causeOf,
  lastRecordedActivity,
} from "../src/components/ward-management/delays/delays-derivations";
import { allDeclines } from "../src/components/ward-management/ward-derivations";
import { isMovementWithdrawable } from "../src/components/ward-management/ward-referrals";
import { EVENT_ROLE } from "../src/components/ward-management/ward-flow-events";
import { CROSS_ROLE_ALLOWED } from "../src/components/ward-management/ward-role-permissions";
import { COORDINATOR_DESK_ACKNOWLEDGER_ID } from "../src/components/ward-management/alerts/ward-broadcast-model";
import { ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS } from "../src/components/ward-management/ward-model";
import { reduceBroadcastEvent } from "../src/components/ward-management/alerts/ward-broadcast-reducer";
import { captureAuditEvent } from "../src/components/ward-management/ward-audit";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
const NOW = NOW_ANCHOR;

describe("19 Engine, Derivation, and Backend Defect Remediations", () => {
  describe("Stream 1: Core State Machine Invariants (ward-flow-reducer.ts)", () => {
    it("S2-6: rejects RECORD_REPATRIATION for discharged admissions or closed movements", () => {
      const state = seedWardFlowState();
      const openAdm = state.admissions.find((a) => a.state === "occupied");
      expect(openAdm).toBeDefined();

      // Discharged admission
      const dischargedAdm = { ...openAdm!, state: "departed" as const, leftAt: NOW, dischargedAt: NOW };
      const stateWithDischarged = {
        ...state,
        admissions: state.admissions.map((a) => (a.id === openAdm!.id ? dischargedAdm : a)),
      };

      const result = wardFlowReducer(stateWithDischarged, {
        type: "RECORD_REPATRIATION",
        admissionId: openAdm!.id,
        homeHospital: "FSH",
        receivingWardAgreed: true,
        mode: "flight",
        provider: "Ambulance service",
        cadNumber: "CAD-9999",
        transportLegalStatus: "voluntary",
        estimatedAt: NOW + 3600,
        now: NOW,
        role: "coordinator",
      });

      expect(result.rejections.length).toBeGreaterThan(0);
      expect(result.rejections[result.rejections.length - 1].reason).toContain("cannot initiate repatriation");
    });

    it("S1-3: preserves patientId when referring unscheduled walk-in community intake", () => {
      const state = seedWardFlowState();
      const baseMov = state.movements.find((m) => !m.closure && !m.legalForm) ?? state.movements[0];
      const mov: Movement = {
        ...baseMov,
        id: "WF-WALKIN-1",
        referralId: undefined,
        patientId: "PT-WALKIN-999",
      };
      const stateWithMov = {
        ...state,
        movements: [mov, ...state.movements],
      };

      const result = wardFlowReducer(stateWithMov, {
        type: "REFER_TO_COMMUNITY_TEAM",
        movementId: mov.id,
        team: "Mirrabooka",
        now: NOW,
        role: "coordinator",
      });

      const newRef = result.referrals.find((r) =>
        r.destinations.some((d) => d.destination.kind === "community_team" && d.destination.teamName === "Mirrabooka"),
      );
      expect(newRef).toBeDefined();
      expect(newRef?.patientId).toBe("PT-WALKIN-999");
    });

    it("S1-6: only appends placement overrides when units actually received an override", () => {
      const state = seedWardFlowState();
      const mov = state.movements.find((m) => m.stage === "placement_requested" || m.stage === "destination_review");
      expect(mov, "seed must contain a matching movement").toBeDefined();
      if (!mov) return;

      const initialOverridesCount = mov.overrides.length;
      const result = wardFlowReducer(state, {
        type: "REFER_TO_UNITS",
        movementId: mov.id,
        unitIds: [],
        overrideReason: "Clinical urgency outweighs the mismatch",
        now: NOW,
        role: "coordinator",
      });

      const updatedMov = result.movements.find((m) => m.id === mov.id);
      expect(updatedMov?.overrides.length).toBe(initialOverridesCount);
      expect(result.rejections.length).toBeGreaterThan(state.rejections.length);
    });

    it("S2-5: rejects SET_ARRIVAL_DETAILS on closed movements", () => {
      const state = seedWardFlowState();
      const mov = state.movements[0];
      const closedMov: Movement = {
        ...mov,
        closure: { outcome: "did_not_proceed", at: NOW, reason: "patient_declined" },
      };
      const stateWithClosed = {
        ...state,
        movements: state.movements.map((m) => (m.id === mov.id ? closedMov : m)),
      };

      const result = wardFlowReducer(stateWithClosed, {
        type: "SET_ARRIVAL_DETAILS",
        movementId: mov.id,
        arrivalMode: "ambulance",
        estimatedArrivalAt: NOW + 3600,
        now: NOW,
        role: "coordinator",
      });

      expect(result.rejections.length).toBeGreaterThan(0);
      expect(result.rejections[result.rejections.length - 1].reason).toContain(
        "cannot update arrival details on closed movement",
      );
    });

    it("S1-12: UPDATE_EXPECTED_DISCHARGE strictly requires actingUnitId to match admission.unitId when role is ward", () => {
      const state = seedWardFlowState();
      const adm = state.admissions.find((a) => a.state === "occupied");
      expect(adm).toBeDefined();

      const result = wardFlowReducer(state, {
        type: "UPDATE_EXPECTED_DISCHARGE",
        admissionId: adm!.id,
        expectedDischargeAt: NOW + 86400,
        actingUnitId: undefined, // Missing actingUnitId
        now: NOW,
        role: "ward",
      });

      expect(result.rejections.length).toBeGreaterThan(0);
      expect(result.rejections[result.rejections.length - 1].reason).toContain(
        "UPDATE_EXPECTED_DISCHARGE was raised acting as unit",
      );
    });
  });

  describe("Stream 2: Delays Derivations (delays-derivations.ts)", () => {
    it("A3-4: does not categorize unreferred ED patients under no_eligible_bed", () => {
      const state = seedWardFlowState();
      const mov = state.movements.find((m) => m.referredUnitIds.length === 0 && !m.acceptedUnitId && !m.closure);
      expect(mov, "seed must contain a matching movement").toBeDefined();
      if (!mov) return;

      const cause = causeOf(mov, state.units, NOW, DEFAULT_DUE_SOON_THRESHOLDS);
      expect(cause).not.toBe("no_eligible_bed");
      expect(cause).toBe("awaiting_coordinator");
    });

    it("A3-11: includes acceptedAt in lastRecordedActivity", () => {
      const state = seedWardFlowState();
      const mov = {
        ...state.movements[0],
        openedAt: NOW - 1000,
        declines: [],
        withdrawnReferrals: [],
        referredAt: undefined,
        referralAbsence: undefined,
        formedAt: undefined,
        acceptedAt: NOW - 500,
        transport: undefined,
        examination: undefined,
        closure: undefined,
        stageChanges: [],
      } as unknown as Movement;

      const activity = lastRecordedActivity(mov, NOW);
      expect(activity).toBeDefined();
      expect(activity?.at).toBe(NOW - 500);
      expect(activity?.what).toBe("a ward accepted");
    });

    it("A3-12: routes revoked-examination hold delay items to coordinator", () => {
      const state = seedWardFlowState();
      const mov: Movement = {
        ...state.movements[0],
        stage: "placement_requested",
        closure: undefined,
        examination: { outcome: "revoked", at: NOW - 100 },
        transport: {
          id: "TJ-1",
          provider: "Ambulance service",
          escortRequired: false,
        },
      };

      const cause = causeOf(mov, state.units, NOW, DEFAULT_DUE_SOON_THRESHOLDS);
      expect(cause).toBe("awaiting_coordinator");

      // Also routes community_order outcome when bed is held
      const communityOrderMov: Movement = {
        ...mov,
        admissionId: "ADM-REVOKED-1",
        examination: { outcome: "community_order", at: NOW - 100 },
      };
      expect(causeOf(communityOrderMov, state.units, NOW, DEFAULT_DUE_SOON_THRESHOLDS)).toBe("awaiting_coordinator");

      // A held bed stepped back to stage "pulled" with revoked examination routes to coordinator, not awaiting_bed_ready
      const pulledRevokedMov: Movement = {
        ...mov,
        stage: "pulled",
        admissionId: "ADM-REVOKED-1",
        examination: { outcome: "revoked", at: NOW - 100 },
      };
      expect(causeOf(pulledRevokedMov, state.units, NOW, DEFAULT_DUE_SOON_THRESHOLDS)).toBe("awaiting_coordinator");
    });

    it("A3-13: answerSilenceReminder respects movement.referredUnitIds for wards added later or ED/community referrals", () => {
      const state = seedWardFlowState();
      const mov: Movement = {
        ...state.movements[0],
        stage: "placement_requested",
        closure: undefined,
        acceptedUnitId: undefined,
        referredUnitIds: ["U1"],
        referredAt: NOW - 180, // 3 hours ago
      };

      const baseReferral = state.referrals[0];

      // Case 1: ED-only referral with no psychiatric ward addressing, but movement referred to units
      const edOnlyReferral: Referral = {
        ...baseReferral,
        id: "REF-ED-1",
        patientId: mov.patientId,
        raisedAt: NOW - 200,
        destinations: [
          {
            destination: { kind: "emergency_department", edId: "ed-1", purpose: "bed" },
            state: "accepted",
          },
        ],
      };
      const linkedMov: Movement = {
        ...mov,
        referralId: "REF-ED-1",
      };
      const reminder = answerSilenceReminder(linkedMov, [edOnlyReferral], NOW);
      expect(reminder).toBeDefined();
      expect(reminder).toContain("Ward silent 2 hours");

      // Case 2: Psychiatric ward addressing answered/waitlisted on referral -> should NOT show silent reminder
      const waitlistedReferral: Referral = {
        ...baseReferral,
        id: "REF-WARD-1",
        patientId: mov.patientId,
        raisedAt: NOW - 200,
        destinations: [
          {
            destination: {
              kind: "psychiatric_ward",
              unitId: "U2",
              sex: "Female",
              secureBedNeeded: false,
              involuntaryBedNeeded: false,
              highAcuityNursingNeeded: false,
            },
            state: "queued",
            waitlistedAt: NOW - 190,
          },
        ],
      };
      const linkedWaitlistedMov: Movement = {
        ...mov,
        referralId: "REF-WARD-1",
      };
      const reminder2 = answerSilenceReminder(linkedWaitlistedMov, [waitlistedReferral], NOW);
      expect(reminder2).toBeUndefined();

      // Case 3: Referral with both an answered ward and a silent ward -> derives from the silent ward
      const mixedReferral: Referral = {
        ...baseReferral,
        id: "REF-WARD-2",
        patientId: mov.patientId,
        raisedAt: NOW - 200,
        destinations: [
          {
            destination: {
              kind: "psychiatric_ward",
              unitId: "U2",
              sex: "Female",
              secureBedNeeded: false,
              involuntaryBedNeeded: false,
              highAcuityNursingNeeded: false,
            },
            state: "queued",
            waitlistedAt: NOW - 190,
          },
          {
            destination: {
              kind: "psychiatric_ward",
              unitId: "U3",
              sex: "Female",
              secureBedNeeded: false,
              involuntaryBedNeeded: false,
              highAcuityNursingNeeded: false,
            },
            state: "queued",
            referredAt: NOW - 180,
          },
        ],
      };
      const linkedMixedMov: Movement = {
        ...mov,
        referralId: "REF-WARD-2",
      };
      const reminder3 = answerSilenceReminder(linkedMixedMov, [mixedReferral], NOW);
      expect(reminder3).toBeDefined();
      expect(reminder3).toContain("Ward silent 2 hours");

      // Case 4: Older queued ward destination without arm-level referredAt -> falls back to movement.referredAt
      const olderReferral: Referral = {
        ...baseReferral,
        id: "REF-WARD-3",
        patientId: mov.patientId,
        raisedAt: NOW - 200,
        destinations: [
          {
            destination: {
              kind: "psychiatric_ward",
              unitId: "U4",
              sex: "Female",
              secureBedNeeded: false,
              involuntaryBedNeeded: false,
              highAcuityNursingNeeded: false,
            },
            state: "queued",
            // referredAt is absent (older record)
          },
        ],
      };
      const linkedOlderMov: Movement = {
        ...mov,
        referralId: "REF-WARD-3",
      };
      const reminder4 = answerSilenceReminder(linkedOlderMov, [olderReferral], NOW);
      expect(reminder4).toBeDefined();
      expect(reminder4).toContain("Ward silent 2 hours");
    });
  });

  describe("Stream 3: Ward Derivations and Referrals", () => {
    it("A3-6: excludes waitlist reasons from allDeclines()", () => {
      const state = seedWardFlowState();
      const mov: Movement = {
        ...state.movements[0],
        declines: [
          { at: NOW - 100, unitId: "U1", reason: "acuity_mix" },
          { at: NOW - 50, unitId: "U2", reason: "no_bed" },
        ],
      };

      const declines = allDeclines([mov]);
      expect(declines.length).toBe(1);
      expect(declines[0].decline.reason).toBe("acuity_mix");
    });

    it("S2-14: isMovementWithdrawable correctly checks movement stages", () => {
      const state = seedWardFlowState();
      const openMov = state.movements.find((m) => !m.closure && m.stage === "destination_review");
      if (openMov) {
        expect(isMovementWithdrawable(openMov)).toBe(true);
      }

      const closedMov: Movement = {
        ...state.movements[0],
        closure: { outcome: "arrived", at: NOW, reason: "transferred" },
      };
      expect(isMovementWithdrawable(closedMov)).toBe(false);
    });
  });

  describe("Stream 4: Event Scoping, Model Constants, Broadcast Alerts", () => {
    it("A1-7: the ward raises referrals in its own name, and only as the sending ward", () => {
      // Role access plan (15 Oct 2026). `ward` is in EVENT_ROLE now that the reducer refuses a
      // ward-raised referral under any source but psychiatric_ward
      // (`tests/ward-referral-ward-source.test.ts`). The New referral sheet on a ward page sends in
      // that ward's name too, so no cross-role pair borrows another role for it.
      expect(EVENT_ROLE.RECEIVE_REFERRAL).toContain("ward");
      expect(CROSS_ROLE_ALLOWED.some((pair) => pair.routeRole === "ward" && pair.event === "RECEIVE_REFERRAL")).toBe(
        false,
      );
      const before = seedWardFlowState();
      const unit = before.units[0];
      const after = wardFlowReducer(before, {
        type: "RECEIVE_REFERRAL",
        role: "ward",
        now: NOW_ANCHOR,
        ageBand: unit.cohort,
        destinations: [
          {
            kind: "psychiatric_ward",
            sex: "Female",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
        ],
        homeRegion: "Perth Metropolitan",
        suburb: { kind: "named", name: "Armadale" },
        source: "community",
        urgency: 2,
        originSiteCode: unit.siteCode,
        transportNeeded: false,
        history: "Synthetic history.",
      });
      expect(after.referrals.length).toBe(before.referrals.length);
      expect(after.rejections.at(-1)?.reason).toContain("raised as role ward must carry source psychiatric_ward");
    });

    it("S1-14: ED medical bed release timeout equals 24 hours (clinical owner ruling, 14 Oct 2026)", () => {
      expect(ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS).toBe(24);
    });

    it("A1-13: restricts coordinator desk alert acknowledgment to coordinator role", () => {
      const alertState: WardFlowState = {
        ...seedWardFlowState(),
        broadcastAlerts: [
          {
            id: "BCAST-1",
            title: "Overcapacity Alert",
            message: "All beds full",
            severity: "critical" as const,
            category: "capacity_gridlock" as const,
            targetScope: "all" as const,
            targetScopeLabel: "All",
            durationMinutes: 60,
            dispatchedAt: NOW - 100,
            expiresAt: NOW + 3500,
            dispatchedByRole: "coordinator" as const,
            dispatchedByName: "State Bed Desk",
            status: "active" as const,
            acknowledgedUnits: [],
          },
        ],
        broadcastSequence: 1,
      };

      const result = reduceBroadcastEvent(alertState, {
        type: "ACKNOWLEDGE_BROADCAST_ALERT",
        alertId: "BCAST-1",
        unitId: COORDINATOR_DESK_ACKNOWLEDGER_ID,
        role: "ward", // Non-coordinator attempting coordinator desk ack
        now: NOW,
      });

      expect(result).toBeUndefined(); // Rejected
    });
  });

  describe("Stream 5: Legal Form Expiry Audit Distinction", () => {
    it("A1-11: distinguishes expiry-recorded from extension-recorded based on priorDueAt", () => {
      const state = seedWardFlowState();
      const mov = state.movements[0];

      // Initial expiry set
      const stateNoPrior = {
        ...state,
        movements: [
          {
            ...mov,
            legalForm: { code: "1A" as const, kind: "examination" as const, dueAt: undefined },
          },
        ],
      };

      const auditEvent1 = captureAuditEvent(
        stateNoPrior,
        stateNoPrior,
        {
          type: "RECORD_LEGAL_FORM_EXPIRY",
          movementId: mov.id,
          dueAt: NOW + 7200,
          now: NOW,
          role: "coordinator",
        },
        true,
      );

      expect(auditEvent1?.category).toBe("legal-form");
      expect((auditEvent1?.details as Record<string, unknown> | undefined)?.operation).toBe("expiry-recorded");

      // Extension set
      const stateWithPrior = {
        ...state,
        movements: [
          {
            ...mov,
            legalForm: { code: "1A" as const, kind: "examination" as const, dueAt: NOW + 3600 },
          },
        ],
      };

      const auditEvent2 = captureAuditEvent(
        stateWithPrior,
        stateWithPrior,
        {
          type: "RECORD_LEGAL_FORM_EXPIRY",
          movementId: mov.id,
          dueAt: NOW + 7200,
          now: NOW,
          role: "coordinator",
        },
        true,
      );

      expect((auditEvent2?.details as Record<string, unknown> | undefined)?.operation).toBe("extension-recorded");
    });
  });
});
