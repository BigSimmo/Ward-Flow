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
