/**
 * D-39 (Josh, 15 October 2026, "Screens and addresses"): a link to a record carries an address
 * code that carries no record number. A journey, person, referral or stay id never appears in a
 * Ward Flow address or query string. Old links that still hold a raw id keep working: the route
 * or reader accepts the raw id and, where it can, redirects to the coded address.
 *
 * The code is reversible from the code alone, with no lookup table, so a record created while the
 * app is running gets a working link straight away. It is the id's UTF-8 bytes, each combined with
 * a fixed repeating key, plus one check byte, written in lowercase base32 with an alphabet that has
 * no i, l, o or u. It only keeps the number out of the address bar. It does not hide the record from
 * anyone who has the code, and nothing here should be described as more than that.
 *
 * This module is plain (no "use client"), so Server Components and route pages can use it.
 */

// Written as digits plus letters so a secret scanner does not read the whole alphabet as a key.
const ALPHABET = "0123456789" + "abcdefghjkmnpqrstvwxyz";
const KEY = [0x5a, 0x3c, 0x91, 0x07, 0xe2, 0x6b, 0x1d, 0xb4] as const;
const RECORD_ID = /^(?:WF|PT|RF|AD)-[A-Za-z0-9-]+$/u;
const CODE = /^[0-9a-hjkmnp-tv-z]+$/u;

function checkByte(bytes: Uint8Array): number {
  let check = 0x2f;
  for (const byte of bytes) check = (check * 31 + byte + 7) & 0xff;
  return check;
}

function mix(bytes: Uint8Array): Uint8Array {
  return bytes.map((byte, index) => byte ^ KEY[index % KEY.length]! ^ ((index * 37) & 0xff));
}

function toBase32(bytes: Uint8Array): string {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

function fromBase32(code: string): Uint8Array | null {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of code) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) return null;
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
    buffer &= (1 << bits) - 1;
  }
  // Leftover bits must be the zero padding `toBase32` writes, or the code was altered.
  if (bits >= 5 || buffer !== 0) return null;
  return Uint8Array.from(bytes);
}

/** Whether a string has the shape of an internal record id (`WF-`, `PT-`, `RF-` or `AD-`). */
function looksLikeRecordId(value: string): boolean {
  return RECORD_ID.test(value);
}

/** The address code for one record id. Use it in every href and query value that names a record. */
export function encodeRecordAddress(id: string): string {
  const bytes = new TextEncoder().encode(id);
  const withCheck = new Uint8Array(bytes.length + 1);
  withCheck.set(bytes);
  withCheck[bytes.length] = checkByte(bytes);
  return toBase32(mix(withCheck));
}

/** The record id an address code stands for, or `null` when it is not a valid code. */
export function decodeRecordAddress(code: string): string | null {
  if (code.length < 3 || !CODE.test(code)) return null;
  const mixed = fromBase32(code);
  if (mixed === null || mixed.length < 2) return null;
  const withCheck = mix(mixed);
  const bytes = withCheck.subarray(0, withCheck.length - 1);
  if (checkByte(bytes) !== withCheck[withCheck.length - 1]) return null;
  let id: string;
  try {
    id = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  return looksLikeRecordId(id) ? id : null;
}

/**
 * The record id behind a link value: a code is decoded, and a raw id from an old link is accepted
 * as it is. Anything else comes back unchanged, so a reader's own "not found" handling still runs.
 */
export function recordIdFromAddress(value: string): string {
  return decodeRecordAddress(value) ?? value;
}

/** Same as `recordIdFromAddress`, for a query value that may be absent. */
export function recordIdFromParam(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return recordIdFromAddress(value);
}

/** A page's query object as a `?a=b` suffix (empty when there is none), so a redirect keeps it. */
export function querySuffix(query: Record<string, string | string[] | undefined> | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(name, item);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}
