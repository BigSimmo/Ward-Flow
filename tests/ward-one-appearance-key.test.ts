/** @vitest-environment node */
import { readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { literalsIn } from "./helpers/ast-string-literals";

/**
 * 🔴 **ONE APPEARANCE PREFERENCE, ONE KEY — AND THIS GUARD EXISTS BECAUSE AN APPROVED DRAWING
 * ALREADY CARRIES THE SECOND ONE.**
 *
 * `settings-third-edition.html`'s own inline script writes
 * `localStorage["ward-flow-settings-appearance"]`. The control that is **really built and really
 * wired**, in the Tools drawer, uses `"ward-flow-appearance"` (`shell/ward-bar.tsx`). ⚠️ **Built as
 * scripted, the Settings screen would read and write a SECOND, disconnected preference — while the
 * drawing's own copy tells the reader "changing it here changes it there too".** **That sentence
 * would be false the moment it shipped.**
 *
 * 🔴 **AND THE SUBTLER FAILURE SURVIVES FIXING THE KEY, which is why this guard is written the way
 * it is rather than as a string comparison in one file.** `applyAppearance` ends by dispatching
 * `ward-flow-appearance-change`; a second writer on the SAME key that omits that dispatch updates
 * its own screen and leaves the other control showing the old value until a reload. **Two controls
 * disagreeing inside one session, with the stored value correct underneath.** The repair for both is
 * the same and it is structural: **one owner for the value, and every other surface calls it.**
 *
 * ⚠️ **WHY THE TYPESCRIPT PARSER RATHER THAN A GREP.** A `grep` for the key would match it inside a
 * comment — and this file is about to be full of comments quoting the very string it forbids, which
 * is the trap this repository has hit three separate ways in a week. **`literalsIn` asks the AST for
 * string-shaped literals only, so prose naming a key is invisible to it and the check cannot be
 * satisfied, or broken, by documentation.**
 */

const WARD_SOURCE = join(process.cwd(), "src", "components", "ward-management");
const APP_SOURCE = join(process.cwd(), "src");

/**
 * ✅ **DESIGN SYSTEM v8 MOVED THE ONE OWNER UP A LEVEL, AND THIS GUARD MOVED WITH IT.** Before v8 the
 * ward kept its own key and the rest of the app kept another, so a ward pin painted the shell in one
 * theme and the page in the other. Now the whole app has ONE stored preference, owned by
 * `src/lib/theme.ts` (the key) and `src/lib/theme-client.ts` (the only writer). The ward controls
 * are views over it. The old ward key survives only as a one-time migration in the pre-paint script.
 */
const THEME_KEY = "clinical-kb-theme";
const LEGACY_WARD_KEY = "ward-flow-appearance";
const ONE_WRITER = "@/lib/theme-client";

/** Anything that looks like a persisted appearance/theme preference, however it is spelled. */
const APPEARANCE_KEY = /^ward-flow-[a-z-]*(appearance|theme)[a-z-]*$/u;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const isSource = (file: string) => file.endsWith(".ts") || file.endsWith(".tsx");
const SOURCE_FILES = walk(WARD_SOURCE).filter(isSource);
const APP_FILES = walk(APP_SOURCE).filter(isSource);

const relative = (file: string) =>
  file
    .split(sep)
    .join("/")
    .replace(`${process.cwd().split(sep).join("/")}/`, "");

/** Every file under `files` that spells `match` as a string literal. */
function spelledIn(files: string[], match: (literal: string) => boolean): string[] {
  return files.filter((file) => literalsIn(file).some(match)).map(relative);
}

describe("the appearance preference has exactly one key", () => {
  /**
   * ⚠️ **THE ANTI-VACUITY FLOOR, AND IT COMES FIRST ON PURPOSE.** "No second key" is satisfied by NO
   * keys — by a rename, a move, or this walk pointing at the wrong directory. 🔴 **A guard that passes
   * hardest when its subject has vanished is the shape this repository has measured twice.**
   */
  it("finds the real key, its owner and the ward controls that call it", () => {
    expect(SOURCE_FILES.length, "the ward source walk found no files").toBeGreaterThan(100);
    expect(
      spelledIn(APP_FILES, (l) => l === THEME_KEY),
      "the app theme key vanished",
    ).toEqual(["src/lib/theme.ts"]);
    expect(
      spelledIn(SOURCE_FILES, (l) => l === ONE_WRITER),
      "no ward control calls the one theme writer",
    ).toContain("src/components/ward-management/shell/ward-bar.tsx");
  });

  it("spells no appearance key of its own anywhere in ward source", () => {
    const own = SOURCE_FILES.flatMap((file) =>
      literalsIn(file)
        // The old change EVENT shared the prefix and was not a storage key; excluded by its suffix.
        .filter((literal) => APPEARANCE_KEY.test(literal) && !literal.endsWith("-change"))
        .map((literal) => `  ${literal} — ${relative(file)}`),
    );
    expect(
      own,
      "a ward file spells its own appearance key, so two controls can disagree while both look " +
        "correct. Every surface reads and writes the app's one preference through " +
        `${ONE_WRITER}:\n${own.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps the old ward key only as the pre-paint migration", () => {
    expect(spelledIn(APP_FILES, (l) => l === LEGACY_WARD_KEY)).toEqual(["src/lib/theme.ts"]);
  });

  /**
   * 🔴 **THE CONTROL. Without it, a broken pattern would leave the assertions above green over an
   * empty set.**
   */
  it("would catch a second key if one were added", () => {
    const withASecond = ["ward-flow-appearance", "ward-flow-settings-appearance"];
    expect(withASecond.filter((key) => APPEARANCE_KEY.test(key))).toHaveLength(2);
  });

  /**
   * ⚠️ **And the pattern must not be so loose that it fires on unrelated ward keys** — a guard that
   * matches everything gets widened until it means nothing, then switched off.
   */
  it("does not claim the rail preference is an appearance key", () => {
    expect(APPEARANCE_KEY.test("ward-flow-rail")).toBe(false);
    expect(APPEARANCE_KEY.test("ward-flow-appearance-change")).toBe(true); // matched, then excluded by suffix
  });
});
