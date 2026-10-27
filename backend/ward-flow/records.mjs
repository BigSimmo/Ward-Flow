// @ts-check
import { createHash } from "node:crypto";

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
 * - Any other list keeps one row per position (`index`), except the bounded undo history: its
 *   internal keys name undo subjects, so evicting its oldest receipt does not change every row.
 *   It keeps kind `index` and its explicit order, which older readers and rollback SQL understand.
 * - A map (a plain object) keeps one row per key (`entry`).
 * - Anything else (numbers, text) stays on the workspace row, and `$revisions` on that row records
 *   the workspace revision at which each of those last changed, so a clash check can see a reset
 *   or a clock change someone else made.
 */

const MARKER = "$records";
const REVISIONS = "$revisions";

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

/** An undo subject, matching ward-undo.ts's replacement rule without changing domain records. */
function undoRecordId(value) {
  if (!isPlainObject(value)) return null;
  const subject =
    value.kind === "step" && typeof value.undoType === "string" && typeof value.subjectId === "string"
      ? [value.kind, value.undoType, value.subjectId]
      : value.kind === "bed-placement" && typeof value.admissionId === "string"
        ? [value.kind, value.admissionId]
        : value.kind === "referral-decision" && typeof value.referralId === "string"
          ? [value.kind, value.referralId]
          : null;
  // Subject ids can themselves approach the storage key's 200-character limit.
  return subject ? `undo:${createHash("sha256").update(JSON.stringify(subject)).digest("hex")}` : null;
}

/** Unknown/duplicate shapes retain ordinary index storage rather than dropping a list entry. */
function undoRecordIds(values) {
  const ids = values.map(undoRecordId);
  return ids.every((id) => id !== null) && new Set(ids).size === ids.length ? ids : null;
}

/** Recognise numeric keys written by migration 10 or an older backend, preserving their revisions. */
function storedParts(stored) {
  const undo = stored.filter((row) => row.collection === "undoRecords" && row.kind === "index");
  const ids = undoRecordIds(undo.map((row) => row.body));
  const undoKeys = new Map(undo.map((row, index) => [row, ids?.[index] ?? row.record_id]));
  return new Map(stored.map((row) => [partKey(row.collection, undoKeys.get(row) ?? row.record_id), row]));
}

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
    const undoIds = collection === "undoRecords" && kind === "index" ? undoRecordIds(value) : null;
    if (kind === "entry")
      for (const [recordId, body] of Object.entries(value))
        parts.set(partKey(collection, recordId), { collection, recordId, kind, ordinal: 0, body });
    else
      value.forEach((body, ordinal) => {
        const recordId = kind === "item" ? body.id : (undoIds?.[ordinal] ?? String(ordinal));
        parts.set(partKey(collection, recordId), { collection, recordId, kind, ordinal, body });
      });
  }
  return { core: { ...world, state }, parts };
}

/** The small fields kept on the workspace row (not markers). */
const scalarFields = (core) => Object.keys(core.state).filter((key) => !markerKind(core.state[key]));

/**
 * Builds the world from its workspace row and its stored rows. A state field still holding its own
 * list or map (written before migration 10, or by hand) is used as it is, and any rows for it are
 * ignored; the next save moves it into rows.
 * @param {StoredRow[]} rows
 */
export function assembleWorld(stored, rows) {
  const core = { ...stored };
  delete core[REVISIONS];
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

/** The largest position a row is given before a list is numbered from 0 again. */
const MAX_ORDINAL = 2_000_000_000;

/**
 * Keeps the stored positions of an `item` list whose kept rows are still in their stored order and
 * whose new rows all come after them, giving the new rows the next positions. So dropping the
 * oldest entry (the audit list at its cap) or adding at the end rewrites no other row. Any other
 * reordering numbers the list from 0 again. `assembleWorld` sorts by position, so gaps are fine.
 * @param {Part[]} list the list's parts, in the world's order
 * @param {Map<string, StoredRow>} current
 */
function keepOrdinals(list, current) {
  let last = -1;
  let seenNew = false;
  for (const part of list) {
    const row = current.get(partKey(part.collection, part.recordId));
    if (!row || row.kind !== part.kind) {
      seenNew = true;
      continue;
    }
    if (seenNew || row.ordinal <= last) return;
    last = row.ordinal;
  }
  if (last + list.length > MAX_ORDINAL) return;
  for (const part of list) {
    const row = current.get(partKey(part.collection, part.recordId));
    part.ordinal = row && row.kind === part.kind ? row.ordinal : ++last;
  }
}

/**
 * What a save must write, given the rows stored now and the world after the change: the rows to
 * add or rewrite (each with the revision its content last changed at) and the keys to remove.
 * A row whose content is unchanged keeps its revision, even when its position moved, and so does
 * each small field on the workspace row (`storedCore`, the row as saved now; none for a new one).
 * @param {StoredRow[]} stored
 * @param {any} world
 * @param {number} revision
 * @param {any} [storedCore]
 */
export function planSave(stored, world, revision, storedCore = null) {
  const split = splitWorld(world);
  const { parts } = split;
  const before = storedCore?.[REVISIONS] ?? {};
  const core = {
    ...split.core,
    [REVISIONS]: Object.fromEntries(
      scalarFields(split.core).map((field) => [
        field,
        storedCore && same(storedCore.state?.[field], split.core.state[field]) ? (before[field] ?? revision) : revision,
      ]),
    ),
  };
  const current = storedParts(stored);
  /** @type {Map<string, Part[]>} */
  const lists = new Map();
  for (const part of parts.values())
    if (part.kind === "item") {
      const list = lists.get(part.collection);
      if (list) list.push(part);
      else lists.set(part.collection, [part]);
    }
  for (const list of lists.values()) keepOrdinals(list, current);
  const upserts = [];
  for (const [key, part] of parts) {
    const row = current.get(key);
    const changed = !row || row.kind !== part.kind || !same(row.body, part.body);
    if (changed || row.ordinal !== part.ordinal || row.record_id !== part.recordId)
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
 * The opaque name a client is given for a record, so it can say later that it has seen that
 * record's latest state without the record's own key leaving the server.
 */
export const recordToken = (key) => createHash("sha256").update(key).digest("hex").slice(0, 16);

/** The most records a reply names as covered; a larger command names none, which is always safe. */
const MAX_COVERED = 200;

/**
 * The records a command changes (adds, rewrites or removes) or names, by `partKey`, each with its
 * part. Rows kept by position (`index`) are never named.
 */
function commandRecords(before, after, event) {
  const was = splitWorld(before).parts;
  const now = after === before ? was : splitWorld(after).parts;
  /** @type {Map<string, Part>} */
  const records = new Map();
  for (const [key, part] of was) {
    const next = now.get(key);
    if (!next || !same(next.body, part.body)) records.set(key, part);
  }
  for (const [key, part] of now) if (!was.has(key)) records.set(key, part);
  const named = namedValues(event);
  for (const [key, part] of was) if (part.kind !== "index" && named.has(part.recordId)) records.set(key, part);
  return records;
}

/**
 * The tokens (`recordToken`) of the records a command changes or names, for its sender to report
 * as seen at the revision the command was saved at. Records in a field still kept whole have no
 * revision of their own and are left out, and so is every record of a command naming too many.
 *
 * `visible` is the sender's own scoped view of the workspace before and after the command (`null`
 * for a desk that sees the whole network). A record in neither is left out: a command's side
 * effects can reach records outside the sender's place, and a desk must never learn that one of
 * those changed. Tokens are plain hashes of guessable record ids, so they name only what the
 * sender can already see.
 * @param {{ core: any, before: any, after: any, event: unknown, visible?: any[] | null }} options
 */
export function coveredRecords({ core, before, after, event, visible = null }) {
  const whole = wholeFields(core);
  const seeable = visible && new Set(visible.flatMap((world) => [...splitWorld(world).parts.keys()]));
  const records = [...commandRecords(before, after, event)].filter(
    ([key, part]) => !whole.has(part.collection) && (!seeable || seeable.has(key)),
  );
  return records.length > MAX_COVERED ? [] : records.map(([key]) => recordToken(key));
}

/**
 * Whether a command sent against `expectedRevision` must be refused because someone else changed
 * a record it changes or names since then. `before` and `after` are the world now and with the
 * command applied (`after` is `before` when the command was refused). Rows kept by position
 * (`index`) are never named. A field still kept whole has no revision of its own, so any change to
 * it since `expectedRevision` counts. The small fields count too: a reset (`worldGeneration`) since
 * then always clashes, and so does changing one someone else changed since (the clock), except the
 * id counters (`...Sequence`), which every new record moves on.
 *
 * `seen` maps a record's token to a later revision at which the sender has seen that record (its
 * own save from the same popup, `coveredRecords`). That record is checked from there instead. It
 * never reaches past `priorRevision`, and never applies to a field kept whole.
 * @param {{ stored: StoredRow[], core: any, before: any, after: any, event: unknown, expectedRevision: number, priorRevision: number, seen?: Record<string, number> | null }} options
 */
export function conflicts(options) {
  return conflictingCollection(options) !== null;
}

/** P058: the words a conflict may name for the record it clashed on; anything else is a "record". */
const RECORD_TYPES = {
  movements: "movement",
  referrals: "referral",
  broadcastAlerts: "alert",
  dischargeRevisions: "discharge",
  patients: "stay",
  admissions: "stay",
  plannedAdmissions: "stay",
  bedReleases: "bed",
  leaveBeds: "bed",
};
/** @param {string | null} collection */
export const conflictRecordType = (collection) => (collection && RECORD_TYPES[collection]) || "record";

/** The 409 sentence for a clash: the record type and the desk only, never a patient or record id. */
export const staleReason = (collection) =>
  `Another desk changed this ${conflictRecordType(collection)} first. Review the latest board before trying again.`;

/**
 * As `conflicts`, but names the collection of the first record that clashed: "" for a clash on a
 * field kept whole, `null` for no clash.
 * @param {{ stored: StoredRow[], core: any, before: any, after: any, event: unknown, expectedRevision: number, priorRevision: number, seen?: Record<string, number> | null }} options
 * @returns {string | null}
 */
export function conflictingCollection({
  stored,
  core,
  before,
  after,
  event,
  expectedRevision,
  priorRevision,
  seen = null,
}) {
  if (expectedRevision >= priorRevision) return null;
  const revisions = new Map([...storedParts(stored)].map(([key, row]) => [key, Number(row.revision)]));
  const whole = wholeFields(core);
  const revisionOf = (key, part) => (whole.has(part.collection) ? priorRevision : (revisions.get(key) ?? 0));
  const checkedFrom = (key, part) => {
    const later = whole.has(part.collection) || !seen ? undefined : seen[recordToken(key)];
    return typeof later === "number" && Number.isSafeInteger(later)
      ? Math.max(expectedRevision, Math.min(later, priorRevision))
      : expectedRevision;
  };
  for (const [key, part] of commandRecords(before, after, event))
    if (revisionOf(key, part) > checkedFrom(key, part)) return part.collection;
  const scalarRevision = (field) => Number(core[REVISIONS]?.[field] ?? priorRevision);
  if (scalarRevision("worldGeneration") > expectedRevision) return "";
  for (const field of scalarFields(core))
    if (
      !field.endsWith("Sequence") &&
      !same(before.state[field], after.state[field]) &&
      scalarRevision(field) > expectedRevision
    )
      return field;
  return null;
}
