// The ward screen's pure derivations: the alerts its Home tab lists and the bed roster its board
// draws. Split out of `ward-screen.tsx` (18 October 2026) to keep that file under the line cap.

import type { PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { currentLegalDueAt, formProgression } from "@/components/ward-management/legal-forms/legal-form-progression";
import { typedTimeLine } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import { criteriaLedTileChip, dischargeCriteriaStatus } from "@/components/ward-management/ward-discharge-criteria";
import {
  daysInBed as admissionStayDays,
  isPastExpectedDischarge,
  stayBand,
} from "@/components/ward-management/ward-admissions";
import { bedHold as bedHoldOf } from "@/components/ward-management/ward-bed-hold";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import {
  calendarDateOf,
  dayOf,
  formatInstant,
  formatInstantWithDay,
  formatRemaining,
  minutesUntil,
} from "@/components/ward-management/ward-clock";
import { stageCopy } from "@/components/ward-management/ward-derivations";
import { deliveredAwaitingWard } from "@/components/ward-management/ward-stage-copy";
import { tentativeDiagnosisPhrase } from "@/components/ward-management/ward-diagnosis";
import { admissionCriteriaEligibility, admissionLegalStatus } from "@/components/ward-management/ward-flow-reducer";
import {
  LEAVE_BED_OPEN_WARNING_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";
import { patientAgeYears } from "@/components/ward-management/ward-patients";
import { WARD_LOCKED_BED_SPLITS } from "@/components/ward-management/ward-sites";
import { layoutBedNumbers, wardStaySeats } from "./ward-bed-layout";
import { activeClosedBeds } from "@/components/ward-management/ward-ready-beds";
import { arrivalIsLate, originPlaceLabel } from "./ward-screen-helpers";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { BedRelease, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";
import type { PatientResolutionSubject, ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import type { Patient } from "@/components/ward-management/ward-patients";
import type { WardReferralInboxEntry } from "@/components/ward-management/referrals/referral-inbox";
import type { DueSoonThresholds } from "@/components/ward-management/ward-clock";
import { isConstantObservation } from "@/components/ward-management/ward-observation";

/** The bed roster the Bed board and bed list draw, derived from this ward's records. */
type WardBedRosterInputs = {
  unit: Unit;
  unitLeaveBeds: LeaveBed[];
  admissions: Admission[];
  bedReleases: BedRelease[];
  states: BedStateCounts;
  accepted: Movement[];
  movements: Movement[];
  resolvePatientIdentity: (subject: PatientResolutionSubject) => ResolvedPatientInfo;
  now: number;
  criteriaLedOn: boolean;
  patients: Patient[];
  /** The arrived booking still names an older converted stay's legal status (review: CodeRabbit). */
  plannedAdmissions?: PlannedAdmission[];
  dayZero: Date;
  wardReferralInbox: (unitId: string) => WardReferralInboxEntry[];
};

/** The open movement whose pull created this admission's bed: either side may carry the link. */
function pulledBy(movement: Movement, admission: Admission): boolean {
  return movement.id === admission.movementId || movement.admissionId === admission.id;
}

export function wardBedRoster({
  unit,
  unitLeaveBeds,
  admissions,
  bedReleases,
  states,
  accepted,
  movements,
  resolvePatientIdentity,
  now,
  criteriaLedOn,
  patients,
  plannedAdmissions,
  dayZero,
  wardReferralInbox,
}: WardBedRosterInputs) {
  // Derive bed roster & telemetry for Bed Board matrix
  // D-21 items 4A & 6A: HDU left off; show real recorded bed designations from WARD_LOCKED_BED_SPLITS.
  const lockedBeds = unit.lockedBeds ?? WARD_LOCKED_BED_SPLITS[unit.id] ?? 0;
  const openBedsCount = Math.max(0, unit.beds - lockedBeds);
  const isMixed = lockedBeds > 0 && openBedsCount > 0;

  // Josh, 26 Sept 2026 ("go ahead with all your recommendations"): a bed reads "On leave" only for
  // the admission this ward's OWN leave records actually name — never whichever occupied
  // admission happened to sit first by position. `leaveAdmissionIds` is that ward-scoped set
  // (`unitLeaveBeds` is already filtered to `unit.id` above), and `otherOccupants` is every
  // occupied admission EXCEPT those — so nobody with a leave record is ever also handed an
  // ordinary "occupied" bed slot elsewhere on the same board. The leave slots below are built
  // straight from `unitLeaveBeds` itself, one bed per record, so the number of "On leave" beds can
  // never drift from the number of leave records — there is no separate count to keep in step.
  const leaveAdmissionIds = new Set(unitLeaveBeds.map((leaveBed) => leaveBed.admissionId));
  const unitOccupantAdmissions = admissions?.filter((a) => a.unitId === unit.id && a.state === "occupied") ?? [];
  const otherOccupants = unitOccupantAdmissions.filter((a) => !leaveAdmissionIds.has(a.id));
  const unitPulledAdmissions = admissions?.filter((a) => a.unitId === unit.id && a.state === "pulled") ?? [];
  let otherOccupantCursor = 0;
  // Audit 1, CS-01 (20 Oct 2026): each pulled bed belongs to a pulled admission, named by the open
  // movement that admission belongs to. Never by place in `accepted`: that list also holds referrals
  // accepted with no bed pulled, and one sitting first used to take a held bed's name and timer.
  // Pulled beds keep the order of their movements in `accepted`; seeded ones with none come last.
  const acceptedRank = (admission: Admission) => {
    const rank = accepted.findIndex((movement) => pulledBy(movement, admission));
    return rank < 0 ? accepted.length : rank;
  };
  const pulledSlots = [...unitPulledAdmissions]
    .sort((left, right) => acceptedRank(left) - acceptedRank(right))
    .map((admission) => ({ admission, movement: accepted.find((movement) => pulledBy(movement, admission)) }));
  // A4-24: a vacated bed reads "Being made ready" until someone taps Ready. Each marker belongs to
  // one discharged release, oldest first; the tile it sits on is chosen once bed numbers are known
  // (below), so Ready on a bed clears that bed's own release.
  const preparingReleases = bedReleases
    .filter((r) => r.unitId === unit.id && r.state === "discharged" && r.preparing)
    .sort((left, right) => left.confirmedAt - right.confirmedAt);

  const rawBeds = Array.from({ length: unit.beds }, (_, i) => {
    const bedNumber = i + 1;
    const designation: "Locked" | "Open" | undefined = isMixed ? (i < lockedBeds ? "Locked" : "Open") : undefined;
    const podId = isMixed ? (i < lockedBeds ? "locked" : "open") : "all";
    const podLabel = isMixed ? `${unit.name} ${designation} Beds` : unit.name;
    const isHdu = false;

    // v10 "counts agree": the tiles follow the ruled four bed states (`bedStates`), the same
    // partition the hero, the key and the bed figures count. Ready first, then each leave record,
    // then the pulled beds, the occupied beds, and the closed beds last.
    const leaveSlotIndex = i - states.ready;
    const isLeaveSlot = leaveSlotIndex >= 0 && leaveSlotIndex < unitLeaveBeds.length;
    const pulledSlotIndex = i - states.ready - unitLeaveBeds.length;
    const isIncomingSlot = !isLeaveSlot && pulledSlotIndex >= 0 && pulledSlotIndex < states.pulled;
    const isClosedSlot = i >= unit.beds - states.closed && !isLeaveSlot && !isIncomingSlot && i >= states.ready;

    let status: "ready" | "occupied" | "leave" | "incoming" | "closed" = "occupied";
    let statusText = "Inpatient";
    if (i < states.ready) {
      status = "ready";
      statusText = "Ready";
    } else if (isLeaveSlot) {
      status = "leave";
      // D-38: a bed held for an absence without leave is never shown as approved leave.
      statusText = unitLeaveBeds[leaveSlotIndex].absentWithoutLeave ? "Absent without leave" : "On leave";
    } else if (isIncomingSlot) {
      status = "incoming";
      statusText = "Pulled";
    } else if (isClosedSlot) {
      status = "closed";
      statusText = "Closed";
    }

    const pulledSlot = isIncomingSlot ? pulledSlots[pulledSlotIndex] : undefined;
    const incomingMovement = pulledSlot?.movement;
    // A pulled bed with no live movement is a seeded pull: name the pulled admission itself.
    const pulledAdmission = pulledSlot && incomingMovement === undefined ? pulledSlot.admission : undefined;
    // The person shown "On leave" is whoever THIS leave record names, found by its own
    // `admissionId` — never by position. (Should the named admission ever not be among this
    // ward's occupied admissions, the slot is correctly left empty rather than borrowing someone
    // else's identity.)
    const leaveAdmission = isLeaveSlot
      ? unitOccupantAdmissions.find((a) => a.id === unitLeaveBeds[leaveSlotIndex].admissionId)
      : undefined;
    // An incoming referral has not been admitted to this ward yet, so it has no admission of its
    // own here — never one borrowed from whichever occupied admission next came up by position.
    // That borrowing used to hand an inbound person somebody else's length-of-stay and
    // specialling flag; each bed now shows only the facts that belong to the person shown in it.
    const admission: (typeof unitOccupantAdmissions)[number] | undefined =
      status === "leave"
        ? leaveAdmission
        : status === "occupied"
          ? otherOccupants[otherOccupantCursor++]
          : status === "incoming"
            ? pulledAdmission
            : undefined;
    const linkedMovement =
      incomingMovement ??
      (admission
        ? movements.find(
            (m) =>
              (admission.movementId !== null && m.id === admission.movementId) ||
              (admission.referralId !== null && m.referralId === admission.referralId),
          )
        : undefined);
    const recordedSubject = linkedMovement ?? admission;
    const patientInfo =
      status === "ready" || status === "closed" || recordedSubject === undefined
        ? undefined
        : resolvePatientIdentity(recordedSubject);
    const patientAlias = status === "ready" || status === "closed" ? undefined : patientInfo?.formalName;
    const stayDays = admission && status !== "incoming" ? admissionStayDays(admission, now) : null;
    const daysInBed = stayDays === null ? undefined : `${stayDays}d`;
    const isSpecialling = admission ? isConstantObservation(admission.observation) : false;

    // D-64, behind the criteria led discharge flag: the Legal tile reads the same records as the
    // criteria card, so the two agree. With the flag off the tile is unchanged.
    const recordLegalStatus =
      criteriaLedOn && admission
        ? admissionLegalStatus({ movements, patients, plannedAdmissions }, admission)
        : undefined;
    const patientLegalStatus = recordLegalStatus ?? linkedMovement?.legalStatus;
    const criteriaLedChip =
      criteriaLedOn && admission?.state === "occupied"
        ? criteriaLedTileChip(
            dischargeCriteriaStatus(
              admission.dischargeCriteria,
              admissionCriteriaEligibility({ movements, patients, plannedAdmissions }, admission),
              now,
            ),
          )
        : null;
    // The movement's form only describes the status when that status came from the movement.
    const patientLegalForm =
      recordLegalStatus === undefined || recordLegalStatus === linkedMovement?.legalStatus
        ? linkedMovement?.legalForm
        : undefined;
    // WT-03 (walk-through, 26 Oct 2026): a form the examination or arrival moved on from is not the
    // stay's authority, so the card names the form still to record, as the person page does.
    const progression = patientLegalForm ? formProgression(linkedMovement) : undefined;
    const legalStatusLabel = progression
      ? `Form ${progression.nextCode} not recorded (Form ${progression.endedCode} ended ${progression.endedWhen})`
      : patientLegalForm
        ? `Form ${patientLegalForm.code}${patientLegalStatus ? ` ${patientLegalStatus}` : ""}`
        : patientLegalStatus;

    const stayBandObj = admission && stayDays !== null ? stayBand(admission, now) : null;
    const isPastDate = admission ? isPastExpectedDischarge(admission, now) : false;
    const awayHours =
      admission?.awayAtEmergencyDepartmentSince != null
        ? Math.max(0, Math.floor((now - admission.awayAtEmergencyDepartmentSince) / 60))
        : null;
    const expDays =
      admission?.expectedDischargeAt != null && Number.isFinite(admission.expectedDischargeAt)
        ? dayOf(admission.expectedDischargeAt) - dayOf(now)
        : null;
    const tentDiag = admission?.tentativeDiagnosis
      ? (tentativeDiagnosisPhrase(admission.tentativeDiagnosis) ?? undefined)
      : undefined;
    // TC-07 (H-0776): the age is read on the board's own day. `dayZero` is always passed, so there is
    // no real-date fallback here: a demo jumped past a birthday shows the age on the demo day.
    const patientAge = patientInfo?.patient ? patientAgeYears(patientInfo.patient, calendarDateOf(now, dayZero)) : null;
    const patientSex = patientInfo?.patient?.sex ?? patientInfo?.genderOrSex ?? null;
    const patientHomeRegion = admission?.homeRegion ?? null;

    const releaseBlocker = bedReleases.find(
      (r) => r.admissionId === admission?.id && r.state !== "discharged",
    )?.blocker;

    const patient = patientInfo?.patient;
    const expectedDischargeLabel =
      admission?.expectedDischargeAt != null && Number.isFinite(admission.expectedDischargeAt)
        ? formatInstantWithDay(admission.expectedDischargeAt, now)
        : null;

    return {
      bedNumber,
      bedLabel: `Bed ${String(bedNumber).padStart(2, "0")}`,
      podId,
      podLabel,
      designation,
      isHdu,
      status,
      statusText,
      patientAlias,
      patientInfo,
      umrn: patientInfo?.umrn,
      daysInBed,
      stayDays,
      stayBand: stayBandObj?.label,
      pastDate: isPastDate,
      awayAtEdHours: awayHours,
      expectedDays: expDays,
      tentativeDiagnosis: tentDiag,
      blockReason: releaseBlocker ?? admission?.blockReason ?? undefined,
      dischargeBarrier: admission?.dischargeBarrier ?? undefined,
      isSpecialling,
      observation: admission?.observation,
      legalStatus: patientLegalStatus,
      legalForm: patientLegalForm,
      legalStatusLabel,
      criteriaLedChip,
      admissionId: admission?.id,
      // Audit 24-1, B-02: the pulled admission this slot belongs to, linked from either side
      // (`pulledBy`). Matching `movementId` alone missed a pull its movement names, so that tile had
      // no seat and moved bed when another pulled bed ended.
      stayAdmissionId: admission?.id ?? pulledSlot?.admission.id,
      heldFor: undefined as string | undefined,
      preparing: false,
      /** The discharged release this bed is being made ready for, set once bed numbers are known. */
      preparingReleaseId: undefined as string | undefined,
      age: patientAge,
      sex: patientSex,
      homeRegion: patientHomeRegion,
      preferredName: patient?.preferredName,
      gender: patient?.gender,
      suburb: patient?.suburb,
      generalPractitioner: patient?.generalPractitioner,
      catchmentCommunityTeam: patient?.catchmentCommunityTeam,
      highAcuity: admission?.highAcuity === true,
      dischargeDateMoves: admission ? admission.dischargeDateMoves : null,
      dischargeConfirmed: admission ? admission.dischargeConfirmedAt != null : null,
      dischargeConfirmedBy: admission?.dischargeConfirmedBy ?? null,
      expectedDischargeLabel,
      // Audit A1-3: a pulled bed carries its hold, so a lapsed hold reaches the ward's Act now.
      // WT-07: Delivered stops the pull clock; the bed then awaits the ward's arrival check.
      bedHold:
        status === "incoming" && !(linkedMovement && deliveredAwaitingWard(linkedMovement))
          ? bedHoldOf(linkedMovement?.pullExpiresAt, now)
          : undefined,
      deliveredAt:
        status === "incoming" && linkedMovement && deliveredAwaitingWard(linkedMovement)
          ? linkedMovement.transport?.arrivedAt
          : undefined,
    };
  });

  // v10 pass 3, Bed board: a bed held for an accepted referral (`heldBedNumber`) and a stay placed
  // in a numbered bed (`PLACE_IN_BED`) sit in that bed; every other tile keeps its place.
  // Read from this ward's own inbox projection (FD-23), never the full referrals array.
  const inboxEntries = wardReferralInbox?.(unit.id) ?? [];
  const heldBeds = [
    ...inboxEntries.flatMap((entry) =>
      entry.state === "accepted" && entry.heldBedNumber !== undefined
        ? [
            {
              bed: entry.heldBedNumber,
              name: resolvePatientIdentity(entry).formalName,
            },
          ]
        : [],
    ),
    // v10 pass 3: a coordinator-sent person this ward accepted into a numbered bed.
    ...accepted.flatMap((movement) =>
      movement.heldBedNumber !== undefined && movement.stage !== "moving"
        ? [
            {
              bed: movement.heldBedNumber,
              name: resolvePatientIdentity(movement).formalName,
            },
          ]
        : [],
    ),
  ];
  const recordedBeds = new Map(
    (admissions ?? []).flatMap((admission) =>
      admission.unitId === unit.id && admission.bedNumber !== undefined ? [[admission.id, admission.bedNumber]] : [],
    ) as [string, number][],
  );
  // Audit A1-1: every stay keeps a fixed bed, so a departure or absence never renumbers others.
  // Audit 24-1 CS2-03: a released pull's span still held its bed, so later stays keep theirs.
  // H-0978: no stay is seated in a bed closed by number. The reducer reads the same seats.
  const seatedBeds = wardStaySeats(unit, admissions ?? []);
  // H-0978 / WS-15 (Josh 26 Oct 2026, "close the exact bed"): a bed closed by number is counted in
  // Closed by `bedStates`, and the layout puts its own number on a Closed tile.
  const bedNumbers = layoutBedNumbers(
    rawBeds.map((bed) => ({
      stayAdmissionId: bed.stayAdmissionId,
      free: bed.status === "ready",
      closed: bed.status === "closed",
    })),
    (admissionId) => recordedBeds.get(admissionId),
    heldBeds.map((held) => held.bed),
    (admissionId) => seatedBeds.get(admissionId),
    activeClosedBeds(unit).map((mark) => mark.bedNumber),
  );
  // A4-24: place each "Being made ready" marker on the bed its stay vacated when that bed is now a
  // ready tile, then any remaining markers on the lowest-numbered ready beds, oldest release first.
  // The tile then carries its own release, so Ready clears the bed the user opened.
  const readyBedNumbers = rawBeds.flatMap((bed, index) => (bed.status === "ready" ? [bedNumbers[index]] : []));
  const preparingByBed = new Map<number, string>();
  const unplacedReleases: string[] = [];
  for (const release of preparingReleases) {
    const vacated = recordedBeds.get(release.admissionId) ?? seatedBeds.get(release.admissionId);
    if (vacated !== undefined && readyBedNumbers.includes(vacated) && !preparingByBed.has(vacated)) {
      preparingByBed.set(vacated, release.id);
    } else {
      unplacedReleases.push(release.id);
    }
  }
  for (const bedNumber of [...readyBedNumbers].sort((left, right) => left - right)) {
    const releaseId = preparingByBed.has(bedNumber) ? undefined : unplacedReleases.shift();
    if (releaseId !== undefined) preparingByBed.set(bedNumber, releaseId);
  }
  const bedsList = rawBeds
    .map((bed, index) => {
      const bedNumber = bedNumbers[index];
      const preparingReleaseId = bed.status === "ready" ? preparingByBed.get(bedNumber) : undefined;
      const designation: "Locked" | "Open" | undefined = isMixed
        ? bedNumber <= lockedBeds
          ? "Locked"
          : "Open"
        : undefined;
      return {
        ...bed,
        bedNumber,
        bedLabel: `Bed ${String(bedNumber).padStart(2, "0")}`,
        designation,
        podId: isMixed ? (bedNumber <= lockedBeds ? "locked" : "open") : "all",
        podLabel: isMixed ? `${unit.name} ${designation} Beds` : unit.name,
        heldFor: bed.status === "ready" ? heldBeds.find((held) => held.bed === bedNumber)?.name : undefined,
        preparing: preparingReleaseId !== undefined,
        preparingReleaseId,
        statusText: preparingReleaseId !== undefined ? BED_STATE_LABELS.beingMadeReady : bed.statusText,
      };
    })
    .sort((left, right) => left.bedNumber - right.bedNumber);
  return { bedsList, inboxEntries, isMixed };
}

/** The live alerts the Home tab lists: referrals awaiting an answer, form due times, late arrivals and long leave. */
type WardLiveFormAlertsInputs = {
  incoming: Movement[];
  resolvePatientIdentity: (subject: PatientResolutionSubject) => ResolvedPatientInfo;
  accepted: Movement[];
  now: number;
  thresholds: DueSoonThresholds;
  overdueLeaveBeds: LeaveBed[];
  unit: Unit;
};

export function wardLiveFormAlerts({
  incoming,
  resolvePatientIdentity,
  accepted,
  now,
  thresholds,
  overdueLeaveBeds,
  unit,
}: WardLiveFormAlertsInputs) {
  const liveFormAlerts = [
    ...incoming.map((movement) => ({
      key: `incoming-${movement.id}`,
      tone: "warning" as const,
      title: "Referral awaiting this ward's answer",
      countdown: stageCopy[movement.stage].label,
      // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
      text: `${resolvePatientIdentity(movement).formalName} from ${originPlaceLabel(movement)}.`,
      actionLabel: "Answer",
      actionTarget: "answer" as const,
    })),
    ...accepted.flatMap((movement) => {
      const alerts: Array<{
        key: string;
        tone: "critical" | "warning" | "info";
        title: string;
        countdown: string;
        text: string;
        actionLabel: string;
        actionTarget: "arrival";
        movementId: string;
      }> = [];
      const patientName = resolvePatientIdentity(movement).formalName;
      const dueAt = currentLegalDueAt(movement);
      if (dueAt !== undefined) {
        const remaining = minutesUntil(dueAt, now);
        alerts.push({
          key: `form-${movement.id}`,
          tone: remaining <= thresholds.urgentMinutes ? "critical" : "warning",
          title: movement.legalForm ? `Form ${movement.legalForm.code} recorded due time` : "Legal form due",
          // Legal times only as typed (31 Oct 2026): "Ends 15:42 as typed", never "1h 15m left".
          countdown: typedTimeLine(dueAt, now),
          // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
          text: `${patientName}: recorded due ${formatInstantWithDay(dueAt, now)}.`,
          actionLabel: "Open arrival",
          actionTarget: "arrival",
          movementId: movement.id,
        });
      }
      if (arrivalIsLate(movement, now) && movement.arrivalDetails?.estimatedArrivalAt !== undefined) {
        alerts.push({
          key: `late-${movement.id}`,
          tone: "warning",
          title: "Estimated arrival time has passed",
          countdown: "Not arrived yet",
          text: `${patientName} was expected at ${formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt, now)} and has not arrived.`,
          actionLabel: "Open arrival",
          actionTarget: "arrival",
          movementId: movement.id,
        });
      }
      return alerts;
    }),
    ...overdueLeaveBeds.map((leaveBed) => ({
      key: `leave-${leaveBed.id}`,
      tone: "info" as const,
      title: `Leave bed open more than ${LEAVE_BED_OPEN_WARNING_MINUTES / 60} hours (${OPERATIONAL_DEFAULT_LABEL})`,
      countdown: formatRemaining(now - leaveBed.confirmedAt),
      text: leaveBed.absentWithoutLeave
        ? `A bed held for an absence without leave at ${unit.name} is still recorded. Absent since ${formatInstantWithDay(leaveBed.absentWithoutLeave.since, now)}.`
        : `A bed on leave at ${unit.name} is still recorded. Expected return ${formatInstant(leaveBed.expectedReturn)}.`,
      actionLabel: "Open discharges",
      actionTarget: "discharges" as const,
    })),
  ];
  return { liveFormAlerts };
}

/** One bed on the ward screen's roster. */
export type WardScreenBed = ReturnType<typeof wardBedRoster>["bedsList"][number];
