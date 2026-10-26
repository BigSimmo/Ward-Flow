import { describe, expect, it } from "vitest";
import {
  botSensitiveCommitViolations,
  isBotAuthor,
  isSensitivePath,
} from "../scripts/ward-ci-public/bot-author-policy.mjs";

const bot = { login: "qodo-merge-pro[bot]", email: "" };
const human = { login: "BigSimmo", email: "87357024+BigSimmo@users.noreply.github.com" };

describe("bot-author PR policy", () => {
  it("recognises bot authors by login suffix, known login and noreply email", () => {
    expect(isBotAuthor(bot)).toBe(true);
    expect(isBotAuthor({ login: "dependabot[bot]" })).toBe(true);
    expect(isBotAuthor({ login: "Qodo-Merge-Pro" })).toBe(true);
    expect(isBotAuthor({ email: "49699333+dependabot[bot]@users.noreply.github.com" })).toBe(true);
    expect(isBotAuthor({ email: "1+coderabbitai@users.noreply.github.com" })).toBe(true);
    expect(isBotAuthor(human)).toBe(false);
    expect(isBotAuthor(undefined)).toBe(false);
  });

  it("protects supabase, backend infra SQL and clinical paths", () => {
    expect(isSensitivePath("supabase/migrations/1_x.sql")).toBe(true);
    expect(isSensitivePath("backend/ward-flow/infra/supabase-runtime-role.sql")).toBe(true);
    expect(isSensitivePath("data/mha-2014-sections.json")).toBe(true);
    expect(isSensitivePath("docs/ward-flow/governance/CLINICAL-SAFETY-CASE.md")).toBe(true);
    expect(isSensitivePath("docs/ward-flow/clinical-values.md")).toBe(true);
    expect(isSensitivePath("src/components/ward-management/ward-clinical-values.ts")).toBe(true);
    expect(isSensitivePath("package.json")).toBe(false);
    expect(isSensitivePath("backend/ward-flow/infra/README.md")).toBe(false);
    expect(isSensitivePath("src/components/ward-management/shell/ward-prototype-footer.tsx")).toBe(false);
  });

  it("protects Ward Flow's real migrations, sign-in, engine and legal logic", () => {
    for (const file of [
      "backend/ward-flow/migrations/013-referral-record-views.sql",
      "backend/ward-flow/migrations.mjs",
      "backend/ward-flow/engine.ts",
      "backend/ward-flow/command-schemas.ts",
      "backend/ward-flow/auth.mjs",
      "backend/ward-flow/supabase-auth.mjs",
      "src/components/ward-management/ward-eligibility.ts",
      "src/components/ward-management/legal-forms/legal-form-progression.ts",
      "src/components/ward-management/legal-forms/legal-forms-derivations.ts",
      "src/components/ward-management/ward-legal-clock.ts",
      "src/components/ward-management/ward-legal-forms.ts",
      "src/components/ward-management/ward-stay-legal.ts",
      "src/components/ward-management/ward-held-legal-check.ts",
      "src/components/ward-management/ward-flow-record-legal-events.ts",
    ]) {
      expect(isSensitivePath(file), file).toBe(true);
    }
    for (const file of [
      "backend/ward-flow/README.md",
      "backend/ward-flow/server.mjs",
      "backend/ward-flow/supabase-auth.test.mjs",
      "src/components/ward-management/legal-forms/legal-forms.module.css",
      "src/components/ward-management/legal-forms/legal-forms-panel.tsx",
      "tests/ward-legal-clock.test.ts",
    ]) {
      expect(isSensitivePath(file), file).toBe(false);
    }
  });

  it("flags only bot commits whose own files are protected", () => {
    expect(
      botSensitiveCommitViolations([{ sha: "a".repeat(40), author: bot, files: ["data/mha-2014-sections.json"] }]),
    ).toHaveLength(1);
    expect(
      botSensitiveCommitViolations([
        { sha: "b".repeat(40), author: human, files: ["supabase/config.toml"] },
        { sha: "c".repeat(40), author: bot, files: ["README.md"] },
        { sha: "d".repeat(40), author: { login: "dependabot[bot]" }, files: ["package.json", "package-lock.json"] },
      ]),
    ).toEqual([]);
  });

  it("fails closed when a bot commit's files are unknown", () => {
    expect(botSensitiveCommitViolations([{ sha: "e".repeat(40), author: bot }])[0]).toMatch(/failing closed/);
  });
});

describe("bot-author PR policy: truncated listings", () => {
  const json = (body: unknown) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });

  it("fails closed when the PR commit list is shorter than the PR's commit count", async () => {
    const { collectPullRequestCommits } = await import("../scripts/ward-ci-public/bot-author-policy.mjs");
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string) =>
      json(url.includes("/commits?") ? [{ sha: "a", author: { login: "x" }, commit: {} }] : { commits: 2 })) as never;
    try {
      await expect(collectPullRequestCommits({ repository: "o/r", prNumber: "1", token: "t" })).rejects.toThrow(
        /incomplete/,
      );
    } finally {
      globalThis.fetch = original;
    }
  });

  it("reads every page of a bot commit's files", async () => {
    const { collectCommitFiles } = await import("../scripts/ward-ci-public/bot-author-policy.mjs");
    const original = globalThis.fetch;
    const page = (n: number, count: number) => Array.from({ length: count }, (_, i) => ({ filename: `f${n}-${i}` }));
    globalThis.fetch = (async (url: string) =>
      json({ files: url.endsWith("&page=1") ? page(1, 100) : [{ filename: "supabase/x.sql" }] })) as never;
    try {
      const files = await collectCommitFiles({ repository: "o/r", sha: "a", token: "t" });
      expect(files).toHaveLength(101);
      expect(files).toContain("supabase/x.sql");
    } finally {
      globalThis.fetch = original;
    }
  });
});
