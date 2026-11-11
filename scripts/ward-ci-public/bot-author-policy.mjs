#!/usr/bin/env node
// PR policy: bot-authored sensitive changes (owner rule, 2026-10-18), plus a warn-only coding-agent tier.
//
// BOT tier (fails): a commit in the pull request AUTHORED by a bot account (any `[bot]` login or
// noreply address, or a known review/coding bot such as qodo) whose own files touch `supabase/**`,
// backend SQL (forward migrations and `infra/` rollbacks), the backend sign-in, engine and
// command-schema files, a clinical or legal-logic path, the CI workflows and public CI scripts, or
// the protected safety tests (scripts/ward-flow/protected-safety-tests.json and every file it lists).
// Such PRs would otherwise pass CI and could auto-merge with no human review. Dependabot edits
// dependency manifests and lockfiles, which do not match, and action pins in the workflows, which do:
// a Dependabot commit whose workflow changes are only `uses:` pin lines (checked from each file's
// patch) is exempt, so its security updates still merge. Any other workflow edit still fails.
//
// AGENT tier (warns only, A6-F02): commits authored by a coding agent (Claude `claude` /
// noreply@anthropic.com, Cursor `cursoragent`, Codex `codex` / `chatgpt-codex-connector`) that touch
// the same sensitive paths are reported as `::warning::` annotations and in the step summary, but do
// not fail the check. Agents author most Ward Flow commits and there is no separate approval
// identity yet, so failing them would block all work. This tier becomes a failure once agents commit
// under their own identity and an owner-review step exists to approve their sensitive changes.
//
// Human commits are never judged here.
//
// CI usage: .github/workflows/bot-author-policy.yml runs MAIN's copy of this script under
// pull_request_target (never PR code). GITHUB_TOKEN, GITHUB_REPOSITORY and WARD_PR_NUMBER are read from
// the environment. Missing or unreadable commit data fails closed for bot commits; for agent commits it
// is a warning.
import { appendFileSync, readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

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

function authorIdentity(author) {
  const login = String(author?.login ?? "")
    .trim()
    .toLowerCase();
  const email = String(author?.email ?? "")
    .trim()
    .toLowerCase();
  const emailLogin = email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/u)?.[1] ?? "";
  return { login, email, emailLogin };
}

export function isBotAuthor(author) {
  if (!author) return false;
  const { login, email, emailLogin } = authorIdentity(author);
  if (login.endsWith("[bot]") || knownBotLogins.has(login)) return true;
  if (/\[bot\]@users\.noreply\.github\.com$/u.test(email)) return true;
  return Boolean(emailLogin && knownBotLogins.has(emailLogin));
}

// Coding agents that author commits directly (warn tier). `[bot]` logins such as `cursor[bot]` or
// `chatgpt-codex-connector[bot]` stay in the bot tier above.
export const knownAgentLogins = new Set(["claude", "cursoragent", "codex", "chatgpt-codex-connector"]);
export const knownAgentEmails = new Set(["noreply@anthropic.com", "cursoragent@cursor.com"]);

/** A coding-agent author that is not already a bot (bots keep failing). */
export function isAgentAuthor(author) {
  if (!author || isBotAuthor(author)) return false;
  const { login, email, emailLogin } = authorIdentity(author);
  return knownAgentLogins.has(login) || knownAgentEmails.has(email) || knownAgentLogins.has(emailLogin);
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
  // CI itself: the workflows, the public CI scripts (this file included) and the protected-test list.
  /^\.github\/workflows\//u,
  /^scripts\/ward-ci-public\//u,
  /^scripts\/ward-flow\/protected-safety-tests\.json$/u,
];

const PROTECTED_SAFETY_TESTS_URL = new URL("../ward-flow/protected-safety-tests.json", import.meta.url);
let protectedSafetyTestPaths;

export const PROTECTED_SAFETY_TESTS_PATH = "scripts/ward-flow/protected-safety-tests.json";

/** Parse the protected-safety-tests list text and use it for isSensitivePath. Malformed text throws. */
export function loadProtectedSafetyTests(text) {
  const list = JSON.parse(text);
  if (!Array.isArray(list?.files)) throw new Error("protected-safety-tests.json has no files list");
  protectedSafetyTestPaths = new Set(list.files.map((entry) => normalizePath(entry?.path)).filter(Boolean));
  return protectedSafetyTestPaths;
}

/**
 * The test files listed in scripts/ward-flow/protected-safety-tests.json (D-123 item 3), read once
 * from this script's own checkout unless main() already loaded it from the PR base. An unreadable
 * or malformed list throws, so the check fails closed.
 */
export function protectedSafetyTests() {
  if (!protectedSafetyTestPaths) {
    loadProtectedSafetyTests(readFileSync(fileURLToPath(PROTECTED_SAFETY_TESTS_URL), "utf8"));
  }
  return protectedSafetyTestPaths;
}

// The CI job sparse-checks-out this script and the list from main; if the list is absent, it is read
// from the PR's base commit through the API (never PR code). Any failure throws (fails closed).
async function ensureProtectedSafetyTests({ repository, prNumber, token, api = "https://api.github.com" }) {
  try {
    protectedSafetyTests();
    return;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const pr = await githubJson(`${api}/repos/${repository}/pulls/${prNumber}`, token);
  const ref = pr.base?.sha;
  if (!ref) throw new Error("PR base is missing; cannot read the protected safety tests list");
  const content = await githubJson(
    `${api}/repos/${repository}/contents/${PROTECTED_SAFETY_TESTS_PATH}?ref=${ref}`,
    token,
  );
  if (content.encoding !== "base64" || typeof content.content !== "string" || !content.content) {
    throw new Error(`${PROTECTED_SAFETY_TESTS_PATH} at the PR base came back without base64 content`);
  }
  loadProtectedSafetyTests(Buffer.from(content.content, "base64").toString("utf8"));
}

function normalizePath(filePath) {
  return String(filePath ?? "")
    .trim()
    .replace(/\\/gu, "/")
    .replace(/^\.\//u, "");
}

export function isSensitivePath(filePath) {
  const file = normalizePath(filePath);
  if (!file) return false;
  return sensitivePathPatterns.some((pattern) => pattern.test(file)) || protectedSafetyTests().has(file);
}

export function isDependabotAuthor(author) {
  const { login, email } = authorIdentity(author);
  return login === "dependabot[bot]" || /^(?:\d+\+)?dependabot\[bot\]@users\.noreply\.github\.com$/u.test(email);
}

const ACTION_PIN_LINE = /^[+-]\s*(?:-\s+)?uses:\s*[\w.-]+\/[\w./-]+@[\w.-]+(?:\s+#.*)?$/u;

/**
 * True when a workflow file's patch only swaps action pins: every changed line is a `uses:` line,
 * with as many removed as added. A missing or empty patch (binary, too large) is not pin-only.
 */
export function isActionPinOnlyPatch(patch) {
  if (typeof patch !== "string" || !patch) return false;
  const changed = patch.split(/\r?\n/u).filter((line) => /^[+-]/u.test(line) && !/^(?:\+\+\+|---) /u.test(line));
  if (changed.length === 0) return false;
  const added = changed.filter((line) => line.startsWith("+")).length;
  return added * 2 === changed.length && changed.every((line) => ACTION_PIN_LINE.test(line));
}

// commits: [{ sha, author: { login, email }, files: [path, ...], actionPinOnlyFiles?: [path, ...] }]
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
    const pinOnly = isDependabotAuthor(commit.author) ? new Set(commit.actionPinOnlyFiles ?? []) : new Set();
    const sensitive = commit.files.filter(
      (file) => isSensitivePath(file) && !(pinOnly.has(file) && /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(file)),
    );
    if (sensitive.length > 0) {
      violations.push(
        `Bot-authored commit ${sha} (${who}) touches protected paths (${sensitive.slice(0, 5).join(", ")}${sensitive.length > 5 ? ", …" : ""}). Supabase, backend SQL and sign-in, engine, legal and clinical paths need a human-authored commit and owner review.`,
      );
    }
  }
  return violations;
}

// Same input shape as botSensitiveCommitViolations. Warnings only: agent commits never fail the check.
export function agentSensitiveCommitWarnings(commits) {
  const warnings = [];
  for (const commit of commits ?? []) {
    if (!isAgentAuthor(commit?.author)) continue;
    const who = commit.author.login || commit.author.email || "unknown agent";
    const sha = String(commit.sha ?? "").slice(0, 12) || "unknown";
    if (!Array.isArray(commit.files)) {
      warnings.push(`Agent-authored commit ${sha} (${who}) could not have its files verified; review it by hand.`);
      continue;
    }
    const sensitive = commit.files.filter(isSensitivePath);
    if (sensitive.length > 0) {
      warnings.push(
        `Agent-authored commit ${sha} (${who}) touches protected paths (${sensitive.slice(0, 5).join(", ")}${sensitive.length > 5 ? ", …" : ""}). Warning only until agents have their own identity and owner review; Josh should review these files.`,
      );
    }
  }
  return warnings;
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

/** Every file of a commit: `files` (paths, renames' old paths included) and the action-pin-only ones. */
export async function collectCommitFileDetails({ repository, sha, token, api = "https://api.github.com" }) {
  const files = [];
  const actionPinOnlyFiles = [];
  for (let page = 1; ; page += 1) {
    const detail = await githubJson(`${api}/repos/${repository}/commits/${sha}?per_page=100&page=${page}`, token);
    const batch = detail.files ?? [];
    files.push(...batch.flatMap((file) => [file.filename, file.previous_filename].filter(Boolean)));
    for (const file of batch) {
      if (file.status === "modified" && !file.previous_filename && isActionPinOnlyPatch(file.patch)) {
        actionPinOnlyFiles.push(file.filename);
      }
    }
    if (batch.length < 100) break;
    if (page * 100 >= MAX_COMMIT_FILES) throw new Error(`file list may be truncated at ${MAX_COMMIT_FILES}`);
  }
  return { files, actionPinOnlyFiles };
}

export async function collectCommitFiles(options) {
  return (await collectCommitFileDetails(options)).files;
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
    const bot = isBotAuthor(author);
    if (!bot && !isAgentAuthor(author)) continue;
    let details;
    try {
      details = await collectCommitFileDetails({ repository, sha: item.sha, token, api });
    } catch (error) {
      console.warn(`Unable to read files of ${bot ? "bot" : "agent"} commit ${item.sha}: ${error.message}`);
    }
    const commit = { sha: item.sha, author, files: details?.files };
    if (details && isDependabotAuthor(author)) commit.actionPinOnlyFiles = details.actionPinOnlyFiles;
    commits.push(commit);
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
  await ensureProtectedSafetyTests({ repository, prNumber, token });
  const commits = await collectPullRequestCommits({ repository, prNumber, token });
  const violations = botSensitiveCommitViolations(commits);
  const warnings = agentSensitiveCommitWarnings(commits);
  for (const warning of warnings) console.log(`::warning::${warning}`);
  writeStepSummary(violations, warnings);
  if (violations.length > 0) {
    for (const violation of violations) console.error(`::error::${violation}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `bot-author-policy: no bot-authored commits touch protected paths${warnings.length > 0 ? `; ${warnings.length} agent-authored commit warning(s)` : ""}.`,
  );
}

function writeStepSummary(violations, warnings) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile || (violations.length === 0 && warnings.length === 0)) return;
  const lines = ["## Bot-author policy", ""];
  if (violations.length > 0) lines.push("**Failures (bot-authored):**", ...violations.map((v) => `- ${v}`), "");
  if (warnings.length > 0)
    lines.push("**Warnings (agent-authored, not failing):**", ...warnings.map((w) => `- ${w}`), "");
  try {
    appendFileSync(summaryFile, `${lines.join("\n")}\n`);
  } catch (error) {
    console.warn(`bot-author-policy: could not write the step summary: ${error.message}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`bot-author-policy: ${error.message}; failing closed.`);
    process.exitCode = 1;
  });
}
