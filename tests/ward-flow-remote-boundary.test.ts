import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { wardFlowRemoteVerdict } from "../scripts/guard-push.mjs";

const script = join(process.cwd(), "scripts", "guard-push.mjs");
const hook = join(process.cwd(), ".githooks", "pre-push");
const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).stdout.trim();
const stdin = `refs/heads/ward/test ${head} refs/heads/ward/test ${head}\n`;
const deletion = `refs/heads/ward/test ${"0".repeat(40)} refs/heads/ward/test ${head}\n`;
const gitCommand = process.platform === "win32" ? "where.exe" : "which";
const gitPath = spawnSync(gitCommand, ["git"], { encoding: "utf8" }).stdout.trim().split(/\r?\n/)[0];
const shell = process.platform === "win32" ? join(dirname(dirname(gitPath)), "bin", "sh.exe") : "/bin/sh";

function withoutGh(): string {
  const separator = process.platform === "win32" ? ";" : ":";
  const path = process.env.PATH ?? "";
  return path
    .split(separator)
    .filter((part) => !part.toLowerCase().includes("github cli"))
    .join(separator);
}

function run(remoteUrl?: string, pushInput = stdin) {
  return spawnSync(process.execPath, [script, "origin", ...(remoteUrl ? [remoteUrl] : [])], {
    cwd: process.cwd(),
    input: pushInput,
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...process.env,
      PATH: withoutGh(),
      SKIP_IN_FLIGHT_CI_GUARD: "1",
      SKIP_FORMAT_GUARD: "1",
      SKIP_STATIC_GUARD: "1",
      CONFIRM_WARD_FLOW_PUSH_TO_MAIN: "I_CONFIRM_FOLD_TO_ORIGIN_MAIN",
      CONFIRM_WARD_FLOW_REMOTE: "I_CONFIRM_WARD_FLOW_REMOTE",
      CONFIRM_PUSH_TO_MAIN: "I_CONFIRM_PUSH_TO_MAIN",
    },
  });
}

describe("Ward-Flow push destination", () => {
  it.each([
    "https://github.com/BigSimmo/Ward-Flow.git",
    "https://github.com/BigSimmo/Ward-Flow",
    "git@github.com:BigSimmo/Ward-Flow.git",
    "ssh://git@github.com/BigSimmo/Ward-Flow.git",
  ])("accepts canonical destination %s", (remoteUrl) => {
    expect(wardFlowRemoteVerdict(remoteUrl).ok).toBe(true);
  });

  it.each([
    undefined,
    "",
    "https://github.com/BigSimmo/PsychSift.git",
    "https://github.com/other/Ward-Flow.git",
    "https://github.com/BigSimmo/Ward-Flow.git.evil.example",
    "https://github.com.evil.example/BigSimmo/Ward-Flow.git",
    "https://user:token@github.com/BigSimmo/Ward-Flow.git",
    "http://github.com/BigSimmo/Ward-Flow.git",
    "file:///tmp/Ward-Flow.git",
  ])("rejects unknown or wrong destination %s", (remoteUrl) => {
    expect(wardFlowRemoteVerdict(remoteUrl).ok).toBe(false);
  });

  it("blocks a wrong remote before all other guards, despite legacy overrides", () => {
    const result = run("https://github.com/BigSimmo/PsychSift.git");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ward-flow-remote");
    expect(result.stderr).not.toContain("auto-merge");
  });

  it("blocks a missing remote even for a deletion-only push", () => {
    const result = run(undefined, deletion);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ward-flow-remote");
  });

  it("allows Ward Flow branch pushes to the canonical remote", () => {
    const result = run("git@github.com:BigSimmo/Ward-Flow.git");
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("ward-flow-push");
  });

  it.runIf(existsSync(shell))("enforces destination identity through the Git hook", () => {
    const invoke = (remoteUrl?: string, path = process.env.PATH) =>
      spawnSync(shell, [hook, "origin", ...(remoteUrl ? [remoteUrl] : [])], {
        cwd: process.cwd(),
        input: deletion,
        encoding: "utf8",
        timeout: 10_000,
        env: { ...process.env, PATH: path },
      });

    expect(invoke("https://github.com/BigSimmo/Ward-Flow.git").status).toBe(0);
    expect(invoke("https://github.com/BigSimmo/PsychSift.git").stderr).toContain("ward-flow-remote");
    expect(invoke().status).toBe(1);
    const withoutNode = invoke("https://github.com/BigSimmo/Ward-Flow.git", join(process.cwd(), "tests"));
    expect(withoutNode.status).toBe(1);
    expect(withoutNode.stderr).toContain("node not found");
  });
});
