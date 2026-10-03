import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { claimFiles, validateClaimPaths } from "../scripts/ward-flow/claim-files.mjs";

describe("exact-file claim administration", () => {
  it.each([
    "../outside.ts",
    "src/",
    "src/**",
    "src/a.ts,src/b.ts",
    "src/../a.ts",
    "src/a.ts\nRELEASED",
    "-option",
    "C:/outside.ts",
  ])("rejects unsafe scope %s", (file) => {
    expect(() => validateClaimPaths(process.cwd(), [file])).toThrow();
  });
  it("rejects duplicate claims and directory scope", () => {
    expect(() => validateClaimPaths(process.cwd(), ["package.json", "package.json"])).toThrow();
    expect(() => validateClaimPaths(process.cwd(), ["scripts"])).toThrow();
  });
  it("keeps another writer's lock and log intact", () => {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
    const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
    const folder = mkdtempSync(path.join(tmpdir(), "ward-claim-proof-"));
    const log = path.join(folder, "sign-out.md");
    writeFileSync(log, "Open sign-outs only\n");
    writeFileSync(`${log}.claim-lock`, "peer");
    try {
      expect(() =>
        claimFiles({ root, branch, owner: "fixture", files: ["tests/ward-claim-files.test.ts"], log }),
      ).toThrow();
      expect(readFileSync(log, "utf8")).toBe("Open sign-outs only\n");
      expect(readFileSync(`${log}.claim-lock`, "utf8")).toBe("peer");
    } finally {
      rmSync(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });
  it("never turns an active peer claim into a takeover", () => {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
    const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
    const folder = mkdtempSync(path.join(tmpdir(), "ward-claim-proof-"));
    const log = path.join(folder, "sign-out.md");
    const text = `Open sign-outs only\n- 2026-10-03 | Peer | codex/peer | ${folder} | tests/ward-claim-files.test.ts. repo=BigSimmo/Ward-Flow.\n`;
    writeFileSync(log, text);
    try {
      expect(() =>
        claimFiles({ root, branch, owner: "fixture", files: ["tests/ward-claim-files.test.ts"], log }),
      ).toThrow(/ownership conflict/);
      expect(readFileSync(log, "utf8")).toBe(text);
    } finally {
      rmSync(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });
  it("appends exact claims once and reuses the same owner without another inspection", () => {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
    const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
    const folder = mkdtempSync(path.join(tmpdir(), "ward-claim-proof-"));
    const log = path.join(folder, "sign-out.md");
    writeFileSync(log, "Open sign-outs only\n");
    const files = [`.local/claim-fixture-${process.pid}.ts`];
    try {
      expect(claimFiles({ root, branch, owner: "fixture", files, log }).claimed).toEqual(files);
      const text = readFileSync(log, "utf8");
      expect(text).toContain("repo=BigSimmo/Ward-Flow");
      expect(claimFiles({ root, branch, owner: "fixture", files, log }).alreadyOwned).toEqual(files);
      expect(readFileSync(log, "utf8")).toBe(text);
    } finally {
      rmSync(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });
});
