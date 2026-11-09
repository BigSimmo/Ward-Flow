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

/** The words a typed query is matched against: each starts a title word or the "my views" words. */
const MY_VIEWS_WORDS = ["my", "view", "views", "saved"];

function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Whether a typed query finds a saved view: every typed word must start a word of its title or of
 * "my views saved". A query of keyword words alone ("my views") lists them all, but only once it has
 * at least two letters, so "e" or "s" never floods search with every saved view.
 */
export function savedViewMatches(title: string, query: string): boolean {
  const words = wordsOf(query);
  if (words.length === 0) return false;
  const titleWords = wordsOf(title);
  const startsOne = (word: string, among: readonly string[]) => among.some((candidate) => candidate.startsWith(word));
  if (!words.every((word) => startsOne(word, titleWords) || startsOne(word, MY_VIEWS_WORDS))) return false;
  const keywordOnly = words.every((word) => !startsOne(word, titleWords));
  return !keywordOnly || words.join("").length >= 2;
}

/**
 * MY VIEWS in search (feature 45, Josh 9 Nov 2026): the start screen lists a person's saved screens,
 * a typed name finds them, and Quick commands saves or removes the screen open behind search. Every
 * row goes through `permit`, the same desk gate as search's other rows.
 */
export function useSearchMyViews(open: boolean, trimmed: string, permit: (item: Item) => Item[]) {
  const savedViews = useSavedViews();
  const startGroup = useMemo<SearchResultGroup | null>(() => {
    const mine = savedViews.map(savedViewItem).flatMap(permit);
    return mine.length > 0 ? { key: "myviews", heading: "My views", items: mine } : null;
  }, [savedViews, permit]);
  const matchGroup = useMemo<SearchResultGroup | null>(() => {
    const matches = savedViews
      .filter((view) => savedViewMatches(view.title, trimmed))
      .map(savedViewItem)
      .flatMap(permit);
    return matches.length > 0 ? { key: "myviews", heading: "My views", items: matches } : null;
  }, [savedViews, trimmed, permit]);
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
