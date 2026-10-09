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
function jobAt(offset: number): { name: string; text: string } | undefined {
  const matches = [...workflow.matchAll(/^ {2}([\w-]+):\n/gm)];
  let job: { name: string; text: string } | undefined;
  for (const [index, match] of matches.entries()) {
    if ((match.index ?? 0) > offset) break;
    job = { name: match[1], text: workflow.slice(match.index, matches[index + 1]?.index) };
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
    const backendJob = jobAt(backendTest.start);
    expect(backendJob?.text).toMatch(/^\s*image:\s*postgres:16\s*$/mu);
    expect(backendJob?.text).toMatch(/^\s*POSTGRES_DB:\s*wardflow_test\s*$/mu);
    expect(backendJob?.text).toMatch(/^\s*ports:\s*\[\s*5432\s*:\s*5432\s*\]\s*$/mu);
    expect(install.start).toBeLessThan(backendTest.start);
    expect(workflow).not.toMatch(/continue-on-error:/u);

    const job = jobAt(install.start);
    expect(job?.name).toBeDefined();
    expect(backendJob?.name).toBe(job?.name);
    const needs = /^ {2}required:\n[\s\S]*?needs: \[([^\]]*)\]/mu
      .exec(workflow)?.[1]
      .split(",")
      .map((name) => name.trim());
    expect(needs).toContain(job?.name);
  });
});
