// tests/ward-stylesheet-duplicate-block.test.ts
//
// 🔴 A WHOLE SECTION OF A WARD STYLESHEET WAS PRESENT TWICE, AND THE DEAD COPY WAS THE ONE
// CARRYING THE ACCESSIBILITY FIX.
//
// `ward/ward.module.css` held **300 lines duplicated verbatim** — 21 top-level selectors, an entire
// `@media print` block, and the confirm panel and entry hero — as two adjacent copies. Duplication
// on its own is only waste. What made it a defect is that the two copies were not identical: they
// differed on exactly four declarations, and in every one of the four the EARLIER copy used
// `--ward-border` / `--ward-divider` while the LATER copy used `var(--wf-border, var(--neutral-500))`.
//
// Later wins. So a token migration that had been done, reviewed and left looking complete was dead
// on all four, and `--wf-border` is not defined anywhere in that file — it fell through to
// `--neutral-500`, a fixed neutral. `--ward-border` and `--ward-divider` ARE re-pointed inside
// `@media (forced-colors: active)`; `--neutral-500` is not. **Four borders on the ward screen lost
// their high-contrast handling, and the file contained the correct value the whole time.**
//
// ⚠️ WHY NOTHING CAUGHT IT, AND WHY THIS IS NOT A DUPLICATE-SELECTOR GUARD. The obvious rule — "a
// stylesheet must not define the same top-level selector twice" — is WRONG here and would be a
// fighter. 18 of the 51 ward stylesheets do that legitimately, and `ward.module.css` still does
// after the fix: `.declineButton` is declared once for layout and again for border/background/colour,
// with no property in common, so both fully apply. Banning that would send people to merge rules
// that are clearer apart. **The property that separates the defect from the idiom is not repetition
// of a NAME, it is repetition of a SPAN** — no hand-written stylesheet repeats forty consecutive
// lines. Measured before this guard was written: exactly one of the 51 ward stylesheets violated
// it, and it was the broken one.
//
// Being a `readFileSync` scanner it imports nothing from `src/`, so `npm run test:focused` can
// never select it. It runs in the full suite. Same limitation as
// `tests/ward-status-colour-reach.test.ts`, and for the same reason.
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const WARD = "src/components/ward-management";

/**
 * Forty lines. Long enough that no author writes it twice by hand — the shortest real rule block in
 * these files is a handful of lines — and short enough to catch a duplicated section well before it
 * reaches the 300 lines that actually shipped.
 */
const WINDOW = 40;

/**
 * A window has to be mostly substantive before it counts. Runs of blank lines, closing braces and
 * comment continuation legitimately repeat, and a guard that fired on those would be answered by
 * deleting blank lines rather than by fixing anything.
 */
const SUBSTANTIVE_FRACTION = 0.6;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const posix = (path: string): string => path.split("\\").join("/");

interface Repeat {
  readonly firstLine: number;
  readonly secondLine: number;
}

/**
 * The first repeated substantive window in a stylesheet, or null. Returns line numbers rather than a
 * boolean so the failure names where to look — a bare "this file has a duplicate" sends the reader
 * to scroll a thousand lines.
 */
function firstRepeatedWindow(source: string): Repeat | null {
  const lines = source.split(/\r?\n/u);
  const seen = new Map<string, number>();
  for (let index = 0; index + WINDOW <= lines.length; index += 1) {
    const window = lines.slice(index, index + WINDOW);
    const substantive = window.filter((line) => line.trim().length > 3).length;
    if (substantive < WINDOW * SUBSTANTIVE_FRACTION) continue;
    const digest = createHash("sha1").update(window.join("\n")).digest("hex");
    const earlier = seen.get(digest);
    if (earlier !== undefined) return { firstLine: earlier + 1, secondLine: index + 1 };
    seen.set(digest, index);
  }
  return null;
}

/** How many windows were actually hashed, so "found nothing" can be told from "looked at nothing". */
function windowsExamined(source: string): number {
  const lines = source.split(/\r?\n/u);
  let count = 0;
  for (let index = 0; index + WINDOW <= lines.length; index += 1) {
    const window = lines.slice(index, index + WINDOW);
    if (window.filter((line) => line.trim().length > 3).length >= WINDOW * SUBSTANTIVE_FRACTION) count += 1;
  }
  return count;
}

const SHEETS = walk(WARD)
  .map(posix)
  .filter((file) => file.endsWith(".css"));

describe("no ward stylesheet contains the same section twice", () => {
  it("reads a real population and actually hashes windows in it (anti-vacuity)", () => {
    // Floored on what was WALKED and what was EXAMINED, never on what was found. A scanner that
    // reads nothing, and a scanner whose substantive-fraction filter rejects everything, both
    // report a clean estate.
    expect(SHEETS.length, `only ${SHEETS.length} ward stylesheets found — the walk is broken`).toBeGreaterThan(40);
    const examined = SHEETS.reduce((total, sheet) => total + windowsExamined(readFileSync(sheet, "utf8")), 0);
    expect(
      examined,
      `only ${examined} windows were hashed across ${SHEETS.length} stylesheets — the substantive-fraction ` +
        "filter is rejecting real CSS, so every file below would look clean",
    ).toBeGreaterThan(2000);
  });

  it("finds a duplicated span, and does not fire on a long stylesheet that merely repeats a selector", () => {
    // 🔴 WITHOUT THIS THE GUARD IS DECORATION. Every ward stylesheet now passes, so the assertion
    // below runs over an empty list — which is exactly what a detector that matches nothing
    // produces. Checked in BOTH directions, because the tempting over-broad rule ("same selector
    // twice") is one this file must keep NOT firing on: 18 ward stylesheets do that legitimately.
    const rule = (name: string, index: number): string =>
      [
        `.${name}${index} {`,
        "  display: flex;",
        "  min-height: var(--ward-tap);",
        "  align-items: center;",
        "  border-radius: var(--radius-sm);",
        "  padding: 0 var(--ward-space-12);",
        "  font-weight: 600;",
        "  color: var(--ward-text);",
        "}",
      ].join("\n");

    const section = Array.from({ length: 6 }, (_, index) => rule("row", index)).join("\n");
    expect(
      firstRepeatedWindow(`${section}\n${section}\n`),
      "a verbatim duplicated section must be found",
    ).not.toBeNull();

    // The idiom that must NOT fire: one selector declared twice with disjoint properties, which is
    // what `.declineButton` does in ward.module.css today.
    const idiom = [
      Array.from({ length: 12 }, (_, index) => rule("card", index)).join("\n"),
      ".declineButton {",
      "  display: inline-flex;",
      "  min-height: var(--ward-tap);",
      "  justify-content: center;",
      "}",
      ".declineButton {",
      "  border: 0.0625rem solid var(--ward-border);",
      "  background: var(--surface);",
      "  color: var(--text-heading);",
      "}",
    ].join("\n");
    expect(firstRepeatedWindow(idiom), "a selector declared twice with disjoint properties is legitimate").toBeNull();
  });

  it("keeps every ward stylesheet free of a repeated section", () => {
    const offenders: string[] = [];
    for (const sheet of SHEETS) {
      const repeat = firstRepeatedWindow(readFileSync(sheet, "utf8"));
      if (repeat) {
        offenders.push(
          `  ${sheet.slice(`${WARD}/`.length)}: lines ${repeat.firstLine} and ${repeat.secondLine} ` +
            `begin identical ${WINDOW}-line spans`,
        );
      }
    }
    expect(
      offenders,
      "these ward stylesheets contain the same section twice:\n" +
        offenders.join("\n") +
        "\n\n  Duplication here is not only waste. The two copies drift, the LATER one wins silently, " +
        "and the copy that loses is as likely as not to be the one somebody fixed — that is exactly " +
        "how four borders in ward.module.css kept a dead `--ward-border` while the live rule fell " +
        "through to an unthemed `--neutral-500` with no forced-colours handling.\n" +
        "  Delete one copy. Check the four-line-level differences BEFORE deleting, and keep the " +
        "values from whichever copy is correct rather than whichever copy is later.",
    ).toEqual([]);
  });
});
