"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";

import { Button, StatusGlyph } from "@/components/wf";

import styles from "./load-retry.module.css";

/**
 * Offline Tools crash (22 October 2026): when the code of a `next/dynamic` panel could not be
 * fetched (offline, patchy Wi-Fi or a new deploy), the failed import threw to the route error
 * boundary, so opening Tools offline replaced the whole page with "Something went wrong".
 *
 * Wrap the panel's loader in this. If the fetch fails, the panel resolves to a stand-in that shows
 * one error line with a 44px Try again. It fetches again on Try again and when the browser comes back
 * online, and draws the real panel once the code arrives, including on every later open.
 */
export function withLoadRetry<P extends object>(
  load: () => Promise<ComponentType<P>>,
  title: string,
): () => Promise<ComponentType<P>> {
  let loaded: ComponentType<P> | undefined;
  const loadOnce = () => load().then((panel) => (loaded = panel));

  function LoadRetry(props: P) {
    const [Panel, setPanel] = useState(() => loaded);
    const trying = useRef(false);
    const live = useRef(true);
    const retry = useCallback(() => {
      if (trying.current) return;
      trying.current = true;
      loadOnce().then(
        (panel) => {
          trying.current = false;
          if (live.current) setPanel(() => panel);
        },
        () => {
          trying.current = false;
        },
      );
    }, []);
    useEffect(() => {
      live.current = true;
      window.addEventListener("online", retry);
      return () => {
        live.current = false;
        window.removeEventListener("online", retry);
      };
    }, [retry]);
    if (Panel) return <Panel {...props} />;
    return (
      <div className={styles.retry} role="alert" data-testid="ward-load-retry">
        <p className={styles.message}>
          <StatusGlyph tone="danger" className={styles.glyph} />
          <span className={styles.title}>{title}.</span>{" "}
          <span className={styles.reason}>Check the connection, then try again.</span>
        </p>
        <Button variant="sec" size="lg" className={styles.action} onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  return () => loadOnce().catch(() => LoadRetry);
}
