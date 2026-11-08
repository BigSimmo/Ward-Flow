"use client";

/**
 * Call and log (Josh, 8 Nov 2026): what a ward told the coordinator on the phone, kept on this
 * device only, like Remind me. Every field is picked from a list (a ward, a fixed outcome, a time),
 * so nothing a person types is ever stored. Emptied at sign-out. It never changes a ward's bed
 * figures: only the ward confirms its own beds. Prototype only: synthetic data.
 */
import { createBrowserStore } from "@/lib/client-store-factory";
import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";
import type { Instant } from "@/components/ward-management/ward-clock";

export const CALL_OUTCOMES = ["as-shown", "later", "none", "no-answer"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export type CallLogEntry = {
  id: string;
  wardId: string;
  /** Built from list values only: the ward's name. */
  wardLabel: string;
  outcome: CallOutcome;
  /** "A bed later today": about when, on the board clock. */
  bedAt?: Instant;
  /** Board clock time the call was logged. */
  at: Instant;
};

const KEY = "wf-mock-tools-call-log";
const KEEP = 30;
const EMPTY: readonly CallLogEntry[] = [];
let entries: readonly CallLogEntry[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function isEntry(value: unknown): value is CallLogEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.wardId === "string" &&
    typeof e.wardLabel === "string" &&
    typeof e.at === "number" &&
    (e.bedAt === undefined || typeof e.bedAt === "number") &&
    (CALL_OUTCOMES as readonly unknown[]).includes(e.outcome)
  );
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    entries = Array.isArray(parsed) ? parsed.filter(isEntry) : EMPTY;
  } catch {
    entries = EMPTY;
  }
}

function set(next: readonly CallLogEntry[]) {
  entries = next;
  try {
    if (next.length === 0) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked or full: the log still holds for this visit.
  }
  for (const listener of listeners) listener();
}

onWardSessionEnd(() => {
  if (typeof window !== "undefined") set(EMPTY);
});

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export const useCallLog = createBrowserStore(
  subscribe,
  () => {
    load();
    return entries;
  },
  EMPTY,
);

/** Newest first; the oldest drop off past the last thirty. */
export function addCallLog(input: Omit<CallLogEntry, "id">): void {
  load();
  const id = `c-${Date.now().toString(36)}-${entries.length}`;
  set([{ ...input, id }, ...entries].slice(0, KEEP));
}

export function removeCallLog(id: string): void {
  load();
  set(entries.filter((entry) => entry.id !== id));
}
