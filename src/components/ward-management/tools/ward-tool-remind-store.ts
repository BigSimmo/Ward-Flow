"use client";

/**
 * Tools mock-up (Q323): the person's own reminders, kept on this device only. Every field is picked
 * from a list (a ward, a bed number, a movement's record number, a fixed reason), so nothing a
 * person types is ever stored. Emptied at sign-out. Prototype only: synthetic data.
 */
import { createBrowserStore } from "@/lib/client-store-factory";
import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";
import type { Instant } from "@/components/ward-management/ward-clock";

/**
 * Root cause 5.2 (Josh approved, 13 Nov 2026, Q8): reminders and the call log are kept in this
 * browser only, in demo and signed-in modes alike, and are not part of the shared record. Every
 * place they are shown or made says so in these words. Moving them into the shared record comes later.
 */
export const DEVICE_ONLY_LABEL = "On this device only";

export const REMIND_REASONS = ["Check the bed", "Call back", "Chase a form", "Review transport"] as const;
export type RemindReason = (typeof REMIND_REASONS)[number];
export type RemindKind = "ward" | "bed" | "movement";

export type Reminder = {
  id: string;
  kind: RemindKind;
  /** A ward id, `<wardId>:<bed>` or a movement id. */
  targetId: string;
  /** Built from list values only: "Ward 3B", "Bed 04, Ward 3B", "WF-311". */
  targetLabel: string;
  reason: RemindReason;
  /** Board clock time it is due. */
  dueAt: Instant;
};

const KEY = "wf-mock-tools-reminders";
const EMPTY: readonly Reminder[] = [];
let reminders: readonly Reminder[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function isReminder(value: unknown): value is Reminder {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    (r.kind === "ward" || r.kind === "bed" || r.kind === "movement") &&
    typeof r.targetId === "string" &&
    typeof r.targetLabel === "string" &&
    typeof r.dueAt === "number" &&
    (REMIND_REASONS as readonly unknown[]).includes(r.reason)
  );
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    reminders = Array.isArray(parsed) ? parsed.filter(isReminder) : EMPTY;
  } catch {
    reminders = EMPTY;
  }
}

function set(next: readonly Reminder[]) {
  reminders = next;
  try {
    if (next.length === 0) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked or full: the reminders still hold for this visit.
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

export const useReminders = createBrowserStore(
  subscribe,
  () => {
    load();
    return reminders;
  },
  EMPTY,
);

export function addReminder(input: Omit<Reminder, "id">): void {
  load();
  const id = `r-${Date.now().toString(36)}-${reminders.length}`;
  set([...reminders, { ...input, id }].sort((left, right) => left.dueAt - right.dueAt));
}

export function removeReminder(id: string): void {
  load();
  set(reminders.filter((reminder) => reminder.id !== id));
}

/** Each ward's name, with its site code added only where two wards share a name. */
export function wardNames(units: readonly { id: string; name: string; siteCode: string }[]): Map<string, string> {
  const seen = new Map<string, number>();
  for (const unit of units) seen.set(unit.name, (seen.get(unit.name) ?? 0) + 1);
  return new Map(
    units.map((unit) => [unit.id, seen.get(unit.name)! > 1 ? `${unit.name}, ${unit.siteCode}` : unit.name]),
  );
}
