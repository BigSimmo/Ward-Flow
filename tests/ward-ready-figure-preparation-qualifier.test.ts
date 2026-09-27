// tests/ward-ready-figure-preparation-qualifier.test.ts
//
// 🔴 A SCREEN THAT PRINTS A "READY" BED FIGURE MUST ALSO SAY HOW MANY OF THOSE BEDS ARE STILL BEING
// MADE READY. THE OWNER RULED IT ON 2026-09-05 AND IT REACHED THREE SCREENS OUT OF FOUR.
//
// The figure itself is correct and must NOT change. `capacityBreakdown().availableNow` deliberately
// subtracts nothing for a preparation note — that file's own header carries the rule, and the
// owner's 2026-09-01 ruling behind it: asked whether a bed being cleaned should drop the ward's
// number or merely refuse the pull, he chose the refusal, because "the ward has not changed what it
// can staff, so its figures must not lurch as cleaning starts and stops".
//
// ⚠️ SO THE DEFECT IS NEVER A WRONG NUMBER. It is a correct number presented without the sentence
// that makes it safe to act on: the reducer refuses `PULL_PATIENT` with "every free bed at X is
// still being made ready", so a coordinator reading a bare "2 ready beds" can commit a patient and
// be refused at the moment of action, after the ward has been told.
//
// 🔴 WHY IT REACHED THREE SCREENS AND MISSED THE FOURTH, WHICH IS THE POINT OF THIS FILE. The ruling
// was guarded per-screen. Every screen's own suite passed, before and after, because each one only
// ever asserted about itself — and a ruling expressed once per screen cannot notice the screen
// nobody wrote a case for. This asserts the property over the SET.
//
// ⚠️ AND IT DOES NOT EXEMPT ON REACHABILITY, DELIBERATELY. It would be tempting to skip a component
// no route renders. Reachability is exactly the thing that changes without anyone noticing — it
// changed for `flow-diagram.tsx` between one session's measurement and the next, where a component
// with no direct app-route reference turned out to be rendered by `CoordinatorScreen`, which has
// one. An exemption resting on a measurement that decays is how the fourth screen gets missed
// again. Adding the qualifier to an unrendered component costs nothing; leaving a live one out
// costs a clinician.
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const WARD = "src/components/ward-management";

/**
 * A screen states the qualifier if it consults the pending-preparation figure by EITHER route:
 * calling `bedsPendingPreparation` directly (ward-screen, ed-screen) or receiving it through a
 * derivation (capacity-screen gets `pendingPreparation` from `networkWardRows`). Matching only the
 * helper name would report `capacity-screen` — which states the qualifier — as a defect.
 */
const QUALIFIER_MARK = /bedsPendingPreparation\(|\.pendingPreparation\b/u;
// 🔴 THE CALL OR THE PROPERTY ACCESS — NEVER THE BARE IDENTIFIER, AND THE CONTROL IS WHAT FOUND
// THAT. This first read `pendingPreparation` as a token. Reverting a repaired screen to
// `const pendingPreparation = 0;` then left the identifier in the file, so all four mutants
// SURVIVED: the guard was matching the NAME rather than the consultation of the figure, which is
// the exact defect it exists to catch, one level up.
//
// `bedsPendingPreparation(` covers a direct call (ward-screen, ed-screen and the four repaired
// screens); `.pendingPreparation` covers arrival through a derivation (capacity-screen reads it off
// `networkWardRows`). A local variable holding a literal matches neither.
//
// ⚠️ Also note `pendingPreparation` is not a substring of `bedsPendingPreparation` — the capital P
// breaks it — so both forms have to be written out.

/**
 * 🔴 A CONJUNCTION, AND THE FIRST HALF ALONE IS A CLINICAL FALSE POSITIVE.
 *
 * "Ready" is a homonym in this domain: a ready BED, and a patient ready to LEAVE. Selecting on the
 * rendered word alone pulled in `statistics-compare-screen.tsx` (`header: "Ready, blocked"` over
 * `readyToLeaveCannot`), `statistics-ward-screen.tsx` (`Ready to leave, and blocked`) and
 * `discharges/discharge-board.tsx` — **discharge screens about PATIENTS**, which would then have
 * been required to carry a bed-cleaning note. That is nonsense on those screens and is how a guard
 * gets disabled rather than obeyed.
 *
 * So a screen is in scope only when it renders the word AND derives a bed-availability figure. The
 * availability list covers every route in the tree: `capacityBreakdown().availableNow`,
 * `headlineAvailable()`, `unitCapacity(...).available`, and `networkWardRows`' `.ready`.
 */
const READY_MARK = /\bReady\b|\bready bed/u;
const AVAILABILITY_MARK = /\.available\b|availableNow|headlineAvailable\(|\.ready\b/u;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const posix = (path: string): string => path.split("\\").join("/");

/**
 * Comments blanked, newlines preserved. A screen that merely DISCUSSES the qualifier in prose has
 * not stated it to anybody — and these files carry long doc comments naming every figure they
 * render, so a text scan that counted comments would report the estate as clean while it is not.
 * That is not hypothetical here: the first measurement of this defect counted 13 "being made ready"
 * mentions in `ward-screen.tsx`, every one of them inside a comment.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, (block) => block.replace(/[^\n]/gu, " ")).replace(/\/\/[^\n]*/gu, "");
}

/** Components under the ward tree, excluding tests and non-components. */
const COMPONENTS = walk(WARD)
  .map(posix)
  .filter((file) => file.endsWith(".tsx"));

interface Screen {
  readonly file: string;
  readonly source: string;
}

const SCREENS: Screen[] = COMPONENTS.map((file) => ({ file, source: stripComments(readFileSync(file, "utf8")) }));

/** A component that renders a ready-BED figure, in code rather than in prose. */
function rendersReadyFigure(screen: Screen): boolean {
  return READY_MARK.test(screen.source) && AVAILABILITY_MARK.test(screen.source);
}

/** A component that consults the pending-preparation figure, by either route. */
function statesQualifier(screen: Screen): boolean {
  return QUALIFIER_MARK.test(screen.source);
}

describe("every ward screen printing a ready-bed figure also states how many are being made ready", () => {
  it("walks a real component tree and finds screens that actually derive the figure (anti-vacuity)", () => {
    // 🔴 FLOOR THE POPULATION WALKED AND THE POPULATION IN SCOPE — never the findings. A scan that
    // read nothing, and a scan whose in-scope predicate matched nothing, both report a clean estate.
    expect(COMPONENTS.length, `only ${COMPONENTS.length} ward components found — the walk is broken`).toBeGreaterThan(
      20,
    );
    const inScope = SCREENS.filter(rendersReadyFigure);
    expect(
      inScope.length,
      "no ward component derives an availability figure at all, so the rule below has no subject — " +
        "either the derivation was renamed or the comment strip is eating the file",
    ).toBeGreaterThan(2);
  });

  it("does not mistake prose for a statement, in either direction", () => {
    // ⚠️ BOTH DIRECTIONS. A guard that only checked "the name appears" would be satisfied by the
    // doc comment explaining the rule — and these files are heavily commented, so that is the
    // likely failure rather than an exotic one.
    const commented = `/* this screen calls bedsPendingPreparation(unit.id, bedReleases) somewhere */\nconst x = 1;\n`;
    expect(statesQualifier({ file: "f", source: stripComments(commented) }), "a comment satisfied the check").toBe(
      false,
    );

    const real = `import { bedsPendingPreparation } from "x";\nconst pending = bedsPendingPreparation(unit.id, bedReleases);\n`;
    expect(statesQualifier({ file: "f", source: stripComments(real) }), "a real call was not detected").toBe(true);

    // A real ready-BED screen: the word and a figure behind it.
    const bedScreen = `<span>Ready {capacity.available}</span>`;
    expect(rendersReadyFigure({ file: "f", source: bedScreen }), "a real ready-bed screen was not detected").toBe(true);

    // 🔴 THE CLINICAL FALSE POSITIVE, PINNED. "Ready" also means a PATIENT ready to leave, and two
    // discharge-statistics screens say exactly this. A guard on the word alone would demand a
    // bed-cleaning note on a screen about people waiting for discharge — nonsense there, and the
    // way a guard earns being switched off. Both must stay out of scope.
    for (const patientScreen of [
      `<h3>Ready to leave, and blocked</h3>{count(statistics.readyToLeaveCannot)}`,
      `{ header: "Blocker recorded", cell: (s) => count(s.readyToLeaveCannot) }`,
      `{ header: "Ready, blocked", cell: (s) => count(s.readyToLeaveCannot) }`,
    ]) {
      expect(
        rendersReadyFigure({ file: "f", source: patientScreen }),
        "a discharge screen about PATIENTS ready to leave was pulled into a BED-preparation rule",
      ).toBe(false);
    }

    // And the qualifier is recognised by either route — direct call, or through a derivation.
    expect(statesQualifier({ file: "f", source: `const p = bedsPendingPreparation(id, r);` })).toBe(true);
    expect(statesQualifier({ file: "f", source: `{row.pendingPreparation} still being made ready` })).toBe(true);
  });

  it("states the qualifier on every screen that derives the figure", () => {
    const missing = SCREENS.filter(rendersReadyFigure)
      .filter((screen) => !statesQualifier(screen))
      .map((screen) => `  ${screen.file.slice(`${WARD}/`.length)}`);

    expect(
      missing,
      "these ward components derive an available-beds figure and never state how many of those beds " +
        "are still being made ready:\n" +
        missing.join("\n") +
        `\n\n  The number is correct and must not change — \`availableNow\` deliberately subtracts ` +
        "nothing for a preparation note, because the owner ruled the ward's figure must not lurch as " +
        "cleaning starts and stops. What is missing is the sentence beside it. Read " +
        `\`bedsPendingPreparation\` and say the count, in the wording the other screens already use.\n` +
        "  Reachability is NOT an exemption: it changes without anyone noticing, which is how this " +
        "ruling reached three screens and missed a fourth.",
    ).toEqual([]);
  });
});
