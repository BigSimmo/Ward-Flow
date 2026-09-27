import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * 🔴 **THE D-3 RATCHET'S PROTECTIONS, PROVEN TO BITE — NOT ASSERTED TO EXIST.**
 *
 * ⚠️ **This file exists because of a correction, and the correction is worth more than the file.** The
 * three protections were first proven BY HAND and their exit codes written into the script's header.
 * A peer named the residue exactly: **"exit codes recorded in a header are a claim nobody re-runs."**
 * The protections stayed live; **the proofs that they bite decayed into prose**, and a later change
 * removing one would have left that header still asserting it had been verified.
 *
 * ## 🔴 And neither of the two hand-run mutations covered both arms
 *
 * **Two people mutation-tested this gate within an hour and each believed they had proved it:**
 *
 *     nine declarations in a NEW file        → the "new file carrying sub-12px text" branch
 *     one declaration in an EXISTING file    → the "count rose in a file already pinned" branch
 *
 * ⚠️ **Each of us exercised ONE arm.** 🔴 **And the arm that matters most is the one the per-file
 * rebuild CREATED — it has no history of ever having been right.** Both are below, separately.
 *
 * ## Why the fixture is a real git repository
 *
 * 🔴 **The script enumerates with `git ls-files`, and the METHOD is the boundary.** A fixture swept by
 * a plain directory walk would prove a code path that does not run in production — green against an
 * enumeration nobody uses. ✅ **So each case builds a throwaway git repo, `git add`s its files (no
 * commit needed — `ls-files` reads the index), and deletes it afterwards.** **Nothing in the real tree
 * moves, which is what the original declared trade was protecting.**
 */

const SCRIPT = join(process.cwd(), "scripts/ward-flow/check-text-size-floor.mjs");
const TOKEN = "--text-3xs";

/** Below the script's own MINIMUM_FILES_SWEPT, so the fixture must clear it deliberately. */
const FIXTURE_FILES = 34;

let root = "";

function git(args: string[]): void {
  execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" });
}

/** One ward stylesheet in the fixture, carrying `count` occurrences of the forbidden token. */
function writeStylesheet(relative: string, count: number): void {
  const full = join(root, relative);
  mkdirSync(join(full, ".."), { recursive: true });
  const rules = Array.from({ length: count }, (_, index) => `.r${index} { font-size: var(${TOKEN}); }`);
  writeFileSync(full, `.base { color: red; }\n${rules.join("\n")}\n`, "utf8");
}

function stylesheetPath(index: number): string {
  return `src/components/ward-management/fixture-${index}/fixture-${index}.module.css`;
}

/**
 * Build a fixture whose first files carry tokens and whose rest are clean padding.
 *
 * 🔴 **AND VERIFY IT, BECAUSE THIS TEST WALKS A POPULATION TOO.** A fixture-based proof that runs
 * over a fixture which was never written is the survey's own headline defect, rebuilt inside the
 * survey's own remedy. The three tiers the script now carries are applied here to the fixture itself:
 * a FLOOR on what was written, a CONTROL that the seeded tokens are actually findable, and a NAME for
 * anything expected and not found.
 */
function buildFixture(seed: readonly number[]): string[] {
  const written: string[] = [];
  for (let index = 0; index < FIXTURE_FILES; index += 1) {
    const relative = stylesheetPath(index);
    writeStylesheet(relative, seed[index] ?? 0);
    written.push(relative);
  }
  git(["add", "-A"]);

  // ⚠️ TIER 3, on the fixture: git's index is what the script reads, so "written to disk" is not
  // the question — "visible to `git ls-files`" is. Anything expected and absent is NAMED.
  const indexed = new Set(
    execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean),
  );
  const missing = written.filter((relative) => !indexed.has(relative.split("\\").join("/")));
  expect(
    missing,
    `the fixture expected ${written.length} stylesheets in git's index and ${missing.length} are absent. ` +
      `Every case here proves something by running the script over this fixture, so a fixture that was ` +
      `not built makes those proofs vacuous: ${missing.slice(0, 5).join(", ")}`,
  ).toEqual([]);

  // 🔴 TIER 1, on the fixture: it must clear the script's own walk floor, or the script REFUSES and
  // several cases below would fail for the wrong reason rather than proving anything.
  expect(
    written.length,
    "the fixture is smaller than the walk floor the script refuses below, so it cannot be used to " +
      "prove anything about a healthy population",
  ).toBeGreaterThan(30);

  // ✅ TIER 2, on the fixture: the seeded token must be findable by the same pattern the script uses.
  // A fixture whose tokens were written wrong would make every "rose" case start from zero.
  const seeded = seed.reduce((total, count) => total + count, 0);
  if (seeded > 0) {
    const firstWithTokens = seed.findIndex((count) => count > 0);
    const text = readFileSync(join(root, stylesheetPath(firstWithTokens)), "utf8");
    expect(
      (text.match(/--text-3xs|--text-2xs/gu) ?? []).length,
      "the fixture's seeded tokens are not findable by the script's own pattern, so the counts every " +
        "case below compares would all start from zero",
    ).toBe(seed[firstWithTokens]);
  }

  return written;
}

function baselinePath(): string {
  return join(root, "baseline.json");
}

/** Record the fixture's own baseline by running the script's own `--update-baseline` path. */
function recordBaseline(): void {
  writeFileSync(baselinePath(), JSON.stringify({ note: "fixture", count: 0, fileCount: 0, perFile: {} }), "utf8");
  const result = run(["--update-baseline"]);
  expect(result.status, `could not record the fixture baseline:\n${result.output}`).toBe(0);
}

function run(extra: readonly string[] = []): { status: number; output: string } {
  try {
    const output = execFileSync(process.execPath, [SCRIPT, "--root", root, "--baseline", baselinePath(), ...extra], {
      encoding: "utf8",
      stdio: "pipe",
    });
    return { status: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? -1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ward-ratchet-"));
  git(["init", "--quiet"]);
  git(["config", "user.email", "fixture@example.invalid"]);
  git(["config", "user.name", "fixture"]);
});

afterEach(() => {
  // Bounded retries, per `tests/test-runner-safety.test.ts`: on Windows a just-closed handle can
  // still hold the directory for a few milliseconds, and an unbounded recursive delete turns
  // that into a flake in whichever suite runs next rather than in this one.
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  root = "";
});

describe("the D-3 ratchet bites", () => {
  /**
   * 🔴 **ANTI-VACUITY ON THE FIXTURE ITSELF — the survey's own rule, applied one level in.**
   * Every case below proves something by running the script over this fixture. **If the fixture were
   * empty, the script would REFUSE and several cases would "pass" for the wrong reason.** A
   * fixture-based proof over zero fixture files is exactly the defect the survey catalogued.
   */
  it("🔴 builds a fixture the script accepts as a real population", () => {
    buildFixture([3, 2]);
    recordBaseline();
    const { status, output } = run();
    expect(status, `the untouched fixture does not pass:\n${output}`).toBe(0);
    const swept = Number(/swept\s+(\d+) stylesheet/u.exec(output)?.[1] ?? -1);
    expect(
      swept,
      `the script reports sweeping ${swept} stylesheets but the fixture wrote ${FIXTURE_FILES}. ` +
        "Matching the SHAPE of that line and not its NUMBER is the weaker assertion this survey " +
        "exists to catch — it passes on any count, including one.",
    ).toBe(FIXTURE_FILES);
    expect(output).toContain("Not risen in any file");
    // The seeded counts must actually be seen, or every "rose" case below starts from nothing.
    expect(output, "the fixture's seeded tokens were not counted").toContain("5 occurrences across 2 files");
  });

  /**
   * 🔴 **ARM A — a count rising in a file ALREADY in the baseline.**
   * The arm the previous total-only ratchet could catch only by accident, and only if no other file
   * had fallen to pay for it.
   */
  it("🔴 ARM A — fails when an existing file's count rises", () => {
    buildFixture([3, 2]);
    recordBaseline();
    writeStylesheet(stylesheetPath(0), 4);
    git(["add", "-A"]);

    const { status, output } = run();
    expect(status, `an existing file rose and the ratchet did not fail:\n${output}`).toBe(1);
    expect(output).toContain("RISEN");
    expect(output, "the failure does not name the file that rose").toContain("fixture-0.module.css");
    expect(output, "the failure does not show the delta").toContain("3 → 4");
    expect(output, "the wrong branch was reported").toContain("count rose in an existing file");
  });

  /**
   * 🔴 **ARM B — a NEW file carrying any sub-12px text.**
   * ⚠️ **This branch DID NOT EXIST before the per-file rebuild**, so it has no history of ever having
   * been right — which is why it is the one most worth pinning.
   */
  it("🔴 ARM B — fails when a NEW file carries any, even while another file falls", () => {
    buildFixture([3, 2]);
    recordBaseline();
    // The old total-only ratchet would have NETTED THESE OFF and reported no change.
    writeStylesheet(stylesheetPath(0), 1);
    writeStylesheet(stylesheetPath(9), 2);
    git(["add", "-A"]);

    const { status, output } = run();
    expect(
      status,
      `a new file carrying sub-12px text passed, paid for by another file's fall — the exact defeat ` +
        `the per-file rebuild exists to stop:\n${output}`,
    ).toBe(1);
    expect(output, "the new file is not named").toContain("fixture-9.module.css");
    expect(output, "the new-file branch was not the one reported").toContain("new file carrying sub-12px text");
  });

  /**
   * ⚠️ **TIER 3 — a baseline file that has LEFT is NAMED, not absorbed.**
   * Under the old rule its whole count became invisible headroom, and a rename looked like nothing.
   */
  it("⚠️ names a baseline file that is no longer swept, rather than absorbing its count", () => {
    buildFixture([3, 2]);
    recordBaseline();
    rmSync(join(root, stylesheetPath(1)), { force: true });
    git(["add", "-A"]);

    const { status, output } = run();
    expect(status, `a departed file should not be a failure on its own:\n${output}`).toBe(0);
    expect(output, "the departed file was absorbed silently").toContain("no longer swept");
    expect(output, "the departed file is not named").toContain("fixture-1.module.css");
  });

  /** 🔴 **TIER 1 — a collapsed sweep REFUSES. The old version printed its success message.** */
  it("🔴 TIER 1 — refuses when the sweep collapses, rather than reporting a fall", () => {
    buildFixture([3, 2]);
    recordBaseline();
    for (let index = 0; index < FIXTURE_FILES; index += 1) {
      rmSync(join(root, stylesheetPath(index)), { force: true });
    }
    git(["add", "-A"]);

    const { status, output } = run();
    expect(status, `an empty sweep did not refuse:\n${output}`).toBe(2);
    expect(output).toContain("REFUSED");
    expect(
      output,
      "a collapsed sweep reported success — this is the exact shape the survey was written about",
    ).not.toContain("Not risen");
  });

  /** 🔴 **TIER 2 — the matcher's own control, proven by pointing the script at a tree it cannot match.** */
  it("🔴 TIER 2 — reports the matcher control on every run, so its removal changes an assertion", () => {
    buildFixture([3, 2]);
    recordBaseline();
    const { output } = run();
    expect(
      output,
      "the matcher's positive control is no longer reported. A broken pattern counts zero everywhere " +
        "and passes, which is indistinguishable from a clean tree",
    ).toMatch(/matcher\s+proved on a specimen:\s*2\/2/u);
  });

  /** ✅ **AND `--update-baseline` MUST NOT BE A WAY TO PASS.** It records; it does not judge. */
  it("✅ --update-baseline records a rise rather than refusing it, which is why it is a deliberate act", () => {
    buildFixture([3, 2]);
    recordBaseline();
    writeStylesheet(stylesheetPath(0), 9);
    git(["add", "-A"]);

    expect(run().status, "the rise was not caught before re-baselining").toBe(1);
    expect(run(["--update-baseline"]).status).toBe(0);
    expect(
      run().status,
      "re-baselining did not actually pin the new figure, so the flag reports success without recording",
    ).toBe(0);
  });
});
