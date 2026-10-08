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
// Windows does not include the Unix zip command. Python's standard library
// preserves the same explicit runtime-only file list without another package.
const windowsZip = `
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path.cwd()
with ZipFile(sys.argv[1], "w", ZIP_DEFLATED) as archive:
    for name in sys.argv[2:]:
        source = root / name
        entries = [source] if source.is_file() else source.rglob("*")
        for entry in entries:
            if entry.is_file():
                archive.write(entry, entry.relative_to(root).as_posix())
`;
const result =
  process.platform === "win32"
    ? spawnSync("python", ["-c", windowsZip, archive, ...files], { cwd: root, encoding: "utf8" })
    : spawnSync("zip", ["-qr", archive, ...files], { cwd: root, encoding: "utf8" });
if (result.error || result.status !== 0)
  throw new Error(
    "Backend packaging failed; install locked backend dependencies and Python on Windows or zip elsewhere",
  );
console.log(`Prepared ${archive}; no .env, tests or setup settings included`);
