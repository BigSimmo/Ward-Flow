import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { readWhatsNewEntries, WHATS_NEW_DIR } from "../scripts/ward-flow/whats-new-list.mjs";

const roots: string[] = [];
afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
  vi.restoreAllMocks();
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

describe("What's new introduction order", () => {
  it("retains an older-dated note when its branch lands after twenty newer-dated notes", () => {
    const root = fixture();
    git(root, "checkout", "-qb", "late-note");
    add(root, "2026-11-01-late");
    git(root, "checkout", "-q", "main");
    for (let index = 0; index < 20; index++) add(root, `2026-11-04-new-${index}`);
    git(root, "merge", "--no-ff", "-qm", "Synthetic late merge", "late-note");
    const selected = readWhatsNewEntries(root);
    expect(selected).toHaveLength(20);
    expect(selected.at(-1)?.id).toBe("2026-11-01-late");
    expect(selected.some((entry) => entry.id === "2026-11-04-new-0")).toBe(false);
  });

  it("keeps a PR note newest after importing main and agrees with the eventual equal-tree main merge", () => {
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
    expect(testedList).toHaveLength(20);
    expect(testedList.at(-1)?.id).toBe("2026-11-01-pr-note");
    git(root, "checkout", "-q", "main");
    git(root, "merge", "--no-ff", "-qm", "Synthetic land PR", "pr");
    git(root, "update-ref", "refs/remotes/origin/main", "HEAD");
    const landedList = readWhatsNewEntries(root);
    expect(landedList).toEqual(testedList);
    git(root, "checkout", "-q", "--detach", testedHead);
    expect(git(root, "rev-parse", "HEAD^{tree}")).toBe(git(root, "rev-parse", "refs/remotes/origin/main^{tree}"));
    expect(readWhatsNewEntries(root)).toEqual(landedList);
  });

  it("does not bump edited old notes and previews a new uncommitted note last", () => {
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
      "2026-11-04-first",
      "2026-11-04-second",
      "2026-11-01-preview",
    ]);
  });

  it("retains all notes when a shallow export cannot prove landing order", () => {
    const root = fixture();
    for (let index = 0; index < 20; index++) add(root, `2026-11-04-new-${index}`);
    add(root, "2026-11-01-late");
    const shallow = mkdtempSync(path.join(tmpdir(), "ward-news-shallow-"));
    roots.push(shallow);
    git(root, "clone", "-q", "--depth=1", `file://${root}`, shallow);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const selected = readWhatsNewEntries(shallow);
    expect(selected).toHaveLength(21);
    expect(selected.some((entry) => entry.id === "2026-11-01-late")).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("retaining all notes"));
  });

  it("builds a source export without Git while retaining every note", () => {
    const root = mkdtempSync(path.join(tmpdir(), "ward-news-export-"));
    roots.push(root);
    const folder = path.join(root, WHATS_NEW_DIR);
    mkdirSync(folder, { recursive: true });
    for (let index = 0; index < 20; index++)
      writeFileSync(path.join(folder, `2026-11-04-new-${index}.json`), JSON.stringify({ line: "Synthetic change." }));
    writeFileSync(path.join(folder, "2026-11-01-late.json"), JSON.stringify({ line: "Synthetic late change." }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const selected = readWhatsNewEntries(root);
    expect(selected).toHaveLength(21);
    expect(selected[0]?.id).toBe("2026-11-01-late");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Existing bundle budgets still apply"));
  });

  it("release notes describe additions without promising the app's capped list", () => {
    const workflow = readFileSync(".github/workflows/daily-release.yml", "utf8");
    expect(workflow).toContain("### For staff, added in this release");
    expect(workflow).not.toContain("### For staff, shown in the app");
  });
});
