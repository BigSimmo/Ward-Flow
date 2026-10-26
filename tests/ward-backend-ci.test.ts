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
  it("lints the backend in the whole-tree lint, locally and in CI (H-0296, H-0913)", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["lint:internal"]).toMatch(/eslint\.js src tests scripts backend /u);
    expect(step("Lint the whole tree").text).toMatch(/eslint\.js src tests scripts backend /u);
  });

  it("installs and tests the nested backend in a job the required check depends on", () => {
    const install = step("Install locked Ward backend dependencies");
    const backendTest = step("Run Ward backend tests");

    expect(install.text).toMatch(/id: backend-install/u);
    expect(install.text).toMatch(/steps\.install\.outcome == 'success'/u);
    expect(install.text).toMatch(
      /^\s*run: node scripts\/install-locked-dependencies\.mjs --root backend\/ward-flow\s*$/mu,
    );
    expect(backendTest.text).toMatch(/steps\.backend-install\.outcome == 'success'/u);
    expect(backendTest.text).toMatch(/working-directory: backend\/ward-flow/u);
    expect(backendTest.text).toMatch(
      /^\s*run: npm run build:engine && npm run typecheck && npm run test:coverage\s*$/mu,
    );
    expect(backendTest.text).toMatch(
      /WARD_TEST_DATABASE_URL: postgresql:\/\/postgres@127\.0\.0\.1:5432\/wardflow_test/u,
    );
    const backendJob = jobAt(backendTest.start);
    expect(backendJob?.name).toBe("backend");
    expect(backendJob?.text).toMatch(/^\s*needs: plan\s*$/mu);
    expect(backendJob?.text).toContain("needs.plan.outputs.backend == 'true'");
    expect(backendJob?.text).toMatch(/^\s*run: node scripts\/install-locked-dependencies\.mjs\s*$/mu);
    expect(backendJob?.text).toMatch(/^\s*image:\s*postgres:16@sha256:[0-9a-f]{64}\s*$/mu);
    expect(backendJob?.text).toMatch(/^\s*POSTGRES_DB:\s*wardflow_test\s*$/mu);
    expect(backendJob?.text).toMatch(/^\s*ports:\s*\[\s*"127\.0\.0\.1:5432:5432"\s*\]\s*$/mu);
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
    expect(workflow).toContain("BACKEND_RESULT: ${{ needs.backend.result }}");
    expect(workflow).toContain("BACKEND_SCOPE: ${{ needs.plan.outputs.backend }}");
    expect(workflow).toContain('require_scope "$BACKEND_SCOPE" "$BACKEND_RESULT"');
    const evidence = step("Upload backend and shared-mode evidence");
    expect(jobAt(evidence.start)?.name).toBe("backend");
    expect(evidence.text).toContain("coverage/backend/");
    const sharedJourney = step("Run the shared-mode browser journey");
    expect(jobAt(sharedJourney.start)?.name).toBe("backend");
    expect(sharedJourney.text).toMatch(/^\s*run: node tests\/support\/ward-shared-mode-run\.mjs\s*$/mu);
  });
});
