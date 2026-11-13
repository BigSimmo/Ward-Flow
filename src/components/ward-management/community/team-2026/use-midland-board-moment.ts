"use client";

import { calendarDateOf } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect, useWardClock } from "@/components/ward-management/ward-flow-provider";

/*
 * Its own file, not in ./midland-decisions: the provider's demo storage imports that store (to clear
 * it on Reset), so a provider import there would close a loop.
 */

/**
 * The board's current moment (epoch ms), for stamping and counting the desk's recorded contacts and
 * answers on the board clock, not the device's (time audit D8 and C5, 13 Nov 2026). Undefined outside
 * a provider, where there is no board and the store keeps the device clock.
 */
export function useMidlandBoardMoment(): number | undefined {
  const dayZero = useOptionalWardFlowSelect("dayZero")?.dayZero;
  const now = useWardClock(Number.NaN);
  return dayZero instanceof Date && Number.isFinite(now) ? calendarDateOf(now, dayZero).getTime() : undefined;
}
