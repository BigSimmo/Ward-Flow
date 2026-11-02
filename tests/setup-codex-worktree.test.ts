import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { installedTreeStampName, writeInstalledTreeStamp } from "../scripts/check-installed-lock-parity.mjs";

import {
  findDependencyDonor,
  installationIsComplete,
  installedMetadataMatches,
  lockDigest,
  nodeVersionSatisfiesRange,
  parseWorktreeList,
  resolveNpmCli,
} from "../scripts/setup-codex-worktree.mjs";

const temporaryRoots: string[] = [];

function fixture(version = "1.0.0", complete = false) {
  const root = mkdtempSync(path.join(os.tmpdir(), "codex-worktree-setup-"));
  temporaryRoots.push(root);
  const packages = {
    "": { name: "fixture" },
    "node_modules/next": { version },
    "node_modules/react": { version: "19.2.8" },
  };
  writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages }));
  if (complete) {
    mkdirSync(path.join(root, "node_modules", "next"), { recursive: true });
    mkdirSync(path.join(root, "node_modules", "react"), { recursive: true });
    writeFileSync(path.join(root, "node_modules", "next", "package.json"), JSON.stringify({ version }));
    writeFileSync(path.join(root, "node_modules", "react", "package.json"), JSON.stringify({ version: "19.2.8" }));
    writeFileSync(
      path.join(root, "node_modules", ".package-lock.json"),
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          "node_modules/next": { version },
          "node_modules/react": { version: "19.2.8" },
        },
      }),
    );
    writeInstalledTreeStamp(root);
  }
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("Codex Desktop worktree setup", () => {
  it("enforces the complete declared Node range before dependency handling", () => {
    const range = ">=24.15.0 <25";

    expect(nodeVersionSatisfiesRange("24.13.0", range)).toBe(false);
    expect(nodeVersionSatisfiesRange("24.14.9", range)).toBe(false);
    expect(nodeVersionSatisfiesRange("24.15.0", range)).toBe(true);
    expect(nodeVersionSatisfiesRange("24.19.0", range)).toBe(true);
    expect(nodeVersionSatisfiesRange("25.0.0", range)).toBe(false);
    expect(nodeVersionSatisfiesRange("not-a-version", range)).toBe(false);
  });

  it("parses worktree paths without treating metadata as paths", () => {
    expect(parseWorktreeList("worktree C:/repo/main\nHEAD abc\n\nworktree C:/repo/feature\ndetached\n")).toEqual([
      path.resolve("C:/repo/main"),
      path.resolve("C:/repo/feature"),
    ]);
  });

  it("requires installed metadata and critical packages", () => {
    const incomplete = fixture("16.2.12");
    const complete = fixture("16.2.12", true);
    mkdirSync(path.join(incomplete, "node_modules"), { recursive: true });
    writeFileSync(
      path.join(incomplete, "node_modules", ".package-lock.json"),
      JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/next": { version: "16.2.12" } } }),
    );
    expect(installedMetadataMatches(incomplete)).toBe(false);
    expect(installationIsComplete(incomplete)).toBe(false);
    expect(installedMetadataMatches(complete)).toBe(true);
    expect(installationIsComplete(complete, ["next"])).toBe(true);
  });

  it("uses only a complete donor with a byte-identical lockfile", () => {
    const current = fixture("16.2.12");
    const wrongLock = fixture("16.2.11", true);
    const exactLock = fixture("16.2.12", true);

    expect(lockDigest(wrongLock)).not.toBe(lockDigest(current));
    expect(lockDigest(exactLock)).toBe(lockDigest(current));
    expect(findDependencyDonor([wrongLock, exactLock], current, ["next"])).toBe(exactLock);
  });

  it("resolves npm's JavaScript entrypoint without executing a Windows command shim", () => {
    const resolved = resolveNpmCli();
    expect(resolved === null || /npm-cli\.js$/u.test(resolved)).toBe(true);
  });

  it.each([false, true])("keeps the verified npm and preserves files on backend probe failure: %s", (probeFails) => {
    const root = fixture("16.2.12", true);
    const environment = { ...process.env };
    for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"]) delete environment[key];
    execFileSync("git", ["init", "--quiet", root], { env: environment, stdio: "pipe" });
    const major = Number(process.versions.node.split(".")[0]);
    writeFileSync(path.join(root, ".node-version"), process.versions.node);
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ engines: { node: `>=${major}.0.0 <${major + 1}` }, packageManager: "npm@11.17.0" }),
    );
    const backend = path.join(root, "backend", "ward-flow");
    mkdirSync(backend, { recursive: true });
    writeFileSync(path.join(backend, "package.json"), JSON.stringify({ name: "synthetic-backend" }));
    writeFileSync(path.join(backend, "package-lock.json"), readFileSync(path.join(root, "package-lock.json")));
    const partialMarker = path.join(backend, "node_modules", "partial-marker");
    mkdirSync(path.dirname(partialMarker), { recursive: true });
    writeFileSync(partialMarker, "synthetic partial dependency");

    const appData = path.join(root, "appdata");
    const npmCli = path.join(appData, "npm", "node_modules", "npm", "bin", "npm-cli.js");
    const events = path.join(root, "npm-calls.jsonl");
    const staleMarker = path.join(root, "stale-npm-ran");
    const staleCli = path.join(root, "stale-npm-cli.js");
    const hooksMarker = path.join(root, "hooks-ran");
    mkdirSync(path.dirname(npmCli), { recursive: true });
    writeFileSync(
      npmCli,
      `const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(events)}, JSON.stringify({ args, cwd: process.cwd(), cli: process.argv[1] }) + String.fromCharCode(10));
if (args.length === 1 && args[0] === "--version") {
  console.log(process.cwd() === ${JSON.stringify(backend)} && ${probeFails} ? "11.9.0" : "11.17.0");
  process.exit(0);
}
if (args.join("|") !== "ci|--ignore-scripts") process.exit(19);
if (fs.existsSync(${JSON.stringify(partialMarker)})) process.exit(20);
const packages = JSON.parse(fs.readFileSync("package-lock.json", "utf8")).packages;
for (const [location, entry] of Object.entries(packages)) {
  if (!location) continue;
  const directory = path.join(process.cwd(), location);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({ version: entry.version }));
}
fs.writeFileSync(path.join("node_modules", ".package-lock.json"), JSON.stringify({ packages }));
`,
    );
    writeFileSync(
      staleCli,
      `require("node:fs").writeFileSync(${JSON.stringify(staleMarker)}, "synthetic"); console.log("11.9.0");`,
    );
    mkdirSync(path.join(root, "scripts"));
    writeFileSync(
      path.join(root, "scripts", "install-git-hooks.mjs"),
      `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(hooksMarker)}, "synthetic");`,
    );
    const result = spawnSync(process.execPath, [path.resolve("scripts/setup-codex-worktree.mjs")], {
      cwd: root,
      encoding: "utf8",
      timeout: 15_000,
      env: { ...environment, APPDATA: appData, npm_execpath: staleCli },
    });
    expect(existsSync(staleMarker)).toBe(false);
    const calls = readFileSync(events, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line)) as { args: string[]; cwd: string; cli: string }[];
    expect(calls[0]).toEqual({ args: ["--version"], cwd: root, cli: npmCli });
    expect(calls).toContainEqual({ args: ["--version"], cwd: backend, cli: npmCli });
    expect(installationIsComplete(root)).toBe(true);
    if (probeFails) {
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("requires npm 11.17.0; detected 11.9.0");
      expect(existsSync(partialMarker)).toBe(true);
      expect(readFileSync(partialMarker, "utf8")).toBe("synthetic partial dependency");
      expect(calls.filter((call) => call.args[0] === "ci")).toEqual([]);
      expect(existsSync(path.join(backend, "node_modules", installedTreeStampName))).toBe(false);
      expect(existsSync(hooksMarker)).toBe(false);
    } else {
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(calls.filter((call) => call.args[0] === "ci")).toEqual([
        { args: ["ci", "--ignore-scripts"], cwd: backend, cli: npmCli },
      ]);
      expect(existsSync(partialMarker)).toBe(false);
      expect(installationIsComplete(backend)).toBe(true);
      expect(existsSync(hooksMarker)).toBe(true);
    }
  });

  it("keeps the Windows Desktop bootstrap distinct from the Cloud Bash setup", () => {
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const agentInstructions = readFileSync(path.resolve("AGENTS.md"), "utf8");
    const desktopInstructions = readFileSync(path.resolve("docs/agents/codex-desktop-worktree-setup.md"), "utf8");

    expect(packageJson.scripts["setup:codex-worktree"]).toBe("node scripts/setup-codex-worktree.mjs");
    expect(agentInstructions).toContain("docs/agents/codex-desktop-worktree-setup.md");
    expect(desktopInstructions).toContain("Never configure Windows Desktop worktrees");
    expect(desktopInstructions).toContain("node scripts/setup-codex-worktree.mjs --dry-run");
  });
});
