/**
 * Structural sharing for shared snapshots (audit PS-06 / PERF-01).
 *
 * Every poll or save reply carries the whole board. Publishing it as fresh objects made every
 * screen re-render on every change anywhere in the network. These helpers keep the previously held
 * object for every record whose content is unchanged, and a collection's previous array when every
 * item in it was kept, so selectors and memos keyed on record identity only rerun for what changed.
 *
 * Records are matched by `id` when every item in both lists has a unique string id, otherwise by
 * position. The payload carries no per-record revision, so a record's content is compared as JSON.
 * The JSON of held objects is remembered by identity (`textOf`), so a kept record is serialised once
 * across polls. Only objects that have passed the shared-state check (held ones, or incoming ones
 * once `remember` is set) are remembered: the check upgrades legacy rows in place, so text taken
 * from an object before it ran could be stale.
 */

/** Payload → state → collection or map → record. Records themselves are compared whole. */
const PAYLOAD_DEPTH = 3;

const textOf = new WeakMap<object, string>();

function heldText(value: object): string {
  let text = textOf.get(value);
  if (text === undefined) {
    text = JSON.stringify(value);
    textOf.set(value, text);
  }
  return text;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function idOf(item: unknown): string | undefined {
  return isPlainObject(item) && typeof item.id === "string" ? item.id : undefined;
}

/** The held item to compare each incoming item against: by unique id where possible, else by position. */
function counterparts(previous: readonly unknown[], next: readonly unknown[]): (index: number) => unknown {
  const byId = new Map<string, unknown>();
  for (const item of previous) {
    const id = idOf(item);
    if (id === undefined || byId.has(id)) return (index) => previous[index];
    byId.set(id, item);
  }
  const seen = new Set<string>();
  for (const item of next) {
    const id = idOf(item);
    if (id === undefined || seen.has(id)) return (index) => previous[index];
    seen.add(id);
  }
  return (index) => byId.get(idOf(next[index])!);
}

function reuse(previous: unknown, next: unknown, depth: number, remember: boolean): unknown {
  if (Object.is(previous, next)) return previous;
  if (depth > 0 && Array.isArray(previous) && Array.isArray(next)) {
    const match = counterparts(previous, next);
    let unchanged = previous.length === next.length;
    const result = next.map((item, index) => {
      const kept = reuse(match(index), item, depth - 1, remember);
      if (kept !== previous[index]) unchanged = false;
      return kept;
    });
    return unchanged ? previous : result;
  }
  if (depth > 0 && isPlainObject(previous) && isPlainObject(next)) {
    const keys = Object.keys(next);
    let unchanged = keys.length === Object.keys(previous).length;
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      const kept = Object.hasOwn(previous, key) ? reuse(previous[key], next[key], depth - 1, remember) : next[key];
      if (kept !== previous[key] || !Object.hasOwn(previous, key)) unchanged = false;
      result[key] = kept;
    }
    return unchanged ? previous : result;
  }
  if (previous === undefined || previous === null || typeof previous !== "object") return next;
  if (next === null || typeof next !== "object") return next;
  const nextText = JSON.stringify(next);
  if (heldText(previous) === nextText) return previous;
  if (remember) textOf.set(next, nextText);
  return next;
}

/**
 * `next` with every part whose content equals the matching part of `previous` replaced by that held
 * part. Returns `previous` itself when nothing changed. `next` must already have passed the shared
 * state check; `previous` must be a payload this client already held.
 */
export function reuseUnchangedPayload<P>(previous: P | null | undefined, next: P): P {
  if (previous === null || previous === undefined) return next;
  return reuse(previous, next, PAYLOAD_DEPTH, true) as P;
}

/**
 * True when `next` has the same content as `previous`, a payload this client already held (and so
 * already checked). Used before the shared-state check, so it remembers nothing about `next`.
 */
export function payloadUnchanged<P>(previous: P | null | undefined, next: P): boolean {
  if (previous === null || previous === undefined) return false;
  return reuse(previous, next, PAYLOAD_DEPTH, false) === previous;
}
