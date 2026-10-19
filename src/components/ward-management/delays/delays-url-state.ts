import { HEALTH_SERVICES } from "@/components/ward-management/ward-model-vocabulary";

import { NO_FILTERS, type BoardFilters } from "./delays-board-model";
import { DELAY_CAUSE_ORDER, DELAY_OWNERS, type DelayCause, type DelayOwnerId } from "./delays-derivations";
import type { CatchmentOrigin } from "./delays-view-model";

/**
 * DA-15: the Delays board's filters and order in the web address (`ward-url-state.ts`). Plain
 * words, so a shared link reads for what it shows. Two choices stay out on purpose: search text
 * (it can hold a name) and the runway dot (a half hour counted from now, so it means a different
 * window after a reload).
 */
const WAITS = { "8h": 1, "12h": 2, "24h": 3 } as const;
const OWNERS: readonly DelayOwnerId[] = DELAY_OWNERS.map((owner) => owner.id);
const ORIGINS: readonly CatchmentOrigin[] = [...HEALTH_SERVICES, "unrecorded"];

/** Every query key the board reads and writes. `show=severe` is the Menu's link (shell-9). */
export const DELAYS_QUERY_KEYS = [
  "owner",
  "origin",
  "blocker",
  "wait",
  "locked",
  "quiet",
  "due",
  "passed",
  "show",
  "order",
] as const;
type DelaysQueryKey = (typeof DELAYS_QUERY_KEYS)[number];

/** The filters an address asks for. Unknown or malformed values are ignored, never guessed at. */
export function filtersFromSearch(search: string): BoardFilters {
  const params = new URLSearchParams(search);
  const pick = <T extends string>(key: DelaysQueryKey, allowed: readonly T[]): T | null => {
    const value = params.get(key);
    return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
  };
  const wait = params.get("wait");
  return {
    ...NO_FILTERS,
    owner: pick("owner", OWNERS),
    origin: pick("origin", ORIGINS),
    cause: pick<DelayCause>("blocker", DELAY_CAUSE_ORDER),
    threshold: wait !== null && wait in WAITS ? WAITS[wait as keyof typeof WAITS] : 0,
    locked: params.get("locked") === "1",
    silent: params.get("quiet") === "1",
    dueSoon: params.get("due") === "soon",
    breached: params.get("passed") === "1",
    severe: params.get("show") === "severe",
  };
}

/** The query values for these filters; `null` removes a key. Search and the runway dot are left out. */
export function filtersToParams(filters: BoardFilters): Record<Exclude<DelaysQueryKey, "order">, string | null> {
  const wait = (Object.keys(WAITS) as (keyof typeof WAITS)[]).find((key) => WAITS[key] === filters.threshold);
  return {
    owner: filters.owner,
    origin: filters.origin,
    blocker: filters.cause,
    wait: wait ?? null,
    locked: filters.locked ? "1" : null,
    quiet: filters.silent ? "1" : null,
    due: filters.dueSoon ? "soon" : null,
    passed: filters.breached ? "1" : null,
    show: filters.severe ? "severe" : null,
  };
}

/** One stable string for a set of filters: what part of the address they would write. */
export function filtersKey(filters: BoardFilters): string {
  return Object.entries(filtersToParams(filters))
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

/**
 * The same string for the filters an address holds, so a screen can tell when the address asks
 * for something different (Back, Forward, a link from the Menu) from what it already shows.
 */
export function filtersKeyOf(search: string): string {
  return filtersKey(filtersFromSearch(search));
}

/** `order=longest` or `order=blocker`; `null` when the address does not say, so the viewer's own choice applies. */
export function flatOrderFromSearch(search: string): boolean | null {
  const order = new URLSearchParams(search).get("order");
  return order === "longest" ? true : order === "blocker" ? false : null;
}
