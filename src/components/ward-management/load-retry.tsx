"use client";

import { useSyncExternalStore, type ComponentType } from "react";

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
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const loadOnce = () =>
    load().then((panel) => {
      loaded = panel as ComponentType<PanelProps<C> & object>;
      for (const listener of listeners) listener();
      return panel;
    });

  function LoadRetry(props: PanelProps<C> & object) {
    const Panel = useSyncExternalStore(
      subscribe,
      () => loaded,
      () => undefined,
    );
    if (Panel) return <Panel {...props} />;
    if (isClosed?.(props)) return null;
    // A drawer that draws its own header (Referrals, Tasks) has no other close control on a phone.
    const { onClose } = props as { onClose?: () => void };
    return (
      <div className={styles.retry} role="alert" data-testid="ward-load-retry">
        <p>
          <StatusGlyph tone="danger" />
          <strong>{title}.</strong> <span>Check the connection, then try again.</span>
        </p>
        <Button
          variant="sec"
          size="lg"
          onClick={() =>
            loadOnce().then(
              () => {},
              () => {},
            )
          }
        >
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
