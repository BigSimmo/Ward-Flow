"use client";

import { useEffect, useSyncExternalStore, type ComponentType } from "react";

import { Button, StatusGlyph } from "@/components/wf";

import styles from "./load-retry.module.css";

/**
 * Offline Tools crash (22 October 2026): when the code of a `next/dynamic` panel could not be
 * fetched (offline, patchy Wi-Fi or a new deploy), the failed import threw to the route error
 * boundary, so opening Tools offline replaced the whole page with "Something went wrong".
 *
 * Wrap the panel's loader in this. If the fetch fails, the panel resolves to a stand-in that shows
 * one error line with a 44px Try again, which fetches again and draws the real panel once the code
 * arrives, including on every later open. A panel given `onClose` also gets a Close button. Kept
 * small: it sits in the code every page loads.
 *
 * Every `next/dynamic` loader in src goes through this (lint rule local/require-dynamic-load-retry):
 * next/dynamic caches a rejected import, so without it a panel boundary's Try again re-throws until
 * the page reloads. A failed fetch here resolves instead, so nothing is cached as failed.
 *
 * Audit 4 A4-07 (13 Nov 2026): the stand-in tries once more by itself when the browser comes back
 * online. After a second failure while online, the likely cause is a release that removed the old
 * file, which no retry can fetch, so the line says to reload the page instead of blaming the
 * connection.
 */
/** A panel's props, including a panel whose props are all optional (`props = {}`). */
type PanelProps<C> = C extends (props: infer P) => unknown
  ? NonNullable<P>
  : C extends new (props: infer P) => unknown
    ? NonNullable<P>
    : never;

// Typed by the component rather than its props, so a panel whose props are optional keeps its own
// prop types through `next/dynamic`.
export function withLoadRetry<C extends ComponentType<never>>(
  load: () => Promise<C>,
  title = "This part did not load",
  // A retained panel that stays mounted while closed (Home's Release bed sheet) passes how to tell it
  // is closed, so the stand-in disappears when its Close clears the selection.
  isClosed?: (props: PanelProps<C>) => boolean,
): () => Promise<C> {
  let loaded: ComponentType<PanelProps<C> & object> | undefined;
  let failures = 0;
  let inFlight: Promise<C> | undefined;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  // One fetch at a time, shared by every open stand-in and the online retry.
  const loadOnce = () =>
    (inFlight ??= load().then(
      (panel) => {
        inFlight = undefined;
        loaded = panel as ComponentType<PanelProps<C> & object>;
        notify();
        return panel;
      },
      (error: unknown) => {
        inFlight = undefined;
        failures += 1;
        notify();
        throw error;
      },
    ));
  const retry = () =>
    loadOnce().then(
      () => {},
      () => {},
    );

  function LoadRetry(props: PanelProps<C> & object) {
    const Panel = useSyncExternalStore(
      subscribe,
      () => loaded,
      () => undefined,
    );
    const failed = useSyncExternalStore(
      subscribe,
      () => failures,
      () => 0,
    );
    // Once per return of the connection: a failure while offline is retried when it comes back.
    useEffect(() => {
      if (Panel) return;
      window.addEventListener("online", retry);
      return () => window.removeEventListener("online", retry);
    }, [Panel]);
    if (Panel) return <Panel {...props} />;
    if (isClosed?.(props)) return null;
    // A drawer that draws its own header (Referrals, Tasks) has no other close control on a phone.
    const { onClose } = props as { onClose?: () => void };
    return (
      <div className={styles.retry} role="alert" data-testid="ward-load-retry">
        <p>
          <StatusGlyph tone="danger" />
          <strong>{title}.</strong>{" "}
          <span>{failed > 1 && navigator.onLine !== false ? RELOAD_LINE : CONNECTION_LINE}</span>
        </p>
        <Button variant="sec" size="lg" onClick={retry}>
          Try again
        </Button>
        {onClose ? (
          <Button variant="sec" size="lg" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>
    );
  }

  return () => loadOnce().catch(() => LoadRetry as unknown as C);
}

/** The stand-in's advice after the first failure, and after a second one while online (A4-07). */
export const CONNECTION_LINE = "Check the connection, then try again.";
export const RELOAD_LINE = "Ward Flow may have been updated. Reload the page.";
