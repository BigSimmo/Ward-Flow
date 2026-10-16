/** A coordinator buzz as the ward chrome reads it. */
export interface BuzzKeySource {
  unitId: string;
  at: number;
  byRole: string;
  message?: string;
  urgent?: boolean;
}

/**
 * One stable key per buzz, in list order. Identical repeat buzzes get an occurrence suffix so each
 * keeps its own React key and its own acknowledgement. The notification centre and the ward-screen
 * unread count both use this, so they always agree.
 */
export function buzzKeys(requests: readonly BuzzKeySource[]): string[] {
  const seen = new Map<string, number>();
  return requests.map((buzz) => {
    const base = `${buzz.unitId}:${buzz.at}:${buzz.byRole}:${buzz.message ?? ""}:${buzz.urgent === true}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}#${n}`;
  });
}
