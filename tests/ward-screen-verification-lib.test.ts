import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  drawingStatus,
  implementationFiles,
  implementationSha256,
  implementationStatus,
} from "../scripts/ward-flow/screen-verification-lib.mjs";
import { PAIRS } from "../scripts/ward-flow/screen-pairs.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function tempDir(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

describe("drawingStatus — WF-35: the word CURRENT is retired", () => {
  it("is NOT YET LOOKED AT when nobody has looked", () => {
    expect(drawingStatus(null, "abc123")).toBe("NOT YET LOOKED AT");
    expect(drawingStatus(undefined, "abc123")).toBe("NOT YET LOOKED AT");
  });

  it("is UNAGEABLE when a look happened but recorded no hash", () => {
    expect(drawingStatus({ verdict: "matches" }, "abc123")).toBe("UNAGEABLE - no hash recorded");
  });

  it("is MANIFEST NOT AVAILABLE when the manifest file itself is missing, even with a recorded hash", () => {
    expect(drawingStatus({ mockupSha256: "abc123" }, null)).toBe("MANIFEST NOT AVAILABLE");
  });

  it("a matching hash never yields CURRENT — it yields DRAWING UNCHANGED since look", () => {
    const status = drawingStatus({ mockupSha256: "abc123" }, "abc123");
    expect(status).not.toBe("CURRENT");
    expect(status).not.toContain("CURRENT");
    expect(status).toBe("DRAWING UNCHANGED since look");
  });

  it("a mismatched hash is STALE", () => {
    expect(drawingStatus({ mockupSha256: "abc123" }, "different")).toBe("🔴 STALE - the drawing changed since");
  });

  it("an available manifest with no entry for this mockup (undefined lookup) is still STALE, not CURRENT", () => {
    const status = drawingStatus({ mockupSha256: "abc123" }, undefined);
    expect(status).not.toBe("CURRENT");
    expect(status).toBe("🔴 STALE - the drawing changed since");
  });
});

describe("implementationSha256", () => {
  it("hashes CRLF and LF content the same, and a content change changes the hash", () => {
    const dir = tempDir("wf-lib-hash-");
    try {
      const file = path.join(dir, "a.ts");
      writeFileSync(file, "export const a = 1;\nexport const b = 2;\n");
      const lfHash = implementationSha256(dir, [file]);

      writeFileSync(file, "export const a = 1;\r\nexport const b = 2;\r\n");
      const crlfHash = implementationSha256(dir, [file]);
      expect(crlfHash).toBe(lfHash);

      writeFileSync(file, "export const a = 1;\nexport const b = 999;\n");
      const changedHash = implementationSha256(dir, [file]);
      expect(changedHash).not.toBe(lfHash);
    } finally {
      cleanup(dir);
    }
  });

  it("returns null for an empty file set", () => {
    expect(implementationSha256(repositoryRoot, [])).toBeNull();
  });

  it("is stable regardless of input file order", () => {
    const dir = tempDir("wf-lib-order-");
    try {
      const fileA = path.join(dir, "a.ts");
      const fileB = path.join(dir, "b.ts");
      writeFileSync(fileA, "export const a = 1;\n");
      writeFileSync(fileB, "export const b = 2;\n");
      expect(implementationSha256(dir, [fileA, fileB])).toBe(implementationSha256(dir, [fileB, fileA]));
    } finally {
      cleanup(dir);
    }
  });
});

describe("implementationStatus", () => {
  it("is NO SOURCE FOUND for an empty file set (hash === null), regardless of what was recorded", () => {
    expect(implementationStatus(null, null)).toBe("NO SOURCE FOUND");
    expect(implementationStatus({ implementationSha256: "abc123" }, null)).toBe("NO SOURCE FOUND");
  });

  it("is NOT RECORDED when nothing was recorded for this screen", () => {
    expect(implementationStatus(null, "abc123")).toBe("NOT RECORDED");
    expect(implementationStatus({ verdict: "matches" }, "abc123")).toBe("NOT RECORDED");
  });

  it("is UNCHANGED since look when the recorded hash matches the current one", () => {
    expect(implementationStatus({ implementationSha256: "abc123" }, "abc123")).toBe("UNCHANGED since look");
  });

  it("is CHANGED since look when the recorded hash no longer matches", () => {
    expect(implementationStatus({ implementationSha256: "abc123" }, "different")).toBe("CHANGED since look");
  });
});

describe("implementationFiles", () => {
  it("does not imply whole-screen freshness when shared shell or global styles change", () => {
    const files = implementationFiles(repositoryRoot, "capacity", "/mockups/ward-flow/capacity");
    const relativePaths = files.map((file) => path.relative(repositoryRoot, file).split(path.sep).join("/"));
    expect(relativePaths).toContain("src/app/mockups/ward-flow/capacity/page.tsx");
    expect(relativePaths).not.toContain("src/app/globals.css");
    expect(relativePaths.some((file) => file.startsWith("src/components/ward-management/shell/"))).toBe(false);
  });
  it("resolves a /mockups/-prefixed route under src/app<route>/page.tsx", () => {
    const dir = tempDir("wf-lib-files-");
    try {
      const pageDir = path.join(dir, "src", "app", "mockups", "ward-flow-sign-in");
      mkdirSync(pageDir, { recursive: true });
      const pageFile = path.join(pageDir, "page.tsx");
      writeFileSync(pageFile, "export default function Page() {}\n");

      expect(implementationFiles(dir, null, "/mockups/ward-flow-sign-in")).toEqual([pageFile]);
    } finally {
      cleanup(dir);
    }
  });

  it("resolves a plain route under src/app/mockups/ward-flow<route>/page.tsx and includes every file under the folder", () => {
    const dir = tempDir("wf-lib-files-");
    try {
      const folderDir = path.join(dir, "src", "components", "ward-management", "delays");
      mkdirSync(folderDir, { recursive: true });
      const componentFile = path.join(folderDir, "delays-screen.tsx");
      writeFileSync(componentFile, "export {};\n");

      const pageDir = path.join(dir, "src", "app", "mockups", "ward-flow", "delays");
      mkdirSync(pageDir, { recursive: true });
      const pageFile = path.join(pageDir, "page.tsx");
      writeFileSync(pageFile, "export default function Page() {}\n");

      expect(implementationFiles(dir, "delays", "/delays")).toEqual([componentFile, pageFile].sort());
    } finally {
      cleanup(dir);
    }
  });

  it("returns an empty array when neither the folder nor the route resolves anything", () => {
    const dir = tempDir("wf-lib-files-");
    try {
      expect(implementationFiles(dir, "does-not-exist", "/nowhere")).toEqual([]);
    } finally {
      cleanup(dir);
    }
  });

  it("against the real repo, at least 33 of the 34 roster screens resolve at least one implementation file", () => {
    const roster = PAIRS.filter(([, , , contract]) => contract);
    expect(roster.length).toBe(34);

    let resolved = 0;
    for (const [, route, folder] of roster) {
      // PAIRS (screen-pairs.mjs) has no tuple type, so every column widens to
      // `string | boolean | null`; route and folder here are only ever a string or null — the
      // booleans live in the fourth (`contract`) column this `roster` filter already read.
      const routePath = route as string | null;
      const folderName = folder as string | null;
      if (implementationFiles(repositoryRoot, folderName, routePath).length > 0) resolved += 1;
    }
    expect(resolved).toBeGreaterThanOrEqual(33);
  });

  it("the statistics-ward pair includes statistics/statistics-ward-screen.tsx", () => {
    const pair = PAIRS.find(([mockup]) => mockup === "statistics-ward-third-edition.html");
    expect(pair).toBeDefined();
    const [, route, folder] = pair as [string, string, string, boolean];

    const files = implementationFiles(repositoryRoot, folder, route);
    const relativePaths = files.map((f) => path.relative(repositoryRoot, f).split(path.sep).join("/"));
    expect(relativePaths).toContain("src/components/ward-management/statistics/statistics-ward-screen.tsx");
  });
});

describe("screen verification checked revision", () => {
  it("retains missing historical revisions, renders recorded revisions and rejects malformed values", () => {
    const dir = tempDir("wf-verification-revision-");
    const docs = path.join(dir, "docs/ward-flow");
    const script = path.join(repositoryRoot, "scripts/ward-flow/screen-verification.mjs");
    const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: "utf8" });
    try {
      mkdirSync(docs, { recursive: true });
      const record = JSON.parse(
        readFileSync(path.join(repositoryRoot, "docs/ward-flow/screen-verification.json"), "utf8"),
      );
      const jsonPath = path.join(docs, "screen-verification.json");
      const checkedRevision = "a".repeat(40);
      record.screens[0].verified.checkedRevision = checkedRevision;
      writeFileSync(jsonPath, JSON.stringify(record));
      const result = run();
      expect(result.status, result.stderr).toBe(0);
      const output = readFileSync(path.join(docs, "SCREEN-VERIFICATION.md"), "utf8");
      expect(output).toContain(checkedRevision);
      expect(output).toContain("not recorded");
      expect(output).toContain("excluding shared shell");
      expect(run("--check").status).toBe(0);
      record.screens[0].verified.checkedRevision = "not-a-commit";
      writeFileSync(jsonPath, JSON.stringify(record));
      const invalid = run("--check");
      expect(invalid.status).toBe(1);
      expect(invalid.stderr).toContain('"checkedRevision" must be a full 40-character commit SHA');
    } finally {
      cleanup(dir);
    }
  });
});
