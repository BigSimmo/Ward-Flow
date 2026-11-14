import { formatInstantWithDay } from "@/components/ward-management/ward-clock";

import type { TvBedCountAge } from "./tv-derivations";

/**
 * CS-10 (Audit 1, Josh 20 Oct 2026): the ready figure's age, by Capacity's own freshness rule
 * (`bedCountAge`). A meeting allocates against it, so a late count says so rather than looking current.
 * Owner ruling 14 Nov 2026 (supersedes P025): every ward shares the one signed bed count time, so the
 * TV says that single time, never a range.
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
  return `${said} · late after ${staleAfter} min`;
}
