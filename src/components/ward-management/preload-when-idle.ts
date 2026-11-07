/**
 * F-10 (phone review, October 2026): fetches code-split panels once the page has finished loading
 * and the browser is idle, so they stay out of the first load but are normally ready by the time
 * someone opens them. Errors are ignored here: a failed fetch is retried when the panel is actually
 * opened, by `next/dynamic` or by the panel's own wrapper. Does nothing on the server.
 *
 * PERF-06 (front-end audit, 5 November 2026): with Data Saver on, or on a 2G or slower connection,
 * nothing is preloaded, so a first tap never queues behind about 180 KB of panels nobody asked for.
 * The panel still loads when it is opened.
 */
type ConnectionHint = { saveData?: boolean; effectiveType?: string };

export function shouldSkipIdlePreload(connection: ConnectionHint | undefined): boolean {
  if (!connection) return false;
  if (connection.saveData === true) return true;
  return connection.effectiveType === "2g" || connection.effectiveType === "slow-2g";
}

export function preloadWhenIdle(...loaders: Array<() => Promise<unknown>>): void {
  if (typeof window === "undefined") return;
  const preload = () => {
    const connection = (navigator as Navigator & { connection?: ConnectionHint }).connection;
    if (shouldSkipIdlePreload(connection)) return;
    for (const load of loaders) void load().catch(() => undefined);
  };
  const schedule = () => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(preload, { timeout: 5000 });
    else window.setTimeout(preload, 1500);
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
}
