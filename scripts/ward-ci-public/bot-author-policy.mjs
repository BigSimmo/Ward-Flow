#!/usr/bin/env node
// PR policy: bot-authored sensitive changes (owner rule, 2026-10-18).
//
// Fails when a commit in the pull request was AUTHORED by a bot account (any `[bot]` login or
// noreply address, or a known review/coding bot such as qodo) and that commit's own files touch
// `supabase/**`, backend SQL (forward migrations and `infra/` rollbacks), the backend sign-in,
// engine and command-schema files, or a clinical or legal-logic path. Such PRs would otherwise pass CI and
// could auto-merge with no human review. Dependabot only edits dependency manifests, lockfiles and
// action pins, none of which match, so its PRs are unaffected. Human commits are never judged here.
//
// CI usage: .github/workflows/bot-author-policy.yml runs MAIN's copy of this script under
// pull_request_target (never PR code). GITHUB_TOKEN, GITHUB_REPOSITORY and WARD_PR_NUMBER are read from
// the environment. Missing or unreadable commit data fails closed.
import process from "node:process";
import { pathToFileURL } from "node:url";

export const knownBotLogins = new Set([
  "qodo-merge",
  "qodo-merge-pro",
  "qodo-ai",
  "qodo-code-review",
  "codiumai-pr-agent",
  "coderabbitai",
  "copilot",
  "copilot-swe-agent",
  "devin-ai-integration",
  "sweep-ai",
  "github-actions",
  "renovate",
]);

export function isBotAuthor(author) {
  if (!author) return false;
  const login = String(author.login ?? "")
    .trim()
    .toLowerCase();
  const email = String(author.email ?? "")
    .trim()
    .toLowerCase();
  if (login.endsWith("[bot]") || knownBotLogins.has(login)) return true;
  if (/\[bot\]@users\.noreply\.github\.com$/u.test(email)) return true;
  const emailLogin = email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/u)?.[1];
  return Boolean(emailLogin && knownBotLogins.has(emailLogin));
}

// Clinical paths: the clinical values, MHA 2014 reference data, clinical governance documents,
// and any source, data or doc file whose path names clinical content. Tests are excluded only when
// they fall under no other rule; protected data stays protected wherever it is referenced.
// `^supabase/` has no folder in Ward Flow today; it stays so a Supabase CLI `supabase/` folder added
// later is protected from its first commit.
export const sensitivePathPatterns = [
  /^supabase\//u,
  /^backend\/(?:.+\/)?infra\/[^/]+\.sql$/iu,
  // Ward Flow's forward schema migrations and the list that orders them.
  /^backend\/ward-flow\/(?:migrations\/[^/]+\.sql|migrations\.mjs)$/u,
  // Backend sign-in and role checks, the shared command engine and its input schemas.
  /^backend\/ward-flow\/(?:auth|supabase-auth)\.mjs$/u,
  /^backend\/ward-flow\/(?:engine|command-schemas)\.ts$/u,
  // Ward eligibility and the Mental Health Act legal-forms logic (not their styles or views).
  /^src\/components\/ward-management\/ward-eligibility\.ts$/u,
  /^src\/components\/ward-management\/(?:legal-forms\/)?[^/]*legal[^/]*\.ts$/u,
  /^data\/mha-[^/]*$/iu,
  /^docs\/ward-flow\/governance\//u,
  /^(?:src|data|docs|backend)\/(?:.*\/)?[^/]*clinic[^/]*(?:\/|$)/iu,
];

function normalizePath(filePath) {
  return String(filePath ?? "")
    .trim()
    .replace(/\\/gu, "/")
    .replace(/^\.\//u, "");
}

export function isSensitivePath(filePath) {
  const file = normalizePath(filePath);
  return Boolean(file) && sensitivePathPatterns.some((pattern) => pattern.test(file));
}

// commits: [{ sha, author: { login, email }, files: [path, ...] }]
export function botSensitiveCommitViolations(commits) {
  const violations = [];
  for (const commit of commits ?? []) {
    if (!isBotAuthor(commit?.author)) continue;
    const who = commit.author.login || commit.author.email || "unknown bot";
    const sha = String(commit.sha ?? "").slice(0, 12) || "unknown";
    if (!Array.isArray(commit.files)) {
      violations.push(`Bot-authored commit ${sha} (${who}) could not have its files verified; failing closed.`);
      continue;
    }
    const sensitive = commit.files.filter(isSensitivePath);
    if (sensitive.length > 0) {
      violations.push(
        `Bot-authored commit ${sha} (${who}) touches protected paths (${sensitive.slice(0, 5).join(", ")}${sensitive.length > 5 ? ", …" : ""}). Supabase, backend SQL and sign-in, engine, legal and clinical paths need a human-authored commit and owner review.`,
      );
    }
  }
  return violations;
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

// GitHub caps the PR commit listing at 250 and commit file listings at 3000 (300 per page). A PR
// with 250 or more commits is read instead from the paginated compare listing of its base and head
// (31 Oct 2026: the redesign PR #1118 passed 400). A count mismatch with the PR, or either cap being
// reached, still fails closed rather than skipping data.
export const MAX_PR_COMMITS = 250;
export const MAX_COMPARE_COMMITS = 10000;
export const MAX_COMMIT_FILES = 3000;

export async function collectCommitFiles({ repository, sha, token, api = "https://api.github.com" }) {
  const files = [];
  for (let page = 1; ; page += 1) {
    const detail = await githubJson(`${api}/repos/${repository}/commits/${sha}?per_page=100&page=${page}`, token);
    const batch = detail.files ?? [];
    files.push(...batch.flatMap((file) => [file.filename, file.previous_filename].filter(Boolean)));
    if (batch.length < 100) break;
    if (page * 100 >= MAX_COMMIT_FILES) throw new Error(`file list may be truncated at ${MAX_COMMIT_FILES}`);
  }
  return files;
}

export async function collectPullRequestCommits({ repository, prNumber, token, api = "https://api.github.com" }) {
  const pr = await githubJson(`${api}/repos/${repository}/pulls/${prNumber}`, token);
  const listed = [];
  if (pr.commits < MAX_PR_COMMITS) {
    for (let page = 1; ; page += 1) {
      const batch = await githubJson(
        `${api}/repos/${repository}/pulls/${prNumber}/commits?per_page=100&page=${page}`,
        token,
      );
      listed.push(...batch);
      if (batch.length < 100) break;
    }
    if (listed.length >= MAX_PR_COMMITS || listed.length !== pr.commits) {
      throw new Error(`PR commit list is incomplete (${listed.length} of ${pr.commits})`);
    }
  } else {
    // The PR listing stops at 250, so read the same commits (head's, not reachable from the base)
    // from the compare listing, which pages past 250.
    const base = pr.base?.sha;
    const head = pr.head?.sha;
    if (!base || !head) throw new Error("PR base or head is missing; cannot list its commits");
    let total;
    for (let page = 1; ; page += 1) {
      const comparison = await githubJson(
        `${api}/repos/${repository}/compare/${base}...${head}?per_page=100&page=${page}`,
        token,
      );
      total = comparison.total_commits;
      const batch = comparison.commits ?? [];
      listed.push(...batch);
      if (batch.length < 100) break;
      if (listed.length >= MAX_COMPARE_COMMITS) break;
    }
    if (listed.length >= MAX_COMPARE_COMMITS || listed.length !== total || listed.length !== pr.commits) {
      throw new Error(`PR commit list is incomplete (${listed.length} of ${pr.commits}; compare says ${total})`);
    }
  }
  const commits = [];
  for (const item of listed) {
    const author = { login: item.author?.login ?? "", email: item.commit?.author?.email ?? "" };
    if (!isBotAuthor(author)) continue;
    let files;
    try {
      files = await collectCommitFiles({ repository, sha: item.sha, token, api });
    } catch (error) {
      console.warn(`Unable to read files of bot commit ${item.sha}: ${error.message}`);
    }
    commits.push({ sha: item.sha, author, files });
  }
  return commits;
}

async function main() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repository, WARD_PR_NUMBER: prNumber } = process.env;
  if (!token || !repository || !/^\d+$/u.test(prNumber ?? "")) {
    console.error("bot-author-policy: GITHUB_TOKEN, GITHUB_REPOSITORY and WARD_PR_NUMBER are required.");
    process.exitCode = 1;
    return;
  }
  const violations = botSensitiveCommitViolations(await collectPullRequestCommits({ repository, prNumber, token }));
  if (violations.length > 0) {
    for (const violation of violations) console.error(`::error::${violation}`);
    process.exitCode = 1;
    return;
  }
  console.log("bot-author-policy: no bot-authored commits touch supabase, backend infra SQL or clinical paths.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`bot-author-policy: ${error.message}; failing closed.`);
    process.exitCode = 1;
  });
}
