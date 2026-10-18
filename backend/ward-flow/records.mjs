// @ts-check

/**
 * How a shared workspace is kept from migration 10: each referral, bed (ward), movement, patient,
 * admission and every other list entry or map entry in the world's `state` is its own row in
 * `ward_flow.workspace_records`, with the workspace revision at which its content last changed.
 * The workspace row keeps only the small fields (clock, counters, scenario) and a marker in place
 * of each list or map, so a save writes only the rows it changed.
 *
 * The same layout rule is written in SQL in migrations/010-workspace-records.sql, which moves an
 * existing workspace across. `records.test.mjs` checks the two agree.
 *
 * - A list whose entries are all objects with a unique text `id` keeps one row per entry, keyed by
 *   that id (`item`).
 * - Any other list keeps one row per position (`index`). Lists like this only ever grow at the end,
 *   so two desks adding to one at once land in different rows.
 * - A map (a plain object) keeps one row per key (`entry`).
 * - Anything else (numbers, text) stays on the workspace row.
 */

export const MARKER = "$records";

/** @typedef {"item" | "index" | "entry"} RecordKind */
/** @typedef {{ collection: string, recordId: string, kind: RecordKind, ordinal: number, body: unknown }} Part */
/** @typedef {{ collection: string, record_id: string, kind: RecordKind, ordinal: number, revision: number | string, body: unknown }} StoredRow */

const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

/** Whether a stored state field is a marker standing in for its rows. */
export function markerKind(value) {
  if (!isPlainObject(value)) return null;
  const keys = Object.keys(value);
  const kind = value[MARKER];
  return keys.length === 1 && (kind === "item" || kind === "index" || kind === "entry") ? kind : null;
}

/** The kind of row a state field is kept in, or null when it stays on the workspace row. */
function kindOf(value) {
  if (Array.isArray(value)) {
    const ids = value.map((entry) => (isPlainObject(entry) && typeof entry.id === "string" ? entry.id : null));
    return ids.every((id) => id !== null) && new Set(ids).size === ids.length ? "item" : "index";
  }
  return isPlainObject(value) ? "entry" : null;
}

export const partKey = (collection, recordId) => `${collection}/${recordId}`;

/**
 * Splits a world into its workspace row (`core`) and its rows (`parts`, keyed by `partKey`).
 * Never changes `world`.
 */
export function splitWorld(world) {
  /** @type {Map<string, Part>} */
  const parts = new Map();
  const state = {};
  for (const [collection, value] of Object.entries(world.state)) {
    const kind = kindOf(value);
    if (!kind) {
      state[collection] = value;
      continue;
    }
    state[collection] = { [MARKER]: kind };
    if (kind === "entry")
      for (const [recordId, body] of Object.entries(value))
        parts.set(partKey(collection, recordId), { collection, recordId, kind, ordinal: 0, body });
    else
      value.forEach((body, ordinal) => {
        const recordId = kind === "item" ? body.id : String(ordinal);
        parts.set(partKey(collection, recordId), { collection, recordId, kind, ordinal, body });
      });
  }
  return { core: { ...world, state }, parts };
}

/**
 * Builds the world from its workspace row and its stored rows. A state field still holding its own
 * list or map (written before migration 10, or by hand) is used as it is, and any rows for it are
 * ignored; the next save moves it into rows.
 * @param {StoredRow[]} rows
 */
export function assembleWorld(core, rows) {
  const byCollection = new Map();
  for (const row of rows) {
    const list = byCollection.get(row.collection);
    if (list) list.push(row);
    else byCollection.set(row.collection, [row]);
  }
  const state = {};
  for (const [collection, value] of Object.entries(core.state)) {
    const kind = markerKind(value);
    if (!kind) {
      state[collection] = value;
      continue;
    }
    const own = (byCollection.get(collection) ?? []).filter((row) => row.kind === kind);
    if (kind === "entry") {
      own.sort((a, b) => (a.record_id < b.record_id ? -1 : a.record_id > b.record_id ? 1 : 0));
      state[collection] = Object.fromEntries(own.map((row) => [row.record_id, row.body]));
    } else {
      own.sort((a, b) => a.ordinal - b.ordinal);
      state[collection] = own.map((row) => row.body);
    }
  }
  return { ...core, state };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (isPlainObject(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** The fields of `core.state` still kept as a whole (not yet as rows). */
function wholeFields(core) {
  return new Set(Object.keys(core.state).filter((key) => !markerKind(core.state[key])));
}

/**
 * What a save must write, given the rows stored now and the world after the change: the rows to
 * add or rewrite (each with the revision its content last changed at) and the keys to remove.
 * A row whose content is unchanged keeps its revision, even when its position moved.
 * @param {StoredRow[]} stored
 */
export function planSave(stored, world, revision) {
  const { core, parts } = splitWorld(world);
  const current = new Map(stored.map((row) => [partKey(row.collection, row.record_id), row]));
  const upserts = [];
  for (const [key, part] of parts) {
    const row = current.get(key);
    const changed = !row || row.kind !== part.kind || !same(row.body, part.body);
    if (changed || row.ordinal !== part.ordinal)
      upserts.push({ ...part, revision: changed ? revision : Number(row.revision) });
  }
  const deletes = [...current.values()]
    .filter((row) => !parts.has(partKey(row.collection, row.record_id)))
    .map((row) => ({ collection: row.collection, recordId: row.record_id }));
  return { core, upserts, deletes };
}

/** Every text value anywhere in a command, so the records it names can be found. */
function namedValues(value, found = new Set()) {
  if (typeof value === "string") found.add(value);
  else if (Array.isArray(value)) for (const entry of value) namedValues(entry, found);
  else if (isPlainObject(value)) for (const entry of Object.values(value)) namedValues(entry, found);
  return found;
}

/**
 * Whether a command sent against `expectedRevision` must be refused because someone else changed
 * a record it changes or names since then. `before` and `after` are the world now and with the
 * command applied (`after` is `before` when the command was refused). Rows kept by position
 * (`index`) are never named. A field still kept whole has no revision of its own, so any change to
 * it since `expectedRevision` counts.
 * @param {{ stored: StoredRow[], core: any, before: any, after: any, event: unknown, expectedRevision: number, priorRevision: number }} options
 */
export function conflicts({ stored, core, before, after, event, expectedRevision, priorRevision }) {
  if (expectedRevision >= priorRevision) return false;
  const revisions = new Map(stored.map((row) => [partKey(row.collection, row.record_id), Number(row.revision)]));
  const whole = wholeFields(core);
  const revisionOf = (part) =>
    whole.has(part.collection) ? priorRevision : (revisions.get(partKey(part.collection, part.recordId)) ?? 0);
  const was = splitWorld(before).parts;
  const now = after === before ? was : splitWorld(after).parts;
  for (const [key, part] of was) {
    const next = now.get(key);
    if ((!next || !same(next.body, part.body)) && revisionOf(part) > expectedRevision) return true;
  }
  for (const [key, part] of now) if (!was.has(key) && revisionOf(part) > expectedRevision) return true;
  const named = namedValues(event);
  for (const part of was.values())
    if (part.kind !== "index" && named.has(part.recordId) && revisionOf(part) > expectedRevision) return true;
  return false;
}
