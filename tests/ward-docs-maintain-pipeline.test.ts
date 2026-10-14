import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHECK_INDEX_STEPS,
  CHECK_INTEGRITY_GATE_STEPS,
  WRITE_GENERATOR_STEPS,
  checkOrUpdatePackManifest,
  classifyPath,
  loadRegistry,
  main,
  parseArgs,
  recommendCanonicalLocation,
} from "../scripts/ward-flow/maintain-docs-and-organisation.mjs";

describe("ward-docs-maintain-pipeline", () => {
  const registry = loadRegistry();

  describe("--classify on registered paths", () => {
    it("matches core Ward Flow engine, docs, scripts, tests, and host exceptions", () => {
      const engine = classifyPath("src/components/ward-management/ward-flow-reducer.ts", { registry });
      expect(engine.matched).toBe(true);
      expect(engine.id).toBe("ward-engine");
      expect(engine.group).toBe("engine");
      expect(engine.system).toBe("behaviour");
      expect(engine.kind).toBe("code");
      expect(engine.status).toBe("admitted");
      expect(engine.canonicalLocation).toBe("src/components/ward-management/ward-flow-reducer.ts");

      const doc = classifyPath("docs/ward-flow/README.md", { registry });
      expect(doc.matched).toBe(true);
      expect(doc.id).toBe("ward-docs");
      expect(doc.group).toBe("documentation");
      expect(doc.kind).toBe("documentation");
      expect(doc.status).toBe("admitted");

      const script = classifyPath("scripts/ward-flow/maintain-docs-and-organisation.mjs", { registry });
      expect(script.matched).toBe(true);
      expect(script.id).toBe("ward-tools");
      expect(script.group).toBe("tooling");
      expect(script.status).toBe("admitted");

      const testFile = classifyPath("tests/ward-docs-maintain-pipeline.test.ts", { registry });
      expect(testFile.matched).toBe(true);
      expect(testFile.id).toBe("ward-tests");
      expect(testFile.group).toBe("verification");
      expect(testFile.status).toBe("admitted");

      const pkg = classifyPath("package.json", { registry });
      expect(pkg.matched).toBe(true);
      expect(pkg.id).toBe("shared-boundary-1");
      expect(pkg.group).toBe("host-boundary");

      const v9Doc = classifyPath("design/v9/new-component-spec.md", { registry });
      expect(v9Doc.matched).toBe(true);
      expect(v9Doc.id).toBe("ward-design-v9");
      expect(v9Doc.group).toBe("design");

      const wfPart = classifyPath("src/components/wf/v10-badge.tsx", { registry });
      expect(wfPart.matched).toBe(true);
      expect(wfPart.id).toBe("ward-v9-primitives");
      expect(wfPart.group).toBe("design-system");
    });
  });

  describe("--classify recommendations on unregistered or proposed paths", () => {
    it("recommends canonical directories and registry rules across domains", () => {
      const v9Recommendation = recommendCanonicalLocation("design/v9/new-component-spec.md");
      expect(v9Recommendation.recommendedDirectory).toBe("design/v9/");
      expect(v9Recommendation.registryGuidance).toContain("ward-design-v9");

      const agentDoc = classifyPath("docs/agents/custom-shortcut.md", { registry });
      expect(agentDoc.matched).toBe(false);
      expect(agentDoc.recommendation?.recommendedDirectory).toBe("docs/agents/");

      const govDoc = recommendCanonicalLocation("unfiled-clinical-safety-note.md");
      expect(govDoc.recommendedDirectory).toBe("docs/ward-flow/governance/");
      expect(govDoc.suggestedPath).toBe("docs/ward-flow/governance/unfiled-clinical-safety-note.md");

      const refData = recommendCanonicalLocation("new-reference-data.json");
      expect(refData.recommendedDirectory).toBe("docs/ward-flow/reference-data/");

      const wfRecommendation = recommendCanonicalLocation("src/components/wf/v10-badge.tsx");
      expect(wfRecommendation.recommendedDirectory).toBe("src/components/wf/");

      const libFile = classifyPath("src/lib/ward-flow/session-cache.ts", { registry });
      expect(libFile.matched).toBe(false);
      expect(libFile.recommendation?.recommendedDirectory).toBe("src/lib/ward-flow/");

      const genericComponent = classifyPath("src/components/unplaced-card.tsx", { registry });
      expect(genericComponent.matched).toBe(false);
      expect(genericComponent.recommendation?.recommendedDirectory).toBe("src/components/ward-management/<domain>/");

      const unprefixedTest = classifyPath("tests/bed-allocation.test.ts", { registry });
      expect(unprefixedTest.matched).toBe(false);
      expect(unprefixedTest.recommendation?.recommendedDirectory).toBe("tests/");
      expect(unprefixedTest.recommendation?.suggestedPath).toBe("tests/ward-bed-allocation.test.ts");

      const unplacedScript = classifyPath("scripts/misc-helper.mjs", { registry });
      expect(unplacedScript.matched).toBe(false);
      expect(unplacedScript.recommendation?.recommendedDirectory).toBe("scripts/ward-flow/");
    });
  });

  describe("CLI flag parsing and pipeline step definitions", () => {
    it("requires a directory operand for --root and preserves following options", () => {
      for (const argv of [["--root"], ["--root", ""], ["--root", "--json"], ["--root", "--write"]]) {
        expect(() => parseArgs(argv)).toThrow("--root requires a directory");
      }
      expect(parseArgs(["--root", "docs", "--json"])).toMatchObject({
        root: path.resolve("docs"),
        json: true,
      });
    });

    it("parses --check, --write, --classify, and --json flags accurately", () => {
      expect(parseArgs([])).toMatchObject({ mode: "check", json: false });
      expect(parseArgs(["--check", "--json"])).toMatchObject({ mode: "check", json: true });
      expect(parseArgs(["--write"])).toMatchObject({ mode: "write", json: false });
      expect(
        parseArgs(["--classify", "docs/ward-flow/README.md", "design/v9/design-system-v9.md", "--json"]),
      ).toMatchObject({
        mode: "classify",
        json: true,
        classifyPaths: ["docs/ward-flow/README.md", "design/v9/design-system-v9.md"],
      });

      expect(() => parseArgs(["--classify"])).toThrow(/Usage: --classify/);
      expect(() => parseArgs(["--unknown-flag"])).toThrow(/Unknown or invalid argument/);
    });

    it("defines the complete generator and integrity gate lists", () => {
      expect(WRITE_GENERATOR_STEPS.map((s) => s.label)).toEqual([
        "owner-rulings-index",
        "screen-map",
        "mockup-manifest",
        "screen-verification",
        "rules-index",
        "organisation",
        "update-docs-inventory",
        "generate-site-map",
      ]);
      expect(CHECK_INDEX_STEPS.length).toBe(7);
      expect(CHECK_INTEGRITY_GATE_STEPS.length).toBe(7);
    });

    it("executes main(['--classify', ..., '--json']) with exit code 0", () => {
      const code = main(["--classify", "docs/ward-flow/README.md", "design/v9/design-system-v9.md", "--json"]);
      expect(code).toBe(0);
    });

    it("evaluates reference-data/pack_manifest.json in read-only mode without throwing", () => {
      const result = checkOrUpdatePackManifest({ write: false });
      expect(typeof result.ok).toBe("boolean");
      expect(result.updated).toBe(false);
      expect(Array.isArray(result.mismatches)).toBe(true);
    });
  });

  describe("manifest write outcomes", () => {
    it.each(["repairable", "missing", "mixed"])("reports unresolved files for a %s manifest", (scenario) => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "ward-manifest-"));
      try {
        const refDir = path.join(root, "docs/ward-flow/reference-data");
        fs.mkdirSync(refDir, { recursive: true });
        const raw = Buffer.from("synthetic fixture\n");
        const files: Record<string, { bytes: number; sha256: string }> = {};
        if (scenario !== "missing") {
          fs.writeFileSync(path.join(refDir, "present.txt"), raw);
          files["present.txt"] = { bytes: 0, sha256: "stale" };
        }
        if (scenario !== "repairable") {
          files["missing.txt"] = { bytes: 0, sha256: "stale" };
        }
        const manifestPath = path.join(refDir, "pack_manifest.json");
        fs.writeFileSync(manifestPath, JSON.stringify({ files }));

        const result = checkOrUpdatePackManifest({ root, write: true });
        expect(result.ok).toBe(scenario === "repairable");
        expect(result.updated).toBe(scenario !== "missing");
        expect(result.mismatches).toHaveLength(scenario === "mixed" ? 2 : 1);
        if (scenario !== "repairable") {
          expect(result.mismatches).toContainEqual({ file: "missing.txt", reason: "missing on disk" });
        }
        if (scenario !== "missing") {
          expect(JSON.parse(fs.readFileSync(manifestPath, "utf8")).files["present.txt"]).toEqual({
            bytes: raw.length,
            sha256: createHash("sha256").update(raw).digest("hex"),
          });
        }
        expect(checkOrUpdatePackManifest({ root }).ok).toBe(scenario === "repairable");
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  });
});
