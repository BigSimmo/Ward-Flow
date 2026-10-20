import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** One CSS rule block, from its selector to its closing brace. */
function block(file: string, selector: string): string {
  const css = readFileSync(resolve(process.cwd(), file), "utf8");
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} in ${file}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("overall review tidy (20 Oct 2026)", () => {
  /**
   * DA-02: the "Loading, not live yet" note took a line in the page, so when it went every route
   * jumped up about 39px (layout shift 0.02 desktop, 0.04 phone, measured in Chromium). It now floats
   * over the page, and the measured jump is gone.
   */
  it("floats the loading note over the page instead of taking a line in it", () => {
    const note = block("src/app/ward-flow/ward-flow-layout.module.css", ".loadingNote");
    expect(note).toContain("position: fixed");
    expect(note).toContain("pointer-events: none");
    expect(note).not.toContain("flex-shrink");
  });

  /**
   * DA-24: "Which handover" squeezed its choices under their own words at 1280px with wider text
   * spacing (and slightly at 1024px without it). Each choice now keeps its width: the countdown
   * wraps first, then the choices wrap inside the track.
   */
  it("keeps the Which handover choices at full width and lets the countdown wrap", () => {
    const file = "src/components/ward-management/handover/handover-refined.module.css";
    expect(block(file, ".heroTools")).toContain("flex-wrap: wrap");
    expect(block(file, ".shiftTrack")).toContain("flex-wrap: wrap");
    expect(block(file, ".shiftTrack button")).toContain("flex-shrink: 0");
  });
});
