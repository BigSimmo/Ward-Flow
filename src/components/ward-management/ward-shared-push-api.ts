/** Phone push calls (feature 4), split from ward-shared-client.ts for its size limit. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the server's JSON, checked field by field below.
export type SharedAsk = (path: string, body?: Record<string, unknown>) => Promise<{ response: Response; value: any }>;
export type PushSubscriptionShape = { endpoint?: string; keys?: Record<string, string> };

/**
 * Phone push (feature 4). The server's public VAPID key, or `enabled: false` when the server is
 * not set up for phone alerts. The private key never leaves the server.
 */
export async function pushKey(ask: SharedAsk): Promise<{ enabled: true; publicKey: string } | { enabled: false }> {
  const { response, value } = await ask("/v1/workspace/push-key");
  if (!response.ok) throw new Error("Phone alerts unavailable");
  return value?.enabled === true && typeof value.publicKey === "string"
    ? { enabled: true, publicKey: value.publicKey }
    : { enabled: false };
}
/**
 * Registers this device's browser push subscription for the signed-in coordinator. A refusal the
 * person can act on comes back as its reason: this account is on its device limit, or another
 * account's alerts are still on for this device.
 */
export async function pushSubscribe(
  ask: SharedAsk,
  subscription: PushSubscriptionShape,
): Promise<"subscribed" | "limit" | "in-use" | "role"> {
  const { endpoint, keys } = subscription;
  const { response, value } = await ask("/v1/workspace/push-subscribe", {
    subscription: { endpoint, keys },
  });
  if (response.status === 409 && (value?.code === "limit" || value?.code === "in-use")) return value.code;
  if (response.status === 422 && value?.code === "role") return "role";
  if (!response.ok) throw new Error("Phone alerts were not turned on");
  return "subscribed";
}
/** Whether this account owns an active phone alert record for this device. */
export async function pushStatus(ask: SharedAsk, endpoint: string): Promise<boolean> {
  const { response, value } = await ask("/v1/workspace/push-status", { endpoint });
  if (!response.ok) throw new Error("Phone alerts could not be checked");
  return value?.owned === true;
}
/** Stops phone alerts for this device. True when this account's record was revoked. */
export async function pushUnsubscribe(ask: SharedAsk, endpoint: string): Promise<boolean> {
  const { response, value } = await ask("/v1/workspace/push-unsubscribe", { endpoint });
  if (!response.ok) throw new Error("Phone alerts were not turned off");
  return value?.revoked === true;
}
