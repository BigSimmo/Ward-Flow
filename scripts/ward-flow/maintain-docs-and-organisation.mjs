#!/usr/bin/env node
/**
 * Automated Ward Flow Documentation & File-Organisation Maintenance Pipeline.
 *
 * Modes:
 *   node scripts/ward-flow/maintain-docs-and-organisation.mjs --classify <path> [more-paths...] [--json]
 *   node scripts/ward-flow/maintain-docs-and-organisation.mjs --check [--json]
 *   node scripts/ward-flow/maintain-docs-and-organisation.mjs --write [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classifyEntry, contentDenied, digest, matches, safePath } from "./organisation-core.mjs";
import { checkOrganisation, REGISTRY_PATH } from "./organisation.mjs";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PACK_MANIFEST_REL = "docs/ward-flow/reference-data/pack_manifest.json";

export function toRepoRelativePosix(inputPath, root = DEFAULT_ROOT) {
  let cleaned = String(inputPath ?? "")
    .trim()
    .replace(/\\/g, "/");
  const rootPosix = root.replace(/\\/g, "/").replace(/\/+$/, "");
  if (cleaned.toLowerCase().startsWith(rootPosix.toLowerCase() + "/")) {
    cleaned = cleaned.slice(rootPosix.length + 1);
  }
  cleaned = cleaned.replace(/^\.\/+/, "").replace(/^\/+/, "");
  return cleaned;
}

export function loadRegistry(root = DEFAULT_ROOT) {
  const registryFile = path.join(root, REGISTRY_PATH);
  return JSON.parse(fs.readFileSync(registryFile, "utf8"));
}

/**
 * Recommends the canonical directory, naming convention, and registry.json entry
 * for a file path that does not currently match `docs/ward-flow/organisation/registry.json`.
 */
export function recommendCanonicalLocation(relPath) {
  const normalized = toRepoRelativePosix(relPath);
  const ext = path.posix.extname(normalized).toLowerCase();
  const base = path.posix.basename(normalized);
  const lower = normalized.toLowerCase();

  if (lower.startsWith("design/v9/") || (lower.includes("design") && lower.includes("v9"))) {
    return {
      recommendedDirectory: "design/v9/",
      namingConvention: "design/v9/<topic-or-spec>.md",
      suggestedPath: lower.startsWith("design/v9/") ? normalized : `design/v9/${base}`,
      rationale: "Active v9 design specifications and token contracts live under design/v9/.",
      registryGuidance:
        'If tracking design/v9/** in Ward organisation scope, add "design/v9/**" to `roots` and a rule `{ "id": "ward-design-v9", "pattern": "design/v9/**", "priority": 10, "owner": "ward-flow", "system": "documentation-knowledge", "module": "design", "reference": "docs/ward-flow-task-ledger.md" }` in `docs/ward-flow/organisation/registry.json`.',
    };
  }

  if (lower.startsWith("docs/agents/") || (lower.includes("agent") && (ext === ".md" || ext === ".txt"))) {
    return {
      recommendedDirectory: "docs/agents/",
      namingConvention: "docs/agents/<kebab-case-topic>.md",
      suggestedPath: lower.startsWith("docs/agents/") ? normalized : `docs/agents/${base}`,
      rationale: "Agent operating procedures, shortcuts, and cross-tool contracts live in docs/agents/.",
      registryGuidance:
        'To include docs/agents/** in Ward organisation checks, add "docs/agents/**" to `roots` and a rule `{ "id": "ward-agent-docs", "pattern": "docs/agents/**", "priority": 0, "owner": "shared", "system": "documentation-knowledge", "module": "documentation", "reference": "docs/ward-flow-task-ledger.md" }` in `docs/ward-flow/organisation/registry.json`.',
    };
  }

  if (
    lower.includes("governance") ||
    lower.includes("clinical-safety") ||
    lower.includes("charter") ||
    lower.includes("legal")
  ) {
    if (ext === ".md" || ext === ".txt" || ext === ".json") {
      return {
        recommendedDirectory: "docs/ward-flow/governance/",
        namingConvention: "docs/ward-flow/governance/<UPPER-KEBAB-TOPIC>.md",
        suggestedPath: lower.startsWith("docs/ward-flow/governance/")
          ? normalized
          : `docs/ward-flow/governance/${base}`,
        rationale:
          "Clinical safety case, cultural safety charter, and WA Health governance artefacts belong in docs/ward-flow/governance/ (covered by rule `ward-docs`).",
        registryGuidance:
          'Already covered by `roots` ("docs/ward-flow/**") and rule `ward-docs` once moved under `docs/ward-flow/governance/`.',
      };
    }
  }

  if (lower.includes("reference-data") || (ext === ".json" && lower.includes("reference"))) {
    return {
      recommendedDirectory: "docs/ward-flow/reference-data/",
      namingConvention: "docs/ward-flow/reference-data/<snake_case_or_kebab>.json",
      suggestedPath: lower.startsWith("docs/ward-flow/reference-data/")
        ? normalized
        : `docs/ward-flow/reference-data/${base}`,
      rationale:
        "WA Health reference data packs and provenance manifests belong in docs/ward-flow/reference-data/ (covered by rule `ward-docs`).",
      registryGuidance:
        'Already covered by `roots` ("docs/ward-flow/**") and rule `ward-docs` once placed in `docs/ward-flow/reference-data/`. Run `npm run docs:maintain` to refresh `pack_manifest.json`.',
    };
  }

  if (ext === ".md" || ext === ".txt") {
    return {
      recommendedDirectory: "docs/ward-flow/",
      namingConvention: "docs/ward-flow/<TOPIC>.md (or docs/ward-<topic>.md)",
      suggestedPath: lower.startsWith("docs/ward-flow/") ? normalized : `docs/ward-flow/${base}`,
      rationale: "Ward Flow product, architecture, and workflow documentation belongs under docs/ward-flow/.",
      registryGuidance:
        "Files under `docs/ward-flow/**` or matching `docs/ward-*.md` are automatically matched by rules `ward-docs` / `ward-doc-siblings` in `docs/ward-flow/organisation/registry.json`.",
    };
  }

  if (
    lower.includes(".test.") ||
    lower.includes(".spec.") ||
    lower.startsWith("tests/") ||
    lower.startsWith("__tests__/")
  ) {
    const cleanBase = base.replace(/^ward-/, "");
    const isUi = lower.includes("playwright") || lower.includes("e2e") || lower.includes("ui-");
    const prefix = isUi ? "ui-ward-" : "ward-";
    const targetName = base.startsWith("ward-") || base.startsWith("ui-ward-") ? base : `${prefix}${cleanBase}`;
    return {
      recommendedDirectory: "tests/",
      namingConvention: isUi ? "tests/ui-ward-<feature>.spec.ts" : "tests/ward-<feature>.test.ts",
      suggestedPath: `tests/${targetName}`,
      rationale:
        "Ward Flow unit/integration tests use `tests/ward-*.test.ts(x)` and UI tests use `tests/ui-ward-*` so they match `registry.json` rules `ward-tests` and `ward-ui-tests`.",
      registryGuidance:
        "Rename the file to `tests/ward-*.test.ts` (or `tests/ui-ward-*` / `tests/helpers/ward-*`) so it is automatically admitted by `ward-tests` in `docs/ward-flow/organisation/registry.json`.",
    };
  }

  if (ext === ".mjs" || ext === ".cjs" || ext === ".sh" || lower.startsWith("scripts/")) {
    return {
      recommendedDirectory: "scripts/ward-flow/",
      namingConvention: "scripts/ward-flow/<kebab-case-tool>.mjs",
      suggestedPath: lower.startsWith("scripts/ward-flow/") ? normalized : `scripts/ward-flow/${base}`,
      rationale:
        "Ward Flow maintenance, verification, and generation scripts live in `scripts/ward-flow/` (matched by rule `ward-tools`).",
      registryGuidance:
        "Place the script under `scripts/ward-flow/**` or name it `scripts/*ward*.mjs` to match `ward-tools` / `ward-tool-siblings` in `docs/ward-flow/organisation/registry.json`.",
    };
  }

  if (lower.startsWith("src/components/wf/") || lower.includes("v10-parts") || lower.includes("v9")) {
    return {
      recommendedDirectory: "src/components/wf/",
      namingConvention: "src/components/wf/<component-name>.tsx",
      suggestedPath: lower.startsWith("src/components/wf/") ? normalized : `src/components/wf/${base}`,
      rationale:
        "Shared v9/v10 design-system primitives (Sections 8–14 of design-system-v9.md) live in `src/components/wf/`.",
      registryGuidance:
        'If adding `src/components/wf/**` to Ward organisation scope, add `"src/components/wf/**"` to `roots` and a rule `{ "id": "ward-v9-primitives", "pattern": "src/components/wf/**", "priority": 5, "owner": "ward-flow", "system": "behaviour", "module": "design-system", "reference": "docs/ward-flow-task-ledger.md" }` in `docs/ward-flow/organisation/registry.json`.',
    };
  }

  if (lower.startsWith("src/lib/ward-flow/") || (lower.startsWith("src/lib/") && lower.includes("ward"))) {
    return {
      recommendedDirectory: "src/lib/ward-flow/",
      namingConvention: "src/lib/ward-flow/<module-name>.ts",
      suggestedPath: lower.startsWith("src/lib/ward-flow/") ? normalized : `src/lib/ward-flow/${base}`,
      rationale:
        "Ward Flow client/shared library utilities live under `src/lib/ward-flow/` or `src/components/ward-management/`.",
      registryGuidance:
        'Either place domain logic in `src/components/ward-management/<domain>/` (already covered by `ward-modules`) or add `"src/lib/ward-flow/**"` to `roots` and `rules` in `docs/ward-flow/organisation/registry.json`.',
    };
  }

  if (ext === ".tsx" || ext === ".ts" || ext === ".css") {
    return {
      recommendedDirectory: "src/components/ward-management/<domain>/",
      namingConvention: "src/components/ward-management/<domain>/<kebab-name>.tsx",
      suggestedPath: `src/components/ward-management/${base}`,
      rationale:
        "Ward Flow screens, domain components, reducers, and CSS modules live under `src/components/ward-management/<domain>/` (or routes under `src/app/mockups/ward-flow/<route>/page.tsx`).",
      registryGuidance:
        "Files under `src/components/ward-management/**` and `src/app/mockups/ward-flow/**` are automatically admitted by rules `ward-modules` and `ward-routes` in `docs/ward-flow/organisation/registry.json`.",
    };
  }

  return {
    recommendedDirectory: "docs/ward-flow/",
    namingConvention: "docs/ward-flow/<kebab-name>.<ext>",
    suggestedPath: `docs/ward-flow/${base}`,
    rationale:
      "Unrecognised path or extension; place Ward Flow artefacts under an existing registered root (`docs/ward-flow/**`, `src/components/ward-management/**`, `scripts/ward-flow/**`, `tests/ward-*`).",
    registryGuidance:
      "Ensure the file's extension is listed in `sourceClasses` (.ts, .tsx, .js, .mjs, .mts, .css, .py, .sh, .html, .md, .txt, .json, .yaml, .yml) and its path matches `roots` and `rules` in `docs/ward-flow/organisation/registry.json`.",
  };
}

/**
 * Evaluates a single path (existing or proposed) against `docs/ward-flow/organisation/registry.json`.
 */
export function classifyPath(inputPath, { root = DEFAULT_ROOT, registry = null } = {}) {
  const loadedRegistry = registry ?? loadRegistry(root);
  const relPath = toRepoRelativePosix(inputPath, root);
  const fullPath = path.join(root, relPath);
  const exists = fs.existsSync(fullPath);

  const syntheticEntry = {
    path: relPath,
    kind: "file",
    contained: safePath(relPath),
  };

  const classification = classifyEntry(syntheticEntry, loadedRegistry);
  const inRoots = loadedRegistry.roots.some((pattern) => matches(relPath, pattern));
  const denied = contentDenied(relPath, loadedRegistry);

  const exactException = loadedRegistry.exceptions.find((e) => e.path === relPath) ?? null;
  const matchingRules = loadedRegistry.rules
    .filter((r) => matches(relPath, r.pattern))
    .sort((a, b) => b.priority - a.priority);
  const activeRule = exactException ?? matchingRules[0] ?? null;

  const matched =
    inRoots &&
    !denied &&
    activeRule !== null &&
    (classification.admission === "admitted" ||
      (classification.admission === "excluded" && ["excluded", "design-reference"].includes(classification.owner)));

  const canonicalLocation = exactException ? exactException.path : matchingRules[0] ? matchingRules[0].pattern : null;

  const recommendation = matched ? null : recommendCanonicalLocation(relPath);

  return {
    path: relPath,
    existsOnDisk: exists,
    matched,
    id: classification.source,
    group: classification.module,
    system: classification.system,
    owner: classification.owner,
    kind: classification.sourceClass,
    status: classification.admission,
    reasons: classification.reasons,
    canonicalLocation,
    canonicalLinks: classification.canonicalLinks,
    recommendation,
  };
}

/**
 * Verifies or updates `docs/ward-flow/reference-data/pack_manifest.json` against disk.
 * Note: The self-referential `"pack_manifest.json"` entry inside `files` is skipped during
 * hash comparison because a JSON file cannot contain its own post-serialisation SHA-256.
 */
export function checkOrUpdatePackManifest({ root = DEFAULT_ROOT, write = false } = {}) {
  const manifestPath = path.join(root, PACK_MANIFEST_REL);
  if (!fs.existsSync(manifestPath)) {
    return {
      ok: false,
      updated: false,
      mismatches: [{ file: PACK_MANIFEST_REL, reason: "pack_manifest.json missing on disk" }],
    };
  }
  const refDir = path.dirname(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const filesObj = manifest.files ?? {};
  const mismatches = [];
  let changed = false;

  for (const [fileName, expected] of Object.entries(filesObj)) {
    if (fileName === "pack_manifest.json") continue;
    const targetPath = path.join(refDir, fileName);
    if (!fs.existsSync(targetPath)) {
      mismatches.push({ file: fileName, reason: "missing on disk" });
      continue;
    }
    const raw = fs.readFileSync(targetPath);
    const actualBytes = raw.length;
    const actualSha256 = digest(raw);
    if (expected.bytes !== actualBytes || expected.sha256 !== actualSha256) {
      mismatches.push({
        file: fileName,
        expectedBytes: expected.bytes,
        actualBytes,
        expectedSha256: expected.sha256,
        actualSha256,
      });
      if (write) {
        filesObj[fileName] = {
          bytes: actualBytes,
          sha256: actualSha256,
        };
        changed = true;
      }
    }
  }

  if (write && changed) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    return { ok: true, updated: true, mismatches };
  }

  return {
    ok: mismatches.length === 0,
    updated: false,
    mismatches,
  };
}

function runNodeCommand(root, label, args) {
  const res = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  return {
    label,
    command: `node ${args.join(" ")}`,
    exitCode: res.status ?? 1,
    ok: res.status === 0,
    stdout: (res.stdout ?? "").trim(),
    stderr: (res.stderr ?? "").trim(),
  };
}

export const WRITE_GENERATOR_STEPS = [
  { label: "owner-rulings-index", args: ["scripts/ward-flow/owner-rulings-index.mjs"] },
  { label: "screen-map", args: ["scripts/ward-flow/screen-map.mjs", "--write"] },
  { label: "screen-verification", args: ["scripts/ward-flow/screen-verification.mjs", "--write"] },
  { label: "rules-index", args: ["scripts/ward-flow/rules-index.mjs", "--write"] },
  {
    label: "organisation",
    args: ["scripts/ward-flow/organisation.mjs", "--write-report", "--source", "working-tree"],
  },
  { label: "update-docs-inventory", args: ["scripts/update-docs-inventory.mjs"] },
  { label: "generate-site-map", args: ["scripts/run-tsx.mjs", "scripts/generate-site-map.ts"] },
];

export const CHECK_INDEX_STEPS = [
  { label: "owner-rulings-index --check", args: ["scripts/ward-flow/owner-rulings-index.mjs", "--check"] },
  { label: "screen-map --check", args: ["scripts/ward-flow/screen-map.mjs", "--check"] },
  { label: "screen-verification --check", args: ["scripts/ward-flow/screen-verification.mjs", "--check"] },
  { label: "rules-index --check", args: ["scripts/ward-flow/rules-index.mjs", "--check"] },
  { label: "update-docs-inventory --check", args: ["scripts/update-docs-inventory.mjs", "--check"] },
  { label: "generate-site-map --check", args: ["scripts/run-tsx.mjs", "scripts/generate-site-map.ts", "--check"] },
];

export const CHECK_INTEGRITY_GATE_STEPS = [
  { label: "check-docs-script-refs", args: ["scripts/check-docs-script-refs.mjs"] },
  { label: "check-maintained-doc-links", args: ["scripts/check-maintained-doc-links.mjs"] },
  { label: "check-codebase-index-coverage", args: ["scripts/check-codebase-index-coverage.mjs"] },
  { label: "check-ward-doc-links", args: ["scripts/ward-flow/check-doc-links.mjs"] },
  { label: "check-stale-docs", args: ["scripts/check-stale-docs.mjs"] },
  { label: "check-ward-legal-language", args: ["scripts/ward-flow/check-ward-legal-language.mjs"] },
  { label: "check-ward-reference", args: ["scripts/ward-flow/check-ward-reference.mjs"] },
];

export function runCheckMode({ root = DEFAULT_ROOT } = {}) {
  const packManifest = checkOrUpdatePackManifest({ root, write: false });

  const orgExec = runNodeCommand(root, "organisation --check", [
    "scripts/ward-flow/organisation.mjs",
    "--check",
    "--source",
    "working-tree",
    "--root",
    root,
  ]);
  let unclassifiedRecommendations = [];
  if (!orgExec.ok) {
    try {
      const report = checkOrganisation({ root, source: "working-tree" });
      const registry = loadRegistry(root);
      const problematic = report.rows.filter(
        (r) =>
          r.path &&
          (r.reasons.includes("unclassified") ||
            r.reasons.includes("unknown-source-class") ||
            r.reasons.includes("conflicting-rules")),
      );
      unclassifiedRecommendations = problematic.map((r) => classifyPath(r.path, { root, registry }));
    } catch {
      // Fallback if checkOrganisation throws on non-root worktree
    }
  }

  const indexChecks = CHECK_INDEX_STEPS.map((step) => runNodeCommand(root, step.label, step.args));
  const integrityGates = CHECK_INTEGRITY_GATE_STEPS.map((step) => runNodeCommand(root, step.label, step.args));

  const allOk = packManifest.ok && orgExec.ok && indexChecks.every((s) => s.ok) && integrityGates.every((s) => s.ok);

  return {
    mode: "check",
    ok: allOk,
    packManifest,
    organisation: {
      ...orgExec,
      unclassifiedRecommendations,
    },
    indexChecks,
    integrityGates,
  };
}

export function runWriteMode({ root = DEFAULT_ROOT } = {}) {
  const packManifestUpdate = checkOrUpdatePackManifest({ root, write: true });
  const generatorRuns = WRITE_GENERATOR_STEPS.map((step) =>
    runNodeCommand(
      root,
      step.label,
      step.label === "organisation"
        ? [...step.args, "--root", root]
        : step.args,
    ),
  );
  const verification = runCheckMode({ root });

  const allOk = packManifestUpdate.ok && generatorRuns.every((g) => g.ok) && verification.ok;
  return {
    mode: "write",
    ok: allOk,
    packManifestUpdate,
    generatorRuns,
    verification,
  };
}

export function parseArgs(argv = process.argv.slice(2)) {
  let mode = "check";
  let explicitMode = false;
  let json = false;
  let root = DEFAULT_ROOT;
  const classifyPaths = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--check" || arg === "--write") {
      const requestedMode = arg.slice(2);
      if (explicitMode && mode !== requestedMode) {
        throw new Error(
          `Conflicting mode flags: --${mode} and --${requestedMode}. Usage: --check | --write | --classify <path...> [--json] [--root <dir>]`,
        );
      }
      mode = requestedMode;
      explicitMode = true;
    } else if (arg === "--root" && argv[i + 1]) {
      root = path.resolve(argv[++i]);
    } else if (arg === "--classify") {
      if (explicitMode && mode !== "classify") {
        throw new Error(
          `Conflicting mode flags: --${mode} and --classify. Usage: --check | --write | --classify <path...> [--json] [--root <dir>]`,
        );
      }
      mode = "classify";
      explicitMode = true;
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        classifyPaths.push(argv[++i]);
      }
    } else if (mode === "classify" && !arg.startsWith("--")) {
      classifyPaths.push(arg);
    } else {
      throw new Error(
        `Unknown or invalid argument: ${arg}. Usage: --check | --write | --classify <path...> [--json] [--root <dir>]`,
      );
    }
  }

  if (mode === "classify" && classifyPaths.length === 0) {
    throw new Error("Usage: --classify <path> [more-paths...] [--json]");
  }

  return { mode, json, root, classifyPaths };
}

function formatClassifyHuman(results) {
  const lines = [];
  for (const r of results) {
    if (r.matched) {
      lines.push(
        `✅ MATCHED: ${r.path}\n` +
          `   • Rule/Record ID : ${r.id}\n` +
          `   • Group (Module) : ${r.group ?? "none"} (system: ${r.system ?? "none"}, owner: ${r.owner})\n` +
          `   • Kind (Class)   : ${r.kind ?? "metadata-only"}\n` +
          `   • Status         : ${r.status}\n` +
          `   • Canonical Loc  : ${r.canonicalLocation}\n` +
          `   • Reference      : ${r.canonicalLinks.join(", ") || "none"}`,
      );
    } else {
      const rec = r.recommendation;
      lines.push(
        `⚠️ UNCLASSIFIED / OUTSIDE REGISTERED ROOTS: ${r.path}\n` +
          `   • Current Status : ${r.status} (reasons: ${r.reasons.join(", ") || "none"})\n` +
          `   • Recommended Dir: ${rec.recommendedDirectory}\n` +
          `   • Naming Pattern : ${rec.namingConvention}\n` +
          `   • Suggested Path : ${rec.suggestedPath}\n` +
          `   • Rationale      : ${rec.rationale}\n` +
          `   • Registry Rule  : ${rec.registryGuidance}`,
      );
    }
  }
  return lines.join("\n\n");
}

function formatCheckHuman(report) {
  const lines = ["=== Ward Flow Documentation & Organisation Check ==="];
  lines.push(
    `${report.packManifest.ok ? "✅" : "🔴"} Reference pack manifest (${PACK_MANIFEST_REL}): ${
      report.packManifest.ok
        ? "all file sizes & SHA-256 hashes match"
        : `${report.packManifest.mismatches.length} mismatch(es)`
    }`,
  );
  for (const m of report.packManifest.mismatches) {
    lines.push(
      `   - ${m.file}: ${m.reason ?? `expected ${m.expectedBytes}B/${m.expectedSha256?.slice(0, 12)}, got ${m.actualBytes}B/${m.actualSha256?.slice(0, 12)}`}`,
    );
  }

  lines.push(
    `${report.organisation.ok ? "✅" : "🔴"} File organisation (${REGISTRY_PATH}): exit ${report.organisation.exitCode}`,
  );
  if (report.organisation.unclassifiedRecommendations?.length) {
    lines.push("   Unclassified files detected — recommended placements:");
    lines.push(formatClassifyHuman(report.organisation.unclassifiedRecommendations));
  } else if (!report.organisation.ok && report.organisation.stdout) {
    lines.push(`   ${report.organisation.stdout.split("\n").join("\n   ")}`);
  }

  lines.push("\n--- Generated Indexes ---");
  for (const step of report.indexChecks) {
    lines.push(`${step.ok ? "✅" : "🔴"} ${step.label}`);
    if (!step.ok) {
      const msg = step.stderr || step.stdout;
      if (msg) lines.push(`   ${msg.split("\n").join("\n   ")}`);
    }
  }

  lines.push("\n--- Documentation Integrity Gates ---");
  for (const step of report.integrityGates) {
    lines.push(`${step.ok ? "✅" : "🔴"} ${step.label}`);
    if (!step.ok) {
      const msg = step.stderr || step.stdout;
      if (msg) lines.push(`   ${msg.split("\n").join("\n   ")}`);
    }
  }

  lines.push(
    `\nOverall Result: ${report.ok ? "✅ PASS (all documentation indexes, links, and organisation gates are green)" : "🔴 FAIL (run `npm run docs:maintain` or see errors above)"}`,
  );
  return lines.join("\n");
}

export function main(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    return 2;
  }

  const { mode, json, root, classifyPaths } = parsed;

  if (mode === "classify") {
    const registry = loadRegistry(root);
    const results = classifyPaths.map((p) => classifyPath(p, { root, registry }));
    if (json) {
      console.log(JSON.stringify({ mode: "classify", results }, null, 2));
    } else {
      console.log(formatClassifyHuman(results));
    }
    return 0;
  }

  if (mode === "write") {
    const result = runWriteMode({ root });
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("=== Ward Flow Documentation & Organisation Write Mode ===");
      console.log(
        `Pack manifest (${PACK_MANIFEST_REL}): ${result.packManifestUpdate.updated ? "updated changed entries" : "already up to date"}`,
      );
      for (const g of result.generatorRuns) {
        console.log(`${g.ok ? "✅" : "🔴"} Generator ${g.label} (exit ${g.exitCode})`);
      }
      console.log("");
      console.log(formatCheckHuman(result.verification));
    }
    return result.ok ? 0 : 1;
  }

  const checkResult = runCheckMode({ root });
  if (json) {
    console.log(JSON.stringify(checkResult, null, 2));
  } else {
    console.log(formatCheckHuman(checkResult));
  }
  return checkResult.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
