"use client";

/*
 * the Midland team's referral decisions, kept in this browser (localStorage) so an
 * "Accept for Midland" really records the answer: the referral leaves To answer, joins Answered,
 * and the counts stay changed after a reload. Demo data only; nothing goes to the server.
 */

import { useSyncExternalStore } from "react";

export const MIDLAND_DECISIONS_KEY = "ward-flow:midland-decisions:v1";

export type MidlandDecision = { id: string; line: string; at: number };

const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Record<string, MidlandDecision> } = { raw: null, value: {} };
const EMPTY: Record<string, MidlandDecision> = {};

function read(): Record<string, MidlandDecision> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(MIDLAND_DECISIONS_KEY);
  } catch {
    return cache.value;
  }
  if (raw === cache.raw) return cache.value;
  let value: Record<string, MidlandDecision> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [id, d] of Object.entries(parsed as Record<string, unknown>)) {
        const rec = d as Partial<MidlandDecision> | null;
        if (rec && typeof rec.line === "string" && typeof rec.at === "number")
          value[id] = { id, line: rec.line, at: rec.at };
      }
    }
  } catch {
    value = {};
  }
  cache = { raw, value };
  return value;
}

function write(next: Record<string, MidlandDecision>) {
  try {
    window.localStorage.setItem(MIDLAND_DECISIONS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the in-memory cache still carries the decision for this page */
    cache = { raw: cache.raw, value: next };
  }
  listeners.forEach((l) => l());
}

export function recordMidlandDecision(id: string, line: string, at = Date.now()) {
  write({ ...read(), [id]: { id, line, at } });
}

export function undoMidlandDecision(id: string) {
  const next = { ...read() };
  delete next[id];
  write(next);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === MIDLAND_DECISIONS_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useMidlandDecisions(): Record<string, MidlandDecision> {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Referrals still to answer, each with its index in the full list (pages navigate by that index). */
export function openReferrals<T extends { id: string }>(all: readonly T[], decided: Record<string, MidlandDecision>) {
  return all.map((r, index) => ({ r, index })).filter(({ r }) => !decided[r.id]);
}
