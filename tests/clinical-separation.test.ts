import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { blankCssComments, stripAllComments } from "./helpers/strip-source-comments";

/**
 * Hard clinical-isolation boundary guard for Ward Flow.
 *
 * Ward Flow operates strictly on synthetic data in a dedicated repository and
 * synthetic Supabase project (`zakzoemeedfepxcstsou`). It must never reference
 * PsychSift's Supabase project (`sjrfecxgysukkwxsowpy`), PsychSift production or
 * Railway URLs, PsychSift/Database repository identifiers, or live
 * `health.wa.gov.au` clinical endpoints.
 */

export interface ClinicalSeparationViolation {
  file: string;
  line: number;
  rule: string;
  snippet: string;
}

const CLINICAL_ISOLATION_MESSAGE =
  "Hard clinical-isolation boundary violated: Ward Flow must remain 100% synthetic and strictly isolated from PsychSift (Supabase/Railway/repos) and live health.wa.gov.au clinical endpoints.";

const SELF_RELATIVE_PATH = "tests/clinical-separation.test.ts";

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  ".next-playwright",
  "dist",
  "coverage",
  ".git",
  "tmp",
  ".cache",
]);

const SCANNED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".py",
  ".sh",
  ".ps1",
  ".sql",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
]);

const ROOT_CONFIG_PATTERN =
  /^(?:package\.json|next\.config\.[^/]+|\.env(?:\.[^/]+)?|tsconfig(?:\.[^/]+)?\.json|vitest\.config\.[^/]+|playwright\.config\.[^/]+|eslint\.config\.[^/]+|postcss\.config\.[^/]+|knip\.json|script-budget\.json)$/u;

const ALLOWED_LEGACY_LOCK_CHECK_LINE =
  /if\s*\(\s*manifest\.name\s*===\s*["']prompt-for-codex-medical-knowledge-base["']\s*\)/u;

const ALLOWED_SCRIPT_PSYCHSIFT_LINES = new Map<string, RegExp>([
  ["scripts/check-stale-docs.mjs", /"docs\/history\/archive\/psychsift-era-records\/"/u],
  [
    "scripts/export-task-receipt.py",
    /\{\s*'Ward Flow'\s*,\s*'PsychSift'\s*,\s*'Caring Contacts'\s*,\s*'Communication'\s*\}/u,
  ],
  ["scripts/ward-flow/organisation-core.mjs", /"PsychSift content outside registered shared boundaries"/u],
]);

const ALLOWED_HEALTH_WA_PATTERNS = new Map<string, RegExp>([
  ["src/components/ward-management/front-door/front-door-parts.tsx", /placeholder="name@health\.wa\.gov\.au"/u],
  [
    "src/components/ward-management/ward-service-colors.ts",
    /sourceStylesheet:\s*"https:\/\/(?:emhs|nmhs|smhs|wacountry|cahs|www)\.health\.wa\.gov\.au\/~\/media\/DOHWA\/css\/(?:EMHS|NMHS|SMHS|WACHS|CAHS|DOH)\.css"/u,
  ],
]);

const PSYCHSIFT_SUPABASE_REF_PATTERN = /sjrfecxgysukkwxsowpy/i;
const PSYCHSIFT_PROD_URL_PATTERN =
  /(?:https?:\/\/[^\s"'`<>]*psychsift[^\s"'`<>]*|psychiatry\.tools|https?:\/\/(?!(?:ward-flow|wardflow)(?:-[a-z0-9-]+)?\.(?:up\.)?railway\.app\b)[a-z0-9.-]+\.(?:up\.)?railway\.app\b)/i;
const PSYCHSIFT_REMOTE_REPO_PATTERN = /BigSimmo\/(?:PsychSift|Database)\b/i;
const LEGACY_REPO_PACKAGE_NAME_PATTERN = /prompt-for-codex-medical-knowledge-base/i;
const PSYCHSIFT_IDENTIFIER_PATTERN = /\bpsychsift\b/i;
const HEALTH_WA_ENDPOINT_PATTERN = /health\.wa\.gov\.au/i;

function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function isEnvFile(fileName: string): boolean {
  return fileName === ".env" || fileName.startsWith(".env.") || fileName.endsWith(".env");
}

function shouldScanFile(relativePath: string): boolean {
  if (relativePath === SELF_RELATIVE_PATH) return false;
  const baseName = path.posix.basename(relativePath);
  if (baseName === "package-lock.json") return false;
  if (isEnvFile(baseName)) return true;
  return SCANNED_EXTENSIONS.has(path.posix.extname(baseName).toLowerCase());
}

function stripHashComments(source: string): string {
  return source
    .split("\n")
    .map((line) => (/^\s*#/u.test(line) ? "" : line))
    .join("\n");
}

function stripSqlComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (block) => block.replace(/[^\n]/gu, " "))
    .split("\n")
    .map((line) => (/^\s*--/u.test(line) ? "" : line))
    .join("\n");
}

function stripCommentsForAnalysis(relativePath: string, content: string): string {
  const ext = path.posix.extname(relativePath).toLowerCase();
  const baseName = path.posix.basename(relativePath);
  if (
    [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"].includes(ext) ||
    /^tsconfig(?:\.[^/]+)?\.json$/u.test(baseName)
  ) {
    return stripAllComments(content);
  }
  if (ext === ".css") {
    return blankCssComments(content);
  }
  if (isEnvFile(baseName) || [".py", ".sh", ".ps1", ".yml", ".yaml", ".toml"].includes(ext)) {
    return stripHashComments(content);
  }
  if (ext === ".sql") {
    return stripSqlComments(content);
  }
  return content;
}

function collectDirectoryFiles(rootDir: string, relativeDir: string): string[] {
  const fullDir = path.join(rootDir, relativeDir);
  if (!existsSync(fullDir)) return [];
  const collected: string[] = [];

  const walk = (currentDir: string) => {
    for (const entry of readdirSync(currentDir)) {
      const fullPath = path.join(currentDir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry)) continue;
        walk(fullPath);
        continue;
      }
      if (!stat.isFile()) continue;
      const relativePath = toPosix(path.relative(rootDir, fullPath));
      if (shouldScanFile(relativePath)) {
        collected.push(relativePath);
      }
    }
  };

  walk(fullDir);
  return collected;
}

export function collectClinicalSeparationTargetFiles(rootDir: string): string[] {
  const targets = new Set<string>();
  for (const dir of ["src", "backend", "scripts"]) {
    for (const file of collectDirectoryFiles(rootDir, dir)) {
      targets.add(file);
    }
  }
  for (const entry of readdirSync(rootDir)) {
    if (!ROOT_CONFIG_PATTERN.test(entry)) continue;
    const fullPath = path.join(rootDir, entry);
    if (!statSync(fullPath).isFile()) continue;
    const relativePath = toPosix(path.relative(rootDir, fullPath));
    if (relativePath !== SELF_RELATIVE_PATH) {
      targets.add(relativePath);
    }
  }
  return [...targets].sort();
}

export function findClinicalSeparationViolations(relativePath: string, content: string): ClinicalSeparationViolation[] {
  const normalizedPath = toPosix(relativePath);
  if (normalizedPath === SELF_RELATIVE_PATH) return [];

  const violations: ClinicalSeparationViolation[] = [];
  const rawLines = content.split(/\r?\n/u);
  const codeLines = stripCommentsForAnalysis(normalizedPath, content).split(/\r?\n/u);

  const record = (lineIndex: number, rule: string, lineText: string) => {
    violations.push({
      file: normalizedPath,
      line: lineIndex + 1,
      rule,
      snippet: lineText.trim().slice(0, 140),
    });
  };

  for (let i = 0; i < rawLines.length; i += 1) {
    const rawLine = rawLines[i] ?? "";
    if (PSYCHSIFT_SUPABASE_REF_PATTERN.test(rawLine)) {
      record(i, "PsychSift Supabase project ref (sjrfecxgysukkwxsowpy)", rawLine);
    }
    if (PSYCHSIFT_PROD_URL_PATTERN.test(rawLine)) {
      record(i, "Non-Ward-Flow Railway or PsychSift production URL", rawLine);
    }
    if (PSYCHSIFT_REMOTE_REPO_PATTERN.test(rawLine)) {
      record(i, "PsychSift/Database repository reference", rawLine);
    }
  }

  for (let i = 0; i < codeLines.length; i += 1) {
    const codeLine = codeLines[i] ?? "";
    if (!codeLine) continue;

    if (LEGACY_REPO_PACKAGE_NAME_PATTERN.test(codeLine)) {
      const allowed = normalizedPath === "scripts/test-run-lock.mjs" && ALLOWED_LEGACY_LOCK_CHECK_LINE.test(codeLine);
      if (!allowed) {
        record(i, "PsychSift legacy package/repo identifier (prompt-for-codex-medical-knowledge-base)", codeLine);
      }
    }

    if (PSYCHSIFT_IDENTIFIER_PATTERN.test(codeLine)) {
      const allowedPattern = ALLOWED_SCRIPT_PSYCHSIFT_LINES.get(normalizedPath);
      if (!allowedPattern?.test(codeLine)) {
        record(i, "PsychSift identifier in Ward Flow code or config", codeLine);
      }
    }

    if (HEALTH_WA_ENDPOINT_PATTERN.test(codeLine)) {
      const allowedPattern = ALLOWED_HEALTH_WA_PATTERNS.get(normalizedPath);
      if (!allowedPattern?.test(codeLine)) {
        record(i, "WA Health (health.wa.gov.au) clinical endpoint or domain reference", codeLine);
      }
    }
  }

  return violations;
}

describe("clinical separation guard", () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");

  it("identifies Ward Flow code, backend, scripts, and root config files while excluding itself", () => {
    const files = collectClinicalSeparationTargetFiles(repoRoot);
    expect(files.some((file) => file.startsWith("src/"))).toBe(true);
    expect(files.some((file) => file.startsWith("backend/"))).toBe(true);
    expect(files.some((file) => file.startsWith("scripts/"))).toBe(true);
    expect(files).toContain("package.json");
    expect(files).toContain("next.config.ts");
    expect(files).not.toContain(SELF_RELATIVE_PATH);
  });

  it("pins Ward Flow package identity away from PsychSift", () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as { name?: string };
    expect(pkg.name).toBe("ward-flow");
  });

  it("detects PsychSift Supabase refs, production/Railway URLs, repo identifiers, and WA Health endpoints in synthetic fixtures", () => {
    expect(
      findClinicalSeparationViolations(
        "src/lib/bad-supabase.ts",
        'const url = "https://sjrfecxgysukkwxsowpy.supabase.co";',
      ),
    ).toHaveLength(1);

    expect(
      findClinicalSeparationViolations("src/lib/bad-prod.ts", 'const host = "https://psychiatry.tools/api/search";'),
    ).toHaveLength(1);

    expect(
      findClinicalSeparationViolations(
        "backend/ward-flow/server.mjs",
        'const origin = "https://psychsift-prod.up.railway.app";',
      ).map((v) => v.rule),
    ).toContain("Non-Ward-Flow Railway or PsychSift production URL");

    expect(
      findClinicalSeparationViolations("package.json", '{"name": "prompt-for-codex-medical-knowledge-base"}'),
    ).toHaveLength(1);

    expect(
      findClinicalSeparationViolations(
        "scripts/bad-push.mjs",
        'const remote = "https://github.com/BigSimmo/PsychSift.git";',
      ).map((v) => v.rule),
    ).toContain("PsychSift/Database repository reference");

    expect(
      findClinicalSeparationViolations(
        "src/lib/bad-endpoint.ts",
        'export const endpoint = "https://pas.health.wa.gov.au/api/v1/patients";',
      ),
    ).toHaveLength(1);

    // Comments documenting the separation boundary do not false-positive on the generic psychsift check.
    expect(
      findClinicalSeparationViolations(
        ".env.example",
        "# Never connect Ward Flow to PsychSift resources.\nWARD_SUPABASE_URL=https://zakzoemeedfepxcstsou.supabase.co\n",
      ),
    ).toEqual([]);

    // Self-scan is always skipped.
    expect(findClinicalSeparationViolations(SELF_RELATIVE_PATH, 'const fixture = "sjrfecxgysukkwxsowpy";')).toEqual([]);
  });

  it("contains zero PsychSift or WA Health clinical endpoint references across Ward Flow code and config", () => {
    const files = collectClinicalSeparationTargetFiles(repoRoot);
    const violations: ClinicalSeparationViolation[] = [];

    for (const file of files) {
      const content = readFileSync(path.join(repoRoot, file), "utf8");
      violations.push(...findClinicalSeparationViolations(file, content));
    }

    const formatted = violations.map((v) => `${v.file}:${v.line} [${v.rule}] -> ${v.snippet}`);
    expect(formatted, CLINICAL_ISOLATION_MESSAGE).toEqual([]);
  });
});
