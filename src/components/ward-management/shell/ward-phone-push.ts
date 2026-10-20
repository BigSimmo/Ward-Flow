/**
 * PHONE ALERTS — feature 4, 10 Oct 2026.
 *
 * Standard Web Push through the shared backend, so a coordinator's phone or browser shows a
 * new act-now (red) item while Ward Flow is closed. From migration 9 a site bed manager, nurse in
 * charge or ED clinician hears the act-now items inside their own place too (role access plan,
 * later pass); other roles see "Not part of your role". Off by default, turned on per device in
 * Settings, and only available when the shared workspace is signed in: the local
 * demonstration has no server to send from. The server writes the words: a count, the hospital
 * site and a link to Alerts, never a patient name, record number, Ward Flow id or typed text.
 *
 * `public/ward-flow-push-sw.js` shows the notification and opens Alerts when it is tapped. The same
 * worker also gives the offline fallback page (`shell/ward-pwa-registration.tsx` registers it on
 * every Ward Flow load, with the same URL and scope, so there is one registration). It keeps only
 * static files, never a page or data (D-18).
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { WARD_DEVELOPER_HUB_HREF } from "@/components/ward-management/ward-nav";

export const PHONE_PUSH_WORKER_URL = "/ward-flow-push-sw.js";
/**
 * No trailing slash (F-11): scope matching is a plain prefix, so `/ward-flow/` left Home
 * (`/ward-flow`) uncontrolled. The worker itself ignores sibling paths such as
 * `/mockups/ward-flow-digest` that this prefix also covers.
 */
export const PHONE_PUSH_SCOPE = WARD_DEVELOPER_HUB_HREF;

/** The calls the signed-in shared workspace offers (`SharedWorkspaceClient`). */
export type PhonePushApi = {
  /** Verified account, used only to retain a tab-memory ownership receipt for offline sign-out. */
  readonly ownerId?: string;
  pushKey(): Promise<{ enabled: true; publicKey: string } | { enabled: false }>;
  /** Whether the signed-in account owns an active server record for this device endpoint. */
  pushStatus(endpoint: string): Promise<boolean>;
  /**
   * "limit", "in-use" and "role" (this desk's role does not hear phone alerts, or the database is
   * not ready for it) are refusals the person can act on; any other failure rejects.
   */
  pushSubscribe(subscription: {
    endpoint?: string;
    keys?: Record<string, string>;
  }): Promise<"subscribed" | "limit" | "in-use" | "role">;
  /** True when the signed-in account's record was revoked; false when it owned none. */
  pushUnsubscribe(endpoint: string): Promise<boolean>;
};

/** Whether this screen is on the shared workspace, and signed in. */
export type PhonePushAccess =
  | { kind: "local" }
  | { kind: "signed-out" }
  // Signed in as a role that is not sent alerts (an executive, an access admin, community, transport).
  | { kind: "role" }
  | { kind: "connected"; api: PhonePushApi };

export const PhonePushAccessContext = createContext<PhonePushAccess>({ kind: "local" });

export type PhonePushState =
  | "local"
  | "signed-out"
  // This role is not sent alerts.
  | "role"
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
const confirmedOwners = new Map<string, { ownerId: string; keys: string }>();
// Nonclinical coordination only: account id and the browser's public subscription key. Never
// persist the push endpoint, authentication secret or notification contents.
const OWNER_STORAGE_KEY = "ward-flow:phone-push-owner:v1";

function sharedOwnershipReceipt(): string | null {
  try {
    return window.localStorage.getItem(OWNER_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** An awaited response may describe ownership from before another desk took over this device. */
function ownershipStillCurrent(subscription: PushSubscription): () => boolean {
  const memory = confirmedOwners.get(subscription.endpoint);
  const shared = sharedOwnershipReceipt();
  return () => confirmedOwners.get(subscription.endpoint) === memory && sharedOwnershipReceipt() === shared;
}

function sharedOwner(subscription: PushSubscription): string | null {
  try {
    const stored: unknown = JSON.parse(sharedOwnershipReceipt() ?? "null");
    const publicKey = subscription.toJSON().keys?.p256dh;
    if (
      publicKey &&
      stored &&
      typeof stored === "object" &&
      "ownerId" in stored &&
      typeof stored.ownerId === "string" &&
      "publicKey" in stored &&
      stored.publicKey === publicKey
    )
      return stored.ownerId;
  } catch {
    // Without shared ownership coordination, offline removal cannot safely infer the owner.
  }
  return null;
}

function forgetOwner(api: PhonePushApi, subscription: PushSubscription): void {
  if (confirmedOwners.get(subscription.endpoint)?.ownerId === api.ownerId)
    confirmedOwners.delete(subscription.endpoint);
  try {
    if (sharedOwner(subscription) === api.ownerId) window.localStorage.removeItem(OWNER_STORAGE_KEY);
  } catch {
    // Storage errors do not prevent local or remote sign-out cleanup.
  }
}

function subscriptionKeys(subscription: PushSubscription): string {
  return JSON.stringify(subscription.toJSON().keys ?? {});
}

function locallyOwned(api: PhonePushApi, subscription: PushSubscription): boolean {
  const receipt = confirmedOwners.get(subscription.endpoint);
  return (
    !!api.ownerId &&
    receipt?.ownerId === api.ownerId &&
    receipt.keys === subscriptionKeys(subscription) &&
    sharedOwner(subscription) === api.ownerId
  );
}

function rememberOwner(api: PhonePushApi, subscription: PushSubscription, owned: boolean): void {
  if (!api.ownerId) return;
  if (owned) {
    confirmedOwners.set(subscription.endpoint, { ownerId: api.ownerId, keys: subscriptionKeys(subscription) });
    try {
      window.localStorage.setItem(
        OWNER_STORAGE_KEY,
        JSON.stringify({
          ownerId: api.ownerId,
          publicKey: subscription.toJSON().keys?.p256dh,
          // Distinguish a later confirmation even if another tab returns to the same account.
          revision: crypto.getRandomValues(new Uint32Array(4)).join("-"),
        }),
      );
    } catch {
      // Do not retain a previous account's shared receipt when this one cannot replace it.
      try {
        window.localStorage.removeItem(OWNER_STORAGE_KEY);
      } catch {
        /* Best effort. */
      }
    }
  } else if (confirmedOwners.get(subscription.endpoint)?.ownerId === api.ownerId) {
    forgetOwner(api, subscription);
  }
}

/** Confirm an existing device once connected, so offline sign-out need not guess its owner. */
export async function rememberPhonePushOwnership(api: PhonePushApi): Promise<void> {
  try {
    if (!phonePushSupported()) return;
    const subscription = await currentSubscription();
    if (subscription) {
      const current = ownershipStillCurrent(subscription);
      const owned = await api.pushStatus(subscription.endpoint);
      if (current()) rememberOwner(api, subscription, owned);
    }
  } catch {
    // An unknown owner is never treated as this account's device.
  }
}

/**
 * What the Settings row shows for a state. Never hidden: unavailable states grey out with a reason.
 * Each line fits one row at 390px wide, where the row truncates its second line.
 */
export function phonePushRow(state: PhonePushState): { checked: boolean; unavailable: boolean; sub: string } {
  const unavailable = (sub: string) => ({ checked: false, unavailable: true, sub });
  switch (state) {
    case "local":
      return unavailable("Needs the shared workspace");
    case "signed-out":
      return unavailable("Sign in to the shared workspace first");
    case "role":
      return unavailable("Not part of your role");
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

/**
 * An iPhone or iPad. iPadOS Safari reports itself as a Mac (F-29), so a "Macintosh" user agent
 * with a touch screen counts too: no Mac has one.
 */
export function iosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return true;
  return /Macintosh/.test(navigator.userAgent) && (navigator.maxTouchPoints ?? 0) > 1;
}

/** Whether Ward Flow is running as an installed Home Screen app rather than in a browser tab. */
export function standaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

/** An iPhone or iPad browser tab: web push works only from a Home Screen web app there. */
function iosTab(): boolean {
  return iosDevice() && !standaloneApp();
}

/** Whether this browser can receive web push at all. */
function phonePushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof window.Notification !== "undefined"
  );
}

/** Web Push's applicationServerKey wants raw bytes; the server sends base64url. */
function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/**
 * Before sign-out: stop a locally confirmed owned device immediately, independently of server
 * availability. Without a tab-memory ownership receipt, require the server's confirmation first.
 * A different account's receipt is never authority to remove its subscription.
 */
export async function releasePhonePush(api: PhonePushApi): Promise<void> {
  try {
    if (!phonePushSupported()) return;
    const subscription = await currentSubscription();
    if (!subscription) return;
    const owned = locallyOwned(api, subscription);
    if (owned) {
      try {
        await subscription.unsubscribe();
        forgetOwner(api, subscription);
      } catch {
        // Still attempt server revocation when this browser cannot remove its subscription.
      }
    }
    const revoked = await api.pushUnsubscribe(subscription.endpoint);
    // A newly confirmed other owner invalidates an outgoing account's delayed cleanup.
    const latest = confirmedOwners.get(subscription.endpoint);
    const shared = sharedOwner(subscription);
    if (!owned && revoked && (!latest || latest.ownerId === api.ownerId) && (!shared || shared === api.ownerId)) {
      await subscription.unsubscribe();
      forgetOwner(api, subscription);
    }
  } catch {
    // An owned local subscription was already stopped; server cleanup remains best effort.
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
