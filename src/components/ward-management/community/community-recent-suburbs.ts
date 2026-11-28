"use client";

import { createBrowserStore } from "@/lib/client-store-factory";

import { catchmentLookupsFor, isPostcodeQuery } from "./community-suburb-lookup";

/**
 * The suburb lookup's recent searches (audit three #65, 27 Nov 2026): the last few suburbs looked up
 * this session stand in for the sample quick picks once there are any.
 *
 * Only a suburb's own name from the catchment documents is stored, never the typed words: a lookup
 * is recorded only when the words name one known suburb (or its alias), and then the document's
 * spelling is what is kept. A part word, a postcode or an unknown name stores nothing. No patient
 * text reaches this list. This session only (sessionStorage, Josh must confirm device storage first), unlike Find's pinned and recent places
 * (`hub-browser-memory.ts`), with every read and write wrapped.
 */
const RECENT_SUBURB_LIMIT = 6;
const RECENT_SUBURB_KEY = "ward-community-suburb-recent";
const RECENT_SUBURB_EVENT = "ward-community-suburb-recent-change";

function readSuburbs(): string[] {
  try {
    const raw = window.sessionStorage.getItem(RECENT_SUBURB_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string").slice(0, RECENT_SUBURB_LIMIT);
  } catch {
    return [];
  }
}

let cachedRaw: string | null = null;
let cachedSuburbs: readonly string[] = [];
const NO_SUBURBS: readonly string[] = [];

function snapshot(): readonly string[] {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(RECENT_SUBURB_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedSuburbs;
  cachedRaw = raw;
  cachedSuburbs = readSuburbs();
  return cachedSuburbs;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(RECENT_SUBURB_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(RECENT_SUBURB_EVENT, onChange);
  };
}

export const useRecentSuburbs = createBrowserStore(subscribe, snapshot, NO_SUBURBS);

/** Records the suburb the words name, by its document spelling; anything else stores nothing. */
export function recordSuburbLookup(rawQuery: string): void {
  const query = rawQuery.trim();
  if (!query || isPostcodeQuery(query)) return;
  const [lookup] = catchmentLookupsFor(query);
  if (!lookup || lookup.state === "unknown" || !lookup.suburb) return;
  const suburb = lookup.suburb;
  const next = [suburb, ...readSuburbs().filter((entry) => entry !== suburb)].slice(0, RECENT_SUBURB_LIMIT);
  try {
    window.sessionStorage.setItem(RECENT_SUBURB_KEY, JSON.stringify(next));
  } catch {
    // Private browsing or quota exhaustion: the picks stay as they were.
  }
  try {
    window.dispatchEvent(new Event(RECENT_SUBURB_EVENT));
  } catch {
    // Nothing depends on the notification.
  }
}
