#!/usr/bin/env node
// The CI install boundary owns the locked install and its attestation. Dependency
// lifecycle scripts stay disabled; stamping an arbitrary existing tree is not a CLI operation.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { installedTreeParity, writeInstalledTreeStamp } from "./check-installed-lock-parity.mjs";
import { childProcessFailureSummary } from "./child-process-result.mjs";

// The separately packaged backend inherits the owning project's toolchain pin.
/** @param {string} root */
function expectedNpmVersion(root) {
  for (let directory = root; ; directory = path.dirname(directory)) {
    const manifest = path.join(directory, "package.json");
    if (existsSync(manifest)) {
      const declared = JSON.parse(readFileSync(manifest, "utf8")).packageManager;
      if (declared !== undefined) {
        const version = /^npm@(\d+\.\d+\.\d+)$/u.exec(declared)?.[1];
        if (!version) throw new Error("Locked install requires an exact npm@version packageManager pin.");
        return version;
      }
    }
    if (path.dirname(directory) === directory)
      throw new Error("Locked install requires an owning package.json with an exact npm@version packageManager pin.");
  }
}

/** @param {{
 * root?:string,
 * env?:NodeJS.ProcessEnv,
 * platform?:NodeJS.Platform,
 * execPath?:string,
 * execute?:(command:string,args:string[],options:{cwd:string,env:NodeJS.ProcessEnv,stdio:"inherit"|"pipe",encoding?:"utf8",timeout:number,killSignal:"SIGKILL"})=>{status:number|null,signal?:string|null,error?:Error,stdout?:unknown},
 * log?:(message:string)=>void,
 * }} [options]
 */
export function installLockedDependencies({
  root = process.cwd(),
  env = process.env,
  platform = process.platform,
  execPath = process.execPath,
  execute = spawnSync,
  log = console.log,
} = {}) {
  const projectRoot = path.resolve(root);
  for (const file of ["package.json", "package-lock.json"]) {
    if (!existsSync(path.join(projectRoot, file)))
      throw new Error(`Locked install requires ${file} in ${projectRoot}.`);
  }
  const expectedNpm = expectedNpmVersion(projectRoot);
  let command = "npm";
  const args = ["ci", "--ignore-scripts"];
  if (env.npm_execpath) {
    command = execPath;
    args.unshift(env.npm_execpath);
  } else if (platform === "win32") {
    const npmCli = path.win32.join(path.win32.dirname(execPath), "node_modules", "npm", "bin", "npm-cli.js");
    if (!existsSync(npmCli)) throw new Error("Cannot resolve npm's CLI; run through npm or use Node with bundled npm.");
    command = execPath;
    args.unshift(npmCli);
  }
  const probe = execute(command, [...args.slice(0, -2), "--version"], {
    cwd: projectRoot,
    env,
    stdio: "pipe",
    encoding: "utf8",
    timeout: 30_000,
    killSignal: "SIGKILL",
  });
  if (probe.error || probe.signal || probe.status !== 0)
    throw new Error(
      `Cannot verify pinned npm ${expectedNpm} (${childProcessFailureSummary(probe)}); install not started.`,
    );
  const actualNpm = String(probe.stdout ?? "").trim();
  if (actualNpm !== expectedNpm)
    throw new Error(
      `Locked install requires npm ${expectedNpm}; detected ${actualNpm || "unavailable"}. Install not started.`,
    );
  log(`[locked-install] npm ${actualNpm} matches packageManager.`);
  // CI restores node_modules from a cache saved on main only, keyed on the Node version and the lock,
  // and sets WARD_INSTALL_RESTORED=true on an exact hit. The restored tree is reused only when its
  // own post-install stamp still matches this lock and the tree on disk; anything else reinstalls.
  if (env.WARD_INSTALL_RESTORED === "true") {
    const restored = installedTreeParity(projectRoot);
    if (restored.ok) {
      log(
        `[locked-install] reused the restored install: ${restored.packageLocations.length} package locations match the lock and its stamp.`,
      );
      return { ok: true, reused: true, verification: restored };
    }
    log(`[locked-install] restored install refused (${restored.reason}); running a clean install.`);
  }
  const result = execute(command, args, {
    cwd: projectRoot,
    env,
    stdio: "inherit",
    timeout: 600_000,
    killSignal: "SIGKILL",
  });
  if (result.error || result.signal || result.status !== 0)
    throw new Error(
      `Locked install failed (${childProcessFailureSummary(result)}); no install attestation was written.`,
    );

  // Metadata is checked by the writer before it creates a structural baseline.
  // This is valid for the frontend and separately packaged backend alike.
  const stamp = writeInstalledTreeStamp(projectRoot);
  const verification = installedTreeParity(projectRoot);
  if (!verification.ok) throw new Error(`Installed dependencies failed attestation: ${verification.reason}`);
  log(
    `[locked-install] verified ${verification.packageLocations.length} package locations and ${stamp.fileCount} files; lifecycle scripts disabled.`,
  );
  return { ok: true, stamp, verification };
}

function main(args = process.argv.slice(2)) {
  let root = process.cwd();
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--root" || !args[1] || args[1].startsWith("--"))
      throw new Error("Usage: node scripts/install-locked-dependencies.mjs [--root <project-directory>]");
    root = path.resolve(args[1]);
  }
  installLockedDependencies({ root });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
