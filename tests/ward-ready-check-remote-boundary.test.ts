import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Kept from the retired fold-lock suite: ready-check must refuse to run where it cannot verify
// this repository, and must not create anything while refusing.
const readyScript = path.resolve(__dirname, "../scripts/ward-flow/ready-check.mjs");

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ward-ready-check-"));
  const git = (args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git(["init", "--quiet"]);
  git([
    "-c",
    "user.name=Ward Test",
    "-c",
    "user.email=ward@example.invalid",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    "base",
  ]);
  return { root, git };
}

// Host Git controls (for example a cloud proxy's GIT_CONFIG_*) trigger a different refusal first.
const hostEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
) as NodeJS.ProcessEnv;

function runReady(cwd: string, env: NodeJS.ProcessEnv = hostEnv) {
  return spawnSync(process.execPath, [readyScript, "acquire", "owner"], { cwd, encoding: "utf8", timeout: 15000, env });
}

describe("ready-check remote boundary", () => {
  it("refuses a repository whose only remote is not Ward Flow", () => {
    const { git, root } = fixture();
    git(["remote", "add", "upstream", "https://github.com/example/ward-flow.git"]);
    const result = runReady(root);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Cannot verify Ward Flow");
  });

  it("fails closed outside a Git repository", () => {
    const root = mkdtempSync(path.join(tmpdir(), "ward-ready-not-a-repository-"));
    const result = runReady(root);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Cannot verify Ward Flow");
    expect(existsSync(path.join(root, ".git"))).toBe(false);
  });

  it("refuses a remote-less repository without explicit test-only permission", () => {
    const { root } = fixture();
    const result = runReady(root, { ...hostEnv, WARD_FOLD_TEST_FIXTURE: "" });
    expect(result.status).toBe(2);
  });
});
