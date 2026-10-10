/**
 * PHONE ALERTS — feature 4, 10 Oct 2026.
 *
 * Standard Web Push through the shared Azure backend, so a coordinator's phone or browser shows a
 * new act-now (red) item while Ward Flow is closed. Off by default, turned on per device in
 * Settings, and only available when the shared Azure workspace is signed in: the local
 * demonstration has no server to send from. The server writes the words: a count, the hospital
 * site and a link to Alerts, never a patient name, record number, Ward Flow id or typed text.
 *
 * `public/ward-flow-push-sw.js` shows the notification and opens Alerts when it is tapped. It has
 * no fetch handler, so it never intercepts or caches pages.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { WARD_DEVELOPER_HUB_HREF } from "@/components/ward-management/ward-nav";

export const PHONE_PUSH_WORKER_URL = "/ward-flow-push-sw.js";
export const PHONE_PUSH_SCOPE = `${WARD_DEVELOPER_HUB_HREF}/`;

/** The calls the signed-in shared workspace offers (`SharedWorkspaceClient`). */
export type PhonePushApi = {
  pushKey(): Promise<{ enabled: true; publicKey: string } | { enabled: false }>;
  /** Whether the signed-in account owns an active server record for this device endpoint. */
  pushStatus(endpoint: string): Promise<boolean>;
  /** "limit" and "in-use" are refusals the person can act on; any other failure rejects. */
  pushSubscribe(subscription: {
    endpoint?: string;
    keys?: Record<string, string>;
  }): Promise<"subscribed" | "limit" | "in-use">;
  /** True when the signed-in account's record was revoked; false when it owned none. */
  pushUnsubscribe(endpoint: string): Promise<boolean>;
};

/** Whether this screen is on the shared Azure workspace, and signed in. */
export type PhonePushAccess = { kind: "local" } | { kind: "signed-out" } | { kind: "connected"; api: PhonePushApi };

export const PhonePushAccessContext = createContext<PhonePushAccess>({ kind: "local" });

export type PhonePushState =
  | "local"
  | "signed-out"
  | "checking"
  | "unsupported"
  | "install"
  | "server-off"
  | "denied"
  | "off"
  | "on"
  | "busy"
  // The server refused to turn alerts on: this account's device limit, or another account's alerts
  // are still on for this device.
  | "limit"
  | "in-use"
  // The last change failed. "error": alerts are still off (or unknown); "error-on": still on.
  | "error"
  | "error-on";

const ON_OFF = "New act-now alerts, with Ward Flow closed";

/**
 * What the Settings row shows for a state. Never hidden: unavailable states grey out with a reason.
 * Each line fits one row at 390px wide, where the row truncates its second line.
 */
export function phonePushRow(state: PhonePushState): { checked: boolean; unavailable: boolean; sub: string } {
  const unavailable = (sub: string) => ({ checked: false, unavailable: true, sub });
  switch (state) {
    case "local":
      return unavailable("Needs the shared Azure workspace");
    case "signed-out":
      return unavailable("Sign in to the shared workspace first");
    case "checking":
      return unavailable("Checking this device…");
    case "unsupported":
      return unavailable("Not available in this browser");
    case "install":
      return unavailable("Add to Home Screen, then open it there");
    case "server-off":
      return unavailable("Not set up on the server yet");
    case "denied":
      return unavailable("Blocked for this site in the browser");
    case "busy":
      return unavailable("Updating this device…");
    case "limit":
      return { checked: false, unavailable: false, sub: "On for 10 devices. Turn one off first" };
    case "in-use":
      return { checked: false, unavailable: false, sub: "On for another account on this device" };
    case "error":
      return { checked: false, unavailable: false, sub: "Server not reached. Try again." };
    case "error-on":
      return { checked: true, unavailable: false, sub: "Server not reached. Try again." };
    case "on":
      return { checked: true, unavailable: false, sub: ON_OFF };
    case "off":
      return { checked: false, unavailable: false, sub: ON_OFF };
  }
}

/** An iPhone or iPad browser tab: web push works only from a Home Screen web app there. */
function iosTab(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches === true;
  return ios && !standalone;
}

/** Whether this browser can receive web push at all. */
export function phonePushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof window.Notification !== "undefined"
  );
}

/** Web Push's applicationServerKey wants raw bytes; the server sends base64url. */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/**
 * Before sign-out: revoke this account's record for this device, then drop the browser
 * subscription, so the next account on a shared device starts with alerts off. Leaves alone a
 * browser subscription this account does not own. Best effort: errors are swallowed.
 */
export async function releasePhonePush(api: PhonePushApi): Promise<void> {
  try {
    if (!phonePushSupported()) return;
    const subscription = await currentSubscription();
    if (subscription && (await api.pushUnsubscribe(subscription.endpoint))) await subscription.unsubscribe();
  } catch {
    // Sign-out goes ahead regardless; the server drops the record once the push service rejects it.
  }
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(PHONE_PUSH_SCOPE);
  return (await registration?.pushManager.getSubscription()) ?? null;
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
          state = subscription && (await api.pushStatus(subscription.endpoint)) ? "on" : "off";
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
  const outcome = await api.pushSubscribe(subscription.toJSON());
  return outcome === "subscribed" ? "on" : outcome;
}

async function turnOff(api: PhonePushApi): Promise<PhonePushState> {
  const subscription = await currentSubscription();
  // Only a browser subscription this account owned is removed; another account's stays theirs.
  if (subscription && (await api.pushUnsubscribe(subscription.endpoint))) await subscription.unsubscribe();
  return "off";
}
