// Preview only these newly authored artefacts. Never serve an arbitrary workspace path.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const allowed = new Map([
  ["/", "explorer.html"],
  ["/explorer.html", "explorer.html"],
  ["/pathways.csv", "pathways.csv"],
  ["/connections.csv", "connections.csv"],
]);
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  if (pathname === "/api/local-project-id") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return response.end(
      JSON.stringify({
        project: "BigSimmo/Ward-Flow",
        worktree: path.resolve(here, "../../../.."),
        task: "01a11902-8a33-7663-9fde-058cdaf3063b",
        mode: "new-standalone-diagram-preview",
        pid: process.pid,
      }),
    );
  }
  if (!allowed.has(pathname)) {
    response.writeHead(404);
    return response.end("Not part of this preview");
  }
  const filename = allowed.get(pathname);
  response.writeHead(200, {
    "Content-Type": filename.endsWith(".csv") ? "text/csv; charset=utf-8" : "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  });
  response.end(fs.readFileSync(path.join(here, filename)));
});
server.listen(0, "127.0.0.1", () =>
  console.log(
    `WA_PATHWAYS_PREVIEW http://127.0.0.1:${server.address().port}/ task=01a11902-8a33-7663-9fde-058cdaf3063b pid=${process.pid}`,
  ),
);
// End a forgotten preview; no public binding, background watcher or external service.
setTimeout(() => server.close(), 45 * 60 * 1000).unref();
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
