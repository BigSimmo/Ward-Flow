#!/usr/bin/env node
// PR policy: bot-authored sensitive changes (owner rule, 2026-10-18).
//
// Fails when a commit in the pull request was AUTHORED by a bot account (any `[bot]` login or
// noreply address, or a known review/coding bot such as qodo) and that commit's own files touch
// `supabase/**`, `backend/**/infra/*.sql` or a clinical path. Such PRs would otherwise pass CI and
// could auto-merge with no human review. Dependabot only edits dependency manifests, lockfiles and
// action pins, none of which match, so its PRs are unaffected. Human commits are never judged here.
//
// CI usage (pull_request only): GITHUB_TOKEN, GITHUB_REPOSITORY and WARD_PR_NUMBER are read from
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
export const sensitivePathPatterns = [
  /^supabase\//u,
  /^backend\/(?:.+\/)?infra\/[^/]+\.sql$/iu,
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
        `Bot-authored commit ${sha} (${who}) touches protected paths (${sensitive.slice(0, 5).join(", ")}${sensitive.length > 5 ? ", …" : ""}). Supabase, backend infra SQL and clinical paths need a human-authored commit and owner review.`,
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

export async function collectPullRequestCommits({ repository, prNumber, token, api = "https://api.github.com" }) {
  const commits = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubJson(
      `${api}/repos/${repository}/pulls/${prNumber}/commits?per_page=100&page=${page}`,
      token,
    );
    for (const item of batch) {
      const author = { login: item.author?.login ?? "", email: item.commit?.author?.email ?? "" };
      if (!isBotAuthor(author)) continue;
      let files;
      try {
        const detail = await githubJson(`${api}/repos/${repository}/commits/${item.sha}`, token);
        files = (detail.files ?? []).flatMap((file) => [file.filename, file.previous_filename].filter(Boolean));
      } catch (error) {
        console.warn(`Unable to read files of bot commit ${item.sha}: ${error.message}`);
      }
      commits.push({ sha: item.sha, author, files });
    }
    if (batch.length < 100) break;
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
