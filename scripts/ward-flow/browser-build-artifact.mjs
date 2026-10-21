/** Exact-input, same-path browser builds. Finished outputs are never a working cache. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { installedToolchainIdentity } from "../test-evidence-identity.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const manifestName = "browser-build-manifest.json";
const runPattern = /^[a-z0-9-]+$/iu;
function treeDigest(root) {
  const hash = createHash("sha256");
  function walk(relative) {
    const absolute = path.join(root, relative);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error("Browser artifact inputs must not contain symlinks");
    hash.update(`${relative}\0${stat.isDirectory() ? "directory" : "file"}\0`);
    if (stat.isDirectory()) for (const child of readdirSync(absolute).sort()) walk(path.join(relative, child));
    else hash.update(digest(readFileSync(absolute)));
  }
  walk("");
  return hash.digest("hex");
}
function buildIdentity(root, environment, runId) {
  const dependencyIdentity = installedToolchainIdentity(root);
  if (!dependencyIdentity)
    throw new Error("Browser artifact dependency byte identity unavailable; cannot prepare or consume finished builds");
  // Next reads ignored dotenv files itself. Refuse them rather than omit hidden build inputs.
  for (const file of [".env", ".env.local", ".env.production", ".env.production.local"])
    if (existsSync(path.join(root, file))) throw new Error(`Browser artifacts refuse local ${file} inputs`);
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const files = git("ls-files", "-z", "--cached", "--others", "--exclude-standard")
    .split("\0")
    .filter(Boolean)
    .filter((file) => !file.split("/").includes("node_modules"))
    .sort();
  const source = createHash("sha256");
  for (const file of files) {
    source.update(`${file}\0`);
    const absolute = path.join(root, file);
    if (!existsSync(absolute)) source.update("deleted");
    else {
      if (!lstatSync(absolute).isFile()) throw new Error(`Unsupported browser build input: ${file}`);
      source.update(`file:${digest(readFileSync(absolute))}`);
    }
  }
  // Include compile-time feature/config settings, not per-job credentials, ports or evidence paths.
  const keys = Object.keys(environment)
    .filter((key) =>
      /^(NEXT_|SENTRY_|RAG_|ANALYZE$|NODE_ENV$|NODE_OPTIONS$|WARD_GATE_BUILD$|WARD_FLOW_SHOWCASE$|PLAYWRIGHT_OFFLINE_MODE$|WARD_ONLY_BUILD$)/u.test(
        key,
      ),
    )
    .sort();
  const flags = Object.fromEntries(keys.map((key) => [key, environment[key]]));
  flags.PLAYWRIGHT_LOCAL_HTTP = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/u.test(environment.PLAYWRIGHT_BASE_URL ?? "");
  return digest(
    JSON.stringify({
      root: realpathSync(root),
      runRoot: `.next-playwright/${runId}`,
      commit: git("rev-parse", "HEAD"),
      source: source.digest("hex"),
      dependencyIdentity,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      next: JSON.parse(readFileSync(path.join(root, "node_modules/next/package.json"), "utf8")).version,
      flags,
    }),
  );
}
function readManifest(directory) {
  const manifest = JSON.parse(readFileSync(path.join(directory, manifestName), "utf8"));
  if (
    manifest.version !== 1 ||
    !runPattern.test(manifest.runId ?? "") ||
    !/^[a-f0-9]{64}$/u.test(manifest.identity ?? "") ||
    !/^[a-f0-9]{64}$/u.test(manifest.payload ?? "")
  )
    throw new Error("Invalid browser build artifact manifest");
  return manifest;
}
export function browserArtifactRunId(directory) {
  return readManifest(directory).runId;
}
function validateRunRoot(root, runRoot) {
  const runId = path.basename(runRoot);
  if (!runPattern.test(runId) || path.resolve(runRoot) !== path.join(path.resolve(root), ".next-playwright", runId))
    throw new Error("Browser artifact requires the isolated checkout run root");
  for (const directory of [path.dirname(runRoot), runRoot]) {
    if (existsSync(directory) && lstatSync(directory).isSymbolicLink())
      throw new Error("Browser artifact run root must not be a symlink");
  }
  return runId;
}
export function prepareBrowserArtifact({ root, runRoot, outputDir, environment }) {
  const runId = validateRunRoot(root, runRoot);
  const relativeOutput = path.relative(path.resolve(root), path.resolve(outputDir));
  if (!relativeOutput.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeOutput))
    throw new Error("Browser artifact export must be outside the checkout");
  if (existsSync(outputDir)) throw new Error("Browser artifact destination must not exist");
  if (!existsSync(path.join(runRoot, "dist/BUILD_ID")))
    throw new Error("Browser artifact needs a finished production build");
  const identity = buildIdentity(root, environment, runId);
  mkdirSync(path.join(outputDir, "payload"), { recursive: true });
  cpSync(path.join(runRoot, "tsconfig.json"), path.join(outputDir, "payload/tsconfig.json"));
  cpSync(path.join(runRoot, "dist"), path.join(outputDir, "payload/dist"), {
    recursive: true,
    filter: (source) => source !== path.join(runRoot, "dist/cache"),
  });
  const payload = treeDigest(path.join(outputDir, "payload"));
  writeFileSync(
    path.join(outputDir, manifestName),
    `${JSON.stringify({ version: 1, runId, identity, payload }, null, 2)}\n`,
  );
}
export function consumeBrowserArtifact({ root, runRoot, artifactDir, environment }) {
  const runId = validateRunRoot(root, runRoot);
  const manifest = readManifest(artifactDir);
  if (manifest.runId !== runId || manifest.identity !== buildIdentity(root, environment, runId))
    throw new Error("Browser artifact build identity does not match this checkout, toolchain or flags");
  if (manifest.payload !== treeDigest(path.join(artifactDir, "payload")))
    throw new Error("Browser artifact payload checksum mismatch");
  if (existsSync(path.join(runRoot, "dist"))) throw new Error("Browser artifact requires a fresh destination dist");
  if (!existsSync(path.join(artifactDir, "payload/dist/BUILD_ID")))
    throw new Error("Browser artifact production build is missing");
  mkdirSync(runRoot, { recursive: true });
  cpSync(path.join(artifactDir, "payload"), runRoot, { recursive: true });
}
