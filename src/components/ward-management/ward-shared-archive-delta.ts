/**
 * Audit PS-01: a desk that already holds History's archive is sent only the records archived since,
 * not the whole archive (up to about 4 MB) every time it grows. The server sends a short hash for
 * each record this desk is shown and the sum of them all; the desk keeps what it holds, drops what
 * falls below the server's floor, adds the new records and checks the sum. A delta that does not
 * check out (the desk's place, a break glass record or a masking rule changed) is never shown: the
 * desk reads the whole archive again instead.
 */

export const ARCHIVED_COLLECTIONS = ["movements", "referrals", "broadcastAlerts"] as const;
export type ArchivedCollection = (typeof ARCHIVED_COLLECTIONS)[number];

type ArchiveEntry = {
  collection: ArchivedCollection;
  body: { id: string };
  closedAt?: number;
  hash?: string;
};
/** What a desk holds to ask for the next delta: the newest revision read and the records shown. */
export type HeldArchive = { through: number; entries: ArchiveEntry[] };
export type FoldedArchive = { entries: ArchiveEntry[]; held: HeldArchive | null };

const SUM_MODULUS = 2 ** 48;
const HASH = /^[0-9a-f]{12}$/;

/** Newest closed first, then collection and id, as the server orders the archive. */
function archiveOrder(
  a: { closedAt: number; collection: string; id: string },
  b: { closedAt: number; collection: string; id: string },
) {
  return (
    b.closedAt - a.closedAt ||
    (a.collection < b.collection ? -1 : a.collection > b.collection ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
const key = (entry: ArchiveEntry) => `${entry.collection}\0${entry.body.id}`;
const ordered = (entry: ArchiveEntry) => ({
  closedAt: entry.closedAt as number,
  collection: entry.collection,
  id: entry.body.id,
});
/** Every entry has what a delta needs: its closing time and its hash. */
const checkable = (entries: ArchiveEntry[]) =>
  entries.every((entry) => Number.isFinite(entry.closedAt) && typeof entry.hash === "string" && HASH.test(entry.hash));
function sumOf(entries: ArchiveEntry[]) {
  let sum = 0;
  for (const entry of entries) sum = (sum + Number.parseInt(entry.hash as string, 16)) % SUM_MODULUS;
  return sum.toString(16).padStart(12, "0");
}

/**
 * The records an archive reply leaves this desk holding, `"invalid"` for a malformed reply (shown
 * as nothing new), or `"reread"` for a delta that cannot be used (read the whole archive instead).
 * A whole reply from an older server without hashes still shows; the next read is then whole too.
 */
export function foldArchiveReply(value: unknown, held: HeldArchive | null): FoldedArchive | "invalid" | "reread" {
  const reply = value as {
    records?: unknown;
    through?: unknown;
    sum?: unknown;
    since?: unknown;
    floor?: unknown;
  } | null;
  if (!Array.isArray(reply?.records)) return "invalid";
  const fresh: ArchiveEntry[] = [];
  for (const record of reply.records as {
    collection?: unknown;
    body?: unknown;
    closedAt?: unknown;
    hash?: unknown;
  }[]) {
    const body = record?.body as { id?: unknown } | null | undefined;
    if (
      !(ARCHIVED_COLLECTIONS as readonly unknown[]).includes(record?.collection) ||
      !body ||
      typeof body !== "object" ||
      typeof body.id !== "string"
    )
      return "invalid";
    fresh.push({
      collection: record.collection as ArchivedCollection,
      body: body as { id: string },
      ...(typeof record.closedAt === "number" ? { closedAt: record.closedAt } : {}),
      ...(typeof record.hash === "string" ? { hash: record.hash } : {}),
    });
  }
  const through = reply.through;
  const sum = reply.sum;
  const usable = Number.isSafeInteger(through) && typeof sum === "string" && HASH.test(sum) && checkable(fresh);
  if (reply.since === undefined) {
    // A whole archive. It can seed later deltas only when it checks out itself.
    const next = usable && sumOf(fresh) === sum ? { through: through as number, entries: fresh } : null;
    return { entries: fresh, held: next };
  }
  if (!held || reply.since !== held.through || !usable) return "reread";
  const floor = reply.floor;
  let below: ((entry: ArchiveEntry) => boolean) | undefined;
  if (floor !== undefined) {
    if (
      !Array.isArray(floor) ||
      floor.length !== 3 ||
      !Number.isFinite(floor[0]) ||
      typeof floor[1] !== "string" ||
      typeof floor[2] !== "string"
    )
      return "reread";
    const edge = { closedAt: floor[0] as number, collection: floor[1], id: floor[2] };
    below = (entry) => archiveOrder(ordered(entry), edge) > 0;
  }
  const replaced = new Set(fresh.map(key));
  const entries = [...held.entries.filter((entry) => !replaced.has(key(entry)) && !below?.(entry)), ...fresh].sort(
    (a, b) => archiveOrder(ordered(a), ordered(b)),
  );
  if (sumOf(entries) !== sum) return "reread";
  return { entries, held: { through: through as number, entries } };
}
