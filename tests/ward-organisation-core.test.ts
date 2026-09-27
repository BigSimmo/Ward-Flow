import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { buildReport, classifyEntry, validateRegistry } from "../scripts/ward-flow/organisation-core.mjs";
import { checkOrganisation, readSelectedReport, reportDirectory } from "../scripts/ward-flow/organisation.mjs";
import { runDevelopment } from "../scripts/ward-flow/dev-with-organisation.mjs";

const reference = "docs/ward-flow-task-ledger.md";
function registry() {
  return {
    schemaVersion: 1,
    product: "ward-flow",
    systems: [
      "behaviour",
      "data-content",
      "documentation-knowledge",
      "issue-health",
      "safety-governance",
      "change-recovery",
    ],
    roots: ["ward/**", "shared/**"],
    sourceClasses: [{ id: "source", extensions: [".ts", ".md", ".json"] }],
    denials: ["**/private/**", "**/*.secret.*"],
    rules: [
      {
        id: "ward",
        pattern: "ward/**",
        priority: 0,
        owner: "ward-flow",
        module: "ward",
        system: null,
        reference,
        reviewedBy: "fixture",
      },
    ],
    exceptions: [
      {
        id: "shared",
        path: "shared/util.ts",
        owner: "shared",
        module: "host",
        system: "change-recovery",
        reference,
        reviewedBy: "fixture",
      },
      {
        id: "mixed",
        path: "shared/mixed.ts",
        owner: "mixed",
        module: "host",
        system: "change-recovery",
        reference,
        reviewedBy: "fixture",
      },
      {
        id: "other",
        path: "ward/other.ts",
        owner: "excluded",
        module: null,
        system: null,
        reference,
        reviewedBy: "fixture",
      },
      {
        id: "sensitive",
        path: "ward/private/person.secret.json",
        owner: "ward-flow",
        module: "ward",
        system: "data-content",
        reference,
        reviewedBy: "fixture",
      },
    ],
    canonicalSources: [] as {
      id: string;
      path: string;
      reference: string;
      reviewedBy: string;
      expectedHash?: string;
      expiresAt?: string;
      supersededBy?: string;
    }[],
    renames: [] as {
      id: string;
      from: string;
      to: string;
      exceptionId: string;
      reference: string;
      reviewedBy: string;
    }[],
    unresolved: [] as {
      id: string;
      path: string;
      reason: string;
      owner: string;
      reference: string;
      reviewedBy: string;
      scope: { sourceClass: string | null; contentHash: string | null; reasons: string[] };
      expiresAt?: string;
    }[],
  };
}
const entry = (path: string, extra = {}) => ({ path, contained: true, kind: "file", ...extra });

describe("C1: admission is separate from reviewed ownership", () => {
  it("connects the installed six systems to real sources and routes new work in registered locations", () => {
    const installed = JSON.parse(fs.readFileSync("docs/ward-flow/organisation/registry.json", "utf8"));
    const examples = [
      ["src/components/ward-management/ward-flow-reducer.ts", "behaviour"],
      ["src/components/ward-management/ward-model.ts", "data-content"],
      ["src/components/ward-management/reference/ward-reference-registry.ts", "data-content"],
      ["docs/ward-flow/README.md", "documentation-knowledge"],
      ["docs/ward-flow/plans/README.md", "documentation-knowledge"],
      ["tests/ward-organisation-core.test.ts", "issue-health"],
      ["src/components/ward-management/ward-flow-persistence-classification.ts", "safety-governance"],
      ["scripts/ward-flow/organisation.mjs", "change-recovery"],
    ];
    expect(validateRegistry(installed)).toEqual([]);
    for (const [file, system] of examples) {
      expect(fs.statSync(file).isFile()).toBe(true);
      expect(classifyEntry(entry(file), installed)).toMatchObject({ system, admission: "admitted" });
    }
    // Pure path classification: no synthetic files are written into this checkout.
    for (const [file, system] of [
      ["docs/ward-flow/new-guide.md", "documentation-knowledge"],
      ["docs/ward-flow/plans/new-plan.md", "documentation-knowledge"],
      ["tests/ward-new-feature.test.ts", "issue-health"],
      ["scripts/ward-flow/new-tool.mjs", "change-recovery"],
    ])
      expect(classifyEntry(entry(file), installed)).toMatchObject({ system, admission: "admitted" });
    expect(classifyEntry(entry("src/components/ward-management/new-feature.ts"), installed)).toMatchObject({
      owner: "ward-flow",
      system: null,
      admission: "admitted",
    });
    expect(classifyEntry(entry("unregistered/new-feature.ts"), installed).admission).toBe("excluded");
    expect(classifyEntry(entry("docs/ward-flow/mockups/new-drawing.html"), installed)).toMatchObject({
      owner: "design-reference",
      system: null,
      admission: "excluded",
    });
  });

  it("returns validation findings for malformed registry records instead of throwing", () => {
    for (const key of ["sourceClasses", "rules", "exceptions", "canonicalSources", "renames", "unresolved"]) {
      for (const bad of [null, 42, []]) {
        const invalid = { ...registry(), [key]: [bad] };
        expect(() => validateRegistry(invalid)).not.toThrow();
        expect(validateRegistry(invalid).length).toBeGreaterThan(0);
      }
    }
  });

  it("classifies Ward, shared, mixed and excluded sources without inventing a system for module-only code", () => {
    const r = registry();
    expect(validateRegistry(r)).toEqual([]);
    expect(classifyEntry(entry("ward/model.ts"), r)).toMatchObject({
      owner: "ward-flow",
      system: null,
      admission: "admitted",
      source: "ward",
    });
    expect(classifyEntry(entry("shared/util.ts"), r)).toMatchObject({ owner: "shared", admission: "admitted" });
    expect(classifyEntry(entry("shared/mixed.ts"), r)).toMatchObject({ owner: "mixed", admission: "admitted" });
    expect(classifyEntry(entry("ward/other.ts"), r)).toMatchObject({ owner: "excluded", admission: "excluded" });
    expect(classifyEntry(entry("psychsift/answer.ts"), r)).toMatchObject({ admission: "excluded" });
  });

  it("keeps unknown ownership and source classes metadata-only", () => {
    expect(classifyEntry(entry("shared/new.ts"), registry())).toMatchObject({
      owner: "unknown",
      admission: "restricted",
      reasons: ["unclassified"],
    });
    expect(classifyEntry(entry("ward/drawing.bin"), registry())).toMatchObject({
      admission: "restricted",
      reasons: ["unknown-source-class"],
    });
  });

  it("denies sensitive content even with an exact reviewed ownership exception", () => {
    expect(classifyEntry(entry("ward/private/person.secret.json"), registry())).toMatchObject({
      admission: "restricted",
      path: null,
      reasons: ["content-denied"],
    });
  });

  it("rejects traversal and resolved escape before matching exact exceptions", () => {
    for (const path of ["../ward/a.ts", "ward/../a.ts", "C:/ward/a.ts", "ward\\a.ts", "ward/a.ts:secret"]) {
      expect(classifyEntry(entry(path), registry())).toMatchObject({ admission: "unavailable", path: null });
    }
    expect(classifyEntry(entry("shared/util.ts", { contained: false }), registry())).toMatchObject({
      admission: "unavailable",
      path: null,
    });
  });

  it("does not resolve conflicting equally ranked ownership rules", () => {
    const r = registry();
    r.rules.push({ ...r.rules[0], id: "conflict", owner: "shared" });
    expect(classifyEntry(entry("ward/model.ts"), r)).toMatchObject({
      admission: "restricted",
      reasons: ["conflicting-rules"],
    });
  });

  it("refuses unknown registry versions and unreviewed or escaping records", () => {
    expect(validateRegistry({ ...registry(), schemaVersion: 2 })).toContain("unsupported-registry-version");
    const r = registry();
    r.rules[0].reviewedBy = "";
    r.exceptions[0].path = "../outside.ts";
    expect(validateRegistry(r).length).toBeGreaterThan(0);
  });
});

const registryPath = "docs/ward-flow/organisation/registry.json";
function fixture() {
  const root = fs.mkdtempSync(path.join(tmpdir(), "ward-organisation-"));
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "core.autocrlf=false", "-c", "core.hooksPath=", "-c", "commit.gpgsign=false", ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  const write = (name: string, contents: string) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), contents);
  };
  const r = registry();
  r.roots.push("docs/ward-flow/**", reference);
  r.rules.push({ ...r.rules[0], id: "fixture-docs", pattern: "docs/**" });
  write(registryPath, JSON.stringify(r));
  write(reference, "Synthetic task reference");
  write("ward/model.ts", "export const value = 1;");
  git("init", "--quiet");
  git("add", registryPath, reference, "ward/model.ts");
  git(
    "-c",
    "user.name=Offline fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  );
  const saveRegistry = () => write(registryPath, JSON.stringify(r));
  return { root, git, write, r, saveRegistry };
}

describe("C2: one source mode and honest snapshots", () => {
  // Split into two tests on 26 September 2026, with every assertion kept. Each check starts git
  // about a dozen times, and the single six-check test ran past its time limit under a loaded
  // suite (31 to 34 s measured) while passing alone in 5.5 s. The second test rebuilds the same
  // state with the same steps, minus the checks the first already made.
  function fixtureWithModelRules() {
    const f = fixture();
    f.r.rules.push({ ...f.r.rules[0], id: "model", pattern: "ward/old-model.ts", priority: 10 });
    f.r.rules.push({ ...f.r.rules[0], id: "future-location", pattern: "ward/future/**", priority: 10 });
    f.saveRegistry();
    f.git("add", registryPath);
    return f;
  }

  it("blocks missing exact rule targets in their own source mode while allowing empty wildcard locations", () => {
    const f = fixtureWithModelRules();
    const initial = checkOrganisation({ root: f.root, source: "working-tree" });
    expect(initial.exitCode).toBe(1);
    expect(initial.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-rule-target", severity: "blocking", label: "model" }),
      ]),
    );
    f.r.rules.find((rule) => rule.id === "model")!.pattern = "ward/model.ts";
    f.saveRegistry();
    expect(checkOrganisation({ root: f.root, source: "working-tree" }).exitCode).toBe(0);
    expect(checkOrganisation({ root: f.root, source: "index" }).exitCode).toBe(1);
  });

  it("does not fall back to the broader module rule when an exact target is removed", () => {
    const f = fixtureWithModelRules();
    f.r.rules.find((rule) => rule.id === "model")!.pattern = "ward/model.ts";
    f.saveRegistry();
    // Removing the exact target must not silently fall back to the broader module rule.
    fs.renameSync(path.join(f.root, "ward/model.ts"), path.join(f.root, "ward/renamed.ts"));
    expect(checkOrganisation({ root: f.root, source: "working-tree" }).exitCode).toBe(1);
    f.r.rules.find((rule) => rule.id === "model")!.pattern = "ward/renamed.ts";
    f.saveRegistry();
    expect(checkOrganisation({ root: f.root, source: "working-tree" }).exitCode).toBe(0);
  });

  it("keeps case-variant denied paths unread even with exact ownership and rejects them as references", () => {
    const f = fixture();
    f.r.denials.push("ward/sensitive/**");
    f.write("ward/Sensitive/example.json", "SYNTHETIC DENIED BYTES");
    f.r.exceptions.push({ ...f.r.exceptions[0], id: "case-exception", path: "ward/Sensitive/example.json" });
    f.r.canonicalSources.push({
      id: "case-reference",
      path: "ward/Sensitive/example.json",
      reference,
      reviewedBy: "fixture",
    });
    f.saveRegistry();
    const open = fs.openSync;
    const opened: string[] = [];
    const spy = vi.spyOn(fs, "openSync").mockImplementation((...args) => {
      opened.push(String(args[0]));
      return open(...args);
    });
    let report;
    try {
      report = checkOrganisation({ root: f.root, source: "working-tree" });
    } finally {
      spy.mockRestore();
    }
    expect(opened.some((p) => /sensitive/i.test(p))).toBe(false);
    expect(report.findings.some((f: { code: string }) => f.code === "unsafe-reference")).toBe(true);
    expect(JSON.stringify(report)).not.toContain("example.json");
  });

  it("ignores malformed compatible-looking prior rows instead of trusting or crashing on them", () => {
    const f = fixture();
    const first = checkOrganisation({ root: f.root, source: "working-tree" });
    for (const rows of [[null], [{ id: "bad", label: "untrusted" }]]) {
      const next = checkOrganisation({ root: f.root, source: "working-tree", previousSnapshot: { ...first, rows } });
      expect(next.exitCode).toBe(0);
      expect(next.baseline).toBe("incompatible-or-missing");
      expect(next.coverage.admitted).toBe(3);
    }
  });
  it("observes two edits to the same already-dirty file and catches additions and deletions", () => {
    const f = fixture();
    f.write("ward/model.ts", "export const value = 2;");
    const first = checkOrganisation({ root: f.root, source: "working-tree" });
    const status = f.git("status", "--porcelain");
    f.write("ward/model.ts", "export const value = 3;");
    expect(f.git("status", "--porcelain")).toBe(status);
    const second = checkOrganisation({ root: f.root, source: "working-tree", previousSnapshot: first });
    expect(second.snapshot.fingerprint).not.toBe(first.snapshot.fingerprint);
    expect(second.changes.changed).toContain("ward/model.ts");
    fs.renameSync(path.join(f.root, "ward/model.ts"), path.join(f.root, "ward/added.ts"));
    const third = checkOrganisation({ root: f.root, source: "working-tree", previousSnapshot: second });
    expect(third.changes.added).toContain("ward/added.ts");
    expect(third.changes.deleted).toContain("ward/model.ts");
  });

  it("uses registry bytes rather than schema version and ignores incompatible prior reports", () => {
    const f = fixture();
    const first = checkOrganisation({ root: f.root, source: "working-tree" });
    f.r.rules[0].module = "updated";
    f.saveRegistry();
    const second = checkOrganisation({ root: f.root, source: "working-tree", previousSnapshot: first });
    expect(second.snapshot.registryHash).not.toBe(first.snapshot.registryHash);
    expect(second.baseline).toBe("registry-or-tool-changed");
    const third = checkOrganisation({ root: f.root, source: "working-tree", previousSnapshot: { schemaVersion: 99 } });
    expect(third.baseline).toBe("incompatible-or-missing");
    expect(third.coverage.admitted).toBe(3);
  });

  it("never permits an unstaged registry exception or working-tree canonical target to legitimise index contents", () => {
    const f = fixture();
    f.write("shared/new.ts", "export const x = 1;");
    f.r.canonicalSources.push({ id: "target", path: "ward/target.md", reference, reviewedBy: "fixture" });
    f.saveRegistry();
    f.git("add", "shared/new.ts", registryPath);
    f.r.exceptions.push({ ...f.r.exceptions[0], id: "new", path: "shared/new.ts" });
    f.saveRegistry();
    f.write("ward/target.md", "Unstaged target");
    const working = checkOrganisation({ root: f.root, source: "working-tree" });
    const staged = checkOrganisation({ root: f.root, source: "index" });
    expect(working.exitCode).toBe(0);
    expect(staged.exitCode).toBe(1);
    expect(staged.findings.map((x: { code: string }) => x.code)).toEqual(
      expect.arrayContaining(["unclassified", "missing-reference"]),
    );
    expect(staged.snapshot.source).toBe("index");
  });

  it("requires an explicit reviewed rename mapping and never grandfathers a new unknown", () => {
    const f = fixture();
    f.write("shared/util.ts", "export const x = 1;");
    const initial = checkOrganisation({ root: f.root, source: "working-tree" });
    fs.renameSync(path.join(f.root, "shared/util.ts"), path.join(f.root, "shared/renamed.ts"));
    const first = checkOrganisation({ root: f.root, source: "working-tree", previousSnapshot: initial });
    const second = checkOrganisation({ root: f.root, source: "working-tree", previousSnapshot: first });
    expect(first.exitCode).toBe(1);
    expect(second.exitCode).toBe(1);
    f.r.renames.push({
      id: "reviewed-rename",
      from: "shared/util.ts",
      to: "shared/renamed.ts",
      exceptionId: "shared",
      reference,
      reviewedBy: "fixture",
    });
    f.saveRegistry();
    expect(checkOrganisation({ root: f.root, source: "working-tree" }).exitCode).toBe(0);
  });

  it("accepts only exact reviewed unresolved scope and reevaluates expiry", () => {
    const f = fixture();
    f.write("shared/new.ts", "Not admitted");
    f.r.unresolved.push({
      id: "debt",
      path: "shared/new.ts",
      reason: "Ownership pending",
      owner: "Ward Lead",
      reference,
      reviewedBy: "fixture",
      scope: { sourceClass: "source", contentHash: null, reasons: ["unclassified"] },
      expiresAt: "2026-09-23T00:00:00Z",
    });
    f.saveRegistry();
    const accepted = checkOrganisation({ root: f.root, source: "working-tree", now: "2026-09-22T00:00:00Z" });
    expect(accepted.exitCode).toBe(0);
    expect(accepted.coverage.unresolved).toBe(1);
    expect(accepted.findings[0]).toMatchObject({ severity: "review", code: "unclassified", reference });
    expect(checkOrganisation({ root: f.root, source: "working-tree", now: "2026-09-24T00:00:00Z" }).exitCode).toBe(1);
    f.r.unresolved[0].scope.sourceClass = null;
    f.saveRegistry();
    expect(checkOrganisation({ root: f.root, source: "working-tree", now: "2026-09-22T00:00:00Z" }).exitCode).toBe(1);
  });

  it("does not read or disclose sensitive names, unknown bytes or escaping junction contents", () => {
    const f = fixture();
    f.write("ward/private/person.secret.json", "SYNTHETIC SECRET MARKER");
    f.write("shared/new.ts", "UNKNOWN CONTENT MARKER");
    const outside = fs.mkdtempSync(path.join(tmpdir(), "ward-outside-"));
    fs.writeFileSync(path.join(outside, "escape.ts"), "ESCAPED CONTENT MARKER");
    fs.symlinkSync(outside, path.join(f.root, "ward/linked"), "junction");
    const open = fs.openSync;
    const opened: string[] = [];
    const spy = vi.spyOn(fs, "openSync").mockImplementation((...args) => {
      opened.push(String(args[0]));
      return open(...args);
    });
    let report;
    try {
      report = checkOrganisation({ root: f.root, source: "working-tree" });
    } finally {
      spy.mockRestore();
    }
    expect(opened.some((p) => /person|shared[\\/]new|linked|escape/.test(p))).toBe(false);
    const serialised = JSON.stringify(report);
    expect(serialised).not.toMatch(/person|SECRET MARKER|UNKNOWN CONTENT|ESCAPED CONTENT/);
    expect(
      report.rows
        .filter((row: { admission: string }) => row.admission === "restricted")
        .every((row: { contentHash: string | null }) => row.contentHash === null),
    ).toBe(true);
    expect(report.exitCode).toBe(2);
  });

  it("rejects admitted bytes changed during a read and unreadable admitted files", () => {
    const f = fixture();
    const read = fs.readFileSync;
    let changed = false;
    const spy = vi.spyOn(fs, "readFileSync").mockImplementation((...args) => {
      const result = read(...args);
      if (!changed && result.toString() === "export const value = 1;") {
        changed = true;
        f.write("ward/model.ts", "export const value = 9;");
      }
      return result;
    });
    try {
      expect(checkOrganisation({ root: f.root, source: "working-tree" }).exitCode).toBe(2);
    } finally {
      spy.mockRestore();
    }
    const open = fs.openSync;
    const denied = vi.spyOn(fs, "openSync").mockImplementation((...args) => {
      if (String(args[0]).endsWith("model.ts")) throw Object.assign(new Error("fixture"), { code: "EACCES" });
      return open(...args);
    });
    try {
      expect(checkOrganisation({ root: f.root, source: "working-tree" }).exitCode).toBe(2);
    } finally {
      denied.mockRestore();
    }
  });

  it("reports declared source changes and removed canonical references without semantic guesses", () => {
    const f = fixture();
    f.r.canonicalSources.push({
      id: "model-source",
      path: "ward/model.ts",
      expectedHash: "0".repeat(64),
      reference,
      reviewedBy: "fixture",
    });
    f.saveRegistry();
    const changed = checkOrganisation({ root: f.root, source: "working-tree" });
    expect(changed.findings.some((x: { code: string }) => x.code === "declared-source-changed")).toBe(true);
    fs.renameSync(path.join(f.root, "ward/model.ts"), path.join(f.root, "ward/replacement.ts"));
    const missing = checkOrganisation({ root: f.root, source: "working-tree" });
    expect(missing.findings.some((x: { code: string }) => x.code === "missing-reference")).toBe(true);
  });

  it("fails closed for unstable captures, empty discovery and unmerged index entries", () => {
    const f = fixture();
    const good = checkOrganisation({ root: f.root, source: "working-tree" });
    expect(buildReport({ ...good.snapshot, entries: [], complete: true }, f.r, null).exitCode).toBe(2);
    const blob = f.git("hash-object", "ward/model.ts");
    f.git("update-index", "--force-remove", "ward/model.ts");
    execFileSync("git", ["update-index", "--index-info"], {
      cwd: f.root,
      input: `100644 ${blob} 1\tward/model.ts\n100644 ${blob} 2\tward/model.ts\n`,
    });
    expect(checkOrganisation({ root: f.root, source: "index" }).exitCode).toBe(2);
  });
});

// Load limits, measured 26 September 2026: each CLI run starts node plus about 7 git processes, and a
// C3 test runs the CLI 3 to 6 times. The slowest C3 test takes 5.5 s alone; beside full-suite load
// the same tests ran 4 to 7 times slower (1.7-2.5 s to 10-12 s), tripping the old 20 s test limit and
// 15 s CLI kill while every assertion held. The limits now cover that measured slowdown; no
// assertion changed.
const CLI_KILL_MS = 45_000;
const C3_TIMEOUT_MS = 60_000;

const cli = path.resolve("scripts/ward-flow/organisation.mjs");
function selectedReport(directory: string) {
  const selected = readSelectedReport(directory);
  if (!selected) throw new Error("Expected a complete selected report");
  return selected;
}
function runCli(root: string, action = "--write-report", preload?: string) {
  return spawnSync(
    process.execPath,
    [
      ...(preload ? ["--import", pathToFileURL(preload).href] : []),
      cli,
      action,
      "--root",
      root,
      ...(action === "--show-report" ? [] : ["--source", "working-tree"]),
    ],
    { encoding: "utf8", timeout: CLI_KILL_MS },
  );
}

describe("C3: CLI checkpoints and coherent filesystem publication", () => {
  it("reports lock-release failure as incomplete while retaining the committed pair and lock", () => {
    const f = fixture();
    const preload = path.join(f.root, "release-fault.mjs");
    fs.writeFileSync(
      preload,
      `import fs from 'node:fs'; const unlink=fs.unlinkSync; fs.unlinkSync=function(p){ if(String(p).endsWith('publication.lock')) throw Object.assign(new Error('PRIVATE RAW PATH'),{code:'EPERM'}); return unlink.call(this,p); };`,
    );
    const result = runCli(f.root, "--write-report", preload);
    expect(result.status).toBe(2);
    const directory = reportDirectory(f.root);
    const selected = selectedReport(directory);
    expect(result.stdout).toContain(selected.pointer.generation);
    expect(result.stderr).not.toContain("PRIVATE RAW PATH");
    expect(fs.existsSync(path.join(directory, "publication.lock"))).toBe(true);
  });
  it("starts ensure only after a successful startup checkpoint and propagates its failure", () => {
    const f = fixture();
    f.write(
      "scripts/ensure-local-server.mjs",
      "import fs from 'node:fs'; fs.writeFileSync('ensure-started.txt','started'); process.exitCode=7;",
    );
    f.write("shared/new.ts", "unclassified");
    expect(runDevelopment(f.root)).toBe(1);
    expect(fs.existsSync(path.join(f.root, "ensure-started.txt"))).toBe(false);
    f.r.exceptions.push({ ...f.r.exceptions[0], id: "startup-source", path: "shared/new.ts" });
    f.saveRegistry();
    expect(runDevelopment(f.root)).toBe(7);
    expect(fs.readFileSync(path.join(f.root, "ensure-started.txt"), "utf8")).toBe("started");
  });
  // Split into three tests on 26 September 2026, with every assertion kept: the single test started
  // the CLI six times and ran past its 20 s limit under a loaded suite (21 to 28 s measured) while
  // passing alone in 5.4 s. Each later test first publishes the report the earlier steps made.
  function publishedFixture() {
    const f = fixture();
    const directory = reportDirectory(f.root);
    expect(runCli(f.root).status).toBe(0);
    return { f, directory, first: selectedReport(directory) };
  }

  it("checks without writes and publishes a matching pair", () => {
    const f = fixture();
    const directory = reportDirectory(f.root);
    expect(runCli(f.root, "--check").status).toBe(0);
    expect(fs.existsSync(directory)).toBe(false);
    expect(runCli(f.root).status).toBe(0);
    const first = selectedReport(directory);
    expect(first.report.generation).toBe(first.pointer.generation);
    expect(first.markdown).toContain(first.pointer.generation);
    expect(first.markdown).toContain(first.report.snapshot.fingerprint);
    expect(first.markdown).toContain("Last checked");
  }, C3_TIMEOUT_MS);

  it("publishes a new generation that catches an edit", () => {
    const { f, directory, first } = publishedFixture();
    f.write("ward/model.ts", "export const value = 2;");
    expect(runCli(f.root).status).toBe(0);
    const second = selectedReport(directory);
    expect(second.pointer.generation).not.toBe(first.pointer.generation);
    expect(second.report.changes.changed).toContain("ward/model.ts");
  }, C3_TIMEOUT_MS);

  it("does not accept unknowns by repetition", () => {
    const { f, directory } = publishedFixture();
    f.write("ward/model.ts", "export const value = 2;");
    expect(runCli(f.root).status).toBe(0);
    f.write("shared/new.ts", "Unknown source");
    expect(runCli(f.root).status).toBe(1);
    expect(runCli(f.root).status).toBe(1);
    expect(selectedReport(directory).report.exitCode).toBe(1);
  }, C3_TIMEOUT_MS);

  it("returns incomplete without replacing the selected report for unavailable registry or source", () => {
    const f = fixture();
    expect(runCli(f.root).status).toBe(0);
    const directory = reportDirectory(f.root);
    const first = selectedReport(directory).pointer;
    f.write(registryPath, JSON.stringify({ ...f.r, schemaVersion: 100 }));
    const bad = runCli(f.root);
    expect(bad.status).toBe(2);
    expect(selectedReport(directory).pointer).toEqual(first);
    expect(bad.stdout).toContain(first.generation);
    expect(fs.readFileSync(path.join(f.root, registryPath), "utf8")).toContain('"schemaVersion":100');
  });

  it.each(["after-json", "before-pointer", "after-pointer"])(
    "survives interruption %s on the actual filesystem and identifies what committed before retry",
    (fault) => {
      const f = fixture();
      expect(runCli(f.root).status).toBe(0);
      const directory = reportDirectory(f.root);
      const first = selectedReport(directory);
      const preload = path.join(f.root, "fault.mjs");
      fs.writeFileSync(
        preload,
        `import fs from 'node:fs';\nconst write=fs.writeFileSync; const rename=fs.renameSync;\nfs.writeFileSync=function(p,...rest){ const result=write.call(this,p,...rest); if (${JSON.stringify(fault)}==='after-json' && String(p).endsWith('report.json')) process.exit(91); return result; };\nfs.renameSync=function(a,b){ if(String(b).endsWith('current.json') && ${JSON.stringify(fault)}==='before-pointer') process.exit(92); const result=rename.call(this,a,b); if(String(b).endsWith('current.json') && ${JSON.stringify(fault)}==='after-pointer') process.exit(93); return result; };\n`,
      );
      f.write("ward/model.ts", "export const value = 7;");
      expect(runCli(f.root, "--write-report", preload).status).toBe(
        { "after-json": 91, "before-pointer": 92, "after-pointer": 93 }[fault],
      );
      const selected = selectedReport(directory);
      if (fault === "after-pointer") expect(selected.pointer.generation).not.toBe(first.pointer.generation);
      else expect(selected.pointer).toEqual(first.pointer);
      expect(selected.markdown).toContain(selected.report.generation);
      expect(selected.markdown).toContain(selected.report.snapshot.fingerprint);
      const retry = runCli(f.root);
      expect(retry.status).toBe(2);
      expect(retry.stdout).toContain(selected.pointer.generation);
      expect(selectedReport(directory).pointer).toEqual(selected.pointer);
    },
    C3_TIMEOUT_MS,
  );

  it("rejects a simultaneous writer without removing its lock or changing the selected generation", async () => {
    const f = fixture();
    expect(runCli(f.root).status).toBe(0);
    const directory = reportDirectory(f.root);
    const first = selectedReport(directory).pointer;
    const preload = path.join(f.root, "hold.mjs");
    fs.writeFileSync(
      preload,
      `import fs from 'node:fs'; const open=fs.openSync; fs.openSync=function(p,...rest){ const fd=open.call(this,p,...rest); if(String(p).endsWith('publication.lock')) { process.stdout.write('LOCKED\\n'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,12000); } return fd; };`,
    );
    const child = spawn(
      process.execPath,
      ["--import", pathToFileURL(preload).href, cli, "--write-report", "--root", f.root, "--source", "working-tree"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    try {
      await new Promise<void>((resolve, reject) => {
        let output = "";
        child.stdout.on("data", (data) => {
          output += data;
          if (output.includes("LOCKED")) resolve();
        });
        child.once("error", reject);
        child.once("exit", () => reject(new Error("holder exited before lock")));
      });
      const contender = runCli(f.root);
      expect(contender.status).toBe(2);
      expect(contender.stderr).toContain("publication-locked");
      expect(fs.existsSync(path.join(directory, "publication.lock"))).toBe(true);
      expect(selectedReport(directory).pointer).toEqual(first);
    } finally {
      child.kill();
    }
  }, C3_TIMEOUT_MS);
});
