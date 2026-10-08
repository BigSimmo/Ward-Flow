import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkMaintainedDocLinks } from "../scripts/check-maintained-doc-links.mjs";
import { removePathSync } from "../scripts/retryable-fs.mjs";

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ward-maintained-links-"));
  roots.push(root);
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const write = (file: string, body: string, tracked = true) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), body);
    if (tracked) execFileSync("git", ["add", "--", file], { cwd: root });
  };
  return { root, write };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) removePathSync(root, { recursive: true });
});

describe("tracked maintained documentation gate", () => {
  it("checks root and agent anchors, retains native instructions and excludes untracked scratch", () => {
    const { root, write } = fixture();
    write("README.md", "# Home\n[review](docs/agents/review.md#contract)\n");
    write("docs/agents/review.md", "# Contract\n");
    write("src/CLAUDE.md", "[home](../README.md#home)\n");
    write("scratch.md", "[absent](missing.md)\n", false);
    expect(checkMaintainedDocLinks(root)).toBe(0);
    write("docs/agents/review.md", "# Renamed contract\n");
    expect(checkMaintainedDocLinks(root)).toBe(1);
    write("README.md", "# Home\n[review](docs/agents/review.md#renamed-contract)\n");
    expect(checkMaintainedDocLinks(root)).toBe(0);
    write("src/CLAUDE.md", "[home](../README.md#missing)\n");
    expect(checkMaintainedDocLinks(root)).toBe(1);
  });

  it("excludes paired historical sections but fails malformed boundaries and current missing paths", () => {
    const { root, write } = fixture();
    write(
      "README.md",
      "# Home\n<!-- docs-script-refs:historical-start -->\n[old](retired.md)\n<!-- docs-script-refs:historical-end -->\n",
    );
    expect(checkMaintainedDocLinks(root)).toBe(0);
    write("README.md", "# Home\n[bad](missing.md)\n");
    expect(checkMaintainedDocLinks(root)).toBe(1);
    write("README.md", "<!-- docs-script-refs:historical-start -->\n");
    expect(() => checkMaintainedDocLinks(root)).toThrow(/Unclosed/);
  });

  it("keeps spaced filenames intact and never fetches remote URLs", () => {
    const { root, write } = fixture();
    write("my guide.md", "# Guide\n[remote](https://invalid.example/docs)\n");
    write("README.md", "[guide](<my guide.md#guide>)\n");
    const fetch = vi.fn(() => {
      throw new Error("Network access is forbidden");
    });
    vi.stubGlobal("fetch", fetch);
    try {
      expect(checkMaintainedDocLinks(root)).toBe(0);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fails unavailable Git and empty tracked populations instead of scanning the default Ward tree", () => {
    const { root } = fixture();
    expect(() => checkMaintainedDocLinks(root)).toThrow(/No tracked Markdown/);
    const missingGit = mkdtempSync(join(tmpdir(), "ward-maintained-no-git-"));
    roots.push(missingGit);
    expect(() => checkMaintainedDocLinks(missingGit)).toThrow();
  });
});
