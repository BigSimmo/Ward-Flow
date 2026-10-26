import { admissionCriteriaEligibility } from "@/components/ward-management/ward-discharge-records";
import { OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { remainingSpeciallingCapacity } from "@/components/ward-management/ward-admissions";
import { isConstantObservation } from "@/components/ward-management/ward-observation";
import { TRANSPORT_PROVIDERS } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { ReferralIntakeDetails } from "@/components/ward-management/referrals/referral-submission";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";

/**
 * One ACCEPTED dispatch of every Ward Flow event that can carry human-typed text, with a distinctive
 * marker string in every typed field.
 *
 * The list is the 13 types on `WARD_FLOW_TYPED_TEXT_EVENT_TYPES`, plus the payload-level cases
 * `eventCarriesTypedTextPayload` catches on otherwise text-safe types: `overrideSignOff` on the three
 * placement events, a non-blank `reassessmentNote` on `ACCEPT_REFERRAL`, and a patient specific
 * (off-list) criterion on `SET_DISCHARGE_CRITERIA` (all in `ward-flow-persistence-classification.ts`).
 *
 * A privacy test dispatches `event` on `before`, then searches whatever it is guarding (storage,
 * logs, an export, a URL) for each of `markers`: finding one means typed text leaked. Fields checked
 * against a fixed list (a site code, a community team, a role) are not typed and are left valid and
 * unlisted, with a comment saying so. All values are synthetic.
 */
export type TypedTextFixture = {
  /** A short label, e.g. "ADD_PATIENT" or "PULL_PATIENT with overrideSignOff". */
  label: string;
  /** The event type this fixture dispatches last. */
  type: WardFlowEvent["type"];
  /**
   * Builds the state just before the typed-text event (may dispatch prerequisite events on the
   * seed, which must themselves be accepted) and the typed-text event itself. `now` is the state's
   * clock.
   */
  build: (seed: WardFlowState) => { before: WardFlowState; event: WardFlowEvent };
  /**
   * Every human-typed string this event carries, exactly as put in the payload. Each must be
   * distinctive enough that finding it in JSON means it leaked, except where a field's own
   * validation forces a short or patterned value; those say so in a comment.
   */
  markers: readonly string[];
};

/** The state's own clock, as the provider computes it (`NOW_ANCHOR` plus any advance). */
export function typedTextFixtureClock(state: WardFlowState): number {
  return NOW_ANCHOR + state.clockOffsetMinutes;
}

/**
 * The first candidate the reducer accepts on `state` and that leaves `marker` in the next state, so
 * the typed text is really written rather than accepted and dropped; throws when the seed offers
 * none.
 */
function firstAccepted(
  state: WardFlowState,
  candidates: readonly WardFlowEvent[],
  label: string,
  marker: string,
): WardFlowEvent {
  let lastReason = "no candidates";
  for (const event of candidates) {
    const next = wardFlowReducer(state, event);
    if (next.rejections.length !== state.rejections.length) {
      lastReason = next.rejections.at(-1)?.reason ?? lastReason;
    } else if (JSON.stringify(next).includes(marker)) {
      return event;
    } else {
      lastReason = "accepted, but the typed text was not stored";
    }
  }
  throw new Error(`${label}: no seeded subject accepts it (last refusal: ${lastReason})`);
}

/** The state after the first candidate the reducer accepts, or null when it refuses them all. */
function applyFirstAccepted(state: WardFlowState, candidates: readonly WardFlowEvent[]): WardFlowState | null {
  for (const event of candidates) {
    const next = wardFlowReducer(state, event);
    if (next.rejections.length === state.rejections.length) return next;
  }
  return null;
}

const openMovements = (state: WardFlowState) => state.movements.filter((movement) => !movement.closure);

const M = {
  addPatientUmrn: "UMRN-marker-4b7e19",
  addPatientGivenName: "Givenname-marker-0c3d",
  addPatientFamilyName: "Familyname-marker-9a51",
  // The stored-state validator requires YYYY-MM-DD, so this is an unusual real date rather than a
  // long marker. The reducer itself stores it verbatim.
  addPatientDateOfBirth: "1903-09-17",
  addPatientSuburb: "Suburb-marker-6e2f",
  referralHistory: "Typed-history-marker-7c1e",
  referralSendingTeam: "Sending-team-marker-2d84",
  intakeCatchmentTeam: "Catchment-team-marker-5a90",
  intakeReason: "Referral-reason-marker-e3b6",
  // Free text up to 100 characters; not checked against `LEGAL_STATUSES`.
  intakeLegalStatus: "Intake-legal-status-marker-1f7a",
  // Must parse with `Date.parse`, so a patterned value; the minute 37 and offset +08:00 are unusual.
  intakeClearanceExpectedAt: "2026-10-23T05:37+08:00",
  intakeClearanceContactName: "Clearance-contact-marker-8b2c",
  // Only checked to be non-blank and at most 40 characters, so it can be a marker.
  intakeClearanceContactPhone: "Clearance-phone-marker-44d0",
  intakeMedicationChartName: "Medication-chart-name-marker-a1c5.pdf",
  intakeObservationChartName: "Observation-chart-name-marker-77e3.pdf",
  // The base64 of "Medication-chart-content-marker-3f9b" (36 bytes): uploaded file content, not
  // typed, but patient material all the same. Its length must match `sizeBytes`.
  intakeMedicationChartBase64: "TWVkaWNhdGlvbi1jaGFydC1jb250ZW50LW1hcmtlci0zZjli",
  // The base64 of "Observation-chart-content-marker-81d4" (37 bytes).
  intakeObservationChartBase64: "T2JzZXJ2YXRpb24tY2hhcnQtY29udGVudC1tYXJrZXItODFkNA==",
  intakeReferrerName: "Referrer-name-marker-3e6b",
  // Pattern-checked as an email address.
  intakeReferrerEmail: "referrer-email-marker-90fa@example.invalid",
  // Pattern-checked: digits, spaces and + ( ) . - only, at least eight digits.
  intakeReferrerPhone: "+61 8 9417 3926",
  intakeReferrerRole: "Referrer-role-marker-c58d",
  intakeReferrerLocation: "Referrer-location-marker-0b19",
  intakeArrivalTransport: "Arrival-transport-marker-6d3a",
  intakeArrivalReference: "Arrival-reference-marker-f2e7",
  // Must parse with `Date.parse`; an unusual minute.
  intakeArrivalEstimatedAt: "2026-10-23T06:43+08:00",
  // Pattern-checked as HH:MM, so it is short.
  intakeNeedsExpectedArrival: "04:53",
  movementBlocker: "Blocker-marker-1a9c",
  communityReferralReason: "Community-reason-marker-5f0e",
  escalationContact: "Escalation-contact-marker-b7d2",
  referralCorrection: "Correction-note-marker-e81f",
  transportCadNumber: "CAD-marker-3c5a",
  repatriationCadNumber: "REPAT-CAD-MARK-9e04",
  arrivalTrackingNumber: "Tracking-marker-2b6d",
  uploadFormName: "Form-name-marker-71c8",
  alertTitle: "Alert-title-marker-58be",
  alertMessage: "Alert-message-marker-0e3f",
  alertTargetScopeLabel: "Alert-scope-label-marker-a62c",
  alertDispatchedByName: "Alert-dispatcher-marker-4d17",
  // One to three letters, already in the stored (upper case, no dots or spaces) form.
  plannedAdmissionInitials: "QZX",
  supportWho: "Support-who-marker-6c2e",
  supportReason: "Support-reason-marker-b93a",
  // At most 60 characters (`OVERRIDE_SIGN_OFF_NAME_MAX`).
  signOffReferToUnits: "Signoff-refer-marker-1d5b",
  signOffAcceptInPrinciple: "Signoff-accept-marker-8f2a",
  signOffPull: "Signoff-pull-marker-c07e",
  reassessmentNote: "Reassessment-note-marker-4a8d",
  patientSpecificCriterion: "Criterion-marker-7e3b",
} as const;

const intake: ReferralIntakeDetails = {
  // `service` is checked against `HEALTH_SERVICES`, not typed.
  catchment: { teamName: M.intakeCatchmentTeam, service: "East Metro", confirmed: true },
  reasonForReferral: M.intakeReason,
  legalStatus: M.intakeLegalStatus,
  riskFlags: ["absconding"],
  medicalClearance: {
    cleared: false,
    expectedAt: M.intakeClearanceExpectedAt,
    contactName: M.intakeClearanceContactName,
    contactPhone: M.intakeClearanceContactPhone,
  },
  triageAndRampCompleted: false,
  additionalDocuments: false,
  charts: [
    {
      kind: "medication",
      name: M.intakeMedicationChartName,
      mimeType: "application/pdf",
      sizeBytes: 36,
      base64: M.intakeMedicationChartBase64,
    },
    {
      kind: "observation",
      name: M.intakeObservationChartName,
      mimeType: "application/pdf",
      sizeBytes: 37,
      base64: M.intakeObservationChartBase64,
    },
  ],
  referrer: {
    name: M.intakeReferrerName,
    email: M.intakeReferrerEmail,
    phone: M.intakeReferrerPhone,
    role: M.intakeReferrerRole,
    location: M.intakeReferrerLocation,
  },
  arrival: {
    transport: M.intakeArrivalTransport,
    reference: M.intakeArrivalReference,
    estimatedAt: M.intakeArrivalEstimatedAt,
  },
  // Every other `needs` field and the clearance checklist are fixed lists or booleans.
  clearanceChecklist: { bloods: "to_follow" },
  needs: { kind: "ed", comingBy: "Ambulance", medicalReviewFirst: true, expectedArrival: M.intakeNeedsExpectedArrival },
};

/** Builds a fixture with no prerequisite events. */
function onSeed(make: (seed: WardFlowState, now: number) => WardFlowEvent) {
  return (seed: WardFlowState) => ({ before: seed, event: make(seed, typedTextFixtureClock(seed)) });
}

export const TYPED_TEXT_FIXTURES: readonly TypedTextFixture[] = [
  {
    label: "ADD_PATIENT",
    type: "ADD_PATIENT",
    // `gender` is checked against `GENDERS`, not typed.
    build: onSeed((_seed, now) => ({
      type: "ADD_PATIENT",
      role: "coordinator",
      now,
      umrn: M.addPatientUmrn,
      givenName: M.addPatientGivenName,
      familyName: M.addPatientFamilyName,
      dateOfBirth: M.addPatientDateOfBirth,
      gender: "Female",
      suburb: M.addPatientSuburb,
    })),
    markers: [
      M.addPatientUmrn,
      M.addPatientGivenName,
      M.addPatientFamilyName,
      M.addPatientDateOfBirth,
      M.addPatientSuburb,
    ],
  },
  {
    label: "RECEIVE_REFERRAL with a full intake",
    type: "RECEIVE_REFERRAL",
    // `suburb` must name a suburb the catchment source knows and `originSiteCode` a real site, so
    // neither is typed text here.
    build: onSeed((_seed, now) => ({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now,
      ageBand: "Adult",
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Perth" },
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      history: M.referralHistory,
      sendingTeamName: M.referralSendingTeam,
      intake,
      destinations: [
        {
          kind: "psychiatric_ward",
          unitId: "scgh-adult-open",
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
    })),
    markers: [
      M.referralHistory,
      M.referralSendingTeam,
      M.intakeCatchmentTeam,
      M.intakeReason,
      M.intakeLegalStatus,
      M.intakeClearanceExpectedAt,
      M.intakeClearanceContactName,
      M.intakeClearanceContactPhone,
      M.intakeMedicationChartName,
      M.intakeObservationChartName,
      M.intakeMedicationChartBase64,
      M.intakeObservationChartBase64,
      M.intakeReferrerName,
      M.intakeReferrerEmail,
      M.intakeReferrerPhone,
      M.intakeReferrerRole,
      M.intakeReferrerLocation,
      M.intakeArrivalTransport,
      M.intakeArrivalReference,
      M.intakeArrivalEstimatedAt,
      M.intakeNeedsExpectedArrival,
    ],
  },
  {
    label: "RECORD_MOVEMENT_BLOCKER",
    type: "RECORD_MOVEMENT_BLOCKER",
    build: onSeed((seed, now) =>
      firstAccepted(
        seed,
        openMovements(seed).map((movement) => ({
          type: "RECORD_MOVEMENT_BLOCKER",
          role: "coordinator",
          now,
          movementId: movement.id,
          blocker: M.movementBlocker,
        })),
        "RECORD_MOVEMENT_BLOCKER",
        M.movementBlocker,
      ),
    ),
    markers: [M.movementBlocker],
  },
  {
    label: "REFER_TO_COMMUNITY_TEAM",
    type: "REFER_TO_COMMUNITY_TEAM",
    // `team` must be one of `communityTeamOptions()`, so it is chosen, not typed.
    build: onSeed((seed, now) =>
      firstAccepted(
        seed,
        openMovements(seed).map((movement) => ({
          type: "REFER_TO_COMMUNITY_TEAM",
          role: "coordinator",
          now,
          movementId: movement.id,
          team: communityTeamOptions()[0]!,
          reason: M.communityReferralReason,
        })),
        "REFER_TO_COMMUNITY_TEAM",
        M.communityReferralReason,
      ),
    ),
    markers: [M.communityReferralReason],
  },
  {
    label: "RECORD_ESCALATION",
    type: "RECORD_ESCALATION",
    build: onSeed((seed, now) =>
      firstAccepted(
        seed,
        openMovements(seed).map((movement) => ({
          type: "RECORD_ESCALATION",
          role: "coordinator",
          now,
          movementId: movement.id,
          triedUnitIds: movement.referredUnitIds.length > 0 ? [...movement.referredUnitIds] : [seed.units[0]!.id],
          contact: M.escalationContact,
        })),
        "RECORD_ESCALATION",
        M.escalationContact,
      ),
    ),
    markers: [M.escalationContact],
  },
  {
    label: "ADD_REFERRAL_CORRECTION",
    type: "ADD_REFERRAL_CORRECTION",
    build: onSeed((seed, now) =>
      firstAccepted(
        seed,
        seed.referrals.map((referral) => ({
          type: "ADD_REFERRAL_CORRECTION",
          role: "coordinator",
          now,
          referralId: referral.id,
          note: M.referralCorrection,
        })),
        "ADD_REFERRAL_CORRECTION",
        M.referralCorrection,
      ),
    ),
    markers: [M.referralCorrection],
  },
  {
    label: "BOOK_TRANSPORT",
    type: "BOOK_TRANSPORT",
    build: onSeed((seed, now) =>
      firstAccepted(
        seed,
        openMovements(seed)
          .filter((movement) => movement.stage === "pulled" && !movement.transport)
          .map((movement) => ({
            type: "BOOK_TRANSPORT",
            role: "coordinator",
            now,
            movementId: movement.id,
            provider: TRANSPORT_PROVIDERS[0],
            escortRequired: true,
            cadNumber: M.transportCadNumber,
            transportLegalStatus: "voluntary",
            estimatedAt: now + 30,
          })),
        "BOOK_TRANSPORT",
        M.transportCadNumber,
      ),
    ),
    markers: [M.transportCadNumber],
  },
  {
    label: "RECORD_REPATRIATION",
    type: "RECORD_REPATRIATION",
    // `homeHospital` must be a real site code, so it is chosen, not typed.
    build: onSeed((seed, now) =>
      firstAccepted(
        seed,
        seed.admissions
          .filter((admission) => admission.state === "occupied")
          .map((admission) => ({
            type: "RECORD_REPATRIATION",
            role: "coordinator",
            now,
            admissionId: admission.id,
            homeHospital: "SCGH",
            receivingWardAgreed: false,
            mode: "road",
            provider: TRANSPORT_PROVIDERS[0],
            cadNumber: M.repatriationCadNumber,
            transportLegalStatus: "voluntary",
            estimatedAt: now + 120,
          })),
        "RECORD_REPATRIATION",
        M.repatriationCadNumber,
      ),
    ),
    markers: [M.repatriationCadNumber],
  },
  {
    label: "SET_ARRIVAL_DETAILS",
    type: "SET_ARRIVAL_DETAILS",
    build: onSeed((seed, now) =>
      firstAccepted(
        seed,
        openMovements(seed)
          .filter((movement) => movement.acceptedUnitId !== undefined)
          .map((movement) => ({
            type: "SET_ARRIVAL_DETAILS",
            role: "coordinator",
            now,
            movementId: movement.id,
            arrivalMode: "ambulance",
            trackingNumber: M.arrivalTrackingNumber,
            estimatedArrivalAt: now + 60,
          })),
        "SET_ARRIVAL_DETAILS",
        M.arrivalTrackingNumber,
      ),
    ),
    markers: [M.arrivalTrackingNumber],
  },
  {
    label: "UPLOAD_PATIENT_FORM",
    type: "UPLOAD_PATIENT_FORM",
    build: onSeed((seed, now) =>
      firstAccepted(
        seed,
        openMovements(seed).map((movement) => ({
          type: "UPLOAD_PATIENT_FORM",
          role: "coordinator",
          now,
          movementId: movement.id,
          formName: M.uploadFormName,
          fileType: "PDF",
          sizeBytes: 2048,
        })),
        "UPLOAD_PATIENT_FORM",
        M.uploadFormName,
      ),
    ),
    markers: [M.uploadFormName],
  },
  {
    label: "DISPATCH_BROADCAST_ALERT",
    type: "DISPATCH_BROADCAST_ALERT",
    build: onSeed((_seed, now) => ({
      type: "DISPATCH_BROADCAST_ALERT",
      role: "coordinator",
      now,
      title: M.alertTitle,
      message: M.alertMessage,
      severity: "critical",
      category: "capacity_gridlock",
      targetScope: "all",
      targetScopeLabel: M.alertTargetScopeLabel,
      durationMinutes: 240,
      dispatchedByName: M.alertDispatchedByName,
    })),
    markers: [M.alertTitle, M.alertMessage, M.alertTargetScopeLabel, M.alertDispatchedByName],
  },
  {
    label: "BOOK_PLANNED_ADMISSION with initials",
    type: "BOOK_PLANNED_ADMISSION",
    build: onSeed((_seed, now) => ({
      type: "BOOK_PLANNED_ADMISSION",
      role: "coordinator",
      now,
      initials: M.plannedAdmissionInitials,
      sex: "Female",
      gender: "Female",
      reason: "respite",
      unitId: "fre-adult-open",
      expectedArrivalAt: now + 24 * 60,
      expectedStayDays: 7,
      legalStatus: "Voluntary",
      ageBand: "Adult",
    })),
    markers: [M.plannedAdmissionInitials],
  },
  {
    label: "RECORD_SUPPORT_NOTIFICATION told (who)",
    type: "RECORD_SUPPORT_NOTIFICATION",
    // `who` and `reason` are mutually exclusive (told versus not applicable), so each has a fixture.
    build: onSeed((_seed, now) => ({
      type: "RECORD_SUPPORT_NOTIFICATION",
      role: "coordinator",
      now,
      occasion: "discharge",
      admissionId: "AD-LEFT-01",
      party: "carer",
      outcome: "told",
      who: M.supportWho,
      contactedAt: now - 15,
    })),
    markers: [M.supportWho],
  },
  {
    label: "RECORD_SUPPORT_NOTIFICATION not applicable (reason)",
    type: "RECORD_SUPPORT_NOTIFICATION",
    build: onSeed((_seed, now) => ({
      type: "RECORD_SUPPORT_NOTIFICATION",
      role: "coordinator",
      now,
      occasion: "discharge",
      admissionId: "AD-LEFT-01",
      party: "mhas",
      outcome: "not_applicable",
      reason: M.supportReason,
    })),
    markers: [M.supportReason],
  },
  {
    label: "REFER_TO_UNITS with overrideSignOff",
    type: "REFER_TO_UNITS",
    // The sign-off's `role` is checked against the role list; only `name` is typed.
    build: onSeed((seed, now) =>
      firstAccepted(
        seed,
        openMovements(seed)
          .filter((movement) => movement.stage === "placement_requested" || movement.stage === "destination_review")
          .flatMap((movement) =>
            seed.units.map((unit): WardFlowEvent => ({
              type: "REFER_TO_UNITS",
              role: "coordinator",
              now,
              movementId: movement.id,
              unitIds: [unit.id],
              overrideReason: OVERRIDE_REASONS[0],
              overrideSignOff: { role: "coordinator", name: M.signOffReferToUnits },
            })),
          ),
        "REFER_TO_UNITS with overrideSignOff",
        M.signOffReferToUnits,
      ),
    ),
    markers: [M.signOffReferToUnits],
  },
  {
    label: "ACCEPT_IN_PRINCIPLE with overrideSignOff",
    type: "ACCEPT_IN_PRINCIPLE",
    build: onSeed((seed, now) =>
      firstAccepted(
        seed,
        openMovements(seed).flatMap((movement) =>
          movement.referredUnitIds.map((unitId): WardFlowEvent => ({
            type: "ACCEPT_IN_PRINCIPLE",
            role: "coordinator",
            now,
            movementId: movement.id,
            unitId,
            overrideReason: OVERRIDE_REASONS[0],
            overrideSignOff: { role: "coordinator", name: M.signOffAcceptInPrinciple },
          })),
        ),
        "ACCEPT_IN_PRINCIPLE with overrideSignOff",
        M.signOffAcceptInPrinciple,
      ),
    ),
    markers: [M.signOffAcceptInPrinciple],
  },
  {
    label: "PULL_PATIENT with overrideSignOff",
    type: "PULL_PATIENT",
    // PULL_PATIENT keeps an override, and so its sign-off, only for a gate that actually failed: a
    // reason and sign-off on a pull that needed none is accepted and then dropped. So this places a
    // patient on constant observation at a ward with no observation staff left, through
    // an accepted offer and acceptance in principle, and the pull then records the override.
    build: (seed) => {
      const now = typedTextFixtureClock(seed);
      const pull = (movementId: string, unitId: string): WardFlowEvent => ({
        type: "PULL_PATIENT",
        role: "coordinator",
        now,
        movementId,
        unitId,
        overrideReason: OVERRIDE_REASONS[0],
        overrideSignOff: { role: "coordinator", name: M.signOffPull },
      });
      const movements = openMovements(seed).filter(
        (movement) =>
          isConstantObservation(movement.observation) &&
          (movement.stage === "placement_requested" || movement.stage === "destination_review"),
      );
      const units = seed.units.filter((unit) => remainingSpeciallingCapacity(unit, seed.admissions) <= 0);
      for (const movement of movements) {
        for (const unit of units) {
          const referred = applyFirstAccepted(seed, [
            { type: "REFER_TO_UNITS", role: "coordinator", now, movementId: movement.id, unitIds: [unit.id] },
            {
              type: "REFER_TO_UNITS",
              role: "coordinator",
              now,
              movementId: movement.id,
              unitIds: [unit.id],
              overrideReason: OVERRIDE_REASONS[0],
            },
          ]);
          if (!referred) continue;
          const accepted = applyFirstAccepted(referred, [
            { type: "ACCEPT_IN_PRINCIPLE", role: "coordinator", now, movementId: movement.id, unitId: unit.id },
            {
              type: "ACCEPT_IN_PRINCIPLE",
              role: "coordinator",
              now,
              movementId: movement.id,
              unitId: unit.id,
              overrideReason: OVERRIDE_REASONS[0],
            },
          ]);
          if (!accepted) continue;
          const event = pull(movement.id, unit.id);
          const next = wardFlowReducer(accepted, event);
          if (next.rejections.length === accepted.rejections.length && JSON.stringify(next).includes(M.signOffPull)) {
            return { before: accepted, event };
          }
        }
      }
      throw new Error(
        "PULL_PATIENT with overrideSignOff: no seeded constant-observation patient and full ward accepts it",
      );
    },
    markers: [M.signOffPull],
  },
  {
    label: "ACCEPT_REFERRAL with reassessmentNote",
    type: "ACCEPT_REFERRAL",
    build: onSeed((seed, now) =>
      firstAccepted(
        seed,
        seed.referrals.flatMap((referral) =>
          referral.destinations
            .filter((addressing) => addressing.state === "queued")
            .map((addressing): WardFlowEvent => ({
              type: "ACCEPT_REFERRAL",
              role: "coordinator",
              now,
              referralId: referral.id,
              destinationKind: addressing.destination.kind,
              ...(addressing.destination.kind === "psychiatric_ward" && addressing.destination.unitId
                ? { unitId: addressing.destination.unitId }
                : {}),
              reassessmentNote: M.reassessmentNote,
            })),
        ),
        "ACCEPT_REFERRAL with reassessmentNote",
        M.reassessmentNote,
      ),
    ),
    markers: [M.reassessmentNote],
  },
  {
    label: "SET_DISCHARGE_CRITERIA with a patient specific criterion",
    type: "SET_DISCHARGE_CRITERIA",
    // `criteria` here are from the fixed list; only the patient specific entry is typed.
    build: (seed) => {
      const now = typedTextFixtureClock(seed);
      const occupied = seed.admissions.filter((admission) => admission.state === "occupied");
      const voluntary = occupied.find((admission) => admissionCriteriaEligibility(seed, admission) === "voluntary");
      const admission = voluntary ?? occupied[0]!;
      // Criteria led discharge is for voluntary patients only: record the patient as voluntary when
      // the seed has no voluntary stay (a state edit, not a dispatch).
      const before: WardFlowState = voluntary
        ? seed
        : {
            ...seed,
            patients: seed.patients.map((patient) =>
              patient.id === admission.patientId ? { ...patient, legalStatus: "Voluntary" } : patient,
            ),
          };
      return {
        before,
        event: {
          type: "SET_DISCHARGE_CRITERIA",
          role: "coordinator",
          now,
          admissionId: admission.id,
          criteria: ["Accommodation confirmed"],
          met: [],
          setByTreatingPsychiatrist: true,
          patientSpecific: [M.patientSpecificCriterion],
        },
      };
    },
    markers: [M.patientSpecificCriterion],
  },
];
