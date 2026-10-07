import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blankCssComments } from "./helpers/strip-source-comments";

/**
 * 🔴 **A `var()` NAMING A TOKEN THAT DOES NOT EXIST READS CORRECT AND PAINTS WRONG.**
 *
 * Ward Builder One named three shapes of one family while fixing a chart whose two segments came out
 * the same colour: **a token that resolves to nothing**, **a token that resolves to its neighbour's
 * value**, and **a token that does not exist**. Each is a syntactically perfect declaration, which is
 * why every gate this repository had was blind to all three.
 *
 * ⚠️ **THE FIRST SHAPE WAS WITHDRAWN AFTER THIS FILE'S COMMIT MESSAGE (`01f88b962`) REPEATED IT, AND
 * THE COMMIT MESSAGE CANNOT BE CORRECTED — SO THE CORRECTION LIVES HERE, WHERE THE NEXT READER IS.**
 * `--warning` and `--clinical-accent` were said to resolve to nothing outside forced-colors. They do
 * not: both are declared in `globals.css` in **both** themes (`:534`/`:837` and `:415`/`:776`), and
 * the `LinkText`/`CanvasText` values at `:4594`/`:4606` are forced-colours **overrides** — correct
 * practice, not a hole. What had actually been measured was a **standalone mockup**,
 * `docs/ward-flow/design/prototypes/mockup-front-doors-v5.html`, which paints with both tokens and
 * declares only their `-soft`/`-border` variants. **True of that file; the sentence was written about
 * the app.** ⚠️ **And the mockup still looked plausible with those elements invisible, which is how a
 * drawing containing nothing gets approved** — the reason a mockup's flaw must never be relayed as
 * the product's, in either direction. Ward Builder Two caught it; Ward Builder One withdrew it.
 *
 * **The other two shapes stand and are measured.** This file guards the third.
 *
 * ⚠️ **The third is the worst, and it is the one this file catches.** A misspelled or never-declared
 * custom property makes its declaration *invalid at computed-value time* — the property is not
 * skipped, it falls back to the **inherited** value. So `font-size: var(--text-2xl)` on a heading
 * does not fail, does not warn, and does not paint large: it silently paints at whatever size its
 * parent uses, which is a plausible size, on a page that otherwise looks finished.
 *
 * **Nothing else in this repository could report it.** `design-token-contract.test.ts` checks that
 * DECLARED tokens are defined in both themes; `ckb-v2-token-contract.test.ts` checks the v2 layer's
 * scope and ladder. Neither walks the other direction — from a **reference** back to a declaration —
 * so a name that was never declared at all is invisible to both. Checked before writing this.
 *
 * **Scope is Ward Flow's own stylesheets**, resolved against its own declarations plus the two token
 * layers it composes on. Repo-wide would drag in Tailwind's generated properties and third-party CSS,
 * where an unresolved name is not evidence of anything.
 */

/** The stylesheets under test. */
const WARD_CSS = "src/components/ward-management/**/*.css";
/**
 * The layers a ward stylesheet legitimately inherits names from.
 *
 * 🔴 **A THIRD LAYER, ADDED 2026-09-11 — AND ONLY AFTER MEASUREMENT, NOT INSTEAD OF IT.** The
 * sync that pulled the master line into the third-edition shell branch revealed 49 `--accent`/
 * `--r1`/`--body`/… references this guard called unresolved: `src/app/ward-flow-shell-tokens.
 * module.css` (phase-1.1's own new token layer, composed onto `.rail`/`.bar` via `composes:
 * wardShellTokens from "../../../app/ward-flow-shell-tokens.module.css"`) was never listed here.
 * Adding a file to this array makes any failure against it vanish whether or not a single
 * token actually paints — an unresolved `var()` fails silently, invalid at computed-value time,
 * painting the INHERITED value rather than erroring — so before this line was added, `WardRail`
 * and `WardBar` were rendered through Next's own dev build (not jsdom, not a static read of the
 * CSS) at `/mockups/ward-flow/shell-token-check-scratch` and read back with a real browser's
 * `getComputedStyle` on the live `[data-testid="ward-rail"]`/`[data-testid="ward-bar"]` elements:
 * `--accent` -> `#2f4c66`, `--r1` -> `.625rem`, `--body` -> the resolved Geist stack (`"geistSans",
 * "geistSans Fallback", "Segoe UI", system-ui, sans-serif` — proving the nested
 * `var(--font-geist-sans)` inside `--body` resolves too), plus the PAINTED `background-color`
 * (`rgb(253, 253, 254)` = `--surface`), `color` (`rgb(22, 26, 32)` = `--ink`) and
 * `border-right-color` (`rgba(22, 30, 40, 0.11)` = `--line`) on the rendered `<nav>`/`<header>` —
 * every value exactly the declared one, none empty, none inherited from `globals.css` or
 * `ckb-v2-tokens.css` (neither declares `--accent`, `--r1` or `--body` at all, so a composition
 * failure could not have hidden behind either of those layers' own values). That answers the
 * open question a round-1 review raised and never closed: `composes: … from "../../../app/…"`
 * does resolve through Next's real build.
 *
 * Scoped to `.wardShellTokens`, a CLASS, not `:root` — this file's own header comment explains
 * why: the third edition is a genuinely new, closed colour system (its own `:root` in the
 * design drawing), not an alias of this app's existing v2 palette the way every other ward
 * stylesheet's tokens are, so it must never leak onto `:root` and repaint elements outside a
 * shell subtree that opts in by composing the class.
 */
const TOKEN_LAYERS = [
  "src/app/globals.css",
  "src/app/ckb-v2-tokens.css",
  "src/app/ward-flow-shell-tokens.module.css",
  "src/app/ward-flow-v6-tokens.css",
];

/** A declaration: `--name:` at the start of a rule, after a brace, or after a semicolon. */
const DECLARATION = /(^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/g;
/** A reference. The trailing group says whether a fallback follows, which changes what a miss means. */
const REFERENCE = /var\(\s*(--[A-Za-z0-9_-]+)\s*([,)])/g;

/**
 * 🔴 **A COMMENT IS NOT CODE, AND THIS GUARD WAS READING ONE.**
 *
 * `statistics-v4.module.css` documents three authoring bugs it deliberately did NOT port from the
 * reference mockup — `var(--r2)`, `var(--t-sm)`, `var(--t-xs)`, none of which exist — and names the
 * real tokens it used instead. **Scanning the raw text, this guard reported those three as live
 * undeclared references and demanded a fix that had already been made.** The only edit that could
 * have satisfied it was deleting the paragraph explaining why they are absent, after which the next
 * porter reintroduces the original bugs with nothing to warn them. **A guard that condemns the
 * record of its own fix is worse than the red it was reporting.**
 *
 * ⚠️ **STRIPPED FROM DECLARATIONS TOO, WHICH IS THE MIRROR BUG AND THE MORE DANGEROUS ONE.** A
 * `--token: value` written inside a comment would otherwise be collected as declared, and every
 * genuine miss of that name anywhere in the tree would go quiet.
 *
 * ⚠️ **LINE NUMBERS MUST SURVIVE.** Comment bodies are blanked to spaces with newlines kept, so
 * every offset after a comment is unchanged — this file reports `file:line`, and a reader sent to
 * the wrong line trusts the guard less than they should.
 *
 * **Two of us wrote this fix independently within the hour, and this is the better half of each.**
 * Mine deleted comment text outright, which is correct for the search and silently wrong for the
 * line numbers; theirs preserves offsets. Known limit, stated rather than left to be discovered: a
 * literal comment opener inside a CSS string would start a phantom comment. No ward stylesheet
 * contains one, and the reference scanner has the same blind spot for `var()` inside strings.
 */
/*
 * ⚠️ **THE HAND-ROLLED STRIPPER THAT LIVED HERE IS GONE, AND SO IS ITS WARNING — DELIBERATELY.**
 * It carried a real note: one spelling was chosen over another because the alternative had its
 * backslash eaten three times by a shell, each time producing a plausible-looking broken regex.
 * That warning was correct and is now MOOT rather than forgotten — there is no regex here to
 * corrupt.
 *
 * ⚠️ **THE REPLACEMENT IS NOT A SMARTER STRIPPER, AND AN EARLIER DRAFT OF THIS NOTE CLAIMED IT WAS.**
 * `blankCssComments` is not literal-aware either — it scans for `/*` without modelling strings, so
 * the `"/*"`-inside-a-string hole is open in it too. (The literal-aware scan in that same helper is
 * `stripSourceComments`, which DELETES comments and so cannot be used where line numbers are
 * reported.) The reason to prefer it is that it is the ONE shared implementation: the hole exists in
 * every copy, and concentrating it in one function is what makes it closable at all. See the note
 * above `stylesheets()` in `ward-statistics-grid-tracks-fit-the-container.test.ts` for how the
 * copies came to exist beside it.
 */
const withoutComments = blankCssComments;

function read(paths: string[]) {
  return paths.map((path) => {
    const raw = readFileSync(path, "utf8");
    return { path, raw, text: withoutComments(raw) };
  });
}

/**
 * 🔴 **THE DECLARATION SURFACE IS WIDER THAN THE FILE TYPE, AND THIS GUARD LEARNED THAT TWICE.**
 *
 * A custom property can also be declared at RUNTIME, from a JSX inline style — and the hub does
 * exactly that: `hub-screen.tsx:497-499` sets `--bar-ready`, `--bar-not-yet` and `--bar-pulled`
 * per bed bar from `barWidth(...)`, which `hub.module.css:814-824` then reads as
 * `width: var(--bar-ready, 0%)`. **Those are per-row values that cannot live in a stylesheet: one
 * declared width would be one width for every ward.**
 *
 * ⚠️ **Scanning only `.css` reported all three as undeclared, and the correct-looking repair would
 * have been to point them at a shared token — pinning every bed bar on that screen to a single
 * width.** A guard that reddens correct work does not merely waste time; here it names a specific
 * wrong fix, and the fix is plausible enough to be taken.
 *
 * This is the SECOND false positive of the same family — the first was searching comments — and the
 * shared lesson is the one worth keeping: **this file's population is "everywhere a name can be
 * declared", not "the files I happened to open".**
 */
const RUNTIME_DECLARATION = /["'](--[A-Za-z0-9_-]+)["']\s*:/g;
const WARD_TS = "src/components/ward-management/**/*.{ts,tsx}";

const wardFiles = read(globSync(WARD_CSS));
const declared = new Set<string>();
for (const { text } of [...wardFiles, ...read(TOKEN_LAYERS)]) {
  for (const match of text.matchAll(DECLARATION)) declared.add(match[2]);
}
const runtimeDeclared = new Set<string>();
for (const { text } of read(globSync(WARD_TS))) {
  for (const match of text.matchAll(RUNTIME_DECLARATION)) {
    runtimeDeclared.add(match[1]);
    declared.add(match[1]);
  }
}

type Miss = { name: string; file: string; line: number; hasFallback: boolean };
const misses: Miss[] = [];
let referenceCount = 0;
for (const { path, text } of wardFiles) {
  for (const match of text.matchAll(REFERENCE)) {
    referenceCount += 1;
    if (declared.has(match[1])) continue;
    misses.push({
      name: match[1],
      file: path.replaceAll("\\", "/"),
      line: text.slice(0, match.index).split("\n").length,
      hasFallback: match[2] === ",",
    });
  }
}

/**
 * 🔴 **THE TWO OPEN DEFECTS, RECORDED RATHER THAN ALLOWLISTED.**
 *
 * `--text-2xl` is declared **nowhere in this repository** — the v2 type scale stops at
 * `--text-xl: 1.5rem` (`ckb-v2-tokens.css:95`). Both uses below therefore render at the inherited
 * font size, not a larger one, and have done silently.
 *
 * ⚠️ **They are listed here so this file can be GREEN while they are open, and for no other reason.**
 * Fixing them is a visual change on a clinical screen — either the scale gains a `--text-2xl` (a
 * design-system decision, and `design-token-contract.test.ts` would then require it in both themes)
 * or these declarations are dead and should go. **That choice is the owner's, not this file's**, so
 * the defect is pinned in place of being quietly absorbed. Remove the entry when the site is fixed;
 * the assertion below then requires the list to shrink.
 */
/*
 * ✅ **EMPTIED 2026-09-06, AND THE EMPTYING IS THE POINT.** Both entries were real: `--text-2xl` is
 * referenced four times in ward CSS and declared NOWHERE, and these two sites carried no fallback,
 * so an undeclared custom property made the property INHERIT rather than be skipped — two headings
 * written to be the largest thing on a clinical screen drawing at their parent's size. Fixed at
 * `686a40613` by giving both the `var(--text-2xl, 1.5rem)` that the two sibling sites already wrote,
 * so all four now agree and the day somebody declares the token they adopt it together.
 *
 * 🔴 **THIS LIST WENT RED WHEN THE DEFECTS WERE FIXED, AND THAT IS THE DESIGN.** It is pinned by
 * SITE, not by count, so a third site fails AND a repaired site fails — which forces the list to be
 * maintained instead of drifting. ⚠️ **Whoever meets that red at speed will be tempted to relax it
 * to "no more than 2" or delete the case. That would remove the only thing in this repository that
 * can walk from a `var()` reference BACK to a declaration** — both existing token-contract tests
 * walk declarations only, in both themes and along the ladder, so a name nobody ever declared is
 * invisible to them. Ward Verifier, who wrote it, said so before it happened.
 *
 * **The empty array is not "nothing to check". It is the assertion that there is nothing left.**
 */
const OPEN_NO_FALLBACK_DEFECTS: string[] = [];

describe("every var() in Ward Flow's stylesheets names a token that exists", () => {
  it("floors the population, or a broken pattern passes by finding nothing", () => {
    /*
     * ⚠️ The anti-vacuity check, and it is the whole reason this file can be trusted. A regex that
     * silently stopped matching would collect zero references, find zero misses and report a clean
     * pass — indistinguishable, in its own output, from a codebase with no defects. These floors are
     * deliberately far below the measured values (51 files, 581 names, 5622 references) so ordinary
     * growth never touches them, and deliberately above zero so a dead scanner cannot pass.
     */
    expect(wardFiles.length, "no ward stylesheets were read at all").toBeGreaterThan(30);
    expect(declared.size, "no custom properties were collected — the declaration pattern is dead").toBeGreaterThan(300);
    expect(referenceCount, "no var() references were collected — the reference pattern is dead").toBeGreaterThan(2000);
  });

  it("STRIPS ONLY COMMENTS — a stripper that ate the rules would make every assertion below pass", () => {
    /*
     * 🔴 **THE CANARY FOR THE FIX, AND WITHOUT IT THE FIX IS WORSE THAN THE BUG.** Stripping comments
     * is what stopped this guard reddening a file for documenting its own repair. But a stripper with
     * an unbalanced `/*` scan returns a fragment, the fragment contains no `var()` at all, and **every
     * assertion in this file then passes while looking at nothing** — the same "clean result from
     * measuring nothing" this file's own floors exist to prevent, reintroduced by its own repair.
     *
     * Checked per file rather than in total: a total can stay healthy while one file is emptied, and
     * one emptied stylesheet is exactly how an undeclared token would slip through unseen.
     */
    const emptied = wardFiles.filter((f) => f.raw.includes("{") && !f.text.includes("{"));
    expect(
      emptied.map((f) => f.path),
      "the stripper ate a whole stylesheet — it has no rules left",
    ).toEqual([]);

    /*
     * And it must actually strip, or the exemption it grants is a no-op and the prose is still being
     * searched. Stated as "something went", never as a quantity that moves when anybody writes a
     * comment — a proportion measures comment density, not the stripper.
     *
     * ⚠️ **COUNTED IN NON-WHITESPACE CHARACTERS, NOT IN LENGTH, AND THE CHANGE IS NOT A RELAXATION.**
     * This compared `text.length` to `raw.length` while the stripper DELETED comments. The canonical
     * `blankCssComments` replaces each comment character with a space instead, so the length is
     * identical by design — that is precisely what keeps every reported line number and column exact,
     * which a deleting stripper cannot do.
     *
     * So the old assertion was measuring the one property the better implementation deliberately does
     * not have. The PROPERTY it was defending — "the comment text is genuinely gone from what we
     * search" — is unchanged and is what is asserted now.
     */
    const substance = (text: string) => text.replace(/\s/gu, "").length;
    const rawTotal = wardFiles.reduce((n, f) => n + substance(f.raw), 0);
    const liveTotal = wardFiles.reduce((n, f) => n + substance(f.text), 0);
    expect(liveTotal, "the stripper removed nothing at all — comments are still being searched").toBeLessThan(rawTotal);
  });

  it("SEES RUNTIME DECLARATIONS TOO, or a per-row value reads as an undeclared token", () => {
    /*
     * The canary for the second widening. If the JSX scan silently stopped matching, the three hub
     * bar-width properties would come back as "undeclared" and the obvious repair — point them at a
     * shared token — would pin every bed bar on that screen to one width. **A guard is at its most
     * dangerous when it is wrong AND specific**, so this pins that the runtime surface is genuinely
     * being read rather than trusting that it is.
     */
    expect(
      runtimeDeclared.size,
      "no custom property was collected from JSX — the runtime scan is dead",
    ).toBeGreaterThan(0);
    for (const name of ["--bar-ready", "--bar-not-yet", "--bar-pulled"]) {
      expect(runtimeDeclared, `${name} is set from hub-screen.tsx and must count as declared`).toContain(name);
    }
  });

  it("proves the two patterns discriminate, rather than matching everything or nothing", () => {
    // A control. Both patterns are run against text whose right answer is known here in the file,
    // so a pattern that matched every string — the other way a scanner passes while blind — fails.
    const sample = ":root { --alpha: 1px; }\n.x { color: var(--alpha); width: var(--never-declared, 2px); }";
    expect([...sample.matchAll(DECLARATION)].map((m) => m[2])).toEqual(["--alpha"]);
    expect([...sample.matchAll(REFERENCE)].map((m) => `${m[1]}${m[2]}`)).toEqual(["--alpha)", "--never-declared,"]);
  });

  it("strips comments in both directions, and does not move a single line while doing it", () => {
    /*
     * ⚠️ **THE CONTROL THAT MATTERS: stripping must not turn this guard into one that cannot fail.**
     * Blanking comments is the kind of change that fixes a red by making the scanner see less, so
     * all three directions are pinned here — a reference inside a comment is NOT a reference, a
     * declaration inside a comment is NOT a declaration, and live code either side of a comment is
     * still read.
     */
    const commented =
      ".a { color: var(--live); }\n/* explains var(--phantom) and --fake: 1px; */\n.b { top: var(--after); }";
    const stripped = withoutComments(commented);

    expect(
      [...stripped.matchAll(REFERENCE)].map((m) => m[1]),
      "a var() inside a comment was counted",
    ).toEqual(["--live", "--after"]);
    expect(
      [...stripped.matchAll(DECLARATION)].map((m) => m[2]),
      "a declaration inside a comment was counted",
    ).toEqual([]);

    // Line numbers are reported to whoever the guard stops. A stripper that collapsed the comment
    // would send them to the wrong line, and they would trust the guard less than they should.
    expect(stripped.split("\n").length, "stripping changed the line count").toBe(commented.split("\n").length);
    expect(stripped.length, "stripping changed the byte offsets").toBe(commented.length);
  });

  it("🔴 resolves every reference that has NO fallback — an unresolved one paints the inherited value", () => {
    /*
     * The strict half. With no fallback, a missing name is not a styling choice — the declaration is
     * invalid at computed-value time and the property inherits. This is the assertion that would have
     * caught `--text-2xl`, and it is pinned to the two known sites rather than to a count, so a THIRD
     * site fails even though the number of defects is unchanged in spirit.
     */
    const strict = misses.filter((miss) => !miss.hasFallback).map((miss) => `${miss.file} ${miss.name}`);
    expect([...new Set(strict)].sort(), "a ward stylesheet reads a token that does not exist").toEqual(
      OPEN_NO_FALLBACK_DEFECTS.slice().sort(),
    );
  });

  it("holds the fallback-bearing misses to the names already known, so the set cannot grow quietly", () => {
    /*
     * The looser half, and looser on purpose: `var(--x, 1rem)` with `--x` undeclared renders the
     * fallback, which may be exactly what the author meant. That makes it defensible, not invisible —
     * every one of these is still a name nobody declared, and a typo hides in the same place. Pinned
     * by NAME rather than by count so a new one fails and a fixed one also fails, forcing the list to
     * be maintained rather than drifting.
     */
    /*
     * 🔴 **THE THREE `--bar-*` NAMES ARE NOT UNDECLARED — THEY ARE DECLARED SOMEWHERE THIS SCANNER
     * CANNOT SEE, AND "FIXING" THEM WOULD BREAK THE SCREEN.**
     *
     *     hub-screen.tsx:497-499   style={{ "--bar-ready": barWidth(network.ready, network.beds), … }}
     *     hub.module.css:814,819,841   width: var(--bar-ready, 0%);
     *
     * A custom property assigned per instance from a JSX `style` object is the correct idiom for a
     * value only JavaScript can compute, and the `0%` fallback is deliberate: a bar has no width
     * until the component gives it one. This file reads stylesheets, so a property set in TSX is
     * invisible to it and reads as a miss.
     *
     * ⚠️ **The tempting fix — declaring them in the shared token layer to satisfy this list — would
     * give every bar on the screen the same fixed width.** A guard that cannot see the producer will
     * always propose making the value a constant, which is precisely what a per-instance value must
     * not be. Pinned here with the reason, not declared. If this file ever learns to read `style={{
     * "--x": … }}` out of TSX, these three come off the list.
     */
    const withFallback = [...new Set(misses.filter((miss) => miss.hasFallback).map((miss) => miss.name))].sort();
    expect(withFallback, "an undeclared token appeared behind a fallback").toEqual(
      /*
       * ⚠️ **`--bar-pulled` (once `--bar-blocked`), `--bar-not-yet` and `--bar-ready` WERE ON THIS LIST AND ARE NOT MISSES.**
       * They are declared at RUNTIME from JSX (`hub-screen.tsx:497-499`, one width per bed bar) and
       * read as `var(--bar-ready, 0%)`. A scan of `.css` alone cannot see a runtime declaration, so
       * they arrived here looking like undeclared names — and the obvious repair, pointing them at a
       * shared token, would have pinned every bed bar on that screen to a single width. They are
       * resolved by the JSX declaration scan above, so they must NOT be listed as misses; leaving
       * them here would re-assert the very thing that made the guard dangerous.
       */
      [
        "--focus-ring",
        "--success-bg-hover",
        "--text-2xl",
        /*
         * `--ease` left this list on 7 October 2026: the v6 rail restyle replaced
         * `var(--ease, ease)` with the declared `--wf-ease` token, so no stylesheet reads it now.
         */
        /*
         * Recorded 2026-09-25 (test fixer): names that 22–25 September stylesheets read with a
         * fallback and that no layer declares. Each renders its fallback today, and the latest
         * folded app is the design reference, so declaring them would change what shows. Pinned,
         * not declared; declaring any of them is a design decision.
         * 2026-10-05: `--accent-hover` and `--surface-hover` left this list when PR #66 declared
         * them on the shell token layer (aliases of `--accent-press` / `--surface-2`).
         */
        "--danger-line",
        "--r3",
        "--radius-card",
        "--svc-east-soft",
        "--svc-north-soft",
        "--svc-south-soft",
        "--svc-wachs-soft",
      ].sort(),
    );
  });
});

/**
 * 🔴 **DECLARED SOMEWHERE IS NOT RESOLVABLE HERE — the gap the suite above cannot see, and the one
 * that shipped a defect on 2026-09-07.**
 *
 * `ward-sidebar.module.css` carried a hand-written copy of twenty canonical ward tokens on `.panel`
 * and `.drawerBody`, because the drawer renders through a portal and cannot inherit them. Every
 * value matched `ward-tokens.module.css` exactly. **Four tokens were simply absent from the copy**
 * — `--ward-warning`, `--ward-warning-soft`, `--ward-danger`, `--ward-danger-soft` — so a rule in
 * that file reaching for one produced an unresolvable `var()`: invalid at computed-value time, so
 * the background silently went transparent and the border silently went `currentcolor`. No error,
 * no warning, nothing red. The urgent count chip rendered as an ordinary one.
 *
 * The suite above passes on exactly that, correctly and by design: it asks whether a referenced
 * token is DECLARED anywhere in the ward stylesheets, and `--ward-warning` is — in the canonical
 * file those two elements did not compose. Only a real render tells the difference.
 *
 * ⚠️ **THE FIRST VERSION OF THIS GUARD FORBADE RESTATING A CANONICAL TOKEN AT ALL, AND IT WAS
 * WRONG.** It reddened 23 stylesheets, every one of them doing the legitimate thing: a screen
 * setting `--ward-table-min-width: 60rem` for its own table, or narrowing `--ward-border` in one
 * region. **Overriding a token's VALUE is what custom properties are for.** A guard that has to be
 * obeyed by undoing correct work gets disabled instead, so it was replaced rather than allowlisted.
 *
 * What is actually wrong is a rule that PROVIDES THE TOKEN LAYER by hand — declaring a whole set at
 * once, where composing `wardTokens` is the only way to get all of it and keep getting all of it.
 * The line is drawn at five: measured across the ward tree the largest honest override group is
 * four (`board.module.css`), and the defect declared twenty. **A rule setting five canonical tokens
 * at once is not overriding values, it is standing in for the token layer** — and a stand-in is a
 * copy that will fall behind, exactly as this one had.
 */
describe("no ward stylesheet stands in for the canonical token layer", () => {
  const CANONICAL = "src/components/ward-management/ward-tokens.module.css";
  const LAYER_THRESHOLD = 5;

  function canonicalNames(): Set<string> {
    const names = new Set<string>();
    for (const match of withoutComments(readFileSync(CANONICAL, "utf8")).matchAll(DECLARATION)) {
      names.add(match[2]);
    }
    return names;
  }

  /** Every `selector { ... }` block, flat. Nested at-rules read as their own blocks, which is fine
   *  here: an at-rule body that declares five canonical tokens is the same defect. */
  function blocks(css: string): { selector: string; body: string }[] {
    const found: { selector: string; body: string }[] = [];
    for (const match of css.matchAll(/([^{}]*)\{([^{}]*)\}/gu)) {
      found.push({ selector: match[1].trim(), body: match[2] });
    }
    return found;
  }

  it("composes wardTokens rather than declaring the set by hand", () => {
    const canonical = canonicalNames();
    expect(canonical.size, "read no tokens from the canonical file — this test would prove nothing").toBeGreaterThan(
      20,
    );
    expect(canonical.has("--ward-warning"), "the token whose absence caused the defect").toBe(true);

    const offenders: string[] = [];
    for (const path of globSync(WARD_CSS)) {
      const posixPath = path.split("\\").join("/");
      if (posixPath === CANONICAL) continue;
      for (const block of blocks(withoutComments(readFileSync(path, "utf8")))) {
        const declared = new Set(
          [...block.body.matchAll(DECLARATION)].map((match) => match[2]).filter((name) => canonical.has(name)),
        );
        if (declared.size < LAYER_THRESHOLD) continue;
        if (/composes\s*:[^;]*wardTokens/u.test(block.body)) continue;
        offenders.push(`${posixPath} — ${block.selector}: ${[...declared].sort().join(", ")}`);
      }
    }

    expect(
      offenders,
      `these rules declare ${LAYER_THRESHOLD} or more canonical ward tokens without composing ` +
        "`wardTokens`, which makes them a second copy of the token layer. Compose it instead — a " +
        "copy is what left --ward-warning undeclared on the sidebar panel, where an unresolvable " +
        "var() fails silently rather than loudly:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
