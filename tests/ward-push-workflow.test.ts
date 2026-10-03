import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  defaultRunsFetch,
  inFlightCiVerdict,
  isRequiredCiWorkflow,
  wardFlowCheckoutVerdict,
} from "../scripts/guard-push.mjs";
import { removePathSync } from "../scripts/retryable-fs.mjs";
describe("Ward push workflow identity", () => {
  it("uses current Ward workflow identity, rejects retired CI and retains unavailable state", () => {
    expect(isRequiredCiWorkflow({ name: "unit", workflowName: "Ward Flow CI" })).toBe(true);
    expect(isRequiredCiWorkflow({ path: ".github/workflows/ward-flow.yml" })).toBe(true);
    expect(isRequiredCiWorkflow({ workflowName: "CI", path: ".github/workflows/ci.yml" })).toBe(false);
    const fetch = vi.fn((_command: string, _args: string[], _options: object) =>
      JSON.stringify([{ workflowName: "Ward Flow CI", status: "queued" }]),
    );
    expect(defaultRunsFetch("codex/fixture", fetch)).toHaveLength(1);
    expect(fetch.mock.calls[0][1]).toContain("ward-flow.yml");
    expect(fetch.mock.calls[0][2]).toMatchObject({ timeout: 30000 });
    expect(
      defaultRunsFetch("codex/fixture", () => {
        throw new Error("unavailable fixture");
      }),
    ).toBeNull();
    expect(inFlightCiVerdict("codex/fixture", { state: "OPEN", number: 1 }, null)).toMatchObject({
      block: true,
      reason: "required-ci-state-unavailable",
    });
  });
  it("ambient checkout skip cannot authorize missing or foreign destinations", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ward-checkout-skip-"));
    try {
      execFileSync("git", ["init", "-q", root]);
      expect(wardFlowCheckoutVerdict(root, { SKIP_CHECKOUT_GUARD: "1" }).ok).toBeFalsy();
      execFileSync("git", ["-C", root, "remote", "add", "origin", "https://github.com/BigSimmo/PsychSift.git"]);
      expect(wardFlowCheckoutVerdict(root, { SKIP_CHECKOUT_GUARD: "1" }).ok).toBeFalsy();
    } finally {
      removePathSync(root, { recursive: true });
    }
  });
});
