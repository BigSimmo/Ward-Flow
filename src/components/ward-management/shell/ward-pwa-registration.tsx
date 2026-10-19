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
 * Not registered by the dev server: its build files are not hashed for good, and an offline page
 * would hide a stopped dev server.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useOptionalToast } from "@/components/wf";

import { PHONE_PUSH_SCOPE, PHONE_PUSH_WORKER_URL } from "./ward-phone-push";
import { listenForInstallPrompt } from "./ward-pwa-install";

/** Must match OPEN_MESSAGE in public/ward-flow-push-sw.js. */
const WARD_PWA_OPEN_MESSAGE = "ward-flow-open";
/** Scopes registered before Ward Flow left /mockups (19 October 2026); the slashed one is pre-F-11. */
export const LEGACY_PWA_SCOPES = ["/mockups/ward-flow", "/mockups/ward-flow/"] as const;

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

/** The one-time notice when removing the old registration ended this phone's alerts. */
export const PHONE_ALERTS_MOVED_NOTICE = {
  title: "Turn phone alerts on again",
  body: "An update moved Ward Flow's alerts. Switch them on again in Settings, Alerts.",
} as const;

async function hadPushSubscription(registration: ServiceWorkerRegistration): Promise<boolean> {
  try {
    return Boolean(await registration.pushManager?.getSubscription());
  } catch {
    return false;
  }
}

/**
 * Registers the Ward Flow worker and drops the old registrations. Resolves null when unsupported.
 * `onAlertsEnded` runs when a dropped registration held a phone alerts subscription, which the
 * browser ends with it. The server forgets that endpoint once a send to it fails.
 */
async function registerWardPwaWorker(onAlertsEnded?: () => void): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const legacyScopes = new Set<string>(LEGACY_PWA_SCOPES.map((scope) => new URL(scope, window.location.origin).href));
  const existing = await navigator.serviceWorker.getRegistrations();
  const ended = await Promise.all(
    existing
      .filter((registration) => legacyScopes.has(registration.scope))
      .map(async (registration) => {
        const subscribed = await hadPushSubscription(registration);
        await registration.unregister();
        return subscribed;
      }),
  );
  if (ended.some(Boolean)) onAlertsEnded?.();
  return navigator.serviceWorker.register(PHONE_PUSH_WORKER_URL, { scope: PHONE_PUSH_SCOPE, updateViaCache: "none" });
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
    let reloadRequested = false;
    let offered: ServiceWorker | null = null;
    let noticeId: string | null = null;

    const offer = (registration: ServiceWorkerRegistration, worker: ServiceWorker | null) => {
      // Only an update waits: a first install has no active worker yet and takes over at once.
      const notices = toastRef.current;
      if (cancelled || !worker || !registration.active || registration.active === worker) return;
      if (offered === worker || !notices) return;
      offered = worker;
      if (noticeId) notices.dismiss(noticeId);
      noticeId = notices.push({
        tone: "info",
        title: "New version of Ward Flow ready",
        skipOfflineNote: true,
        action: {
          label: "Reload",
          onAction: () => {
            reloadRequested = true;
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    };

    const onControllerChange = () => {
      if (reloadRequested) window.location.reload();
    };
    const onMessage = (event: MessageEvent) => {
      const target = wardPwaOpenTarget(event.data, window.location.origin);
      if (target) routerRef.current.push(target);
    };
    container.addEventListener("controllerchange", onControllerChange);
    container.addEventListener("message", onMessage);

    void (async () => {
      try {
        const registration = await registerWardPwaWorker(() => {
          toastRef.current?.push({ tone: "warning", duration: 0, ...PHONE_ALERTS_MOVED_NOTICE });
        });
        if (!registration || cancelled) return;
        offer(registration, registration.waiting);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed") offer(registration, registration.waiting ?? installing);
          });
        });
      } catch {
        // No worker (private mode, blocked, or offline at first load): Ward Flow works without one.
      }
    })();

    return () => {
      cancelled = true;
      container.removeEventListener("controllerchange", onControllerChange);
      container.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
