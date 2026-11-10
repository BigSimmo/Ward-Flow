// M107 (master audit list, 10 Nov 2026): motion never hides a state change.
//
// Reduced motion is already respected and tested (ward-capacity-scroll-motion, ward-seclusion-scroll-
// motion, the release-gate axe sweep). M107 asks the other half: with motion ON, an interrupted
// animation must never leave the screen or the spoken text behind the real state. In Ward Flow motion
// is CSS only, so that holds while three things stay true, and this test holds them:
//
// 1. No code waits for an animation or transition to end before it changes what is shown or said.
//    The one listener today re-measures the folder tabs' outline, which is decoration.
// 2. No animation ends with its content hidden (an exit), except decorative pulse rings around a
//    live dot. A row or a toast that leaves is removed from the page at once, so cutting its motion
//    short cannot leave a stale row on screen. (The toast's `leaving` prop exists in the kit but no
//    production screen sets it; only the redesign mock-ups do.)
// 3. No number is rolled: no code writes text into the page outside React, so a count shows its
//    final value the moment the state changes.
//
// The announcer (`live-announcer.tsx`) queues on its own timers, never on motion; its order and
// de-duplication are tested in its own files. Reads files with `readFileSync`; run it by name.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import postcss from "postcss";
import { describe, expect, it } from "vitest";

const LEFT_OUT = /mockups|ward-redesign/;

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name).split("\\").join("/");
    if (LEFT_OUT.test(path)) return [];
    if (entry.isDirectory()) return files(path, pattern);
    return pattern.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });
}

const CODE = [...files("src/components", /\.tsx?$/), ...files("src/app", /\.tsx?$/)];
const CSS = [...files("src/components", /\.css$/), ...files("src/app", /\.css$/)];

/** Listeners on the end of motion, by file. Each must only measure or decorate. */
const MOTION_END_LISTENERS: Readonly<Record<string, string>> = {
  "src/components/wf/folder-tabs.tsx": "Re-measures the chosen tab's outline once a tab has eased into place.",
};

/** Animations that end hidden, by name. Only decorative rings that fade out around a live dot. */
const ENDS_HIDDEN_ON_PURPOSE = new Set([
  "coordinatorMetroPulse",
  "delaysMetroPulse",
  "livePulse",
  "metroPulse",
  "movementsMetroPulse",
  "railLivePulse",
  "tv-live-pulse",
  // Defined with the v9 motion tokens and used by nothing today (10 Nov 2026).
  "wfMark",
]);

describe("M107: motion never hides a state change", () => {
  it("reads the source it guards (control)", () => {
    expect(CODE.length).toBeGreaterThan(500);
    expect(CSS.length).toBeGreaterThan(100);
  });

  it("never waits for an animation or transition to end before changing the screen", () => {
    const found: Record<string, string> = {};
    for (const file of CODE) {
      const source = readFileSync(file, "utf8");
      if (/\b(?:animationend|transitionend|onAnimationEnd|onTransitionEnd|onAnimationIteration)\b/.test(source))
        found[file] = MOTION_END_LISTENERS[file] ?? "NEW: say why this cannot hold back a state change";
    }
    expect(found).toEqual(MOTION_END_LISTENERS);
  });

  it("ends no animation with its content hidden, except decorative pulse rings", () => {
    const endsHidden = new Set<string>();
    for (const file of CSS) {
      postcss.parse(readFileSync(file, "utf8")).walkAtRules("keyframes", (keyframes) => {
        const last = (keyframes.nodes ?? [])
          .filter((node): node is postcss.Rule => node.type === "rule")
          .filter((rule) => /(?:^|,)\s*(?:to|100%)\s*(?:,|$)/.test(rule.selector))
          .at(-1);
        if (!last) return;
        const decls: Record<string, string> = {};
        last.walkDecls((decl) => {
          decls[decl.prop] = decl.value;
        });
        if (
          decls.opacity === "0" ||
          decls.visibility === "hidden" ||
          /\bnone\b/.test(decls.display ?? "") ||
          /scale[XY]?\(\s*0\s*\)/.test(decls.transform ?? "")
        )
          endsHidden.add(keyframes.params);
      });
    }
    // The undo bar's countdown shrinks to nothing as time runs out; its words stay, so it is not an exit.
    endsHidden.delete("wfUndoShrink");
    expect([...endsHidden].toSorted()).toEqual([...ENDS_HIDDEN_ON_PURPOSE].toSorted());
  });

  it("writes no text into the page outside React, so no count is rolled", () => {
    const writers = CODE.filter((file) =>
      /\.(?:textContent|innerText|innerHTML)\s*=(?!=)/.test(readFileSync(file, "utf8")),
    );
    expect(writers).toEqual([]);
  });

  it("only the redesign mock-ups set a toast leaving", () => {
    const setters = CODE.filter((file) => /(?<![-\w])leaving=\{(?!leavingToday)/.test(readFileSync(file, "utf8")));
    expect(setters).toEqual([]);
  });
});
