import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * ═══ THREE FACTS, ONE WORDING EACH — AND NOTHING PINNED ANY OF THE TWELVE ════════════════════════
 *
 * D-47 ruled one rendered wording per absent fact. Before that ruling there were twelve sentences
 * for three facts:
 *
 *     the legal form is absent       5 sentences   Movement.legalForm
 *     the origin service unresolved  4 sentences   movementHealthService()
 *     no expected discharge date     3 sentences   Admission.expectedDischargeAt
 *
 * 🔴 **AND NOT ONE OF THE TWELVE WAS ASSERTED BY ANY TEST.** A repo-wide search for the retired
 * wordings across `tests/` returned nothing, so the whole suite was indifferent to which of the
 * twelve a coordinator read — and would have been equally indifferent to a thirteenth.
 *
 * ⚠️ **This file does NOT pin the chosen wording.** Pinning a literal is how a test becomes a
 * ruling nobody can revisit, and D-47 may be reworded by the owner tomorrow. It pins the PROPERTY
 * the ruling is about: **the retired variants are gone, and the canonical one actually reaches the
 * sites it is supposed to reach.**
 *
 * ✅ **Both arms are floored.** A scan that stops finding files returns zero retired variants and
 * would pass while reading nothing — so the canonical arm requires a POSITIVE count, and the
 * population itself is floored before either assertion runs. A guard whose clean answer and whose
 * broken answer look identical is the defect this programme has catalogued all week.
 */

const NL = /\r?\n/u;

/** Every tracked source line under the ward module, discovered rather than listed. */
function wardSourceLines(): { file: string; line: string }[] {
  return execFileSync("git", ["ls-files", "src/components/ward-management"], { encoding: "utf8" })
    .split(NL)
    .filter((file) => /\.tsx?$/u.test(file))
    .flatMap((file) => {
      const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      return text.split(NL).map((line) => ({ file, line }));
    });
}

/**
 * The wordings D-47 retired. Each was a rendered sentence, not a comment — so a match here is a
 * regression and not a citation.
 *
 * ⚠️ A retired wording quoted INSIDE a comment would fail this check for the wrong reason. That is
 * deliberate: the repository has already been bitten by a doc comment quoting the string it
 * removes, and "explain it in prose without the exact words" is the cheaper half of that lesson.
 */
const RETIRED = [
  "No legal form is recorded on this movement",
  "No legal form recorded for this movement",
  "Health service unknown",
  "No health service could be resolved",
  "No discharge date recorded",
] as const;

/** What D-47 ruled, and the floor each must clear. The counts are MINIMA, never exact totals. */
const CANONICAL: { readonly wording: string; readonly atLeast: number }[] = [
  // 4 fact sites + the verdict sentence, which carries the fact INSIDE it so a reader can see the
  // readiness line and the fact grid are talking about one thing.
  //
  // ⚠️ The verdict reads "Not ready — no legal form recorded." — the same words with the leading
  // capital dropped, because it is mid-sentence. The ruling said "verbatim" and that was an
  // overstatement; this floor caught it on its first run, which is the floor doing its job on the
  // author rather than on a stranger. Matched case-insensitively for that reason, and ONLY for
  // that reason: a fifth site spelling it differently in any other way still fails.
  { wording: "No legal form recorded", atLeast: 5 },
  { wording: "Origin service not identified", atLeast: 4 },
  { wording: "No expected date set", atLeast: 2 },
];

describe("an absent fact has one rendered wording", () => {
  const lines = wardSourceLines();

  it("read a real population, or every assertion below is about nothing", () => {
    expect(
      lines.length,
      "git ls-files returned no ward source; both assertions below would pass having read nothing",
    ).toBeGreaterThan(10_000);
  });

  it("carries none of the wordings D-47 retired", () => {
    const survivors = RETIRED.flatMap((retired) =>
      lines.filter(({ line }) => line.includes(retired)).map(({ file }) => `${retired} — ${file}`),
    );
    expect(
      survivors,
      "a wording D-47 retired is still in ward source. Three facts had twelve sentences between " +
        "them and a coordinator could not tell they were three facts. If you are adding a site, " +
        "use the canonical wording; if you are changing the wording, change every site and this " +
        "list, because nothing else compares them.",
    ).toEqual([]);
  });

  it("and the canonical wording actually reaches its sites", () => {
    for (const { wording, atLeast } of CANONICAL) {
      const needle = wording.toLowerCase();
      const hits = lines.filter(({ line }) => line.toLowerCase().includes(needle)).length;
      expect(
        hits,
        `"${wording}" should reach at least ${atLeast} sites and reaches ${hits}. ` +
          "🔴 This floor is what stops the check above passing vacuously: a scan that stopped " +
          "finding files would report zero retired variants and look clean.",
      ).toBeGreaterThanOrEqual(atLeast);
    }
  });
});
