"use client";

import { useEffect, useRef, useState } from "react";

import { readWardAccessSnapshot } from "@/components/ward-management/shell/ward-access-store";
import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

/**
 * Return to your place (usability item 3, 24 October 2026).
 *
 * Open a record from a list, then come back with Back or the header's back arrow, and the list is as
 * it was left: the same tab, filters, order and opened groups, and focus on the row that was opened.
 * The shell (`ward-shell.tsx`) already puts the work column back at the same scroll position on Back.
 * This puts back the list that scroll position was measured against, then the focus.
 *
 * Held in this tab's memory only, never in browser storage (D-18). One place per list route, holding
 * the list's own fixed choices and record ids. Typed search text is never part of it. A place is used
 * only on Back or Forward, as the shell's scroll is, and only by the same desk in the same world: a
 * desk change, the idle lock, a demo reset or the end of the session forgets it. Arriving any other
 * way, from the menu or a link, opens the list fresh as before.
 */

type Place = { view: unknown; row: string | null; access: object; world: string };

const places = new Map<string, Place>();
/** The row last opened on each list on screen, by record id. */
const openedRows = new Map<string, string>();
const mounted = new Set<string>();
let traversedTo: string | null = null;

if (typeof window !== "undefined") {
  // Back or Forward to a list that is not on screen. A history step inside a mounted list (a
  // drawer's own entry) is not a return.
  window.addEventListener("popstate", () => {
    const path = window.location.pathname;
    traversedTo = mounted.has(path) ? null : path;
  });
}
onWardSessionEnd(() => {
  places.clear();
  openedRows.clear();
  traversedTo = null;
});

function useWorldKey(): string {
  const world = useOptionalWardFlowSelect("scenario", "worldGeneration");
  return world ? `${world.scenario}/${world.worldGeneration}` : "";
}

function returningPlace(route: string, world: string): Place | null {
  const place = traversedTo === route ? places.get(route) : undefined;
  // Any change to the desk's access (a new desk, the idle lock, a grant) makes a new snapshot.
  return place && place.access === readWardAccessSnapshot() && place.world === world ? place : null;
}

/** The first element whose `attribute` is exactly `id`. Never builds a selector out of an id. */
export function rowWithAttribute(attribute: string, id: string, tag = ""): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(`${tag}[${attribute}]`)) {
    if (element.getAttribute(attribute) === id) return element;
  }
  return null;
}

/** A list calls this with a record's id as it opens it, so a return can focus that row again. */
export function rememberReturnRow(route: string, id: string): void {
  openedRows.set(route, id);
}

/** The view a list was left with when Back returns to it. Otherwise null, and the list opens fresh. */
export function useReturnedView<T>(route: string): T | null {
  const world = useWorldKey();
  const [view] = useState(() => (returningPlace(route, world)?.view as T | undefined) ?? null);
  return view;
}

/**
 * Keeps `view` and the row last opened (`rememberReturnRow`) for a return to `route`, and on a
 * return focuses that row again, found with `findRow`.
 */
export function useReturnToPlace<T>(route: string, view: T, findRow: (id: string) => HTMLElement | null): void {
  const world = useWorldKey();
  const latest = useRef<{ view: T; world: string; access: object | null; find: typeof findRow }>({
    view,
    world,
    access: null,
    find: findRow,
  });
  useEffect(() => {
    latest.current.view = view;
    latest.current.world = world;
    latest.current.find = findRow;
  });
  // Kept across React's development remount, so the return is read once and focused once.
  const returned = useRef<Place | null | undefined>(undefined);
  useEffect(() => {
    const state = latest.current;
    mounted.add(route);
    // The desk this list opened under. A desk change while it is open must not hand on its place.
    state.access ??= readWardAccessSnapshot();
    if (returned.current === undefined) {
      returned.current = returningPlace(route, state.world);
      if (traversedTo === route) traversedTo = null;
      openedRows.delete(route);
      if (returned.current?.row) openedRows.set(route, returned.current.row);
    }
    const row = returned.current?.row ?? null;
    let frame = 0;
    if (row !== null) {
      // Two frames, after the shell's own two-frame scroll restore, so focus lands on the row it shows.
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          const active = document.activeElement;
          // Something already took focus, such as a record the address opened.
          if (active !== null && active !== document.body) return;
          const target = latest.current.find(row);
          if (!target) return;
          target.focus({ preventScroll: true });
          target.scrollIntoView?.({ block: "nearest" });
        });
      });
    }
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mounted.delete(route);
      const opened = openedRows.get(route) ?? null;
      places.set(route, { view: state.view, row: opened, access: state.access!, world: state.world });
    };
  }, [route]);
}
