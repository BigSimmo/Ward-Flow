// Moved out of `ward-flow-events.ts` unchanged (line cap, 10 Nov 2026).
import type { WardFlowEvent } from "./ward-flow-events";

/**
 * ⚠️ THE EVENTS A RECORDED REASON CAN GET PAST — AND THE POINT IS THAT IT IS DERIVED, NOT LISTED.
 *
 * `Extract` reads the union itself, so this cannot drift from `WardFlowEvent`. The reducer's two
 * refusal helpers take THIS rather than `WardFlowEvent & { overrideReason?: OverrideReason }`.
 *
 * That intersection was the defect: it RE-ADDED the field regardless of what the union member
 * declared, so deleting `overrideReason?: OverrideReason` from an event produced no type error
 * anywhere. The declaration was load-bearing for CALLERS constructing the event and NOT for the
 * reducer reading it — a deletion would have left screens unable to pass a reason while the
 * reducer went on reading one that could never arrive. A field with no producer, arriving by
 * deletion, invisible to tsc.
 *
 * ⚠️ AND A STRUCTURAL CHECK WOULD NOT HAVE CAUGHT IT EITHER. `Member extends { overrideReason?:
 * OverrideReason }` stays TRUE when the field is deleted, because a type missing an OPTIONAL
 * property is still structurally assignable to one that declares it optional. That check would
 * compile for ever and report nothing — a check that cannot fail, in the type system.
 */
export type OverridableWardFlowEvent = Extract<
  WardFlowEvent,
  { type: "REFER_TO_UNITS" | "ACCEPT_IN_PRINCIPLE" | "PULL_PATIENT" | "ACCEPT_REFERRAL" }
>;
