import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  approvedTakeoverFiles,
  isLuhnValid,
  isValidIhi,
  isValidMedicare,
  parseAddedLines,
  scanAddedLines,
  signOutConflicts,
  signOutLogOptional,
  unsignedWardFiles,
  stagedPathsFromStatus,
  ownershipAdmission,
  partitionMergeOwnership,
  filterAdmissionMergePaths,
  WARD_FLOW_IDENTITY_ANCHOR,
} from "../scripts/pre-commit-checks.mjs";
import { HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY } from "./helpers/ward-flow-history";

const verifiedCheckouts: string[] = [];
afterAll(() => {
  for (const root of verifiedCheckouts.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/**
 * A synthetic checkout that the real isPublicWardFlowCheckout() verifies. It has the canonical origin
 * URL (never contacted) and a HEAD and origin/main whose parent is the identity anchor, borrowed from
 * this checkout's objects. The identity check ignores replace refs, so the real anchor object is needed
 * and callers skip without full history. The identity check itself is covered in
 * public-signout-boundary.test.ts.
 */
function verifiedWardFlowCheckout(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "precommit-verified-")));
  verifiedCheckouts.push(root);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: "Pre-commit Test",
    GIT_AUTHOR_EMAIL: "pre-commit-test@example.invalid",
    GIT_COMMITTER_NAME: "Pre-commit Test",
    GIT_COMMITTER_EMAIL: "pre-commit-test@example.invalid",
  };
  // A hook-exported GIT_DIR or GIT_INDEX_FILE must not redirect fixture writes into the real checkout.
  for (const name of execFileSync("git", ["rev-parse", "--local-env-vars"], { encoding: "utf8" }).split(/\r?\n/))
    if (name) delete env[name];
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "commit.gpgsign=false", "-C", root, ...args], {
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "--quiet", "--initial-branch=ward/probe");
  git("remote", "add", "origin", "https://github.com/BigSimmo/Ward-Flow");
  const objects = join(
    execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8", env }).trim(),
    "objects",
  );
  mkdirSync(join(root, ".git", "objects", "info"), { recursive: true });
  writeFileSync(join(root, ".git", "objects", "info", "alternates"), `${objects}\n`);
  const tree = git("hash-object", "-t", "tree", "-w", "--stdin");
  const head = git("commit-tree", tree, "-p", WARD_FLOW_IDENTITY_ANCHOR, "-m", "synthetic Ward Flow head");
  git("update-ref", "refs/heads/ward/probe", head);
  git("update-ref", "refs/remotes/origin/main", head);
  return root;
}

describe("signOutConflicts (clash guard)", () => {
  const signOut = [
    "# Ward Flow file sign-out",
    "## Active sign-outs",
    "- 2026-09-25 | Thread X | ward/x | D:/w/x | src/components/ward-management/, tests/a.test.ts (new), AGENTS.md (one block), outside git: logs/notes.md",
    "- 2026-09-25 | Thread Y | ward/y | D:/w/y | docs/ward-flow/**",
    "## Copied from the old file",
    "- 2026-09-25 | Old | ward/old | D:/w/o | tests/b.test.ts",
  ].join("\n");

  it("retains the last file before pipe metadata without requiring a trailing comma", (ctx) => {
    ctx.skip(!HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY);
    const file = "docs/ward-flow/last.md";
    const line = (branch: string) =>
      `Open sign-outs only\n- 2026-10-17 | Synthetic owner | ${branch} | | ${file} | repo=BigSimmo/Ward-Flow\n`;
    const checkout = verifiedWardFlowCheckout();
    expect(signOutConflicts([file], line("ward/peer"), "ward/mine", checkout)).toHaveLength(1);
    expect(unsignedWardFiles([file], line("ward/mine"), "ward/mine", checkout)).toEqual([]);
  });

  it("flags files, folders and bare file names signed out by another branch, naming the owner", () => {
    const hits = signOutConflicts(
      ["src/components/ward-management/a.tsx", "tests/a.test.ts", "AGENTS.md", "docs/ward-flow/x.md", "src/other.ts"],
      signOut,
      "ward/z",
    );
    expect(hits).toEqual([
      { file: "src/components/ward-management/a.tsx", owner: "Thread X", branch: "ward/x" },
      { file: "tests/a.test.ts", owner: "Thread X", branch: "ward/x" },
      { file: "AGENTS.md", owner: "Thread X", branch: "ward/x" },
      { file: "docs/ward-flow/x.md", owner: "Thread Y", branch: "ward/y" },
    ]);
  });

  it("ignores the committer's own sign-outs and anything outside the active section", () => {
    expect(signOutConflicts(["tests/a.test.ts", "tests/b.test.ts"], signOut, "ward/x")).toEqual([]);
    expect(signOutConflicts(["tests/a.test.ts"], "no sections here", "ward/z")).toEqual([]);
  });

  it("treats an entry from the same worktree folder as the committer's own, even after a branch rename", () => {
    expect(signOutConflicts(["tests/a.test.ts"], signOut, "ward/renamed", "D:\\w\\x\\")).toEqual([]);
    expect(signOutConflicts(["tests/a.test.ts"], signOut, "ward/renamed", "D:/w/other")).toHaveLength(1);
  });

  it("detects conflicts in the rebuilt headingless active log", () => {
    const rebuilt = [
      "REBUILT 26 Sept from transcripts",
      "Open sign-outs only, rebuilt from notes.",
      "- 2026-09-27 | Thread X | ward/x | D:/w/x | .githooks/pre-commit",
    ].join("\n");
    expect(signOutConflicts([".githooks/pre-commit"], rebuilt, "ward/z", "D:/w/z")).toEqual([
      { file: ".githooks/pre-commit", owner: "Thread X", branch: "ward/x" },
    ]);
  });

  it("accepts a Josh-approved takeover only for the exact signed-out file", () => {
    const log = [
      "Open sign-outs only",
      "- 2026-09-27 | Other | ward/other | D:/w/other | AGENTS.md, docs/ward-flow/README.md, docs/ward-flow/**",
      "- 2026-09-27 | Me | ward/mine | D:/w/mine | AGENTS.md (approved takeover by Josh: sign-out rule), docs/ward-flow/README.md, docs/ward-flow/** (approved takeover by Josh: docs)",
    ].join("\n");
    expect([...approvedTakeoverFiles(log, "ward/mine", "D:/w/mine")]).toEqual(["AGENTS.md"]);
    expect(
      signOutConflicts(
        ["AGENTS.md", "docs/ward-flow/README.md", "docs/ward-flow/other.md"],
        log,
        "ward/mine",
        "D:/w/mine",
      ),
    ).toEqual([
      { file: "docs/ward-flow/README.md", owner: "Other", branch: "ward/other" },
      { file: "docs/ward-flow/other.md", owner: "Other", branch: "ward/other" },
    ]);
    expect(signOutConflicts(["AGENTS.md"], log, "ward/unapproved", "D:/w/unapproved")).toEqual([
      { file: "AGENTS.md", owner: "Other", branch: "ward/other" },
      { file: "AGENTS.md", owner: "Me", branch: "ward/mine" },
    ]);
  });

  it("closes earlier claims on an append-only RELEASED line but respects a later claim", () => {
    const log = [
      "Open sign-outs only",
      "- 2026-09-27 | Other | ward/other | D:/w/other | AGENTS.md",
      "RELEASED 2026-09-27 | Other | ward/other | Folded into the ward line",
    ].join("\n");
    expect(signOutConflicts(["AGENTS.md"], log, "ward/mine")).toEqual([]);
    expect(
      signOutConflicts(
        ["AGENTS.md"],
        `${log}\n- 2026-09-27 | Other | ward/other | D:/w/other | AGENTS.md`,
        "ward/mine",
      ),
    ).toHaveLength(1);
  });

  it("reuses a scoped approval already recorded in an older owner description", () => {
    const log = [
      "Open sign-outs only",
      "- 2026-09-27 | Other | ward/other | D:/w/other | AGENTS.md, docs/ward-flow/README.md",
      "- 2026-09-27 | Codex fold gate overhaul, Josh approved scoped takeover in this chat | ward/fold | D:/w/fold | AGENTS.md (fold sections only), docs/ward-flow/README.md. Preserve other edits, docs/ward-flow/**",
    ].join("\n");
    expect([...approvedTakeoverFiles(log, "ward/fold", "D:/w/fold")]).toEqual([
      "AGENTS.md",
      "docs/ward-flow/README.md",
    ]);
    expect(signOutConflicts(["AGENTS.md", "docs/ward-flow/README.md"], log, "ward/fold", "D:/w/fold")).toEqual([]);
  });

  it("requires an own sign-out for changed Ward files but not unrelated files", () => {
    const staged = ["src/components/ward-management/a.tsx", "tests/ward-engine.test.ts", "notes.md"];
    const own = "- 2026-09-27 | Me | ward/mine | D:/w/mine | src/components/ward-management/a.tsx";
    const rebuilt = ["Open sign-outs only", own].join("\n");
    expect(unsignedWardFiles(staged, rebuilt, "ward/mine", "D:/w/mine")).toEqual(["tests/ward-engine.test.ts"]);
    expect(unsignedWardFiles(staged, "", "ward/mine", "D:/w/mine")).toEqual(staged.slice(0, 2));
  });
});

// Every fake credential below is assembled at runtime so this file never
// contains the literal pattern the scanner blocks.
const FAKE_AWS = "AKIA" + "QWERTYUIOPASDFGH";
const FAKE_PRIVATE_KEY = "-----BEGIN " + "PRIVATE KEY-----";
const VALID_MEDICARE = "2123 45670 1"; // weighted check digit 0 is valid
const INVALID_MEDICARE = "2940 19283 1"; // the synthetic style already in ward fixtures

function jwtWithRole(role: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role, iss: "supabase" })}.signaturesignature`;
}

function ihiWithValidCheckDigit(): string {
  const stem = "800360123456789";
  for (let digit = 0; digit <= 9; digit += 1) {
    if (isLuhnValid(stem + digit)) return stem + digit;
  }
  throw new Error("unreachable");
}

function added(file: string, ...lines: string[]) {
  return new Map([[file, lines.map((text, index) => ({ line: index + 1, text }))]]);
}

describe("signOutLogOptional", () => {
  it("never infers ownership from a missing log on any host", () => {
    expect(signOutLogOptional()).toBe(false);
  });
});

describe("complete staged ownership admission", () => {
  it("keeps deletion and both rename paths separate from content selection", () => {
    const scope = stagedPathsFromStatus("D\0docs/ward-flow/old.md\0R100\0from.md\0to.md\0");
    expect(scope.ownershipPaths).toEqual(["docs/ward-flow/old.md", "from.md", "to.md"]);
    expect(scope.contentPaths).toEqual(["to.md"]);
    expect(stagedPathsFromStatus("D\0only.md\0").contentPaths).toEqual([]);
  });

  it("blocks an unavailable log on main and during merges", () => {
    const input = {
      ownershipPaths: ["docs/ward-flow/a.md"],
      branch: "main",
      root: "",
      taskBranch: false,
      merging: true,
      logAvailable: false,
    };
    expect(ownershipAdmission(input)).toMatchObject({ blocked: true, missingLog: true });
  });

  it("requires own claims for manual or both-side merge changes", () => {
    const changes = [
      { status: "M", paths: ["clean.md"] },
      { status: "M", paths: ["manual.md"] },
    ];
    const base = new Map([
      ["clean.md", "old"],
      ["manual.md", "old"],
    ]);
    const head = new Map([
      ["clean.md", "old"],
      ["manual.md", "ours"],
    ]);
    const incoming = new Map([
      ["clean.md", "new"],
      ["manual.md", "theirs"],
    ]);
    const result = partitionMergeOwnership(changes, { base, head, incoming, index: incoming });
    expect(result.cleanIncoming).toEqual(["clean.md"]);
    expect(result.requiredClaims).toEqual(["manual.md"]);
  });

  it("still checks active overlaps for an exact clean incoming merge", () => {
    const file = "docs/ward-flow/a.md";
    const input = {
      ownershipPaths: [file],
      requiredClaims: [],
      logAvailable: true,
      taskBranch: true,
      branch: "ward/mine",
      root: "",
      merging: true,
      signOutText: "Open sign-outs only\n",
    };
    expect(ownershipAdmission(input).blocked).toBe(false);
    expect(
      ownershipAdmission({
        ...input,
        signOutText: `Open sign-outs only\n- 2026-10-17 | Peer | ward/peer | | ${file}\n`,
      }).blocked,
    ).toBe(true);
  });
});

describe("identifier validators", () => {
  it("accepts a checksum-valid Medicare number and rejects the synthetic ones", () => {
    expect(isValidMedicare(VALID_MEDICARE.replace(/\s/g, "").slice(0, 10))).toBe(true);
    expect(isValidMedicare(INVALID_MEDICARE.replace(/\s/g, "").slice(0, 10))).toBe(false);
    expect(isValidMedicare("1123456701")).toBe(false); // first digit must be 2-6
  });

  it("validates IHIs by prefix and Luhn", () => {
    const ihi = ihiWithValidCheckDigit();
    expect(isValidIhi(ihi)).toBe(true);
    expect(isValidIhi(`${ihi.slice(0, 15)}${(Number(ihi[15]) + 1) % 10}`)).toBe(false);
  });
});

describe("parseAddedLines", () => {
  it("maps added lines to their new line numbers and ignores header-shaped content", () => {
    const diff = [
      "diff --git a/a.ts b/a.ts",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -3,0 +4,2 @@",
      "+const one = 1;",
      "+++ looks like a header but is content",
      "diff --git a/img.png b/img.png",
      "Binary files a/img.png and b/img.png differ",
    ].join("\n");
    const result = parseAddedLines(diff);
    expect(result.get("a.ts")).toEqual([
      { line: 4, text: "const one = 1;" },
      { line: 5, text: "++ looks like a header but is content" },
    ]);
    expect(result.has("img.png")).toBe(false);
  });
});

describe("scanAddedLines", () => {
  it("blocks .env files but not the committed example", () => {
    const findings = scanAddedLines(new Map(), [".env.local", ".env.example", "config/.env"]);
    expect(findings.map((finding: { file: string }) => finding.file)).toEqual([".env.local", "config/.env"]);
  });

  it("blocks provider keys and private keys, even in tests", () => {
    const findings = scanAddedLines(added("tests/x.test.ts", `const key = "${FAKE_AWS}";`, FAKE_PRIVATE_KEY));
    expect(findings).toHaveLength(2);
  });

  it("blocks a service-role JWT but not an anon one", () => {
    expect(scanAddedLines(added("src/a.ts", jwtWithRole("service_role")))).toHaveLength(1);
    expect(scanAddedLines(added("src/a.ts", jwtWithRole("anon")))).toHaveLength(0);
  });

  it("blocks a real-looking Medicare number outside fixtures only", () => {
    expect(
      scanAddedLines(added("src/components/ward-management/x.tsx", `medicare: "${VALID_MEDICARE}",`)),
    ).toHaveLength(1);
    expect(
      scanAddedLines(added("src/components/ward-management/x.tsx", `medicare: "${INVALID_MEDICARE}",`)),
    ).toHaveLength(0);
    expect(scanAddedLines(added("tests/ward-fixture.test.ts", `medicare: "${VALID_MEDICARE}",`))).toHaveLength(0);
  });

  it("blocks a checksum-valid IHI", () => {
    expect(scanAddedLines(added("docs/note.md", `IHI ${ihiWithValidCheckDigit()}`))).toHaveLength(1);
  });

  it("accepts synthetic UMnnnnnn URNs and blocks other labelled URNs", () => {
    expect(scanAddedLines(added("src/a.tsx", `umrn: "UM100002"`))).toHaveLength(0);
    // D-39: every synthetic range is UM plus six digits, e.g. the community demo cohort.
    expect(scanAddedLines(added("src/a.tsx", `umrn: "UM220194"`))).toHaveLength(0);
    expect(scanAddedLines(added("src/a.tsx", `umrn: "UM1234567"`))).toHaveLength(1);
    expect(scanAddedLines(added("src/a.tsx", `URN: A1234567`))).toHaveLength(1);
    expect(scanAddedLines(added("src/a.tsx", `return 1234567;`))).toHaveLength(0);
  });

  it("ignores placeholder secrets and honours the allow marker", () => {
    expect(scanAddedLines(added("src/a.ts", `password: "your-password-here"`))).toHaveLength(0);
    expect(scanAddedLines(added("src/a.ts", `password: "Tr0ub4dorAndHorse"`))).toHaveLength(1);
    expect(scanAddedLines(added("src/a.ts", `URN: A1234567 // precommit-scan: allow`))).toHaveLength(0);
  });
});

describe("the hook script end to end", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  function repo(): string {
    const root = mkdtempSync(join(tmpdir(), "precommit-checks-"));
    roots.push(root);
    const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
    git("init", "--quiet");
    git("config", "user.name", "Pre-commit Test");
    git("config", "user.email", "pre-commit-test@example.invalid");
    writeFileSync(join(root, "README.md"), "base\n");
    git("add", "README.md");
    git("commit", "--quiet", "--no-verify", "-m", "base");
    writeFileSync(join(root, "sign-out.md"), "Open sign-outs only\n");
    return root;
  }

  function stageAndRun(root: string, file: string, content: string, env: Record<string, string> = {}) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
    execFileSync("git", ["add", file], { cwd: root });
    const script = join(process.cwd(), "scripts", "pre-commit-checks.mjs");
    return spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
      // A standalone fixture owns its sign-out input; other chats' worktrees are not test data.
      env: { ...process.env, WARD_SIGNOUT_FILE: join(root, "sign-out.md"), ...env },
    });
  }

  it("fails on a staged secret and passes on clean content", () => {
    const dirty = repo();
    const blocked = stageAndRun(dirty, "notes.md", `key ${FAKE_AWS}\n`);
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("AWS access key");

    const clean = repo();
    const passed = stageAndRun(clean, "notes.md", "nothing secret here\n");
    expect(passed.status).toBe(0);
    expect(passed.stderr).toContain("[pre-commit] ok");
  });

  it("blocks a Ward commit without its own sign-out and accepts it once signed out", () => {
    const root = repo();
    execFileSync("git", ["branch", "-m", "ward/probe"], { cwd: root });
    const file = "docs/ward-flow/probe.md";
    const signOutFile = join(root, "sign-out.md");
    writeFileSync(signOutFile, "Open sign-outs only\n");
    const blocked = stageAndRun(root, file, "synthetic probe\n", { WARD_SIGNOUT_FILE: signOutFile });
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain(`Ward files without your sign-out in ${signOutFile}`);

    writeFileSync(signOutFile, `Open sign-outs only\n- 2026-09-27 | Me | ward/probe | ${root} | ${file}\n`);
    const passed = stageAndRun(root, file, "synthetic probe\n", { WARD_SIGNOUT_FILE: signOutFile });
    expect(passed.status).toBe(0);
    expect(passed.stderr).toContain("[pre-commit] ok");
  });

  it("still blocks when an explicitly named sign-out log is missing", () => {
    const root = repo();
    execFileSync("git", ["branch", "-m", "ward/probe"], { cwd: root });
    const signOutFile = join(root, "absent", "sign-out.md");
    const blocked = stageAndRun(root, "docs/ward-flow/probe.md", "synthetic probe\n", {
      WARD_SIGNOUT_FILE: signOutFile,
    });
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain(`shared sign-out log unavailable at ${signOutFile}`);
  });

  it("requires claims for staged deletion and both sides of a rename", () => {
    const root = repo();
    execFileSync("git", ["branch", "-m", "ward/probe"], { cwd: root });
    const oldFile = "docs/ward-flow/old.md";
    const newFile = "docs/ward-flow/new.md";
    const deletedFile = "docs/ward-flow/deleted.md";
    mkdirSync(dirname(join(root, oldFile)), { recursive: true });
    writeFileSync(join(root, oldFile), "synthetic old\n");
    writeFileSync(join(root, deletedFile), "synthetic deletion\n");
    execFileSync("git", ["add", oldFile, deletedFile], { cwd: root });
    execFileSync("git", ["commit", "--quiet", "--no-verify", "-m", "fixture"], { cwd: root });
    execFileSync("git", ["mv", oldFile, newFile], { cwd: root });
    rmSync(join(root, deletedFile));
    execFileSync("git", ["add", deletedFile], { cwd: root });
    const signOutFile = join(root, "sign-out.md");
    const run = () =>
      spawnSync(process.execPath, [join(process.cwd(), "scripts", "pre-commit-checks.mjs"), "--admission-only"], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, WARD_SIGNOUT_FILE: signOutFile },
      });
    writeFileSync(signOutFile, `Open sign-outs only\n- 2026-10-17 | Me | ward/probe | ${root} | ${newFile}\n`);
    const blocked = run();
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain(oldFile);
    expect(blocked.stderr).toContain(deletedFile);
    writeFileSync(
      signOutFile,
      `Open sign-outs only\n- 2026-10-17 | Me | ward/probe | ${root} | ${oldFile}, ${newFile}, ${deletedFile}\n`,
    );
    const passed = run();
    expect(passed.status).toBe(0);
    expect(passed.stderr).toContain("admission ok");
  });

  it.skipIf(process.platform === "win32")("blocks when the default log is absent off Windows", () => {
    const root = repo();
    execFileSync("git", ["branch", "-m", "ward/probe"], { cwd: root });
    // Off Windows the default log is ~/ward-flow-logs/sign-out.md, so point HOME at the fixture.
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: root };
    delete env.WARD_SIGNOUT_FILE;
    delete env.WARD_FLOW_LOGS;
    mkdirSync(join(root, "docs", "ward-flow"), { recursive: true });
    writeFileSync(join(root, "docs/ward-flow/probe.md"), "synthetic probe\n");
    execFileSync("git", ["add", "docs/ward-flow/probe.md"], { cwd: root });
    const passed = spawnSync(process.execPath, [join(process.cwd(), "scripts", "pre-commit-checks.mjs")], {
      cwd: root,
      encoding: "utf8",
      env,
    });
    expect(passed.status).toBe(1);
    expect(passed.stderr).toContain(`sign-out log unavailable at ${root}/ward-flow-logs/sign-out.md`);
  });
});

describe.skipIf(!HAS_WARD_FLOW_HISTORY)("admission-only merge with no HEAD-to-index changes", () => {
  const source = readFileSync(new URL("../scripts/pre-commit-checks.mjs", import.meta.url), "utf8");
  const mainStart = source.indexOf("async function main() {");
  const mainEnd = source.indexOf("\nif (process.argv[1]", mainStart);
  expect(mainStart).toBeGreaterThanOrEqual(0);
  expect(mainEnd).toBeGreaterThan(mainStart);
  const mainSource = source.slice(mainStart, mainEnd);
  const incomingFile = "docs/ward-flow/incoming.md";
  // ownershipAdmission() verifies this root with the real identity check, so it must be a public checkout.
  const fixtureRoot = HAS_WARD_FLOW_HISTORY ? verifiedWardFlowCheckout() : tmpdir();
  const mergeHeadPath = join(fixtureRoot, "MERGE_HEAD");
  const signOutFile = join(fixtureRoot, "sign-out.md");

  async function run({
    merging = true,
    incoming = incomingFile,
    currentOnly = "",
    log = "Open sign-outs only\n",
    logPresent = true,
    skipGuard = false,
    mergeBases = "b".repeat(40),
  }: {
    merging?: boolean;
    incoming?: string;
    currentOnly?: string;
    log?: string;
    logPresent?: boolean;
    skipGuard?: boolean;
    mergeBases?: string;
  } = {}) {
    const errors: string[] = [];
    let admissions = 0;
    const fakeGit = (args: string[]): string => {
      if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return fixtureRoot;
      if (args[0] === "rev-parse" && args[1] === "--git-path") return mergeHeadPath;
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return "ward/probe";
      if (args.join(" ") === "diff --cached --name-only -z --no-renames MERGE_HEAD")
        return [incoming, currentOnly].filter(Boolean).join("\0") + (incoming || currentOnly ? "\0" : "");
      if (
        args.join(" ") ===
        "diff --cached -U0 --no-color --no-ext-diff --diff-filter=ACMRT --src-prefix=a/ --dst-prefix=b/"
      )
        return "";
      if (args.join(" ") === "merge-base --all HEAD " + "a".repeat(40)) return mergeBases;
      if (args[0] === "ls-tree" && args.at(-1) === "b".repeat(40))
        return (
          [
            `100644 blob ${"1".repeat(40)}\t${incomingFile}`,
            currentOnly && `100644 blob ${"1".repeat(40)}\t${currentOnly}`,
          ]
            .filter(Boolean)
            .join("\0") + "\0"
        );
      if (args[0] === "ls-tree" && args.at(-1) === "a".repeat(40))
        return (
          [
            `100644 blob ${"2".repeat(40)}\t${incomingFile}`,
            currentOnly && `100644 blob ${"1".repeat(40)}\t${currentOnly}`,
          ]
            .filter(Boolean)
            .join("\0") + "\0"
        );
      if (args[0] === "ls-tree" && args.at(-1) === "HEAD")
        return (
          [
            `100644 blob ${"1".repeat(40)}\t${incomingFile}`,
            currentOnly && `100644 blob ${"3".repeat(40)}\t${currentOnly}`,
          ]
            .filter(Boolean)
            .join("\0") + "\0"
        );
      if (args.join(" ") === "ls-files --stage -z")
        return (
          [`100644 ${"1".repeat(40)} 0\t${incomingFile}`, currentOnly && `100644 ${"3".repeat(40)} 0\t${currentOnly}`]
            .filter(Boolean)
            .join("\0") + "\0"
        );
      throw new Error(`Unexpected git call: ${args.join(" ")}`);
    };
    const main = runInNewContext(`${mainSource}\nmain`, {
      TYPECHECK_CHILD_FLAG: "--typecheck-child",
      SIGN_OUT_FILE: signOutFile,
      process: {
        argv: ["node", "pre-commit-checks.mjs", "--admission-only"],
        env: { SKIP_SIGNOUT_GUARD: skipGuard ? "1" : undefined },
        chdir: () => {},
      },
      git: fakeGit,
      filterAdmissionMergePaths: (paths: string[], heads: string[]) => filterAdmissionMergePaths(paths, heads, fakeGit),
      stagedScope: () => ({ changes: [], ownershipPaths: [], contentPaths: [] }),
      existsSync: (file: string) => (file === mergeHeadPath ? merging : file === signOutFile && logPresent),
      readFileSync: (file: string) => (file === mergeHeadPath ? `${"a".repeat(40)}\n` : log),
      parseAddedLines: () => [],
      scanAddedLines: () => [],
      mergeOwnershipScope: () => ({ cleanIncoming: [], requiredClaims: [] }),
      ownershipAdmission: (args: Parameters<typeof ownershipAdmission>[0]) => {
        admissions++;
        return ownershipAdmission(args);
      },
      isPublicWardFlowCheckout: () => true,
      elapsed: () => "0 ms",
      console: { error: (message: string) => errors.push(message) },
    }) as () => Promise<number>;
    return { code: await main(), errors: errors.join("\n"), admissions };
  }

  it("checks incoming-only paths for missing log, active overlap, own claim and skip refusal", async () => {
    const missing = await run({ logPresent: false });
    expect(missing.code).toBe(1);
    expect(missing.errors).toContain("shared sign-out log unavailable");

    const other = `Open sign-outs only\n- 2026-10-17 | Other | ward/other | /other | ${incomingFile} | repo=BigSimmo/Ward-Flow\n`;
    const clash = await run({ log: other });
    expect(clash.code).toBe(1);
    expect(clash.errors).toContain("files signed out by another session");
    expect(clash.errors).toContain(incomingFile);

    const unsigned = await run();
    expect(unsigned.code).toBe(1);
    expect(unsigned.errors).toContain("Ward files without your sign-out");

    const own = `Open sign-outs only\n- 2026-10-17 | Me | ward/probe | ${fixtureRoot} | ${incomingFile} | repo=BigSimmo/Ward-Flow\n`;
    const allowed = await run({ log: own });
    expect(allowed.code).toBe(0);
    expect(allowed.errors).toContain("admission ok");

    const refusedSkip = await run({ log: own, skipGuard: true });
    expect(refusedSkip.code).toBe(1);
    expect(refusedSkip.errors).toContain("cannot skip ownership admission");
    expect([missing, clash, unsigned, allowed].every((result) => result.admissions === 1)).toBe(true);
    expect(refusedSkip.admissions).toBe(0);
  });

  it("keeps truly empty non-merge and identical incoming merge admissions empty", async () => {
    expect(await run({ merging: false, logPresent: false })).toMatchObject({ code: 0, admissions: 0 });
    expect(await run({ incoming: "", logPresent: false })).toMatchObject({ code: 0, admissions: 0 });
  });

  it("does not admit a current-side-only path from the index-to-incoming diff", async () => {
    const result = await run({ incoming: "", currentOnly: "docs/ward-flow/current.md", logPresent: false });
    expect(result).toMatchObject({ code: 0, admissions: 0 });
  });

  it("keeps ownership admission mandatory when merge bases are ambiguous", async () => {
    const result = await run({ mergeBases: `${"b".repeat(40)}\n${"c".repeat(40)}`, logPresent: false });
    expect(result).toMatchObject({ code: 1, admissions: 1 });
    expect(result.errors).toContain("shared sign-out log unavailable");
  });
});

describe("filterAdmissionMergePaths conservative provenance", () => {
  const paths = ["docs/ward-flow/incoming.md"];
  const head = "a".repeat(40);

  it.each([
    ["invalid incoming head", ["not-a-commit"]],
    ["octopus merge", [head, "b".repeat(40)]],
    ["missing incoming head", []],
  ])("retains paths for %s", (_label, heads) => {
    expect(
      filterAdmissionMergePaths(paths, heads as string[], () => {
        throw new Error("Unknown provenance must not be used for an exemption");
      }),
    ).toEqual(paths);
  });

  it.each([
    ["multiple merge bases", `${"b".repeat(40)}\n${"c".repeat(40)}`],
    ["invalid merge base", "not-a-commit"],
  ])("retains paths for %s", (_label, bases) => {
    expect(
      filterAdmissionMergePaths(paths, [head], (args: string[]) => {
        expect(args).toEqual(["merge-base", "--all", "HEAD", head]);
        return bases;
      }),
    ).toEqual(paths);
  });
});
