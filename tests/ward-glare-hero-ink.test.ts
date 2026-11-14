import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const css = readFileSync(new URL("../src/app/ward-flow-v9-tokens.css", import.meta.url), "utf8");

/** R-STYLE-3: Bright light must remap the dark-band ink tokens to body ink, in the one glare block. */
function glareBlock() {
  const start = css.indexOf(':root[data-mode="glare"] {');
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("\n  }", start));
}

it.each([
  ["--wf-hero-ink", "--wf-ink-1"],
  ["--wf-hero-ink-2", "--wf-ink-2"],
  ["--wf-hero-ink-3", "--wf-ink-3"],
  ["--wf-on-hero-ink", "--wf-ink-1"],
])("glare remaps %s to body ink %s", (token, ink) => {
  expect(glareBlock()).toMatch(new RegExp(`\\s${token}: var\\(${ink}\\);`));
});

it("glare lightens the hero surface so dark ink never sits on slate", () => {
  const block = glareBlock();
  for (const token of ["--wf-hero-1", "--wf-hero-2"]) {
    expect(block).toMatch(new RegExp(`\\s${token}: var\\(--wf-(?:surface-2|track|surface)\\);`));
  }
});

it("glare focus ring stays a dark accent, not the white hero ink", () => {
  expect(glareBlock()).toMatch(/--wf-focus-ring: var\(--wf-accent\);/);
});
