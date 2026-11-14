import { readFileSync } from "node:fs";
import http, { type ServerResponse } from "node:http";
import path from "node:path";

/** Real app/worker, isolated origin. Faults happen at HTTP, including navigation-preload requests. */
export async function createWardPwaProxy(baseURL: string) {
  const upstreamOrigin = new URL(baseURL);
  if (upstreamOrigin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(upstreamOrigin.hostname))
    throw new Error("The PWA fixture only proxies the runner's loopback HTTP application.");
  const worker = readFileSync(path.resolve(process.cwd(), "public/ward-flow-push-sw.js"), "utf8");
  const state = {
    version: "A",
    heldPath: null as string | null,
    requests: [] as { preload: boolean }[],
  };
  const held = new Set<ServerResponse>();
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname === "/ward-flow-push-sw.js") {
      response.writeHead(200, {
        "Content-Type": "application/javascript",
        "Cache-Control": "no-store",
      });
      // Comment-only revisions exercise update ownership, not mixed-bundle compatibility.
      response.end(`${worker}\n// PWA lifecycle fixture revision ${state.version}\n`);
      return;
    }
    if (pathname === state.heldPath && request.headers.accept?.includes("text/html")) {
      state.requests.push({
        preload: Boolean(request.headers["service-worker-navigation-preload"]),
      });
      held.add(response);
      response.on("close", () => held.delete(response));
      return;
    }
    // Only the path comes from the request: the host and port stay the runner's loopback app, so an
    // absolute-form request line cannot send the proxy anywhere else (CodeQL SSRF, PR C follow-up).
    const target = new URL(request.url ?? "/", "http://localhost");
    const forwarded = http.request(
      {
        hostname: upstreamOrigin.hostname,
        port: upstreamOrigin.port,
        path: `${target.pathname}${target.search}`,
        method: request.method,
        headers: { ...request.headers, host: upstreamOrigin.host },
      },
      (result) => {
        response.writeHead(result.statusCode ?? 502, result.headers);
        result.pipe(response);
      },
    );
    forwarded.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      response.end("The local PWA test upstream is unavailable.");
    });
    response.on("close", () => forwarded.destroy());
    request.pipe(forwarded);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The PWA fixture has no loopback port.");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    state,
    async close() {
      state.heldPath = null;
      for (const response of held) response.destroy();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}
