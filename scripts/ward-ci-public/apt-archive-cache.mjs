import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Keeps the release gate's system packages between runs. WebKit needs about a hundred media
 * libraries that the runner image lacks, and the runner's apt mirror has taken longer than the
 * six-minute install budget to serve them (22 October 2026). `seed` puts cached packages where
 * apt-get looks before it downloads; `collect` copies what apt-get fetched out again, for the
 * main-only cache save. Packages that no longer match the runner's versions are simply downloaded.
 */
export const APT_ARCHIVES = "/var/cache/apt/archives";
const KEEP_PACKAGES = 'APT::Keep-Downloaded-Packages "true";\nBinary::apt-get::APT::Keep-Downloaded-Packages "true";\n';

const debs = (dir) => (existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".deb")) : []);

/**
 * @param {string} cacheDir
 * @param {{ run?: (command: string, args: string[], input?: string) => { status: number | null }, log?: (message: string) => void }} [options]
 */
export function seedArchives(cacheDir, { run = sudo, log = console.log } = {}) {
  // apt-get keeps what it downloads unless an image says otherwise; say so, so `collect` finds it.
  if (run("tee", ["/etc/apt/apt.conf.d/99ward-keep-packages"], KEEP_PACKAGES).status !== 0) return 1;
  const cached = debs(cacheDir);
  log(`Seeding ${cached.length} cached system packages.`);
  if (cached.length === 0) return 0;
  return run("cp", ["-t", APT_ARCHIVES, ...cached.map((name) => join(cacheDir, name))]).status === 0 ? 0 : 1;
}

export function collectArchives(
  cacheDir,
  { archives = APT_ARCHIVES, log = console.log, output = process.env.GITHUB_OUTPUT } = {},
) {
  mkdirSync(cacheDir, { recursive: true });
  const fetched = debs(archives);
  for (const name of fetched) copyFileSync(join(archives, name), join(cacheDir, name));
  log(`Collected ${fetched.length} system packages.`);
  if (output) appendFileSync(output, `count=${fetched.length}\n`);
  return 0;
}

function sudo(command, args, input) {
  return spawnSync("sudo", [command, ...args], {
    input,
    stdio: [input === undefined ? "inherit" : "pipe", "ignore", "inherit"],
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, dir] = process.argv.slice(2);
  if (!dir || !["seed", "collect"].includes(mode)) throw new Error("Usage: apt-archive-cache.mjs seed|collect <dir>");
  process.exitCode = mode === "seed" ? seedArchives(dir) : collectArchives(dir);
}
