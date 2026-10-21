import type { WARD_BUZZ_MESSAGES } from "../ward-flow-events";
import type { Instant } from "../ward-clock";
import type { CapacityFigure, CapacityRefreshRequest } from "../ward-model";

/** A coordinator buzz as the ward chrome reads it. */
export interface BuzzKeySource {
  id?: string;
  unitId: string;
  at: number;
  byRole: string;
  message?: string;
  urgent?: boolean;
}

/**
 * One key per buzz, in list order. Creation identities survive retention trimming. Legacy entries
 * use occurrence keys until the next append freezes those same keys. The notification centre and
 * the ward-screen unread count share this rule.
 */
export function buzzKeys(requests: readonly BuzzKeySource[]): string[] {
  // A legacy occurrence key never repeats an id already in the list, so a frozen list stays distinct.
  const taken = new Set(requests.flatMap((buzz) => (buzz.id ? [buzz.id] : [])));
  const seen = new Map<string, number>();
  return requests.map((buzz) => {
    const base = `${buzz.unitId}:${buzz.at}:${buzz.byRole}:${buzz.message ?? ""}:${buzz.urgent === true}`;
    let n = seen.get(base) ?? 0;
    if (buzz.id) {
      seen.set(base, n + 1);
      return buzz.id;
    }
    while (taken.has(`${base}#${n}`)) n += 1;
    seen.set(base, n + 1);
    taken.add(`${base}#${n}`);
    return `${base}#${n}`;
  });
}

/** Freeze legacy keys before retention changes their occurrence numbers. Both request producers
 * share a creation sequence within the world generation; it advances past the retention cap. */
export function appendRefreshRequest(
  requests: readonly CapacityRefreshRequest[],
  request: Omit<CapacityRefreshRequest, "id">,
  worldGeneration: number,
): CapacityRefreshRequest[] {
  const keys = buzzKeys(requests);
  const sequence = requests.reduce((maximum, entry) => {
    const match = /^buzz:(?:\d+:)?(\d+)$/.exec(entry.id ?? "");
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return [
    ...requests.map((entry, index) => (entry.id ? entry : { ...entry, id: keys[index] })),
    { ...request, id: `buzz:${worldGeneration}:${sequence + 1}` },
  ].slice(-500);
}

/** The one buzz that asks about a placement, not about capacity; a capacity confirmation leaves it. */
const PLACEMENT_BUZZ: (typeof WARD_BUZZ_MESSAGES)[number] = "Please review the current placement request.";

/** Whether a ward's own capacity confirmation answers this request. */
export function refreshRequestAsksForCapacity(request: Pick<CapacityRefreshRequest, "message">): boolean {
  return request.message !== PLACEMENT_BUZZ;
}

/**
 * DEC-L5-04 (CAP-REV): a capacity request stays open until the ward confirms its capacity, on every
 * desk, not only until somebody dismisses it on their own screen. `CONFIRM_CAPACITY` stamps
 * `answeredAt`, so the order comes from the event sequence rather than minute timestamps. A request
 * saved before that stamp existed (no `allocatableRevision`) falls back to the old timestamp rule:
 * answered only by a ward confirmation in a later minute, so a same-minute tie stays open.
 */
export function refreshRequestIsOpen(
  request: CapacityRefreshRequest,
  allocatable?: Pick<CapacityFigure, "source" | "confirmedAt">,
): boolean {
  if (request.answeredAt !== undefined) return false;
  if (request.allocatableRevision !== undefined || allocatable === undefined) return true;
  return !(
    refreshRequestAsksForCapacity(request) &&
    allocatable.source === "ward" &&
    allocatable.confirmedAt > request.at
  );
}

/**
 * Marks every open capacity request for `unitId` as answered by a ward confirmation made at
 * `now`. `readRevision` is the capacity revision the ward confirmed against; a request recorded
 * at a later revision asked about figures the ward had not seen, so it stays open.
 */
export function answerRefreshRequests(
  requests: CapacityRefreshRequest[],
  unitId: string,
  readRevision: number,
  now: Instant,
): CapacityRefreshRequest[] {
  let changed = false;
  const next = requests.map((request) => {
    if (
      request.unitId !== unitId ||
      request.answeredAt !== undefined ||
      !refreshRequestAsksForCapacity(request) ||
      (request.allocatableRevision ?? 0) > readRevision
    )
      return request;
    changed = true;
    return { ...request, answeredAt: now };
  });
  return changed ? next : requests;
}
