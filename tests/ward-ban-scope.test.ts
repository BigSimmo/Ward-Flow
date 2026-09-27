import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **THE CHECK THAT RUNS, BECAUSE THE LESSON THAT IS READ WAS MEASURED INSUFFICIENT.**
 *
 * `expectNeverSaysAgain` forbids a wording that was published once and withdrawn as false. It is
 * only as strong as **what it READS**. A ban scoped to one element cannot see the forbidden phrase
 * anywhere else on the same screen, so the retired claim returns, one element sideways, and every
 * arm still passes.
 *
 * **Measured four times in two days, in two separate ranges:**
 *
 *     the retired "no such field" claim, placed in a neighbouring element      37/37 PASSED
 *     two statistics data-entry framings, placed in a different article        66/66 PASSED
 *     "no timed state to measure", placed in a different article               66/66 PASSED
 *     the out-of-area single-cause explanation, in a new element on the board 105/105 PASSED
 *
 * The last was **false for every patient this prototype places from an emergency department**, and
 * it was in a range already reported complete, whose report already carried a written correction
 * naming this exact class.
 *
 * > **Knowing a trap by name does not stop you walking into it. Being handed the case it covers, in
 * > a form you recognise, is what fires it.** — Ward Builder Three, after doing the same thing
 * > inside an hour of writing the rule it broke.
 *
 * That is the whole argument for this file. Three chats independently demonstrated that the written
 * form does not fire; this one fires.
 *
 * ⚠️ **THE RULE INVERTS BY GUARD TYPE, AND APPLYING IT UNIFORMLY MAKES THINGS WORSE.** *"Narrow what
 * is READ"* is correct for a POSITIVE claim — a wide read there lets a bystander sentence satisfy a
 * claim its own paragraph has stopped making. For a BAN the phrase ANYWHERE is the defect, so a wide
 * read is correct and narrowing is what defeats it. **This file governs bans only.** Do not extend
 * it to `expectSays` or `expectCaption`; that would enforce the opposite of what they need.
 *
 * ⚠️ **THIS FILE READS TEST SOURCE AS TEXT**, so `npm run test:focused` cannot select it by import
 * graph. It runs in the full suite. That is a known property of this repository, not a defect here.
 */

// ---------------------------------------------------------------------------------------------
// What counts as a page- or screen-level read.
//
// 🔴 **KEYED ON THE ASSIGNMENT, NEVER ON THE VARIABLE NAME, and that is the whole design.** Ten of
// the eleven live call sites already bind their haystack to a variable called `page`. A check that
// required the argument to be *named* `page` would pass today, would pass on any future ban the
// moment somebody named a narrow variable `page`, and **could never fail for the reason it exists**
// — a guard satisfied by the text it scans, which is the defect shape this repository keeps
// recording. What matters is what the variable was read FROM.
// ---------------------------------------------------------------------------------------------

/**
 * Test ids that are a whole screen or page root. A ban may read one of these; reading anything
 * narrower is the defect.
 *
 * ⚠️ **Each entry states WHY it is a root.** Adding a narrow id here would silently widen what this
 * check accepts, so the reason is the thing a reviewer checks, and a bare addition should be
 * refused. A typo fails CLOSED — an id that matches nothing simply stops accepting the ban that
 * needs it — which is the safe direction.
 */
const PAGE_ROOT_TEST_IDS: ReadonlyArray<{ readonly id: string; readonly why: string }> = [
  {
    id: "ward-statistics-screen",
    why: "the outermost element of the statistics screen; every figure on that page is inside it",
  },
  {
    id: "ward-out-of-area-board",
    why: "the outermost element of the out-of-area board, containing every count, notice and row",
  },
];

/**
 * Bans allowed to read something narrower, each with a reason.
 *
 * ⚠️ **A reason is required, not decorative.** An exemption with no stated reason is
 * indistinguishable from a defect somebody silenced to get green, and it outlives whoever added it.
 * Keyed on the ban's SUBJECT rather than its line number, because line numbers drift and a stale
 * exemption silently stops applying — which is the failure mode this project has already recorded
 * for citations.
 */
const EXEMPT_SUBJECTS: ReadonlyArray<{ readonly subject: string; readonly why: string }> = [];

export type BanSite = {
  readonly file: string;
  readonly line: number;
  readonly argument: string;
  readonly subject: string;
  readonly assignment: string | null;
};

/** Blanks comments while preserving line numbering, so a mention in a docblock is not a call site. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (block) => "\n".repeat((block.match(/\n/gu) ?? []).length))
    .replace(/\/\/[^\n]*/gu, "");
}

/**
 * THE PREDICATE. Page-scoped, narrowed, or unresolved — decided from the ASSIGNMENT text alone.
 *
 * `unresolved` is deliberately its own answer rather than being folded into either verdict: a site
 * this cannot parse is a site nobody has checked, and calling it `page-scoped` would be the exact
 * substitution this file exists to prevent.
 */
export function classifyBanRead(assignment: string | null): "page-scoped" | "narrowed" | "unresolved" {
  if (assignment === null) return "unresolved";
  if (/\bdocument\s*\.\s*body\b/u.test(assignment)) return "page-scoped";

  const readIds = [...assignment.matchAll(/getByTestId\(\s*["'`]([^"'`]+)["'`]\s*\)/gu)].map((match) => match[1]);
  if (readIds.length === 0) return "unresolved";
  const roots = new Set(PAGE_ROOT_TEST_IDS.map((entry) => entry.id));
  return readIds.every((id) => roots.has(id)) ? "page-scoped" : "narrowed";
}

/** Every ban call site in the ward test files, with the assignment its haystack was read from. */
export function findBanSites(): { readonly sites: readonly BanSite[]; readonly rawCallCount: number } {
  const testsDir = join(process.cwd(), "tests");
  const files = readdirSync(testsDir)
    .filter((name) => /^ward-.*\.(dom\.test\.tsx|test\.ts)$/u.test(name))
    // 🔴 **THIS FILE EXCLUDES ITSELF, AND THE FIRST RUN IS WHY.** Its own source carries the string
    // `"expectNeverSaysAgain("` inside the matcher below, so the scan counted a twelfth call site it
    // could not parse and went red before it had checked anything. Comments are blanked; a string
    // literal is not. **Writing the defect down collided with the check for the defect** — a shape
    // this repository has recorded twice before, and the relative floor caught it on the first run
    // rather than letting the population quietly read as eleven-of-eleven.
    .filter((name) => name !== "ward-ban-scope.test.ts")
    .sort();

  const sites: BanSite[] = [];
  let rawCallCount = 0;

  for (const name of files) {
    const lines = withoutComments(readFileSync(join(testsDir, name), "utf8")).split("\n");
    // The NEAREST PRECEDING assignment, not the first in the file: several suites bind `page` or
    // `text` once per `it()`, and taking the first would attribute a later ban to an earlier read.
    const lastAssignment = new Map<string, string>();

    for (const [index, line] of lines.entries()) {
      const assigned = /(?:const|let)\s+(\w+)\s*=\s*(.+?);?\s*$/u.exec(line);
      if (assigned !== null) lastAssignment.set(assigned[1], assigned[2]);

      if (!line.includes("expectNeverSaysAgain(")) continue;
      rawCallCount += 1;

      const call = /expectNeverSaysAgain\(\s*([^,]+?)\s*,\s*("(?:[^"\\]|\\.)*"|`[^`]*`|[^,]+?)\s*,/u.exec(line);
      if (call === null) continue;

      const argument = call[1];
      const root = argument.split(/[.?[(]/u)[0].trim();
      sites.push({
        file: `tests/${name}`,
        line: index + 1,
        argument,
        subject: call[2].replace(/^["'`]|["'`]$/gu, ""),
        assignment: /\bdocument\s*\.\s*body\b|getByTestId/u.test(argument)
          ? argument
          : (lastAssignment.get(root) ?? null),
      });
    }
  }

  return { sites, rawCallCount };
}

describe("every retired-wording ban reads a whole page or screen", () => {
  const { sites, rawCallCount } = findBanSites();

  /**
   * ⚠️ **THE FLOOR IS RELATIVE, NOT A CONSTANT, and the difference decides whether it detects
   * anything.** A constant floor at eleven fires only when the count crosses eleven — arithmetic,
   * not detection. Add a twelfth ban and a call site that silently stops being parsed passes in
   * silence, because ten-plus-one still clears the bar. Comparing sites PARSED against calls FOUND
   * names the specific site that fell out, at any population size.
   */
  it("parses every ban call site it found, and names any it could not", () => {
    const parsed = sites.length;
    const unparsed = rawCallCount - parsed;
    expect(
      unparsed,
      `${unparsed} expectNeverSaysAgain call site(s) were found in the ward tests but could not be ` +
        "parsed by this check, so nobody has checked their scope. A ban this file cannot read is " +
        "not a ban this file has cleared. Fix the parser rather than the count.",
    ).toBe(0);
    // And a population that emptied would satisfy the comparison above trivially.
    expect(parsed, "no ban call sites were found at all — this check walked an empty population").toBeGreaterThan(0);
  });

  it.each(findBanSites().sites.map((site) => [`${site.file}:${site.line} — ${site.subject}`, site] as const))(
    "%s reads a page or screen root",
    (_label, site) => {
      const exemption = EXEMPT_SUBJECTS.find((entry) => entry.subject === site.subject);
      if (exemption !== undefined) {
        expect(exemption.why.length, `the exemption for "${site.subject}" carries no reason`).toBeGreaterThan(20);
        return;
      }

      expect(
        classifyBanRead(site.assignment),
        `this ban reads \`${site.argument}\`, assigned from \`${site.assignment ?? "(unresolved)"}\`, ` +
          "which is narrower than a page or screen root. A ban scoped to one element cannot see the " +
          "forbidden wording anywhere else on the same screen — measured four times: the retired " +
          "claim placed one element sideways passed every test. Read the screen root instead, or add " +
          "an entry to EXEMPT_SUBJECTS with a reason.",
      ).toBe("page-scoped");
    },
  );

  /**
   * A root id that matched nothing would quietly stop accepting the ban that needs it — safe, but
   * confusing. This says so out loud instead.
   */
  it.each(PAGE_ROOT_TEST_IDS.map((entry) => [entry.id, entry] as const))(
    "the declared page root %s is a real test id, with a stated reason",
    (id, entry) => {
      expect(entry.why.length, `the page root "${id}" is declared with no reason`).toBeGreaterThan(20);
      const src = join(process.cwd(), "src");
      const found = (function search(dir: string): boolean {
        for (const item of readdirSync(dir, { withFileTypes: true })) {
          const path = join(dir, item.name);
          if (item.isDirectory()) {
            if (search(path)) return true;
          } else if (/\.tsx?$/u.test(item.name) && readFileSync(path, "utf8").includes(`data-testid="${id}"`)) {
            return true;
          }
        }
        return false;
      })(src);
      expect(found, `the declared page root "${id}" is rendered by no component — it is a dead entry`).toBe(true);
    },
  );
});

/**
 * 🔴 **THE CHECK'S OWN BOTH-ARMS PROOF, against the REAL predicate rather than a restatement of it.**
 *
 * A guard nobody has watched fail is indistinguishable from one that cannot fail — which is the
 * premise of the entire programme this file came out of. These call `classifyBanRead` itself, so a
 * change to the predicate that broke it would redden here rather than being shadowed by a copy that
 * drifted.
 */
describe("the scope check can actually tell the two apart", () => {
  it("accepts the two shapes the live bans use", () => {
    expect(classifyBanRead('document.body.textContent ?? ""')).toBe("page-scoped");
    expect(classifyBanRead('(document.body.textContent ?? "").toLowerCase()')).toBe("page-scoped");
    expect(classifyBanRead('normalise(screen.getByTestId("ward-statistics-screen").textContent)')).toBe("page-scoped");
    expect(classifyBanRead('screen.getByTestId("ward-out-of-area-board").textContent ?? ""')).toBe("page-scoped");
  });

  it("rejects the real narrowed reads that were measured defective", () => {
    // Every one of these is the ACTUAL pre-fix assignment from a ban that let the retired claim back
    // onto the screen, copied from the commit that widened it.
    expect(classifyBanRead('screen.getByTestId("ward-statistics-readiness-timing-absent").textContent ?? ""')).toBe(
      "narrowed",
    );
    expect(classifyBanRead('screen.getByTestId("ward-statistics-referral-join-absent").textContent ?? ""')).toBe(
      "narrowed",
    );
    expect(classifyBanRead('screen.getByTestId("ward-out-of-area-count-not-banded").textContent ?? ""')).toBe(
      "narrowed",
    );
  });

  /**
   * ⚠️ **THE ONE THAT PROVES IT IS NOT KEYED ON THE NAME.** Ten of eleven live sites bind their
   * haystack to `page`. If this check were satisfied by the identifier, this narrow read would pass
   * — and the check would be decoration.
   */
  it("rejects a narrow read no matter what the variable is called", () => {
    expect(classifyBanRead('screen.getByTestId("ward-statistics-refused-so-far-why-so-far").textContent')).toBe(
      "narrowed",
    );
  });

  it("refuses to guess when it cannot see what was read", () => {
    expect(classifyBanRead(null)).toBe("unresolved");
    expect(classifyBanRead("someHelperNobodyHasSeen()")).toBe("unresolved");
    // ⚠️ Not "page-scoped". An unparsed site is an UNCHECKED site, and recording it as cleared is
    // the predicate-for-guard substitution this whole file exists to stop.
  });

  it("rejects a mixed read that touches a root and something narrower", () => {
    expect(
      classifyBanRead(
        'screen.getByTestId("ward-statistics-screen").textContent + screen.getByTestId("ward-statistics-bed-readiness").textContent',
      ),
    ).toBe("narrowed");
  });
});
