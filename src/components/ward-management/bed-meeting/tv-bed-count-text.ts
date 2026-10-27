import { formatInstantWithDay } from "@/components/ward-management/ward-clock";

import type { TvBedCountAge } from "./tv-derivations";

/**
 * CS-10 (Audit 1, Josh 20 Oct 2026): the ready figure's age, by Capacity's own freshness rule
 * (`bedCountAge`). A meeting allocates against it, so a late count says so rather than looking current.
 * P025 (Josh, 27 Oct 2026, option B): each ward keeps its own `staleAfterMinutes`, and the TV says
 * which time it used, so a count is not called late on one screen and current on another unexplained.
 */
export function bedCountText({ wards, notConfirmed, oldestAt, staleAfter }: TvBedCountAge, now: number): string {
  if (oldestAt === undefined) return "";
  const at = formatInstantWithDay(oldestAt, now);
  const said =
    notConfirmed > 0
      ? wards === 1
        ? `Not confirmed since ${at}`
        : `${notConfirmed} ${notConfirmed === 1 ? "ward" : "wards"} not confirmed since ${at}`
      : wards === 1
        ? `Confirmed ${at}`
        : `Oldest count confirmed ${at}`;
  if (staleAfter === undefined) return said;
  const range = staleAfter.min === staleAfter.max ? `${staleAfter.min}` : `${staleAfter.min} to ${staleAfter.max}`;
  return `${said} · late after ${range} min`;
}
