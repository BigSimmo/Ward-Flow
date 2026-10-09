import type { Instant } from "@/components/ward-management/ward-clock";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { MOVEMENT_STAGES } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { patientDisplayName } from "@/components/ward-management/ward-patients";
import { edById } from "@/components/ward-management/ward-sites";
import { stageCopy, transportLeg } from "@/components/ward-management/ward-derivations";
import {
  type PatientNowRecord,
  type DocumentRecord,
  clock,
  dur,
} from "@/components/ward-management/patients/patient-now-records";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { movementHasBedHold } from "@/components/ward-management/ward-movement-bed-hold";

export interface ResolvedPatientNow {
  record: PatientNowRecord;
  liveMovement?: Movement;
  livePatient?: Patient;
  liveReferral?: Referral;
  liveAdmission?: Admission;
  displayName: string;
  preferredName?: string;
  currentStageIndex: number;
}

function movementVerdict(
  movement: Movement,
  acceptedUnit?: Unit,
  departed = false,
  admissions: readonly Admission[] = [],
): PatientNowRecord["verdict"] {
  if (departed)
    return { tone: "warn", short: "Departed", title: "Departure recorded; no current ward stay.", gates: [] };
  if (movement.closure?.outcome === "did_not_proceed")
    return {
      tone: "warn",
      short: "Movement Closed",
      title: movement.closure.reason || "Movement did not proceed.",
      gates: [],
    };
  if (movement.stage === "arrived")
    return {
      tone: "good",
      short: "Arrived",
      title: `Arrival recorded at ${acceptedUnit?.name ?? "destination ward"}.`,
      gates: [],
    };
  if (movement.stage === "moving")
    return {
      tone: "good",
      short: "In Transit",
      title: `En route to ${acceptedUnit?.name ?? "receiving unit"}.`,
      gates: [],
    };
  if (acceptedUnit) {
    return movementHasBedHold(movement, admissions)
      ? { tone: "good", short: "Bed Held", title: `Bed held at ${acceptedUnit.name}.`, gates: [] }
      : {
          tone: "warn",
          short: "Accepted, Awaiting Bed",
          title: `Acceptance recorded at ${acceptedUnit.name}; no bed hold recorded.`,
          gates: [],
        };
  }
  return { tone: "warn", short: "Seeking Bed", title: "Placement request active across network wards.", gates: [] };
}

export function movementNextSteps(movement: Movement, acceptedUnit?: Unit, departed = false): PatientNowRecord["next"] {
  if (departed)
    return [
      {
        w: "Departure recorded",
        d: "No current ward stay. Review recorded discharge and community follow-up separately.",
        tone: "good",
      },
    ];
  if (movement.closure) {
    return [
      {
        w: "Movement Closed",
        d: movement.closure.reason || "Movement completed.",
        tone: movement.closure.outcome === "did_not_proceed" ? ("warn" as const) : ("good" as const),
      },
    ];
  }

  if (movement.stage === "arrived") {
    return [
      {
        w: "Journey Complete",
        d: `Arrival confirmed at ${acceptedUnit?.name ?? "destination ward"}.`,
        tone: "good" as const,
      },
    ];
  }

  if (movement.stage === "moving") {
    return [
      {
        w: "Transit Active",
        d: `Monitor transport arrival at ${acceptedUnit?.name ?? "receiving unit"}.`,
        tone: "good" as const,
      },
    ];
  }

  if (movement.stage === "handover_ready") {
    return [
      {
        w: "Transport Dispatch",
        d: "Coordinate dispatch and departure from Emergency Department.",
        tone: "good" as const,
      },
    ];
  }

  if (movement.stage === "pulled" || acceptedUnit) {
    return [
      {
        w: "Bed Pull Confirmation",
        d: `Confirm bed availability and terminal clean status with ${acceptedUnit?.name ?? "allocated unit"}.`,
        tone: "good" as const,
      },
    ];
  }

  return [
    {
      w: "Destination Review",
      d: "Review next cohort-matching bed releases across network.",
      tone: "warn" as const,
    },
  ];
}

export function resolvePatientNowRecord(
  id: string,
  patients: readonly Patient[],
  movements: readonly Movement[],
  referrals: readonly Referral[],
  units: readonly Unit[],
  now: Instant,
): ResolvedPatientNow | undefined;
export function resolvePatientNowRecord(
  id: string,
  patients: readonly Patient[],
  movements: readonly Movement[],
  referrals: readonly Referral[],
  admissions: readonly Admission[],
  units: readonly Unit[],
  now: Instant,
): ResolvedPatientNow | undefined;
export function resolvePatientNowRecord(
  id: string,
  patients: readonly Patient[],
  movements: readonly Movement[],
  referrals: readonly Referral[],
  unitsOrAdmissions: readonly Unit[] | readonly Admission[],
  nowOrUnits?: Instant | readonly Unit[],
  maybeNow?: Instant,
): ResolvedPatientNow | undefined {
  let admissions: readonly Admission[] = [];
  let units: readonly Unit[] = [];
  let now: Instant = 0;

  if (typeof nowOrUnits === "number") {
    units = (unitsOrAdmissions ?? []) as readonly Unit[];
    now = nowOrUnits;
    admissions = [];
  } else {
    admissions = (unitsOrAdmissions ?? []) as readonly Admission[];
    units = (nowOrUnits ?? []) as readonly Unit[];
    now = maybeNow ?? 0;
  }
  /**
   * A unit's name, read from the LIVE `units` this function was handed — never from the fixture.
   *
   * 🔴 This replaced three `unitById()` calls, which `tests/ward-flow-single-source.test.ts` was
   * right to refuse. The fixture and the provider hold the same units, so the name agreed today;
   * the rule is about which collection is the single source, not about whether two collections
   * happen to match, and a screen that reads the fixture stops tracking anything the reducer does.
   *
   * ⚠️ **AND IT MUST READ `units`, NOT WRAP `unitById`.** The guard matches the identifiers
   * `allUnits`/`unitById`, so a helper that called `unitById` under a new name would pass silently
   * while doing the identical thing — disarming the check rather than satisfying it. The
   * `UNITS_FIXTURE_ALLOWLIST` is also not the answer here: its nearest entry rests on the fixture
   * being the ONLY reader available server-side in `generateMetadata`, and this adapter is
   * client-side where live `units` is in hand.
   *
   * Returns the unit rather than its name, and `undefined` exactly as `unitById` did — so every
   * call site keeps its own `?? "Unit"` / `?? uid` wording rather than having a default imposed
   * here, and the sites that test the unit for truthiness before reading other fields still can.
   */
  const liveUnit = (unitId: string): Unit | undefined => units.find((unit) => unit.id === unitId);

  // Operational routes resolve the current record before any illustrative scenario.
  // 3. Movement ID resolution (starts with "WF-")
  if (id.startsWith("WF-")) {
    const movement = movements.find((m) => m.id === id);
    if (!movement) return undefined;

    const referral = movement.referralId ? referrals.find((r) => r.id === movement.referralId) : undefined;
    const stageIdx = Math.max(0, MOVEMENT_STAGES.indexOf(movement.stage));
    const waitedMins = Math.max(0, now - movement.openedAt);
    const waitedStr = dur(waitedMins);
    const originEd = edById(movement.originEdId);
    const originEdName = originEd?.name ?? "Emergency Department";
    const acceptedUnit = movement.acceptedUnitId ? liveUnit(movement.acceptedUnitId) : undefined;

    const linkedAdmission = [...admissions]
      .reverse()
      .find((admission) => admission.id === movement.admissionId || admission.movementId === movement.id);
    const departed = linkedAdmission?.state === "departed";
    const verdict = movementVerdict(movement, acceptedUnit, departed, admissions);
    const historical = departed || movement.closure?.outcome === "did_not_proceed";

    const dynamicRecord: PatientNowRecord = {
      id: movement.id,
      example: stageCopy[movement.stage]?.label ?? "In Transit",
      exampleNote: `${movement.cohort} · ${movement.security === "Secure" ? "Locked adult secure" : "Open ward"}`,
      known: "",
      arrival: originEdName,
      early: [
        {
          off: 0,
          what: `Movement opened from ${originEdName}.`,
        },
      ],
      late: [],
      blockerQuote: movement.withdrawnReferrals.length
        ? `${movement.withdrawnReferrals.length} referral withdrawals recorded. See the movement for details.`
        : null,
      lastSeen: null,
      verdict,
      reason: `Movement request: ${movement.cohort} cohort, ${movement.security === "Secure" ? "secure" : "open"} bed. Origin: ${originEdName}.`,
      ring: [
        {
          who: originEdName,
          role: "Referring Emergency Department",
          note: `Movement opened at ${clock(movement.openedAt)}`,
          tone: null,
        },
        ...(acceptedUnit
          ? [
              {
                who: acceptedUnit.name,
                role: "Allocated Receiving Unit",
                note: "Bed accepted",
                tone: "good" as const,
              },
            ]
          : []),
      ],
      ladder: "Review the current movement for escalation and next actions",
      next: movementNextSteps(movement, acceptedUnit, departed),
      transport: movement.transport
        ? [
            ["Status", transportLeg(movement.transport) ?? "Booked"],
            ["Provider", movement.transport.provider ?? "Patient Transport"],
            ...(movement.transport.cadNumber
              ? [["CAD (dispatch) number", movement.transport.cadNumber] as [string, string]]
              : []),
            ...(movement.transport.estimatedAt
              ? [["Quoted ETA", `${clock(movement.transport.estimatedAt)} AWST`] as [string, string]]
              : []),
          ]
        : [["Status", "No transport booking recorded"]],
      transportNote: movement.transport?.provider
        ? `Transport arranged with ${movement.transport.provider}.`
        : "Transport job is logged once receiving bed is confirmed.",
      transportBooked: movement.transport !== undefined,
      cadNumber: movement.transport?.cadNumber,
      eta: movement.transport?.estimatedAt ? `${clock(movement.transport.estimatedAt)} AWST` : undefined,
      transportProvider: movement.transport?.provider,
      transportLegalStatus: movement.transport?.transportLegalStatus,
      escortRequired: movement.transport?.escortRequired,
      presentations: [
        {
          date: historical ? "Previous Presentation" : "Current Presentation",
          year: 2026.62,
          current: !historical,
          where: originEdName,
          to: acceptedUnit?.name ?? (historical ? "No admission recorded" : "Seeking bed"),
          los: waitedStr,
          losFull: `${waitedStr} at ${originEdName}`,
          source: "Emergency Department",
          route: "Patient transport",
          tier: movement.urgency,
          legal: movement.legalForm ? legalFormName(movement.legalForm) : (movement.legalStatus ?? "Not recorded"),
          forms: movement.legalForm
            ? [
                {
                  code: movement.legalForm.code,
                  name: legalFormName(movement.legalForm),
                  from: "Current presentation",
                  by: "Author not recorded here",
                  when: "Active presentation",
                  status: "Active",
                },
              ]
            : [],
          asked: movement.referredUnitIds.map((uid) => ({
            ward: liveUnit(uid)?.name ?? uid,
            outcome: uid === movement.acceptedUnitId ? "Accepted" : "Referred — see movement for response",
            why: "",
          })),
          outcome: historical
            ? verdict.title
            : acceptedUnit
              ? `Accepted by ${acceptedUnit.name}`
              : "Placement requested",
          team: "Team not recorded here",
          story: `Acute placement request initiated at ${originEdName}.`,
        },
      ],
      presentationsAbsent: "No prior presentation history on file.",
      community: {
        teams: [],
        followUp: "Community follow-up is not established by this movement record.",
      },
      documents: movement.legalForm
        ? [
            {
              code: movement.legalForm.code,
              name: legalFormName(movement.legalForm),
              from: "The presentation open now",
              by: "Author not recorded here",
              when: "Active presentation",
              status: movement.legalForm.dueAt !== undefined ? `Runs to ${clock(movement.legalForm.dueAt)}` : "Active",
            },
          ]
        : [],
      documentsAbsent: "No legal forms recorded for this presentation.",
    };

    const resolvedPatient = resolveSubjectPatient(movement, { patients, referrals, movements });
    const livePatient = resolvedPatient.patient;
    // displayName is "Given Family"; formalName is "Family, Given" for sorted lists — do not swap them.
    const displayName =
      resolvedPatient.displayName !== "Unknown Patient" ? resolvedPatient.displayName : "Patient not recorded";
    const preferredName = livePatient?.preferredName;

    return {
      record: dynamicRecord,
      liveMovement: movement,
      livePatient,
      liveReferral: referral,
      liveAdmission: linkedAdmission,
      displayName,
      preferredName,
      currentStageIndex: stageIdx,
    };
  }

  // 4. Patient ID resolution (starts with "PT-")
  if (id.startsWith("PT-")) {
    const patient = patients.find((p) => p.id === id);
    if (!patient) return undefined;

    // Collections retain history. Resolve the current stay first, then its movement;
    // prefer an open presentation over the newest historical presentation when no stay exists.
    const patientMovements = movements.filter(
      (m) =>
        m.patientId === patient.id ||
        (m.referralId && referrals.some((r) => r.id === m.referralId && r.patientId === patient.id)),
    );
    const patientAdmissions = admissions.filter(
      (a) =>
        a.patientId === patient.id ||
        (a.referralId && referrals.some((r) => r.id === a.referralId && r.patientId === patient.id)) ||
        patientMovements.some((m) => m.id === a.movementId),
    );
    const activeAdmission =
      [...patientAdmissions].reverse().find((a) => a.state === "occupied") ??
      [...patientAdmissions].reverse().find((a) => a.state !== "departed");
    const newestMovement = [...patientMovements].reverse();
    const activeMovement = activeAdmission
      ? (newestMovement.find(
          (m) =>
            !m.closure &&
            m.stage !== "arrived" &&
            (m.id === activeAdmission.movementId ||
              m.admissionId === activeAdmission.id ||
              m.sourceAdmissionId === activeAdmission.id),
        ) ?? newestMovement.find((m) => m.id === activeAdmission.movementId || m.admissionId === activeAdmission.id))
      : (newestMovement.find((m) => !m.closure) ?? newestMovement[0]);
    const linkedReferral = referrals.find((r) => r.id === (activeMovement?.referralId ?? activeAdmission?.referralId));
    const latestDeparture =
      !activeAdmission && patientAdmissions.some((a) => a.state === "departed" && a.movementId === activeMovement?.id);

    // A legal document only from the record: the active movement's own recorded form. PT-042 and
    // PT-043 used to get a Form 1A and a Form 3A "running to" three hours from whenever the page was
    // opened, typed in by patient id with no record behind them (invented-figures sweep, 26 Sept 2026).
    const specialDocuments: DocumentRecord[] = [];
    if (activeMovement?.legalForm) {
      specialDocuments.push({
        code: activeMovement.legalForm.code,
        name: legalFormName(activeMovement.legalForm),
        from: "The presentation open now",
        by: "Author not recorded here",
        when: "Active presentation",
        status:
          activeMovement.legalForm.dueAt !== undefined ? `Runs to ${clock(activeMovement.legalForm.dueAt)}` : "Active",
      });
    }

    if (activeMovement) {
      const stageIdx = Math.max(0, MOVEMENT_STAGES.indexOf(activeMovement.stage));
      const waitedMins = Math.max(0, now - activeMovement.openedAt);
      const waitedStr = dur(waitedMins);
      const originEd = edById(activeMovement.originEdId);
      const originEdName = originEd?.name ?? "Emergency Department";
      const acceptedUnit = activeMovement.acceptedUnitId
        ? liveUnit(activeMovement.acceptedUnitId)
        : activeAdmission
          ? liveUnit(activeAdmission.unitId)
          : undefined;

      const verdict = movementVerdict(activeMovement, acceptedUnit, latestDeparture, admissions);
      const historical = latestDeparture || activeMovement.closure?.outcome === "did_not_proceed";

      const dynamicRecord: PatientNowRecord = {
        id: patient.id,
        example: stageCopy[activeMovement.stage]?.label ?? "In Transit",
        exampleNote: `${activeMovement.cohort} · ${activeMovement.security === "Secure" ? "Locked adult secure" : "Open ward"}`,
        known: patient.preferredName ? `known as ${patient.preferredName}` : "",
        arrival: originEdName,
        early: [
          {
            off: 0,
            what: `Movement opened from ${originEdName}.`,
          },
        ],
        late: [],
        blockerQuote: activeMovement.withdrawnReferrals.length
          ? `${activeMovement.withdrawnReferrals.length} referral withdrawals recorded. See the movement for details.`
          : null,
        lastSeen: null,
        verdict,
        reason: `Movement request: ${activeMovement.cohort} cohort, ${activeMovement.security === "Secure" ? "secure" : "open"} bed. Origin: ${originEdName}.`,
        ring: [
          {
            who: originEdName,
            role: "Referring Emergency Department",
            note: `Movement opened at ${clock(activeMovement.openedAt)}`,
            tone: null,
          },
          ...(acceptedUnit
            ? [
                {
                  who: acceptedUnit.name,
                  role: "Allocated Receiving Unit",
                  note: "Bed accepted",
                  tone: "good" as const,
                },
              ]
            : []),
        ],
        ladder: "Review the current movement for escalation and next actions",
        next: movementNextSteps(activeMovement, acceptedUnit, latestDeparture),
        transport: activeMovement.transport
          ? [
              ["Status", transportLeg(activeMovement.transport) ?? "Booked"],
              ["Provider", activeMovement.transport.provider ?? "Patient Transport"],
              ...(activeMovement.transport.cadNumber
                ? [["CAD (dispatch) number", activeMovement.transport.cadNumber] as [string, string]]
                : []),
              ...(activeMovement.transport.estimatedAt
                ? [["Quoted ETA", `${clock(activeMovement.transport.estimatedAt)} AWST`] as [string, string]]
                : []),
            ]
          : [["Status", "No transport booking recorded"]],
        transportNote: activeMovement.transport?.provider
          ? `Transport arranged with ${activeMovement.transport.provider}.`
          : "Transport job is logged once receiving bed is confirmed.",
        transportBooked: activeMovement.transport !== undefined,
        cadNumber: activeMovement.transport?.cadNumber,
        eta: activeMovement.transport?.estimatedAt ? `${clock(activeMovement.transport.estimatedAt)} AWST` : undefined,
        transportProvider: activeMovement.transport?.provider,
        transportLegalStatus: activeMovement.transport?.transportLegalStatus,
        escortRequired: activeMovement.transport?.escortRequired,
        presentations: [
          {
            date: historical ? "Previous Presentation" : "Current Presentation",
            year: 2026.62,
            current: !historical,
            where: originEdName,
            to: acceptedUnit?.name ?? (historical ? "No admission recorded" : "Seeking bed"),
            los: waitedStr,
            losFull: `${waitedStr} at ${originEdName}`,
            source: "Emergency Department",
            route: "Patient transport",
            tier: activeMovement.urgency,
            legal: activeMovement.legalForm
              ? legalFormName(activeMovement.legalForm)
              : (activeMovement.legalStatus ?? patient.legalStatus ?? "Not recorded"),
            forms: specialDocuments,
            asked: activeMovement.referredUnitIds.map((uid) => ({
              ward: liveUnit(uid)?.name ?? uid,
              outcome: uid === activeMovement.acceptedUnitId ? "Accepted" : "Referred — see movement for response",
              why: "",
            })),
            outcome: historical
              ? verdict.title
              : acceptedUnit
                ? `Accepted by ${acceptedUnit.name}`
                : "Placement requested",
            team: "Team not recorded here",
            story: `Acute placement request initiated at ${originEdName}.`,
          },
        ],
        presentationsAbsent: "No prior presentation history on file.",
        community: {
          teams: patient.catchmentCommunityTeam
            ? [
                {
                  name: patient.catchmentCommunityTeam,
                  state: "Recorded catchment",
                  note: "Catchment community team",
                },
              ]
            : [],
          followUp: "Community follow-up is not established by this movement record.",
        },
        documents: specialDocuments,
        documentsAbsent: "No legal forms recorded for this presentation.",
      };

      return {
        record: dynamicRecord,
        liveMovement: activeMovement,
        livePatient: patient,
        liveReferral: linkedReferral,
        liveAdmission: activeAdmission,
        displayName: patientDisplayName(patient),
        preferredName: patient.preferredName,
        currentStageIndex: stageIdx,
      };
    }

    if (activeAdmission) {
      const acceptedUnit = liveUnit(activeAdmission.unitId);
      const unitName = acceptedUnit?.name ?? "Inpatient Ward";
      const stageIdx = MOVEMENT_STAGES.indexOf("arrived");

      const dynamicRecord: PatientNowRecord = {
        id: patient.id,
        example: "Admitted",
        exampleNote: `${acceptedUnit?.cohort ?? "Adult"} · ${(acceptedUnit?.lockedBeds ?? 0) > 0 ? "Locked adult secure" : "Open ward"}`,
        known: patient.preferredName ? `known as ${patient.preferredName}` : "",
        arrival: unitName,
        early: [
          {
            off: 0,
            what: `Admission active at ${unitName}.`,
          },
        ],
        late: [],
        blockerQuote: null,
        lastSeen: null,
        verdict: {
          tone: "good",
          short: "In Bed",
          title: `Arrival recorded at ${unitName}.`,
          gates: [],
        },
        reason: `Inpatient admission at ${unitName}.`,
        ring: [
          {
            who: unitName,
            role: "Current Inpatient Ward",
            note: "Bed occupied",
            tone: "good",
          },
          ...(patient.generalPractitioner
            ? [
                {
                  who: patient.generalPractitioner,
                  role: "Recorded GP",
                  note: "Contact details not held here",
                  tone: null,
                },
              ]
            : []),
        ],
        ladder: "Review the current admission for escalation and next actions",
        next: [
          {
            w: "Inpatient Care",
            d: `Patient admitted at ${unitName}.`,
            tone: "good",
          },
        ],
        transport: [["Status", "Completed — arrived at ward"]],
        transportNote: `Patient arrived at ${unitName}.`,
        transportBooked: false,
        presentations: [
          {
            date: "Current Presentation",
            year: 2026.62,
            current: true,
            where: unitName,
            to: unitName,
            los: activeAdmission.arrivedAt ? dur(Math.max(0, now - activeAdmission.arrivedAt)) : "Inpatient",
            losFull: `Inpatient at ${unitName}`,
            source: "Inpatient Ward",
            route: "Bed allocation",
            tier: 1,
            legal: patient.legalStatus ?? "Not recorded",
            forms: specialDocuments,
            asked: [{ ward: unitName, outcome: "Accepted", why: "" }],
            outcome: `Admitted to ${unitName}`,
            team: patient.catchmentCommunityTeam ?? "Team not recorded here",
            story: `Inpatient admission at ${unitName}.`,
          },
        ],
        presentationsAbsent: "No prior presentation history on file.",
        community: {
          teams: patient.catchmentCommunityTeam
            ? [
                {
                  name: patient.catchmentCommunityTeam,
                  state: "Recorded catchment",
                  note: "Catchment community team",
                },
              ]
            : [],
          followUp: "Follow-up status is not recorded here.",
        },
        documents: specialDocuments,
        documentsAbsent: "No legal forms recorded for this presentation.",
      };

      return {
        record: dynamicRecord,
        livePatient: patient,
        liveReferral: linkedReferral,
        liveAdmission: activeAdmission,
        displayName: patientDisplayName(patient),
        preferredName: patient.preferredName,
        currentStageIndex: stageIdx >= 0 ? stageIdx : 0,
      };
    }

    // A patient identity alone does not establish current care or a clinical plan.
    const communityRecord: PatientNowRecord = {
      id: patient.id,
      example: "Patient record",
      exampleNote: "No linked movement displayed",
      known: patient.preferredName ? `known as ${patient.preferredName}` : "",
      arrival: "Not recorded",
      early: [],
      late: [],
      blockerQuote: null,
      lastSeen: null,
      verdict: { tone: "warn", short: "Patient record", title: "No linked movement displayed", gates: [] },
      reason: `Legal status: ${patient.legalStatus ?? "Not recorded"}. Suburb: ${patient.suburb ?? "Not recorded"}. GP: ${patient.generalPractitioner ?? "Not recorded"}.`,
      ring: patient.generalPractitioner
        ? [{ who: patient.generalPractitioner, role: "Recorded GP", note: "Contact details not held here", tone: null }]
        : [],
      ladder: "Current care and escalation arrangements are not recorded here.",
      next: [],
      transport: [["Transport", "No linked transport record displayed"]],
      transportNote: "Transport needs are not established by this patient identity record.",
      presentations: [],
      presentationsAbsent: "No linked presentation history is displayed here.",
      community: {
        teams: patient.catchmentCommunityTeam
          ? [
              {
                name: patient.catchmentCommunityTeam,
                state: "Recorded catchment",
                note: "Does not establish active care",
              },
            ]
          : [],
        followUp: "Follow-up status is not recorded here.",
      },
      documents: specialDocuments,
      documentsAbsent:
        specialDocuments.length > 0
          ? ""
          : "No linked legal documents are displayed here. Legal status alone does not establish an order document.",
    };

    return {
      record: communityRecord,
      livePatient: patient,
      displayName: patientDisplayName(patient),
      preferredName: patient.preferredName,
      currentStageIndex: 0,
    };
  }

  return undefined;
}
