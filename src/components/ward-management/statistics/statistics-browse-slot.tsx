"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Network's Browse card (simplification mock-up, 26 Nov 2026). The four index pages' bodies show
 * on Network as segments of one Browse card. Kept apart from the card itself, as the view switch slot
 * is, so the cards that read it pull in nothing else.
 *
 * - `BrowseEmbed`: a segment's index body renders inside Network, so its page frame (hero, tabs,
 *   footer) is left out and its long lists stop at eight rows.
 * - `LeadsBrowse`: marks the segment's first card. Its head becomes the Browse head: "Browse", the
 *   segment switch, and the card's own title as the meta line; its own control moves into the body.
 */

const BrowseEmbedded = createContext<{ switcher: ReactNode } | null>(null);
const BrowseLead = createContext<ReactNode | null>(null);

/** Network's hero "Show wards" (audit three #6): Browse switches to its Wards segment. */
export const SHOW_WARDS_EVENT = "wf-statistics-show-wards";

/** Rows a Browse segment shows before Show more. */
export const BROWSE_ROWS = 8;

export function BrowseEmbed({ switcher, children }: { switcher: ReactNode; children: ReactNode }) {
  return <BrowseEmbedded.Provider value={{ switcher }}>{children}</BrowseEmbedded.Provider>;
}

export function LeadsBrowse({ children }: { children: ReactNode }) {
  const embed = useContext(BrowseEmbedded);
  // No switch (one segment open to this desk): the lead card keeps its own head.
  return <BrowseLead.Provider value={embed?.switcher ?? null}>{children}</BrowseLead.Provider>;
}

/** True inside a Browse segment. */
export function useBrowseEmbedded(): boolean {
  return useContext(BrowseEmbedded) !== null;
}

/** The segment switch, for the segment's first card only; null everywhere else. */
export function useBrowseLead(): ReactNode | null {
  return useContext(BrowseLead);
}

/** The Browse head's meta line: the lead card's own title, then its meta. */
export function browseMeta(title: ReactNode, meta: ReactNode): ReactNode {
  return meta === undefined || meta === null || meta === "" ? (
    title
  ) : (
    <>
      {title} · {meta}
    </>
  );
}
