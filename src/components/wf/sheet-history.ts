"use client";

import { useEffect, useRef } from "react";
import { setSheetHistorySteps } from "./sheet-focus";
import { WF_PHONE_QUERY } from "./use-is-phone";

/**
 * S5 (Josh, 4 Nov 2026): on a phone the Back gesture closes the open sheet first instead of leaving
 * the page. One place for it, used by the kit `Sheet` (and so `PanelDrawer` and `Drawer`) and
 * `PhoneSheet`:
 *
 * - opening pushes one same-address history entry, marked with its depth (`__wfSheet`);
 * - Back lands on the entry below, and every sheet above that depth is asked to close, top first
 *   (nested sheets close one per Back);
 * - an ordinary close (X, Esc, outside tap, a saved step) steps back over its own entry once, so a
 *   later Back leaves the page as before; closes in one commit share one step;
 * - when the address changed while the sheet was open (a link inside it went to another page), its
 *   entry is left alone, so closing never undoes that navigation.
 *
 * The current history state is copied into the new entry, so Next's router keeps its own record of
 * the page. A sheet whose page already gives it a history entry (the bar's drawers, the movement
 * record) opts out with `closeOnBack={false}`.
 */

const KEY = "__wfSheet";

type Entry = { closed: boolean; href: string; onBack: () => void };

const stack: Entry[] = [];
// Our own history.go(-n) fires one popstate that is not a person pressing Back. The count lives in
// sheet-focus.ts, where the unsaved-form guard reads it (`sheetHistoryStepInFlight`).
let ownTraversals = 0;
let ownTraversalTimer: ReturnType<typeof setTimeout> | null = null;
let listening = false;
let flushQueued = false;

function depthOf(state: unknown): number {
  const value = state && typeof state === "object" ? (state as Record<string, unknown>)[KEY] : undefined;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function handlePopState(event: PopStateEvent) {
  if (ownTraversals > 0) {
    ownTraversals -= 1;
    setSheetHistorySteps(ownTraversals);
    return;
  }
  const depth = depthOf(event.state);
  // Everything above the entry Back landed on closes, the top one first.
  while (stack.length > depth) {
    const entry = stack.pop()!;
    if (!entry.closed) {
      entry.closed = true;
      entry.onBack();
    }
  }
  // A close left an entry below (a sheet that closed while another sat on it): step over it too.
  if (stack.length > 0 && stack[stack.length - 1]!.closed && !flushQueued) {
    flushQueued = true;
    queueMicrotask(flush);
  }
}

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("popstate", handlePopState);
}

function flush() {
  flushQueued = false;
  const depthBefore = stack.length;
  const topHref = stack[stack.length - 1]?.href;
  let steps = 0;
  while (stack.length > 0 && stack[stack.length - 1]!.closed) {
    stack.pop();
    steps += 1;
  }
  if (steps === 0 || typeof window === "undefined") return;
  // Only step back while our own top entry is still the current one: after a link inside the
  // sheet went somewhere else, Back would undo that navigation.
  if (depthOf(window.history.state) !== depthBefore || window.location.href !== topHref) return;
  ownTraversals += 1;
  setSheetHistorySteps(ownTraversals);
  if (ownTraversalTimer) clearTimeout(ownTraversalTimer);
  // A traversal that never reports (a page being torn down) must not swallow a later Back.
  ownTraversalTimer = setTimeout(() => {
    ownTraversals = 0;
    setSheetHistorySteps(0);
    ownTraversalTimer = null;
  }, 1000);
  window.history.go(-steps);
}

function openEntry(onBack: () => void): Entry {
  listen();
  const entry: Entry = { closed: false, href: window.location.href, onBack };
  const current = window.history.state;
  const base = current && typeof current === "object" ? current : {};
  stack.push(entry);
  window.history.pushState({ ...base, [KEY]: stack.length }, "");
  return entry;
}

function closeEntry(entry: Entry) {
  if (entry.closed && !stack.includes(entry)) return;
  entry.closed = true;
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(flush);
}

function phoneNow(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(WF_PHONE_QUERY).matches
  );
}

/**
 * While `open` on a phone, Back calls `onClose`. If the sheet stays open (its close asked first
 * about typed text), a fresh entry is pushed so the next Back asks again.
 */
export function useSheetHistory(open: boolean, onClose: () => void, enabled = true) {
  const onCloseRef = useRef(onClose);
  const openRef = useRef(open);
  useEffect(() => {
    onCloseRef.current = onClose;
    openRef.current = open;
  });

  useEffect(() => {
    if (!open || !enabled || typeof window === "undefined" || !window.history || !phoneNow()) return;
    let entry: Entry | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    const register = () => {
      entry = openEntry(() => {
        entry = null;
        onCloseRef.current();
        // The close may have asked first (Keep editing): keep Back working for the open sheet.
        retry = setTimeout(() => {
          retry = null;
          if (active && openRef.current && entry === null) register();
        }, 0);
      });
    };
    register();
    return () => {
      active = false;
      if (retry) clearTimeout(retry);
      if (entry) closeEntry(entry);
    };
  }, [open, enabled]);
}

/** Test seam: forget every entry (jsdom keeps module state between tests). */
export function resetSheetHistoryForTests() {
  stack.length = 0;
  ownTraversals = 0;
  setSheetHistorySteps(0);
  flushQueued = false;
  if (ownTraversalTimer) clearTimeout(ownTraversalTimer);
  ownTraversalTimer = null;
}
