import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { directMainPushVerdict, wardFlowCheckoutVerdict, wardFlowRemoteVerdict } from "../scripts/guard-push.mjs";

const script = join(process.cwd(), "scripts", "guard-push.mjs");
const hook = join(process.cwd(), ".githooks", "pre-push");
const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).stdout.trim();
const stdin = `refs/heads/ward/test ${head} refs/heads/ward/test ${head}\n`;
const deletion = `refs/heads/ward/test ${"0".repeat(40)} refs/heads/ward/test ${head}\n`;
const gitCommand = process.platform === "win32" ? "where.exe" : "which";
const gitPath = spawnSync(gitCommand, ["git"], { encoding: "utf8" }).stdout.trim().split(/\r?\n/)[0];
const shell = process.platform === "win32" ? join(dirname(dirname(gitPath)), "bin", "sh.exe") : "/bin/sh";

let gitShim: string | undefined;

/** Drop every PATH entry holding gh, but keep git reachable when both share a folder (e.g. /usr/bin). */
function withoutGh(): string {
  const separator = process.platform === "win32" ? ";" : ":";
  const path = process.env.PATH ?? "";
  const ghNames = process.platform === "win32" ? ["gh.exe", "gh.cmd", "gh.bat", "gh.com"] : ["gh"];
  const kept = path.split(separator).filter((part) => !ghNames.some((name) => existsSync(join(part, name))));
  const gitDir = dirname(gitPath);
  if (!gitPath || kept.includes(gitDir)) return kept.join(separator);
  if (!gitShim) {
    gitShim = mkdtempSync(join(tmpdir(), "ward-git-only-"));
    symlinkSync(gitPath, join(gitShim, basename(gitPath)));
  }
  return [gitShim, ...kept].join(separator);
}

afterAll(() => {
  if (gitShim) rmSync(gitShim, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function run(remoteUrl?: string, pushInput = stdin, envOverrides: Record<string, string> = {}) {
  return spawnSync(process.execPath, [script, "origin", ...(remoteUrl ? [remoteUrl] : [])], {
    cwd: process.cwd(),
    input: pushInput,
    encoding: "utf8",
    timeout: 30_000,
    env: {
      ...process.env,
      PATH: withoutGh(),
      SKIP_IN_FLIGHT_CI_GUARD: "1",
      SKIP_FORMAT_GUARD: "1",
      SKIP_STATIC_GUARD: "1",
      SKIP_CHECKOUT_GUARD: "1",
      CONFIRM_WARD_FLOW_PUSH_TO_MAIN: "I_CONFIRM_FOLD_TO_ORIGIN_MAIN",
      CONFIRM_WARD_FLOW_REMOTE: "I_CONFIRM_WARD_FLOW_REMOTE",
      ...envOverrides,
    },
  });
}

describe("Ward-Flow push destination", () => {
  it("removes the actual gh executable from PATH before invoking the guard", () => {
    const result = spawnSync("gh", ["--version"], { env: { ...process.env, PATH: withoutGh() }, encoding: "utf8" });
    expect(result.error && "code" in result.error ? result.error.code : undefined).toBe("ENOENT");
  });

  it("requires canonical origin fetch and push URLs plus shared main history", () => {
    expect(wardFlowCheckoutVerdict().ok).toBe(true);
    const root = mkdtempSync(join(tmpdir(), "ward-flow-guard-checkout-"));
    const git = (...args: string[]) => {
      const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
    };
    try {
      git("clone", "--quiet", "--shared", "--no-checkout", process.cwd(), root);
      git("update-ref", "refs/heads/fixture", head);
      git("symbolic-ref", "HEAD", "refs/heads/fixture");
      git("remote", "set-url", "origin", "https://github.com/BigSimmo/Ward-Flow.git");
      git("update-ref", "refs/remotes/origin/main", "e735c1f8d34df005becf720b96752626a4f1dcc8");
      expect(wardFlowCheckoutVerdict(root).ok).toBe(true);
      git("remote", "set-url", "--push", "origin", "https://github.com/BigSimmo/PsychSift.git");
      expect(wardFlowCheckoutVerdict(root).ok).toBe(false);
      git("remote", "set-url", "--push", "origin", "https://github.com/BigSimmo/Ward-Flow.git");
      git("remote", "set-url", "origin", "https://github.com/BigSimmo/PsychSift.git");
      expect(wardFlowCheckoutVerdict(root).ok).toBe(false);
      git("remote", "set-url", "origin", "https://github.com/BigSimmo/Ward-Flow.git");
      git("remote", "remove", "origin");
      expect(wardFlowCheckoutVerdict(root).ok).toBe(false);
      git("remote", "add", "origin", "https://github.com/BigSimmo/Ward-Flow.git");
      git("update-ref", "refs/remotes/origin/main", "e735c1f8d34df005becf720b96752626a4f1dcc8");
      git("checkout", "--quiet", "--orphan", "unrelated");
      git("config", "user.name", "Ward Flow test");
      git("config", "user.email", "ward-test@example.invalid");
      writeFileSync(join(root, "unrelated.txt"), "unrelated history\n");
      git("add", "unrelated.txt");
      git("commit", "--quiet", "-m", "unrelated");
      expect(wardFlowCheckoutVerdict(root).ok).toBe(false);
    } finally {
      const resolvedParent = realpathSync(tmpdir());
      const resolvedRoot = realpathSync(root);
      expect(resolvedRoot.startsWith(`${resolvedParent}${process.platform === "win32" ? "\\" : "/"}`)).toBe(true);
      rmSync(resolvedRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("requires explicit direct-main confirmation even with optional guards skipped", () => {
    const mainInput = `refs/heads/main ${head} refs/heads/main ${head}\n`;
    expect(directMainPushVerdict(mainInput, {} as unknown as NodeJS.ProcessEnv).ok).toBe(false);
    expect(run("https://github.com/BigSimmo/Ward-Flow.git", mainInput).status).toBe(1);
    expect(
      directMainPushVerdict(mainInput, { ...process.env, CONFIRM_PUSH_TO_MAIN: "I_CONFIRM_PUSH_TO_MAIN" }).ok,
    ).toBe(true);
    const pushConfirmed = run("https://github.com/BigSimmo/Ward-Flow.git", mainInput, {
      CONFIRM_PUSH_TO_MAIN: "I_CONFIRM_PUSH_TO_MAIN",
    });
    expect(pushConfirmed.status, `${pushConfirmed.stderr}\n${pushConfirmed.stdout}`).toBe(0);
  });

  it("guards deletion of refs/heads/main as well", () => {
    const mainDeletion = `refs/heads/main ${"0".repeat(40)} refs/heads/main ${head}\n`;
    expect(run("https://github.com/BigSimmo/Ward-Flow.git", mainDeletion).status).toBe(1);
  });
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
    expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
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
