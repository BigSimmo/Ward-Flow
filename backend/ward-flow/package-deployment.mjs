import { spawnSync } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./", import.meta.url));
const engine = new URL("./dist/engine.mjs", import.meta.url);
await stat(engine);
await mkdir(new URL("./dist/", import.meta.url), { recursive: true });
const archive = fileURLToPath(new URL("./dist/wardflow-backend.zip", import.meta.url));
await rm(archive, { force: true });
const files = [
  "function.mjs",
  "host.json",
  "auth.mjs",
  "config.mjs",
  "database.mjs",
  "server.mjs",
  "shared-http.mjs",
  "postgres.mjs",
  "dist/engine.mjs",
  "package.json",
  "package-lock.json",
  "node_modules",
];
const result = spawnSync("zip", ["-qr", archive, ...files], { cwd: root, encoding: "utf8" });
if (result.error || result.status !== 0)
  throw new Error("Backend packaging failed; install locked backend dependencies and zip first");
console.log(`Prepared ${archive}; no .env, tests or setup settings included`);
