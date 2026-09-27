import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The phone contract, asserted as stylesheet rules rather than as rendered output.
 *
 * jsdom has no layout and applies no media query, so a DOM test cannot tell a sidebar that
 * disappears on a phone from one that does not. That gap is not hypothetical here: Ward Flow
 * shipped with the full 4.5rem desktop icon rail rendering unchanged on a 390px phone — 18% of
 * the viewport — through 38 test files and 428 passing tests, because nothing was structurally
 * wrong and no check ever looked at a width. The rules below are what make the phone treatment
 * exist at all, so they are what gets pinned.
 */
const REPO_ROOT = path.resolve(__dirname, "..");
const WARD_ROOT = path.join(REPO_ROOT, "src", "components", "ward-management");

function readModule(relativePath: string) {
  // Normalised to LF: the repository enforces LF via .gitattributes, but a working tree that
  // has picked up CRLF must fail this suite on its content, never on its line endings.
  return readFileSync(path.join(WARD_ROOT, relativePath), "utf8").split("\r\n").join("\n");
}

/** Every Ward Flow module stylesheet, returned relative to WARD_ROOT. */
function shellStylesheets(directory = WARD_ROOT, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      found.push(...shellStylesheets(path.join(directory, entry.name), `${prefix}${entry.name}/`));
    } else if (entry.name.endsWith(".module.css")) {
      found.push(`${prefix}${entry.name}`);
    }
  }
  return found;
}

const shellFiles = shellStylesheets().filter((file) => readModule(file).includes("minmax(0, 1fr);"));

/** Read complete media blocks, not everything following the first phone query. A later
 * desktop-only sticky panel header must never be mistaken for fixed phone chrome. */
function phoneMediaBlocks(source: string): string[] {
  const css = source.replace(/\/\*[\s\S]*?\*\//gu, "");
  const blocks: string[] = [];
  const media = /@media\s*([^{}]+)\{/gu;
  for (const match of css.matchAll(media)) {
    const max = /max-width\s*:\s*([\d.]+)(px|rem)/u.exec(match[1]);
    if (!max) continue;
    const min = /min-width\s*:\s*([\d.]+)(px|rem)/u.exec(match[1]);
    const minPx = min ? Number(min[1]) * (min[2] === "rem" ? 16 : 1) : 0;
    const maxPx = Number(max[1]) * (max[2] === "rem" ? 16 : 1);
    if (minPx > 640 || minPx > maxPx || /\bprint\b/u.test(match[1])) continue;
    const start = match.index! + match[0].length;
    let end = start;
    let depth = 1;
    while (end < css.length && depth > 0) {
      if (css[end] === "{") depth += 1;
      if (css[end] === "}") depth -= 1;
      end += 1;
    }
    if (depth !== 0) throw new Error("Unclosed media block in phone chrome guard");
    blocks.push(css.slice(start, end - 1));
  }
  return blocks;
}

/** These stylesheets belong only to components whose routes redirect or whose owner has been
 * retired. They stay named so the estate scan below cannot hide a newly mounted screen among old
 * fixed-phone-bar CSS.
 *
 * `morning/morning.module.css` left this list on 2026-09-17 (item 41, owner-approved): unlike the
 * others, which stayed on disk with a redirected or retired owner, the whole `morning/` component
 * directory was deleted outright, so the estate scan below no longer finds the file at all. */
const DORMANT_FIXED_PHONE_RESERVE_STYLES = [
  "escalation/escalation.module.css",
  "tracker/live-tracker.module.css",
  "ward-chrome-header.module.css",
];

describe("Ward Flow sidebar — phone contract", () => {
  it("finds the shell stylesheets it is about to check (sanity check on the scan)", () => {
    // A broken scan would leave every assertion below vacuously true.
    expect(shellFiles.length).toBeGreaterThanOrEqual(9);
    expect(shellFiles).toContain("search/search.module.css");
    expect(shellFiles).toContain("ward-management-modes.module.css");
  });

  it("gives the sidebar its own grid track instead of a 4.5rem literal repeated per shell", () => {
    const literals = shellFiles.filter((file) => readModule(file).includes("grid-template-columns: 4.5rem"));
    expect(
      literals,
      `shell(s) still hard-coding the rail width instead of letting the sidebar own it: ${literals.join(", ")}`,
    ).toEqual([]);
  });

  it("hides the icon rail below 40rem, where the phone bar and drawer take over", () => {
    // The leading newline-and-indent matters: without it this also matches the long-standing
    // `.patientWorkspace .clinicalRail { display: none; }` rule further down the same file, and
    // the check passes with the rule it exists to protect deleted. Caught by mutation, not by
    // reading it.
    expect(readModule("ward-management.module.css")).toContain(
      "@media (max-width: 40rem) {\n  .clinicalRail {\n    display: none;\n  }\n}",
    );
  });

  it("shows the phone bar only below 40rem, and the labelled panel only from 64rem", () => {
    const sidebar = readModule("ward-sidebar.module.css");
    expect(sidebar).toContain("@media (max-width: 40rem) {\n  .phoneBar {\n    display: flex;\n  }\n}");
    expect(sidebar).toContain("@media (min-width: 64rem) {\n  .panel {\n    display: flex;\n  }\n}");
    // Default state for each, so a browser with no media-query support shows the rail alone
    // rather than three sidebars stacked.
    // ⚠️ ASSERT THE PROPERTY, NOT THE LINE THAT HAPPENED TO BE FIRST. This previously read
    // toContain(".phoneBar {\n  position: fixed;"), which pinned ADJACENCY: it broke the moment a
    // `composes:` line was added above, even though `position: fixed` was untouched and the
    // guarantee held. A test that fails when the thing it names is still true trains people to
    // edit the test, which is how the next real break gets waved through.
    const phoneBarBlock = /\.phoneBar \{([^}]*)\}/u.exec(sidebar)?.[1];
    expect(phoneBarBlock, ".phoneBar rule not found in ward-sidebar.module.css").toBeTruthy();
    expect(phoneBarBlock).toMatch(/^\s*(?:composes:[^;]*;\s*)?position: fixed;/u);
    expect(sidebar).toMatch(/\.panel \{\n {2}display: none;/);
  });

  it("keeps the shared rail in normal flow without requiring a retired phone-bar reserve", () => {
    const reserveFiles = shellStylesheets()
      .filter((file) => readModule(file).includes("padding-top: var(--spacing-ward-phone-bar);"))
      .sort();
    expect(
      reserveFiles,
      "a mounted screen reserves the retired fixed phone bar, or the named dormant set has drifted",
    ).toEqual([...DORMANT_FIXED_PHONE_RESERVE_STYLES].sort());

    // The mounted layout owns the rail. Requiring a phantom reserve in any route screen would add
    // a blank band below that normal-flow owner.
    const mountedLayout = readFileSync(path.join(REPO_ROOT, "src/app/mockups/ward-flow/layout.tsx"), "utf8");
    expect(mountedLayout).toMatch(/<WardRail\b/u);
    expect(mountedLayout).toMatch(/<WardBarMount\b/u);
    expect(mountedLayout).toMatch(/<WardGround>\{children\}<\/WardGround>/u);
    const rail = readModule("shell/ward-rail.module.css");
    const layout = readFileSync(path.join(REPO_ROOT, "src/app/mockups/ward-flow/ward-flow-layout.module.css"), "utf8")
      .split("\r\n")
      .join("\n");
    expect(rail, "WardRail remains positioned over route content below 1000px").toMatch(
      /@media \(max-width: 1000px\) \{\n {2}\.rail,\n {2}\.rail\[data-rail="closed"\] \{[\s\S]*?position: static;/u,
    );
    expect(layout, "the shell does not stack rail above content when WardRail becomes a row").toMatch(
      /@media \(max-width: 1000px\) \{\n {2}\.shellRow \{\n {4}flex-direction: column;\n {2}\}\n\}/u,
    );
  });

  /**
   * Found in review, not by any check that existed at the time. The expanded panel is mounted at
   * every width and only hidden by CSS below 64rem, so a selector that keys off its presence must
   * be guarded by the same breakpoint — otherwise a tablet user with the expanded preference
   * stored sees the icon rail AND loses the header brand, leaving nothing on screen naming the
   * prototype.
   */
  it("suppresses the header brand only where the panel is actually visible", () => {
    const modes = readModule("ward-management-modes.module.css");
    const rule = ':global(aside[aria-label="Ward Flow sidebar"]) ~ .modeHeader .modeBrand';
    expect(modes).toContain(rule);
    const before = modes.slice(0, modes.indexOf(rule));
    const lastMediaOpen = before.lastIndexOf("@media");
    expect(lastMediaOpen, "the brand-hiding rule sits outside any media query").toBeGreaterThan(-1);
    expect(before.slice(lastMediaOpen)).toContain("min-width: 64rem");
    // Non-vacuity: the guard must not have been satisfied by an unrelated earlier media query that
    // was already closed before the rule.
    expect(before.slice(lastMediaOpen).split("}").length).toBeLessThan(4);
  });

  it("pushes each shell's own sticky header below the phone bar rather than under it", () => {
    // The two shells that have a sticky header of their own. Anything else has no header at all,
    // which is why the sidebar brings its own bar.
    for (const file of ["ward-management.module.css", "ward-management-modes.module.css"]) {
      const blocks = phoneMediaBlocks(readModule(file));
      expect(blocks.length, `${file} has no phone media blocks`).toBeGreaterThan(0);
      const phoneBlock = blocks.join("\n");
      expect(phoneBlock, `${file} has a sticky header still pinned to the viewport top`).not.toContain(
        "position: sticky;\n    top: 0;",
      );
      for (const [, selector, body] of phoneBlock.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
        if (!/position:\s*(?:sticky|fixed)\s*;/u.test(body)) continue;
        expect(body, `${file}: ${selector.trim()} has an unreserved phone-sticky header`).toMatch(
          /top:\s*var\(--spacing-ward-phone-bar\)\s*;/u,
        );
      }
    }
  });

  it("does not include a later desktop-only nested sticky header in phone rules", () => {
    const css =
      "@media (max-width: 40rem) { .phone { top: 3.5rem; } } " +
      "@media screen and (min-width: 64rem) { .panel > .header { position: sticky; top: 0; } }";
    expect(phoneMediaBlocks(css)).toEqual([" .phone { top: 3.5rem; } "]);
    expect(phoneMediaBlocks("@media (max-width: 40rem) { .header { position: sticky; top: 0; } }")[0]).toContain(
      "position: sticky; top: 0;",
    );
  });
});
