import type { CapacityRefreshRequest } from "../ward-model";

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
