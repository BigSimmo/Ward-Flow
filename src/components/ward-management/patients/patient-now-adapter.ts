import type { Instant } from "@/components/ward-management/ward-clock";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { LegalForm, Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { MOVEMENT_STAGES } from "@/components/ward-management/ward-model";
import type { CommunityTreatmentOrder, Patient } from "@/components/ward-management/ward-patients";
import { activeCommunityTreatmentOrder, patientDisplayName } from "@/components/ward-management/ward-patients";
import { edById } from "@/components/ward-management/ward-sites";
import { stageCopy, transportLeg } from "@/components/ward-management/ward-derivations";
import {
  type PatientNowRecord,
  type DocumentRecord,
  clock,
  dur,
} from "@/components/ward-management/patients/patient-now-records";
import { NAME_NOT_RECORDED, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { leavingDestinationLabel } from "@/components/ward-management/community/community-derivations";
import { movementHasBedHold } from "@/components/ward-management/ward-movement-bed-hold";
import { originName } from "@/components/ward-management/ward-movement-origin";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { patientMode } from "./patient-mode";

export interface ResolvedPatientNow {
  record: PatientNowRecord;
  liveMovement?: Movement;
  livePatient?: Patient;
  liveReferral?: Referral;
  liveAdmission?: Admission;
  /** Every ward stay linked to this person, oldest first, for History. Read here because this is
   *  the one patient file allowed to follow the patient link (archived D-14). */
  stays?: Admission[];
  displayName: string;
  preferredName?: string;
  currentStageIndex: number;
  /** D-186 Q7: the one legal reading the top band and the Legal now card share. */
  legalNow: PatientLegalNow;
}

/**
 * D-186 Q7 (audit A9-31, Josh 13 Nov 2026): what the patient page says is legally in force now,
 * worked out once here. The top band and the Legal now card both read it, so one page cannot say
 * "Involuntary inpatient" in one place and "No form in force" in the other. Every field is a
 * recorded fact named with where it was recorded; nothing is inferred and no status is made up.
 */
export interface PatientLegalNow {
  /** A placement is open or a ward stay is current, so the page speaks of now, not the last record. */
  current: boolean;
  /** The movement the band reads: the live movement while in force, else the current stay's own. */
  movement?: Movement;
  /** The status as recorded: the movement's own, else the patient record's. */
  status?: string;
  statusSource: "movement" | "patient" | "none";
  /** The form recorded on that movement, only while something is current. */
  form?: LegalForm;
  formSource: "movement" | "none";
  /** A community treatment order the patient record holds as in force (D-38). */
  communityOrder?: CommunityTreatmentOrder;
}

/**
 * The one derivation. The source movement keeps the band's rule as it stood (patient-now-screen's
 * glance movement): the live movement while it is in force, otherwise the current stay's own
 * movement, otherwise the live movement for its last recorded status. Which status a patient gone
 * to ED shows is an open owner question, so that rule is kept, not changed.
 */
export function patientLegalNow({
  liveMovement,
  admission,
  patient,
  movements = [],
}: {
  liveMovement?: Movement;
  admission?: Admission;
  patient?: Patient;
  movements?: readonly Movement[];
}): PatientLegalNow {
  const mode = patientMode({ movement: liveMovement, admission, patient });
  const current = mode !== "idle" && mode !== "cto";
  const stayCurrent = mode === "ward" || mode === "leave" || mode === "awol" || mode === "ed";
  const movementInForce = Boolean(
    liveMovement && current && (!liveMovement.closure || (liveMovement.closure.outcome === "arrived" && stayCurrent)),
  );
  const stayMovement =
    stayCurrent && admission?.movementId ? movements.find((m) => m.id === admission.movementId) : undefined;
  const movement = movementInForce ? liveMovement : stayCurrent ? stayMovement : liveMovement;
  const status = movement?.legalStatus ?? patient?.legalStatus;
  const form = current ? movement?.legalForm : undefined;
  return {
    current,
    movement,
    status,
    statusSource:
      movement?.legalStatus !== undefined ? "movement" : patient?.legalStatus !== undefined ? "patient" : "none",
    form,
    formSource: form ? "movement" : "none",
    communityOrder: activeCommunityTreatmentOrder(patient),
  };
}

/**
 * A patient's current movement and stay, as the record resolves them. Collections keep history, so
 * the current stay comes first, then its movement; with no stay, an open presentation is preferred
 * over the newest historical one.
 */
function patientCurrentRecords(
  patient: Patient,
  movements: readonly Movement[],
  referrals: readonly Referral[],
  admissions: readonly Admission[],
) {
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
  return { patientAdmissions, activeAdmission, activeMovement };
}

/** The recorded departure as an event: a community discharge stays "Discharge"; a transfer or death keeps its own name. */
function departureEventLabel(destination: Admission["leavingDestination"] | null): string | undefined {
  if (destination === "discharged-to-the-community") return "Discharge";
  return leavingDestinationLabel(destination) ?? undefined;
}

function movementVerdict(
  movement: Movement,
  acceptedUnit?: Unit,
  departed = false,
  admissions: readonly Admission[] = [],
  departureLabel = "Departure",
): PatientNowRecord["verdict"] {
  // A departed stay is named by its recorded destination: a transfer or a death is not a discharge.
  if (departed)
    return {
      tone: "warn",
      short: departureLabel === "Discharge" ? "Discharged" : departureLabel,
      title: `${departureLabel} recorded; no current ward stay.`,
      gates: [],
    };
  if (movement.closure?.outcome === "did_not_proceed")
    return {
      tone: "warn",
      short: "Movement closed",
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
      short: "Moving",
      title: `En route to ${acceptedUnit?.name ?? "receiving unit"}.`,
      gates: [],
    };
  if (acceptedUnit) {
    return movementHasBedHold(movement, admissions)
      ? { tone: "good", short: "Bed pulled", title: `Bed pulled at ${acceptedUnit.name}.`, gates: [] }
      : {
          tone: "warn",
          short: "Accepted, awaiting bed",
          title: `Acceptance recorded at ${acceptedUnit.name}; no bed pulled.`,
          gates: [],
        };
  }
  return { tone: "warn", short: "Needs a bed", title: "Placement request active across network wards.", gates: [] };
}

/** Who the patient is collected from, by where the movement started. */
function collectionPoint(originKind: MovementOriginKind | undefined): string {
  if (originKind === "admission") return "the sending ward";
  if (originKind === "community") return "the referring community team";
  return "the ED";
}

type MovementOriginKind = ReturnType<typeof presentationOrigin>["kind"];

function movementNextSteps(
  movement: Movement,
  acceptedUnit?: Unit,
  departed = false,
  departureLabel = "Departure",
  originKind?: MovementOriginKind,
): PatientNowRecord["next"] {
  if (departed)
    return [
      {
        w: `${departureLabel} recorded`,
        d: "No current ward stay. Review the recorded destination and follow-up separately.",
        tone: "good",
      },
    ];
  if (movement.closure) {
    return [
      {
        w: "Movement closed",
        d: movement.closure.reason || "Movement completed.",
        tone: movement.closure.outcome === "did_not_proceed" ? ("warn" as const) : ("good" as const),
      },
    ];
  }

  if (movement.stage === "arrived") {
    return [
      {
        w: "Movement complete",
        d: `Arrival confirmed at ${acceptedUnit?.name ?? "destination ward"}.`,
        tone: "good" as const,
      },
    ];
  }

  if (movement.stage === "moving") {
    return [
      {
        w: "Moving",
        d: `Monitor transport arrival at ${acceptedUnit?.name ?? "receiving unit"}.`,
        tone: "good" as const,
      },
    ];
  }

  if (movement.stage === "handover_ready") {
    return [
      {
        w: "Send the patient",
        d: `Transport is booked or not needed. Coordinate collection from ${collectionPoint(originKind)}.`,
        tone: "good" as const,
      },
    ];
  }

  if (movement.stage === "pulled") {
    // #1476 review: the step follows the transport record, so a booked (not cancelled) job or a
    // recorded "no transport needed" asks for the handover, not another booking.
    const booked = movement.transport !== undefined && transportLeg(movement.transport) !== "Cancelled";
    if (booked || movement.transportNeed?.needed === false) {
      return [
        {
          w: "Mark handover ready",
          d: `${booked ? "Transport is booked" : "No transport needed"}. Mark the handover ready for collection from ${collectionPoint(originKind)}.`,
          tone: "good" as const,
        },
      ];
    }
    return [
      {
        w: "Book transport",
        d: `Bed pulled at ${acceptedUnit?.name ?? "allocated unit"}. Book transport or record that none is needed.`,
        tone: "good" as const,
      },
    ];
  }

  if (acceptedUnit) {
    return [
      {
        w: "Pull the bed",
        d: `Confirm bed availability and terminal clean status with ${acceptedUnit?.name ?? "allocated unit"}.`,
        tone: "good" as const,
      },
    ];
  }

  return [
    {
      w: "Choose a ward",
      d: "Review next cohort-matching discharges across network.",
      tone: "warn" as const,
    },
  ];
}

/**
 * Whether a ward stay is the subject patient's own. The record tabs (Community, Details, Documents)
 * ask this of the one person in focus only, so the patient link stays read here, under archived D-14.
 * The patient page's open work (`patient-open-work.ts`, A16-11) asks the same of that one person's
 * own referrals and planned bookings.
 */
export function isOwnStay(stay: { readonly patientId?: string | null }, subjectId: string): boolean {
  return stay.patientId === subjectId;
}

function presentationOrigin(
  movement: Movement,
  referral: Referral | undefined,
  admissions: readonly Admission[],
  units: readonly Unit[],
) {
  const sourceUnitId = movement.sourceAdmissionId
    ? admissions.find((stay) => stay.id === movement.sourceAdmissionId)?.unitId
    : referral?.originUnitId;
  if (movement.sourceAdmissionId || sourceUnitId)
    return {
      name: units.find((unit) => unit.id === sourceUnitId)?.name ?? "Origin not recorded",
      kind: "admission" as const,
    };
  if (movement.originCommunity)
    return { name: originName(movement) ?? "Origin not recorded", kind: "community" as const };
  return {
    name: movement.originEdId ? (edById(movement.originEdId)?.name ?? "Origin not recorded") : "Origin not recorded",
    kind: movement.originEdId ? ("ed" as const) : undefined,
  };
}

function presentationLength(movement: Movement, admission: Admission | undefined, now: Instant): string {
  const end =
    admission?.state === "departed"
      ? (admission.leftAt ?? movement.closure?.at)
      : movement.closure && (movement.closure.outcome === "did_not_proceed" || !admission)
        ? movement.closure.at
        : now;
  return end === undefined ? "Not recorded" : dur(Math.max(0, end - movement.openedAt));
}

function presentationAnswers(
  movement: Movement,
  units: readonly Unit[],
): PatientNowRecord["presentations"][number]["asked"] {
  const ward = (id: string) => units.find((unit) => unit.id === id)?.name ?? id;
  const history = movement.referralAnswerHistory ?? [];
  const declineFor = (answer: { unitId: string; at: Instant }) =>
    movement.declines.find((decline) => decline.unitId === answer.unitId && decline.at === answer.at);
  // A "no suitable bed" or "bed pulled" answer also leaves a decline entry, but it waitlists and keeps
  // the referral live: it is shown once, as Waitlisted, never as a refusal (Codex review of #1331).
  const answers = movement.declines
    .filter((d) => !history.some((a) => a.answer === "waitlisted" && a.unitId === d.unitId && a.at === d.at))
    .map((decline) => ({
      ward: ward(decline.unitId),
      outcome: "Declined",
      why: decline.reason ? DECLINE_REASON_LABELS[decline.reason] : "",
    }));
  for (const answer of history) {
    const decline = declineFor(answer);
    if (answer.answer === "declined" && decline) continue;
    answers.push({
      ward: ward(answer.unitId),
      outcome: answer.answer === "waitlisted" ? "Waitlisted" : answer.answer === "declined" ? "Declined" : "Withdrawn",
      why: answer.answer === "waitlisted" && decline?.reason ? DECLINE_REASON_LABELS[decline.reason] : "",
    });
  }
  for (const withdrawn of movement.withdrawnReferrals) {
    if (
      !(movement.referralAnswerHistory ?? []).some(
        (answer) => answer.unitId === withdrawn.unitId && answer.at === withdrawn.at && answer.answer === "withdrawn",
      )
    )
      answers.push({ ward: ward(withdrawn.unitId), outcome: "Withdrawn", why: "" });
  }
  if (movement.acceptedUnitId) answers.push({ ward: ward(movement.acceptedUnitId), outcome: "Accepted", why: "" });
  for (const id of movement.referredUnitIds)
    if (id !== movement.acceptedUnitId && !movement.waitlistedUnitIds?.includes(id))
      answers.push({ ward: ward(id), outcome: "Referred — awaiting response", why: "" });
  return answers;
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
    const origin = presentationOrigin(movement, referral, admissions, units);
    const originEdName = origin.name;
    const acceptedUnit = movement.acceptedUnitId ? liveUnit(movement.acceptedUnitId) : undefined;

    const linkedAdmission = [...admissions]
      .reverse()
      .find((admission) => admission.id === movement.admissionId || admission.movementId === movement.id);
    const departed = linkedAdmission?.state === "departed";
    const waitedStr = presentationLength(movement, linkedAdmission, now);
    const departureLabel = departureEventLabel(linkedAdmission?.leavingDestination ?? null);
    const verdict = movementVerdict(movement, acceptedUnit, departed, admissions, departureLabel);
    const historical =
      departed ||
      movement.closure?.outcome === "did_not_proceed" ||
      (movement.closure !== undefined && linkedAdmission === undefined);

    const dynamicRecord: PatientNowRecord = {
      id: movement.id,
      example: stageCopy[movement.stage]?.label ?? "Moving",
      exampleNote: `${movement.cohort} · ${movement.security === "Secure" ? "Locked ward" : "Open ward"}`,
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
          role:
            origin.kind === "ed" ? "Referring ED" : origin.kind === "admission" ? "Sending ward" : "Referring service",
          note: `Movement opened at ${clock(movement.openedAt)}`,
          tone: null,
        },
        ...(acceptedUnit
          ? [
              {
                who: acceptedUnit.name,
                role: "Receiving ward",
                note: "Accepted",
                tone: "good" as const,
              },
            ]
          : []),
      ],
      ladder: "Review the current movement for escalation and next actions",
      next: movementNextSteps(movement, acceptedUnit, departed, departureLabel, origin.kind),
      transport: movement.transport
        ? [
            ["Status", transportLeg(movement.transport) ?? "Booked"],
            ["Provider", movement.transport.provider ?? "Patient transport"],
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
          date: historical ? "Previous presentation" : "Current presentation",
          year: 2026.62,
          current: !historical,
          kind: linkedAdmission ? "admission" : origin.kind,
          where: originEdName,
          to: acceptedUnit?.name ?? (historical ? "No admission recorded" : "Seeking bed"),
          los: waitedStr,
          losFull: `${waitedStr} elapsed`,
          source: originEdName,
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
          asked: presentationAnswers(movement, units),
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
    const displayName =
      resolvedPatient.formalName !== NAME_NOT_RECORDED ? resolvedPatient.formalName : "Patient not recorded";
    const preferredName = livePatient?.preferredName;

    return {
      record: dynamicRecord,
      liveMovement: movement,
      livePatient,
      liveReferral: referral,
      liveAdmission: linkedAdmission,
      stays: admissions.filter(
        (admission) =>
          admission.id === movement.admissionId ||
          admission.id === movement.sourceAdmissionId ||
          admission.movementId === movement.id ||
          (livePatient !== undefined && admission.patientId === livePatient.id),
      ),
      displayName,
      preferredName,
      currentStageIndex: stageIdx,
      legalNow: patientLegalNow({
        liveMovement: movement,
        admission: linkedAdmission,
        patient: livePatient,
        movements,
      }),
    };
  }

  // 4. Patient ID resolution (starts with "PT-")
  if (id.startsWith("PT-")) {
    const patient = patients.find((p) => p.id === id);
    if (!patient) return undefined;

    // Collections retain history. Resolve the current stay first, then its movement;
    // prefer an open presentation over the newest historical presentation when no stay exists.
    const { patientAdmissions, activeAdmission, activeMovement } = patientCurrentRecords(
      patient,
      movements,
      referrals,
      admissions,
    );
    const legalNow = patientLegalNow({ liveMovement: activeMovement, admission: activeAdmission, patient, movements });
    const linkedReferral = referrals.find((r) => r.id === (activeMovement?.referralId ?? activeAdmission?.referralId));
    const departedAdmission = activeAdmission
      ? undefined
      : [...patientAdmissions].reverse().find((a) => a.state === "departed" && a.movementId === activeMovement?.id);
    const latestDeparture = departedAdmission !== undefined;
    const departureLabel = departureEventLabel(departedAdmission?.leavingDestination ?? null);

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
      const origin = presentationOrigin(activeMovement, linkedReferral, admissions, units);
      const originEdName = origin.name;
      const waitedStr = presentationLength(activeMovement, activeAdmission ?? departedAdmission, now);
      const acceptedUnit = activeMovement.acceptedUnitId
        ? liveUnit(activeMovement.acceptedUnitId)
        : activeAdmission
          ? liveUnit(activeAdmission.unitId)
          : undefined;

      const verdict = movementVerdict(activeMovement, acceptedUnit, latestDeparture, admissions, departureLabel);
      const historical =
        latestDeparture ||
        activeMovement.closure?.outcome === "did_not_proceed" ||
        (activeMovement.closure !== undefined && activeAdmission === undefined);

      const dynamicRecord: PatientNowRecord = {
        id: patient.id,
        example: stageCopy[activeMovement.stage]?.label ?? "Moving",
        exampleNote: `${activeMovement.cohort} · ${activeMovement.security === "Secure" ? "Locked ward" : "Open ward"}`,
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
            role:
              origin.kind === "ed"
                ? "Referring ED"
                : origin.kind === "admission"
                  ? "Sending ward"
                  : "Referring service",
            note: `Movement opened at ${clock(activeMovement.openedAt)}`,
            tone: null,
          },
          ...(acceptedUnit
            ? [
                {
                  who: acceptedUnit.name,
                  role: "Receiving ward",
                  note: "Accepted",
                  tone: "good" as const,
                },
              ]
            : []),
        ],
        ladder: "Review the current movement for escalation and next actions",
        next: movementNextSteps(activeMovement, acceptedUnit, latestDeparture, departureLabel, origin.kind),
        transport: activeMovement.transport
          ? [
              ["Status", transportLeg(activeMovement.transport) ?? "Booked"],
              ["Provider", activeMovement.transport.provider ?? "Patient transport"],
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
            date: historical ? "Previous presentation" : "Current presentation",
            year: 2026.62,
            current: !historical,
            kind: activeAdmission || departedAdmission ? "admission" : origin.kind,
            where: originEdName,
            to: acceptedUnit?.name ?? (historical ? "No admission recorded" : "Seeking bed"),
            los: waitedStr,
            losFull: `${waitedStr} elapsed`,
            source: originEdName,
            route: "Patient transport",
            tier: activeMovement.urgency,
            legal: activeMovement.legalForm
              ? legalFormName(activeMovement.legalForm)
              : (activeMovement.legalStatus ?? patient.legalStatus ?? "Not recorded"),
            forms: specialDocuments,
            asked: presentationAnswers(activeMovement, units),
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
        stays: patientAdmissions,
        displayName: patientDisplayName(patient),
        preferredName: patient.preferredName,
        currentStageIndex: stageIdx,
        legalNow,
      };
    }

    if (activeAdmission) {
      const acceptedUnit = liveUnit(activeAdmission.unitId);
      const unitName = acceptedUnit?.name ?? "Inpatient ward";
      const stageIdx = MOVEMENT_STAGES.indexOf("arrived");

      const dynamicRecord: PatientNowRecord = {
        id: patient.id,
        example: "Admitted",
        exampleNote: `${acceptedUnit?.cohort ?? "Adult"} · ${(acceptedUnit?.lockedBeds ?? 0) > 0 ? "Locked ward" : "Open ward"}`,
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
          short: "In a bed",
          title: `Arrival recorded at ${unitName}.`,
          gates: [],
        },
        reason: `Inpatient admission at ${unitName}.`,
        ring: [
          {
            who: unitName,
            role: "Current ward",
            note: "Bed occupied",
            tone: "good",
          },
          ...(patient.generalPractitioner
            ? [
                {
                  who: patient.generalPractitioner,
                  role: "Recorded GP",
                  note: "Contact details not recorded here",
                  tone: null,
                },
              ]
            : []),
        ],
        ladder: "Review the current admission for escalation and next actions",
        next: [
          {
            w: "In a bed",
            d: `Patient admitted at ${unitName}.`,
            tone: "good",
          },
        ],
        transport: [["Status", "Completed — arrived at ward"]],
        transportNote: `Patient arrived at ${unitName}.`,
        transportBooked: false,
        presentations: [
          {
            date: "Current presentation",
            year: 2026.62,
            current: true,
            where: unitName,
            to: unitName,
            los: activeAdmission.arrivedAt ? dur(Math.max(0, now - activeAdmission.arrivedAt)) : "Inpatient",
            losFull: `Inpatient at ${unitName}`,
            source: "Inpatient ward",
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
          followUp: "Not recorded.",
        },
        documents: specialDocuments,
        documentsAbsent: "No legal forms recorded for this presentation.",
      };

      return {
        record: dynamicRecord,
        livePatient: patient,
        liveReferral: linkedReferral,
        liveAdmission: activeAdmission,
        stays: patientAdmissions,
        displayName: patientDisplayName(patient),
        preferredName: patient.preferredName,
        currentStageIndex: stageIdx >= 0 ? stageIdx : 0,
        legalNow,
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
        ? [
            {
              who: patient.generalPractitioner,
              role: "Recorded GP",
              note: "Contact details not recorded here",
              tone: null,
            },
          ]
        : [],
      ladder: "Current care and escalation arrangements are not recorded here.",
      next: [],
      transport: [["Transport", "No linked transport record displayed"]],
      transportNote: "Transport needs are not established by this patient identity record.",
      presentations: [],
      presentationsAbsent: "None recorded.",
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
        followUp: "Not recorded.",
      },
      documents: specialDocuments,
      documentsAbsent: specialDocuments.length > 0 ? "" : "No legal documents recorded.",
    };

    return {
      record: communityRecord,
      livePatient: patient,
      stays: patientAdmissions,
      displayName: patientDisplayName(patient),
      preferredName: patient.preferredName,
      currentStageIndex: 0,
      legalNow,
    };
  }

  return undefined;
}
