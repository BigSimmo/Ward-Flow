"use client";

import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { useCallback, useEffect, useState } from "react";

export type StatisticsView = "board" | "journey" | "map";

/** The Summary's views and the keys that switch to them (the switch itself: `statistics-view-switch.tsx`). */
const VIEWS: ReadonlyArray<{ id: StatisticsView; key: string }> = [
  { id: "board", key: "1" },
  { id: "journey", key: "2" },
  { id: "map", key: "3" },
];

function viewFromHash(hash: string): StatisticsView {
  // A card inside a view (#journey-stages, #map-rank) opens that view too.
  const id = hash.replace(/^#/, "");
  if (id === "journey" || id.startsWith("journey-")) return "journey";
  if (id === "map" || id.startsWith("map-")) return "map";
  return "board";
}

/**
 * The Summary view, kept in the address as an anchor (#journey, #map; the bed board is the default
 * and #board also opens it), so a view can be linked, bookmarked and reached with Back. Read after
 * mount, so the server render and the first client render agree on the bed board.
 */
export function useStatisticsView() {
  const [view, setView] = useState<StatisticsView>("board");
  const [hash, setHash] = useState<string>("");

  useEffect(() => {
    const sync = () => {
      const currentHash = typeof window !== "undefined" ? window.location.hash : "";
      setHash(currentHash);
      setView(viewFromHash(currentHash));
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  // A link to a card inside a view (#journey-stages) lands on that card once the view has drawn it.
  // The view is code-split, so its card can appear after the view finishes loading.
  useEffect(() => {
    const id = hash.replace(/^#/, "");
    if (!id || id === view || viewFromHash(`#${id}`) !== view) return;

    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let frame = 0;

    const land = () => {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ block: "start" });
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        return true;
      }
      return false;
    };

    if (!land()) {
      if (typeof MutationObserver !== "undefined") {
        observer = new MutationObserver(() => {
          land();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        let attempts = 0;
        const retry = () => {
          if (land()) return;
          if (++attempts < 300) frame = window.requestAnimationFrame(retry);
        };
        frame = window.requestAnimationFrame(retry);
      }

      timer = setTimeout(() => {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }, 10000);
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [view, hash]);

  const choose = useCallback((next: StatisticsView) => {
    setView(next);
    const { pathname, search } = window.location;
    const nextHash = next === "board" ? "" : `#${next}`;
    setHash(nextHash);
    const url = next === "board" ? `${pathname}${search}` : `${pathname}${search}#${next}`;
    if (`${pathname}${search}${window.location.hash}` !== url) window.history.pushState(null, "", url);
  }, []);

  // 1, 2 and 3 switch the view, unless a field or a control with its own keys has focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        !areCharacterShortcutsEnabled() ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.defaultPrevented
      )
        return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [role='listbox']"))
        return;
      const match = VIEWS.find((item) => item.key === event.key);
      if (!match) return;
      event.preventDefault();
      choose(match.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose]);

  return { view, choose };
}
