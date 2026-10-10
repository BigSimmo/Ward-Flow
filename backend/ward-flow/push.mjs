import { createECDH } from "node:crypto";

// Phone push for new act-now (red) items. Off unless all three VAPID settings are present.
//
// Lock screens are visible to anyone nearby, so a push carries a count, the hospital site and a
// fixed page path only: never a patient name, UMRN, Ward Flow id, diagnosis, alert detail or
// typed text (D-18). The server decides what is sent; the browser never supplies payload text.

const BASE64URL = /^[A-Za-z0-9_-]+$/;
// Known browser push services. A subscription endpoint is a URL the backend will POST to, so only
// these hosts are accepted; anything else would let a signed-in account aim the server elsewhere.
const PUSH_SERVICE_HOSTS = Object.freeze([
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
]);
export const ALERTS_PATH = "/mockups/ward-flow/alerts";
export const PUSH_TOPIC = "wardflowactnow";
export const MAX_SUBSCRIPTIONS_PER_ACCOUNT = 10;

function decodedLength(value) {
  return typeof value === "string" && BASE64URL.test(value) ? Buffer.from(value, "base64url").length : -1;
}

/** Null (feature off) unless all three settings are set; throws when they are set but malformed. */
export function readPushConfig(env = process.env) {
  const publicKey = env.WARD_FLOW_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.WARD_FLOW_VAPID_PRIVATE_KEY?.trim();
  const subject = env.WARD_FLOW_VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  const publicBytes = decodedLength(publicKey);
  if (
    publicBytes !== 65 ||
    Buffer.from(publicKey, "base64url")[0] !== 4 ||
    decodedLength(privateKey) !== 32 ||
    !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject)
  )
    throw new Error("Invalid phone push configuration");
  // Lengths alone pass a public key from one pair with a private key from another; push services
  // would then reject every notification. Derive the public key and require it to match.
  let derived;
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(privateKey, "base64url"));
    derived = ecdh.getPublicKey();
  } catch {
    throw new Error("Invalid phone push configuration");
  }
  if (!derived.equals(Buffer.from(publicKey, "base64url"))) throw new Error("Invalid phone push configuration");
  return { publicKey, privateKey, subject };
}

/** The stored form of a browser PushSubscription, or null when it is not one we accept. */
export function parseSubscription(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { endpoint, keys } = value;
  if (typeof endpoint !== "string" || endpoint.length > 2048 || !keys || typeof keys !== "object") return null;
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !PUSH_SERVICE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
  )
    return null;
  // P-256 public key (65 bytes, uncompressed) and a 16-byte auth secret, per RFC 8291.
  if (decodedLength(keys.p256dh) !== 65 || decodedLength(keys.auth) !== 16) return null;
  return { endpoint: url.href, p256dh: keys.p256dh, auth: keys.auth };
}

/**
 * The act-now items to announce: those active now that were not active at the last evaluation.
 * An item that stays red is announced once; one that clears and later returns is new again,
 * matching the open-tab notifier. Duplicate ids in `current` are announced once.
 */
export function freshAlerts(previousIds, current) {
  const seen = new Set(previousIds);
  return current.filter((alert) => {
    if (seen.has(alert.id)) return false;
    seen.add(alert.id);
    return true;
  });
}

/**
 * The notification for a batch of new act-now items. Takes only `{ site }` per item, so no
 * identifier can reach the payload even if a caller passes a fuller object.
 */
export function pushPayload(alerts) {
  const count = alerts.length;
  const sites = [...new Set(alerts.map((alert) => alert?.site).filter((site) => typeof site === "string" && site))];
  const where = sites.length === 1 ? sites[0] : sites.length > 1 ? `${sites.length} sites` : "Ward Flow network";
  return {
    title: `Ward Flow: ${count} new act now ${count === 1 ? "item" : "items"}`,
    body: `${where}. Open Alerts to review. Synthetic demo data.`,
    url: ALERTS_PATH,
    tag: "ward-flow-act-now",
  };
}

/**
 * Sends one payload to one subscription. Resolves "sent", "expired" (the push service says the
 * subscription is gone: 404 or 410) or "failed". Never throws and never logs the endpoint.
 */
export function createPushSender(config, webpush) {
  const vapidDetails = { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey };
  return async (subscription, payload) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload),
        { vapidDetails, TTL: 3600, urgency: "high", topic: PUSH_TOPIC, timeout: 5000 },
      );
      return "sent";
    } catch (error) {
      return error?.statusCode === 404 || error?.statusCode === 410 ? "expired" : "failed";
    }
  };
}

/** The store's push dependency, or null when the feature is off. Loads web-push only when on. */
export async function createPush(config) {
  if (!config.push) return null;
  const { default: webpush } = await import("web-push");
  return {
    send: createPushSender(config.push, webpush),
    payload: pushPayload,
    coordinatorIds: config.coordinatorIds,
    maxPerAccount: MAX_SUBSCRIPTIONS_PER_ACCOUNT,
  };
}
