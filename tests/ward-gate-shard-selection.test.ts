import { describe, expect, it, vi } from "vitest";
import { gateBatchArgs, gateBatchTransport } from "../scripts/check-ward-expected-reds.mjs";
import { fullGateInputIdentity } from "../scripts/test-evidence-identity.mjs";
import { afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { removePathSync } from "../scripts/retryable-fs.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readUnitShardSelection, writeUnitShardSelection } from "../scripts/ward-flow/unit-shard-selection.mjs";

const directories: string[] = [];
afterEach(() => {
  directories.splice(0).forEach((directory) => removePathSync(directory, { recursive: true }));
  vi.unstubAllEnvs();
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ward-shard-selection-"));
  directories.push(root);
  mkdirSync(join(root, "tests"));
  for (const file of ["a.test.ts", "b.dom.test.tsx", "live.live.test.ts"])
    writeFileSync(join(root, "tests", file), "// synthetic fixture");
  return root;
}

describe("exact unit shard manifest", () => {
  it("round-trips sorted exact offline files with a stable content identity", () => {
    const root = fixture();
    const first = writeUnitShardSelection(root, ["tests/b.dom.test.tsx", "tests/a.test.ts"], join(root, "state"));
    const second = writeUnitShardSelection(root, ["tests/a.test.ts", "tests/b.dom.test.tsx"], join(root, "state"));
    expect(second).toEqual(first);
    expect(readUnitShardSelection(root, first.file)).toEqual(["tests/a.test.ts", "tests/b.dom.test.tsx"]);
    expect(first.identity).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    [],
    ["tests/a.test.ts", "tests/a.test.ts"],
    ["tests/../a.test.ts"],
    ["/tests/a.test.ts"],
    ["tests\\a.test.ts"],
    ["tests/*.test.ts"],
    ["tests/missing.test.ts"],
    ["tests/live.live.test.ts"],
    // A file outside tests/ (built with join so the source-text ratchet does not read it as app source).
    [join("src", "a.test.ts")],
  ])("refuses an invalid or non-executable selection %j", (...files: string[]) => {
    const root = fixture();
    expect(() => writeUnitShardSelection(root, files, join(root, "state"))).toThrow();
  });

  it("refuses a corrupt or incompatible manifest rather than collecting the whole suite", () => {
    const root = fixture();
    const file = join(root, "bad.json");
    for (const body of ["{", '{"version":2,"files":["tests/a.test.ts"]}', '{"version":1,"files":[]}']) {
      writeFileSync(file, body);
      expect(() => readUnitShardSelection(root, file)).toThrow();
    }
    expect(() => readUnitShardSelection(root, join(root, "missing.json"))).toThrow();
    expect(() => readUnitShardSelection(root, "")).toThrow();
    expect(readUnitShardSelection(root, undefined)).toBeNull();
  });

  it("refuses changed contents under an existing manifest identity", () => {
    const root = fixture();
    const selection = writeUnitShardSelection(root, ["tests/a.test.ts"], join(root, "state"));
    const data = JSON.parse(readFileSync(selection.file, "utf8"));
    data.files = ["tests/b.dom.test.tsx"];
    writeFileSync(selection.file, JSON.stringify(data));
    expect(() => readUnitShardSelection(root, selection.file)).toThrow(/identity/);
  });
});

describe("hosted unit shard selection transport", () => {
  it("selects one exact manifest only for coverage-backed shards and binds its content identity", () => {
    const root = fixture();
    const options = {
      root,
      population: ["tests/a.test.ts", "tests/b.dom.test.tsx"],
      stateDir: join(root, "state"),
      coverageBlobDir: join(root, "blobs"),
      shard: { index: 1, count: 4 },
    };
    const transport = gateBatchTransport(options);
    expect(transport.singleBatch).toBe(true);
    expect(readUnitShardSelection(root, transport.selectionManifest)).toEqual(options.population);
    expect(transport.childEnvironment).toEqual({ WARD_UNIT_SHARD_SELECTION: transport.selectionManifest });
    const fingerprint = (identityArgs: string[]) =>
      fullGateInputIdentity({
        root,
        population: options.population,
        env: {},
        dependencyIdentity: "synthetic-immutable-dependencies",
        args: ["run", ...identityArgs],
      });
    const same = gateBatchTransport({ ...options, stateDir: join(root, "another-state-directory") });
    expect(same.selectionManifest).not.toBe(transport.selectionManifest);
    expect(fingerprint(same.identityArgs)).toBe(fingerprint(transport.identityArgs));
    expect(fingerprint([])).not.toBe(fingerprint(transport.identityArgs));
    const changed = gateBatchTransport({ ...options, population: ["tests/a.test.ts"] });
    expect(fingerprint(changed.identityArgs)).not.toBe(fingerprint(transport.identityArgs));
    for (const local of [
      gateBatchTransport({ ...options, coverageBlobDir: "" }),
      gateBatchTransport({ ...options, shard: null }),
    ]) {
      expect(local).toEqual({ singleBatch: false, selectionManifest: "", identityArgs: [], childEnvironment: {} });
    }
  });

  it("restricts both actual Vitest projects to their exact manifest intersections", async () => {
    const directory = fixture();
    const files = ["tests/ward-ci-scope.test.ts", "tests/ward-release-accessibility.dom.test.tsx"];
    const selection = writeUnitShardSelection(process.cwd(), files, join(directory, "state"));
    vi.stubEnv("WARD_UNIT_SHARD_SELECTION", selection.file);
    vi.resetModules();
    const { default: config } = await import("../vitest.config.mjs");
    expect(process.env.WARD_UNIT_SHARD_SELECTION).toBeUndefined();
    const projects = config.test.projects.map((project) => project.test);
    expect(projects.map((project) => [project.name, project.include])).toEqual([
      ["node", ["tests/ward-ci-scope.test.ts"]],
      ["jsdom", ["tests/ward-release-accessibility.dom.test.tsx"]],
    ]);
  });

  it("omits an empty project instead of falling back to its inherited population", async () => {
    const directory = fixture();
    const selection = writeUnitShardSelection(process.cwd(), ["tests/ward-ci-scope.test.ts"], join(directory, "state"));
    vi.stubEnv("WARD_UNIT_SHARD_SELECTION", selection.file);
    vi.resetModules();
    const { default: config } = await import("../vitest.config.mjs");
    expect(config.test.projects.map((project) => project.test.name)).toEqual(["node"]);
  });

  it("refuses provider-enabled collection with an offline shard manifest", async () => {
    const directory = fixture();
    const selection = writeUnitShardSelection(process.cwd(), ["tests/ward-ci-scope.test.ts"], join(directory, "state"));
    vi.stubEnv("WARD_UNIT_SHARD_SELECTION", selection.file);
    vi.stubEnv("ALLOW_PROVIDER_TESTS", "true");
    vi.resetModules();
    await expect(import("../vitest.config.mjs")).rejects.toThrow(/offline/);
  });

  it("does not put manifest-selected test paths on the command line", () => {
    const files = ["tests/ward-ci-scope.test.ts", "tests/ward-release-accessibility.dom.test.tsx"];
    const args = gateBatchArgs({
      files,
      batchReport: "/tmp/ward-report.json",
      coverageBlobDir: "/tmp/ward-blobs",
      shard: { index: 1, count: 4 },
      batchIndex: 0,
      selectionManifest: "/tmp/ward-selection.json",
    });
    expect(args).not.toContain(files[0]);
    expect(args).not.toContain(files[1]);
    expect(args).toContain("--coverage.enabled=true");
    expect(args).toContain("--outputFile.blob=/tmp/ward-blobs/blob-shard-1-of-4-batch-001.json");
  });

  it("retains file arguments for ordinary local batches", () => {
    expect(gateBatchArgs({ files: ["tests/ward-ci-scope.test.ts"], batchReport: "/tmp/report.json" })).toEqual([
      "run",
      "--pool=forks",
      "--reporter=json",
      "--outputFile=/tmp/report.json",
      "tests/ward-ci-scope.test.ts",
    ]);
  });
});
