"use client";

/**
 * PWA plan items 4, 5, 6 and 13 (Oct 2026). Mounted once, in the Ward Flow layout. Renders nothing.
 *
 * - Registers `public/ward-flow-push-sw.js` on every Ward Flow load, not only when phone alerts are
 *   turned on, so the offline fallback page works for everyone. Same URL, scope and options as
 *   `ward-phone-push.ts`, so there is one registration and push keeps working.
 * - Removes the registrations from before Ward Flow left /mockups (19 October 2026):
 *   `/mockups/ward-flow`, and the older `/mockups/ward-flow/` (F-11), whose scope left Home
 *   uncontrolled. Left in place, either would keep its phone alerts subscription out of reach of
 *   Settings, so switching alerts on again would deliver every alert twice. Removing them ends
 *   those subscriptions, so a one-time notice says to turn alerts on again in Settings.
 * - A new worker version waits. A notice offers Reload; the tap tells the waiting worker to take
 *   over, then the page reloads once it has, so code never changes under someone mid-task.
 * - Keeps the browser's install event for the Settings install hint (`ward-pwa-install.ts`).
 * - Opens the page a tapped phone alert asks for when this window was not controlled yet.
 *
 * The registration, clean-up and update offer live in `ward-pwa-update.ts`, loaded on demand after
 * the page is up, so their code is not on every screen's first load (6 Nov 2026).
 *
 * Not registered by the dev server: its build files are not hashed for good, and an offline page
 * would hide a stopped dev server.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useOptionalToast } from "@/components/wf";

import { PHONE_PUSH_SCOPE } from "./ward-phone-push";
import { listenForInstallPrompt } from "./ward-pwa-install";

/** Must match OPEN_MESSAGE in public/ward-flow-push-sw.js. */
const WARD_PWA_OPEN_MESSAGE = "ward-flow-open";

/** The Ward Flow path a worker message asks for, or null for anything else. */
export function wardPwaOpenTarget(data: unknown, origin: string): string | null {
  if (!data || typeof data !== "object") return null;
  const { type, url } = data as { type?: unknown; url?: unknown };
  if (type !== WARD_PWA_OPEN_MESSAGE || typeof url !== "string") return null;
  try {
    const target = new URL(url, origin);
    if (target.origin !== origin) return null;
    const inside = target.pathname === PHONE_PUSH_SCOPE || target.pathname.startsWith(`${PHONE_PUSH_SCOPE}/`);
    return inside ? target.pathname : null;
  } catch {
    return null;
  }
}

export function WardPwaRegistration() {
  const toast = useOptionalToast();
  const router = useRouter();
  // Read through refs so the worker is registered once per page load, not again on a re-render.
  const toastRef = useRef(toast);
  const routerRef = useRef(router);
  useEffect(() => {
    toastRef.current = toast;
    routerRef.current = router;
  }, [router, toast]);

  useEffect(() => {
    listenForInstallPrompt();
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const container = navigator.serviceWorker;
    let cancelled = false;
    let stopWatching: (() => void) | undefined;
    const onMessage = (event: MessageEvent) => {
      const target = wardPwaOpenTarget(event.data, window.location.origin);
      if (target) routerRef.current.push(target);
    };
    container.addEventListener("message", onMessage);
    // Registration and the update offer load on demand (`ward-pwa-update.ts`), off the first load.
    // The tapped-alert message above stays here, so it still works when that file cannot load offline.
    import("./ward-pwa-update")
      .then(({ watchWardPwaWorker }) => {
        if (!cancelled) stopWatching = watchWardPwaWorker(container, () => toastRef.current);
      })
      .catch(() => {
        // Offline before that file was ever fetched: the worker registered on an earlier load still runs.
      });

    return () => {
      cancelled = true;
      stopWatching?.();
      container.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
