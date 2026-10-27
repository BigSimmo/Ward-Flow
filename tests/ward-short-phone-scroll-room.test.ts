import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * P040: on a short phone screen (landscape-height or 200% zoom) the pinned header plus the pinned
 * notes under it left almost no room to scroll the page. Below 32rem of height the notes holder
 * stops being pinned (it scrolls away with the page), and the scroll padding no longer reserves room
 * for pinned rows, so only the header itself stays fixed.
 */
const css = readFileSync(join(process.cwd(), "src/app/ward-flow/ward-flow-layout.module.css"), "utf8");

function shortPhoneBlock(): string {
  const start = css.indexOf("@media screen and (max-width: 48rem) and (max-height: 32rem)");
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("\n}\n", start));
}

describe("P040 short phone scroll room", () => {
  it("unpins the notes holder on a short phone screen", () => {
    expect(shortPhoneBlock()).toMatch(/\.bannerHolder\s*\{[^}]*position:\s*static/);
  });

  it("reserves only the header in scroll padding on a short phone screen", () => {
    expect(shortPhoneBlock()).toMatch(/\.shellContent[^{]*\{[^}]*scroll-padding-top:\s*var\(--wf-header-height\)\s*;/);
  });
});
