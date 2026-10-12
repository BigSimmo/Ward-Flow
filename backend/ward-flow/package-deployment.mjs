import { spawnSync } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("./", import.meta.url));
export const RUNTIME_FILES = Object.freeze([
  "function.mjs",
  "host.json",
  "auth.mjs",
  "config.mjs",
  "providers.mjs",
  "function-runtime.mjs",
  "postgres-config.mjs",
  "portable-postgres.mjs",
  "supabase-config.mjs",
  "supabase-auth.mjs",
  "supabase-postgres.mjs",
  "database.mjs",
  "server.mjs",
  "shared-http.mjs",
  "postgres.mjs",
  "push.mjs",
  "dist/engine.mjs",
  "package.json",
  "package-lock.json",
  "node_modules",
]);
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
        if not source.exists():
            raise FileNotFoundError(f"Missing packaging source: {name}")
        entries = [source] if source.is_file() else source.rglob("*")
        for entry in entries:
            if entry.is_file():
                archive.write(entry, entry.relative_to(root).as_posix())
`;
export async function packageDeployment() {
  await stat(new URL("./dist/engine.mjs", import.meta.url));
  await mkdir(new URL("./dist/", import.meta.url), { recursive: true });
  const archive = fileURLToPath(new URL("./dist/wardflow-backend.zip", import.meta.url));
  await rm(archive, { force: true });
  const result =
    process.platform === "win32"
      ? spawnSync("python", ["-c", windowsZip, archive, ...RUNTIME_FILES], {
          cwd: root,
          encoding: "utf8",
          timeout: 60000,
        })
      : spawnSync("zip", ["-qr", archive, ...RUNTIME_FILES], { cwd: root, encoding: "utf8", timeout: 60000 });
  if (result.error || result.status !== 0)
    throw new Error(
      "Backend packaging failed; install locked backend dependencies and Python on Windows or zip elsewhere",
    );
  console.log(`Prepared ${archive}; no .env, tests or setup settings included`);
  return archive;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await packageDeployment();
