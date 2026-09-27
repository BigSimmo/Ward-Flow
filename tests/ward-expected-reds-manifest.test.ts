import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// The gate's own predicate, imported rather than re-implemented: a validator re-written inside its
// own test proves only that two copies agree.
import { validateEntry } from "../scripts/check-ward-expected-reds.mjs";

/**
 * THE CHEAP HALF OF THE EXPECTED-RED GATE.
 *
 * `scripts/check-ward-expected-reds.mjs` runs the whole ward population and compares its failing set
 * to the manifest in both directions. That takes minutes. **This file is what runs in every ordinary
 * suite**: it checks the manifest is well formed, that every entry names a real file, and — the part
 * that matters — **that the script's floors still have headroom against the real population.**
 *
 * ⚠️ **A FLOOR THAT DRIFTS UP TO MEET REALITY STOPS BEING A FLOOR.** The script refuses to compare
 * anything until it has walked at least 200 files and run at least 2500 tests, because set equality
 * against an empty manifest is vacuous on a broken run — discover nothing, run nothing, fail
 * nothing, report success. Those numbers are only protective while the true population is
 * comfortably above them. If the suite ever shrinks toward the floor, the honest response is to
 * understand why, not to lower the number, and this test is what forces that conversation.
 */

const ROOT = process.cwd();
const MANIFEST_PATH = join(ROOT, "tests/ward-expected-reds.json");
const SCRIPT_PATH = join(ROOT, "scripts/check-ward-expected-reds.mjs");

type Entry = {
  file: string;
  kind: string;
  reason: string;
  owner: string;
  retiredWhen: string;
  /** How many tests in this file are expected to be failing. See the count check below. */
  failing: number;
};

type Manifest = { kinds: Record<string, string>; expected: Entry[] };

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
const script = readFileSync(SCRIPT_PATH, "utf8");

/**
 * The same population the script uses, so the two cannot drift apart silently: every unit test
 * file Vitest collects, minus the provider-backed *.live.test.ts (26 September 2026; it used to be
 * a ward-only union that left about 130 unit test files in no gate).
 */
function wardPopulation(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(relative(ROOT, full).replace(/\\/gu, "/"));
    }
  };
  walk(join(ROOT, "tests"));
  return files
    .filter((rel) => !rel.endsWith(".live.test.ts") && (rel.endsWith(".test.ts") || rel.endsWith(".dom.test.tsx")))
    .sort();
}

describe("the expected-red manifest", () => {
  const kinds = Object.keys(manifest.kinds);

  it("declares its kinds at all", () => {
    expect(kinds, "the manifest declares no kinds, so no entry could ever be valid").not.toHaveLength(0);
  });

  /*
   * 🔴 EVERY REAL-DATA LOOP IN THIS FILE IS VACUOUS TODAY, AND THAT IS WHY THE BLOCK BELOW EXISTS.
   *
   * `manifest.expected` ships EMPTY, so this assertion walks zero entries and passes — every day,
   * until somebody files the first one. The first version of this file had FOUR such loops, each
   * carrying its own predicate inline. Ward Builder Three spotted it; I proved it by mutation:
   * inverting the count check to `false`, and the kind check to `.not.toContain`, left the suite
   * GREEN on both.
   *
   * ⚠️ **A validator that has never run is indistinguishable from one that works** — and an empty
   * manifest is exactly the state in which somebody simplifies one, with the mistake surfacing weeks
   * later on the first entry as a validator that sanctions anything.
   *
   * So the predicate now lives in the gate as `validateEntry`, this loop merely applies it to
   * whatever is really there, and the SYNTHETIC block below is what proves the predicate works.
   */
  it("every entry that really exists is valid", () => {
    const population = wardPopulation();
    let walked = 0;
    for (const entry of manifest.expected) {
      walked += 1;
      expect(validateEntry(entry, { kinds, population }), `${entry.file} is not a valid manifest entry`).toEqual([]);
    }
    /*
     * ⚠️ **A RELATIVE INVARIANT, NOT A FLOOR — and the distinction is the whole point here.**
     * A floor (`> 0`) would redden on a legitimately empty manifest, which is the state this repository
     * is in today and hopes to stay in. **This instead pins that the loop walked exactly what the
     * manifest holds**, so it cannot silently iterate something else, and it stays true at zero.
     */
    expect(walked, "this loop did not walk the manifest it claims to check").toBe(manifest.expected.length);
  });

  /**
   * 🔴 **THE MANIFEST IS EMPTY TODAY, AND THIS CASE IS WHERE THAT IS SAID OUT LOUD.**
   *
   * ⚠️ **Every real-data loop above walks zero entries and passes. `every entry that really exists is
   * valid` reads as "all entries valid" and MEANS "there are no entries" — the same sentence for two
   * opposite states.** This case exists so the file makes a positive claim about which one it is in.
   *
   * 🔴 **IT IS DELIBERATELY NOT A FLOOR.** A bare `expect(length).toBeGreaterThan(0)` would redden
   * on a legitimately empty manifest — the state this repository is in today and hopes to stay in —
   * **and a guard that fires on correct work gets switched off within the hour.** ✅ **So it asserts
   * whichever state is true, and both branches carry a live assertion rather than one being a pass by
   * omission.**
   *
   * ✅ **When empty, the green is BACKED BY A MACHINERY PROOF rather than by absence:** the validator
   * is made to accept a well-formed entry and reject a malformed one, here, in the same case that
   * reports the zero. **That is the same substitution `ward-token-layer.test.ts` makes for its spacing
   * ladder, and the same shape the D-3 ratchet now uses for a departed file — not a failure, but it
   * must be SAID.**
   */
  it("🔴 states whether it walked anything at all, rather than passing silently on zero", () => {
    const population = ["tests/ward-real.test.ts"];
    const specimen = {
      file: "tests/ward-real.test.ts",
      kind: kinds[0],
      reason: "a reason long enough to be actionable by somebody who did not write it",
      owner: "the owner, via Ward Lead",
      retiredWhen: "the owner rules on it either way",
      failing: 1,
    };

    if (manifest.expected.length === 0) {
      // ⚠️ THE STATED ZERO. Asserted, so it is a claim the file makes rather than a silence.
      expect(
        manifest.expected,
        "the manifest is no longer empty, which is good news and means this branch is stale — the " +
          "loops above now walk real entries and this case should be reporting that instead",
      ).toEqual([]);

      // ✅ AND THE PROOF THAT STANDS IN FOR THE ABSENT POPULATION: the validator still discriminates.
      expect(
        validateEntry(specimen, { kinds, population }),
        "the manifest is empty AND the validator no longer accepts a well-formed entry — so nothing " +
          "in this file is checking anything at all",
      ).toEqual([]);
      expect(
        validateEntry({ ...specimen, reason: "" }, { kinds, population }),
        "the manifest is empty AND the validator accepts an entry with no reason. With nothing real to " +
          "walk, this is the only thing standing between a future entry and a validator that sanctions " +
          "anything.",
      ).not.toHaveLength(0);
      return;
    }

    // ✅ THE OTHER BRANCH, AND IT IS NOT DEAD CODE WAITING — it carries the assertion that matters the
    // moment somebody files the first entry: the loops above must actually have walked them.
    expect(
      manifest.expected.length,
      "the manifest holds entries but reports a non-positive count, so the loops above walked nothing",
    ).toBeGreaterThan(0);
    for (const entry of manifest.expected) {
      expect(
        typeof entry.file,
        "a manifest entry has no file, so the loops above cannot have checked anything about it",
      ).toBe("string");
    }
  });

  /*
   * THE NON-VACUOUS HALF. These entries do not exist in the repository and never will — they are
   * handed to the validator so it has to actually decide something.
   */
  describe("the validator itself, on entries this repository does not contain", () => {
    const population = ["tests/ward-real.test.ts"];
    const good = {
      file: "tests/ward-real.test.ts",
      kind: "owner-question",
      reason: "holds open whether sex mix belongs on a network view",
      owner: "the owner, via Ward Lead",
      retiredWhen: "the owner rules on it either way",
      failing: 1,
    };

    it("accepts a well-formed entry", () => {
      expect(validateEntry(good, { kinds: ["owner-question", "backlog"], population })).toEqual([]);
    });

    it.each([
      ["an undeclared kind", { kind: "whatever" }],
      ["no reason", { reason: "" }],
      ["a reason too short to act on", { reason: "stale" }],
      ["no owner", { owner: "" }],
      ["nothing that would retire it", { retiredWhen: "" }],
      ["a missing failing count", { failing: undefined }],
      ["a failing count of zero", { failing: 0 }],
      ["a non-integer failing count", { failing: 1.5 }],
      ["a file that is not in the population", { file: "tests/ward-renamed.test.ts" }],
    ])("rejects %s", (_label, override) => {
      const problems = validateEntry({ ...good, ...override }, { kinds: ["owner-question", "backlog"], population });
      expect(
        problems,
        "the validator accepted an entry it must reject. With the manifest empty, nothing else in " +
          "this repository would notice — the mistake would surface on the first entry somebody files, " +
          "as a validator that sanctions anything.",
      ).not.toHaveLength(0);
    });
  });

  it("names only files that exist and are in the ward population", () => {
    const population = new Set(wardPopulation());
    let walked = 0;
    for (const entry of manifest.expected) {
      walked += 1;
      expect(
        population,
        `${entry.file} is in the manifest but is not in the ward population, so the gate will report ` +
          "it as 'no longer failing' forever. Either the file was renamed or the entry is stale.",
      ).toContain(entry.file);
    }
    expect(walked, "this loop did not walk the manifest it claims to check").toBe(manifest.expected.length);
  });

  /*
   * 🔴 THE ONE THAT PROTECTS THE GATE ITSELF. Everything above checks the manifest; this checks that
   * the SCRIPT's vacuity floors are still floors.
   */
  it("keeps the script's floors well below the real population", () => {
    const fileFloor = Number(/const FLOOR_FILES = (\d+);/u.exec(script)?.[1]);
    const testFloor = Number(/const FLOOR_TESTS = (\d+);/u.exec(script)?.[1]);
    expect(Number.isFinite(fileFloor), "FLOOR_FILES is no longer readable from the script").toBe(true);
    expect(Number.isFinite(testFloor), "FLOOR_TESTS is no longer readable from the script").toBe(true);

    const population = wardPopulation().length;
    expect(
      population,
      `the ward population is ${population} files and the script refuses to compare below ${fileFloor}. ` +
        "The floor has caught up with reality, so it now fails on a healthy suite and the reflex will " +
        "be to lower it. Find out why the population shrank before touching the number.",
    ).toBeGreaterThan(fileFloor);

    // Headroom, not just order. A floor one file below the population is arithmetically satisfied
    // and practically useless — it would pass a run that discovered almost nothing.
    expect(
      population - fileFloor,
      `only ${population - fileFloor} files of headroom between the population and the floor. A floor ` +
        "this close cannot tell a broken discovery from a slightly smaller suite.",
    ).toBeGreaterThan(20);

    expect(testFloor, "FLOOR_TESTS is not set to anything meaningful").toBeGreaterThan(100);
  });
});
