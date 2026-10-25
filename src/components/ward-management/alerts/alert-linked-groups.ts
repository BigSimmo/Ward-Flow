import { admissionIdOfInboxId, movementIdOfInboxId, personIdOfInboxId } from "./alerts-model";

/**
 * Closing-the-loop features (24 Oct 2026, package E): "Group duplicate alerts".
 *
 * Several alerts can come from one recorded issue: one late transport booking can raise a "transport
 * not yet left" row, a "bed hold expired" row and a running transport target, all on the same
 * journey. This shows them as one grouped item that lists each alert, so the coordinator sees one
 * issue with its parts rather than three unrelated rows.
 *
 * 🔒 **GROUPED BY RECORDED LINKS ONLY.** Two alerts share an item only when their own rows name the
 * same journey, stay or person (`movementId`, or the record their id names). Nothing is inferred
 * from wording, timing or likeness.
 *
 * 🔒 **RECORDED ORDER, NEVER RE-SORTED.** The item sits where its first alert would have sat, reading
 * the sections in the order the screen already shows them, and its alerts keep their own order.
 * There is no score and no ranking. Every alert stays its own row inside the item, with its own open
 * button and action, so each one is still reachable. Section counts are untouched: they count alerts.
 */

/** The record an alert row names, by its recorded link. Undefined when it names none. */
export function linkedRecordKey(entry: { item: { id: string; movementId: string } }): string | undefined {
  const { id, movementId } = entry.item;
  const movement = movementId || movementIdOfInboxId(id);
  if (movement) return `movement:${movement}`;
  const admission = admissionIdOfInboxId(id);
  if (admission) return `admission:${admission}`;
  const person = personIdOfInboxId(id);
  return person ? `person:${person}` : undefined;
}

export type LinkedQueueItem<E> =
  | { kind: "single"; entry: E }
  /** Two or more alerts naming one record. `sections` says which section each alert counts in. */
  | { kind: "linked"; key: string; entries: E[]; sections: number[] };

export type LinkedSections<E> = {
  sections: LinkedQueueItem<E>[][];
  /** Per section: how many of its alerts are shown inside a linked item in an earlier section. */
  shownEarlier: number[];
};

/**
 * Groups alerts naming the same record across `sections` (each already in its recorded order).
 * A record with a single alert stays a plain row. Pure: called on every render, so a group forms,
 * grows, shrinks or dissolves as the underlying records change.
 */
export function groupLinkedAlerts<E extends { item: { id: string; movementId: string } }>(
  sections: readonly (readonly E[])[],
): LinkedSections<E> {
  const members = new Map<string, { entry: E; section: number }[]>();
  sections.forEach((list, section) => {
    for (const entry of list) {
      const key = linkedRecordKey(entry);
      if (key === undefined) continue;
      const found = members.get(key);
      if (found) found.push({ entry, section });
      else members.set(key, [{ entry, section }]);
    }
  });

  const placed = new Set<string>();
  const shownEarlier = sections.map(() => 0);
  const grouped = sections.map((list, section) => {
    const items: LinkedQueueItem<E>[] = [];
    for (const entry of list) {
      const key = linkedRecordKey(entry);
      const group = key === undefined ? undefined : members.get(key);
      if (key === undefined || !group || group.length < 2) {
        items.push({ kind: "single", entry });
        continue;
      }
      if (placed.has(key)) {
        // Already shown inside the item an earlier section holds.
        if (group[0]!.section !== section) shownEarlier[section] = (shownEarlier[section] ?? 0) + 1;
        continue;
      }
      placed.add(key);
      items.push({
        kind: "linked",
        key,
        entries: group.map((member) => member.entry),
        sections: group.map((member) => member.section),
      });
    }
    return items;
  });
  return { sections: grouped, shownEarlier };
}
