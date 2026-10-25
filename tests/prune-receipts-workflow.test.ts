import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/prune-receipts.yml", import.meta.url), "utf8").replace(
  /\r\n/gu,
  "\n",
);
const backendPackage = JSON.parse(readFileSync(new URL("../backend/ward-flow/package.json", import.meta.url), "utf8"));

describe("weekly receipt clean-up (limits audit, 25 Oct 2026)", () => {
  it("runs weekly and on request only, never on a push or PR", () => {
    expect(workflow).toMatch(/^  schedule:\n    - cron: "0 19 \* \* 0"$/mu);
    expect(workflow).toMatch(/^  workflow_dispatch:$/mu);
    expect(workflow).not.toMatch(/^  (?:push|pull_request|pull_request_target|workflow_run):/mu);
    expect(workflow).toMatch(/^permissions:\n  contents: read$/mu);
  });

  it("uses only the receipt-only pruner login, never the migration login", () => {
    expect(workflow).toContain("WARD_SUPABASE_PRUNE_DATABASE_URL: ${{ secrets.WARD_SUPABASE_PRUNE_DATABASE_URL }}");
    expect(workflow).not.toMatch(/MIGRATION_DATABASE_URL|WARD_SUPABASE_DATABASE_URL/u);
    expect(workflow).toContain("run: npm run prune:receipts:supabase-pruner");
    expect(backendPackage.scripts["prune:receipts:supabase-pruner"]).toContain("prune-receipts.mjs supabase-pruner");
  });

  it("connects only when both secrets are set", () => {
    const gated = [...workflow.matchAll(/^      - name: .+\n(?:        .+\n)*/gmu)].slice(1);
    expect(gated.length).toBeGreaterThan(0);
    for (const step of gated) expect(step[0]).toContain("if: ${{ steps.secrets.outputs.ready == 'true' }}");
  });
});
