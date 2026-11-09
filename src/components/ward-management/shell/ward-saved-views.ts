"use client";

import { createBrowserStore } from "@/lib/client-store-factory";
import { CORE_SEARCH_VIEWS } from "@/components/ward-management/search/ward-smart-search";

/**
 * MY VIEWS (feature 45, Josh 9 Nov 2026): each person saves a screen with its filters and returns to
 * it in one tap from search. Kept in this browser only.
 *
 * Privacy: a saved view holds a screen's address and its filter settings, never a person. Only the
 * app's main screens (the ones search lists) can be saved, so a patient's own page never can, and
 * only the address's filter parts are kept (`FILTER_PARAMS`). The name is the screen's own title,
 * never typed.
 */
export type SavedView = { id: string; title: string; href: string };

const KEY = "ward-flow-saved-views";
const CHANGE = "ward-flow-saved-views-change";
export const SAVED_VIEW_LIMIT = 12;

/**
 * The only address parts a saved view keeps: the main screens' own filter, tab and order settings
 * (Waiting's `delays-url-state.ts`, `useAddressTab` keys, Handover's `scope`, Forms' `view`). Anything
 * else, such as `referral`, `movement`, `record`, `admission`, `patientId`, `bed`, `alert` or `job`,
 * points at one record and is dropped, so a saved view reopens a list, never a person's form.
 */
const FILTER_PARAMS = new Set([
  "blocker",
  "due",
  "ed",
  "flow",
  "focus",
  "list",
  "locked",
  "order",
  "origin",
  "owner",
  "passed",
  "quiet",
  "scope",
  "service",
  "shift",
  "show",
  "site",
  "status",
  "tab",
  "view",
  "wait",
  "ward",
]);
/** A filter value is a short fixed id, never typed words or an encoded record address. */
const FILTER_VALUE = /^[A-Za-z0-9:_-]{1,40}$/u;

const EMPTY: readonly SavedView[] = [];
let cache: { raw: string | null; views: readonly SavedView[] } = { raw: null, views: EMPTY };
let fallback: readonly SavedView[] | null = null;

function isSavedView(value: unknown): value is SavedView {
  if (!value || typeof value !== "object") return false;
  const { id, title, href } = value as Record<string, unknown>;
  return typeof id === "string" && typeof title === "string" && typeof href === "string" && href.startsWith("/");
}

export function readSavedViews(): readonly SavedView[] {
  if (fallback) return fallback;
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.views;
  let views: readonly SavedView[] = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    views = Array.isArray(parsed) ? parsed.filter(isSavedView).slice(0, SAVED_VIEW_LIMIT) : EMPTY;
  } catch {
    views = EMPTY;
  }
  cache = { raw, views };
  return views;
}

function writeSavedViews(views: readonly SavedView[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(views));
    fallback = null;
  } catch {
    fallback = views;
  }
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

export const useSavedViews = createBrowserStore(subscribe, readSavedViews, EMPTY);

/** The address with only its filter parts, in a fixed order, or null for no screen. */
export function savableView(pathname: string, search: string): { title: string; href: string } | null {
  const screen = CORE_SEARCH_VIEWS.find((view) => view.href.split("?")[0] === pathname);
  if (!screen) return null;
  const params = new URLSearchParams(search);
  const kept = [...params.entries()]
    .filter(([key, value]) => FILTER_PARAMS.has(key) && FILTER_VALUE.test(value))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(kept).toString();
  return {
    title: kept.length > 0 ? `${screen.title}, filtered` : screen.title,
    href: query ? `${pathname}?${query}` : pathname,
  };
}

/** Saves the view (newest first) or, when it is already saved, removes it. True when now saved. */
export function toggleSavedView(view: { title: string; href: string }): boolean {
  const current = readSavedViews();
  if (current.some((saved) => saved.href === view.href)) {
    writeSavedViews(current.filter((saved) => saved.href !== view.href));
    return false;
  }
  // The first number no saved view of this name holds, so removing "(2)" frees it for the next save.
  const taken = new Set(current.map((saved) => saved.title));
  let number = 1;
  while (taken.has(number === 1 ? view.title : `${view.title} (${number})`)) number += 1;
  const title = number === 1 ? view.title : `${view.title} (${number})`;
  const id = `view-${Date.now().toString(36)}`;
  writeSavedViews([{ id, title, href: view.href }, ...current].slice(0, SAVED_VIEW_LIMIT));
  return true;
}
