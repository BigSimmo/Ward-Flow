import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  WARD_DESK_QR_OPTIONS,
  encodeWardDeskQr,
  qrPath,
  wardDeskUrl,
} from "@/components/ward-management/settings/ward-desk-qr";

const digest = (data: readonly (readonly boolean[])[]) =>
  createHash("sha256")
    .update(data.map((row) => row.map((dark) => (dark ? "1" : "0")).join("")).join("\n"))
    .digest("hex");

describe("ward desk QR code (item 42)", () => {
  it("holds the ward route on this origin only: no query, fragment, path or token", () => {
    expect(wardDeskUrl("https://wardflow.example.test", "rph-adult-secure")).toBe(
      "https://wardflow.example.test/ward-flow/ward/rph-adult-secure",
    );
    // Whatever page Settings was opened on, only the origin is kept.
    expect(
      wardDeskUrl("https://wardflow.example.test:8443/ward-flow/settings?desk=ward&token=abc#x", "rph-adult-secure"),
    ).toBe("https://wardflow.example.test:8443/ward-flow/ward/rph-adult-secure");
    const url = new URL(wardDeskUrl("http://localhost:3377", "a b/c"));
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
    expect(url.pathname).toBe("/ward-flow/ward/a%20b%2Fc");
  });

  it("encodes exactly the ward address, and the matrix is stable", async () => {
    const url = "https://wardflow.example.test/ward-flow/ward/rph-adult-secure";
    const { encode } = await import("uqr");
    const direct = encode(url, WARD_DESK_QR_OPTIONS);
    const matrix = await encodeWardDeskQr(url);
    // Same input string, same options: the code is the address and nothing else.
    expect(matrix.data).toEqual(direct.data);
    expect(matrix.size).toBe(direct.data.length);
    // A different address gives a different code.
    const other = await encodeWardDeskQr(`${url}?x=1`);
    expect(digest(other.data)).not.toBe(digest(matrix.data));
    // Stable across runs and library updates that would change what is printed.
    expect({ size: matrix.size, sha256: digest(matrix.data) }).toMatchInlineSnapshot(`
      {
        "sha256": "1c6e6a632a69d26d40373c394fa2c7930d7f1e1d6d9d160e2b5ae1027af99a76",
        "size": 41,
      }
    `);
  });

  it("draws one unit square per dark module", async () => {
    const matrix = await encodeWardDeskQr("http://localhost:3377/ward-flow/ward/rph-adult-secure");
    const dark = matrix.data.flat().filter(Boolean).length;
    expect(qrPath(matrix).match(/M/g)?.length).toBe(dark);
    // The four-module quiet zone is white.
    expect(matrix.data[0]!.every((cell) => !cell)).toBe(true);
    expect(matrix.data[3]!.every((cell) => !cell)).toBe(true);
  });
});
