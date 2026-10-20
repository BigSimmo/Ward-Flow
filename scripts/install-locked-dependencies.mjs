#!/usr/bin/env node
// The CI install boundary owns the locked install and its attestation. Dependency
// lifecycle scripts stay disabled; stamping an arbitrary existing tree is not a CLI operation.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { installedTreeParity, writeInstalledTreeStamp } from "./check-installed-lock-parity.mjs";
import { childProcessFailureSummary } from "./child-process-result.mjs";

/** @param {{
 * root?:string,
 * env?:NodeJS.ProcessEnv,
 * platform?:NodeJS.Platform,
 * execPath?:string,
 * execute?:(command:string,args:string[],options:{cwd:string,env:NodeJS.ProcessEnv,stdio:"inherit",timeout:number,killSignal:"SIGKILL"})=>{status:number|null,signal?:string|null,error?:Error},
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
