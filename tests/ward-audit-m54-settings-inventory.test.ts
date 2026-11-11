// Audit M54: one names-only list of every setting. This fails when code or a workflow reads a
// setting the inventory does not list, and when the inventory or this test would print a value.
// Checking the list against what each service holds is a person's job (needs Josh's yes).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const INVENTORY = path.join(ROOT, "docs/ward-flow/governance/SETTINGS-AND-SECRETS-INVENTORY.md");

function files(dir: string, match: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...files(full, match));
    else if (match.test(entry) && !/\.test\.|test-support/.test(entry)) out.push(full);
  }
  return out;
}

/** Setting names the running app and backend read, found by their source text. Names only. */
function namesReadByCode(): Set<string> {
  const names = new Set<string>();
  const sources = [
    ...files(path.join(ROOT, "src"), /\.(ts|tsx)$/),
    ...readdirSync(path.join(ROOT, "backend/ward-flow"))
      .filter((name) => name.endsWith(".mjs") && !/\.test\.|test-support/.test(name))
      .map((name) => path.join(ROOT, "backend/ward-flow", name)),
    path.join(ROOT, "next.config.ts"),
  ];
  for (const file of sources) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) names.add(match[1]!);
    if (file.includes(`${path.sep}backend${path.sep}`) || file.endsWith("sentry-server.ts"))
      for (const match of text.matchAll(/\benv\.([A-Z][A-Z0-9_]{3,})/g)) names.add(match[1]!);
  }
  return names;
}

function namesReadByWorkflows(): Set<string> {
  const names = new Set<string>();
  const dir = path.join(ROOT, ".github/workflows");
  for (const name of readdirSync(dir).filter((file) => /\.ya?ml$/.test(file)))
    for (const match of readFileSync(path.join(dir, name), "utf8").matchAll(/\b(?:secrets|vars)\.([A-Z][A-Z0-9_]+)/g))
      if (match[1] !== "GITHUB_TOKEN") names.add(match[1]!);
  return names;
}

describe("M54 settings and secrets inventory", () => {
  const inventory = readFileSync(INVENTORY, "utf8");
  const listed = new Set([...inventory.matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map((match) => match[1]!));

  it("finds enough settings that a broken scan would show", () => {
    expect(namesReadByCode().size).toBeGreaterThan(40);
    expect(namesReadByWorkflows().size).toBeGreaterThan(3);
  });

  it("lists every setting the app and backend read", () => {
    expect([...namesReadByCode()].filter((name) => !listed.has(name)).sort()).toEqual([]);
  });

  it("lists every secret and variable a workflow reads", () => {
    expect([...namesReadByWorkflows()].filter((name) => !listed.has(name)).sort()).toEqual([]);
  });

  it("names the exact uptime token both sides must use", () => {
    expect(readFileSync(path.join(ROOT, "backend/ward-flow/server.mjs"), "utf8")).toContain(
      "process.env.WARD_FLOW_UPTIME_TOKEN",
    );
    expect(readFileSync(path.join(ROOT, ".github/workflows/backend-uptime.yml"), "utf8")).toContain(
      "secrets.WARD_FLOW_UPTIME_TOKEN",
    );
    expect(inventory).toMatch(/exact name `WARD_FLOW_UPTIME_TOKEN`/);
  });

  it("holds names only: no assignment, key, token or connection string", () => {
    expect(inventory).not.toMatch(/\b[A-Z][A-Z0-9_]{3,}=(?!\*`)\S/);
    expect(inventory).not.toMatch(
      /postgres(?:ql)?:\/\/|sb_secret_|sb_publishable_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{10,}|-----BEGIN/,
    );
  });
});
