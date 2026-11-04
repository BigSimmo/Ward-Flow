/**
 * The synthetic hospital feed inbox (fix plan item 5, 21 Oct 2026): the messages received this
 * session and what a person did with each. Memory only, for this tab: it is never saved, and it
 * empties at sign-out and when the demo world changes, so no message outlives the demo it came from.
 */
import { createBrowserStore } from "@/lib/client-store-factory";
import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";
import { readFeedMessage, type FeedMessage } from "@/components/ward-management/integration/hospital-feed";

type FeedItemStatus = "waiting" | "confirmed" | "rejected" | "refused";

export type FeedItem = {
  /** Position in the inbox, 1 for the first message received. */
  seq: number;
  status: FeedItemStatus;
  /** The read message; absent when it was refused before it could be read. */
  message?: FeedMessage;
  /** Why it was refused, or what confirming it recorded. */
  note?: string;
};

type Inbox = {
  generation: number | null;
  received: number;
  /** The simulated messages, fixed at the first one received, so closing Tools cannot reshuffle them. */
  script: readonly string[] | null;
  items: readonly FeedItem[];
  /** Original item identities whose command still needs a final answer, across Tools openings. */
  pending: readonly FeedItem[];
};

const EMPTY: Inbox = { generation: null, received: 0, script: null, items: [], pending: [] };
let inbox: Inbox = EMPTY;
const listeners = new Set<() => void>();

function set(next: Inbox) {
  inbox = next;
  for (const listener of listeners) listener();
}

onWardSessionEnd(() => set(EMPTY));

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export const useFeedInbox = createBrowserStore(subscribe, () => inbox, EMPTY);

/** Empties the inbox when the demo world it came from has been replaced. */
export function syncFeedInboxGeneration(generation: number): void {
  if (inbox.generation !== generation) set({ ...EMPTY, generation });
}

/** Keeps the messages still to come as they were when the first one arrived. */
export function startFeedScript(messages: readonly string[]): void {
  if (!inbox.script) set({ ...inbox, script: messages });
}

/**
 * Receives one raw message: refused when it cannot be read or is not synthetic, refused as a
 * duplicate when its control id was already received, otherwise waiting for a person.
 */
export function receiveFeedMessage(raw: string): FeedItem {
  const seq = inbox.items.length + 1;
  const read = readFeedMessage(raw);
  let item: FeedItem;
  if (!read.ok) item = { seq, status: "refused", note: read.reason };
  else if (inbox.items.some((existing) => existing.message?.controlId === read.message.controlId))
    item = {
      seq,
      status: "refused",
      message: read.message,
      note: `Refused: message ${read.message.controlId} was already received.`,
    };
  else item = { seq, status: "waiting", message: read.message };
  set({ ...inbox, received: inbox.received + 1, items: [...inbox.items, item] });
  return item;
}

/** A reused sequence or control ID after reset is a different message. */
export function isCurrentFeedItem(item: FeedItem): boolean {
  return inbox.items.includes(item);
}

export function beginFeedConfirmation(item: FeedItem): boolean {
  if (!isCurrentFeedItem(item) || item.status !== "waiting" || inbox.pending.includes(item)) return false;
  set({ ...inbox, pending: [...inbox.pending, item] });
  return true;
}

export function endFeedConfirmation(item: FeedItem): void {
  if (inbox.pending.includes(item)) set({ ...inbox, pending: inbox.pending.filter((pending) => pending !== item) });
}

/** Records the original waiting message only, never a replacement with the same sequence. */
export function settleFeedItem(expected: FeedItem, status: "confirmed" | "rejected", note?: string): boolean {
  if (!isCurrentFeedItem(expected) || expected.status !== "waiting") return false;
  set({
    ...inbox,
    pending: inbox.pending.filter((item) => item !== expected),
    items: inbox.items.map((item) => (item === expected ? { ...item, status, ...(note ? { note } : {}) } : item)),
  });
  return true;
}

/** Test-only reset. */
export function resetFeedInboxForTests(): void {
  set(EMPTY);
}
