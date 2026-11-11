import type { Admission, LeavingDestination } from "@/components/ward-management/ward-admissions";
import type { BedRelease } from "@/components/ward-management/ward-model-bed-release";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

/*
 * Item 18, "Left the ward, waiting for transport".
 *
 * A discharged person often waits hours on site for transport home while their bed sits empty.
 * The ward records "Left the ward": the ordinary departure, so the bed frees once through
 * `departAdmission` and is Ready at once (Josh: no cleaning step), plus
 * `Admission.waitingForTransport`, which keeps the person on the ward's "Waiting for transport"
 * list until "Collected" (`MARK_TRANSPORT_COLLECTED`). They never drop off every list while on site.
 *
 * The flag is `awaitingTransport` on `RECORD_LEAVING` and `RECORD_PATIENT_DISCHARGE`: the ordinary
 * departure, so the bed frees once through `departAdmission` and every screen agrees (D-115). It only
 * records `Admission.waitingForTransport` and skips "Being made ready", and is refused unless the
 * stay's discharge still has transport outstanding (`transportPendingFor`).
 *
 * Imports types only, so the reducer slices and the screens can share it.
 */

/**
 * The person who left the ward waiting for transport has been collected. Clears
 * `Admission.waitingForTransport`, so they leave the list. Moves no bed figure: the bed was freed
 * when they left the ward.
 */
export type MarkTransportCollectedEvent = {
  type: "MARK_TRANSPORT_COLLECTED";
  role: WardFlowRole;
  now: Instant;
  admissionId: string;
  /** Compared against the stay's own ward, as for `RECORD_LEAVING`. */
  actingUnitId: string;
};

/** The fixed blocker and waiting-on value that both say transport is still to come. */
const AWAITING_TRANSPORT = "Awaiting transport";

/**
 * Whether this occupied stay's discharge still has transport outstanding: its live release lists a
 * transport item still outstanding, or the release or the stay is held up or waiting on transport.
 * Read from the records only; never inferred from a destination or the time.
 */
export function transportPendingFor(admission: Admission, bedReleases: readonly BedRelease[]): boolean {
  if (admission.state !== "occupied") return false;
  if (admission.blockReason === AWAITING_TRANSPORT) return true;
  return bedReleases.some((release) => release.admissionId === admission.id && releaseTransportPending(release));
}

/** Whether this live release still has transport outstanding, from its own fields only. */
export function releaseTransportPending(release: BedRelease): boolean {
  return (
    release.state !== "discharged" &&
    (release.waitingOn === AWAITING_TRANSPORT ||
      release.blocker === AWAITING_TRANSPORT ||
      (release.dependencies ?? []).some(
        (dependency) => dependency.kind === "transport" && dependency.state === "outstanding",
      ))
  );
}

export type WaitingForTransportEntry = {
  readonly admissionId: string;
  readonly unitId: string;
  readonly since: number;
};

/**
 * Everyone who has left the ward and is still waiting for transport, on one ward or (with no ward)
 * everywhere. Oldest wait first: an order by time on the record, never a ranking of anyone.
 */
export function waitingForTransport(admissions: readonly Admission[], unitId?: string): WaitingForTransportEntry[] {
  return admissions
    .filter(
      (admission) =>
        admission.state === "departed" &&
        admission.waitingForTransport !== undefined &&
        (unitId === undefined || admission.unitId === unitId),
    )
    .map((admission) => ({
      admissionId: admission.id,
      unitId: admission.unitId,
      since: admission.waitingForTransport!.since,
    }))
    .sort((a, b) => a.since - b.since || a.admissionId.localeCompare(b.admissionId));
}

/** The refusal both departure paths give when "Left the ward" is asked for without transport pending. */
const LEFT_WARD_NEEDS_TRANSPORT =
  "Left the ward is for a discharge still waiting on transport. Record the departure with They have left instead";

/** The refusal when "Left the ward" is asked for someone who did not return: they are not on site. */
const LEFT_WARD_NOT_ON_SITE =
  "Left the ward, waiting for transport, is for someone still on site. Someone who did not return is not waiting for transport";

/** Destinations that cannot be waiting on site for transport. */
const NOT_ON_SITE: readonly LeavingDestination[] = ["did-not-return"];

/** Whether "Left the ward, waiting for transport" may be offered with this destination. */
export function leftWardAllowedFor(destination: LeavingDestination): boolean {
  return !NOT_ON_SITE.includes(destination);
}

/**
 * Why "Left the ward, waiting for transport" is refused for this departure, or null when it may be
 * recorded. Both departure paths (`RECORD_LEAVING` and `RECORD_PATIENT_DISCHARGE`) ask this.
 */
export function leftWardRefusal(
  admission: Admission,
  bedReleases: readonly BedRelease[],
  destination: LeavingDestination,
): string | null {
  if (!leftWardAllowedFor(destination)) return LEFT_WARD_NOT_ON_SITE;
  if (!transportPendingFor(admission, bedReleases)) return LEFT_WARD_NEEDS_TRANSPORT;
  return null;
}
