import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { policyContractTests } from "./plan.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const result = spawnSync(process.execPath, [path.join(root, "scripts/run-vitest.mjs"), "run", ...policyContractTests], {
  cwd: root,
  stdio: "inherit",
  timeout: 180_000,
});
process.exit(result.status ?? 1);
