/**
 * The service worker half of `WardPwaRegistration` (`ward-pwa-registration.tsx`): registration, the
 * old /mockups clean-up and the "New version ready" offer. Loaded on demand once the page is up
 * (6 Nov 2026), so this code is not on every screen's first load. It runs after hydration either
 * way, so nothing happens any later than a moment's fetch. See that file's header for what each part
 * is for.
 */
import type { ToastInput } from "@/components/wf";

import { PHONE_PUSH_SCOPE, PHONE_PUSH_WORKER_URL } from "./ward-phone-push";

/** The page's notices (its toast region), or null outside one. */
type Notices = { push: (toast: ToastInput) => string; dismiss: (id: string) => void } | null;

/** Scopes registered before Ward Flow left /mockups (19 October 2026); the slashed one is pre-F-11. */
export const LEGACY_PWA_SCOPES = ["/mockups/ward-flow", "/mockups/ward-flow/"] as const;

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

/** Registers the worker and offers its updates through the page's notices, read when used. Returns the clean-up. */
export function watchWardPwaWorker(container: ServiceWorkerContainer, notices: () => Notices): () => void {
  let cancelled = false;
  let reloadRequested = false;
  let offered: ServiceWorker | null = null;
  let noticeId: string | null = null;
  const lifecycle = new AbortController();

  const reloadIfRequested = () => {
    if (cancelled || !reloadRequested) return;
    // Consume the request even when unsaved work cancels this navigation. Later controller
    // events must never replay it.
    reloadRequested = false;
    window.location.reload();
  };

  const offer = (registration: ServiceWorkerRegistration, worker: ServiceWorker | null) => {
    // Only an update waits: a first install has no active worker yet and takes over at once.
    const toasts = notices();
    if (cancelled || !worker || !registration.active || registration.active === worker) return;
    if (offered === worker || !toasts) return;
    offered = worker;
    if (noticeId) toasts.dismiss(noticeId);
    noticeId = toasts.push({
      tone: "info",
      title: "New version of Ward Flow ready",
      skipOfflineNote: true,
      action: {
        label: "Reload",
        onAction: () => {
          if (cancelled) return;
          reloadRequested = true;
          // Another tab may already have activated this update. Its controllerchange has
          // happened, so this explicit tap must reload without waiting for another one.
          if (
            worker.state === "activated" ||
            container.controller === worker ||
            (worker.state === "redundant" && container.controller)
          )
            reloadIfRequested();
          else worker.postMessage({ type: "SKIP_WAITING" });
        },
      },
    });
  };

  container.addEventListener("controllerchange", reloadIfRequested);

  void (async () => {
    try {
      const registration = await registerWardPwaWorker(() => {
        notices()?.push({ tone: "warning", duration: 0, ...PHONE_ALERTS_MOVED_NOTICE });
      });
      if (!registration || cancelled) return;
      const watchInstalling = () => {
        const installing = registration.installing;
        if (!installing) return;
        const onStateChange = () => {
          if (installing.state === "installed") offer(registration, registration.waiting ?? installing);
        };
        installing.addEventListener("statechange", onStateChange, { signal: lifecycle.signal });
        onStateChange();
      };
      registration.addEventListener("updatefound", watchInstalling, { signal: lifecycle.signal });
      // updatefound may have fired before register() resolved. Watch that update too.
      watchInstalling();
      offer(registration, registration.waiting);
    } catch {
      // No worker (private mode, blocked, or offline at first load): Ward Flow works without one.
    }
  })();

  return () => {
    cancelled = true;
    lifecycle.abort();
    container.removeEventListener("controllerchange", reloadIfRequested);
  };
}
