import type { WardFlowEvent } from "./ward-flow-events";

/** A command waiting to be sent to the shared workspace (split from ward-shared-client.ts for its size limit). */
export type PendingCommand = {
  dataMode: "prototype";
  classification: "synthetic";
  commandId: string;
  expectedRevision: number;
  /** Records the popups have seen at a later revision than `expectedRevision`, by token. */
  seen?: Record<string, number>;
  event: WardFlowEvent;
  /** Asked for while more commands are queued: an accepted reply then carries no snapshot. */
  reply?: "revision";
};

type QueuedCommand = {
  event: WardFlowEvent;
  commandId: string;
  confirmed: boolean;
  worldEpoch: number;
  /** The popups open when this was asked for (audit CS-19); it is checked against what they showed. */
  sheets?: readonly object[];
};
/**
 * What an open popup has shown (audit CS-19): the revision this tab held when it opened, and the
 * records (by the server's opaque tokens) it has since seen at a later revision through this tab's
 * own saves from it.
 */
type SheetSeen = { revision: number; records: Map<string, number> };
export type { QueuedCommand, SheetSeen };

/**
 * What a command from these popups is checked against: the oldest revision they showed, and each
 * record all of them have seen later, at the oldest of those. `undefined` when none is noted.
 */
export function sheetBasis(sheetSeen: WeakMap<object, SheetSeen>, sheets: readonly object[] | undefined) {
  const seen = (sheets ?? []).flatMap((sheet) => sheetSeen.get(sheet) ?? []);
  if (!seen.length) return undefined;
  const revision = Math.min(...seen.map((entry) => entry.revision));
  const records: Record<string, number> = {};
  for (const token of seen[0].records.keys()) {
    const at = Math.min(...seen.map((entry) => entry.records.get(token) ?? entry.revision));
    if (at > revision) records[token] = at;
  }
  return { revision, records };
}

/**
 * This tab's own save is not a change made while the person was looking, so popups and queued
 * commands based on the revision it was checked against move on with it. Only when nothing came
 * in between: otherwise another desk's save sits in the gap, and a later save from the same popup
 * is still checked against it. `tracked` lists the open popups and those of queued commands.
 */
export function markOwnSave(
  sheetSeen: WeakMap<object, SheetSeen>,
  tracked: () => Set<object>,
  from: number,
  to: number | undefined,
  sheets?: readonly object[],
  covered?: unknown,
) {
  if (to === undefined) return;
  const held = tracked();
  if (to === from + 1)
    for (const sheet of held) {
      const seen = sheetSeen.get(sheet);
      if (seen?.revision === from) seen.revision = to;
    }
  // Otherwise the server still names the records it checked against what these popups showed:
  // nobody else changed those since, so the popups have now seen them at this save.
  if (!Array.isArray(covered)) return;
  for (const sheet of sheets ?? [])
    for (const token of covered) if (typeof token === "string") sheetSeen.get(sheet)?.records.set(token, to);
}
