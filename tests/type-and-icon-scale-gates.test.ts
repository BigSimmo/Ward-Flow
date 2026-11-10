import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * M109 (final master audit, 10 Nov 2026): `check:type-scale` and `check:icon-scale` were the only
 * guard scripts nothing in CI called, so an arbitrary `text-[13px]` or a retired 18px `size-4.5`
 * could land unseen. Like the other guards, they run here, in the unit suite CI already runs, each
 * in `--strict` mode against the real `src` tree. A fixture proves each one still fails on what it
 * exists to catch, so a script that stopped looking cannot pass by saying nothing.
 */

const GATES = [
  {
    script: "scripts/check-type-scale.mjs",
    clean: "✓ type-scale",
    offending: 'export const Label = () => <span className="text-[13px]">Beds</span>;\n',
  },
  {
    script: "scripts/check-icon-scale.mjs",
    clean: "✓ icon-scale",
    offending: 'export const Dot = () => <span className="size-4.5" aria-hidden />;\n',
  },
] as const;

const fixtures: string[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

describe.each(GATES)("$script", ({ script, clean, offending }) => {
  it("passes --strict on the real src tree", () => {
    const output = execFileSync(process.execPath, [resolve(script), "--strict"], { encoding: "utf8" });
    expect(output).toContain(clean);
  });

  it("fails --strict on an off-scale size", () => {
    const fixture = mkdtempSync(join(tmpdir(), "ward-scale-gate-"));
    fixtures.push(fixture);
    mkdirSync(join(fixture, "src"));
    writeFileSync(join(fixture, "src", "synthetic.tsx"), offending);
    execFileSync("git", ["init", "--quiet"], { cwd: fixture });
    execFileSync("git", ["add", "src"], { cwd: fixture });
    const run = spawnSync(process.execPath, [resolve(script), "--strict"], { cwd: fixture, encoding: "utf8" });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("--strict");
  });
});
