import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

function resolveBash(): string {
  if (process.platform === "win32") {
    const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
    if (existsSync(gitBash)) return gitBash;
  }
  return "bash";
}

const BASH_BIN = resolveBash();
const HOOK_PATH = join(process.cwd(), ".githooks", "pre-commit").replace(/\\/g, "/");
const WARD_FILE_RELATIVE = "src/components/ward-management/search/patient-search.tsx";
const scratchRoots: string[] = [];

afterEach(() => {
  for (const root of scratchRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** A fresh temp git repo, no remote, one base commit, on the given branch name. */
function repoFixture(branch: string): string {
  const root = mkdtempSync(join(tmpdir(), "ward-flow-precommit-"));
  scratchRoots.push(root);
  git(root, "init", "--quiet", `--initial-branch=${branch}`);
  git(root, "config", "user.name", "Ward Guard Test");
  git(root, "config", "user.email", "ward-guard-test@example.invalid");
  writeFileSync(join(root, "README.md"), "base\n");
  git(root, "add", "README.md");
  git(root, "commit", "--quiet", "-m", "base");
  return root;
}

/** Stage one Ward Flow component file, matching the hook's own ward-file pattern. */
function stageWardFile(root: string): void {
  const dir = join(root, "src", "components", "ward-management", "search");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "patient-search.tsx"), "export const PatientSearch = () => null;\n");
  git(root, "add", WARD_FILE_RELATIVE);
}

/** Run the real, unmodified `.githooks/pre-commit` hook via bash against a fixture repo. */
function runFullHook(root: string, env: Record<string, string | undefined> = {}) {
  const result = spawnSync(BASH_BIN, [HOOK_PATH], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

// The hook is a POSIX shell script exercised via `bash`. On some Windows machines
// `bash` on PATH resolves to a WSL launcher rather than Git Bash, which cannot run a
// native path fixture like this one (see tests/push-format-guard.test.ts, which skips
// entirely on win32 for exactly that reason). This machine's PATH was checked before
// writing this file and resolves `bash` to Git's own MINGW64 bash.exe (confirmed via
// `bash -c 'uname -a'`), which runs these fixtures correctly — so these tests run on
// win32 here rather than blanket-skipping it. If a differently configured Windows
// machine's `bash` resolves elsewhere, these would need the same skip as that file.
describe("Ward Flow local main fold guard (.githooks/pre-commit)", () => {
  it.each(["package.json", "backend/fixture.txt", ".github/workflows/fixture.yml", "src/lib/fixture.ts"])(
    "blocks every dedicated-repository path on main: %s",
    { timeout: 90_000 },
    (file) => {
      const root = repoFixture("main");
      mkdirSync(join(root, file, ".."), { recursive: true });
      writeFileSync(join(root, file), "synthetic fixture\n");
      git(root, "add", file);
      const result = runFullHook(root, { SKIP_DOCS_SYNC_HOOK: "1" });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("COMMITTING WARD FLOW TO LOCAL MAIN IS BLOCKED");
      expect(result.stderr).toContain(file);
    },
  );

  it("blocks a root deletion on master and accepts explicit confirmation", { timeout: 90_000 }, () => {
    const root = repoFixture("master");
    git(root, "rm", "README.md");
    const blocked = runFullHook(root, { SKIP_DOCS_SYNC_HOOK: "1" });
    expect(blocked.status).not.toBe(0);
    expect(blocked.stderr).toContain("README.md");
    const confirmed = runFullHook(root, {
      SKIP_DOCS_SYNC_HOOK: "1",
      CONFIRM_WARD_FLOW_FOLD_TO_MAIN: "I_CONFIRM_FOLD_TO_MAIN",
    });
    expect(confirmed.status).toBe(0);
  });

  it("checks the real rulings index after decisions.md alone changes", { timeout: 90_000 }, () => {
    const root = repoFixture("codex/decisions-fixture");
    const script = "scripts/ward-flow/owner-rulings-index.mjs";
    mkdirSync(join(root, "scripts/ward-flow"), { recursive: true });
    mkdirSync(join(root, "docs/ward-flow"), { recursive: true });
    copyFileSync(join(process.cwd(), script), join(root, script));
    const decisions = join(root, "docs/ward-flow/decisions.md");
    writeFileSync(decisions, "# Synthetic decisions\n\n## D-1 Initial fixture ruling\n");
    execFileSync(process.execPath, [script], { cwd: root });
    git(root, "add", "docs/ward-flow");
    git(root, "commit", "--quiet", "-m", "initial generated fixture");
    writeFileSync(decisions, "# Synthetic decisions\n\n## D-1 Updated fixture ruling\n");
    git(root, "add", "docs/ward-flow/decisions.md");
    const stale = runFullHook(root, { SKIP_DOCS_SYNC_HOOK: "1" });
    expect(stale.status).not.toBe(0);
    expect(stale.stderr).toContain("owner-rulings-index.mjs --check FAILED");
    execFileSync(process.execPath, [script], { cwd: root });
    git(root, "add", "docs/ward-flow/OWNER-RULINGS.md");
    expect(runFullHook(root, { SKIP_DOCS_SYNC_HOOK: "1" }).status).toBe(0);
  });

  // Load-sized timeout (25 Sept 2026): this test drives real git in a fixture repo, which took up to
  // 18s even on an idle suite and overran the 30s default when the PC was at 100% CPU. It matches the
  // 90s its sibling fixture tests already carry; no assertion changed.
  it(
    "blocks committing a staged Ward Flow file to local main without confirmation (non-zero exit)",
    { timeout: 90_000 },
    () => {
      const root = repoFixture("main");
      stageWardFile(root);

      const result = runFullHook(root);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("COMMITTING WARD FLOW TO LOCAL MAIN IS BLOCKED");
      expect(result.stderr).toContain(WARD_FILE_RELATIVE);
      expect(result.stderr).toContain('CONFIRM_WARD_FLOW_FOLD_TO_MAIN="I_CONFIRM_FOLD_TO_MAIN"');
    },
  );

  it("does not block the same commit on 'master' either (non-zero exit)", { timeout: 90_000 }, () => {
    const root = repoFixture("master");
    stageWardFile(root);

    const result = runFullHook(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("COMMITTING WARD FLOW TO LOCAL MAIN IS BLOCKED");
  });

  it(
    "allows the commit through with CONFIRM_WARD_FLOW_FOLD_TO_MAIN set (documents the override)",
    { timeout: 90_000 },
    () => {
      const root = repoFixture("main");
      stageWardFile(root);

      const result = runFullHook(root, { CONFIRM_WARD_FLOW_FOLD_TO_MAIN: "I_CONFIRM_FOLD_TO_MAIN" });

      // The rest of the hook (docs-sync) still runs past this point in a real repo, but a
      // minimal fixture has none of the inputs that would turn any of those checks on
      // (see the `matches_staged` patterns below the ward guard), so this exercises only
      // that the ward guard itself does not block once confirmed.
      expect(result.status).toBe(0);
      expect(result.stderr).not.toContain("COMMITTING WARD FLOW TO LOCAL MAIN IS BLOCKED");
    },
  );

  it("does not block a non-main branch when document sync is skipped", () => {
    const root = repoFixture("codex/feature-branch");
    stageWardFile(root);

    const result = runFullHook(root, { SKIP_DOCS_SYNC_HOOK: "1" });

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("COMMITTING WARD FLOW TO LOCAL MAIN IS BLOCKED");
  });

  it("keeps the ward guard active when only document sync is skipped", () => {
    const root = repoFixture("main");
    stageWardFile(root);

    const result = runFullHook(root, { SKIP_DOCS_SYNC_HOOK: "1" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("COMMITTING WARD FLOW TO LOCAL MAIN IS BLOCKED");
  });
});
