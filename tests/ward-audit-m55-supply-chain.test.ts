// Audit M55: supply chain and CI trust. Fails when a PR adds an unpinned action, a workflow
// without declared permissions, a write scope nobody reviewed, or a dependency whose licence is
// not on the reviewed list. Runs offline from the lockfiles: no registry or GitHub call.
// Switching on Dependabot security updates is a repository setting and needs Josh.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const WORKFLOWS = path.join(ROOT, ".github/workflows");
const workflowNames = readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name));
const workflow = (name: string) => readFileSync(path.join(WORKFLOWS, name), "utf8");
// Local composite actions the workflows call (`uses: ./.github/actions/...`) hold pins as well.
const ACTIONS = path.join(ROOT, ".github/actions");
const actionNames = readdirSync(ACTIONS).map((name) => `${name}/action.yml`);

describe("M55 workflows pin actions and declare permissions", () => {
  it("reads every workflow", () => {
    expect(workflowNames.length).toBeGreaterThanOrEqual(15);
  });

  it.each(workflowNames)("%s pins every action to a full commit", (name) => {
    const unpinned = workflow(name)
      .split("\n")
      .map((line) => line.replace(/\s+#.*$/, ""))
      .filter((line) => /^\s*(-\s+)?uses:/.test(line))
      .map((line) => line.replace(/^\s*(-\s+)?uses:\s*/, "").trim())
      .filter(
        (ref) =>
          !ref.startsWith("./") &&
          !/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(ref) &&
          !/^docker:\/\/.+@sha256:[0-9a-f]{64}$/.test(ref),
      );
    expect(unpinned).toEqual([]);
  });

  it("reads every local action", () => {
    expect(actionNames).toContain("ward-setup/action.yml");
  });

  it.each(actionNames)("local action %s pins every action to a full commit", (name) => {
    const refs = readFileSync(path.join(ACTIONS, name), "utf8")
      .split("\n")
      .map((line) => line.replace(/\s+#.*$/, ""))
      .filter((line) => /^\s*(-\s+)?uses:/.test(line))
      .map((line) => line.replace(/^\s*(-\s+)?uses:\s*/, "").trim());
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.filter((ref) => !/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(ref))).toEqual([]);
  });

  it.each(workflowNames)("%s declares its permissions at the top", (name) => {
    expect(workflow(name)).toMatch(/^permissions:/m);
    expect(workflow(name)).not.toMatch(/^\s*permissions:\s*write-all\b/m);
  });

  it("grants write scopes only where they were reviewed", () => {
    // Each workflow's write scopes as found on 10 Nov 2026. Adding one fails here until reviewed.
    const found: Record<string, string[]> = {};
    for (const name of workflowNames) {
      const scopes = [...workflow(name).matchAll(/^\s+([a-z-]+):\s*write\b/gm)].map((match) => match[1]!);
      if (scopes.length) found[name] = [...new Set(scopes)].sort();
    }
    expect(found).toEqual(REVIEWED_WRITE_SCOPES);
  });

  it("Dependabot watches both npm projects and the actions", () => {
    const config = readFileSync(path.join(ROOT, ".github/dependabot.yml"), "utf8");
    expect(config).toMatch(/package-ecosystem: npm\s+directory: \/\n/);
    expect(config).toMatch(/package-ecosystem: npm\s+directory: \/backend\/ward-flow/);
    expect(config).toMatch(/package-ecosystem: github-actions\s+directories: \["\/", "\/\.github\/actions\/\*"\]\n/);
  });
});

// Filled from the workflows as they stood when this test was written; the budget recheck job was
// deleted by D-124 item 6.
const REVIEWED_WRITE_SCOPES: Record<string, string[]> = {
  "backend-uptime.yml": ["issues"],
  // CodeQL uploads its results (added on main).
  "codeql.yml": ["security-events"],
  "daily-release.yml": ["contents"],
  "docs-freshness.yml": ["issues"],
  "release-tag.yml": ["contents"],
  "ward-flow-budget-heal.yml": ["issues"],
  "ward-flow-ci-tidy.yml": ["actions"],
  "ward-flow-nightly-browsers.yml": ["issues"],
  "workflow-keepalive.yml": ["actions"],
};

// Permissive licences, plus weak copyleft that is used unmodified as a separate library.
const ALLOWED = new Set([
  "MIT",
  "MIT-0",
  "ISC",
  "0BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "BlueOak-1.0.0",
  "CC0-1.0",
  "(WTFPL OR MIT)",
]);
// Weak copyleft or attribution licences, allowed only for the named packages after review.
const REVIEWED_ONLY_FOR: Array<{ licence: RegExp; packages: RegExp; why: string }> = [
  {
    licence: /^MPL-2\.0$/,
    packages: /^(@axe-core\/playwright|axe-core|lightningcss(-[a-z0-9-]+)?|web-push)$/,
    why: "used unmodified; test and build tools, and the backend phone alert library",
  },
  {
    licence: /LGPL-3\.0-or-later/,
    packages: /^@img\/sharp-/,
    why: "optional image binaries from Next.js, dynamically linked",
  },
  { licence: /^CC-BY-4\.0$/, packages: /^caniuse-lite$/, why: "browser support data, attribution in the package" },
];

function packageName(key: string): string {
  return key.split("node_modules/").at(-1)!;
}

describe("M55 dependency licences", () => {
  it.each(["package-lock.json", "backend/ward-flow/package-lock.json"])("%s holds only reviewed licences", (lock) => {
    const packages: Record<string, { license?: unknown }> = JSON.parse(
      readFileSync(path.join(ROOT, lock), "utf8"),
    ).packages;
    const entries = Object.entries(packages).filter(([key]) => key !== "");
    expect(entries.length).toBeGreaterThan(30);
    const problems: string[] = [];
    for (const [key, value] of entries) {
      const name = packageName(key);
      const licence = typeof value.license === "string" ? value.license : undefined;
      if (!licence) problems.push(`${name}: no licence in the lockfile`);
      else if (ALLOWED.has(licence)) continue;
      else if (!REVIEWED_ONLY_FOR.some((rule) => rule.licence.test(licence) && rule.packages.test(name)))
        problems.push(`${name}: ${licence}`);
    }
    expect(problems).toEqual([]);
  });

  it("refuses a strong copyleft or unknown licence", () => {
    const refused = ["GPL-3.0-only", "AGPL-3.0-or-later", "SSPL-1.0", "UNLICENSED", "SEE LICENSE IN LICENSE"];
    for (const licence of refused) {
      expect(ALLOWED.has(licence)).toBe(false);
      expect(REVIEWED_ONLY_FOR.some((rule) => rule.licence.test(licence))).toBe(false);
    }
  });
});
