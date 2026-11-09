"use client";

import { useMemo } from "react";

import type { SearchResultGroup } from "./ward-global-search-groups";
import { savableView, toggleSavedView, useSavedViews, type SavedView } from "./shell/ward-saved-views";

type Item = SearchResultGroup["items"][number];

/** One saved screen as a search row. */
function savedViewItem(view: SavedView): Item {
  return {
    kind: "view",
    kindLabel: "My view",
    id: view.id,
    title: view.title,
    meta: "Saved in this browser",
    href: view.href,
  };
}

/**
 * MY VIEWS in search (feature 45, Josh 9 Nov 2026): the start screen lists a person's saved screens,
 * a typed name finds them, and Quick commands saves or removes the screen open behind search.
 */
export function useSearchMyViews(open: boolean, trimmed: string, canOpenHref: (href: string) => boolean) {
  const savedViews = useSavedViews();
  const startGroup = useMemo<SearchResultGroup | null>(() => {
    const mine = savedViews.filter((view) => canOpenHref(view.href));
    return mine.length > 0 ? { key: "myviews", heading: "My views", items: mine.map(savedViewItem) } : null;
  }, [savedViews, canOpenHref]);
  const matchGroup = useMemo<SearchResultGroup | null>(() => {
    const words = trimmed.toLowerCase().split(/\s+/u).filter(Boolean);
    if (words.length === 0) return null;
    const mine = words.every((word) => "my views saved".includes(word));
    const matches = savedViews.filter(
      (view) =>
        canOpenHref(view.href) && (mine || words.every((word) => `${view.title} my view`.toLowerCase().includes(word))),
    );
    return matches.length > 0 ? { key: "myviews", heading: "My views", items: matches.map(savedViewItem) } : null;
  }, [savedViews, trimmed, canOpenHref]);
  // The screen behind search, read only while search is open so the server render never needs it.
  const here =
    open && typeof window !== "undefined" ? savableView(window.location.pathname, window.location.search) : null;
  return {
    startGroup,
    matchGroup,
    savedHere: here ? savedViews.some((view) => view.href === here.href) : null,
    toggleHere: () => {
      if (here) toggleSavedView(here);
    },
  };
}
