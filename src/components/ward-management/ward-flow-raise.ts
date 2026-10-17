"use client";

import { useMemo } from "react";

import type { WardCommandDispatch } from "./ward-shared-client";
import type { Instant } from "./ward-clock";
import type { WardFlowEvent, WardFlowRole } from "./ward-flow-events";
import { useOptionalWardFlowSelect, useWardFlowClock, useWardFlowSelect } from "./ward-flow-provider";

/**
 * Fix list 1.5: screens raise events by name, never by building the event object with a desk role
 * and the time at every call. A screen names its desk once (`useWardRaise("ed")`) and each action
 * passes only what it records: `raise("WITHDRAW_REFERRAL", { movementId, actingPlaceId })`.
 */

type WardFlowEventType = WardFlowEvent["type"];

/** What an event records besides its type, the desk raising it and the time. */
type WardEventFields<T extends WardFlowEventType> = Omit<Extract<WardFlowEvent, { type: T }>, "type" | "role" | "now">;

type FieldsArgument<T extends WardFlowEventType> = keyof WardEventFields<T> extends never
  ? []
  : [fields: WardEventFields<T>];

export type WardRaise = <T extends WardFlowEventType>(
  type: T,
  ...fields: FieldsArgument<T>
) => ReturnType<WardCommandDispatch>;

/** The plain form, for a caller that already holds the dispatch, the desk and the time. */
export function wardRaise(dispatch: WardCommandDispatch, role: WardFlowRole, now: Instant): WardRaise {
  return (type, ...[fields]) => dispatch({ ...fields, type, role, now } as WardFlowEvent);
}

/** Raises events as `role` at the provider's clock, through the nearest provider or override. */
export function useWardRaise(role: WardFlowRole): WardRaise {
  const { dispatch } = useWardFlowSelect("dispatch");
  const now = useWardFlowClock();
  return useMemo(() => wardRaise(dispatch, role, now), [dispatch, role, now]);
}

/** Read out beside every demo control the shared workspace has switched off. */
export const DEMO_CONTROLS_OFF = "Demo controls are switched off on the shared workspace. Nothing will change.";

/**
 * False when the shared workspace has switched demo controls off, so a demo control shows as
 * unavailable with its reason instead of offering a change the server will refuse.
 */
export function useDemoControlsAvailable(): boolean {
  return useOptionalWardFlowSelect("demoControlsAvailable")?.demoControlsAvailable !== false;
}
