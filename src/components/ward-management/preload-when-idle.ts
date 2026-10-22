/**
 * F-10 (phone review, October 2026): fetches code-split panels once the page has finished loading
 * and the browser is idle, so they stay out of the first load but are normally ready by the time
 * someone opens them. Errors are ignored here: a failed fetch is retried when the panel is actually
 * opened, by `next/dynamic` or by the panel's own wrapper. Does nothing on the server.
 */
export function preloadWhenIdle(...loaders: Array<() => Promise<unknown>>): void {
  if (typeof window === "undefined") return;
  const preload = () => {
    for (const load of loaders) void load().catch(() => undefined);
  };
  const schedule = () => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(preload, { timeout: 5000 });
    else window.setTimeout(preload, 1500);
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
}
