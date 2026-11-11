// M133: agent instructions point to live documents and current rulings.
// Every relative link and backticked repository path in the agent files must resolve, must not
// land in the archive (docs/history/) or on a file whose banner says it is superseded, archived or
// retired, and every D-number cited must exist in decisions.md and not be fully replaced.
// A backticked path that no longer exists is allowed only where the same line calls it historical.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const AGENT_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "src/components/ward-management/CLAUDE.md",
  ...readdirSync(join(ROOT, "docs/agents"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `docs/agents/${name}`),
];
const decisions = readFileSync(join(ROOT, "docs/ward-flow/decisions.md"), "utf8");
const ARCHIVE_BANNER =
  /^>?\s*\*\*(?:Superseded|Archived|Retired|Historical)\b|^\*\*Status:?\*\*:?\s*(?:superseded|archived|retired)/imu;

function targetProblem(fromFile: string, target: string, root = ROOT): string | null {
  const absolute = normalize(join(dirname(join(root, fromFile)), target));
  const rel = relative(root, absolute).split("\\").join("/");
  if (!existsSync(absolute)) return `${rel} does not exist`;
  if (/^docs\/history\//u.test(rel)) return `${rel} is in the archive`;
  if (rel.endsWith(".md")) {
    const head = readFileSync(absolute, "utf8").split("\n").slice(0, 8).join("\n");
    if (ARCHIVE_BANNER.test(head)) return `${rel} is marked superseded, archived or retired`;
  }
  return null;
}

function decisionProblem(id: number, log = decisions): string | null {
  const heading = new RegExp(`^## D-${id}\\. (.*)$`, "mu").exec(log);
  if (!heading) return `D-${id} has no entry in decisions.md`;
  const row = new RegExp(`^\\| \\[D-${id}\\]\\([^)]*\\)\\s*\\|[^|]*\\|\\s*([^|]*?)\\s*\\|`, "mu").exec(log);
  const status = row?.[1] ?? "";
  if (/^Replaced\b/iu.test(status)) return `D-${id} is ${status}`;
  if (/\(replaced by D-\d+/iu.test(heading[1]) && !/partly/iu.test(heading[1])) return `D-${id} is replaced`;
  return null;
}

describe("M133 agent files cite live documents and current rulings", () => {
  it("reads every agent file", () => {
    expect(AGENT_FILES.length).toBeGreaterThan(10);
    for (const file of AGENT_FILES) expect(existsSync(join(ROOT, file)), file).toBe(true);
  });

  it("every relative link resolves to a live document", () => {
    const problems: string[] = [];
    for (const file of AGENT_FILES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const match of text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/gu)) {
        if (/^(?:https?:|mailto:)/u.test(match[1])) continue;
        const problem = targetProblem(file, match[1]);
        if (problem) problems.push(`${file}: ${problem}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("every backticked repository path exists, unless its line calls it historical", () => {
    const problems: string[] = [];
    for (const file of AGENT_FILES) {
      const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
      for (const match of lines.join("\n").matchAll(/`((?:docs|scripts|src|tests|design|backend)\/[^`\s*<>{}]+)`/gu)) {
        const path = match[1].replace(/#.*$/u, "");
        if (existsSync(join(ROOT, path))) {
          if (/^docs\/history\//u.test(path)) problems.push(`${file}: ${path} is in the archive`);
          continue;
        }
        const historical = lines.some((line) => line.includes(path) && /\bhistorical\b|\bretired\b/iu.test(line));
        if (!historical) problems.push(`${file}: ${path} does not exist`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("every D-number cited exists and is not replaced", () => {
    const problems: string[] = [];
    for (const file of AGENT_FILES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const id of new Set([...text.matchAll(/\bD-(\d+)\b/gu)].map((m) => Number(m[1])))) {
        const problem = decisionProblem(id);
        if (problem) problems.push(`${file}: ${problem}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("the checks bite: a replaced ruling, a missing ruling and a superseded file all fail", () => {
    expect(decisionProblem(1)).toMatch(/Replaced/u);
    expect(decisionProblem(9999)).toMatch(/no entry/u);
    expect(decisionProblem(4)).toBeNull();
    expect(targetProblem("AGENTS.md", "design/v9/design-system-v9.md")).toMatch(/superseded/u);
    expect(targetProblem("AGENTS.md", "docs/history/README.md")).toMatch(/archive/u);
    expect(targetProblem("AGENTS.md", "docs/ward-flow/no-such-file.md")).toMatch(/does not exist/u);
    expect(targetProblem("AGENTS.md", "docs/ward-flow/decisions.md")).toBeNull();
  });
});
