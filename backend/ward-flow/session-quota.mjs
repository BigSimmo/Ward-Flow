/**
 * Per-owner session cap. Tenant-wide mode lets any approved tenant account create sessions, so the
 * number of session blobs one account can create is bounded. Retired (deleted) session IDs stay
 * as small tombstones in storage and count too: they cannot be reused, and counting them keeps the
 * bound a real bound on storage.
 *
 * Reads the Blob list API with the same storage client `createStore` uses, so the session store
 * itself is unchanged.
 */
export const MAX_SESSIONS_PER_OWNER = 100;

/**
 * @param {{ account: string, container: string, request: (method: string, url: string) => Promise<Response> }} client
 * @returns {(owner: string, limit?: number) => Promise<number>} Sessions counted, stopping once `limit` is reached.
 */
export function createSessionCounter(client) {
  const base = `https://${client.account}.blob.core.windows.net/${client.container}`;
  return async (owner, limit = MAX_SESSIONS_PER_OWNER) => {
    let count = 0;
    let marker = "";
    // Bounded pages: the listing stops as soon as the limit is reached.
    for (let page = 0; page < 10; page++) {
      const url =
        `${base}?restype=container&comp=list&maxresults=${limit}` +
        `&prefix=${encodeURIComponent(`${encodeURIComponent(owner)}/`)}` +
        (marker ? `&marker=${encodeURIComponent(marker)}` : "");
      const result = await client.request("GET", url);
      if (result.status === 404 && result.headers.get("x-ms-error-code") === "ContainerNotFound") return 0;
      if (result.status !== 200) throw new Error("Session listing unavailable");
      const xml = await result.text();
      count += (xml.match(/<Blob>/g) ?? []).length;
      marker = /<NextMarker>([^<]*)<\/NextMarker>/.exec(xml)?.[1] ?? "";
      if (count >= limit || !marker) return count;
    }
    // A listing that never ends is treated as full rather than as room to spare.
    return limit;
  };
}
