/**
 * Notice steps the ward flow reducer shares: the notice id rule and gate (`makeNotice`,
 * `appendNotices`) and D-221's late-notice reconcile, kept out of `ward-flow-reducer.ts` for its
 * size limit. Imports only types from the reducer, so there is no runtime cycle.
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Addressee, Movement, Notice, NoticeKind } from "@/components/ward-management/ward-model";
import type { WardFlowState } from "./ward-flow-reducer";
import { replaceMovement } from "./ward-flow-state-records";
import { noticeSubject } from "./ward-flow-subject-id";
import { reconcileLateNotices, type LateNoticePlan } from "./ward-late-notices";
import { withoutRecordNumbers } from "./ward-patient-resolver";
import { withFreshIds } from "./ward-runtime-ids";

/**
 * Stable, non-random, derived from `(subject, kind, count)`, like `makeRejection`, to keep the
 * reducer pure.
 *
 * `count` is `state.notices.length` before the current event's notices are appended. An event
 * raising two notices gives each addressee its own `NoticeKind`, or the ids would collide and one
 * would be dropped.
 */
export function makeNotice(
  now: Instant,
  count: number,
  kind: NoticeKind,
  to: Addressee,
  about: Notice["about"],
  sentence: string,
): Notice {
  return {
    id: `notice-${noticeSubject(about)}-${kind}-${count}`,
    raisedAt: now,
    to,
    about,
    kind,
    // D-39: a notice says "this referral" or "this stay", never the record number. The ids stay in
    // `about` for the link.
    sentence: withoutRecordNumbers(sentence),
    readAt: undefined,
  };
}

/**
 * The one gate every notice passes through before reaching `state.notices`, and where `demo` is
 * refused (addendum §1.2: "`demo` … must never receive a notice… refuse it in the reducer, not in a
 * screen").
 *
 * Silently drops a `demo`-addressed notice rather than rejecting the event: the underlying decision
 * is real and already recorded; only the courtesy notice is refused. Never touches
 * `state.rejections`. Exported so `tests/ward-notices.test.ts` can exercise the drop branch
 * directly, since no public dispatch can construct such a notice.
 */
export function appendNotices(state: WardFlowState, notices: readonly Notice[]): WardFlowState {
  const wanted = notices.filter((notice) => notice.to.role !== "demo");
  if (wanted.length === 0) return state;
  // ENG-01 (H-0334): an id an earlier Undo left clashing is renumbered; see `withFreshIds`.
  const notifiable = withFreshIds(state.notices, wanted);
  return { ...state, notices: [...state.notices, ...notifiable] };
}

/**
 * D-221 (Josh, 14 Nov 2026): applies one journey's late-notice plan (`ward-late-notices.ts`): drops
 * the not-yet-raised notices it cancels, stores the ones it schedules through the usual notice id
 * rule and gate, and sets the journey's `arrivalLateNotifiedAt` marker (removed when cleared).
 */
function withLateNoticePlan(state: WardFlowState, movementId: string, plan: LateNoticePlan): WardFlowState {
  let next = state;
  if (plan.cancel.length > 0) {
    const cancelled = new Set(plan.cancel);
    next = { ...next, notices: next.notices.filter((notice) => !cancelled.has(notice.id)) };
  }
  if (plan.schedule.length > 0) {
    const count = next.notices.length;
    next = appendNotices(
      next,
      plan.schedule.map((draft, index) =>
        makeNotice(draft.raisedAt, count + index, draft.kind, draft.to, draft.about, draft.sentence),
      ),
    );
  }
  const movement = next.movements.find((candidate) => candidate.id === movementId);
  if (movement && movement.arrivalLateNotifiedAt !== plan.marker) {
    const marked: Movement = { ...movement };
    if (plan.marker === undefined) delete marked.arrivalLateNotifiedAt;
    else marked.arrivalLateNotifiedAt = plan.marker;
    next = replaceMovement(next, movementId, marked);
  }
  return next;
}

/**
 * D-221 items 2 and 8: brings one journey's stored late notices up to date at `now`, as if it had
 * just been saved. Used by the backfill event (`EVALUATE_ARRIVAL_LATENESS`, kept for records saved
 * before notices were scheduled), the seed and the server's five-minute sweep. Returns `state`
 * itself when nothing changes.
 */
export function reconcileMovementLateNotices(state: WardFlowState, movementId: string, now: Instant): WardFlowState {
  const movement = state.movements.find((candidate) => candidate.id === movementId);
  if (!movement) return state;
  const plan = reconcileLateNotices({ before: undefined, after: movement, notices: state.notices, now });
  if (plan.schedule.length === 0 && plan.cancel.length === 0 && plan.marker === movement.arrivalLateNotifiedAt)
    return state;
  return withLateNoticePlan(state, movementId, plan);
}

/**
 * D-221 (Josh, 14 Nov 2026), the reducer post-step: every journey this event changed (compared by
 * reference) has its late notices reconciled, so a saved ETA, a booking, an arrival, a diversion, a
 * closure, an undo or a step back schedules, moves or withdraws the pair with one call, written by
 * the desk that saved. A reseed is left to the seed's own pass.
 */
export function withLateNoticesReconciled(
  before: WardFlowState,
  after: WardFlowState,
  event: WardFlowEvent,
): WardFlowState {
  if (after.movements === before.movements) return after;
  if (event.type === "RESET_SCENARIO" || event.type === "SET_SCENARIO") return after;
  const earlier = new Map(before.movements.map((movement) => [movement.id, movement]));
  let next = after;
  for (const movement of after.movements) {
    const previous = earlier.get(movement.id);
    if (previous === movement) continue;
    const plan = reconcileLateNotices({ before: previous, after: movement, notices: next.notices, now: event.now });
    next = withLateNoticePlan(next, movement.id, plan);
  }
  // A journey this event removed (an Undo of the save that made it) takes its unraised notices with it.
  const kept = new Set(after.movements.map((movement) => movement.id));
  for (const previous of before.movements) {
    if (kept.has(previous.id)) continue;
    const plan = reconcileLateNotices({ before: previous, after: undefined, notices: next.notices, now: event.now });
    if (plan.cancel.length > 0) next = withLateNoticePlan(next, previous.id, plan);
  }
  return next;
}

/**
 * D-221: the seed's open journeys get the late notices a save of their times would have stored
 * (WF-RD03's marker had none), through the same reconcile the reducer runs after every save.
 */
export function withSeedLateNotices(state: WardFlowState, now: Instant): WardFlowState {
  let next = state;
  for (const movement of state.movements)
    if (movement.closure === undefined) next = reconcileMovementLateNotices(next, movement.id, now);
  return next;
}
