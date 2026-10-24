import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const created: string[] = [];
afterEach(() => {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function fixture(globalHooksPath?: string) {
  const root = mkdtempSync(join(tmpdir(), "ward-install-hooks-"));
  created.push(root);
  const home = join(root, "home");
  const repo = join(root, "repo");
  mkdirSync(home);
  mkdirSync(join(repo, "scripts"), { recursive: true });
  cpSync("scripts/install-git-hooks.mjs", join(repo, "scripts/install-git-hooks.mjs"));
  if (globalHooksPath) writeFileSync(join(home, ".gitconfig"), `[core]\n\thooksPath = ${globalHooksPath}\n`);
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, ".config"), GIT_CONFIG_NOSYSTEM: "1" };
  delete env.GIT_CONFIG_GLOBAL;
  execFileSync("git", ["init", "--quiet"], { cwd: repo, env });
  const run = () =>
    spawnSync(process.execPath, ["scripts/install-git-hooks.mjs"], {
      cwd: repo,
      env,
      encoding: "utf8",
      timeout: 10_000,
    });
  const config = (...args: string[]) =>
    spawnSync("git", ["config", ...args, "--get", "core.hooksPath"], {
      cwd: repo,
      env,
      encoding: "utf8",
    }).stdout.trim();
  return { run, config };
}

describe("install-git-hooks and a machine-wide hooks folder", () => {
  it("sets the repository-local hooks path and warns, naming the global one it leaves in place", () => {
    const { run, config } = fixture("/opt/invented-scanner-hooks");
    const result = run();
    expect(result.status).toBe(0);
    expect(config("--local")).toBe(".githooks");
    expect(config("--global")).toBe("/opt/invented-scanner-hooks");
    expect(result.stderr).toContain("global core.hooksPath (/opt/invented-scanner-hooks)");
  });

  it("stays quiet when there is no global hooks path", () => {
    const { run, config } = fixture();
    const result = run();
    expect(result.status).toBe(0);
    expect(config("--local")).toBe(".githooks");
    expect(result.stderr).not.toContain("warning");
  });
});
