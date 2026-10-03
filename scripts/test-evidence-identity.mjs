import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

export const OUTCOME_AFFECTING_ENV_VARS = [
  "VITEST_MAX_WORKERS",
  "CI",
  "ALLOW_PROVIDER_TESTS",
  "CARING_CONTACTS_DATABASE_URL",
  "CARING_CONTACTS_DB_TESTS",
  "FAST_CHECK_SEED",
  "LANG",
  "LC_ALL",
  "NODE_OPTIONS",
  "NODE_ENV",
  "TZ",
  "WARD_GATE_EXCLUDE_FILES",
  "WARD_GATE_SKIP_TOOLING",
  "WARD_PUBLIC_STANDALONE",
  "WARD_GATE_SHARD",
];

/** @param {Record<string,string|undefined>} [env] */
export function testEnvironmentIdentity(env = process.env) {
  return createHash("sha256")
    .update(JSON.stringify(OUTCOME_AFFECTING_ENV_VARS.map((key) => [key, env[key] ?? ""])))
    .digest("hex");
}

// FULL checkpoints justify a byte scan once at admission. Narrow receipt
// wrappers do not scan mutable dependencies or infer immutability from a stamp.
// Symlink targets are scanned by content; cycles and unreadable trees fail closed.
export function installedToolchainIdentity(root) {
  try {
    const digest = createHash("sha256");
    digest.update([process.version, process.platform, process.arch].join("\0"));
    digest.update(readFileSync(path.join(root, "package-lock.json")));
    let files = 0;
    const ancestors = new Set();
    const walk = (directory, relative = "") => {
      const real = realpathSync(directory);
      if (ancestors.has(real)) throw new Error("cyclic dependency link");
      ancestors.add(real);
      for (const name of readdirSync(directory).sort()) {
        if (name === ".cache" || name === ".vite" || name === ".codex-installed-tree.json") continue;
        const file = path.join(directory, name);
        const child = `${relative}/${name}`;
        const link = lstatSync(file);
        const stats = link.isSymbolicLink() ? statSync(file) : link;
        if (link.isSymbolicLink()) digest.update(`L\0${child}\0${realpathSync(file)}\0`);
        if (stats.isDirectory()) {
          digest.update(`D\0${child}\0`);
          walk(file, child);
        } else if (stats.isFile()) {
          digest.update(`F\0${child}\0`);
          digest.update(readFileSync(file));
          files++;
        }
      }
      ancestors.delete(real);
    };
    walk(path.join(root, "node_modules"));
    return files > 0 ? digest.digest("hex") : null;
  } catch {
    return null;
  }
}

/** @param {{root:string,env?:Record<string,string|undefined>,population:string[],args:string[],dependencyIdentity?:string|null}} options */
export function fullGateInputIdentity({
  root,
  env = process.env,
  population,
  args,
  dependencyIdentity = installedToolchainIdentity(root),
}) {
  if (!dependencyIdentity)
    throw new Error("FULL checkpoint dependency byte identity unavailable; cannot resume or issue reusable evidence");
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: 2,
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        dependencyIdentity,
        environment: testEnvironmentIdentity(env),
        population,
        args,
      }),
    )
    .digest("hex");
}
