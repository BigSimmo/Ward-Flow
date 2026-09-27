import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { WARD_WORKSPACE_MODES } from "@/components/ward-management/ward-management-modes";
import { WARD_VIEWS } from "@/components/ward-management/ward-nav";

/**
 * **WHICH WARD SCREENS CARRY THE SHARED CHROME — DECLARED IN ONE PLACE, CHECKED AGAINST THE ROUTES.**
 *
 * `WardModeWorkspace` renders the branded header: the "Ward Flow" identity, the mode `<h1>`, and the
 * role selector. MERGE 01–03 converted most ward screens to standalone routes that render their own
 * `<header>` with no brand. **Exactly two routes still render the workspace.**
 *
 * 🔴 **WHY THIS FILE EXISTS: A BROWSER TEST CHASED THAT PROPERTY ACROSS THREE SCREENS IN TWO DAYS.**
 * `ui-ward-management.spec.ts`'s *"keeps the header brand visible at tablet width"* targeted `/queue`,
 * was retargeted to `/capacity` when MERGE 01 took the chrome off queue, and retargeted again to
 * `/governance` when MERGE 02 took it off Capacity. **Each retarget was correct and each was done by
 * hand, because nothing declared which modes still had the chrome.** The failure always arrived as a
 * confusing red on an unrelated-looking assertion rather than as "this merge removed the chrome".
 *
 * ⚠️ **`WardModeWorkspace`'s PROP TYPE ALREADY GUARDED THE INWARD DIRECTION** — a route cannot pass a
 * mode the workspace does not list. **It could not guard the outward one.** Convert `/governance` to a
 * standalone screen and the declaration still names it, nothing stops compiling, and the browser test
 * breaks somewhere else entirely. That asymmetry is what these tests close.
 *
 * **The contract, in one line: the declaration is what a reader and a test rely on; the route files
 * are the truth; this file is the only thing that can tell you they have diverged.**
 */

const WARD_FLOW_ROUTES = path.join(process.cwd(), "src", "app", "mockups", "ward-flow");

/** Every `page.tsx` under the ward-flow route tree, found by walking rather than by a hand-list. */
function routeFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) found.push(...routeFiles(full));
    else if (entry === "page.tsx") found.push(full);
  }
  return found;
}

/**
 * The modes the ROUTE FILES actually hand to `WardModeWorkspace`, read from source.
 *
 * ⚠️ **Deliberately matches the JSX call, not the import.** A route that imports the workspace and
 * renders something else is not a workspace route, and `morning-page.tsx` was briefly miscounted that
 * way by a grep for the bare name. The mode is a literal at every call site today; if one ever
 * becomes a variable this returns fewer modes than exist, and the assertion below fails LOUDLY rather
 * than quietly agreeing — which is the safe direction for a scanner that can only read literals.
 */
function modesRenderedByRoutes(): string[] {
  const found = new Set<string>();
  for (const file of routeFiles(WARD_FLOW_ROUTES)) {
    for (const match of readFileSync(file, "utf8").matchAll(/<WardModeWorkspace\s+mode="([a-z-]+)"/gu)) {
      found.add(match[1]!);
    }
  }
  return [...found].sort();
}

describe("the ward modes that render the shared workspace chrome", () => {
  it("walks a real route tree — the scan below proves nothing over an empty directory", () => {
    // The population floor. A wrong `WARD_FLOW_ROUTES`, a moved route tree or a failed read all
    // produce an empty scan, and an empty scan makes the "no undeclared mode" direction pass
    // perfectly while measuring nothing.
    expect(
      routeFiles(WARD_FLOW_ROUTES).length,
      "no ward route files found — the scan is looking in the wrong place",
    ).toBeGreaterThan(20);
  });

  it("finds the workspace rendered by at least one route, or the pattern has stopped matching", () => {
    // The second vacuity control, and it is a different failure from the one above: the directory can
    // be right and full while the regex matches nothing, because the JSX was reformatted or the
    // component renamed. Without this, both directions below pass over an empty set.
    expect(
      modesRenderedByRoutes().length,
      "no route renders <WardModeWorkspace mode=...> — the pattern no longer matches the source",
    ).toBeGreaterThan(0);
  });

  it("declares exactly the modes the route files render — neither more nor fewer", () => {
    // `string[]`, deliberately: `rendered` holds whatever the route files literally say, and the
    // whole point of this test is to compare the narrow declaration against free-form scanned
    // text. Typing it as the union would make `.includes()` refuse the very values it must check.
    const declared: string[] = [...WARD_WORKSPACE_MODES].sort();
    const rendered = modesRenderedByRoutes();

    // 🔴 BOTH DIRECTIONS IN ONE ASSERTION, AND THE MESSAGE NAMES WHICH.
    //
    // A mode rendered but not declared means a screen gained the chrome and nothing says so.
    // A mode declared but not rendered means a merge converted a screen to a standalone route and
    // the declaration now describes a screen that no longer has it — the silent half, and the one
    // that sends a browser test chasing the property to a third screen.
    const undeclared = rendered.filter((mode) => !declared.includes(mode));
    const stale = declared.filter((mode) => !rendered.includes(mode));

    expect(
      { undeclared, stale },
      `WARD_WORKSPACE_MODES disagrees with the route files.\n` +
        `  rendered by a route but NOT declared: ${undeclared.join(", ") || "(none)"}\n` +
        `  declared but NO route renders it:     ${stale.join(", ") || "(none)"}\n` +
        `If a merge converted a screen to a standalone route, remove it from WARD_WORKSPACE_MODES in ` +
        `ward-management-modes.tsx — and expect the header-brand browser test to need re-pointing, ` +
        `which it now does by itself because it reads that array.`,
    ).toEqual({ undeclared: [], stale: [] });
  });

  it("gives every declared mode a real WARD_VIEWS destination, so a test can navigate to it", () => {
    // The browser test derives its route from WARD_VIEWS by this id. A declared mode with no view
    // entry would make that lookup return undefined and the spec fail on a confusing `goto(undefined)`
    // rather than here, by name.
    const missing = WARD_WORKSPACE_MODES.filter((mode) => !WARD_VIEWS.some((view) => view.id === mode));
    expect(missing, `workspace mode(s) with no WARD_VIEWS entry to navigate to: ${missing.join(", ")}`).toEqual([]);
  });
});
