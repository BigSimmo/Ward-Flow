import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function runDevelopment(root = fileURLToPath(new URL("../..", import.meta.url))) {
  const check = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("organisation.mjs", import.meta.url)),
      "--write-report",
      "--source",
      "working-tree",
      "--root",
      root,
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (check.status !== 0) return check.status ?? 2;
  const ensure = spawnSync(process.execPath, [path.join(root, "scripts/ensure-local-server.mjs")], {
    cwd: root,
    stdio: "inherit",
  });
  return ensure.status ?? 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = runDevelopment();
