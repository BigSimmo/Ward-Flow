import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { test } from "node:test";
import { listen } from "./server.mjs";

test("live audit item 17: every backend reply sends no referrer, offers no feature and refuses no-cors embedding", async () => {
  const server = listen(async () => Response.json({ ok: true }), { port: 0, host: "127.0.0.1" });
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const port = /** @type {import("node:net").AddressInfo} */ (server.address()).port;
    for (const method of ["GET", "DELETE"]) {
      const headers = await new Promise((resolve, reject) => {
        const req = httpRequest({ host: "127.0.0.1", port, path: "/healthz", method }, (res) => {
          res.resume();
          resolve(res.headers);
        });
        req.on("error", reject);
        req.end();
      });
      assert.equal(headers["referrer-policy"], "no-referrer", method);
      assert.equal(headers["permissions-policy"], "camera=(), microphone=(), geolocation=(), payment=()", method);
      assert.equal(headers["cross-origin-resource-policy"], "same-origin", method);
      // The existing P174 pair is still there.
      assert.equal(headers["content-security-policy"], "default-src 'none'; frame-ancestors 'none'", method);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
