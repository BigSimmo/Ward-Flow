import type { WfTone } from "@/components/wf";
import type { BedRelease, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import {
  dayOf,
  type DueSoonThresholds,
  formatInstant,
  formatInstantWithDay,
  perthDateLabel,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import { transportNeedState } from "@/components/ward-management/ward-derivations-transport";
import { bedHold, pulledWithoutLimitLabel } from "@/components/ward-management/ward-bed-hold";
import { isHeldUpDueByTomorrow } from "@/components/ward-management/ward-held-up";
import { heldUntilExtendedLabel } from "@/components/ward-management/ward-bed-hold-extension";
import { deliveredAwaitingWard, movementStatusLabel } from "@/components/ward-management/ward-stage-copy";
import { originName } from "@/components/ward-management/ward-movement-origin";
import type { BedItem } from "./ward-bed-tone";
import { pullBlockedReason } from "./ward-pull-blocked";
import { wardDischargesDueToday, wardFlowReleaseGroup } from "./ward-home-tab-model";

/*
 * Wave 4 (D-191, 13 Nov 2026): the rows of Ward home's "Coming and going" part, built from the same
 * records Ward flow listed. Every row names the person and the bed (notes 3). No count here is a new
 * rule: held up, past date and discharges today use the selectors the page already had (PR C owns
 * the "by tomorrow" and "still due today" windows).
 */

type ComingRowAction = "pull" | "confirm-arrival" | null;

export type ComingRow = {
  key: string;
  /** Surname first, as recorded; the bed's label when nobody is named. */
  name: string;
  /** Arrivals: the legal tag as recorded ("Form 3B", "Voluntary"), ruling 12. Absent when none is recorded. */
  tag?: string;
  /** The movement the row acts on (arrivals only). */
  movementId?: string;
  /** Ward desk: a pull row also offers Confirm arrival (ruling 11: the pull comes first). */
  alsoArrive?: boolean;
  /** The bed this row opens (needs a look, back from leave). */
  bedNumber?: number;
  lines: string[];
  /** A quiet last line in ink-3 ("Date not recorded"). */
  quietLine?: string;
  when?: string;
  tone: WfTone;
  action: ComingRowAction;
  /** Why the action cannot run now; the button stays, greyed, with this reason. */
  blocked?: string;
  /** Arrivals: true when a bed is pulled for this person at this ward. */
  hasPulledBed?: boolean;
};

const bedWord = (bed: BedItem | undefined) => (bed ? `Bed ${String(bed.bedNumber).padStart(2, "0")}` : undefined);

/** The bed pulled for an accepted person at this ward, if any. */
function pulledBedFor(movement: Movement, beds: readonly BedItem[]): BedItem | undefined {
  const admissionId = (movement as { admissionId?: string }).admissionId;
  return beds.find(
    (bed) =>
      bed.status === "incoming" &&
      ((admissionId !== undefined && (bed.stayAdmissionId === admissionId || bed.admissionId === admissionId)) ||
        bed.movementId === movement.id),
  );
}

/** When this person is expected at the ward: the recorded ETA, else the transport's, else the planned move time. */
function expectedArrivalAt(movement: Movement): Instant | undefined {
  return movement.arrivalDetails?.estimatedArrivalAt ?? movement.transport?.estimatedAt ?? movement.plannedMoveAt;
}

/**
 * Ruling 9 (D-191), review F-3: "Arrivals · today" counts only people expected at the ward today.
 * A person whose recorded expected time (ETA, transport ETA or planned move time) is on a later day
 * is left out. A late arrival (expected before today, not yet arrived) and a person with no expected
 * time recorded stay in: nothing on the record places them on another day. Hero and list read this one rule.
 */
export function arrivalsExpectedToday<T extends Movement>(accepted: readonly T[], now: Instant): T[] {
  return accepted.filter((movement) => {
    const at = expectedArrivalAt(movement);
    return at === undefined || dayOf(at) <= dayOf(now);
  });
}

/** Ruling 12 (D-191): the legal tag as recorded, in the Fixes wording ("Form 3B", else "Voluntary"). */
export function arrivalLegalTag(movement: Movement): string {
  // The chip every other legal tag uses, so a ruling on what it says (D-187 item 4: status and form
  // together) reaches the Arrivals rows too.
  return legalStatusShort(movement);
}

/**
 * Notes 4 (F-41): the transport line read from the transport record. `quiet` lines are said in ink-3:
 * "No transport booked" before a bed is pulled or held, "Transport not recorded" after.
 */
export function arrivalTransportLine(movement: Movement, now: Instant): { text: string; quiet: boolean } {
  const leg = movement.transport;
  if (leg && leg.cancelledAt === undefined) {
    const step =
      leg.arrivedAt !== undefined
        ? `arrived ${formatInstantWithDay(leg.arrivedAt, now)}`
        : leg.collectedAt !== undefined
          ? `collected ${formatInstantWithDay(leg.collectedAt, now)}`
          : "booked";
    return { text: `${leg.provider} · ${step}`, quiet: false };
  }
  if (transportNeedState(movement) === "not_needed") return { text: "No transport needed", quiet: false };
  const beforeTravel = movement.stage === "accepted_awaiting_bed" || movement.stage === "pulled";
  return { text: beforeTravel ? "No transport booked" : "Transport not recorded", quiet: true };
}

/** Arrivals · today: accepted people for this ward (ETA and hold words as Ward flow had them). */
export function arrivalRows({
  accepted,
  beds,
  unit,
  now,
  nameOf,
  desk,
  thresholds,
}: {
  accepted: readonly Movement[];
  beds: readonly BedItem[];
  unit: Unit;
  now: Instant;
  nameOf: (movement: Movement) => string;
  /** "ward" is the ward desk; any other desk sees Pull the bed only. */
  desk: string;
  /** Audit L3, D-MCA (Josh, 14 Nov 2026): the Settings due-time warnings the pull hold reads. */
  thresholds?: DueSoonThresholds;
}): ComingRow[] {
  return accepted.map((movement): ComingRow => {
    const name = nameOf(movement);
    const awaitingBed = movement.stage === "accepted_awaiting_bed";
    const bed = awaitingBed ? undefined : pulledBedFor(movement, beds);
    const eta = movement.arrivalDetails?.estimatedArrivalAt;
    const late = eta !== undefined && eta < now && !deliveredAwaitingWard(movement);
    const hold = movement.stage === "pulled" ? bedHold(movement.pullExpiresAt, now, thresholds) : null;
    const blocked = awaitingBed ? pullBlockedReason(movement, unit, name) : undefined;
    const stageWords =
      blocked ??
      (hold?.state === "lapsed"
        ? hold.label
        : late
          ? "Late"
          : hold
            ? (heldUntilExtendedLabel(movement, now) ?? hold.label)
            : (pulledWithoutLimitLabel(movement) ?? movementStatusLabel(movement)));
    const first = [originName(movement), stageWords, bedWord(bed)].filter(Boolean).join(" · ");
    const transport = arrivalTransportLine(movement, now);
    const noBed = awaitingBed ? "No bed pulled" : bed ? undefined : "Bed not recorded";
    const quiet = [noBed, transport.quiet ? transport.text : undefined].filter(Boolean).join(" · ");
    return {
      key: movement.id,
      movementId: movement.id,
      name,
      tag: arrivalLegalTag(movement),
      lines: transport.quiet ? [first] : [first, transport.text],
      quietLine: quiet || undefined,
      when: eta === undefined ? undefined : `${late ? "Due" : "ETA"} ${formatInstantWithDay(eta, now)}`,
      tone: hold?.state === "lapsed" ? "danger" : late || hold?.state === "at-risk" ? "warning" : "info",
      action: awaitingBed ? "pull" : desk === "ward" ? "confirm-arrival" : null,
      blocked,
      alsoArrive: awaitingBed && desk === "ward" && blocked === undefined,
      hasPulledBed: bed !== undefined,
    };
  });
}

/** People on approved leave, due back: named by their bed's occupant. */
export function leaveRows(leave: readonly LeaveBed[], beds: readonly BedItem[], now: Instant): ComingRow[] {
  return leave.map((leaveBed): ComingRow => {
    const bed = beds.find((item) => item.admissionId === leaveBed.admissionId);
    return {
      key: `leave-${leaveBed.id}`,
      name: bed?.patientAlias ?? bed?.bedLabel ?? "Bed on leave",
      bedNumber: bed ? Number(bed.bedNumber) : undefined,
      lines: [[bedWord(bed), "on approved leave"].filter(Boolean).join(" · ")],
      when: formatInstantWithDay(leaveBed.expectedReturn, now),
      tone: "neutral",
      action: null,
    };
  });
}

/** A row's time column: "14 Nov" (review FS-9), as Capacity's held-up rail says a date. */
type RowDateLabel = (at: Instant) => string;

/**
 * The time column of Needs a look and Discharges rows: the Perth date ("14 Nov") so the row does not
 * wrap on a phone; a time today keeps its clock face ("15:30"), as the leave rows do. With no day 0
 * (a store without one), the board's own words, as Capacity's held-up rail falls back.
 */
export function shortDateLabel(dayZero: Date | undefined, now: Instant): RowDateLabel {
  return (at) =>
    dayOf(at) === dayOf(now)
      ? formatInstant(at)
      : dayZero
        ? perthDateLabel(at, dayZero, { day: "numeric", month: "short" })
        : formatInstantWithDay(at, now);
}

/**
 * Needs a look · now: held up first (the page's held-up selector, today any date), then beds past
 * their date. A bed is listed once, but `pastDate` counts every bed past its date, held up or not, so
 * the figure says the same as the hero's "Past date" (notes 3, review FS-2). Dates read "14 Nov" (FS-9).
 */
export function needsALookRows(
  releases: readonly BedRelease[],
  beds: readonly BedItem[],
  now: Instant,
  dateOf: RowDateLabel = (at) => formatInstantWithDay(at, now),
): { rows: ComingRow[]; heldUp: number; pastDate: number; heldUpPastDate: number } {
  const byAdmission = (id: string | undefined) =>
    id === undefined ? undefined : beds.find((bed) => bed.admissionId === id);
  // D-191 item 5 (PR C): held up is due by tomorrow, as the page's other held-up counts read it.
  const held = [...releases]
    .filter((release) => isHeldUpDueByTomorrow(release, now))
    .sort((left, right) => left.expectedAt - right.expectedAt);
  const seen = new Set<string>();
  let heldUpPastDate = 0;
  const rows: ComingRow[] = held.map((release) => {
    const bed = byAdmission(release.admissionId);
    if (bed) seen.add(String(bed.bedNumber));
    // Review FS-2: a held-up bed past its date says both, so the rows add up to the group's note.
    const past = bed?.pastDate === true;
    if (past) heldUpPastDate += 1;
    return {
      key: `held-${release.id}`,
      name: bed?.patientAlias ?? bed?.bedLabel ?? "Name not recorded",
      bedNumber: bed ? Number(bed.bedNumber) : undefined,
      lines: [[bedWord(bed), "Held up", past ? "Past date" : null, release.blocker].filter(Boolean).join(" · ")],
      when: dateOf(release.expectedAt),
      tone: "danger",
      action: null,
    };
  });
  const allPast = beds.filter((bed) => bed.pastDate === true);
  const past = allPast.filter((bed) => !seen.has(String(bed.bedNumber)));
  for (const bed of past) {
    const expectedAt = typeof bed.expectedDischargeAt === "number" ? bed.expectedDischargeAt : undefined;
    const when = expectedAt !== undefined ? dateOf(expectedAt) : (bed.expectedDischargeLabel ?? undefined);
    rows.push({
      key: `past-${String(bed.bedNumber)}`,
      name: bed.patientAlias ?? bed.bedLabel,
      bedNumber: Number(bed.bedNumber),
      lines: [[bedWord(bed), "Past date", bed.criteriaLedChip?.label].filter(Boolean).join(" · ")],
      when,
      quietLine: when ? undefined : "Date not recorded",
      tone: "warning",
      action: null,
    });
  }
  return { rows, heldUp: held.length, pastDate: allPast.length, heldUpPastDate };
}

/** Discharges · today: the page's due-today selector (`wardDischargesDueToday`), named by bed and person. */
export function dischargeTodayRows(
  releases: readonly BedRelease[],
  beds: readonly BedItem[],
  now: Instant,
  dateOf: RowDateLabel = (at) => formatInstantWithDay(at, now),
): ComingRow[] {
  return wardDischargesDueToday(releases, now)
    .sort((left, right) => left.expectedAt - right.expectedAt)
    .map((release): ComingRow => {
      const bed = beds.find((item) => item.admissionId === release.admissionId);
      const group = wardFlowReleaseGroup(release, now);
      return {
        key: `out-${release.id}`,
        name: bed?.patientAlias ?? bed?.bedLabel ?? "Name not recorded",
        bedNumber: bed ? Number(bed.bedNumber) : undefined,
        lines: [
          [
            bedWord(bed),
            release.blocker
              ? `Held up · ${release.blocker}`
              : release.state === "confirmed"
                ? "Confirmed"
                : group === "past"
                  ? "Past date"
                  : "Expected",
          ]
            .filter(Boolean)
            .join(" · "),
        ],
        when: dateOf(release.expectedAt),
        tone: release.blocker ? "danger" : release.state === "confirmed" ? "success" : "neutral",
        action: null,
      };
    });
}

/** "Bed 07 freed 07:42": the latest discharge completed today, for the empty Discharges line. */
export function lastFreedToday(
  discharged: readonly BedRelease[],
  beds: readonly BedItem[],
  now: Instant,
): string | undefined {
  const today = discharged
    .filter((release) => release.confirmedAt !== undefined && dayOf(release.confirmedAt) === dayOf(now))
    .sort((left, right) => right.confirmedAt - left.confirmedAt)[0];
  if (!today) return undefined;
  const bed = beds.find((item) => item.preparingReleaseId === today.id || item.admissionId === today.admissionId);
  return `${bedWord(bed) ?? "A bed"} freed ${formatInstantWithDay(today.confirmedAt, now)}.`;
}
