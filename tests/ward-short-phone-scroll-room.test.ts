import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * P040: on a short phone screen (landscape-height or 200% zoom) the pinned header plus the pinned
 * notes under it left almost no room to scroll the page. Below 32rem of height the notes holder
 * stops being pinned (it scrolls away with the page); the scroll padding still clears the header and
 * the route-level pinned view row.
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

  it("keeps clearance for the header and pinned view row on a short phone screen", () => {
    expect(shortPhoneBlock()).toMatch(
      /\.shellContent[^{]*\{[^}]*scroll-padding-top:\s*calc\(var\(--wf-header-height\) \+ 6\.5rem\)\s*;/,
    );
  });

  it("comes after the base pinned notes rule so it wins the cascade", () => {
    const base = css.search(/\n\.bannerHolder\s*\{[^}]*position:\s*sticky/);
    expect(base).toBeGreaterThan(-1);
    expect(css.indexOf("@media screen and (max-width: 48rem) and (max-height: 32rem)")).toBeGreaterThan(base);
  });
});
