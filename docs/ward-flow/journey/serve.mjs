import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")));
// Overridable, because a fixed port silently serves ANOTHER copy of this page. A stale server
// left running in a different worktree answers on the same port, the browser shows a page that
// looks right, and nothing says which file it came from. Measured that way once: `PORT=60414`.
const PORT = Number(process.env.PORT) || 60413;

http
  .createServer((req, res) => {
    // The query is dropped first. Checking for "/" before dropping it answered "/?anything" (a
    // reload with a cache-buster, say) with a 404. The page's own deep links use "#", not "?".
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\//, "") || "ward-journey-explorer.html";
    const file = path.resolve(root, rel);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      return res.end("no");
    }
    try {
      const body = fs.readFileSync(file);
      const type = file.endsWith(".json")
        ? "application/json"
        : file.endsWith(".js") || file.endsWith(".mjs")
          ? "text/javascript"
          : "text/html; charset=utf-8";
      res.writeHead(200, { "Content-Type": type });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log(`serving http://127.0.0.1:${PORT}/`));
