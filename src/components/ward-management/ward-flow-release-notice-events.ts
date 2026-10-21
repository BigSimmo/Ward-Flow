import type { AuditDecision } from "./ward-audit";
import type { Instant } from "./ward-clock";
import type { WardFlowRole } from "./ward-flow-roles";
import type { BedEventHelpers, findMovement, reject, replaceMovement, WardFlowState } from "./ward-flow-reducer";
import {
  ARRIVAL_CHECKS,
  SUPPORT_SERVICE_TYPES,
  type ArrivalCheck,
  type BedRelease,
  type Movement,
  type SupportServiceType,
} from "./ward-model";

/**
 * #398 and the arrival checklist (D-72, 21 Oct 2026): the two recorded events that let the
 * discharge support card say "Sent" and the arrival checklist say "Done". Neither carries typed
 * text.
 *
 * The reducer passes its helpers in, since this file may not import the reducer at run time.
 */

/**
 * The ward sends a pharmacy, transport or cleaning notice for a confirmed bed release, so the
 * discharge card may say "Sent". Ward-scoped: a ward sends only for its own release. Refused when
 * the release is no longer confirmed or that service was already notified. Part of `WardFlowEvent`,
 * declared here beside its case so `ward-flow-events.ts` stays under its line cap.
 */
export type ReleaseNoticeEvent = {
  type: "SEND_RELEASE_SUPPORT_NOTICE";
  role: WardFlowRole;
  now: Instant;
  releaseId: string;
  service: SupportServiceType;
  /** The ward sending it. Required, and must be the release's own ward. */
  actingUnitId: string;
};

/**
 * The emergency department records an arrival checklist item, the pre-transfer contraband search
 * or the medication chart for the receiving ward. Writes `Movement.contrabandSearchDone` or
 * `Movement.medicationChartDone`. `done: false` takes a mistaken tick back. Part of `WardFlowEvent`.
 */
export type ArrivalCheckEvent = {
  type: "RECORD_ARRIVAL_CHECK";
  role: WardFlowRole;
  now: Instant;
  movementId: string;
  check: ArrivalCheck;
  done: boolean;
};

const SERVICE_NAMES: Record<SupportServiceType, string> = {
  pharmacy: "Pharmacy",
  transport: "Transport",
  cleaning: "Cleaning",
};

export function reduceReleaseNoticeEvent(
  state: WardFlowState,
  event: ReleaseNoticeEvent,
  decision: AuditDecision,
  { findBedRelease, findUnit, reject, replaceBedRelease }: BedEventHelpers,
): WardFlowState {
  const release = findBedRelease(state, event.releaseId);
  if (!release) return reject(state, event, "This discharge is no longer on the board, so no notice was sent.");
  // Claim, not proof, as CLEAR_BED_RELEASE_BLOCK: a ward sends only for its own release.
  if (event.actingUnitId !== release.unitId) {
    const owner = findUnit(state, release.unitId)?.name ?? "another ward";
    return reject(state, event, `This discharge belongs to ${owner}. Only that ward can send its notices.`);
  }
  // Chosen, never typed: the runtime half of the union-type check, for an untyped caller.
  if (!SUPPORT_SERVICE_TYPES.includes(event.service)) {
    return reject(state, event, "Choose pharmacy, transport or cleaning for the notice.");
  }
  if (release.state !== "confirmed") {
    return reject(state, event, "This discharge is no longer confirmed, so no notice was sent.");
  }
  const sent = release.supportNoticesSent ?? [];
  if (sent.some((notice) => notice.service === event.service)) {
    return reject(state, event, `${SERVICE_NAMES[event.service]} has already been notified for this discharge.`);
  }
  decision.outcome = "accepted";
  decision.reasonCode = "none";
  const updated: BedRelease = {
    ...release,
    supportNoticesSent: [...sent, { service: event.service, at: event.now, by: event.role }],
  };
  return replaceBedRelease(state, release.id, updated);
}

export type ArrivalCheckHelpers = {
  findMovement: typeof findMovement;
  reject: typeof reject;
  replaceMovement: typeof replaceMovement;
};

export function reduceArrivalCheckEvent(
  state: WardFlowState,
  event: ArrivalCheckEvent,
  decision: AuditDecision,
  { findMovement, reject, replaceMovement }: ArrivalCheckHelpers,
): WardFlowState {
  const movement = findMovement(state, event.movementId);
  if (!movement) return reject(state, event, "This patient is no longer on the list, so nothing was recorded.");
  if (movement.closure) return reject(state, event, "This movement is closed, so nothing was recorded.");
  if (!ARRIVAL_CHECKS.includes(event.check)) {
    return reject(state, event, "Choose the contraband search or the medication chart.");
  }
  if (typeof event.done !== "boolean") return reject(state, event, "Say whether the check is done.");
  const field = event.check === "contraband_search" ? "contrabandSearchDone" : "medicationChartDone";
  if (movement[field] === event.done) {
    return reject(state, event, event.done ? "This check is already recorded as done." : "This check is not recorded.");
  }
  decision.outcome = "accepted";
  decision.reasonCode = "none";
  const updated: Movement = { ...movement, [field]: event.done };
  return replaceMovement(state, movement.id, updated);
}
