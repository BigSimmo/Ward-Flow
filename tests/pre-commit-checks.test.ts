import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  approvedTakeoverFiles,
  isLuhnValid,
  isValidIhi,
  isValidMedicare,
  parseAddedLines,
  scanAddedLines,
  signOutConflicts,
  unsignedWardFiles,
} from "../scripts/pre-commit-checks.mjs";

describe("signOutConflicts (clash guard)", () => {
  const signOut = [
    "# Ward Flow file sign-out",
    "## Active sign-outs",
    "- 2026-09-25 | Thread X | ward/x | D:/w/x | src/components/ward-management/, tests/a.test.ts (new), AGENTS.md (one block), outside git: logs/notes.md",
    "- 2026-09-25 | Thread Y | ward/y | D:/w/y | docs/ward-flow/**",
    "## Copied from the old file",
    "- 2026-09-25 | Old | ward/old | D:/w/o | tests/b.test.ts",
  ].join("\n");

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

  it("accepts synthetic UM1nnnnn URNs and blocks other labelled URNs", () => {
    expect(scanAddedLines(added("src/a.tsx", `umrn: "UM100002"`))).toHaveLength(0);
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
    const blocked = stageAndRun(root, file, "synthetic probe\n", { WARD_SIGNOUT_FILE: signOutFile });
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain(`Ward files without your sign-out in ${signOutFile}`);

    writeFileSync(signOutFile, `Open sign-outs only\n- 2026-09-27 | Me | ward/probe | ${root} | ${file}\n`);
    const passed = stageAndRun(root, file, "synthetic probe\n", { WARD_SIGNOUT_FILE: signOutFile });
    expect(passed.status).toBe(0);
    expect(passed.stderr).toContain("[pre-commit] ok");
  });
});
