// tests/ward-design-language-contract.test.ts
//
// Task 5 of docs/superpowers/plans/2026-09-04-ward-flow-design-foundation.md — the contract test
// that pins the Ward Flow design language so the other twelve routes cannot drift.
//
// ⚠️ THIS GATE COMPARES AGAINST THE CANONICAL DECLARATION, NEVER AGAINST WHAT A ROUTE ALREADY
// CARRIES. A `.bak` taken from the file under test once carried a violation into its own baseline
// and then vouched for it twice. One declaration (ward-tokens.module.css) is the source; every
// other file must contain no declaration at all, which is a comparison that can fail.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, matchesGlob } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { DOM_UNIT_TEST_GLOBS } from "../scripts/unit-test-population.mjs";

const ROOT = "src/components/ward-management";
const TOKEN_FILE = join(ROOT, "ward-tokens.module.css");

/** Prove the routed wrapper's actual JSX ancestry while allowing extra attributes and formatting. */
function expectWardGroundAncestry() {
  const source = ts.createSourceFile(
    "ward-shell.tsx",
    readFileSync(join(ROOT, "ward-shell.tsx"), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let wrappers = 0;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "WardGround") {
      function inspect(child: ts.Node) {
        if (ts.isJsxElement(child) && child.openingElement.tagName.getText(source) === "div") {
          const hasShell = child.openingElement.attributes.properties.some(
            (attribute) =>
              ts.isJsxAttribute(attribute) &&
              attribute.name.getText(source) === "className" &&
              attribute.initializer &&
              ts.isJsxExpression(attribute.initializer) &&
              attribute.initializer.expression?.getText(source) === "styles.shell",
          );
          const hasChildren = child.children.some(
            (content) =>
              ts.isJsxExpression(content) &&
              content.expression &&
              ts.isIdentifier(content.expression) &&
              content.expression.text === "children",
          );
          if (hasShell && hasChildren) wrappers += 1;
        }
        ts.forEachChild(child, inspect);
      }
      inspect(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(wrappers, "WardGround must wrap its children in exactly one styles.shell div").toBe(1);
}

/**
 * ⚠️ EVERY SCAN IN THIS FILE READS STRIPPED CSS, AND THAT IS NOT TIDINESS.
 *
 * Measured 2026-09-04: the phantom-token assertion below built its set of DECLARED tokens with
 * `matchAll(/(--ward-[\w-]+)\s*:/gu)` over the raw file, so a token named only inside a comment
 * counted as declared — `/* --ward-ghost: never really declared *\/` put `--ward-ghost` in the set.
 * A primitive could then `var(--ward-ghost)`, the subset check would pass, and the property would
 * render empty. The assertion built to catch phantom tokens could be walked through with a comment.
 *
 * It also gave the hex scan a false positive: a `#2384` in prose is a PR number, not a colour.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const CSS = walk(ROOT).filter((f) => f.endsWith(".css"));

describe("the Ward Flow design language holds across every Ward Flow stylesheet", () => {
  /**
   * ⚠️ THE FILE SET IS DISCOVERED FROM DISK, NEVER LISTED. A hand-written list of stylesheets
   * silently stops covering the file somebody adds tomorrow, and that omission is invisible —
   * the suite still passes, with one fewer file in it.
   */
  it("finds the stylesheets it is meant to be checking", () => {
    // ⚠️ A LENGTH CHECK ALONE PASSES ON SIXTEEN WRONG FILES. Name a file that must be in the set.
    expect(CSS).toContain(TOKEN_FILE);
    for (const required of ["ward-panel", "ward-chip", "ward-figure", "ward-shared"]) {
      expect(CSS).toContain(join(ROOT, `${required}.module.css`));
    }
    expect(CSS.length).toBeGreaterThan(15);
  });

  /**
   * ⚠️ NOT A BARE `toEqual([TOKEN_FILE])`. Measured 2026-09-04: `ward-sidebar.module.css` ALSO
   * matches — and correctly so. Its `.panel, .drawerBody` rule declares its own self-contained
   * `--ward-*` subset by the same convention the file's header documents: `.drawerBody` renders
   * through a portal, outside the shell's DOM subtree, so it cannot rely on inheriting canonical
   * tokens from an ancestor the way `composes: wardTokens` assumes. (`.phoneBar` in the same file
   * used to share that block too and has since been pulled out to compose the canonical layer
   * directly — this is the one duplicate that remains, not the three-way drift Task 1 fixed.)
   * That is a documented, deliberate exception, not undetected drift.
   *
   * The assertion is phrased as an OFFENDER list — anything declaring the marker that is NOT the
   * canonical file or the one named exception — so it stays a comparison that can fail (a THIRD
   * declaration site is still caught) while accepting today's real, reviewed state. It is also
   * vacuously true over an empty file set, which the empty-ROOT mutation below depends on.
   */
  it("declares the token layer only in the canonical file, or the one documented exception", () => {
    const ALLOWED = new Set([TOKEN_FILE, join(ROOT, "ward-sidebar.module.css")]);
    const offenders = CSS.filter((f) => !ALLOWED.has(f) && readFileSync(f, "utf8").includes("--ward-space-10:"));
    expect(offenders, `token layer redeclared outside the known set: ${offenders.join(", ")}`).toEqual([]);
  });

  /**
   * ⚠️ PINNED, NOT CAPPED — following the shape already established in
   * tests/ward-primitives-shared.test.ts (`KNOWN_BACKLOG`). A `<=` count survives a violation
   * moving between files and survives a broken walk returning fewer files; a named list fails on
   * either.
   *
   * ✅ **EMPTY SINCE 2026-09-06, BECAUSE THE DEBT IS PAID — AND IT HAD BEEN PAID FOR SOME TIME
   * WITHOUT ANYTHING SAYING SO.** It held five entries measured on 2026-09-04. Re-measured with
   * this guard's OWN regex against the same 51 stylesheets: **zero offenders.** Not one of the
   * five still matched. The hexes had gone into `/* *\/` comments documenting measured contrast
   * ratios, or were never colours at all — `#2384` is a PR number.
   *
   * 🔴 **A STALE ALLOWLIST CANNOT FAIL, AND THIS ONE WAS READ AS A DEBT REGISTER.**
   * `surprises = offenders.filter((o) => !KNOWN_HEX_BACKLOG.includes(o))` is empty whenever
   * `offenders` is empty, so every entry could rot indefinitely with the test green. Meanwhile the
   * list still READS as "five ward stylesheets bypass the token layer", which is what a person
   * sizing tokenisation debt would take from it. **The cost of a stale allowlist is not a weak
   * guard; it is the plan somebody makes from reading it** — on 2026-09-06 a sweep across these
   * stylesheets was scoped and then dropped once four chats measured the tree and found nothing to
   * tokenise. I am not claiming this list produced that figure; I did not see how it was reached,
   * and the coordinator says it verified the count separately. What is measured here is only that
   * the list is stale and that nothing in the suite would ever have said so.
   *
   * The staleness check below is what stops it happening again, and it is the same shape
   * `tests/ward-nav.test.ts` already uses for `WARD_NAV_INTENTIONALLY_UNLISTED`.
   */
  const KNOWN_HEX_BACKLOG: readonly string[] = [];

  function hexOffenders(): string[] {
    const offenders: string[] = [];
    for (const file of CSS) {
      if (file === TOKEN_FILE) continue;
      // ⚠️ `{3,8}\b` had a false NEGATIVE as well as false positives. On a nine-character hex the
      // quantifier takes eight, `\b` then fails because the next character is still a hex digit,
      // and every shorter backtrack fails the same way — so the longest literals, the ones most
      // obviously hand-written, matched nothing at all. `{3,}` takes the whole run and flags it.
      // Comments are stripped so a PR number in prose is not read as a colour, and a trailing
      // `{` excludes a CSS id selector, which is a name and not a value.
      const hex = (stripComments(readFileSync(file, "utf8")).match(/#[0-9a-fA-F]{3,}\b(?!\s*\{)/gu) ?? []).filter(
        (h) => h.length >= 4,
      );
      if (hex.length) offenders.push(`${file}: ${hex.slice(0, 4).join(" ")}`);
    }
    return offenders;
  }

  it("uses no raw hex outside the token layer beyond the known backlog", () => {
    const surprises = hexOffenders().filter((o) => !KNOWN_HEX_BACKLOG.includes(o));
    expect(surprises, `new raw hex not in KNOWN_HEX_BACKLOG: ${surprises.join("\n")}`).toEqual([]);
  });

  /**
   * ⚠️ THE PLAN'S OWN REGEX HAS A DEFECT, FOUND WHILE IMPLEMENTING THIS TASK, 2026-09-04.
   * `/font-family:\s*(?!var\()/u` looks correct but is not: `\s*` is greedy, and a regex engine
   * backtracks a greedy quantifier from its maximum match down to zero before giving up. At zero
   * repetitions the lookahead sits on a whitespace character, which trivially is not the four
   * literal characters "var(" — so the lookahead SUCCEEDS regardless of what the value actually
   * is, and the whole pattern matches. Proved by running it:
   *
   *   /font-family:\s*(?!var\()/u.test("font-family: var(--font-mono, monospace);")  -> true
   *
   * That is exactly the correct, token-based usage this task's own new modules
   * (ward-panel.module.css, ward-figure.module.css) use — the regex as written in the plan would
   * flag them as font debt, which they are not. Appending a mandatory non-whitespace character
   * after the lookahead removes the loophole: at every repetition count below the true whitespace
   * run, the very next character IS whitespace, so `\S` fails and backtracking is forced down to
   * the one repetition count where the lookahead actually inspects the value's first character.
   *
   *   /font-family:\s*(?!var\()\S/u.test("font-family: var(--font-mono, monospace);") -> false
   *   /font-family:\s*(?!var\()\S/u.test("font-family: inherit;")                     -> true
   *
   * With the corrected pattern, only `board.module.css` (`font-family: inherit;`, three times)
   * remains as a genuine pre-existing offender — pinned below, same shape as the hex backlog.
   */
  // Inherit carries the ancestor token font through native controls; it introduces no font choice.
  const KNOWN_FONT_BACKLOG: readonly string[] = [];

  /**
   * Every ward stylesheet declaring a colour through a FUNCTION rather than a token.
   *
   * ⚠️ **HEX IS NOT THE ONLY WAY TO WRITE A COLOUR, AND THE SIBLING CHECK ABOVE ONLY LOOKS FOR
   * HEX.** `rgb(14 18 22)` bypasses the token layer exactly as `#0e1216` does and matches nothing
   * in `/#[0-9a-fA-F]{3,}/`. Measured 2026-09-06 across all 51 ward stylesheets, comments stripped:
   * **zero** — so this costs nothing today and is the cheapest moment there will ever be to close
   * it. A guard added while the count is zero never has to argue about a backlog.
   *
   * ⚠️ **`color-mix()` IS DELIBERATELY NOT FORBIDDEN.** Seven declarations use it —
   * `color-mix(in oklab, var(--primary) 16%, var(--ward-canvas))` and its siblings — and every
   * operand is already a token. Banning the function would forbid the correct way to derive a shade
   * from the design system, which is the over-broad version of this rule. Its operands are still
   * covered: a `#hex` inside a `color-mix()` is caught by the hex check above, and an `rgb()`
   * inside one is caught here, because both scan the whole declaration text rather than a
   * hand-parsed argument list.
   *
   * ⚠️ **NOT `transparent`, `currentColor`, `Canvas` OR `CanvasText`.** None is a hardcoded brand
   * colour: the first two are CSS keywords and the last two are forced-colors system colours that
   * these files depend on to survive high-contrast mode at all.
   */
  const RAW_COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch)\s*\(/giu;

  function colourFunctionOffenders(): string[] {
    const offenders: string[] = [];
    for (const file of CSS) {
      if (file === TOKEN_FILE) continue;
      // `rgb(var(--ward-shadow-rgb) / 0.04)` is the `color-mix()` case again: the colour is the
      // token-layer triplet and only the alpha is local. Removed before the scan; a literal
      // `rgb(0 0 0 / …)` or any other channel list is still caught.
      const text = stripComments(readFileSync(file, "utf8")).replace(
        /\brgb\(\s*var\(--ward-shadow-rgb\)\s*\/\s*[\d.]+\s*\)/gu,
        "",
      );
      const found = text.match(RAW_COLOUR_FUNCTION) ?? [];
      if (found.length) offenders.push(`${file}: ${[...new Set(found)].slice(0, 4).join(" ")}`);
    }
    return offenders;
  }

  it("declares no colour through rgb(), hsl() or a sibling function outside the token layer", () => {
    // Anti-vacuity on the POPULATION WALKED. An empty offender list is the expected result, so the
    // only way this test can lie is by scanning nothing — and `CSS` being empty would do it
    // silently. The sibling "finds the stylesheets it is meant to be checking" test above names a
    // required file; this floors the count, so a walk that returns two files fails here.
    expect(CSS.length, "the stylesheet walk came back nearly empty, so this check scans nothing").toBeGreaterThan(40);

    const offenders = colourFunctionOffenders();
    expect(
      offenders,
      "ward stylesheet(s) declaring a colour through a function instead of a --ward-* token: " +
        offenders.join("\n") +
        ". Route it through a token, or propose a new one — do not inline the value.",
    ).toEqual([]);
  });

  function fontOffenders(): string[] {
    return CSS.filter(
      (f) =>
        f !== TOKEN_FILE && /font-family:\s*(?!(?:var\(|inherit\s*;))\S/u.test(stripComments(readFileSync(f, "utf8"))),
    );
  }

  it("declares no font-family outside the token layer beyond the known backlog", () => {
    const surprises = fontOffenders().filter((o) => !KNOWN_FONT_BACKLOG.includes(o));
    expect(surprises, `new font-family(s) not in KNOWN_FONT_BACKLOG: ${surprises.join("\n")}`).toEqual([]);
  });

  /**
   * 🔴 **THE HALF THAT WAS MISSING: AN ALLOWLIST NOBODY EVER CHECKS BACK AGAINST REALITY.**
   *
   * Both lists above are subtracted from a live measurement, so an entry that stops matching
   * anything makes the test no weaker — and no louder. It simply stays, and keeps describing debt
   * that has been paid. **On 2026-09-06 all five hex entries were stale and the suite was green.**
   *
   * ⚠️ **IT DISCRIMINATES, and that was checked rather than assumed.** Run on the day it was
   * written: the five hex entries were stale and the one font entry — `board.module.css`, which
   * really does still declare `font-family: inherit` three times — was NOT. A check that called
   * every backlog stale would be worthless, and this one does not.
   *
   * The floor is on the entries WALKED, not on how many are stale: a floor on staleness goes red
   * the day somebody clears the last one, which is the outcome this check exists to produce.
   */
  it("carries no backlog entry that has stopped matching anything — a paid debt leaves the list", () => {
    const walked = [
      ...KNOWN_HEX_BACKLOG.map((entry) => ({ list: "KNOWN_HEX_BACKLOG", entry, live: hexOffenders() })),
      ...KNOWN_FONT_BACKLOG.map((entry) => ({ list: "KNOWN_FONT_BACKLOG", entry, live: fontOffenders() })),
    ];
    // Both backlogs are now explicitly cleared. Keep the stale-entry detector exercised independently.
    expect(walked).toEqual([]);
    const staleEntries = (entries: { list: string; entry: string; live: readonly string[] }[]) =>
      entries.filter(({ entry, live }) => !live.includes(entry)).map(({ list, entry }) => `${list}: ${entry}`);
    expect(
      staleEntries([
        { list: "witness", entry: "still-live.css", live: ["still-live.css"] },
        { list: "witness", entry: "retired.css", live: ["still-live.css"] },
      ]),
    ).toEqual(["witness: retired.css"]);
    const stale = staleEntries(walked);
    expect(
      stale,
      "these entries record debt that no longer exists. Delete them: while they stand, the list " +
        "reads as a register of files that bypass the token layer, and somebody will size work from it.",
    ).toEqual([]);
  });
});

describe("every --ward-* token a new module uses is actually declared", () => {
  /**
   * ⚠️ THE ONLY DEFECT IN THIS WHOLE PLAN THAT FAILS COMPLETELY SILENTLY. `var(--ward-typo)` is
   * not a syntax error, not a warning, and not a test failure — it resolves to nothing, and the
   * element renders with no border, no background, or default line height. On a ward board an
   * invisible chip or an invisible divider is exactly what a coordinator reads straight past.
   *
   * Two token names in this plan (--ward-panel, --ward-sunken) never existed and were caught only
   * because someone opened the token file. --ward-border-subtle was the third: declared nowhere in
   * src/ at all, used once, in search/search.module.css, with a `currentColor` fallback — so every
   * person row in the search results drew its border in the body text colour. It was removed when
   * search adopted the layer (2026-09-04) and the name is now used nowhere.
   *
   * ⚠️ NOTE WHAT THAT COSTS THIS GATE. The one instance anybody ever found sat OUTSIDE the scope
   * below, and the comment above it named the defect while the assertion under it could not reach
   * it. Widening NEW_MODULES to every ward stylesheet is the fix; until then, a reader must not
   * take a green here as evidence that no undeclared --ward-* token is in use.
   *
   * ⚠️ THE CLASS HAS TWO FAILURE MODES AND THE SECOND IS THE DANGEROUS ONE: no fallback -> the
   * element renders INVISIBLE; a `currentColor` fallback -> the border renders at FULL TEXT
   * CONTRAST, which reads as a design decision rather than a bug. That is why the gate for it is
   * this subset assertion, not a contrast rule — a contrast audit scores a currentColor border as
   * exemplary.
   *
   * Scope is the four new modules against the canonical layer. Older Ward Flow stylesheets have
   * their own declaration sites and are a separate, larger problem this task does not fix.
   */
  /**
   * ⚠️ WIDENED 2026-09-04 FROM FOUR HAND-LISTED MODULES TO EVERY FILE THAT COMPOSES THE LAYER,
   * DERIVED FROM DISK. The four were the modules that existed when this was written; three more
   * screens were moved onto `wardTokens` on 2026-09-04 and inherited the whole silent-failure
   * class above with no guard, because the list was a name list rather than a property.
   * A file that composes `wardTokens` is exactly a file whose `--ward-*` uses must resolve — so
   * that is the membership test, and a screen adopted next week is covered without anybody
   * remembering to add it here.
   */
  const ORIGINAL_FOUR = ["ward-panel", "ward-chip", "ward-figure", "ward-shared"].map((n) =>
    join(ROOT, `${n}.module.css`),
  );

  /**
   * ⚠️ THE UNION, AND THE SECOND HALF IS NOT TIDINESS — IT IS A HOLE THE FLOOR FOUND.
   * Composing `wardTokens` is not the only way a file's `--ward-*` uses resolve: `ward-shared`
   * composes NOTHING and declares nothing, so it INHERITS the tokens from whichever root renders
   * it. Deriving membership from `composes:` alone therefore dropped one of the four modules this
   * guard was written for, and every check below would have covered less than before while
   * passing. The discovery floor caught it on the first run; without that floor the narrowing
   * would have been invisible.
   */
  const NEW_MODULES = [
    ...new Set([
      ...CSS.filter((file) => /composes:\s*wardTokens\s+from/u.test(readFileSync(file, "utf8"))),
      ...ORIGINAL_FOUR.filter((f) => CSS.includes(f)),
    ]),
  ];

  it("discovers the token consumers rather than trusting a hand-list, and finds all four originals", () => {
    // ⚠️ TWO FLOORS, because a derived list can fail in two directions. A regex that stops
    // matching returns an empty set and every offender check below then passes vacuously; and a
    // discovery that silently drops the four the guard was written for would keep passing while
    // covering less than it used to.
    expect(NEW_MODULES.length, "no wardTokens consumers discovered — the matcher is broken").toBeGreaterThanOrEqual(7);
    for (const m of ORIGINAL_FOUR) expect(NEW_MODULES).toContain(m);
  });

  it("uses no --ward-* token the canonical layer does not declare", () => {
    // ⚠️ GUARDED FOR THE EMPTY-ROOT MUTATION. The plan's own draft reads ward-tokens.module.css
    // and each new module unconditionally, which throws ENOENT rather than degrading to an empty
    // set when ROOT points somewhere with no stylesheets — that would make an offender assertion
    // ERROR under the mutation instead of going green, which is exactly the failure the empty-ROOT
    // check exists to catch. `existsSync` first, so an absent file contributes nothing rather than
    // throwing, and the discovery guard below is what is actually meant to go red in that case.
    const tokens = existsSync(TOKEN_FILE) ? stripComments(readFileSync(TOKEN_FILE, "utf8")) : "";
    const declared = new Set([...tokens.matchAll(/(--ward-[\w-]+)\s*:/gu)].map((m) => m[1]));
    // WardGround is the common routed ancestor; only its .shell declarations inherit globally.
    const ground = stripComments(readFileSync(join(ROOT, "ward-shell.module.css"), "utf8"));
    const rootRule = /\.shell\s*\{([^}]+)\}/u.exec(ground)?.[1] ?? "";
    expect(rootRule).toContain("composes: wardTokens");
    expectWardGroundAncestry();
    expect(stripComments(readFileSync("src/app/mockups/ward-flow/layout.tsx", "utf8"))).toContain(
      "<WardGround>{children}</WardGround>",
    );
    for (const token of rootRule.matchAll(/(--ward-[\w-]+)\s*:/gu)) declared.add(token[1]);
    expect(declared.size, "the token layer parsed as empty").toBeGreaterThan(20);

    const offenders: string[] = [];
    for (const file of NEW_MODULES) {
      if (!CSS.includes(file)) continue;
      const css = stripComments(readFileSync(file, "utf8"));
      for (const m of css.matchAll(/var\(\s*(--ward-[\w-]+)/gu)) {
        // A declaration inside the module itself is legitimate; a USE of something undeclared
        // anywhere is not. Only flag names absent from both.
        if (!declared.has(m[1]) && !new RegExp(String.raw`${m[1]}\s*:`, "u").test(css)) {
          offenders.push(`${file}: var(${m[1]}) is declared nowhere`);
        }
      }
    }
    expect(
      [...new Set(offenders)].filter((o) => !KNOWN_UNDECLARED.some((k) => o.includes(k))),
      offenders.join("\n"),
    ).toEqual([]);
  });

  /**
   * The previous surface-hover exception is resolved: the consuming rule now reads its existing
   * surface-subtle fallback directly, preserving its appearance without an undeclared alias.
   * Keep the bidirectional guard for any future explicitly documented exception.
   *
   * ⚠️ AND THIS ROW ASSERTS IN BOTH DIRECTIONS, DELIBERATELY. A one-directional allowlist is dead
   * weight the moment its entry is fixed: it silently permits the next instance and nothing ever
   * goes red. Four one-sided pins were found stale in this repository on 2026-09-04 and one of
   * them would have LICENSED the defect it was written to record. So this fails if the token
   * becomes declared, and it fails if the use disappears — either way the row must go, and the
   * test says so rather than leaving somebody to notice.
   */
  // The old surface-hover fallback now reads its existing surface token directly.
  const KNOWN_UNDECLARED: string[] = [];

  it("keeps the known-undeclared list honest in both directions", () => {
    const tokens = existsSync(TOKEN_FILE) ? stripComments(readFileSync(TOKEN_FILE, "utf8")) : "";
    const declared = new Set([...tokens.matchAll(/(--ward-[\w-]+)\s*:/gu)].map((m) => m[1]));
    // WardGround is the common routed ancestor; only its .shell declarations inherit globally.
    const ground = stripComments(readFileSync(join(ROOT, "ward-shell.module.css"), "utf8"));
    const rootRule = /\.shell\s*\{([^}]+)\}/u.exec(ground)?.[1] ?? "";
    expect(rootRule).toContain("composes: wardTokens");
    expectWardGroundAncestry();
    expect(stripComments(readFileSync("src/app/mockups/ward-flow/layout.tsx", "utf8"))).toContain(
      "<WardGround>{children}</WardGround>",
    );
    for (const token of rootRule.matchAll(/(--ward-[\w-]+)\s*:/gu)) declared.add(token[1]);
    const usedAnywhere = new Set(
      NEW_MODULES.flatMap((f) =>
        [...stripComments(readFileSync(f, "utf8")).matchAll(/var\(\s*(--ward-[\w-]+)/gu)].map((m) => m[1]),
      ),
    );
    for (const name of KNOWN_UNDECLARED) {
      expect(declared.has(name), `${name} is now declared — remove it from KNOWN_UNDECLARED`).toBe(false);
      expect(usedAnywhere.has(name), `${name} is no longer used — remove it from KNOWN_UNDECLARED`).toBe(true);
    }
  });

  /**
   * ⚠️ THE COMPOSITION BETWEEN .chip AND .kindChip IS UNOBSERVABLE FROM A DOM TEST, SO IT IS
   * ASSERTED HERE AS TEXT. `composes` is resolved by the CSS-module compiler; in jsdom the style
   * object is a proxy that fabricates a plausible scoped name for any property, so `toHaveClass`
   * reports success whether or not any composition happened.
   *
   * Concretely: split .chip and .kindChip into separate modules WITHOUT adding
   * `from "./ward-chip.module.css"` and every DOM test still passes. Only a real build notices,
   * and by then the chip has lost its border, padding and type scale on every screen.
   */
  it("keeps .kindChip composing .chip in the same module, where a bare composes can resolve", () => {
    const chipModule = join(ROOT, "ward-chip.module.css");
    expect(CSS, "the chip module is not in the discovered set").toContain(chipModule);
    const css = stripComments(readFileSync(chipModule, "utf8"));

    // A bare `composes: chip` only resolves when `.chip` is declared in this same file.
    expect(css, "ward-chip.module.css must declare .chip").toMatch(/^\s*\.chip\s*\{/mu);
    expect(css, ".kindChip must compose chip").toMatch(/\.kindChip\s*\{[^}]*composes:\s*chip\s*;/u);
  });
});

describe("the ground is not merely painted — it has to be visible", () => {
  /**
   * ⚠️ FOUND BY OPENING THE APP, AFTER EVERY TEST WAS GREEN. `WardGround` paints
   * `--ward-ground` and is a real DOM ancestor of every route's `<main>` — asserted, proved by
   * mutation, all true. And on every single ward screen the ground is INVISIBLE, because each
   * screen's own root paints `background: var(--surface)` straight over it.
   *
   * Measured in the running app 2026-09-04, coordinator route:
   *     .shell   (WardGround)  rgb(244, 247, 250)   <- the ground
   *     .screen  (coordinator) rgb(255, 255, 255)   <- covers it entirely
   *     main                   rgba(0, 0, 0, 0)
   *
   * **The ancestry assertion is true, on-topic, and does not discriminate.** "Is the ground an
   * ancestor" and "does the reader see a ground" are different questions, and only the first was
   * ever asked. The approved direction is panels floating on a ground; today it renders as the
   * white-on-white it was meant to replace, with a full green suite.
   *
   * NOT fixed by stripping all twenty at once: these screens are not yet laid out as panels, so
   * removing their surface now puts un-panelled content directly on grey. Each screen drops it as
   * that screen is rebuilt. This pin makes the debt visible and countable so it cannot be
   * forgotten, and so "the ground is painted" is never again read as "the ground is visible".
   */
  /**
   * ⚠️ THIS LIST WAS STALE FROM THE DAY IT WAS WRITTEN, AND THE `freed` HALF BELOW IS WHAT SAID SO.
   * Four screens — `patients/add-patient`, `patients/person`, `ward/ward`, `wards/ward-index` —
   * had ALREADY been freed when the pin was authored, each carrying an explicit "NO background
   * here, deliberately" comment in its own `.screen` rule. They were listed anyway, so this test
   * shipped RED on the integration line and stayed red while three chats were told the backlog was
   * twenty screens. It is sixteen. Removed 2026-09-04 after reading all four rules.
   *
   * ⚠️ AND THE LESSON IS NOT "UPDATE THE LIST". A pinned list is a RECORD, never a MEASUREMENT, and
   * it was read here as though it were one — including by the integrator, who quoted "all twenty
   * screen roots still paint over the ground" to three chats from this constant rather than from
   * the detector. The `freed` assertion had been saying otherwise the whole time, in a test nobody
   * ran because nothing they were changing was near it.
   */
  /*
   * 🔴 EIGHTEEN ROWS THIS MORNING, ONE NOW — and the resolution that produced it was MECHANICAL,
   * not a judgement, which is the only reason to trust a shrink that large.
   *
   * Three branches each removed a different subset against a different snapshot of which screens
   * were adopted, so no side's list was correct for the folded tree and a hand-merge of the three
   * would have been a plausible-looking guess. ⚠️ **The wrong resolution here is also a GREEN one:**
   * a list and a set of files that agree with each other while both being the old thing passes both
   * halves of this pin. Only the MIXED states go red.
   *
   * So the procedure was: take one side arbitrarily, run this test, apply the rows it names
   * verbatim, re-run. The two-sided pin IS the oracle — `added` names a screen that covers and is
   * not listed, `freed` names a listed screen that no longer covers, and both name files. It said
   * to remove handover, morning, officer, out-of-area and search; they were removed; it went green.
   *
   * ⚠️ THE ONE JUDGEMENT LEFT, and it is the only way to misapply this: the oracle is correct only
   * if the merged CSS is correct. If a fold takes every branch's list removals but drops one
   * branch's actual stylesheet change, `freed` fires naming that file — and the right response is
   * to RESTORE THE MISSING CSS, not to put the row back. Putting the row back is also green, and
   * wrong.
   */
  /* ⚠️ ANNOTATED BECAUSE IT IS EMPTY. With rows in it the type was inferred; at zero rows
     TypeScript infers `any[]` and `noImplicitAny` fails — and vitest runs no tsc, so the suite
     stayed green through it. The annotation is what lets this list reach zero at all. */
  const COVERING_THE_GROUND: string[] = [
    // ⚠️ THREE SCREENS ONCE SAT HERE AND ALL THREE ARE NOW GONE FROM THIS LIST — that is the
    // pin working, not the pin rotting. `tracker/live-tracker.module.css`,
    // `ward-management-modes.module.css` and `ward-management.module.css` each had their root
    // background deleted (2026-09-04) and each row was removed with it.
    //
    // ⚠️ KEPT BECAUSE IT IS THE REASON THE DETECTOR BELOW WAS REWRITTEN, AND THAT REASON OUTLIVES
    // THE ROWS. Two of the three were invisible to the OLD detector for two compounding reasons at
    // once: their roots are not called `.screen` (`.modeShell` and `.patientWorkspace`), and they
    // painted `var(--ward-canvas)` rather than `var(--surface)` — which are THE SAME COLOUR,
    // because `--ward-canvas: var(--surface)`. Either miss alone hid them; together nothing could
    // have found them. Real screens, on no backlog, assigned to nobody, with every gate green.
    //
    // ⚠️ DO NOT ADD A ROW BACK HERE TO "RECORD" ONE OF THE THREE. `freed` is derived from this
    // list, so a row for a screen that no longer paints goes red immediately — correctly. The
    // history belongs in this comment; the list holds only screens that still cover the ground.
  ];

  /**
   * Stylesheets whose outermost rule is SUPPOSED to paint a surface. A panel that did not paint a
   * background would not be a panel, and the shell's whole job is to paint the ground. Excluding
   * them by name is honest; letting the detector "find" them and pinning them as debt would be a
   * backlog that can never reach zero.
   */
  const NOT_A_SCREEN = new Set([
    // Compact header island mounted inside EdScreen, whose page root remains transparent.
    // This surface ends after the department browser; it does not cover the page ground.
    "ed/ed-overview.module.css",
    "ward-panel.module.css",
    "ward-chip.module.css",
    "ward-figure.module.css",
    "ward-shared.module.css",
    "ward-shell.module.css",
    "ward-sidebar.module.css",
    "ward-tokens.module.css",
    // ⚠️ ADDED 2026-09-05, second-edition visual pass on QueueView/ExceptionsView/GovernanceView.
    // Same shape as `ward-panel.module.css` above: its first declared rule is `.panel`, a
    // component class that legitimately paints `--ward-canvas` on top of the ground `WardGround`
    // already paints at the layout — not a page root. The file has no `.screen`/`.modeShell`
    // equivalent at all; every class in it is scoped to a panel, a table cell, a chip or a list
    // inside one of the three views ward-management-modes.tsx still owns.
    "ward-modes-second-edition.module.css",
    /*
     * ⚠️ **ADDED 2026-09-07 — THE GLOBAL CHROME, AND EACH ONE WAS CHECKED RATHER THAN ASSUMED.**
     *
     * These three landed with the owner's header/sidebar build and turned this test red, correctly:
     * all three paint a surface in their first rule. **They belong in this exemption and NOT in
     * `COVERING_THE_GROUND`, which is shrinking debt — adding chrome to a backlog that is meant to
     * reach zero would make it un-emptiable**, the exact failure the comment above records for the
     * count floor.
     *
     * The test is whether the first rule is a PAGE ROOT (`.screen`, `.modeShell`) or a component
     * that would not be itself without a background. Opened all three:
     *
     *   `.wrap`   ward-standing-strip — the sticky figures band. Board content scrolls UNDER it, so
     *             a transparent one renders text through text. Opacity is what makes it chrome.
     *   `.opener` ward-tasks-panel    — a `<button>`.
     *   `.drawer` ward-tasks-drawer   — a side panel with its own left border.
     *
     * None has a `.screen` or `.modeShell` equivalent anywhere in the file. Same category as
     * `ward-shell.module.css` and `ward-sidebar.module.css` above, which are this app's other two
     * chrome stylesheets and were exempted on the same reasoning.
     */
    "ward-standing-strip.module.css",
    "ward-tasks-panel.module.css",
    "ward-tasks-drawer.module.css",
    /*
     * ⚠️ **`.bar` — the single header row, added when the owner asked for the figures toggle to sit
     * in the top of the header rather than in a bar of its own.** Same category as the four above
     * and as `ward-shell`/`ward-sidebar`: its first rule is a chrome component that page content
     * scrolls UNDER, so a transparent one renders text through text. Not a page root; the file
     * contains no `.screen` or `.modeShell` equivalent.
     */
    "ward-chrome-header.module.css",
    // ⚠️ ADDED — Task 2, fourth-edition statistics language port (wise-singing-thunder). Same
    // shape again: this file's first declared rule is `.band` (the figure-band primitive), which
    // legitimately paints `--ward-canvas` the same way `.panel` does two rows above it. The file
    // is a PRIMITIVE LIBRARY, not a screen — it has no `.screen` root and is never rendered on its
    // own; every class in it (`.band`, `.panel`, `.dtable`, `.reveal`, `.kv`, `.figs`, `.delta`,
    // `.chart`, `.legend`) is a component a later task mounts inside an existing screen's own
    // root, which is what paints the ground underneath it.
    "statistics-v4.module.css",
    // ADDED 2026-09-25 (test fixer): its first rule is `.navBar`, a bordered, rounded section bar
    // mounted inside the statistics screens' own root — a component, not a page root.
    "statistics-nav.module.css",
    // ADDED 2026-10-03 (PR #33): first rules are `.disclosure` (a bordered, rounded disclosure card)
    // and `.chart` (a bordered chart card). Both are components mounted inside a statistics screen's
    // own root, which paints the ground beneath them; neither file has a `.screen` root.
    "statistics/statistics-family.module.css",
    "statistics/statistics-insight-chart.module.css",
    // ADDED 2026-10-04 (stranded-patient prompts): first rule is `.panel`, a bordered, rounded
    // disclosure the ward board mounts inside its own root, which paints the ground beneath it.
    // A component, not a page root; the file has no `.screen` equivalent.
    "board/stranded-prompts.module.css",
    // ⚠️ ADDED 2026-09-07 — the standing strip and the tasks drawer/opener, the chrome that now
    // mounts on every one of the 29 renderable routes. Same shape as `ward-panel.module.css` at
    // the top of this set, and the distinction is worth stating because these three are the first
    // entries here that are CHROME rather than a component library:
    //
    //   `.strip`  a band ABOVE the page content, `border-bottom` + `--ward-chrome`
    //   `.drawer` a panel BESIDE it, `border-left` + `--ward-chrome`
    //   `.opener` a button
    //
    // 🔴 **NONE OF THEM IS A PAGE ROOT, AND NONE OF THEM PAINTS THE GROUND.** They paint
    // `--ward-chrome`, which is `var(--surface-chrome)` — the surface a coordinator reads as "this
    // is the application, not the page". The ground under them is still painted by `WardGround` at
    // the layout, exactly as before; a strip that painted nothing would be a transparent band over
    // scrolling content, and a drawer that painted nothing would not be a drawer.
    //
    // ⚠️ THE JUDGEMENT, so the next editor can check it rather than trust it: the question this
    // list answers is "does this file's outermost rule paint over the ground a screen sits on",
    // NOT "does this file paint". Chrome that sits outside the page's own box is not covering the
    // ground; a screen root that paints `--ward-chrome` still is. If any of these three ever
    // acquires a `.screen`-equivalent root, it belongs back in the detector.
    "ward-standing-strip.module.css",
    "ward-tasks-drawer.module.css",
    "ward-tasks-panel.module.css",
    // ADDED 2026-09-17 (screens plan S2): the service scope bar. Its first rule is `.bar`, a strip a
    // scoped screen mounts inside its own page — a component that paints its own surface, not a
    // page root. Checked by opening the file, not assumed.
    "ward-service-scope-bar.module.css",
    /*
     * ⚠️ **ADDED — the third-edition shell (`shell/ward-rail.tsx`, `shell/ward-bar.tsx`), found by
     * the fold that first merged this shell into a tree that also walks it.** Same category as the
     * pairs above, checked against the guard's own question rather than assumed:
     *
     *   `.rail` (`ward-rail.module.css`)  the persistent left navigation rail — page content
     *                                     scrolls BESIDE it, exactly `ward-sidebar.module.css`'s
     *                                     `.panel` above.
     *   `.bar`  (`ward-bar.module.css`)   the persistent top header row — page content scrolls
     *                                     UNDER it, exactly `ward-chrome-header.module.css`'s own
     *                                     `.bar` above (same class name, same role).
     *
     * 🔴 **NEITHER FILE HAS A `.screen` OR `.modeShell` EQUIVALENT.** Both are single-purpose shell
     * stylesheets, not page-content stylesheets — there is no page root here for a background to
     * cover. The ground under the actual page content is still painted by `WardGround` at the
     * layout, exactly as before this shell existed; a rail or a bar that painted nothing would be
     * transparent chrome over scrolling content, which is not what either is meant to be.
     *
     * Real overpaint was considered and ruled out: an overpaint DEBT here would mean a page's own
     * root repainting the ground it sits on, and `.rail`/`.bar` are not page roots — they are the
     * chrome a page sits beside and under, the same distinction that already exempts every entry
     * above. This is a registration, not evidence deferred.
     *
     * ⚠️ **PATH-QUALIFIED, NOT A BARE BASENAME — AND THAT IS NOT STYLE.**
     * `src/components/ward-management/ward-bar.module.css` (a DIFFERENT file: the statistics
     * distribution bar) already shares the basename `ward-bar.module.css` with
     * `shell/ward-bar.module.css`. `coveringScreens()` below matched this set by bare basename
     * only, so adding `"ward-bar.module.css"` here would have silently exempted BOTH files —
     * blinding the guard for the other one too, which does not belong in this set today and would
     * go unnoticed the day it starts painting its own `.bar` rule. Registering the full path and
     * checking both forms below is what keeps the exemption pointed at only the file it is about.
     */
    "shell/ward-rail.module.css",
    "shell/ward-bar.module.css",
  ]);

  /**
   * Every opaque surface a root could paint that is NOT the ground. `--ward-ground` and its
   * PsychSift source `--surface-inset` are deliberately absent: painting the ground IS the target
   * state, not the debt.
   *
   * ⚠️ THE WARD NAMES ARE HERE BECAUSE THEY ARE ALIASES, NOT ALTERNATIVES. `--ward-canvas` IS
   * `var(--surface)`; `--ward-chrome` IS `var(--surface-chrome)`; `--ward-subtle` IS
   * `var(--surface-subtle)`. A detector that matched only the PsychSift spellings could be defeated
   * by a rename that changes nothing on screen — and that is not hypothetical, it is how
   * `ward-management-modes` and `ward-management` stayed off this list. Adopting the token layer is
   * exactly the change a careful person makes, so the rename is the LIKELY accident, not the
   * adversarial one.
   */
  const OPAQUE_SURFACES = String.raw`var\(--(surface|surface-chrome|surface-subtle|surface-raised|ward-canvas|ward-chrome|ward-subtle)\)`;

  /** The outermost rule of a stylesheet: its first class rule once comments are stripped. */
  function firstRule(css: string): { name: string; body: string } | undefined {
    const name = /^\.([A-Za-z][\w-]*)[\s,{]/mu.exec(css)?.[1];
    if (!name) return undefined;
    const body = new RegExp(String.raw`^\.${name}[\s,{][^}]*\}`, "mu").exec(css)?.[0];
    return body ? { name, body } : undefined;
  }

  /**
   * Screen roots that paint an opaque background over the shell's ground.
   *
   * ⚠️ THIS USED TO MATCH A RULE LITERALLY NAMED `.screen`, AND TWENTY OF THE FORTY-ONE WARD
   * STYLESHEETS DO NOT HAVE ONE. `community-home` roots at `.home`, `community-team-hub` at
   * `.hub`, `ward-management-modes` at `.modeShell`. So the pin was blind in the direction nobody
   * watches — a NEW screen with a differently-named root would never appear as `added` and the
   * gate would stay green. It now takes whatever the first rule is, guarded by the assertion below.
   */
  function coveringScreens(): string[] {
    return CSS.filter((file) => {
      const normalized = file.replaceAll("\\", "/");
      const base = normalized.split("/").pop() ?? "";
      // ⚠️ CHECKED BOTH WAYS — see the shell entries' own comment above. A bare basename in
      // NOT_A_SCREEN exempts every file with that name anywhere under ROOT; a relative-path entry
      // exempts only that one file. `ward-bar.module.css` exists twice under this tree with two
      // different first rules, which is exactly the case a basename-only check cannot tell apart.
      const relative = normalized.replace(`${ROOT.replaceAll("\\", "/")}/`, "");
      if (NOT_A_SCREEN.has(base) || NOT_A_SCREEN.has(relative)) return false;
      const rule = firstRule(stripComments(readFileSync(file, "utf8")));
      return Boolean(rule && new RegExp(String.raw`background(-color)?:\s*${OPAQUE_SURFACES}`, "u").test(rule.body));
    })
      .map((f) => f.replaceAll("\\", "/").replace(`${ROOT.replaceAll("\\", "/")}/`, ""))
      .sort();
  }

  /**
   * ⚠️ THIS WAS `expect(coveringScreens().length).toBeGreaterThan(10)` AND IT WENT RED BY SUCCEEDING.
   *
   * The backlog was 14. Four screens were adopted on 2026-09-04, leaving exactly 10, and `10` is
   * not greater than `10`. **A count floor over a shrinking backlog is a guard that gets harder to
   * satisfy the closer the work gets to done, and reaches zero-tolerance exactly when the backlog
   * empties** — the one moment it should be celebrating. Raising or lowering the number just moves
   * the date it fails again.
   *
   * The intent was never to measure the backlog. It was to stop an EMPTY result reading as a fixed
   * backlog, if the detector silently stopped matching anything. So the probe below tests the
   * detector's mechanism directly, on synthetic input, and is independent of how much real debt
   * remains. It reads correctly at a backlog of 14, of 10, and of 0.
   *
   * Worth noting that the `freed` half already covers the same failure from another direction: a
   * detector that goes blind makes every pinned file look freed, and that assertion goes red naming
   * all of them. This probe is the cheaper, more direct statement of the same requirement, and it
   * says which half of the matcher broke rather than only that something did.
   */
  it("detects a covering root on synthetic input, so an empty real result cannot look like a fixed backlog", () => {
    /**
     * ⚠️ FLOOR THE DENOMINATOR, NEVER THE NUMERATOR — and this line is the half the synthetic
     * probe below cannot cover on its own.
     *
     * The probe proves the MATCHER works. It does not prove the matcher was RUN OVER ANYTHING. If
     * the walk returns empty — a moved directory, a changed glob, a bad ROOT — every synthetic
     * assertion below still passes, `coveringScreens()` returns `[]`, and the `freed` half then
     * reports every remaining pinned row as freed, which reads as "the backlog is finished".
     *
     * So the floor goes on the population WALKED, which only ever grows, rather than on the
     * covering count, which is being deliberately driven to zero. 42 stylesheets at the time of
     * writing; 30 leaves room for consolidation without leaving room for an empty tree.
     */
    expect(CSS.length, `only ${CSS.length} ward stylesheets walked — the file walk is broken`).toBeGreaterThan(30);

    const detects = (css: string): boolean => {
      const rule = firstRule(css);
      return Boolean(rule && new RegExp(String.raw`background(-color)?:\s*${OPAQUE_SURFACES}`, "u").test(rule.body));
    };

    // Must DETECT: an opaque paint over the ground, under either spelling. `--ward-canvas` is an
    // alias for `--surface`, so a root repainted with the alias covers the ground exactly as
    // before while reading as adoption in a diff — the blindness this pin was rewritten to close.
    expect(detects(".screen {\n  background: var(--surface);\n}"), "plain --surface not detected").toBe(true);
    expect(detects(".screen {\n  background: var(--ward-canvas);\n}"), "the --ward-canvas alias not detected").toBe(
      true,
    );
    // …and under a root that is not called `.screen`, which twenty of these stylesheets are not.
    expect(detects(".modeShell {\n  background: var(--surface-subtle);\n}"), "non-.screen root not detected").toBe(
      true,
    );

    // Must NOT detect: the target state. Painting the ground is what adoption looks like, and a
    // root that paints nothing at all is the other half of it.
    expect(detects(".screen {\n  background: var(--ward-ground);\n}"), "--ward-ground wrongly flagged").toBe(false);
    expect(detects(".screen {\n  color: var(--text);\n}"), "a root with no background wrongly flagged").toBe(false);
  });

  /**
   * ⚠️ THE GENERALISATION ABOVE RESTS ON A FACT ABOUT THIS TREE, SO THE FACT IS PINNED BESIDE IT.
   * "The first rule is the root" was verified, not assumed: of the 21 stylesheets that declare a
   * `.screen` rule, `.screen` is the first rule in all 21. If a file ever declares `.screen`
   * somewhere other than first, the generalisation has silently stopped holding and this goes red
   * — rather than the detector quietly reading the wrong rule and reporting a clean sweep.
   */
  it("keeps the assumption the root detector rests on: where .screen exists, it is the first rule", () => {
    const violators = CSS.filter((file) => {
      const css = stripComments(readFileSync(file, "utf8"));
      if (!/^\.screen[\s,{]/mu.test(css)) return false;
      return firstRule(css)?.name !== "screen";
    }).map((f) => f.replaceAll("\\", "/").replace(`${ROOT.replaceAll("\\", "/")}/`, ""));
    expect(violators, `.screen is not the first rule in: ${violators.join(", ")}`).toEqual([]);

    /**
     * ⚠️ THIS FLOOR IS PINNED TO A POPULATION THIS PROGRAMME IS MOVING, AND IT WILL BREAK.
     * 15 against 21 files that declare a `.screen` today, out of 42 walked.
     *
     * Token adoption does not move it — adoption removes the root's background, not its selector.
     * **A RENAME does**, and renames are happening: `ward-management-modes` already roots at
     * `.modeShell`, `community-home` at `.home`, `community-team-hub` at `.hub`. Six more and this
     * goes red for a reason nobody will connect to the rename three commits earlier.
     *
     * That is a worse version of the defect that took out the covering-count floor above, which
     * failed on a number the work drives down deliberately — so at least the connection was
     * obvious. This one fails on a number the work moves as a SIDE EFFECT.
     *
     * ⚠️ WHEN IT BREAKS, THE FIX IS NOT TO LOWER THE NUMBER. Lowering it only moves the date it
     * fails again — that is the tell for the whole class. **Floor the denominator instead:**
     * `expect(CSS.length).toBeGreaterThan(30)` in the covering-ground probe above is the pattern,
     * and it works because the walked population only ever grows and does not care what any
     * selector is called. Left as a count here only because it is not failing and a second hand in
     * this file right now would collide.
     */
    const withScreen = CSS.filter((f) => /^\.screen[\s,{]/mu.test(stripComments(readFileSync(f, "utf8"))));
    expect(withScreen.length, "no .screen rules found at all — the assumption test is vacuous").toBeGreaterThan(15);
  });

  it("adds no NEW screen that covers the ground, and notices when one is freed", () => {
    const covering = coveringScreens();
    const added = covering.filter((f) => !COVERING_THE_GROUND.includes(f));
    expect(added, `new screens covering the ground: ${added.join(", ")}`).toEqual([]);

    // ⚠️ The other direction matters as much here, and it is the half a backlog pin usually
    // omits. This debt is meant to shrink. If a screen is freed and the list is not updated,
    // the pin goes stale and quietly tolerates that screen covering the ground again later.
    const freed = COVERING_THE_GROUND.filter((f) => !covering.includes(f));
    expect(freed, `freed — remove from COVERING_THE_GROUND: ${freed.join(", ")}`).toEqual([]);
  });
});

describe("no Ward Flow test file is invisible to the runner", () => {
  const config = readFileSync("vitest.config.mts", "utf8");
  const populationImport = config.match(/import\s*\{([^}]+)\}\s*from\s+["']\.\/scripts\/unit-test-population\.mjs["']/);
  const names = populationImport?.[1]?.split(",").map((name) => name.trim()) ?? [];
  if (
    !names.includes("DOM_UNIT_TEST_GLOBS") ||
    !/name:\s*"jsdom",[\s\S]*?include:\s*DOM_UNIT_TEST_GLOBS/.test(config)
  ) {
    throw new Error("Cannot verify shared jsdom collection binding; update the extraction");
  }
  const jsdomIncludes = DOM_UNIT_TEST_GLOBS;
  it("uses the actual DOM and contract include patterns without admitting arbitrary TSX tests", () => {
    expect(jsdomIncludes).toEqual(["tests/**/*.dom.test.tsx", "tests/**/*.contract.test.tsx"]);
    expect(jsdomIncludes.some((pattern) => matchesGlob("tests/ward-example.contract.test.tsx", pattern))).toBe(true);
    expect(jsdomIncludes.some((pattern) => matchesGlob("tests/ward-example.test.tsx", pattern))).toBe(false);
  });
  /**
   * ⚠️ A TEST FILE THAT MATCHES NO INCLUDE GLOB RUNS NOTHING AND SAYS NOTHING. Measured
   * 2026-09-04 from `vitest.config.mts`: the two project globs are `tests/**\/*.test.ts` and
   * `tests/**\/*.dom.test.tsx`. So `tests/foo.test.tsx` — the most natural name in the world for a
   * React component test — matches NEITHER. Vitest reports "No test files found" only if you run
   * that path explicitly; in a whole-suite run it is simply absent, and absence looks like success.
   *
   * An agent hit this while writing a real DOM test and caught it only because it ran the file by
   * name. Had it not, the suite would have reported green with one fewer test file in it — the
   * same shape as a hand-picked test list that silently stops covering a file.
   *
   * Scoped to Ward Flow because that is this plan's remit. The hazard is repository-wide.
   */
  it("names every ward test file the runner can actually see", () => {
    const invisible = readdirSync("tests")
      .filter((f) => f.startsWith("ward-"))
      .filter((f) => f.endsWith(".test.tsx"))
      .filter((f) => !jsdomIncludes.some((pattern) => matchesGlob(`tests/${f}`, pattern)));
    expect(invisible, `these match no vitest include glob and will never run: ${invisible.join(", ")}`).toEqual([]);
  });

  it("is looking at ward test files at all, so an empty pass cannot look like a clean one", () => {
    const wardTests = readdirSync("tests").filter((f) => f.startsWith("ward-") && f.includes(".test."));
    expect(wardTests.length).toBeGreaterThan(20);
  });
});

const TS = walk(ROOT).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));

describe("no Ward Flow file builds a regex from a template literal carrying an escape", () => {
  /**
   * ⚠️ THIS EXISTS BECAUSE A WRITTEN RULE DID NOT FIRE. The escape-dropping defect —
   * `new RegExp(`…\s…`)` silently becoming `…s…` — is documented and was written into this very
   * plan anyway, twice in one evening in two different files. A note that is still TRUE and simply
   * did not apply itself needs a check, not a better memory.
   */
  it("is checking source files, not an empty set", () => {
    expect(TS.length).toBeGreaterThan(10);
  });

  it("uses String.raw wherever it constructs a RegExp from a template literal", () => {
    // Matches `RegExp(` followed by a backtick — with or without `new`, and with or without
    // String.raw — then reports only the ones where String.raw is absent and a backslash is
    // present. A template literal with no escape in it is harmless and is not flagged.
    const CONSTRUCTED = /(?:new\s+)?RegExp\(\s*(String\.raw\s*)?`([^`]*)`/gu;
    const offenders: string[] = [];
    for (const file of TS) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(CONSTRUCTED)) {
        const usesRaw = Boolean(m[1]);
        const hasEscape = m[2].includes("\\");
        if (!usesRaw && hasEscape) offenders.push(`${file}: RegExp(\`${m[2].slice(0, 40)}\`)`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
