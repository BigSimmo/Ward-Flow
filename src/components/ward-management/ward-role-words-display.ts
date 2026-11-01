import { EARLIER_ROLE_LABELS, WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";

/**
 * Q77 (Josh, 31 Oct 2026): every screen shows a record saved before the role names changed under
 * the new names. Display only. The saved record keeps its earlier words (Q66), so this runs on the
 * copy the screens read, never on the state that is saved, synced or reduced.
 *
 * A value is changed only when it is exactly one of the earlier role words (`EARLIER_ROLE_LABELS`)
 * and sits under a key that holds who recorded something: `by`, `role`, or a key ending in `By`,
 * `Role` or `Label`. Anything else, such as a ward name or a free-standing word in a sentence, is
 * left as it is. Unchanged branches keep their identity, so a workspace with no earlier words is
 * returned as the same object.
 */
const ROLE_TEXT_KEY = /^(by|role)$|(By|Role|Label)$/;

function currentWords(value: string): string {
  const role = Object.hasOwn(EARLIER_ROLE_LABELS, value) ? EARLIER_ROLE_LABELS[value] : undefined;
  return role === undefined ? value : WARD_FLOW_ROLE_LABELS[role];
}

/**
 * Each record's display copy, kept for as long as the record itself. Records are never changed in
 * place, so a record that a change did not touch keeps its display copy too, and a screen that reads
 * only that part of the workspace is not woken. A list's copy is kept with the key it sits under,
 * because that key decides what its text becomes.
 */
const shownRecords = new WeakMap<object, unknown>();
const shownLists = new WeakMap<readonly unknown[], { key: string | null; result: unknown }>();

function shown(value: unknown, key: string | null): unknown {
  if (typeof value === "string") return key !== null && ROLE_TEXT_KEY.test(key) ? currentWords(value) : value;
  if (Array.isArray(value)) {
    const keptList = shownLists.get(value);
    if (keptList !== undefined && keptList.key === key) return keptList.result;
    let changed = false;
    const next = value.map((item) => {
      const after = shown(item, key);
      if (!Object.is(after, item)) changed = true;
      return after;
    });
    const result = changed ? next : value;
    shownLists.set(value, { key, result });
    return result;
  }
  if (value === null || typeof value !== "object") return value;
  const kept = shownRecords.get(value);
  if (kept !== undefined) return kept;
  let next: Record<string, unknown> | null = null;
  for (const [field, item] of Object.entries(value)) {
    const after = shown(item, field);
    if (Object.is(after, item)) continue;
    next ??= { ...(value as Record<string, unknown>) };
    next[field] = after;
  }
  const result = next ?? value;
  shownRecords.set(value, result);
  return result;
}

/** The workspace as the screens show it: earlier role words read in the new names. */
export function withCurrentRoleWords<T extends object>(state: T): T {
  return shown(state, null) as T;
}
