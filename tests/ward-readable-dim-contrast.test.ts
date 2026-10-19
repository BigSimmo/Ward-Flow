import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const css = readFileSync(new URL("../src/app/ward-flow-v9-tokens.css", import.meta.url), "utf8");

function luminance(hex: string) {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((digit) => digit + digit).join("")}` : hex;
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string) {
  const [dark, light] = [luminance(first), luminance(second)].sort((a, b) => a - b);
  return (light + 0.05) / (dark + 0.05);
}

it.each([
  ["day", "\n:root,", 0],
  ["night", '\n:root[data-theme="dark"],', 1],
] as const)("keeps active dimmed content and document primary text readable in %s", (_theme, marker, index) => {
  const start = css.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf("\n}", start));
  const color = (token: string) => {
    const value = block.match(new RegExp(`--wf-${token}: (#[\\da-f]+);`))?.[1];
    expect(value, token).toBeDefined();
    return value!;
  };
  for (const token of ["dim", "glyph-dim"]) {
    const dim = css.match(new RegExp(`--wf-${token}: light-dark\\((#[\\da-f]+), (#[\\da-f]+)\\);`));
    expect(dim, token).not.toBeNull();
    for (const surface of ["canvas", "surface", "surface-2", "track", "hover", "selected"]) {
      expect(contrast(dim![index + 1], color(surface)), `${token} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(contrast("#fff", color("pri-1"))).toBeGreaterThanOrEqual(4.5);
});
