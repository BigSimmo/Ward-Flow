import type { Admission } from "@/components/ward-management/ward-admissions";
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
  return bedReleases.some(
    (release) =>
      release.admissionId === admission.id &&
      release.state !== "discharged" &&
      (release.waitingOn === AWAITING_TRANSPORT ||
        release.blocker === AWAITING_TRANSPORT ||
        (release.dependencies ?? []).some(
          (dependency) => dependency.kind === "transport" && dependency.state === "outstanding",
        )),
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
export const LEFT_WARD_NEEDS_TRANSPORT =
  "Left the ward is for a discharge still waiting on transport. Record the departure with They have left instead";
