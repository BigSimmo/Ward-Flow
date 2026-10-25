import { X509Certificate } from "node:crypto";
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

  it("trusts the public Supabase Root 2021 CA the pooler chains to", () => {
    expect(workflow).toContain("WARD_SUPABASE_CA_CERT_FILE: infra/supabase-root-2021-ca.crt");
    const ca = new X509Certificate(
      readFileSync(new URL("../backend/ward-flow/infra/supabase-root-2021-ca.crt", import.meta.url)),
    );
    expect(ca.ca).toBe(true);
    expect(ca.subject).toContain("CN=Supabase Root 2021 CA");
    expect(ca.fingerprint256).toBe(
      "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA",
    );
  });

  it("connects only when the secret is set", () => {
    const gated = [...workflow.matchAll(/^      - name: .+\n(?:        .+\n)*/gmu)].slice(1);
    expect(gated.length).toBeGreaterThan(0);
    for (const step of gated) expect(step[0]).toContain("if: ${{ steps.secrets.outputs.ready == 'true' }}");
  });
});
