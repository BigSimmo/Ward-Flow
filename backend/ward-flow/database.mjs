import { createHash } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const validTimestamp = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const time = Date.parse(value);
  return (
    Number.isFinite(time) &&
    new Date(time).toISOString() === (value.includes(".") ? value : `${value.slice(0, -1)}.000Z`)
  );
};

/** A synthetic snapshot is an object, not a claim that arbitrary content is clinically safe. */
export function validStoredSession(record) {
  if (
    !object(record) ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 1 ||
    record.revision > 2_147_483_646 ||
    !validTimestamp(record.updated_at)
  )
    return false;
  // Deletion erases snapshot content but keeps this session ID retired. Physically removing the
  // blob would reset its revision on recreation and let an old caller write to a new lineage.
  if (record.deleted === true)
    return Object.keys(record).every((key) => ["revision", "updated_at", "deleted"].includes(key));
  if (record.deleted !== undefined || !object(record.payload)) return false;
  if (record.lastMutation === undefined) return true;
  const receipt = record.lastMutation;
  return (
    object(receipt) &&
    typeof receipt.requestId === "string" &&
    UUID.test(receipt.requestId) &&
    receipt.requestId === receipt.requestId.toLowerCase() &&
    receipt.expectedRevision === record.revision - 1 &&
    typeof receipt.digest === "string" &&
    /^[0-9a-f]{64}$/.test(receipt.digest) &&
    receipt.digest === createHash("sha256").update(JSON.stringify(record.payload)).digest("hex")
  );
}

// The existing Function storage account holds development-only sessions.
export async function openStorage(storage) {
  const { DefaultAzureCredential } = await import("@azure/identity");
  const credential = new DefaultAzureCredential();
  return {
    ...storage,
    async request(method, url, body, extraHeaders = {}) {
      const access = await credential.getToken("https://storage.azure.com/.default");
      if (!access) throw new Error("Storage identity unavailable");
      return fetch(url, {
        method,
        body,
        headers: {
          authorization: `Bearer ${access.token}`,
          "x-ms-version": "2023-11-03",
          "x-ms-date": new Date().toUTCString(),
          ...extraHeaders,
        },
        signal: AbortSignal.timeout(6_000),
      });
    },
  };
}

export function createStore(client) {
  const base = `https://${client.account}.blob.core.windows.net/${client.container}`;
  let containerPromise;
  async function checkContainer() {
    const result = await client.request("PUT", `${base}?restype=container`);
    if (
      result.status !== 201 &&
      !(result.status === 409 && result.headers.get("x-ms-error-code") === "ContainerAlreadyExists")
    )
      throw new Error("Session container unavailable");
  }
  async function ensureContainer() {
    containerPromise ??= checkContainer().catch((error) => {
      containerPromise = undefined;
      throw error;
    });
    return containerPromise;
  }
  async function get(owner, id) {
    await ensureContainer();
    const url = `${base}/${encodeURIComponent(owner)}/${encodeURIComponent(id)}.json`;
    const result = await client.request("GET", url);
    if (result.status === 404 && result.headers.get("x-ms-error-code") === "BlobNotFound")
      return { url, record: null, etag: null };
    if (result.status !== 200) throw new Error("Session read unavailable");
    const etag = result.headers.get("etag");
    if (!etag) throw new Error("Session version unavailable");
    const record = await result.json();
    if (!validStoredSession(record)) throw new Error("Invalid stored session envelope");
    return { url, record, etag };
  }
  return {
    // Readiness contacts storage on every probe so a later outage is reported.
    ready: checkContainer,
    async read(owner, id) {
      const record = (await get(owner, id)).record;
      return record?.deleted ? null : record;
    },
    async save(owner, id, revision, payload, requestId) {
      const current = await get(owner, id);
      if (current.record?.deleted) return null;
      // Optional retry receipts live in the same conditional write as the snapshot. They cover only
      // the most recent mutation: after another save, a stale retry must still reload and reconcile.
      const canonicalRequestId = requestId?.toLowerCase();
      const digest = canonicalRequestId ? createHash("sha256").update(JSON.stringify(payload)).digest("hex") : null;
      const replay = (record) =>
        canonicalRequestId &&
        record?.lastMutation?.requestId === canonicalRequestId &&
        record.lastMutation.expectedRevision === revision &&
        record.lastMutation.digest === digest;
      if (replay(current.record)) return current.record.revision;
      if (canonicalRequestId && current.record?.lastMutation?.requestId === canonicalRequestId) return null;
      if ((current.record === null ? 0 : current.record.revision) !== revision) return null;
      const next = {
        revision: revision + 1,
        payload,
        updated_at: new Date().toISOString(),
        ...(canonicalRequestId
          ? { lastMutation: { requestId: canonicalRequestId, expectedRevision: revision, digest } }
          : {}),
      };
      const result = await client.request("PUT", current.url, JSON.stringify(next), {
        "content-type": "application/json",
        "x-ms-blob-type": "BlockBlob",
        [current.etag ? "if-match" : "if-none-match"]: current.etag ?? "*",
      });
      if (result.status === 412) {
        if (!canonicalRequestId) return null;
        const winner = await get(owner, id);
        return replay(winner.record) ? winner.record.revision : null;
      }
      if (result.status !== 201) throw new Error("Session write unavailable");
      return next.revision;
    },
    async delete(owner, id, expectedRevision) {
      const current = await get(owner, id);
      if (!current.record) return "not_found";
      if (current.record.revision !== expectedRevision) return "conflict";
      if (current.record.deleted) return "deleted";
      const tombstone = { revision: current.record.revision, updated_at: new Date().toISOString(), deleted: true };
      const result = await client.request("PUT", current.url, JSON.stringify(tombstone), {
        "if-match": current.etag,
        "content-type": "application/json",
        "x-ms-blob-type": "BlockBlob",
      });
      if (result.status === 412) return "conflict";
      if (result.status !== 201) throw new Error("Session deletion unavailable");
      return "deleted";
    },
  };
}
