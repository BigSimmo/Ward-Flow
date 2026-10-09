/**
 * Additive Wave 3 rulings examples for the Ward Flow demo.
 *
 * `seedWardFlowState` merges this overlay additively via `applyRulingsDemoOverlay`. Existing
 * fixture rows are kept; overlay rows whose ids already exist in that night are skipped.
 *
 * Ids are `RD-01` onward in `exampleIds`. Record ids follow each type's prefix (`WF-`, `RF-`,
 * `AD-`, `PT-`, `WL-`) so they type-check. `writtenAt` does not exist on Movement or LegalForm —
 * written times use `formedAt`; no expiry is inferred. Movement has no `originUnitId`; the
 * ward-to-ward example is a Referral, which is where that field lives.
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Admission } from "@/components/ward-management/ward-admissions";
import {
  ARRIVAL_LATE_AFTER_MINUTES,
  EXPECT_FLAG_INVOLUNTARY_MINUTES,
  EXPECT_FLAG_VOLUNTARY_MINUTES,
  LEAVE_BED_OPEN_WARNING_MINUTES,
  type LegalClockFormCode,
} from "@/components/ward-management/ward-legal-clock";
import type { LeaveBed, Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";

/** Real unit ids from `ward-sites.ts` — read as literals, not by walking the network. */
const UNIT_ARM_ADULT_OPEN = "arm-adult-open";
const UNIT_GRY_ADULT_SECURE = "gry-adult-secure";
const UNIT_FSH_ADULT_SECURE = "fsh-adult-secure";
const UNIT_SJGS_ADULT_SECURE = "sjgs-adult-secure";
const ED_ARM = "arm-ed";

export type RulingsDemoSkipped = {
  example: string;
  field: string;
  reason: string;
};

export type RulingsDemoOverlay = {
  exampleIds: readonly string[];
  movements: Movement[];
  admissions: Admission[];
  referrals: Referral[];
  patients: Patient[];
  leaveBeds: LeaveBed[];
  skipped: readonly RulingsDemoSkipped[];
};

const SKIPPED: readonly RulingsDemoSkipped[] = [
  {
    example: "writtenAt clock field",
    field: "writtenAt",
    reason: "Movement and LegalForm have no writtenAt; written times use formedAt; expiry remains unknown.",
  },
  {
    example: "ward-to-ward Movement.originUnitId",
    field: "Movement.originUnitId",
    reason: "originUnitId exists on Referral only; RD-06 is RF-RD06 with source psychiatric_ward.",
  },
];

function movement(
  partial: Omit<
    Movement,
    | "statusChanges"
    | "urgencyChanges"
    | "overrides"
    | "withdrawnReferrals"
    | "unwinds"
    | "stageChanges"
    | "declines"
    | "referredUnitIds"
    | "flaggedUrgent"
    | "specialling"
    | "highAcuity"
  > & {
    statusChanges?: Movement["statusChanges"];
    urgencyChanges?: Movement["urgencyChanges"];
    overrides?: Movement["overrides"];
    withdrawnReferrals?: Movement["withdrawnReferrals"];
    unwinds?: Movement["unwinds"];
    stageChanges?: Movement["stageChanges"];
    declines?: Movement["declines"];
    referredUnitIds?: Movement["referredUnitIds"];
    flaggedUrgent?: boolean;
    specialling?: boolean;
    highAcuity?: boolean;
  },
): Movement {
  return {
    flaggedUrgent: false,
    specialling: false,
    highAcuity: false,
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    declines: [],
    referredUnitIds: [],
    ...partial,
  };
}

function emptyAdmission(
  partial: Pick<Admission, "id" | "unitId" | "state" | "sex" | "pulledAt" | "arrivedAt"> & Partial<Admission>,
): Admission {
  return {
    specialling: false,
    highAcuity: false,
    referralId: null,
    movementId: null,
    patientId: null,
    homeRegion: "Perth Metropolitan",
    tentativeDiagnosis: null,
    awayAtEmergencyDepartmentSince: null,
    absentWithoutLeaveSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    followUp: null,
    ...partial,
  };
}

function patient(id: Patient["id"], givenName: string, familyName: string, sex: "Female" | "Male"): Patient {
  return {
    id,
    umrn: `UM-RD-${id.slice(3)}`,
    givenName,
    familyName,
    dateOfBirth: "1980-01-15",
    sex,
    gender: sex,
  };
}

function clockMovement(
  id: Movement["id"],
  now: Instant,
  code: LegalClockFormCode,
  patientId: Movement["patientId"],
  kind?: "examination" | "detention" | "transport" | "transfer",
): Movement {
  return movement({
    id,
    patientId,
    originEdId: ED_ARM,
    openedAt: now - 90,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    legalStatus: "Involuntary inpatient",
    legalForm: { code, kind },
    stage: "destination_review",
    owner: "Flow coordinator",
    blocker: "No blocker",
  });
}

export function rulingsDemoOverlay(now: Instant): RulingsDemoOverlay {
  const rd01 = movement({
    id: "WF-RD01",
    patientId: "PT-065",
    originEdId: ED_ARM,
    openedAt: now - 80,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    legalStatus: "Voluntary",
    stage: "placement_requested",
    owner: "ED mental health team",
    blocker: "Confirming destination options",
  });

  const rd02 = movement({
    id: "WF-RD02",
    patientId: "PT-066",
    originEdId: ED_ARM,
    openedAt: now - 70,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Male",
    gender: "Male", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    legalStatus: "Voluntary",
    stage: "destination_review",
    owner: "Flow coordinator",
    referredUnitIds: [UNIT_ARM_ADULT_OPEN],
    blocker: "Arrival booked",
    arrivalDetails: {
      mode: "ambulance",
      estimatedArrivalAt: now + 45,
      recordedAt: now - 20,
      recordedBy: "coordinator",
    },
  });

  const rd03 = movement({
    id: "WF-RD03",
    patientId: "PT-001",
    originEdId: ED_ARM,
    openedAt: now - 200,
    urgency: 1,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    legalStatus: "Voluntary",
    stage: "accepted_awaiting_bed",
    owner: "Flow coordinator",
    acceptedUnitId: UNIT_ARM_ADULT_OPEN,
    blocker: "Waiting for arrival",
    arrivalDetails: {
      mode: "ambulance",
      estimatedArrivalAt: now - (ARRIVAL_LATE_AFTER_MINUTES + 30),
      recordedAt: now - 150,
      recordedBy: "coordinator",
    },
    arrivalLateNotifiedAt: now - 20,
  });

  const rd05 = movement({
    id: "WF-RD05",
    patientId: "PT-067",
    originEdId: ED_ARM,
    openedAt: now - 110,
    urgency: 2,
    cohort: "Adult",
    security: "Secure",
    sex: "Female",
    gender: "Female",
    legalStatus: "Involuntary inpatient",
    stage: "destination_review",
    owner: "Flow coordinator",
    waitlistedUnitIds: [UNIT_FSH_ADULT_SECURE],
    blocker: "Waitlisted — no matching gendered bed yet",
  });

  const rd10 = movement({
    id: "WF-RD10",
    patientId: "PT-068",
    originEdId: ED_ARM,
    openedAt: now - 120,
    urgency: 2,
    cohort: "Adult",
    security: "Secure",
    sex: "Male",
    gender: "Male", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    legalStatus: "Voluntary",
    stage: "accepted_awaiting_bed",
    owner: "Flow coordinator",
    acceptedUnitId: UNIT_SJGS_ADULT_SECURE,
    // D-16 (Josh, 25 Sept 2026): a legal mismatch is recorded, never overridden, so this row shows
    // the flag alone. It used to carry `overridden: true` and "override continues".
    blocker: "Legal mismatch flagged — voluntary patient on a locked ward",
    legalMismatch: {
      at: now - 30,
      unitId: UNIT_SJGS_ADULT_SECURE,
      kind: "voluntary_on_locked_ward",
    },
  });

  const rd11 = movement({
    id: "WF-RD11",
    patientId: "PT-004",
    originEdId: ED_ARM,
    openedAt: now - (EXPECT_FLAG_VOLUNTARY_MINUTES + 30),
    urgency: 3,
    cohort: "Adult",
    security: "Open",
    sex: "Male",
    gender: "Male", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    legalStatus: "Voluntary",
    stage: "placement_requested",
    owner: "ED mental health team",
    blocker: "Still expected — not yet arrived",
    expectFlag: { raisedAt: now - 20, kind: "voluntary_48h" },
  });

  const rd12 = movement({
    id: "WF-RD12",
    patientId: "PT-069",
    originEdId: ED_ARM,
    openedAt: now - (EXPECT_FLAG_INVOLUNTARY_MINUTES + 60),
    urgency: 2,
    cohort: "Adult",
    security: "Secure",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    legalStatus: "Involuntary inpatient",
    stage: "placement_requested",
    owner: "ED mental health team",
    blocker: "Still expected — not yet arrived",
    expectFlag: { raisedAt: now - 20, kind: "involuntary_7d" },
  });

  const clockMovements = [
    clockMovement("WF-RD09-1AW", now, "1A", "PT-070", "examination"),
    clockMovement("WF-RD09-1AR", now, "1A", "PT-071", "examination"),
    clockMovement("WF-RD09-3A", now, "3A", "PT-043", "detention"),
    clockMovement("WF-RD09-3C", now, "3C", "PT-072", "detention"),
    clockMovement("WF-RD09-3D", now, "3D", "PT-073"),
    clockMovement("WF-RD09-6A", now, "6A", "PT-074"),
    clockMovement("WF-RD09-6B", now, "6B", "PT-075"),
    clockMovement("WF-RD09-6C", now, "6C", "PT-076"),
    clockMovement("WF-RD09-5A", now, "5A", "PT-077"),
    clockMovement("WF-RD09-5B", now, "5B", "PT-078"),
  ];
  clockMovements[1] = {
    ...clockMovements[1],
    legalFormReceivedAt: now - 40,
  };

  const rd04 = emptyAdmission({
    id: "AD-RD04",
    unitId: UNIT_ARM_ADULT_OPEN,
    state: "waitlisted",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    pulledAt: null,
    arrivedAt: null,
    patientId: "PT-RD04",
  });

  const rd06 = {
    id: "RF-RD06",
    ageBand: "Adult" as const,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward" as const,
          sex: "Female" as const,
          gender: "Female" as const, // R7 (25 Sept 2026): authored demo data, not derived at runtime
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued" as const,
      },
    ],
    homeRegion: "Perth Metropolitan" as const,
    suburb: { kind: "named" as const, name: "Armadale" },
    source: "psychiatric_ward" as const,
    originUnitId: UNIT_GRY_ADULT_SECURE,
    raisedAt: now - 55,
    urgency: 2 as const,
    originSiteCode: "ARM",
    transportNeeded: false,
    history: "Clinical history documented on intake.",
    patientId: "PT-RD06" as const,
  } satisfies Referral;

  const leaveOffWard: LeaveBed = {
    id: "WL-RD07",
    unitId: UNIT_ARM_ADULT_OPEN,
    admissionId: "AD-ARMA-01",
    expectedReturn: now + 180,
    confirmedAt: now - (LEAVE_BED_OPEN_WARNING_MINUTES + 45),
    confirmedBy: "NUM Armadale Adult Open",
    kind: "off_ward",
    openWarningAt: now - 40,
  };

  const leaveMedical: LeaveBed = {
    id: "WL-RD08",
    unitId: UNIT_ARM_ADULT_OPEN,
    admissionId: "AD-ARMA-08",
    expectedReturn: now + 90,
    confirmedAt: now - (LEAVE_BED_OPEN_WARNING_MINUTES + 90),
    confirmedBy: "NUM Armadale Adult Open",
    kind: "medical_trip",
    openWarningAt: now - 50,
  };

  return {
    exampleIds: [
      "RD-01",
      "RD-02",
      "RD-03",
      "RD-04",
      "RD-05",
      "RD-06",
      "RD-07",
      "RD-08",
      "RD-09",
      "RD-10",
      "RD-11",
      "RD-12",
    ],
    movements: [rd01, rd02, rd03, rd05, rd10, rd11, rd12, ...clockMovements],
    admissions: [rd04],
    referrals: [rd06],
    patients: [patient("PT-RD04", "Neris", "Quellane", "Female"), patient("PT-RD06", "Orla", "Vallowen", "Female")],
    leaveBeds: [leaveOffWard, leaveMedical],
    skipped: SKIPPED,
  };
}

function appendNewById<T extends { id: string }>(existing: T[], extra: T[]): T[] {
  const seen = new Set(existing.map((row) => row.id));
  return extra.some((row) => seen.has(row.id))
    ? [...existing, ...extra.filter((row) => !seen.has(row.id))]
    : extra.length === 0
      ? existing
      : [...existing, ...extra];
}

/**
 * Spreads overlay rows onto a seeded night. Does not replace the existing people.
 * Duplicate ids in the overlay are dropped so a later seed edit cannot collide silently.
 */
export function applyRulingsDemoOverlay<
  T extends {
    movements: Movement[];
    referrals: Referral[];
    admissions: Admission[];
    patients: Patient[];
    leaveBeds: LeaveBed[];
  },
>(state: T, now: Instant): T {
  const overlay = rulingsDemoOverlay(now);
  return {
    ...state,
    movements: appendNewById(state.movements, overlay.movements),
    referrals: appendNewById(state.referrals, overlay.referrals),
    admissions: appendNewById(state.admissions, overlay.admissions),
    patients: appendNewById(state.patients, overlay.patients),
    leaveBeds: appendNewById(state.leaveBeds, overlay.leaveBeds),
  };
}
