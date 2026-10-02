import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";

it("keeps foreign claims separate in a Git hook and honours explicit multi-branch releases", () => {
  const scratch = mkdtempSync(join(tmpdir(), "ward-hook-env-"));
  const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  const objects = resolve(git(process.cwd(), "rev-parse", "--git-common-dir"), "objects").replace(/\\/g, "/");
  const fixture = (name: string, remote: string) => {
    const root = join(scratch, name);
    mkdirSync(root);
    git(root, "init", "--quiet", "-b", "main");
    git(root, "config", "user.name", "Synthetic Test");
    git(root, "config", "user.email", "synthetic@example.invalid");
    mkdirSync(join(root, ".git", "objects", "info"), { recursive: true });
    writeFileSync(join(root, ".git", "objects", "info", "alternates"), `${objects}\n`);
    const tree = git(root, "mktree");
    const head = git(
      root,
      "commit-tree",
      tree,
      "-p",
      "e735c1f8d34df005becf720b96752626a4f1dcc8",
      "-m",
      "synthetic fixture",
    );
    git(root, "update-ref", "refs/heads/main", head);
    git(root, "update-ref", "refs/remotes/origin/main", head);
    git(root, "remote", "add", "origin", remote);
    return root;
  };
  try {
    const own = fixture("public", "https://github.com/BigSimmo/Ward-Flow.git");
    const peer = fixture("peer", "https://github.com/BigSimmo/Ward-Flow.git");
    const foreign = fixture("foreign", "https://github.com/BigSimmo/PsychSift.git");
    const script = pathToFileURL(resolve("scripts/pre-commit-checks.mjs")).href;
    const log = [
      "Open sign-outs only",
      `- 2026-10-02 | Legacy | ward/legacy | ${foreign} | src/legacy.ts`,
      `- 2026-10-02 | Public A | codex/a | ${peer} | src/a.ts. repo=BigSimmo/Ward-Flow`,
      `- 2026-10-02 | Public B | codex/b | ${peer} | src/b.ts. repo=BigSimmo/Ward-Flow`,
      `- 2026-10-02 | Public C | codex/c | ${peer} | src/c.ts. repo=BigSimmo/Ward-Flow`,
    ].join("\n");
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      const { isPublicWardFlowCheckout, signOutConflicts } = await import(${JSON.stringify(script)});
      const root = ${JSON.stringify(own)};
      const log = ${JSON.stringify(log)};
      const files = ['src/legacy.ts', 'src/a.ts', 'src/b.ts', 'src/c.ts'];
      const before = signOutConflicts(files, log, 'codex/mine', root);
      const after = signOutConflicts(files, log + '\\nRELEASED 2026-10-02 | Public | codex/a, codex/b | repo=BigSimmo/Ward-Flow', 'codex/mine', root);
      console.log(JSON.stringify({ public: isPublicWardFlowCheckout(root), foreign: isPublicWardFlowCheckout(${JSON.stringify(foreign)}), before, after }));
    `,
      ],
      {
        cwd: own,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_DIR: join(own, ".git"),
          GIT_COMMON_DIR: join(own, ".git"),
          GIT_WORK_TREE: own,
          GIT_INDEX_FILE: join(own, ".git", "index"),
        },
      },
    );
    const result = JSON.parse(output);
    expect(result.public).toBe(true);
    expect(result.foreign).toBe(false);
    expect(result.before.map((entry: { file: string }) => entry.file)).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
    expect(result.after).toEqual([{ file: "src/c.ts", owner: "Public C", branch: "codex/c" }]);
  } finally {
    expect(
      resolve(scratch).startsWith(resolve(tmpdir()) + "/") || resolve(scratch).startsWith(resolve(tmpdir()) + "\\"),
    ).toBe(true);
    rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
