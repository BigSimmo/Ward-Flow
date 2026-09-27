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

/** Anything that looks like a persisted appearance/theme preference, however it is spelled. */
const APPEARANCE_KEY = /^ward-flow-[a-z-]*(appearance|theme)[a-z-]*$/u;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const SOURCE_FILES = walk(WARD_SOURCE).filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));

/** Every appearance-shaped key literal in ward source, with the file that spells it. */
function appearanceKeys(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of SOURCE_FILES) {
    for (const literal of literalsIn(file)) {
      // The change EVENT shares the prefix and is not a storage key; excluding it by its own
      // suffix rather than by an allowlist, so a new event name is excluded for the same reason.
      if (!APPEARANCE_KEY.test(literal) || literal.endsWith("-change")) continue;
      const relative = file
        .split(sep)
        .join("/")
        .replace(`${process.cwd().split(sep).join("/")}/`, "");
      found.set(literal, [...(found.get(literal) ?? []), relative]);
    }
  }
  return found;
}

describe("the appearance preference has exactly one key", () => {
  /**
   * ⚠️ **THE ANTI-VACUITY FLOOR, AND IT COMES FIRST ON PURPOSE.** "No two keys" is satisfied by
   * NO keys — by a rename, a move, or this walk pointing at the wrong directory. 🔴 **A guard that
   * passes hardest when its subject has vanished is the shape this repository has measured twice.**
   */
  it("finds the real appearance key at all, so the check below is not passing over nothing", () => {
    expect(SOURCE_FILES.length, "the ward source walk found no files").toBeGreaterThan(100);
    const keys = appearanceKeys();
    expect([...keys.keys()], "no appearance storage key found in ward source").toContain("ward-flow-appearance");
  });

  it("spells that key in exactly one file, so there is one owner for the value", () => {
    const keys = appearanceKeys();
    const report = [...keys.entries()].map(([key, files]) => `  ${key} — ${files.join(", ")}`).join("\n");

    expect(
      [...keys.keys()].sort(),
      "more than one appearance preference key exists in ward source, so two controls can " +
        "disagree while both look correct. There is one real key and every surface calls the one " +
        `owner of it — never a second key that looks similar:\n${report}`,
    ).toEqual(["ward-flow-appearance"]);
  });

  /**
   * 🔴 **THE CONTROL. Without it, a rename of the real key or a broken walk would leave both
   * assertions above green over an empty set** — and the second one would then be asserting that a
   * key nobody has is the only key anybody has.
   */
  it("would catch a second key if one were added", () => {
    const withASecond = ["ward-flow-appearance", "ward-flow-settings-appearance"];
    expect(withASecond.filter((key) => APPEARANCE_KEY.test(key))).toHaveLength(2);
    expect(withASecond).not.toEqual(["ward-flow-appearance"]);
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
