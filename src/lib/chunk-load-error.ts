"use client";

import { useEffect, useState } from "react";

/**
 * Design re-score DR-01 (24 Oct 2026): losing the connection while a page is still loading makes
 * a late script or style file fail. That failure reaches an error boundary and used to read as an
 * application crash that stayed after the connection came back.
 *
 * A failed load shows up as one of: webpack's `ChunkLoadError` ("Loading chunk 123 failed",
 * "Loading CSS chunk 45 failed"), a failed dynamic `import()` ("Failed to fetch dynamically
 * imported module", Safari's "Importing a module script failed"), or the bare `Event` from a
 * `<link>` or `<script>` element's `error` event.
 *
 * Ward Flow has its own copy (`ward-chunk-load-error.ts`) because its seam test forbids importing
 * this host module.
 */
const CHUNK_MESSAGE =
  /Loading (?:CSS )?chunk [\w./-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  // A thrown DOM `error` Event only ever comes from a resource element failing to load.
  if (typeof Event !== "undefined" && error instanceof Event) return error.type === "error";
  if (typeof error !== "object") return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === "ChunkLoadError") return true;
  return typeof message === "string" && CHUNK_MESSAGE.test(message);
}

/**
 * While `active`, reports whether the browser is online and reloads the page once when the
 * connection comes back. It never reloads on mount, only on an `online` event, and the listener is
 * removed before the reload, so a reload cannot loop: another needs the connection to drop again.
 */
export function useReloadWhenOnline(active: boolean): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    if (!active) return;
    const handleOnline = () => {
      setOnline(true);
      window.removeEventListener("online", handleOnline);
      window.location.reload();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [active]);

  return online;
}
