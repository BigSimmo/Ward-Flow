"use client";

import { type ComponentType, useSyncExternalStore } from "react";

/**
 * A code-split card that Home shows at rest (the "since you were last here" line, Beds that fit).
 * It stays out of the first load like any lazy card, but `start` fetches it as soon as Home's code
 * runs instead of when the browser is idle, and Home holds its columns until it has arrived
 * (`useHomeCardsSettled`), so the card never lands on top of rows already on screen (layout shift
 * on Home, 11 Nov 2026). Once loaded it draws in the same render, unlike `next/dynamic`, which
 * always waits one pass even when the code is already there. A failed fetch is tried again while the
 * card is mounted and the next time it mounts. Does nothing on the server.
 */
export function loadEarly<P extends object>(loader: () => Promise<ComponentType<P>>) {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<void> | null = null;
  let failures = 0;
  const listeners = new Set<() => void>();

  const start = () => {
    if (loaded || pending || typeof window === "undefined") return;
    pending = loader().then(
      (component) => {
        loaded = component;
        for (const listener of listeners) listener();
      },
      () => {
        // A failed fetch (a dropped connection) is tried again while the card is on screen, after
        // 2 s and then 6 s, and again whenever it next mounts, so it does not stay absent.
        pending = null;
        failures += 1;
        if (failures < 3 && listeners.size > 0) window.setTimeout(start, 2000 * (2 * failures - 1));
        else failures = 0;
      },
    );
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    start();
    return () => {
      listeners.delete(listener);
    };
  };
  const ready = () => loaded !== null;
  const current = () => loaded;
  const none = () => null;

  function EarlyCard(props: P) {
    const Card = useSyncExternalStore(subscribe, current, none);
    return Card ? <Card {...props} /> : null;
  }

  return { Card: EarlyCard, start, subscribe, ready };
}
