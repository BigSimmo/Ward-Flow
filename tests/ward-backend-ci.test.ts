import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/ward-flow.yml", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);

/** One named step's text, wherever it sits in the workflow. */
function step(name: string): { text: string; start: number } {
  const marker = `      - name: ${name}\n`;
  const start = workflow.indexOf(marker);
  if (start < 0) return { text: "", start };
  const end = workflow.indexOf("\n      - name:", start + marker.length);
  return { text: workflow.slice(start, end < 0 ? undefined : end), start };
}

/** The job a workflow offset belongs to, so the check survives the workflow being split into jobs. */
function jobAt(offset: number): string | undefined {
  let job: string | undefined;
  for (const match of workflow.matchAll(/^ {2}([\w-]+):\n/gm)) {
    if ((match.index ?? 0) > offset) break;
    job = match[1];
  }
  return job;
}

describe("Ward backend CI", () => {
  it("installs and tests the nested backend in a job the required check depends on", () => {
    const install = step("Install locked Ward backend dependencies");
    const backendTest = step("Run Ward backend tests");

    expect(install.text).toMatch(/id: backend-install/u);
    expect(install.text).toMatch(/steps\.plan\.outputs\.full == 'true'/u);
    expect(install.text).toMatch(/hashFiles\('backend\/ward-flow\/package\.json'\) != ''/u);
    expect(install.text).toMatch(/working-directory: backend\/ward-flow/u);
    expect(install.text).toMatch(/run: npm ci --ignore-scripts/u);
    expect(backendTest.text).toMatch(/steps\.backend-install\.outcome == 'success'/u);
    expect(backendTest.text).toMatch(/working-directory: backend\/ward-flow/u);
    expect(backendTest.text).toMatch(/run: npm run build:engine && npm test/u);
    expect(backendTest.text).toMatch(
      /WARD_TEST_DATABASE_URL: postgresql:\/\/postgres@127\.0\.0\.1:5432\/wardflow_test/u,
    );
    expect(workflow).toMatch(/image: postgres:16/u);
    expect(install.start).toBeLessThan(backendTest.start);
    expect(workflow).not.toMatch(/continue-on-error:/u);

    const job = jobAt(install.start);
    expect(job).toBeDefined();
    expect(jobAt(backendTest.start)).toBe(job);
    const needs = /^ {2}required:\n[\s\S]*?needs: \[([^\]]*)\]/mu
      .exec(workflow)?.[1]
      .split(",")
      .map((name) => name.trim());
    expect(needs).toContain(job);
  });
});
