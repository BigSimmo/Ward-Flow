import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readWhatsNewEntries, WHATS_NEW_DIR } from "../scripts/ward-flow/whats-new-list.mjs";

const roots: string[] = [];
afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
});
const git = (root: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-C", root, "-c", "user.name=Synthetic", "-c", "user.email=synthetic@example.invalid", ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ward-news-history-"));
  roots.push(root);
  mkdirSync(path.join(root, WHATS_NEW_DIR), { recursive: true });
  git(root, "init", "-q", "-b", "main");
  writeFileSync(path.join(root, "README.md"), "Synthetic fixture.");
  git(root, "add", "README.md");
  git(root, "commit", "-qm", "Synthetic base");
  return root;
}
function add(root: string, id: string) {
  const file = `${WHATS_NEW_DIR}/${id}.json`;
  mkdirSync(path.join(root, WHATS_NEW_DIR), { recursive: true });
  writeFileSync(path.join(root, file), JSON.stringify({ line: "Synthetic change." }));
  git(root, "add", file);
  git(root, "commit", "-qm", "Synthetic note");
}

describe("What's new deterministic source feed", () => {
  it("retains an older-dated note when its branch lands after twenty newer-dated notes", () => {
    const root = fixture();
    git(root, "checkout", "-qb", "late-note");
    add(root, "2026-11-01-late");
    git(root, "checkout", "-q", "main");
    for (let index = 0; index < 20; index++) add(root, `2026-11-04-new-${index}`);
    git(root, "merge", "--no-ff", "-qm", "Synthetic late merge", "late-note");
    const selected = readWhatsNewEntries(root);
    expect(selected).toHaveLength(21);
    expect(selected[0]?.id).toBe("2026-11-01-late");
    expect(selected.some((entry) => entry.id === "2026-11-04-new-0")).toBe(true);
  });

  it("keeps a PR note after importing main and agrees with the eventual equal-tree main merge", () => {
    const root = fixture();
    git(root, "checkout", "-qb", "pr");
    add(root, "2026-11-01-pr-note");
    git(root, "checkout", "-q", "main");
    for (let index = 0; index < 20; index++) add(root, `2026-11-04-main-${index}`);
    git(root, "update-ref", "refs/remotes/origin/main", "HEAD");
    git(root, "checkout", "-q", "pr");
    git(root, "merge", "--no-ff", "-qm", "Synthetic import main", "main");
    const testedHead = git(root, "rev-parse", "HEAD").trim();
    const testedList = readWhatsNewEntries(root);
    expect(testedList).toHaveLength(21);
    expect(testedList[0]?.id).toBe("2026-11-01-pr-note");
    git(root, "checkout", "-q", "main");
    git(root, "merge", "--no-ff", "-qm", "Synthetic land PR", "pr");
    git(root, "update-ref", "refs/remotes/origin/main", "HEAD");
    const landedList = readWhatsNewEntries(root);
    expect(landedList).toEqual(testedList);
    git(root, "checkout", "-q", "--detach", testedHead);
    expect(git(root, "rev-parse", "HEAD^{tree}")).toBe(git(root, "rev-parse", "refs/remotes/origin/main^{tree}"));
    expect(readWhatsNewEntries(root)).toEqual(landedList);
  });

  it("does not bump edited old notes and includes a new uncommitted note in filename order", () => {
    const root = fixture();
    add(root, "2026-11-04-first");
    add(root, "2026-11-04-second");
    writeFileSync(
      path.join(root, WHATS_NEW_DIR, "2026-11-04-first.json"),
      JSON.stringify({ line: "Synthetic corrected note." }),
    );
    git(root, "add", `${WHATS_NEW_DIR}/2026-11-04-first.json`);
    git(root, "commit", "-qm", "Synthetic correction");
    writeFileSync(
      path.join(root, WHATS_NEW_DIR, "2026-11-01-preview.json"),
      JSON.stringify({ line: "Synthetic preview." }),
    );
    expect(readWhatsNewEntries(root).map((entry) => entry.id)).toEqual([
      "2026-11-01-preview",
      "2026-11-04-first",
      "2026-11-04-second",
    ]);
  });

  it("produces identical embedded definitions with full and shallow Git history", () => {
    const root = fixture();
    for (let index = 0; index < 20; index++) add(root, `2026-11-04-new-${index}`);
    add(root, "2026-11-01-late");
    const shallow = mkdtempSync(path.join(tmpdir(), "ward-news-shallow-"));
    roots.push(shallow);
    git(root, "clone", "-q", "--depth=1", `file://${root}`, shallow);
    const selected = readWhatsNewEntries(shallow);
    expect(selected).toHaveLength(21);
    expect(selected.some((entry) => entry.id === "2026-11-01-late")).toBe(true);
    expect(JSON.stringify(selected)).toBe(JSON.stringify(readWhatsNewEntries(root)));
    expect(readWhatsNewEntries(shallow, 4)).toEqual(readWhatsNewEntries(root, 4));
  });

  it("produces identical embedded definitions in a history-free source export", () => {
    const root = fixture();
    for (let index = 0; index < 20; index++) add(root, `2026-11-04-new-${index}`);
    add(root, "2026-11-01-late");
    const exported = mkdtempSync(path.join(tmpdir(), "ward-news-export-"));
    roots.push(exported);
    cpSync(path.join(root, WHATS_NEW_DIR), path.join(exported, WHATS_NEW_DIR), { recursive: true });
    const selected = readWhatsNewEntries(exported);
    expect(selected).toHaveLength(21);
    expect(selected[0]?.id).toBe("2026-11-01-late");
    expect(JSON.stringify(selected)).toBe(JSON.stringify(readWhatsNewEntries(root)));
    expect(readWhatsNewEntries(exported, 4)).toEqual(readWhatsNewEntries(root, 4));
    expect(Object.keys(selected[0] ?? {}).sort()).toEqual(["date", "id", "line"]);
  });

  it("release notes describe additions without relying on build-history selection", () => {
    const workflow = readFileSync(".github/workflows/daily-release.yml", "utf8");
    expect(workflow).toContain("### For staff, added in this release");
    expect(workflow).not.toContain("### For staff, shown in the app");
  });
});
