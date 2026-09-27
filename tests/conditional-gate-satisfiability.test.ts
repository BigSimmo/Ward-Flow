import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **A CONDITIONAL TEST THAT IS SKIPPED HERE AND A CONDITIONAL TEST THAT IS SKIPPED EVERYWHERE
 * REPORT IDENTICALLY, AND ONE OF THEM IS A LOST GUARD.**
 *
 * `tests/diff-integrity.test.ts:505` — *"would have rejected the commit that motivated it (#Y30AXB,
 * d1485d6e8)"* — is gated `it.runIf(gitAvailable(INCIDENT))`. **That commit lived only on
 * `refs/pull/2481/head`** (the project's own ledger says so, verbatim), so it is in no clone of this
 * repository: verified against a NON-SHALLOW tree holding 12,726 commits reachable from all refs.
 * The case has therefore never executed, and cannot.
 *
 * **What is lost is not a test. It is a PROOF.** `check:diff-integrity` exists because of `#Y30AXB`,
 * and that case was the only thing in the repository demonstrating the gate would have caught the
 * incident it was built for. The gate still runs and is fine; its evidence quietly stopped existing,
 * and reported as "skipped" throughout — indistinguishable from healthy.
 *
 * ## What this file decides, and what it deliberately does not
 *
 * ⚠️ **IT ONLY FAILS ON A CONDITION IT CAN PROVE FALSE EVERYWHERE.** In practice that is one shape:
 * a gate pinned to a FIXED GIT OBJECT that no clone contains.
 *
 * ⚠️ **AND THE OBVIOUS JUSTIFICATION FOR THAT IS WRONG, SO IT IS NOT THE ONE USED.** "The SHA is
 * immutable, therefore absent here is absent everywhere" is false: the SHA is immutable, but
 * PRESENCE IN A CLONE IS NOT. `git fetch origin refs/pull/2481/head` makes `d1485d6e8` exist. The
 * honest claim is narrower — **absent in every clone that has not fetched that ref**, which is
 * every clone of this repository today.
 *
 * **The conclusion survives on EXACTNESS instead, which is a better footing than the false claim
 * was.** Because the register is exact in both directions, whoever fetches that ref to recover the
 * lost proof gets a red saying *the condition can now be met, remove the entry* — the recovery
 * announcing itself, not a false alarm. Exactness would only hurt a condition that flickers within
 * one environment, and this register holds git objects, which do not.
 *
 * **Everything else is classified, never guessed at:**
 *
 *   - **`process.platform`** — decided **BY ITS VALUE**, against the platforms this project
 *     actually runs on (`REACHABLE_PLATFORMS` below: CI is Linux, the only development machine is
 *     Windows). `=== "win32"` and `!== "win32"` are both reachable; **`=== "darwin"` is not, and is
 *     reported.**
 *
 *     ⚠️ **THIS USED TO WAVE THROUGH ANY CONDITION THAT MERELY MENTIONED `process.platform`** — the
 *     same hole as the `process.env` one below, in a place that had neither the fix nor the note.
 *     **The `process.env` reasoning does not transfer, and that is the whole reason this one is
 *     closed rather than named:** an environment variable needs an inventory of what each
 *     environment sets, and no such inventory exists; a platform has a closed, documented set, and
 *     the two facts needed were already written down in this very file. **Decidable without a new
 *     list to maintain — so decided.** Found by Ward Builder One on review, 2026-09-06.
 *
 *     A condition naming the platform in any shape this cannot read as a single comparison —
 *     compounded with `&&`, or testing it twice — falls through to the declaration requirement
 *     rather than past it.
 *
 *     **The inventory, WITH ITS UNIT NAMED, because two of us counted it and got different
 *     numbers (measured 2026-09-06 by forcing `REACHABLE_PLATFORMS` empty, so every platform gate
 *     reports itself):**
 *
 *         FOUR SITES, ACROSS FOUR FILES. (Measured 2026-09-06 as six sites across five files,
 *         with `pdf-extractor.test.ts` carrying two; PsychSift's removal deleted that file
 *         entirely, taking both of its sites with it.)
 *           === "win32"   ci-cache-safety:386, pr-handoff-stop:95,
 *                         push-format-guard:136                       (3 sites, 3 files)
 *           !== "win32"   guard-push-no-merge-base:43                 (1 site,  1 file)
 *
 *     ⚠️ **A FIFTH SITE IS REPORTED BY ANY SCANNER WITHOUT STRING-BLANKING, AND IT IS NOT A
 *     GATE:** `diff-integrity.test.ts:91` passes `'it.runIf(process.platform !== "win32")(…)'` to
 *     `countTestCases` as a FIXTURE STRING. It is the live instance of exactly what the blanking
 *     is for, and it sits in a file this one already has business with.
 *
 *     ⚠️ **AND THE UNIT IS WRITTEN DOWN HERE BECAUSE ITS ABSENCE COST TWO PEOPLE A ROUND TRIP.**
 *     Sites, files, gates and cases are four different numbers over one set, and each is a
 *     defensible reading of "how many platform gates are there". Neither reviewer was careless;
 *     neither said which they meant.
 *   - **`process.env`** — satisfiable wherever that variable is set; CI sets `CI`.
 *
 *     🔴 **AND THIS IS THIS FILE'S OWN KNOWN HOLE, NAMED HERE RATHER THAN QUIETLY COVERED.** The
 *     classification is true of the MECHANISM and not of the INSTANCE: `runIf(process.env.CI)` is
 *     genuinely satisfiable, and `runIf(process.env.SOME_FLAG_NOBODY_SETS)` would be **the lost
 *     proof wearing an environment variable instead of a SHA** — and it is the likelier arrival of
 *     the two, because a flag is easier to add than a commit is to lose.
 *
 *     **Not decidable from here.** Deciding it needs an inventory of which variables the supported
 *     environments actually set — CI's workflow env, the Cloud profile, a developer shell — and no
 *     such inventory exists to check against. Building one to satisfy this gate would put a second
 *     unmaintained list beside the register, which is the failure mode the register itself is
 *     written to avoid.
 *
 *     **Measured 2026-09-06, so the hole is recorded with its size:** exactly ONE gate in the whole
 *     suite classified this way — `it.runIf(Boolean(process.env.CI))` in `tests/pdf-extractor.test.ts`
 *     — and GitHub Actions sets `CI`. **PsychSift's removal deleted that file, so the count is now
 *     ZERO.** The hole stays latent rather than closed: nothing here proves no `process.env` gate can
 *     ever reappear, only that none exists today. If one arrives, that is the moment to decide
 *     whether an inventory is worth its upkeep; today it would be a list with no entries guarding
 *     nothing.
 *
 *     ⚠️ **A register that overstates its own coverage is the failure this gate exists to catch**,
 *     so the limit is stated where the classification is made rather than in a message that scrolls
 *     away.
 *   - **anything else** — **UNDECIDABLE from here**, and it must be DECLARED below with the reason.
 *     `hasPyMuPDF` depends on a Python install; `hasVendoredSkills` on a directory that may or may
 *     not be vendored. **This file does not pretend to evaluate them**, because a gate that guesses
 *     at a condition it cannot decide is the defect it exists to catch, one level up.
 *
 * ⚠️ **AND IT REFUSES TO ANSWER FOR CI.** Whether GitHub still holds an unreachable PR ref is a
 * question about a remote, and nothing here makes a network call to find out. The finding stands on
 * what is decidable locally: **this is the only development machine, and the condition is false on
 * it, permanently.**
 *
 * ⚠️ **HOW THIS FILE ITSELF GETS RUN, SAID OUT LOUD BECAUSE ITS SUBJECT IS GUARDS THAT DO NOT.**
 * It is repository-wide, so it carries no `ward-` prefix and **the ward line's usual local run,
 * `vitest run ward`, does not select it.** It imports no source, so `vitest related` cannot select
 * it either. It runs in a full local `vitest run` and in CI's coverage lane, which fires on any
 * test or source change. **Naming it `ward-…` to get it picked up would be a lie about its scope —
 * the honest fix is that whoever runs the ward suite before a fold runs the full one**, which is
 * already true of three other guards on this branch for the same reason.
 */

const TESTS_ROOT = "tests";

/**
 * Conditions proved false everywhere, each with why and who holds the decision. **An entry here
 * records a lost guard; it does not excuse one.** The register is EXACT in both directions — an
 * entry whose condition has become satisfiable fails just as loudly as an unsatisfiable condition
 * with no entry, so restoring the artefact forces the entry out.
 */
const KNOWN_UNSATISFIABLE: Readonly<Record<string, string>> = {
  "tests/diff-integrity.test.ts :: gitAvailable(d1485d6e8)":
    "The #Y30AXB incident commit lived only on refs/pull/2481/head and is in no clone, so the one " +
    "case proving check:diff-integrity would have caught the incident it was built for has never " +
    "run. Raised with the owner by Ward Lead on 2026-09-06 as a LOST PROOF rather than a broken " +
    "test; the repairs (a committed fixture reproducing the corruption, or re-pinning the assertion " +
    "to an artefact that survives) are decisions about a repository-level gate.",
};

/**
 * Conditions this file cannot decide, each with the reason. **Declaring one is not approving it** —
 * it is recording that satisfiability was considered and found undecidable from a static read.
 */
const DECLARED_UNDECIDABLE: Readonly<Record<string, string>> = {
  "tests/ward-flow-chat-control.test.ts :: existsSync(controlRoot)":
    "depends on whether docs/ward-flow/control is present in the checkout being tested",
  "tests/ward-travel-bands.test.ts :: !TRAVEL_BANDS_ARE_INVENTED":
    "a module constant about the fixture's provenance, not an environment fact",
};

/**
 * A walk reaching too few gates would make every verdict below pass over nothing.
 *
 * Re-measured after PsychSift's removal, which took `tests/pdf-extractor.test.ts`
 * and `tests/claude-cloud-profile.test.ts` with it: the suite now carries 7
 * conditional gates (down from the pre-removal count this floor was set against).
 * The floor sits below that fresh measurement, not at it, for the same reason
 * every floor in this file does - ordinary test churn should not trip it, only a
 * collapse of the walk itself should.
 */
const MINIMUM_GATES = 4;

/**
 * The platforms this project actually runs on. **Adding a Mac or a container to the estate means
 * adding it here** — and until it is added, a gate pinned to it is correctly reported as one that
 * never runs.
 */
const REACHABLE_PLATFORMS = ["win32", "linux"] as const;

/**
 * Whether a `process.platform` condition can be true on SOME machine this project runs on.
 *
 * `null` means the condition names the platform in a shape this cannot read as one comparison —
 * compounded, negated twice, whatever. **Null is not a pass:** the caller lets it fall through to
 * the declaration requirement, because guessing at a condition is the defect this file catches.
 */
export function platformSatisfiable(condition: string): boolean | null {
  const comparison = /^\(*\s*process\.platform\s*(===|!==)\s*["']([A-Za-z0-9]+)["']\s*\)*$/u.exec(condition.trim());
  if (comparison === null) return null;
  const [, operator, named] = comparison;
  return operator === "==="
    ? REACHABLE_PLATFORMS.some((platform) => platform === named)
    : REACHABLE_PLATFORMS.some((platform) => platform !== named);
}

function testFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry).replaceAll("\\", "/");
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(path)) found.push(path);
    }
  };
  walk(TESTS_ROOT);
  return found;
}

/**
 * Comments become spaces and **string contents become spaces too**.
 *
 * ⚠️ **THE STRING HALF IS NOT TIDINESS.** `tests/diff-integrity.test.ts` carries
 * `'it.runIf(process.platform !== "win32")("a", () => {});'` as a FIXTURE STRING, to test its own
 * test-case counter. A scanner that read it would report a gate that does not exist — and this
 * file's whole subject is telling a real conditional gate from an apparent one. The control below
 * asserts exactly that case.
 *
 * ⚠️ **AND REGEX LITERALS ARE A THIRD STATE, WHOSE FAILURE IS SILENT AND SUBTRACTIVE.** A literal
 * whose body opens a comment or a quote — a slash-star inside a character class, an apostrophe in
 * a word — used to blank everything after it to the next closer, so **any gate downstream was
 * never found at all**. Not a wrong answer: NO answer, read as "no gate there", which is the one
 * direction nothing reports. Found by Ward Builder One on review, 2026-09-06; zero live instances
 * at the time, and the controls below fix both directions of it.
 *
 * A leading slash is read as a regex only where one may legally begin — after an operator or an
 * opening bracket — so ordinary division is left alone. **Being wrong THAT way would open a regex
 * state over live code and swallow gates**, which is the same silent loss; the control asserts a
 * division does not.
 */
function stripCommentsAndStrings(source: string): string {
  let out = "";
  let index = 0;
  let state: "code" | "block" | "line" | "single" | "double" | "template" | "regex" = "code";
  let inCharacterClass = false;
  /** The last non-whitespace character emitted as code, which decides slash = regex or division. */
  let previous = "";
  const REGEX_MAY_FOLLOW = new Set([
    "(",
    ",",
    "=",
    ":",
    "[",
    "!",
    "&",
    "|",
    "?",
    "{",
    "}",
    ";",
    "+",
    "-",
    "*",
    "%",
    "~",
    "^",
    "<",
    ">",
    "",
  ]);
  const KEYWORD_BEFORE_REGEX = /\b(?:return|typeof|case|in|of|do|else|void|delete|new|throw|yield|await)\s*$/u;
  while (index < source.length) {
    const here = source[index];
    const next = source[index + 1];
    if (state === "code") {
      if (here === "/" && next === "*") {
        state = "block";
        out += "  ";
        index += 2;
        continue;
      }
      if (here === "/" && next === "/") {
        state = "line";
        out += "  ";
        index += 2;
        continue;
      }
      if (here === "/" && (REGEX_MAY_FOLLOW.has(previous) || KEYWORD_BEFORE_REGEX.test(out))) {
        state = "regex";
        inCharacterClass = false;
        out += here;
        previous = here;
        index += 1;
        continue;
      }
      if (here === "'" || here === '"' || here === "`") {
        state = here === "'" ? "single" : here === '"' ? "double" : "template";
        out += here;
        previous = here;
        index += 1;
        continue;
      }
      out += here;
      if (!/\s/u.test(here)) previous = here;
      index += 1;
      continue;
    }
    if (state === "regex") {
      if (here === "\\") {
        out += "  ";
        index += 2;
        continue;
      }
      if (here === "[") inCharacterClass = true;
      else if (here === "]") inCharacterClass = false;
      else if (here === "/" && !inCharacterClass) {
        state = "code";
        out += here;
        previous = here;
        index += 1;
        continue;
      }
      out += here === "\n" ? "\n" : " ";
      index += 1;
      continue;
    }
    if (state === "block") {
      if (here === "*" && next === "/") {
        state = "code";
        out += "  ";
        index += 2;
        continue;
      }
      out += here === "\n" ? "\n" : " ";
      index += 1;
      continue;
    }
    if (state === "line") {
      if (here === "\n") {
        state = "code";
        out += "\n";
        index += 1;
        continue;
      }
      out += " ";
      index += 1;
      continue;
    }
    // Inside a string: keep the quote characters so the code stays parseable, blank the contents.
    if (here === "\\") {
      out += "  ";
      index += 2;
      continue;
    }
    const closes =
      (state === "single" && here === "'") ||
      (state === "double" && here === '"') ||
      (state === "template" && here === "`");
    if (closes) {
      state = "code";
      out += here;
      index += 1;
      continue;
    }
    out += here === "\n" ? "\n" : " ";
    index += 1;
  }
  return out;
}

type Gate = { file: string; line: number; condition: string };

/** Every `it/test/describe.runIf(...)` / `.skipIf(...)` in real code, with its condition text. */
export function conditionalGates(files: string[], read: (file: string) => string): Gate[] {
  const gates: Gate[] = [];
  for (const file of files) {
    const raw = read(file);
    const code = stripCommentsAndStrings(raw);
    const opener = /\b(?:it|test|describe)\.(?:runIf|skipIf)\(/g;
    let match: RegExpExecArray | null;
    while ((match = opener.exec(code)) !== null) {
      let depth = 1;
      let index = opener.lastIndex;
      while (index < code.length && depth > 0) {
        if (code[index] === "(") depth += 1;
        else if (code[index] === ")") depth -= 1;
        index += 1;
      }
      /*
       * ⚠️ **FOUND in the stripped text, READ from the raw text, at the same offsets.** The stripper
       * is length-preserving on purpose — every replacement is the same width as what it replaced —
       * so a gate located in the blanked copy can be sliced out of the original. Reading the
       * condition from the stripped copy instead returned `process.platform === " "`, with the
       * literal blanked out: enough to classify, and useless for a `gitAvailable("<sha>")` whose SHA
       * is the whole question. **Locating and reading are two jobs and they want different texts.**
       */
      const condition = raw
        .slice(opener.lastIndex, index - 1)
        .replace(/\s+/gu, " ")
        .trim();
      gates.push({ file, line: code.slice(0, match.index).split("\n").length, condition });
    }
  }
  return gates;
}

/** The SHA a `gitAvailable(...)` condition names, resolved through a same-file constant if needed. */
function gitObjectFor(gate: Gate, source: string): string | null {
  const call = /gitAvailable\(\s*([A-Za-z_$][\w$]*|"[0-9a-fA-F]{7,40}")\s*\)/u.exec(gate.condition);
  if (call === null) return null;
  const argument = call[1];
  if (argument.startsWith('"')) return argument.slice(1, -1);
  const declaration = new RegExp(`const\\s+${argument}\\s*=\\s*["']([0-9a-fA-F]{7,40})["']`, "u").exec(source);
  return declaration === null ? null : declaration[1];
}

function objectExists(sha: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", sha], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("every conditional test gate can be satisfied somewhere", () => {
  const files = testFiles();
  const sources = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
  const gates = conditionalGates(files, (file) => sources.get(file) ?? "");

  it("finds the conditional gates at all, so the verdicts below are not over an empty set", () => {
    expect(
      gates.length,
      "no conditional gate was found in tests/, so the walk or the pattern has broken and every " +
        "assertion below passes over nothing",
    ).toBeGreaterThan(MINIMUM_GATES);
  });

  it("reads a real gate and ignores one written inside a string", () => {
    /*
     * Both directions, in the exact form the scan meets them. The second is not hypothetical:
     * `diff-integrity.test.ts` holds a gate inside a fixture string to test its own case counter,
     * and a scanner that counted it would invent a gate — on a file whose subject is telling a real
     * conditional from an apparent one.
     */
    const real = 'describe.skipIf(process.platform === "win32")("x", () => {});';
    expect(
      conditionalGates(["real"], () => real).map((gate) => gate.condition),
      "a real conditional gate is no longer seen, so this file would report a clean estate over nothing",
    ).toEqual(['process.platform === "win32"']);

    const asFixture = 'expect(countTestCases(\'it.runIf(process.platform !== "win32")("a", () => {});\')).toBe(1);';
    expect(
      conditionalGates(["fixture"], () => asFixture),
      "a gate written inside a string literal was counted as a real one",
    ).toEqual([]);
  });

  it("still finds a gate standing after a regex literal that opens a comment or a quote", () => {
    /*
     * The subtractive direction, in the exact form the scan meets it. Without a regex state the
     * first line opens a block comment and the second opens a string, and everything after is
     * blanked — so the gate is not reported wrongly, it is not reported AT ALL.
     */
    const afterRegexHazards = [
      "const commentish = /[/*]/u;",
      "const quotish = /can't/u;",
      'it.skipIf(process.platform === "win32")("y", () => {});',
    ].join("\n");
    expect(
      conditionalGates(["hazards"], () => afterRegexHazards).map((gate) => gate.condition),
      "a regex literal swallowed the code after it, so a real gate downstream was never found — " +
        "the silent direction, which reads exactly like a clean estate",
    ).toEqual(['process.platform === "win32"']);

    const afterDivision = ["const half = total / 2;", 'it.skipIf(process.platform === "win32")("z", () => {});'].join(
      "\n",
    );
    expect(
      conditionalGates(["division"], () => afterDivision).map((gate) => gate.condition),
      "a division was read as the start of a regex, which opens the same silent hole from the " +
        "other side: live code blanked to the next slash",
    ).toEqual(['process.platform === "win32"']);
  });

  it("decides a platform gate by its VALUE, not by the mention of process.platform", () => {
    expect(platformSatisfiable('process.platform === "win32"')).toBe(true);
    expect(platformSatisfiable('process.platform !== "win32"')).toBe(true);
    expect(
      platformSatisfiable('process.platform === "darwin"'),
      "a gate pinned to a platform this project never runs on has exactly the property this file " +
        "exists to catch, and waving it through on the mention of process.platform was the hole",
    ).toBe(false);
    expect(
      platformSatisfiable('process.platform === "win32" && somethingElse'),
      "a shape this cannot read as one comparison must fall through to the declaration " +
        "requirement, never past it — guessing at a condition is the defect, one level up",
    ).toBeNull();
  });

  it("has no gate whose condition is false everywhere, and no stale entry claiming one is", () => {
    const unsatisfiable: string[] = [];
    const undeclared: string[] = [];

    for (const gate of gates) {
      const sha = gitObjectFor(gate, sources.get(gate.file) ?? "");
      if (sha !== null) {
        /*
         * The one condition decidable from here — but NOT because "a SHA is immutable, so absent
         * here is absent everywhere". That is false: a fetch of the ref makes the object exist.
         * It is decidable because absence holds in every clone that has not fetched it, and the
         * register is exact both ways, so a recovery reports itself as a stale entry.
         */
        if (!objectExists(sha)) unsatisfiable.push(`${gate.file} :: gitAvailable(${sha})`);
        continue;
      }
      const platform = platformSatisfiable(gate.condition);
      if (platform === true) continue; // reachable on one of REACHABLE_PLATFORMS
      if (platform === false) {
        // Pinned to a platform this project never runs on: the lost proof wearing a platform name.
        unsatisfiable.push(`${gate.file} :: ${gate.condition}`);
        continue;
      }
      // platform === null falls through: a shape this cannot read must be DECLARED, never waved past.
      if (/process\.env/u.test(gate.condition)) continue; // satisfiable where the variable is set
      const key = `${gate.file} :: ${gate.condition}`;
      if (!(key in DECLARED_UNDECIDABLE)) undeclared.push(key);
    }

    expect(
      unsatisfiable.filter((key) => !(key in KNOWN_UNSATISFIABLE)),
      "this gate's condition is false in every clone of this repository, so the test under it has " +
        "never run and cannot. That is a lost guard reporting as a skip. Restore what it depends on, " +
        "or record it in KNOWN_UNSATISFIABLE with the reason and who holds the decision — never " +
        "without one.",
    ).toEqual([]);

    expect(
      Object.keys(KNOWN_UNSATISFIABLE).filter((key) => !unsatisfiable.includes(key)),
      "recorded as unsatisfiable, but the condition can now be met. Remove the entry: a register of " +
        "lost guards that keeps recovered ones is a list of things that used to be true.",
    ).toEqual([]);

    expect(
      undeclared,
      "this gate's condition cannot be decided from a static read — it is neither a platform check, " +
        "an environment variable, nor a fixed git object. Declare it in DECLARED_UNDECIDABLE with " +
        "the reason, so a reader can tell 'considered and undecidable' from 'never looked at'.",
    ).toEqual([]);

    expect(
      Object.keys(DECLARED_UNDECIDABLE).filter(
        (key) => !gates.some((gate) => `${gate.file} :: ${gate.condition}` === key),
      ),
      "declared undecidable, but no gate has that condition any more",
    ).toEqual([]);
  });
});
