// Audit M47: test accounts and non-production copies. The test half of "Done when": a check fails
// if a fixture or CI artifact holds anything not marked synthetic. The names-only account
// inventory is a draft in docs/ward-flow/governance/TEST-ACCOUNT-INVENTORY.md and is signed at
// go/no-go by a person.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function files(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...files(full));
    else out.push(full);
  }
  return out;
}
const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");

// Every fixture or data file, with why it is safe. A new file fails until it is reviewed here.
const FIXTURE_REGISTER: Record<string, string> = {
  "tests/fixtures/mutate-self-test.txt": "tooling: a mutation-testing self check, no records",
  "tests/fixtures/patient-search-lookalikes.ts": "synthetic: invented names, record numbers and dates of birth",
  "tests/fixtures/ward-flow-storage-validation-verdicts.json": "tooling: bit strings of validator verdicts, no records",
  "data/mha-2014-sections.json": "public law: Mental Health Act 2014 (WA) section titles",
  "data/mha-2014-sections.source.json": "public law: source of the section titles",
};

// Addresses that cannot reach a real mailbox (RFC 2606 / 6761) or are reviewed non-person addresses.
const SAFE_EMAIL_DOMAIN =
  /(^|\.)(invalid|test|example|example\.com|example\.org|example\.net|example\.health)$|^(github\.com|users\.noreply\.github\.com|fcm\.googleapis\.com|health\.wa\.gov\.au|self\.example)$|(^|\.)ingest(\.de)?\.sentry\.io$/i;

describe("M47 fixtures hold only synthetic or public material", () => {
  it("every fixture and data file is on the reviewed register", () => {
    const found = [...files(path.join(ROOT, "tests/fixtures")), ...files(path.join(ROOT, "data"))].map(rel).sort();
    expect(found).toEqual(Object.keys(FIXTURE_REGISTER).sort());
  });

  it("a fixture that holds people says so in its own text", () => {
    for (const [file, why] of Object.entries(FIXTURE_REGISTER)) {
      if (!why.startsWith("synthetic")) continue;
      expect(readFileSync(path.join(ROOT, file), "utf8"), file).toMatch(/invented|synthetic/i);
    }
  });

  it("no test, fixture or backend test file holds an email address that could reach a real person", () => {
    const scanned = [
      ...files(path.join(ROOT, "tests")),
      ...files(path.join(ROOT, "data")),
      ...readdirSync(path.join(ROOT, "backend/ward-flow"))
        .filter((name) => /\.(mjs|ts|json)$/.test(name))
        .map((name) => path.join(ROOT, "backend/ward-flow", name)),
    ].filter(
      (file) =>
        /\.(ts|tsx|mjs|js|json|txt|csv)$/.test(file) && !file.includes(`${path.sep}visual-baselines${path.sep}`),
    );
    const unsafe: string[] = [];
    for (const file of scanned) {
      for (const match of readFileSync(file, "utf8").matchAll(
        /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g,
      )) {
        if (!SAFE_EMAIL_DOMAIN.test(match[1]!)) unsafe.push(`${rel(file)}: ${match[0]}`);
      }
    }
    expect(unsafe).toEqual([]);
  });
});

describe("M47 CI artifacts come only from secret-free, synthetic runs", () => {
  const workflowDir = path.join(ROOT, ".github/workflows");
  const workflows = readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name));

  it("a workflow that uploads an artifact reads no secret, so its runs cannot reach a live record", () => {
    const uploaders = workflows.filter((name) =>
      readFileSync(path.join(workflowDir, name), "utf8").includes("actions/upload-artifact@"),
    );
    expect(uploaders.length).toBeGreaterThan(0);
    const offenders = uploaders.filter((name) =>
      /\$\{\{\s*secrets\.(?!GITHUB_TOKEN\b)/.test(readFileSync(path.join(workflowDir, name), "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("artifacts upload only from reviewed test-output folders", () => {
    const reviewed = new Set([
      "test-results/",
      "test-results/**/*.json",
      "test-results/**/journeys.json",
      "test-results/**/shard-*.json",
      "coverage/",
      "coverage/backend/",
      "tests/visual-baselines/",
      "${{ runner.temp }}/dependency-audit.json",
      "${{ runner.temp }}/ward-coverage-blobs/blob-*.json",
      "${{ runner.temp }}/ward-unit-state/",
      "${{ runner.temp }}/ward-profile/",
      "${{ runner.temp }}/ward-browser-build/",
      "${{ runner.temp }}/ward-browser-costs.json",
      "${{ runner.temp }}/ward-unit-costs.json",
      "${{ runner.temp }}/script-budget/measured.json",
    ]);
    const seen: string[] = [];
    for (const name of workflows) {
      const lines = readFileSync(path.join(workflowDir, name), "utf8").split("\n");
      lines.forEach((line, index) => {
        if (!line.includes("actions/upload-artifact@")) return;
        // Read this step's `with:` block until the next step starts.
        for (let i = index + 1; i < lines.length && !/^\s*- (name|uses|run):/.test(lines[i]!); i++) {
          const single = /^\s*path:\s*(\S.*)$/.exec(lines[i]!);
          if (single && !/^\|/.test(single[1]!)) seen.push(single[1]!.trim());
          if (/^\s*path:\s*\|/.test(lines[i]!)) {
            for (
              let j = i + 1;
              j < lines.length && /^\s{12,}\S/.test(lines[j]!) && !/:\s/.test(lines[j]!.trim().slice(0, 30));
              j++
            )
              seen.push(lines[j]!.trim());
          }
        }
      });
    }
    expect(seen.length).toBeGreaterThan(5);
    expect(seen.filter((entry) => !reviewed.has(entry))).toEqual([]);
  });
});
