// @ts-check
// Audit PS-05: a full workspace read used to stringify and gzip the whole scoped board on every
// request. The store now keeps each scoped board it builds (postgres.mjs, keyed by revision and
// access) and registers it here as a part. A reply that carries a registered part is written as
// segments: the small per-request fields are serialised fresh, the part's JSON and its compressed
// form are made once and reused. Compressed parts are raw DEFLATE blocks ending in a sync flush,
// so they can sit inside one gzip stream between freshly compressed segments.
import { promisify } from "node:util";
import { constants, crc32, deflateRaw, gzip } from "node:zlib";
import { randomUUID } from "node:crypto";

const deflateRawAsync = promisify(deflateRaw);
const gzipAsync = promisify(gzip);

/** Response property naming the reply's segments, read by server.mjs when it compresses. */
export const REPLY_SEGMENTS = Symbol("ward.replySegments");

/**
 * A value serialised once. `json` is made on first use; `deflated` on the first compressed reply.
 * The value must never be changed after it is registered: every reply shares it.
 */
class Part {
  /** @param {unknown} value */
  constructor(value) {
    this.value = value;
    /** @type {Buffer | null} */
    this.json = null;
    /** @type {Promise<Buffer> | null} */
    this.deflated = null;
  }
  bytes() {
    this.json ??= Buffer.from(JSON.stringify(this.value), "utf8");
    return this.json;
  }
  compressed() {
    if (!this.deflated) {
      const made = deflateRawAsync(this.bytes(), { finishFlush: constants.Z_SYNC_FLUSH });
      this.deflated = made;
      // A failed compression is not kept, so the next reply tries again.
      made.catch(() => {
        if (this.deflated === made) this.deflated = null;
      });
    }
    return this.deflated;
  }
}

/** Registered values, held only while the value itself is (the store's bounded cache owns them). */
const parts = new WeakMap();

/** Registers `value` (an object or array) as a reusable reply part, and returns it unchanged. */
export function registerPart(value) {
  if (value && typeof value === "object" && !parts.has(value)) parts.set(value, new Part(value));
  return value;
}

/**
 * `body` as JSON segments when it holds a registered part: plain Buffers for the fresh fields and
 * Part objects for the reused ones. Null when it holds none, so the caller serialises as usual.
 * The placeholder is a random UUID string, so no field value can be mistaken for one.
 * @returns {Array<Buffer | Part> | null}
 */
export function replySegments(body) {
  const marker = randomUUID();
  /** @type {Part[]} */
  const used = [];
  const text = JSON.stringify(body, function (_key, value) {
    const part = value && typeof value === "object" ? parts.get(value) : undefined;
    if (!part) return value;
    used.push(part);
    return `${marker}${used.length - 1}`;
  });
  if (!used.length) return null;
  const segments = [];
  const pattern = new RegExp(`"${marker}(\\d+)"`, "g");
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    segments.push(Buffer.from(text.slice(last, match.index), "utf8"));
    segments.push(used[Number(match[1])]);
    last = match.index + match[0].length;
  }
  segments.push(Buffer.from(text.slice(last), "utf8"));
  return segments;
}

/** The whole JSON body of `segments`. */
export function segmentBytes(segments) {
  return Buffer.concat(segments.map((segment) => (Buffer.isBuffer(segment) ? segment : segment.bytes())));
}

/**
 * One gzip member for `segments`, reusing each part's compressed blocks. Every segment but the
 * last ends in a sync flush (byte aligned, not final), and each part was compressed on its own,
 * so no block refers back across a join. The trailer's CRC and length cover the whole body.
 */
export async function gzipSegments(segments) {
  if (typeof crc32 !== "function") return gzipAsync(segmentBytes(segments));
  const header = Buffer.from([0x1f, 0x8b, 0x08, 0, 0, 0, 0, 0, 0, 0xff]);
  const pieces = [header];
  let crc = 0;
  let length = 0;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    const last = index === segments.length - 1;
    const bytes = Buffer.isBuffer(segment) ? segment : segment.bytes();
    crc = crc32(bytes, crc);
    length += bytes.length;
    if (last) {
      // The last segment is always fresh JSON (at least the closing brace), and closes the stream.
      pieces.push(await deflateRawAsync(bytes, { finishFlush: constants.Z_FINISH }));
    } else if (Buffer.isBuffer(segment)) {
      pieces.push(await deflateRawAsync(bytes, { finishFlush: constants.Z_SYNC_FLUSH }));
    } else pieces.push(await segment.compressed());
  }
  const trailer = Buffer.alloc(8);
  trailer.writeUInt32LE(crc >>> 0, 0);
  trailer.writeUInt32LE(length % 2 ** 32, 4);
  pieces.push(trailer);
  return Buffer.concat(pieces);
}

/**
 * A JSON Response for `body`. With registered parts it carries its segments for server.mjs, so a
 * compressed reply reuses their compressed form; otherwise it is `Response.json` as before.
 * @param {unknown} body
 * @param {ResponseInit} init
 */
export function jsonResponse(body, init) {
  const segments = replySegments(body);
  if (!segments) return Response.json(body, init);
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const response = new Response(segmentBytes(segments), { ...init, headers });
  Object.defineProperty(response, REPLY_SEGMENTS, { value: segments });
  return response;
}

/**
 * A small least-recently-used map. Entries are evicted oldest first once `limit` is passed.
 * @template V
 */
export class LruCache {
  /** @param {number} limit */
  constructor(limit) {
    this.limit = limit;
    /** @type {Map<string, V>} */
    this.entries = new Map();
  }
  /** @param {string} key */
  get(key) {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }
  /** @param {string} key @param {V} value */
  set(key, value) {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value);
  }
  clear() {
    this.entries.clear();
  }
  get size() {
    return this.entries.size;
  }
}
