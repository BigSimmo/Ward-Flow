/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  STAGE_TRANSITION_BLOCKERS,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { changeAudit, handoverSnapshot } from "../src/components/ward-management/ward-derivations";
import { changeReasonLabels } from "../src/components/ward-management/ward-change-reasons";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { logger } from "../src/lib/logger";
import { CONTINUATION_LEGAL_FORMS } from "../src/components/ward-management/ward-legal-forms";
import { auditSubject } from "../src/components/ward-management/ward-audit";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const NOW = NOW_ANCHOR;

describe("Group A Defect Remediation — Clinical, Legal & Operational Fixes", () => {
  describe("Fix S1-4 & S2-4: Transport cancellation and ward notices on referral withdrawal", () => {
    it("post-acceptance withdrawal with booked transport notifies the officer and accepting ward (S1-4b)", () => {
      let state = seedWardFlowState();
      const movementId = "WF-001";
      const unitId = "scgh-adult-open";

      // Move WF-001 through refer -> accept -> pull -> book transport
      state = wardFlowReducer(state, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW,
        movementId,
        unitIds: [unitId],
      });
      state = wardFlowReducer(state, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: NOW + 5,
        movementId,
        unitId,
      });
      state = wardFlowReducer(state, {
        type: "PULL_PATIENT",
        role: "ward",
        now: NOW + 10,
        movementId,
        unitId,
      });
      state = wardFlowReducer(state, {
        type: "BOOK_TRANSPORT",
        role: "ed",
        now: NOW + 15,
        movementId,
        provider: "Ambulance service",
        escortRequired: false,
        cadNumber: "CAD-TEST-001",
        transportLegalStatus: "voluntary",
        estimatedAt: NOW + 60,
      });

      const beforeNotices = state.notices.length;
      state = wardFlowReducer(state, {
        type: "WITHDRAW_REFERRAL",
        role: "ed",
        now: NOW + 20,
        movementId,
      });

      expect(state.rejections).toHaveLength(0);
      const mv = state.movements.find((m) => m.id === movementId)!;
      expect(mv.closure?.outcome).toBe("did_not_proceed");
      expect(mv.transport?.cancelledAt).toBe(NOW + 20);

      const addedNotices = state.notices.slice(beforeNotices);
      // Both officer and ward must be notified
      const officerNotice = addedNotices.find((n) => n.kind === "transport_cancelled_officer");
      const wardNotice = addedNotices.find((n) => n.kind === "referral_revoked_ward");

      expect(officerNotice).toBeDefined();
      expect(officerNotice?.to).toEqual({ role: "officer" });
      expect(officerNotice?.about.movementId).toBe(movementId);

      expect(wardNotice).toBeDefined();
      expect(wardNotice?.to).toEqual({ role: "ward", placeId: unitId });
      expect(wardNotice?.about.movementId).toBe(movementId);
    });

    it("pre-acceptance withdrawal by referrer sends notices to all referred wards (S1-4)", () => {
      let state = seedWardFlowState();
      const movementId = "WF-001";
      const unitIds = ["scgh-adult-open", "arm-adult-open"];

      state = wardFlowReducer(state, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW,
        movementId,
        unitIds,
      });

      const beforeNotices = state.notices.length;
      state = wardFlowReducer(state, {
        type: "WITHDRAW_REFERRAL",
        role: "ed",
        now: NOW + 10,
        movementId,
      });

      expect(state.rejections).toHaveLength(0);
      const mv = state.movements.find((m) => m.id === movementId)!;
      expect(mv.closure?.outcome).toBe("did_not_proceed");
      expect(mv.referredUnitIds).toHaveLength(0);
      expect(mv.withdrawnReferrals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ unitId: "scgh-adult-open", reason: "referrer_withdrew" }),
          expect.objectContaining({ unitId: "arm-adult-open", reason: "referrer_withdrew" }),
        ]),
      );

      const addedNotices = state.notices.slice(beforeNotices);
      expect(addedNotices).toHaveLength(2);
      expect(addedNotices.every((n) => n.kind === "ward_request_withdrawn")).toBe(true);
      expect(addedNotices.map((n) => n.to.placeId).sort()).toEqual(unitIds.sort());
    });

    it("RECORD_REFERRER_WITHDRAWAL cascade clears open movements, cancels transport, and dispatches notices (S2-4)", () => {
      const state = seedWardFlowState();
      // Receive a front-door referral addressed to SCGH ED
      const raised = wardFlowReducer(state, {
        type: "RECEIVE_REFERRAL",
        role: "ed",
        now: NOW,
        ageBand: "Adult",
        destinations: [
          {
            kind: "emergency_department",
            edId: "scgh-ed",
            purpose: "bed",
          },
        ],
        homeRegion: "Perth Metropolitan",
        suburb: { kind: "named", name: "Perth" },
        source: "ed_medical",
        urgency: 2,
        originSiteCode: "SCGH",
        transportNeeded: false,
        ...FIXTURE_HISTORY,
      });
      expect(raised.rejections).toHaveLength(0);
      const referralId = raised.referrals.at(-1)!.id;

      // Raise a linked movement
      const withMovement = wardFlowReducer(raised, {
        type: "RAISE_REFERRAL",
        role: "ed",
        now: NOW + 5,
        edId: "scgh-ed",
        patientId: raised.patients[0].id,
        referralId,
        draft: {
          cohort: "Adult",
          security: "Open",
          sex: "Female",
          gender: "Female",
          specialling: false,
          highAcuity: false,
          legalStatus: "Voluntary",
          urgency: 2,
          legalFormCode: null,
        },
      });
      expect(withMovement.rejections).toHaveLength(0);
      const linkedMvId = withMovement.movements.at(-1)!.id;

      // Refer to units
      const referredState = wardFlowReducer(withMovement, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW + 10,
        movementId: linkedMvId,
        unitIds: ["scgh-adult-open"],
      });

      // Book live transport on the linked movement (a copy of a seeded, uncollected booked job), so the
      // cascade's transport cancellation and officer notice are actually exercised.
      const seededJob = referredState.movements.find((m) => m.id === "WF-005")!.transport!;
      const withTransport = {
        ...referredState,
        movements: referredState.movements.map((m) =>
          m.id === linkedMvId
            ? {
                ...m,
                transport: {
                  ...seededJob,
                  id: "TR-S2-4",
                  enRouteAt: undefined,
                  collectedAt: undefined,
                  arrivedAt: undefined,
                  cancelledAt: undefined,
                },
              }
            : m,
        ),
      };
      const beforeNotices = withTransport.notices.length;
      const afterWithdrawal = wardFlowReducer(withTransport, {
        type: "RECORD_REFERRER_WITHDRAWAL",
        role: "ed",
        now: NOW + 20,
        referralId,
      });
      expect(afterWithdrawal.rejections).toHaveLength(0);

      const cascadedMv = afterWithdrawal.movements.find((m) => m.id === linkedMvId)!;
      expect(cascadedMv.closure?.outcome).toBe("did_not_proceed");
      expect(cascadedMv.referredUnitIds).toHaveLength(0);
      expect(cascadedMv.acceptedUnitId).toBeUndefined();
      expect(cascadedMv.withdrawnReferrals).toEqual(
        expect.arrayContaining([expect.objectContaining({ unitId: "scgh-adult-open", reason: "referrer_withdrew" })]),
      );

      expect(cascadedMv.transport?.cancelledAt).toBe(NOW + 20);
      const addedNotices = afterWithdrawal.notices.slice(beforeNotices);
      expect(
        addedNotices.filter((n) => n.kind === "transport_cancelled_officer" && n.to.role === "officer"),
      ).toHaveLength(1);
      expect(addedNotices.some((n) => n.kind === "ward_request_withdrawn" && n.to.placeId === "scgh-adult-open")).toBe(
        true,
      );
    });
  });

  describe("Fix A3-10 & S2-7: Stopped transport held beds surfaced in handover until RELEASE_HELD_BED", () => {
    it("surfaces stopped transport movements awaiting release in handover pulledBeds and placementGoneWrong", () => {
      let state = seedWardFlowState();
      // WF-005 is seeded at handover_ready with transport accepted
      const movementId = "WF-005";
      const acceptingUnitId = state.movements.find((m) => m.id === movementId)!.acceptedUnitId!;

      // En route -> collected -> stopped
      state = wardFlowReducer(state, {
        type: "TRANSPORT_EN_ROUTE",
        role: "officer",
        now: NOW + 5,
        movementId,
      });
      state = wardFlowReducer(state, {
        type: "PATIENT_COLLECTED",
        role: "officer",
        now: NOW + 10,
        movementId,
      });
      state = wardFlowReducer(state, {
        type: "STOP_TRANSPORT",
        role: "coordinator",
        now: NOW + 20,
        movementId,
        reason: "The examination was revoked",
        whereabouts: "Back at the sending emergency department",
      });

      if (state.rejections.length > 0) {
        console.error("STATE_REJECTIONS:", JSON.stringify(state.rejections, null, 2));
      }
      expect(state.rejections).toHaveLength(0);
      const stoppedMv = state.movements.find((m) => m.id === movementId)!;
      expect(stoppedMv.closure?.outcome).toBe("did_not_proceed");
      expect(stoppedMv.blocker).toBe(STAGE_TRANSITION_BLOCKERS.transportStoppedAwaitingRelease);

      // Verify handover derivation surfaces stopped movement awaiting release in placementGoneWrong
      const snapshot = handoverSnapshot(state.movements, state.units, NOW + 25);
      const inGoneWrong = snapshot.placementGoneWrong.find((p) => p.movement.id === movementId);
      expect(inGoneWrong).toBeDefined();
      expect(inGoneWrong?.kind).toBe("transport_stopped_awaiting_release");
      // With a pull deadline on the held bed, the stopped journey must surface in pulledBeds and still lapse.
      const withHold = state.movements.map((m) => (m.id === movementId ? { ...m, pullExpiresAt: NOW + 30 } : m));
      const heldEntry = handoverSnapshot(withHold, state.units, NOW + 60).pulledBeds.find(
        (p) => p.movement.id === movementId,
      );
      expect(heldEntry).toBeDefined();
      expect(heldEntry?.expired).toBe(true);
      expect(inGoneWrong?.movement.acceptedUnitId).toBe(acceptingUnitId);

      // Now release the held bed
      const unitBefore = state.units.find((u) => u.id === acceptingUnitId)!;
      state = wardFlowReducer(state, {
        type: "RELEASE_HELD_BED",
        role: "coordinator",
        now: NOW + 30,
        movementId,
      });
      expect(state.rejections).toHaveLength(0);

      const unitAfter = state.units.find((u) => u.id === acceptingUnitId)!;
      expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value + 1);

      // Verify snapshot no longer shows the movement
      const snapshotAfter = handoverSnapshot(state.movements, state.units, NOW + 35);
      expect(snapshotAfter.pulledBeds.find((p) => p.movement.id === movementId)).toBeUndefined();
      expect(snapshotAfter.placementGoneWrong.find((p) => p.movement.id === movementId)).toBeUndefined();
    });
  });

  describe("Fix A3-2: In-vehicle handover expiry false alarm immunity", () => {
    it("does not flag in-transit patients as expired in handover snapshot", () => {
      const state = seedWardFlowState();
      const inTransitMovement = {
        ...state.movements[0],
        id: "WF-INTRANSIT" as const,
        stage: "moving" as const,
        acceptedUnitId: "scgh-adult-open",
        pullExpiresAt: NOW - 60, // expired 60 minutes ago
        transport: {
          id: "TJ-INTRANSIT",
          requestedAt: NOW - 120,
          provider: "Ambulance service" as const,
          escortRequired: false,
          cadNumber: "CAD-999",
          transportLegalStatus: "voluntary" as const,
          acceptedAt: NOW - 90,
          enRouteAt: NOW - 80,
          collectedAt: NOW - 30,
        },
      };

      const stationaryPulledMovement = {
        ...state.movements[1],
        id: "WF-STATIONARY" as const,
        stage: "pulled" as const,
        acceptedUnitId: "scgh-adult-open",
        pullExpiresAt: NOW - 60, // expired 60 minutes ago
        transport: undefined,
      };

      const snapshot = handoverSnapshot([inTransitMovement, stationaryPulledMovement], state.units, NOW);

      const inTransitEntry = snapshot.pulledBeds.find((p) => p.movement.id === "WF-INTRANSIT")!;
      expect(inTransitEntry).toBeDefined();
      expect(inTransitEntry.expired).toBe(false);

      const stationaryEntry = snapshot.pulledBeds.find((p) => p.movement.id === "WF-STATIONARY")!;
      expect(stationaryEntry).toBeDefined();
      expect(stationaryEntry.expired).toBe(true);
    });
  });

  describe("Fix A1-4: Statutory continuation legal forms in audit trail", () => {
    it("retains Form 5B in audit trail subject during RECORD_LEGAL_FORM_CONTINUATION", () => {
      expect(CONTINUATION_LEGAL_FORMS.some((f) => f.code === "5B")).toBe(true);

      const state = seedWardFlowState();
      const movementId = state.movements[0].id;
      // Set Form 5A on the movement so 5B can continue it
      const with5A: WardFlowState = {
        ...state,
        movements: state.movements.map((m) =>
          m.id === movementId
            ? { ...m, legalForm: { code: "5A" as const, formedAt: NOW - 100 }, closure: undefined }
            : m,
        ),
      };

      const auditedState = wardFlowReducer(with5A, {
        type: "RECORD_LEGAL_FORM_CONTINUATION",
        role: "ward",
        now: NOW,
        movementId,
        formCode: "5B",
        startedAt: NOW,
        paperExpiresAt: NOW + 1000,
      });

      expect(auditedState.rejections).toHaveLength(0);
      const auditEvent = auditedState.auditEvents.find((a) => a.action === "RECORD_LEGAL_FORM_CONTINUATION");
      expect(auditEvent).toBeDefined();
      if (auditEvent && auditEvent.action === "RECORD_LEGAL_FORM_CONTINUATION") {
        expect(auditEvent.details.formCode).toBe("5B");
      }
    });
  });

  describe("Fix A1-6: Walk-in patient identity in movement audit trail", () => {
    it("falls back to movement.patientId when movement.referralId is undefined", () => {
      let state = seedWardFlowState();
      // Add a patient
      state = wardFlowReducer(state, {
        type: "ADD_PATIENT",
        role: "coordinator",
        now: NOW,
        umrn: "SYN-WALKIN-AUDIT",
        givenName: "Walkin",
        familyName: "Patient",
        dateOfBirth: "1992-05-15",
      });
      const patient = state.patients.at(-1)!;

      // Raise referral as ED walk-in (no referralId)
      state = wardFlowReducer(state, {
        type: "RAISE_REFERRAL",
        role: "ed",
        now: NOW + 5,
        edId: "scgh-ed",
        patientId: patient.id,
        draft: {
          cohort: "Adult",
          security: "Open",
          sex: "Male",
          gender: "Male",
          specialling: false,
          highAcuity: false,
          legalStatus: "Voluntary",
          urgency: 2,
          legalFormCode: null,
        },
      });
      const walkinMv = state.movements.at(-1)!;
      expect(walkinMv.patientId).toBe(patient.id);
      expect(walkinMv.referralId).toBeUndefined();

      // Test auditSubject directly for a movement-scoped event
      const subject = auditSubject(state, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW + 10,
        movementId: walkinMv.id,
        unitIds: ["scgh-adult-open"],
      });

      expect(subject.kind).toBe("movement");
      if (subject.kind === "movement") {
        expect(subject.movementId).toBe(walkinMv.id);
        expect(subject.patientId).toBe(patient.id);
      }

      // Dispatch an auditable event through the reducer and check state.auditEvents
      const beforeAudits = state.auditEvents.length;
      state = wardFlowReducer(state, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW + 10,
        movementId: walkinMv.id,
        unitIds: ["scgh-adult-open"],
      });

      const audit = state.auditEvents.slice(beforeAudits).at(-1);
      expect(audit).toBeDefined();
      expect(audit?.subject.kind).toBe("movement");
      if (audit && audit.subject.kind === "movement") {
        expect(audit.subject.movementId).toBe(walkinMv.id);
        expect(audit.subject.patientId).toBe(patient.id);
      }
    });
  });

  describe("Fix A4-11: Logger context cannot overwrite canonical severity or message", () => {
    it("retains canonical level and message when context contains conflicting keys", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalLogLevel = process.env.LOG_LEVEL;
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "development";
        delete process.env.LOG_LEVEL;

        logger.error("Canonical error occurred", {
          level: "debug",
          message: "Malicious override message",
          timestamp: "1970-01-01T00:00:00.000Z",
          correlationId: "CORR-12345",
        });

        expect(errorSpy).toHaveBeenCalled();
        const loggedString = errorSpy.mock.calls[0][0];
        const parsed = JSON.parse(loggedString);

        expect(parsed.level).toBe("error");
        expect(parsed.message).toBe("Canonical error occurred");
        expect(parsed.correlationId).toBe("CORR-12345");
        expect(parsed.timestamp).not.toBe("1970-01-01T00:00:00.000Z");
      } finally {
        errorSpy.mockRestore();
        (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
        if (originalLogLevel !== undefined) {
          process.env.LOG_LEVEL = originalLogLevel;
        } else {
          delete process.env.LOG_LEVEL;
        }
      }
    });
  });
});

describe("handover pullHasLapsed for stopped journeys", () => {
  it("still lapses a held bed once the collected journey has been stopped, but not while in transit", async () => {
    const { pullHasLapsed } = await import("@/components/ward-management/handover/handover-model");
    type Row = Parameters<typeof pullHasLapsed>[0];
    const base = { stage: "moving", pullExpiresAt: 100, urgent: false, asked: [], declines: [] };
    const inTransit = { ...base, movement: { transport: { collectedAt: 50 } } } as unknown as Row;
    const stopped = {
      ...base,
      movement: { transport: { collectedAt: 50, cancelledAt: 60 }, closure: { outcome: "did_not_proceed" } },
    } as unknown as Row;
    expect(pullHasLapsed(inTransit, 200)).toBe(false);
    expect(pullHasLapsed(stopped, 200)).toBe(true);
  });
});

describe("S2-7: RELEASE_AND_REOPEN_SEARCH from accepted_awaiting_bed (owner ruling 2026-10-13 22:13 AWST)", () => {
  it("records an acceptance unwind, not a bed release, and tells the accepting ward", () => {
    let state = seedWardFlowState();
    let movement = state.movements.find((m) => m.stage === "accepted_awaiting_bed" && !m.closure && !m.transport);
    if (!movement) {
      // No seeded movement waits at this stage, so place an accepted one there without a held bed.
      const source = state.movements.find((m) => !m.closure && m.acceptedUnitId && !m.transport)!;
      movement = { ...source, stage: "accepted_awaiting_bed", admissionId: undefined, pullExpiresAt: undefined };
      state = { ...state, movements: state.movements.map((m) => (m.id === source.id ? movement! : m)) };
    }
    const acceptedUnitId = movement.acceptedUnitId!;
    const before = state.notices.length;
    const after = wardFlowReducer(state, {
      type: "RELEASE_AND_REOPEN_SEARCH",
      role: "coordinator",
      now: NOW + 5,
      movementId: movement.id,
      actingUnitId: acceptedUnitId,
      reason: "patient_no_longer_coming",
    });
    expect(after.rejections).toHaveLength(0);
    const reopened = after.movements.find((m) => m.id === movement!.id)!;
    expect(reopened.stage).toBe("placement_requested");
    expect(reopened.unwinds.at(-1)).toMatchObject({ kind: "acceptance_withdrawn", unitId: acceptedUnitId });
    const audit = changeAudit(after.movements).find(
      (entry) => entry.movementId === movement!.id && entry.kind === "acceptance_withdrawn",
    );
    expect(audit?.detail).toBe(`Acceptance withdrawn · ${changeReasonLabels.patient_no_longer_coming}`);
    const added = after.notices.slice(before);
    expect(added.some((n) => n.kind === "bed_pull_released")).toBe(false);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      kind: "acceptance_withdrawn_ward",
      to: { role: "ward", placeId: acceptedUnitId },
      about: { movementId: movement.id, unitId: acceptedUnitId },
    });
  });

  it("treats a movement stepped back from pulled (bed still reserved) as a bed release", () => {
    const state = seedWardFlowState();
    const source = state.movements.find((m) => m.stage === "pulled" && !m.closure && m.admissionId && !m.transport);
    expect(source).toBeDefined();
    const steppedBack = { ...source!, stage: "accepted_awaiting_bed" as const };
    const seeded = { ...state, movements: state.movements.map((m) => (m.id === source!.id ? steppedBack : m)) };
    const before = seeded.notices.length;
    const after = wardFlowReducer(seeded, {
      type: "RELEASE_AND_REOPEN_SEARCH",
      role: "coordinator",
      now: NOW + 5,
      movementId: steppedBack.id,
      actingUnitId: steppedBack.acceptedUnitId!,
      reason: "patient_no_longer_coming",
    });
    expect(after.rejections).toHaveLength(0);
    const reopened = after.movements.find((m) => m.id === steppedBack.id)!;
    expect(reopened.unwinds.at(-1)?.kind).toBe("pull_released");
    expect(after.admissions.some((a) => a.id === steppedBack.admissionId)).toBe(false);
    expect(after.notices.slice(before).map((n) => n.kind)).toEqual(["bed_pull_released"]);
  });
});
