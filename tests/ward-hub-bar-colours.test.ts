/**
 * 🔴 **THE HUB'S THREE BED-BAR SEGMENTS MUST NOT RESOLVE TO THE SAME PAINT, AND ON 2026-09-06 TWO OF
 * THEM DID.**
 *
 * `.barNotYet` used `var(--text-muted)`. `.barBlocked` used `var(--ward-border-strong)`, which
 * `ward-tokens.module.css` declares as `var(--text-muted)`. Two adjacent segments of a proportion
 * bar — the one element on the page whose entire job is showing a split — rendered as one block.
 *
 * ⚠️ **NOTHING IN THIS REPOSITORY COULD HAVE REPORTED IT, AND THAT IS WHY THIS FILE EXISTS.**
 * Both values are legal declared tokens, so `no-hardcoded-hex` was happy. The design ratchets were
 * green. The legend named all three segments, so nothing on screen was untrue — the information was
 * simply not in the picture drawn to carry it. **A chart with two segments the same colour looks
 * exactly like a chart with fewer segments.** There is no failing state to notice, in a screenshot
 * or anywhere else; I photographed it twice and did not see it.
 *
 * ⚠️ **A STRING COMPARISON WOULD NOT HAVE CAUGHT IT** — `var(--text-muted)` and
 * `var(--ward-border-strong)` are different strings. The whole point is following the chain.
 *
 * ⚠️ **AND THIS IS THE NARROW MEMBER OF A WIDER FAMILY, DELIBERATELY.** Ward Builder Two's general
 * form is stronger than anything asserted here: *nothing compares two tokens for equality anywhere*,
 * so a stylesheet can name a "strong" border and a "normal" one, paint one colour, and pass every
 * gate. Two further shapes in the same family: a token that resolves to its neighbour's value (this
 * one), and a token that does not exist at all — the rule looks valid and is silently discarded.
 *
 * 🔴 **A THIRD SHAPE STOOD HERE AND WAS WRONG.** I wrote that `--warning` and `--clinical-accent`
 * are declared with no value outside `forced-colors`. `globals.css` declares both twice, light and
 * dark, and the `CanvasText`/`LinkText` declarations are forced-colours OVERRIDES — correct
 * practice. What I had actually measured was a standalone MOCKUP file that paints with those tokens
 * and declares only their `-soft` variants; there they do vanish, and the mockup still looks
 * plausible. **A token's declarations are split across two files by design, so neither file alone
 * answers "does this token have a value."** Corrected here rather than quietly deleted, because the
 * next person to read a token block in one file is about to make the same inference.
 *
 * All of them read correct and paint wrong. **This file guards ONE screen's chart
 * because that is the surface I own; the resolver below is written to be liftable if somebody wants
 * the general guard.**
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HUB_CSS = readFileSync(resolve(process.cwd(), "src/components/ward-management/hub/hub.module.css"), "utf8");
const WARD_TOKENS = readFileSync(
  resolve(process.cwd(), "src/components/ward-management/ward-tokens.module.css"),
  "utf8",
);
const THIRD_EDITION_TOKENS = readFileSync(resolve(process.cwd(), "src/app/ward-flow-shell-tokens.module.css"), "utf8");
const GLOBALS = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

/**
 * Every value a custom property is declared with, in source order.
 *
 * ⚠️ **INDEX 0 IS THE LIGHT PALETTE AND INDEX 1, WHERE PRESENT, IS DARK.** For the five
 * third-edition paints this file actually compares, the named scope-shape assertions below prove
 * that ordering before any resolved paint is trusted. **A resolver that quietly guesses wrong
 * produces a green run and a false clean bill** — worse than the defect it is looking for.
 */
function declarations(source: string, token: string): string[] {
  const pattern = new RegExp(`^\\s*${token.replace(/[-]/g, "\\-")}:\\s*([^;]+);`, "gm");
  return [...source.matchAll(pattern)].map((match) => (match[1] ?? "").trim());
}

const THIRD_EDITION_WITHOUT_COMMENTS = THIRD_EDITION_TOKENS.replace(/\/\*[\s\S]*?\*\//g, "");

/** Returns the balanced body following one exact, comment-free rule or at-rule marker. */
function bodyAfter(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing token scope marker: ${marker}`);
  const open = source.indexOf("{", markerIndex);
  if (open < 0) throw new Error(`Token scope marker has no body: ${marker}`);

  let depth = 1;
  for (let index = open + 1; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`Token scope marker has an unclosed body: ${marker}`);
}

const BASE_PALETTE = bodyAfter(THIRD_EDITION_WITHOUT_COMMENTS, ".wardShellTokens {");
const PREFERS_DARK_PALETTE = bodyAfter(
  bodyAfter(THIRD_EDITION_WITHOUT_COMMENTS, "@media (prefers-color-scheme: dark)"),
  ':global(:root:not([data-theme="light"])) .wardShellTokens',
);
const EXPLICIT_DARK_PALETTE = bodyAfter(
  THIRD_EDITION_WITHOUT_COMMENTS,
  ':global([data-theme="dark"]) .wardShellTokens',
);
const FORCED_COLOURS_PALETTE = bodyAfter(
  bodyAfter(THIRD_EDITION_WITHOUT_COMMENTS, "@media (forced-colors: active)"),
  ".wardShellTokens",
);
const PRINT_PALETTE = bodyAfter(bodyAfter(THIRD_EDITION_WITHOUT_COMMENTS, "@media print"), ".wardShellTokens,");

const HUB_PAINT_DEPENDENCIES = ["--good", "--warn", "--danger", "--surface", "--line-strong"] as const;

/** Follows `var(--x)` through the ward token layer and then globals, for one palette scope. */
function resolveToken(token: string, scope: 0 | 1, seen = new Set<string>()): string {
  if (seen.has(token)) return `CYCLE:${token}`;
  seen.add(token);
  const thirdEdition = declarations(THIRD_EDITION_TOKENS, token);
  const ward = declarations(WARD_TOKENS, token);
  const global = declarations(GLOBALS, token);
  const candidates = thirdEdition.length > 0 ? thirdEdition : ward.length > 0 ? ward : global;
  if (candidates.length === 0) return `UNDECLARED:${token}`;
  // The ward layer has no dark variant for these aliases; globals does.
  const value = candidates[Math.min(scope, candidates.length - 1)] ?? "";
  const varMatch = /^var\((--[a-z0-9-]+)\)$/i.exec(value);
  return varMatch?.[1] === undefined ? value : resolveToken(varMatch[1], scope, seen);
}

/** The `background` declaration of one class in the hub stylesheet, with every var() resolved. */
/**
 * The `background` declaration of one class in the hub stylesheet, with every var() resolved.
 *
 * 🔴 **THIS TOOK THE FIRST RULE MATCHING THE CLASS NAME, AND THAT BROKE THE MOMENT THE CLASS
 * APPEARED TWICE.** Adding a forced-colors rule `.barReady, .barNotYet { border-right: … }` put
 * `.barNotYet` into a grouped selector carrying no background; the naive regex matched THAT one and
 * this file went red claiming the segment had lost its background — against a stylesheet that was
 * correct. **A guard that reddens on correct work gets widened until it means nothing**, so it is
 * fixed rather than loosened: every rule naming the class is collected, and exactly one must
 * declare a background. **Two would be an ambiguity for a human to resolve, not a tie for this
 * function to break silently** — the second could be the one that actually paints.
 */
function resolvedBackground(className: string, scope: 0 | 1): string {
  // ⚠️ Comments are stripped FIRST. A `/* … */` block contains no braces, so it becomes part of the
  // captured selector text of the rule that follows it — and every rule in this stylesheet that
  // matters here is preceded by a long one. Without this, the selector never equals the class and
  // the test reports "no longer a rule" about a rule sitting in front of it.
  const source = HUB_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const bodies = [...source.matchAll(/([^{}]*)\{([^}]*)\}/g)]
    .filter((match) =>
      (match[1] ?? "")
        .split(",")
        .map((part) => part.trim())
        .includes(`.${className}`),
    )
    .map((match) => match[2] ?? "");
  expect(bodies.length, `.${className} is no longer a rule in hub.module.css — re-point this test`).toBeGreaterThan(0);

  const painted = bodies.filter((body) => /background:\s*[^;]+;/m.test(body));
  expect(
    painted.length,
    `.${className} declares a background in ${painted.length} rules; exactly one is expected. A tie here must be resolved by a human, not by whichever this function happens to find first.`,
  ).toBe(1);

  const background = /background:\s*([^;]+);/m.exec(painted[0] ?? "");
  return (background?.[1] ?? "").replace(/var\((--[a-z0-9-]+)\)/g, (_, token: string) => resolveToken(token, scope));
}

const SEGMENTS = ["barReady", "barNotYet", "barBlocked"] as const;

describe("Ward Flow hub — the bed bar's segments are three different paints, in both palettes", () => {
  it("the resolver still understands the token files (if this fails, every result below is worthless)", () => {
    // Name every CSS scope that contributes to the declaration arrays rather than assuming that
    // index 1 means dark. The explicit-dark rule must duplicate prefers-dark, print must restore
    // light, and forced colours intentionally omits --surface while overriding the other paints.
    for (const token of HUB_PAINT_DEPENDENCIES) {
      const base = declarations(BASE_PALETTE, token);
      const prefersDark = declarations(PREFERS_DARK_PALETTE, token);
      const explicitDark = declarations(EXPLICIT_DARK_PALETTE, token);
      const forcedColours = declarations(FORCED_COLOURS_PALETTE, token);
      const print = declarations(PRINT_PALETTE, token);

      expect(base, `${token} must have exactly one base declaration`).toHaveLength(1);
      expect(prefersDark, `${token} must have exactly one prefers-dark declaration`).toHaveLength(1);
      expect(explicitDark, `${token} must have exactly one explicit-dark declaration`).toEqual(prefersDark);
      expect(print, `${token} must have exactly one print declaration restoring light`).toEqual(base);
      expect(forcedColours, `${token} has the wrong forced-colours declaration shape`).toEqual(
        token === "--surface" ? [] : ["CanvasText"],
      );
      expect(declarations(THIRD_EDITION_TOKENS, token)).toEqual([
        ...base,
        ...prefersDark,
        ...explicitDark,
        ...forcedColours,
        ...print,
      ]);
    }

    // The floor. A resolver that silently returns UNDECLARED for everything would make every
    // distinctness assertion below pass trivially, because "UNDECLARED:--a" !== "UNDECLARED:--b".
    for (const scope of [0, 1] as const) {
      for (const segment of SEGMENTS) {
        const value = resolvedBackground(segment, scope);
        expect(value, `.${segment} resolved to an unresolvable value in scope ${scope}: ${value}`).not.toMatch(
          /UNDECLARED:|CYCLE:/,
        );
        expect(value, `.${segment} did not resolve to a literal in scope ${scope}`).toMatch(/#|rgb|gradient/i);
      }
    }
    // The third-edition carrier now routes this historical alias through --line-strong,
    // whose literal is rgba in both palettes. Prove the chain and its concrete result;
    // requiring hex would reject the valid canonical paint without testing resolution.
    expect(declarations(THIRD_EDITION_TOKENS, "--ward-border-strong")).toEqual(["var(--line-strong)"]);
    for (const scope of [0, 1] as const) {
      const resolved = resolveToken("--ward-border-strong", scope);
      expect(resolved).toBe(resolveToken("--line-strong", scope));
      expect(resolved, `strong-border chain did not reach an rgba literal in scope ${scope}`).toMatch(
        /^rgba\(\d+,\s*\d+,\s*\d+,\s*(?:0(?:\.\d+)?|1)\)$/,
      );
    }
  });

  it.each([0, 1] as const)("all three segments differ in palette scope %i", (scope) => {
    const painted = SEGMENTS.map((segment) => ({ segment, value: resolvedBackground(segment, scope) }));
    const collisions: string[] = [];
    for (let i = 0; i < painted.length; i++) {
      for (let j = i + 1; j < painted.length; j++) {
        const a = painted[i];
        const b = painted[j];
        if (a !== undefined && b !== undefined && a.value === b.value) {
          collisions.push(`.${a.segment} and .${b.segment} both paint ${a.value}`);
        }
      }
    }
    expect(
      collisions,
      "two segments of the bed bar paint the same thing — the bar will show fewer quantities than it claims, and no other gate in this repository can see it",
    ).toEqual([]);
  });

  /**
   * The legend is the only thing naming what each segment means, so its swatches must be the same
   * paint as the segments they explain. They compose the same classes today; this fails the day
   * somebody gives the legend its own colours and lets the two drift.
   */
  it("the legend swatches reuse the segment classes, so a swatch cannot disagree with its segment", () => {
    const screen = readFileSync(resolve(process.cwd(), "src/components/ward-management/hub/hub-screen.tsx"), "utf8");
    for (const segment of SEGMENTS) {
      expect(
        screen.includes(`styles.legendSwatch} \${styles.${segment}}`),
        `the legend swatch for .${segment} no longer composes the segment's own class`,
      ).toBe(true);
    }
  });
});

/**
 * ⚠️ **THE HUB'S STYLESHEET ARRIVED FROM A MOCKUP AND CARRIED TEN RULES NOTHING COULD REACH.**
 *
 * `.searchIcon`, `.hintRow`, `.kbd`, `.resultRight`, `.sectionLabel`, `.bedsTotal`, `.statedZero`,
 * `.noteList`, `.noteLine` (and its descendant `.noteLine b`), `.viewLink` — some inherited from
 * the mockup's own markup, some orphaned by later edits of mine that swapped one class for another.
 *
 * **Dead CSS is not merely untidy here, it is misleading.** Every one of those rules reads as a
 * decision somebody made about how this screen looks. Two of them actively lied: `.statedZero`
 * composed a display-number size and was named as though it styled a stated zero, so the next
 * person to reach for it would have rendered a whole sentence at 1.125rem — which is exactly what
 * happened to me before I noticed the class had stopped being used.
 *
 * ⚠️ **`composes:` COUNTS AS A USE.** A rule reached only by another rule is alive, and a check
 * that missed that would report `.kindTab` and `.capacityNum` as dead and get itself deleted for
 * crying wolf. The floor below refuses to run at all if the parser stops finding either side.
 */
describe("Ward Flow hub — every rule in the stylesheet is reachable from the component", () => {
  const SCREEN = readFileSync(resolve(process.cwd(), "src/components/ward-management/hub/hub-screen.tsx"), "utf8");
  const withoutComments = HUB_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const declared = [...new Set([...withoutComments.matchAll(/^\.([a-zA-Z][a-zA-Z0-9_]*)/gm)].map((m) => m[1]))];
  const usedInScreen = new Set([...SCREEN.matchAll(/styles\.([a-zA-Z][a-zA-Z0-9_]*)/g)].map((m) => m[1]));
  const composed = new Set([...withoutComments.matchAll(/composes:\s*([a-zA-Z][a-zA-Z0-9_]*)/g)].map((m) => m[1]));

  it("floors both sides: the parser can still see classes in the stylesheet and uses in the component", () => {
    // Without this, a regex that stopped matching would report zero dead rules and read as a pass.
    expect(
      declared.length,
      "no classes parsed from hub.module.css — the dead-rule check below is vacuous",
    ).toBeGreaterThan(30);
    expect(
      usedInScreen.size,
      "no styles.* uses parsed from hub-screen.tsx — every rule would look dead",
    ).toBeGreaterThan(30);
    expect(
      composed.size,
      "no composes: found — rules reached only by other rules would be reported dead",
    ).toBeGreaterThan(0);
  });

  it("declares no rule the component cannot reach", () => {
    const unreachable = declared.filter((name) => !usedInScreen.has(name!) && !composed.has(name!));
    expect(
      unreachable,
      "rules nothing can reach — each one reads as a decision about this screen and is not one",
    ).toEqual([]);
  });
});
