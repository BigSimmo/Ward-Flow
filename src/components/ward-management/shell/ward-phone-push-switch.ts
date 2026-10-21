/**
 * The Settings phone alerts switch (`usePhonePush`). Settings-only, so it stays out of the shared
 * shell every route loads; sign-out cleanup and ownership receipts stay in `ward-phone-push.ts`.
 */
import { useCallback, useContext, useEffect, useState } from "react";
import {
  PHONE_PUSH_SCOPE,
  PHONE_PUSH_WORKER_URL,
  PhonePushAccessContext,
  currentSubscription,
  iosTab,
  locallyOwned,
  ownershipStillCurrent,
  phonePushSupported,
  rememberOwner,
  type PhonePushApi,
  type PhonePushState,
} from "./ward-phone-push";

/** Web Push's applicationServerKey wants raw bytes; the server sends base64url. */
function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/**
 * The phone alerts switch for this device: its state, and `setEnabled` to turn it on or off.
 * It shows On only when the signed-in account owns an active server record for this device, so a
 * shared device never shows another account's alerts as this account's. Turning on asks the
 * browser for permission once, installs the worker and registers this device with the server;
 * turning off revokes this account's record first, then the browser subscription it owned. A
 * failed change keeps the last confirmed on or off, with the error, so the next tap retries.
 */
export function usePhonePush(): [PhonePushState, (enabled: boolean) => Promise<PhonePushState>] {
  const access = useContext(PhonePushAccessContext);
  const api = access.kind === "connected" ? access.api : null;
  const [checked, setChecked] = useState<{ api: PhonePushApi | null; state: PhonePushState } | null>(null);

  useEffect(() => {
    if (!api || !phonePushSupported()) return;
    let cancelled = false;
    void (async () => {
      let state: PhonePushState;
      try {
        const key = await api.pushKey();
        if (!key.enabled) state = "server-off";
        else if (window.Notification.permission === "denied") state = "denied";
        else {
          const subscription = await currentSubscription();
          const current = subscription ? ownershipStillCurrent(subscription) : () => true;
          const owned = subscription ? await api.pushStatus(subscription.endpoint) : false;
          const confirmed = !cancelled && current();
          if (subscription && confirmed) rememberOwner(api, subscription, owned);
          state = (confirmed ? owned : subscription && locallyOwned(api, subscription)) ? "on" : "off";
        }
      } catch {
        state = "error";
      }
      if (!cancelled) setChecked({ api, state });
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  // Derived during render, not set in the effect: access and browser support are known now; only
  // the server key and this device's subscription need the asynchronous check above.
  let state: PhonePushState;
  if (access.kind !== "connected") state = access.kind;
  else if (!phonePushSupported()) state = iosTab() ? "install" : "unsupported";
  else state = checked?.api === api ? checked.state : "checking";

  const setEnabled = useCallback(
    async (enabled: boolean): Promise<PhonePushState> => {
      if (!api || !phonePushSupported()) return state;
      setChecked({ api, state: "busy" });
      let next: PhonePushState;
      try {
        next = enabled ? await turnOn(api) : await turnOff(api);
      } catch {
        // Nothing was confirmed: a failed turn-on is still off, a failed turn-off is still on.
        next = enabled ? "error" : "error-on";
      }
      setChecked({ api, state: next });
      return next;
    },
    [api, state],
  );

  return [state, setEnabled];
}

/** Resolves once the worker is active; push subscription needs an active worker. */
function activated(registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  if (registration.active) return Promise.resolve(registration);
  const worker = registration.installing ?? registration.waiting;
  if (!worker) return Promise.reject(new Error("Phone alert worker unavailable"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Phone alert worker did not start")), 10_000);
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") {
        clearTimeout(timer);
        resolve(registration);
      } else if (worker.state === "redundant") {
        clearTimeout(timer);
        reject(new Error("Phone alert worker did not start"));
      }
    });
  });
}

function sameKey(subscription: PushSubscription, key: Uint8Array): boolean {
  const current = subscription.options?.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === key.length && bytes.every((value, index) => value === key[index]);
}

async function turnOn(api: PhonePushApi): Promise<PhonePushState> {
  // Ask first, while the tap still counts as a user action (Safari requires that).
  let permission = window.Notification.permission;
  if (permission === "default") permission = await window.Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const key = await api.pushKey();
  if (!key.enabled) return "server-off";
  const applicationServerKey = base64UrlToBytes(key.publicKey);
  const registration = await activated(
    await navigator.serviceWorker.register(PHONE_PUSH_WORKER_URL, { scope: PHONE_PUSH_SCOPE, updateViaCache: "none" }),
  );
  let subscription = await registration.pushManager.getSubscription();
  // A subscription made for an earlier server key cannot receive from the current one.
  if (subscription && !sameKey(subscription, applicationServerKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  const current = ownershipStillCurrent(subscription);
  const outcome = await api.pushSubscribe(subscription.toJSON());
  if (!current()) return locallyOwned(api, subscription) ? "on" : "off";
  rememberOwner(api, subscription, outcome === "subscribed");
  return outcome === "subscribed" ? "on" : outcome;
}

async function turnOff(api: PhonePushApi): Promise<PhonePushState> {
  const subscription = await currentSubscription();
  // Only a browser subscription this account owned is removed; another account's stays theirs.
  if (subscription) {
    const current = ownershipStillCurrent(subscription);
    if ((await api.pushUnsubscribe(subscription.endpoint)) && current()) {
      await subscription.unsubscribe();
      rememberOwner(api, subscription, false);
    }
  }
  return "off";
}
