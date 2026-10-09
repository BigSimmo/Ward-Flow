"use client";

import { useCallback, useEffect, useState } from "react";
import { BedDouble, Map as MapIcon, Route, type LucideIcon } from "lucide-react";

import { cx } from "@/components/wf";

import styles from "./statistics-view-bar.module.css";

export type StatisticsView = "board" | "journey" | "map";

const VIEWS: ReadonlyArray<{ id: StatisticsView; icon: LucideIcon; label: string; caption: string; key: string }> = [
  { id: "board", icon: BedDouble, label: "Bed board", caption: "Where beds are, by hospital", key: "1" },
  { id: "journey", icon: Route, label: "Journey", caption: "ED to discharge, by stage", key: "2" },
  { id: "map", icon: MapIcon, label: "Map", caption: "Every site across WA", key: "3" },
];

function viewFromHash(hash: string): StatisticsView {
  const id = hash.replace(/^#/, "");
  return id === "journey" || id === "map" ? id : "board";
}

/**
 * The Summary view, kept in the address as an anchor (#journey, #map; the bed board is the default
 * and #board also opens it), so a view can be linked, bookmarked and reached with Back. Read after
 * mount, so the server render and the first client render agree on the bed board.
 */
export function useStatisticsView() {
  const [view, setView] = useState<StatisticsView>("board");

  useEffect(() => {
    const sync = () => setView(viewFromHash(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const choose = useCallback((next: StatisticsView) => {
    setView(next);
    const { pathname, search } = window.location;
    const url = next === "board" ? `${pathname}${search}` : `${pathname}${search}#${next}`;
    if (`${pathname}${search}${window.location.hash}` !== url) window.history.pushState(null, "", url);
  }, []);

  // 1, 2 and 3 switch the view, unless a field or a control with its own keys has focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
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

/** Three large switches under the Summary hero: the bed board, the patient journey and the WA map. */
export function StatisticsViewBar({
  view,
  onChoose,
}: {
  view: StatisticsView;
  onChoose: (view: StatisticsView) => void;
}) {
  return (
    <nav className={styles.bar} aria-label="Summary view" data-testid="ward-statistics-view-bar">
      {VIEWS.map((item) => {
        const Icon = item.icon;
        const on = item.id === view;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={cx(styles.item, on && styles.on)}
            aria-current={on ? "page" : undefined}
            aria-keyshortcuts={item.key}
            data-testid={`ward-statistics-view-${item.id}`}
            onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onChoose(item.id);
            }}
          >
            <span className={styles.icon} aria-hidden="true">
              <Icon size={16} aria-hidden="true" />
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{item.label}</span>
              <span className={styles.caption}>{item.caption}</span>
            </span>
            <kbd className={styles.kbd} aria-hidden="true">
              {item.key}
            </kbd>
          </a>
        );
      })}
    </nav>
  );
}
