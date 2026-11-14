import type { Instant } from "./ward-clock";
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
  /**
   * H1 (D-MCA (Josh, 14 Nov 2026), ruling 1): the board minute the person pressed the save at,
   * beside the command so every retry sends the same body. The server stamps a save that arrives
   * within a minute with its own time, and keeps this time for one that waited (`ward-offline-entry.ts`).
   */
  actedAt?: Instant;
};

type QueuedCommand = {
  event: WardFlowEvent;
  commandId: string;
  confirmed: boolean;
  worldEpoch: number;
  /** The popups open when this was asked for (audit CS-19); it is checked against what they showed. */
  sheets?: readonly object[];
  /** Made or held while this desk was offline, for the "while you were offline" message (audit M10). */
  offline?: boolean;
  /** H1: the board minute this was asked for at (`PendingCommand.actedAt`). */
  actedAt?: Instant;
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
  const candidates = new Set(seen.flatMap((entry) => [...entry.records.keys()]));
  for (const token of candidates) {
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

/**
 * Tier 1 item 1: a save held while offline is pinned to the board it was made on, so when it is
 * sent later the server refuses it if another desk changed the record meanwhile, rather than it
 * overwriting that change (CS-19). One already tied to an open popup keeps that popup's basis.
 */
export function pinToBoard(
  queue: QueuedCommand[],
  sheetSeen: WeakMap<object, SheetSeen>,
  revision: number,
  offline: boolean,
) {
  for (const queued of queue) {
    queued.offline ||= offline;
    if (queued.sheets?.some((sheet) => sheetSeen.has(sheet))) continue;
    const pin = {};
    sheetSeen.set(pin, { revision, records: new Map() });
    queued.sheets = [pin];
  }
}

type BoardStays = { payload: { state: { admissions: readonly { id: string; unitId: string; bedNumber?: number }[] } } };

/**
 * D-151: the beds that a save waiting on this page will change, as `unitId:bedNumber`, so the bed
 * tile can say "Waiting to save". Read from memory only, like the queue itself (D-18, D-72, D-124).
 * A step on a stay (a bed move, `PLACE_IN_BED`, and its Undo) names no unit, so its beds are found
 * from the stay on this page's board: the bed it is in now, and the bed it is moving to.
 */
export function waitingBedKeys(
  commands: readonly ({ event: WardFlowEvent } | null)[],
  next?: BoardStays | null,
  current?: BoardStays | null,
): string[] {
  // The board about to be published (`next`, null when it is cleared), else the one shown now.
  const admissions = (next === undefined ? current : next)?.payload.state.admissions ?? [];
  const keys = new Set<string>();
  for (const command of commands) {
    const event = command?.event as
      { unitId?: unknown; bedNumber?: unknown; admissionId?: unknown; actingUnitId?: unknown } | undefined;
    if (!event) continue;
    const stay =
      typeof event.admissionId === "string" ? admissions.find((entry) => entry.id === event.admissionId) : undefined;
    const unitId =
      typeof event.unitId === "string"
        ? event.unitId
        : typeof event.actingUnitId === "string"
          ? event.actingUnitId
          : stay?.unitId;
    if (typeof unitId === "string" && typeof event.bedNumber === "number") keys.add(`${unitId}:${event.bedNumber}`);
    if (stay && typeof stay.bedNumber === "number" && typeof event.unitId !== "string")
      keys.add(`${stay.unitId}:${stay.bedNumber}`);
  }
  return [...keys];
}
