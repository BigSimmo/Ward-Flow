import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  browserArtifactRunId,
  consumeBrowserArtifact,
  prepareBrowserArtifact,
} from "../scripts/ward-flow/browser-build-artifact.mjs";
const temporary: string[] = [];
afterEach(() => {
  for (const file of temporary.splice(0))
    rmSync(file, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
function fixture() {
  const outside = mkdtempSync(path.join(os.tmpdir(), "ward-browser-artifact-"));
  temporary.push(outside);
  const root = path.join(outside, "checkout");
  mkdirSync(path.join(root, "node_modules/next"), { recursive: true });
  writeFileSync(path.join(root, ".gitignore"), "node_modules/\n.next-playwright/\n");
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "synthetic-browser-artifact", private: true }));
  writeFileSync(
    path.join(root, "package-lock.json"),
    JSON.stringify({ name: "synthetic-browser-artifact", lockfileVersion: 3 }),
  );
  writeFileSync(path.join(root, "fixture-source.js"), "export default 1;\n");
  writeFileSync(
    path.join(root, "node_modules/next/package.json"),
    JSON.stringify({ name: "next", version: "0.0.0-synthetic" }),
  );
  writeFileSync(path.join(root, "node_modules/next/index.js"), "export default 1;\n");
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git("init", "-q");
  git("remote", "add", "origin", "https://github.com/BigSimmo/Ward-Flow.git");
  git("add", "--", ".gitignore", "package.json", "package-lock.json", "fixture-source.js");
  git(
    "-c",
    "user.name=Synthetic test",
    "-c",
    "user.email=synthetic@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-q",
    "-m",
    "Synthetic browser artifact fixture",
  );
  const runRoot = path.join(root, ".next-playwright", "artifact-fixture");
  mkdirSync(path.join(runRoot, "dist/cache"), { recursive: true });
  writeFileSync(path.join(runRoot, "dist/BUILD_ID"), "synthetic-build");
  writeFileSync(path.join(runRoot, "dist/cache/discard"), "working-cache");
  writeFileSync(path.join(runRoot, "tsconfig.json"), "{}");
  const outputDir = path.join(outside, "artifact");
  const environment = {
    NODE_ENV: "production",
    NEXT_PUBLIC_WARD_SHARED_ENABLED: "false",
    NEXT_PUBLIC_MOCKUPS_ENABLED: "true",
    PLAYWRIGHT_BASE_URL: "http://localhost:3100",
  };
  return { root, runRoot, outputDir, environment };
}
describe("immutable exact-input browser build artifacts", () => {
  it("exports a finished isolated build without working cache and consumes into a fresh dist", () => {
    const f = fixture();
    prepareBrowserArtifact(f);
    expect(browserArtifactRunId(f.outputDir)).toBe(path.basename(f.runRoot));
    expect(existsSync(path.join(f.outputDir, "payload/dist/cache"))).toBe(false);
    rmSync(path.join(f.runRoot, "dist"), { recursive: true, maxRetries: 5, retryDelay: 100 });
    consumeBrowserArtifact({
      ...f,
      artifactDir: f.outputDir,
      environment: { ...f.environment, PLAYWRIGHT_BASE_URL: "http://localhost:3101" },
    });
    expect(readFileSync(path.join(f.runRoot, "dist/BUILD_ID"), "utf8")).toBe("synthetic-build");
  });
  it("rejects changed compile flags, altered payloads and existing destination output", () => {
    const f = fixture();
    prepareBrowserArtifact(f);
    expect(() => consumeBrowserArtifact({ ...f, artifactDir: f.outputDir })).toThrow(/fresh destination/);
    rmSync(path.join(f.runRoot, "dist"), { recursive: true, maxRetries: 5, retryDelay: 100 });
    expect(() =>
      consumeBrowserArtifact({
        ...f,
        artifactDir: f.outputDir,
        environment: { ...f.environment, NEXT_PUBLIC_WARD_SHARED_ENABLED: "true" },
      }),
    ).toThrow(/identity/);
    writeFileSync(path.join(f.outputDir, "payload/dist/BUILD_ID"), "altered");
    expect(() => consumeBrowserArtifact({ ...f, artifactDir: f.outputDir })).toThrow(/checksum/);
  });
  it("refuses overwrite, wrong run roots and malformed manifests", () => {
    const f = fixture();
    prepareBrowserArtifact(f);
    expect(() => prepareBrowserArtifact(f)).toThrow(/must not exist/);
    expect(() =>
      consumeBrowserArtifact({ ...f, runRoot: path.join(f.runRoot, "nested"), artifactDir: f.outputDir }),
    ).toThrow(/isolated/);
    writeFileSync(
      path.join(f.outputDir, "browser-build-manifest.json"),
      JSON.stringify({ version: 1, runId: "../escape" }),
    );
    expect(() => browserArtifactRunId(f.outputDir)).toThrow(/Invalid/);
  });
  it("rejects same-size dependency byte changes with unchanged package version and lockfile", () => {
    const f = fixture();
    prepareBrowserArtifact(f);
    rmSync(path.join(f.runRoot, "dist"), { recursive: true, maxRetries: 5, retryDelay: 100 });
    writeFileSync(path.join(f.root, "node_modules/next/index.js"), "export default 2;\n");
    expect(() => consumeBrowserArtifact({ ...f, artifactDir: f.outputDir })).toThrow(/identity/);
  });
  it("refuses artifact preparation when installed dependency byte identity is unavailable", () => {
    const f = fixture();
    rmSync(path.join(f.root, "package-lock.json"), { maxRetries: 5, retryDelay: 100 });
    expect(() => prepareBrowserArtifact(f)).toThrow(/dependency byte identity unavailable/);
    expect(existsSync(f.outputDir)).toBe(false);
  });
});
