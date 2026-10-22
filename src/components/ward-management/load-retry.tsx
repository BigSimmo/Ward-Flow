"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";

import { StateLine } from "@/components/wf";

/**
 * Offline Tools crash (22 October 2026): when the code of a `next/dynamic` panel could not be
 * fetched (offline, patchy Wi-Fi or a new deploy), the failed import threw to the route error
 * boundary, so opening Tools offline replaced the whole page with "Something went wrong".
 *
 * Wrap the panel's loader in this. If the fetch fails, the panel resolves to a stand-in that shows
 * one error line with Try again. It fetches again on Try again and when the browser comes back
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
      <StateLine
        kind="error"
        title={title}
        reason="Check the connection, then try again."
        action={{ label: "Try again", onAction: retry }}
        data-testid="ward-load-retry"
      />
    );
  }

  return () => loadOnce().catch(() => LoadRetry);
}
