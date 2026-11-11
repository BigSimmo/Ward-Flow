// M87: plant bugs to prove the tests catch them. Pins the cheap form (the PR template question
// waits on Josh, see the todo): the sample script still finds every defect it plants,
// it refuses to plant them in the shared checkout, and a dated score is on file.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MUTANTS } from "../scripts/ward-flow/mutation-sample.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("M87 planted-defect sample", () => {
  // M87 PR template line needs Josh: the repository has no PR template, and adding one is his call.
  it.todo("the PR template asks which planted defect a tier 1 test fails on");

  it("every planted defect still matches its source exactly once", () => {
    expect(MUTANTS.length).toBeGreaterThanOrEqual(10);
    for (const mutant of MUTANTS as { id: string; file: string; find: string; replace: string }[]) {
      expect(read(mutant.file).split(mutant.find).length - 1, mutant.id).toBe(1);
      expect(mutant.replace, mutant.id).not.toBe(mutant.find);
    }
  });

  it("refuses to plant defects in this checkout", () => {
    let status = 0;
    let stderr = "";
    try {
      execFileSync(process.execPath, ["scripts/ward-flow/mutation-sample.mjs", "--root", ROOT], {
        cwd: ROOT,
        stdio: "pipe",
      });
    } catch (error) {
      status = (error as { status: number }).status;
      stderr = String((error as { stderr: Buffer }).stderr);
    }
    expect(status).toBe(1);
    expect(stderr).toMatch(/refusing to plant defects in the shared checkout/u);
  });

  it("a dated score is on file", () => {
    const scores = readdirSync(new URL("../docs/ward-flow/evidence/", import.meta.url)).filter((name) =>
      /^\d{4}-\d{2}-\d{2}-mutation-sample\.md$/u.test(name),
    );
    expect(scores.length).toBeGreaterThan(0);
    expect(read(`docs/ward-flow/evidence/${scores.sort().at(-1)}`)).toMatch(
      /## Score: \d+ of \d+ planted defects caught/u,
    );
  });
});
