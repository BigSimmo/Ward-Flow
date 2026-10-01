#!/usr/bin/env node
/**
 * pre-commit-checks — fast checks on what is actually being committed.
 *
 * Called from `.githooks/pre-commit`. Three checks, all reading the STAGED
 * content (the index), never the working tree, so a partly staged file is
 * judged as it will be committed:
 *
 *   1. Secret and patient-identifier scan over the lines this commit ADDS.
 *      Blocks key files (.env, private keys), provider keys and tokens, and
 *      real-looking patient identifiers: checksum-valid Medicare numbers and
 *      IHIs anywhere outside test fixtures, and labelled URN/UMRN/MRN values
 *      that do not follow the synthetic `UM1nnnnn` convention.
 *   2. ESLint on staged JS/TS files, failing only on ERRORS that land on lines
 *      this commit adds or changes. Several Ward Flow files already carry lint
 *      errors; blocking on those would stop every commit that touches them.
 *   3. TypeScript on staged TS files only. A whole-project `tsc` takes one to
 *      five minutes here, so this builds a program rooted at the staged files
 *      (plus every .d.ts) and asks only for their diagnostics. It does NOT see
 *      a break in a file that imports the one you changed; the full
 *      `npm run typecheck` before folding still catches that.
 *
 * Worktrees: `core.hooksPath` is the relative `.githooks`, so each worktree
 * runs the hook and this script from its own branch. A branch older than this
 * file simply does not call it. Lint and typecheck skip with a notice when the
 * worktree has no node_modules; the scan needs only node and always runs.
 *
 * During a merge (MERGE_HEAD present) only the scan runs: a fold stages every
 * incoming change, and the fold procedure already runs the build and tests.
 *
 * Also: a clash guard. Staged files that another branch has signed out in the
 * shared sign-out file (D:/Repos/ward-flow-logs/sign-out.md,
 * "## Active sign-outs" lines `- date | who | branch | worktree | files`) block
 * the commit and name the owner. Missing file = no check.
 *
 * Escapes, in order of preference:
 *   - a line containing `precommit-scan: allow` is skipped by the scan
 *     (for a deliberate synthetic identifier or a documented fake key);
 *   - SKIP_PRECOMMIT_LINT=1 / SKIP_PRECOMMIT_TYPECHECK=1 / SKIP_SIGNOUT_GUARD=1 skip one check;
 *   - `git commit --no-verify` skips every hook.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LINT_EXTENSIONS = /\.(?:[cm]?[jt]sx?)$/i;
const TYPECHECK_EXTENSIONS = /\.(?:[cm]?tsx?)$/i;
const MAX_FILES_FOR_CODE_CHECKS = 200;
const ALLOW_MARKER = "precommit-scan: allow";

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

const SIGN_OUT_FILE = process.env.WARD_SIGNOUT_FILE ?? "D:/Repos/ward-flow-logs/sign-out.md";

/** Read both the headed legacy log and the current rebuilt, headingless active log. */
export function activeSignOutLines(signOutText) {
  const start = signOutText.indexOf("## Active sign-outs");
  if (start < 0) return /^Open sign-outs only\b/m.test(signOutText) ? signOutText : "";
  const end = signOutText.indexOf("\n## ", start + 1);
  return signOutText.slice(start, end < 0 ? undefined : end);
}

const normalizedFolder = (value) => value.trim().replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

// Kept self-contained because tests copy this script alone into fixture repositories.
// tests/public-signout-boundary.test.ts asserts both stay identical to guard-push.mjs.
export const WARD_FLOW_IDENTITY_ANCHOR = "e735c1f8d34df005becf720b96752626a4f1dcc8";

/** Canonical HTTPS, scp-style and ssh:// Ward-Flow URLs, matching the push guard. */
export function isCanonicalWardFlowRemote(remoteUrl) {
  return (
    typeof remoteUrl === "string" &&
    /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)BigSimmo\/Ward-Flow(?:\.git)?$/i.test(
      remoteUrl,
    )
  );
}

const repositoryIdentityCache = new Map();
let repositoryProbeEnvironment;

// Hooks export Git-local variables. Clear them only for cross-checkout identity
// probes so `git -C` reads the target repository rather than the invoking index.
function checkoutProbeEnvironment() {
  if (repositoryProbeEnvironment) return repositoryProbeEnvironment;
  const env = { ...process.env };
  const localVariables = execFileSync("git", ["rev-parse", "--local-env-vars"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
    .trim()
    .split(/\r?\n/);
  for (const name of localVariables) delete env[name];
  repositoryProbeEnvironment = env;
  return env;
}

function releasedBranches(line) {
  return (line.split("|")[2] ?? "")
    .split(",")
    .map((branch) => branch.trim().split(/\s+/)[0])
    .filter(Boolean);
}

/** Verify the checkout itself, regardless of which drive or host contains its worktree. */
export function isPublicWardFlowCheckout(worktree) {
  if (!worktree) return false;
  const folder = normalizedFolder(worktree);
  if (repositoryIdentityCache.has(folder)) return repositoryIdentityCache.get(folder);
  let verified = false;
  try {
    const env = checkoutProbeEnvironment();
    const run = (...args) =>
      execFileSync("git", ["-C", worktree, ...args], {
        encoding: "utf8",
        env,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    verified =
      normalizedFolder(run("rev-parse", "--show-toplevel")) === folder &&
      isCanonicalWardFlowRemote(run("remote", "get-url", "origin")) &&
      isCanonicalWardFlowRemote(run("remote", "get-url", "--push", "origin"));
    // A common base proves nothing: a repointed Database clone shares history with itself.
    // HEAD and origin/main must both descend from the verified public Ward-Flow main;
    // `merge-base --is-ancestor` exits non-zero otherwise, which run() turns into a throw.
    if (verified) {
      run("merge-base", "--is-ancestor", WARD_FLOW_IDENTITY_ANCHOR, "HEAD");
      run("merge-base", "--is-ancestor", WARD_FLOW_IDENTITY_ANCHOR, "refs/remotes/origin/main");
    }
  } catch {
    // A missing checkout, an unverified remote or foreign history never identifies a public claim.
    verified = false;
  }
  repositoryIdentityCache.set(folder, verified);
  return verified;
}

/** Scope both claims and releases before parsing either, so old releases cannot close public claims. */
export function scopedActiveSignOutLines(signOutText, currentWorktree = "") {
  const publicCheckout = isPublicWardFlowCheckout(currentWorktree);
  const branches = new Map();
  const result = [];
  for (const line of activeSignOutLines(signOutText).split(/\r?\n/)) {
    if (line.startsWith("- ")) {
      const fields = line
        .slice(2)
        .split("|")
        .map((field) => field.trim());
      const branch = fields[2]?.split(/\s+/)[0];
      const isPublic = /\brepo=BigSimmo\/Ward-Flow\b/i.test(line) || isPublicWardFlowCheckout(fields[3] ?? "");
      if (branch) {
        const scopes = branches.get(branch) ?? new Set();
        scopes.add(isPublic ? "public" : "legacy");
        branches.set(branch, scopes);
      }
      if (isPublic === publicCheckout) result.push(line);
      continue;
    }
    if (line.startsWith("RELEASED ")) {
      const scopes = new Set(releasedBranches(line).flatMap((branch) => [...(branches.get(branch) ?? [])]));
      // Older unscoped releases belong to a sole known scope. An ambiguous one
      // closes only the legacy claim; new public releases must name their repo.
      const isPublic = /\brepo=BigSimmo\/Ward-Flow\b/i.test(line) || (scopes?.size === 1 && scopes.has("public"));
      if (isPublic === publicCheckout) result.push(line);
    }
  }
  return result.join("\n");
}

function signOutEntries(signOutText) {
  const entries = [];
  for (const line of signOutText.split(/\r?\n/)) {
    if (line.startsWith("RELEASED ")) {
      for (const branch of releasedBranches(line)) {
        for (let index = entries.length - 1; index >= 0; index -= 1) {
          if (entries[index].branch === branch) entries.splice(index, 1);
        }
      }
      continue;
    }
    if (!line.startsWith("- ")) continue;
    const fields = line
      .slice(2)
      .split("|")
      .map((field) => field.trim());
    if (fields.length < 5) continue;
    const [, owner, branchField, worktree] = fields;
    const branch = branchField.split(/\s+/)[0];
    if (!branch) continue;
    const legacyScopedApproval = /Josh approved scoped (?:overlap|takeover) in this chat/i.test(owner);
    const pathFields = fields
      .slice(4)
      .join("|")
      .split(/[,;]\s*/);
    const paths = [];
    const takeoverPaths = [];
    for (const raw of pathFields) {
      const file = raw
        .replace(/\s*\(.*$/, "")
        .replace(/^outside git:\s*/i, "")
        .trim()
        .replace(/^(\S+\.[A-Za-z0-9]+)\.\s+.*$/, "$1");
      if (
        !(file.includes("/") || /^[\w.-]+\.[A-Za-z0-9]+$/.test(file)) ||
        /^[A-Za-z]:[\\/]/.test(file) ||
        /\s/.test(file)
      )
        continue;
      paths.push(file);
      // A takeover must name an exact file and the user's approval, not a directory.
      if (
        !file.endsWith("/") &&
        !file.endsWith("/**") &&
        (legacyScopedApproval || /\(approved takeover by Josh: [^)]+\)/i.test(raw))
      ) {
        takeoverPaths.push(file);
      }
    }
    entries.push({ owner, branch, worktree, paths, takeoverPaths });
  }
  return entries;
}

function signOutEntriesForCheckout(signOutText, currentWorktree) {
  return signOutEntries(scopedActiveSignOutLines(signOutText, currentWorktree));
}

function coversFile(paths, file) {
  return paths.some((entry) => {
    const folder = entry.replace(/\/\*\*$/, "/");
    return folder.endsWith("/") ? file.startsWith(folder) : file === entry;
  });
}

function isOwnSignOut(entry, currentBranch, currentWorktree) {
  return (
    entry.branch === currentBranch ||
    (currentWorktree && entry.worktree && normalizedFolder(entry.worktree) === normalizedFolder(currentWorktree))
  );
}

/** Staged files signed out by another branch. A trailing "/" or "/**" signs out a folder. */
export function approvedTakeoverFiles(signOutText, currentBranch, currentWorktree = "") {
  return new Set(
    signOutEntriesForCheckout(signOutText, currentWorktree)
      .filter((entry) => isOwnSignOut(entry, currentBranch, currentWorktree))
      .flatMap((entry) => entry.takeoverPaths),
  );
}

export function signOutConflicts(staged, signOutText, currentBranch, currentWorktree = "") {
  const conflicts = [];
  const entries = signOutEntriesForCheckout(signOutText, currentWorktree);
  const approved = approvedTakeoverFiles(signOutText, currentBranch, currentWorktree);
  for (const entry of entries) {
    if (isOwnSignOut(entry, currentBranch, currentWorktree)) continue;
    for (const file of staged) {
      if (coversFile(entry.paths, file) && !approved.has(file)) {
        conflicts.push({ file, owner: entry.owner, branch: entry.branch });
      }
    }
  }
  return conflicts;
}

const WARD_SIGNOUT_PATH =
  /^(?:src\/components\/ward-management\/|src\/app\/mockups\/ward-flow\/|docs\/ward-flow\/|scripts\/ward-flow\/|scripts\/run-ward-tests\.mjs$|tests\/(?:helpers\/|ui-)?ward-[^/]+$)/;

/** Ward files staged without an active sign-out owned by this branch or worktree. */
export function unsignedWardFiles(staged, signOutText, currentBranch, currentWorktree = "") {
  const owned = signOutEntriesForCheckout(signOutText, currentWorktree).filter((entry) =>
    isOwnSignOut(entry, currentBranch, currentWorktree),
  );
  const publicCheckout = isPublicWardFlowCheckout(currentWorktree);
  return staged.filter(
    (file) => (publicCheckout || WARD_SIGNOUT_PATH.test(file)) && !owned.some((entry) => coversFile(entry.paths, file)),
  );
}

/** Parse `git diff --cached -U0` output into { file -> [{ line, text }] } of added lines. */
export function parseAddedLines(diffText) {
  const byFile = new Map();
  let current = null;
  let inHeader = false;
  let nextLine = 0;
  for (const raw of diffText.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      current = null;
      inHeader = true;
      continue;
    }
    if (inHeader) {
      if (raw.startsWith("+++ ")) {
        const target = raw.slice(4).trim();
        current = target === "/dev/null" ? null : target.replace(/^b\//, "");
        if (current && !byFile.has(current)) byFile.set(current, []);
        continue;
      }
      if (!raw.startsWith("@@")) continue;
      inHeader = false;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      nextLine = Number(hunk[1]);
      continue;
    }
    if (current && raw.startsWith("+")) {
      byFile.get(current).push({ line: nextLine, text: raw.slice(1).replace(/\r$/, "") });
      nextLine += 1;
    }
  }
  return byFile;
}

/** Australian Medicare card number: 10 digits, first 2-6, weighted check digit at position 9. */
export function isValidMedicare(digits) {
  if (!/^[2-6]\d{9}$/.test(digits)) return false;
  const weights = [1, 3, 7, 9, 1, 3, 7, 9];
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  return sum % 10 === Number(digits[8]);
}

export function isLuhnValid(digits) {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Individual Healthcare Identifier: 16 digits, prefix 800360, Luhn valid. */
export function isValidIhi(digits) {
  return /^800360\d{10}$/.test(digits) && isLuhnValid(digits);
}

/** Paths where synthetic identifiers and fake credentials are expected. */
export function isFixturePath(file) {
  return (
    /^tests\//.test(file) ||
    /(^|\/)(__fixtures__|fixtures?|__mocks__)\//.test(file) ||
    /(^|\/)[^/]*(fixture|\.test\.|\.spec\.)[^/]*$/i.test(file) ||
    /^src\/lib\/demo-data/.test(file) ||
    /^public\/demo-documents\//.test(file)
  );
}

const SECRET_FILE_RULES = [
  {
    test: (base) => /^\.env(\..+)?$/i.test(base) && !/\.(example|sample|template)$/i.test(base),
    why: "environment file (.env)",
  },
  { test: (base) => /\.(pem|p12|pfx|keystore|jks)$/i.test(base), why: "key or certificate file" },
  { test: (base) => /^id_(rsa|dsa|ecdsa|ed25519)$/i.test(base), why: "SSH private key" },
  { test: (base) => /^\.npmrc$/i.test(base), why: ".npmrc (can hold registry tokens)", contentOnly: /_authToken\s*=/ },
];

const SECRET_CONTENT_RULES = [
  { re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/, why: "private key block" },
  { re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, why: "AWS access key" },
  { re: /\bsk-ant-[A-Za-z0-9_-]{20,}/, why: "Anthropic API key" },
  { re: /\bsk-(?!ant-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/, why: "OpenAI API key" },
  { re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{50,}/, why: "GitHub token" },
  { re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/, why: "Slack token" },
  { re: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}/, why: "Stripe live key" },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/, why: "Google API key" },
  { re: /\bsb_secret_[A-Za-z0-9_-]{20,}/, why: "Supabase secret key" },
  {
    re: /\bpostgres(?:ql)?:\/\/[^:\s/@]+:([^@\s]{6,})@([^/:\s]+)/,
    why: "database URL with a password",
    accept: (match) => {
      const password = match[1];
      const host = match[2].toLowerCase();
      if (["localhost", "127.0.0.1", "0.0.0.0", "host.docker.internal", "db", "postgres"].includes(host)) return true;
      return isPlaceholderValue(password);
    },
  },
];

const JWT_RE = /\beyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;
const GENERIC_SECRET_RE =
  /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|service[_-]?role[_-]?key)\b["']?\s*[:=]\s*["'`]([^"'`\s]{12,})["'`]/i;

export function isPlaceholderValue(value) {
  const lower = value.toLowerCase();
  if (
    /(example|placeholder|changeme|change-me|dummy|fake|sample|redacted|your[_-]|<|\$\{|process\.env|xxxx|\*\*\*\*|test|mock|local|dev)/.test(
      lower,
    )
  ) {
    return true;
  }
  return /^(.)\1+$/.test(value);
}

function jwtRole(payloadSegment) {
  try {
    const json = Buffer.from(payloadSegment.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json).role ?? null;
  } catch {
    return null;
  }
}

const MEDICARE_FORMATTED_RE = /(?<![\d-])([2-6]\d{3})[ -]?(\d{5})[ -]?(\d)(?:[ -]?(\d))?(?![\d-])/g;
const IHI_RE = /(?<!\d)(8003\s?60\d{2}\s?\d{4}\s?\d{4})(?!\d)/g;
const LABELLED_URN_RE = /\b(?:UMRN|URN|MRN)\b["']?\s*(?:[:=#]|no\.?|number)?\s*["'`]?([A-Z]{0,3}\d{5,10})\b/gi;
const SYNTHETIC_URN_RE = /^(?:UM1\d{5}|(?:TEST|SYN|DEMO|FAKE|X+)\w*)$/i;

/**
 * Scan added lines. Returns [{ file, line, why }]. `fileNames` covers files
 * staged with no added text lines (a new empty .env still counts).
 */
export function scanAddedLines(addedByFile, fileNames = [...addedByFile.keys()]) {
  const findings = [];
  for (const file of fileNames) {
    const base = path.posix.basename(file);
    const lines = addedByFile.get(file) ?? [];
    for (const rule of SECRET_FILE_RULES) {
      if (!rule.test(base)) continue;
      if (rule.contentOnly && !lines.some(({ text }) => rule.contentOnly.test(text))) continue;
      findings.push({ file, line: 0, why: rule.why });
    }
    const fixture = isFixturePath(file);
    for (const { line, text } of lines) {
      if (text.includes(ALLOW_MARKER)) continue;
      for (const rule of SECRET_CONTENT_RULES) {
        const match = rule.re.exec(text);
        if (match && !(rule.accept && rule.accept(match))) findings.push({ file, line, why: rule.why });
      }
      for (const match of text.matchAll(JWT_RE)) {
        const role = jwtRole(match[1]);
        if (role === "service_role" || role === "supabase_admin") {
          findings.push({ file, line, why: `Supabase ${role} JWT` });
        }
      }
      if (!fixture) {
        const generic = GENERIC_SECRET_RE.exec(text);
        if (generic && !isPlaceholderValue(generic[1])) {
          findings.push({ file, line, why: "hard-coded password, secret or token" });
        }
        for (const match of text.matchAll(MEDICARE_FORMATTED_RE)) {
          const digits = match[1] + match[2] + match[3];
          const spaced = /[ -]/.test(match[0]);
          // A bare 10-digit run is only suspicious beside the word Medicare.
          if ((spaced || /medicare/i.test(text)) && isValidMedicare(digits)) {
            findings.push({ file, line, why: "checksum-valid Medicare number (real-looking patient identifier)" });
          }
        }
        for (const match of text.matchAll(IHI_RE)) {
          if (isValidIhi(match[1].replace(/\s/g, ""))) {
            findings.push({ file, line, why: "checksum-valid IHI (real-looking patient identifier)" });
          }
        }
        for (const match of text.matchAll(LABELLED_URN_RE)) {
          if (!SYNTHETIC_URN_RE.test(match[1])) {
            findings.push({
              file,
              line,
              why: `URN/UMRN "${match[1]}" is not in the synthetic UM1nnnnn format (real-looking patient identifier)`,
            });
          }
        }
      }
    }
  }
  return findings;
}

/** Changed-line numbers per file, from the added-lines map. */
export function changedLineSets(addedByFile) {
  const sets = new Map();
  for (const [file, lines] of addedByFile) sets.set(file, new Set(lines.map(({ line }) => line)));
  return sets;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function git(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options });
}

function stagedContent(file) {
  return git(["show", `:${file}`]);
}

function elapsed(start) {
  return `${((Date.now() - start) / 1000).toFixed(1)}s`;
}

function resolveFrom(root, name) {
  try {
    return createRequire(path.join(root, "package.json")).resolve(name);
  } catch {
    return null;
  }
}

async function runLint(root, files, changed) {
  const eslintEntry = resolveFrom(root, "eslint");
  if (!eslintEntry) return { skipped: "eslint is not installed in this worktree" };
  const { ESLint } = await import(pathToFileURL(eslintEntry).href);
  const eslint = new ESLint({ cwd: root });
  const problems = [];
  let warnings = 0;
  for (const file of files) {
    const absolute = path.join(root, file);
    if (await eslint.isPathIgnored(absolute)) continue;
    const [result] = await eslint.lintText(stagedContent(file), { filePath: absolute, warnIgnored: false });
    if (!result) continue;
    const lines = changed.get(file) ?? new Set();
    for (const message of result.messages) {
      const onChangedLine = message.fatal || lines.has(message.line);
      if (!onChangedLine) continue;
      if (message.severity === 2)
        problems.push(
          `${file}:${message.line}:${message.column ?? 0}  ${message.message}  (${message.ruleId ?? "parse"})`,
        );
      else warnings += 1;
    }
  }
  return { problems, warnings };
}

function runTypecheck(root, files) {
  const tsEntry = resolveFrom(root, "typescript");
  if (!tsEntry) return { skipped: "typescript is not installed in this worktree" };
  const require = createRequire(path.join(root, "package.json"));
  const ts = require(tsEntry);
  const configPath = ["tsconfig.typecheck.json", "tsconfig.json"].map((name) => path.join(root, name)).find(existsSync);
  if (!configPath) return { skipped: "no tsconfig found" };

  const key = (file) => {
    const normal = path.resolve(file);
    return process.platform === "win32" ? normal.toLowerCase() : normal;
  };
  const staged = new Map(files.map((file) => [key(path.join(root, file)), file]));
  const stagedText = new Map();
  const readStaged = (absolute) => {
    const file = staged.get(key(absolute));
    if (!file) return undefined;
    if (!stagedText.has(file)) stagedText.set(file, stagedContent(file));
    return stagedText.get(file);
  };

  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => {},
    },
  );
  if (!parsed) return { skipped: "tsconfig could not be parsed" };
  const inProject = new Set(parsed.fileNames.map(key));
  const roots = files.map((file) => path.join(root, file)).filter((absolute) => inProject.has(key(absolute)));
  if (roots.length === 0) return { problems: [] };
  // Global type declarations, plus the test setup files: they import
  // "@testing-library/jest-dom/vitest", which adds toBeInTheDocument and the other DOM matchers
  // to vitest's expect. Without them every DOM test is falsely refused. Only the staged files
  // are diagnosed.
  const declarations = parsed.fileNames.filter(
    (name) => name.endsWith(".d.ts") || /[\\/]tests[\\/]setup[\\/][^\\/]+\.tsx?$/i.test(name),
  );

  const options = { ...parsed.options, noEmit: true, incremental: false, composite: false, tsBuildInfoFile: undefined };
  const host = ts.createCompilerHost(options, true);
  const baseGetSourceFile = host.getSourceFile.bind(host);
  const baseReadFile = host.readFile.bind(host);
  const baseFileExists = host.fileExists.bind(host);
  host.readFile = (name) => readStaged(name) ?? baseReadFile(name);
  host.fileExists = (name) => staged.has(key(name)) || baseFileExists(name);
  host.getSourceFile = (name, languageVersion, onError, shouldCreate) => {
    const text = readStaged(name);
    if (text === undefined) return baseGetSourceFile(name, languageVersion, onError, shouldCreate);
    return ts.createSourceFile(name, text, languageVersion, true);
  };

  const program = ts.createProgram({ rootNames: [...roots, ...declarations], options, host });
  const diagnostics = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()];
  for (const absolute of roots) {
    const sourceFile = program.getSourceFile(absolute);
    if (!sourceFile) continue;
    diagnostics.push(...program.getSyntacticDiagnostics(sourceFile), ...program.getSemanticDiagnostics(sourceFile));
  }
  const problems = diagnostics
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .map((diagnostic) => {
      const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      if (!diagnostic.file) return `TS${diagnostic.code}: ${text}`;
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
      const relative = path.relative(root, diagnostic.file.fileName).split(path.sep).join("/");
      return `${relative}:${line + 1}:${character + 1}  TS${diagnostic.code}: ${text}`;
    });
  return { problems };
}

const TYPECHECK_CHILD_FLAG = "--typecheck-child";

/** Run runTypecheck in a separate node process so it overlaps with lint. */
function typecheckInChild(files) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), TYPECHECK_CHILD_FLAG], {
      stdio: ["pipe", "pipe", "inherit"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      try {
        resolve(JSON.parse(output));
      } catch {
        reject(new Error(`typecheck child exited ${code} without a result`));
      }
    });
    child.stdin.end(JSON.stringify(files));
  });
}

async function typecheckChildMain() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const root = git(["rev-parse", "--show-toplevel"]).trim();
  process.stdout.write(JSON.stringify(runTypecheck(root, JSON.parse(input))));
  return 0;
}

async function main() {
  if (process.argv.includes(TYPECHECK_CHILD_FLAG)) return typecheckChildMain();
  const started = Date.now();
  const root = git(["rev-parse", "--show-toplevel"]).trim();
  process.chdir(root);
  const staged = git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"]).split("\0").filter(Boolean);
  if (staged.length === 0) return 0;

  let failed = false;
  const report = [];

  // 1. Secret and patient-identifier scan.
  const scanStart = Date.now();
  const diff = git([
    "diff",
    "--cached",
    "-U0",
    "--no-color",
    "--no-ext-diff",
    "--diff-filter=ACMR",
    "--src-prefix=a/",
    "--dst-prefix=b/",
  ]);
  const added = parseAddedLines(diff);
  const findings = scanAddedLines(added, staged);
  report.push(`scan ${elapsed(scanStart)}`);
  if (findings.length > 0) {
    failed = true;
    console.error("[pre-commit] BLOCKED: possible secret or real patient identifier in staged changes:");
    for (const { file, line, why } of findings) console.error(`  ${file}${line ? `:${line}` : ""}  ${why}`);
    console.error(`  Remove it (use made-up data), or if it is deliberately fake add "${ALLOW_MARKER}" on that line.`);
  }

  const merging = existsSync(git(["rev-parse", "--git-path", "MERGE_HEAD"]).trim());

  // 1b. Ward ownership guard. Not during a fold's merge.
  if (!merging && process.env.SKIP_SIGNOUT_GUARD !== "1") {
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
    const signOutText = existsSync(SIGN_OUT_FILE) ? readFileSync(SIGN_OUT_FILE, "utf8") : "";
    const clashes = signOutConflicts(staged, signOutText, branch, root);
    const taskBranch = isPublicWardFlowCheckout(root)
      ? branch !== "main" && branch !== "HEAD"
      : branch.startsWith("ward/");
    const unsigned = taskBranch ? unsignedWardFiles(staged, signOutText, branch, root) : [];
    if (clashes.length > 0) {
      failed = true;
      console.error(`[pre-commit] BLOCKED: files signed out by another session in ${SIGN_OUT_FILE}:`);
      for (const { file, owner, branch: theirs } of clashes) console.error(`  ${file}  (${owner}, ${theirs})`);
      console.error(
        "  Ask the coordinator before editing these. A Josh-approved scoped takeover must name each exact file in your sign-out.",
      );
    }
    if (unsigned.length > 0) {
      failed = true;
      console.error(`[pre-commit] BLOCKED: Ward files without your sign-out in ${SIGN_OUT_FILE}:`);
      for (const file of unsigned) console.error(`  ${file}`);
      console.error("  Run sign-out-check before editing, then sign out these files in the shared log.");
    }
  }
  // Admission has already rejected this staged snapshot. Keep every scan/ownership diagnostic,
  // but do not load lint plugins or start a TypeScript child for a commit that cannot proceed.
  if (failed) {
    report.push("lint and typecheck not run (secret or ownership check blocked this commit)");
    console.error(`[pre-commit] FAILED: ${report.join("; ")}; total ${elapsed(started)}`);
    return 1;
  }
  const lintFiles = staged.filter((file) => LINT_EXTENSIONS.test(file));
  const typeFiles = staged.filter((file) => TYPECHECK_EXTENSIONS.test(file) && !file.endsWith(".d.ts"));
  const tooMany = lintFiles.length > MAX_FILES_FOR_CODE_CHECKS;

  if (merging) {
    report.push("lint and typecheck skipped during a merge (run the fold's build and tests)");
  } else if (tooMany) {
    report.push(
      `lint and typecheck skipped: ${lintFiles.length} code files staged (over ${MAX_FILES_FOR_CODE_CHECKS}); run npm run lint and npm run typecheck`,
    );
  } else {
    // 2 and 3 run side by side: typecheck in a child process while lint runs
    // here. Each takes roughly 10 to 20 seconds on this machine.
    const typeStart = Date.now();
    const typesPending =
      typeFiles.length > 0 && process.env.SKIP_PRECOMMIT_TYPECHECK !== "1" ? typecheckInChild(typeFiles) : null;

    // 2. Lint, errors on changed lines only.
    if (lintFiles.length > 0 && process.env.SKIP_PRECOMMIT_LINT !== "1") {
      const lintStart = Date.now();
      const lint = await runLint(root, lintFiles, changedLineSets(added));
      if (lint.skipped) report.push(`lint skipped (${lint.skipped})`);
      else {
        report.push(
          `lint ${lintFiles.length} file(s) ${elapsed(lintStart)}${lint.warnings ? `, ${lint.warnings} warning(s) on changed lines` : ""}`,
        );
        if (lint.problems.length > 0) {
          failed = true;
          console.error("[pre-commit] BLOCKED: lint errors on lines you changed:");
          for (const problem of lint.problems) console.error(`  ${problem}`);
        }
      }
    }
    // 3. Typecheck the staged TypeScript files.
    if (typesPending) {
      const types = await typesPending;
      if (types.skipped) report.push(`typecheck skipped (${types.skipped})`);
      else {
        report.push(`typecheck ${typeFiles.length} file(s) ${elapsed(typeStart)}`);
        if (types.problems.length > 0) {
          failed = true;
          console.error("[pre-commit] BLOCKED: type errors in staged files:");
          for (const problem of types.problems.slice(0, 40)) console.error(`  ${problem}`);
          if (types.problems.length > 40) console.error(`  ...and ${types.problems.length - 40} more`);
        }
      }
    }
  }

  console.error(`[pre-commit] ${failed ? "FAILED" : "ok"}: ${report.join("; ")}; total ${elapsed(started)}`);
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`[pre-commit] checks crashed: ${error?.stack ?? error}`);
      console.error("[pre-commit] Fix the checker, or commit with --no-verify and say so.");
      process.exit(1);
    },
  );
}
