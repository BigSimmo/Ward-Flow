import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/*
 * The one-chrome-owner rule, enforced structurally for the first time.
 *
 * Ward Flow's rule is that below the phone breakpoint there is exactly one top-anchored piece
 * of chrome — `ClinicalRail`'s `.phoneBar` (`ward-sidebar.module.css`, `position: fixed; top: 0`)
 * — and nothing has ever checked it. `tests/header-scroll-hide-contract.test.ts` asserts only
 * against a hard-coded list of non-ward source paths; `tests/mode-nav-addon-slot.dom.test.tsx`
 * mounts no Ward Flow component; `scripts/phone-chrome-plan.mjs` names no ward pattern. That gap
 * let `.workspaceHeader` (`ward-management.module.css`) ship as a SECOND top-anchored phone
 * element — `position: sticky; top: var(--spacing-ward-phone-bar)` inside the same
 * `@media (max-width: 40rem)` block — for the whole of Ward Flow's life, undetected.
 *
 * See docs/superpowers/plans/2026-09-04-ward-flow-navigation-shell.md, "Decision 3" and
 * "Task 5", for the full evidence trail and the ruling this guard enforces:
 * `.workspaceHeader` loses its sticky positioning; `.phoneBar` is the one owner.
 *
 * ⚠️ WIDENED FROM `fixed` ONLY. A guard that only looked for `position: fixed` would go GREEN on
 * `.workspaceHeader`, which is `position: sticky` — precisely the arrangement that shipped
 * undetected. The property this guard enforces is ONE TOP-ANCHORED PHONE ELEMENT, not one
 * fixed one, so it treats `fixed` and `sticky` identically whenever either is anchored to `top`
 * and visible at a narrow width.
 */

const REPO_ROOT = path.resolve(__dirname, "..");
const WARD_ROOT = path.join(REPO_ROOT, "src", "components", "ward-management");

function readModule(absolutePath: string): string {
  // Normalised to LF: the repository enforces LF via .gitattributes, but a working tree that has
  // picked up CRLF must fail this suite on its content, never on its line endings.
  return readFileSync(absolutePath, "utf8").split("\r\n").join("\n");
}

function walk(dir: string, predicate: (entry: string) => boolean): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full, predicate);
    return predicate(entry) ? [full] : [];
  });
}

function stylesheets(dir: string): string[] {
  return walk(dir, (entry) => entry.endsWith(".module.css"));
}

function scripts(dir: string): string[] {
  return walk(dir, (entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"));
}

// ⚠️ COMMENT-BLINDNESS CHECKED 2026-09-04 (see tests/ward-guard-comment-blindness.test.ts). This
// function already runs before any rule parsing below (`findChromeSelectors` calls it first), so a
// violation hidden inside `/* ... */` is genuinely inert here — CSS in a comment never applies, and
// this parser only ever sees post-strip text. Proved LATENT, not touched: added a real, uncommented
// `.mutationTestHeader { position: sticky; top: 0; }` violation (RED, as expected), then left it
// broken and additionally planted a decoy comment mentioning that same selector/declaration text
// elsewhere in the file — the assertion stayed RED, because the decoy comment is stripped before
// parsing exactly like a real one would be. A shared stripper (`blankCssComments`) was not swapped
// in here for that reason: this local strip already runs at the right point in the pipeline, and
// nothing about the proof calls for a different implementation of it.
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Splits a stylesheet into the text outside any `@media` block and the bodies of every
 * `@media (max-width: …)` block. This repo uses 40rem, 48rem, 62rem and 78rem interchangeably
 * for "narrower than desktop" across these files, and the one-owner rule cares about "is this
 * visible and top-anchored at SOME narrow width", not which exact breakpoint — so any
 * `max-width` condition counts. Non-`max-width` at-rules (`min-width`, `forced-colors`, `print`)
 * are dropped entirely: they neither gate visibility for this guard nor supply a base style,
 * and dropping them keeps the merge below honest about what it actually knows.
 *
 * This assumes the one level of `@media` nesting every file in this tree actually uses — no
 * nested media queries, no `@supports`/`@container` wrapping a media block. That is true of the
 * whole directory today (checked by hand against every `position: fixed|sticky` occurrence while
 * writing this guard); a file that broke the assumption would mis-parse silently, which is why
 * the "found the stylesheets" sanity test below exists to catch a scan that finds nothing at all.
 */
function splitMediaBlocks(css: string): { topLevelText: string; narrowBlocks: string[] } {
  const narrowBlocks: string[] = [];
  let topLevelText = "";
  let i = 0;
  while (i < css.length) {
    const atIndex = css.indexOf("@media", i);
    if (atIndex === -1) {
      topLevelText += css.slice(i);
      break;
    }
    topLevelText += css.slice(i, atIndex);
    const braceOpen = css.indexOf("{", atIndex);
    if (braceOpen === -1) break;
    const condition = css.slice(atIndex, braceOpen);
    let depth = 0;
    let j = braceOpen;
    for (; j < css.length; j += 1) {
      if (css[j] === "{") depth += 1;
      else if (css[j] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const body = css.slice(braceOpen + 1, j);
    const maxMatch = condition.match(/max-width\s*:\s*([0-9.]+)\s*(px|rem)?/i);
    if (maxMatch) {
      const maxWidth = Number(maxMatch[1]) * (maxMatch[2]?.toLowerCase() === "rem" ? 16 : 1);
      const minMatch = condition.match(/min-width\s*:\s*([0-9.]+)\s*(px|rem)?/i);
      const minWidth = minMatch ? Number(minMatch[1]) * (minMatch[2]?.toLowerCase() === "rem" ? 16 : 1) : 0;
      // Only media conditions with a non-empty intersection with the actual phone range qualify.
      // In particular, tablet/desktop ranges such as min-width: 62.5625rem and max-width:
      // 87.4375rem must not be mistaken for phone chrome.
      if (minWidth <= 640 && maxWidth >= minWidth) narrowBlocks.push(body);
    }
    i = j + 1;
  }
  return { topLevelText, narrowBlocks };
}

/**
 * Parses one flat run of `.selector { decl; decl; } .other { … }` text (no nested braces, which
 * is what `splitMediaBlocks` hands back) into a map from selector to the ordered list of raw
 * declaration-block strings that named it — a selector repeated across several rule blocks
 * collects one array entry per block, in source order.
 */
function parseRuleBlocks(text: string): Map<string, string[]> {
  const rules = new Map<string, string[]>();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const decls = match[2];
    for (const rawSelector of match[1].split(",")) {
      const selector = rawSelector.trim();
      if (!selector) continue;
      if (!rules.has(selector)) rules.set(selector, []);
      rules.get(selector)!.push(decls);
    }
  }
  return rules;
}

/**
 * Merges an ordered list of declaration-block strings into one property map, later declarations
 * overriding earlier ones for the same property — the rule real CSS applies whenever every
 * matching rule shares the same specificity and is a single class selector, which is all the
 * selectors this guard evaluates (see `SIMPLE_CLASS_SELECTOR` below).
 */
function mergeDecls(blocks: string[]): Record<string, string> {
  const props: Record<string, string> = {};
  for (const block of blocks) {
    for (const rawDecl of block.split(";")) {
      const line = rawDecl.trim();
      if (!line) continue;
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const prop = line.slice(0, colon).trim().toLowerCase();
      const value = line.slice(colon + 1).trim();
      props[prop] = value;
    }
  }
  return props;
}

const SIMPLE_CLASS_SELECTOR = /^\.[A-Za-z][A-Za-z0-9_-]*$/;

interface FileChrome {
  topAnchored: string[];
  bottomAnchored: string[];
}

/**
 * For one stylesheet: which single-class selectors are, at some narrow (`max-width`) viewport,
 * visible (merged `display` is not `none`) and `position: fixed` or `sticky` with a `top` set —
 * the property Decision 3 reserves for `.phoneBar` alone — and which are visible, fixed, and
 * anchored to `bottom` instead of `top` — the documented edge-to-edge action-row pattern, which
 * is allowed but must be named explicitly. A selector that never appears inside any
 * `@media (max-width: …)` block at all is not phone-scoped and is ignored here, however it is
 * positioned unconditionally (this is what keeps a table's `position: sticky` header — scoped to
 * its own scroll container at every width, not to the phone viewport — out of this guard).
 * Q004 changes the mounted owner to WardBar; the ClinicalRail discussion above is historical.
 * Its dormant stylesheet is excluded only while the no-ClinicalRail-consumer assertion holds.
 */
function findChromeSelectors(css: string): FileChrome {
  const clean = stripComments(css);
  const { topLevelText, narrowBlocks } = splitMediaBlocks(clean);
  const topRules = parseRuleBlocks(topLevelText);

  const narrowDeclsBySelector = new Map<string, string[]>();
  for (const block of narrowBlocks) {
    for (const [selector, decls] of parseRuleBlocks(block)) {
      if (!narrowDeclsBySelector.has(selector)) narrowDeclsBySelector.set(selector, []);
      narrowDeclsBySelector.get(selector)!.push(...decls);
    }
  }

  const topAnchored: string[] = [];
  const bottomAnchored: string[] = [];
  for (const [selector, narrowDecls] of narrowDeclsBySelector) {
    if (!SIMPLE_CLASS_SELECTOR.test(selector)) continue;
    const merged = mergeDecls([...(topRules.get(selector) ?? []), ...narrowDecls]);
    const position = merged.position;
    if (position !== "fixed" && position !== "sticky") continue;
    if ((merged.display ?? "").toLowerCase() === "none") continue;
    const hasTop = merged.top !== undefined && merged.top.toLowerCase() !== "auto";
    const hasBottom = merged.bottom !== undefined && merged.bottom.toLowerCase() !== "auto";
    if (hasTop) topAnchored.push(selector);
    else if (hasBottom) bottomAnchored.push(selector);
  }
  return { topAnchored, bottomAnchored };
}

const cssFiles = stylesheets(WARD_ROOT);
const tsFiles = scripts(WARD_ROOT);

// The retired ClinicalRail stylesheet is still on disk, but no route mounts its phoneBar.
// The assertion below protects that prerequisite rather than counting dormant CSS as chrome.
const legacySidebar = path.join(WARD_ROOT, "ward-sidebar.module.css");
const perFileChrome = cssFiles
  .filter((file) => file !== legacySidebar)
  .map((file) => ({ file, ...findChromeSelectors(readModule(file)) }));
const allTopAnchored = Array.from(new Set(perFileChrome.flatMap((f) => f.topAnchored))).sort();
const allBottomAnchored = Array.from(new Set(perFileChrome.flatMap((f) => f.bottomAnchored))).sort();

/*
 * Dated 2026-09-04, filed as a known-backlog item rather than fixed here.
 *
 * `.modeHeader` (`ward-management-modes.module.css:925`, inside `@media (max-width: 40rem)`) is
 * `position: sticky; top: var(--spacing-ward-phone-bar)` — the exact shape Decision 3 ruled
 * `.workspaceHeader` out of — so it duplicates `.phoneBar`'s ownership on the mode-workspace
 * shells precisely as `.workspaceHeader` used to on the patient workspace. `ward-management-
 * modes.module.css` is not this task's file (it belongs to Task 6 of the same plan) and must not
 * be edited here to satisfy this guard.
 *
 * This list exists so the violation is named rather than hidden: removing it from this array is
 * the only sanctioned way to make the assertion below pass differently, and doing that before
 * `.modeHeader` is actually fixed will fail the "has exactly one" assertion instead — the
 * failure just moves to the honest place.
 */
const KNOWN_BACKLOG_TOP_ANCHORED = [".modeHeader"];

describe("Ward Flow has exactly one top-anchored phone-chrome owner", () => {
  it("mounts the shared WardBar and does not import the retired ClinicalRail, even under an alias", () => {
    const layout = readModule(path.join(REPO_ROOT, "src/app/mockups/ward-flow/layout.tsx"));
    expect(layout).toMatch(/<WardBarMount\b/u);
    const scan = [...tsFiles, ...scripts(path.join(REPO_ROOT, "src/app/mockups/ward-flow"))];
    const legacyConsumers: string[] = [];
    for (const file of scan) {
      const source = ts.createSourceFile(file, readModule(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement)) continue;
        const imports = statement.importClause?.namedBindings;
        if (
          imports &&
          ts.isNamedImports(imports) &&
          imports.elements.some((entry) => (entry.propertyName ?? entry.name).text === "ClinicalRail")
        )
          legacyConsumers.push(file);
      }
      const visit = (node: ts.Node) => {
        if (
          (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          node.tagName.getText(source).split(".").at(-1) === "ClinicalRail"
        )
          legacyConsumers.push(file);
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(legacyConsumers, "ClinicalRail would remount a second phone-bar owner").toEqual([]);
  });
  it("recognises a fixed top owner in an unbounded max-width: 40rem query", () => {
    expect(
      findChromeSelectors("@media (max-width: 40rem) { .phone { position: fixed; top: 0; } }").topAnchored,
    ).toEqual([".phone"]);
  });

  it("ignores a tablet-only min-width: 1001px / max-width: 1399px query", () => {
    expect(
      findChromeSelectors(
        "@media (min-width: 1001px) and (max-width: 1399px) { .tablet { position: sticky; top: 0; } }",
      ).topAnchored,
    ).toEqual([]);
  });

  it("recognises a bounded query when min-width: 30rem intersects the phone range", () => {
    expect(
      findChromeSelectors("@media (min-width: 30rem) and (max-width: 50rem) { .phone { position: sticky; top: 0; } }")
        .topAnchored,
    ).toEqual([".phone"]);
  });

  it("ignores an impossible min-width greater than max-width", () => {
    expect(
      findChromeSelectors(
        "@media (min-width: 50rem) and (max-width: 30rem) { .impossible { position: fixed; top: 0; } }",
      ).topAnchored,
    ).toEqual([]);
  });

  it("found the Ward Flow stylesheets and scripts, or every assertion below is vacuous", () => {
    expect(cssFiles.length).toBeGreaterThan(20);
    expect(cssFiles).toContain(path.join(WARD_ROOT, "ward-sidebar.module.css"));
    expect(cssFiles).toContain(path.join(WARD_ROOT, "ward-management.module.css"));
    expect(cssFiles).toContain(path.join(WARD_ROOT, "ward-management-modes.module.css"));
    expect(tsFiles.length).toBeGreaterThan(20);
  });

  it("has exactly one mounted top-anchored phone element outside the documented backlog — .bar", () => {
    const withoutBacklog = allTopAnchored.filter((selector) => !KNOWN_BACKLOG_TOP_ANCHORED.includes(selector));
    expect(
      withoutBacklog,
      "Ward Flow must have exactly one mounted top-anchored phone element (WardBar's " +
        `.bar) outside the documented backlog — found: ${withoutBacklog.join(", ") || "(none)"}`,
    ).toEqual([".bar"]);
  });

  it("names the one dated known-backlog duplicate, .modeHeader, so fixing it fails this line instead of hiding the fix", () => {
    const backlogFound = allTopAnchored.filter((selector) => KNOWN_BACKLOG_TOP_ANCHORED.includes(selector));
    expect(backlogFound).toEqual(KNOWN_BACKLOG_TOP_ANCHORED);
  });

  it("enumerates the allowed bottom-edge action rows by name — a new one is a decision, not a default", () => {
    // Officer retains its edge action row. Command's reviewed phone form now stays in flow;
    // remaking it a fixed action row must fail both this enumeration and the explicit rule pin.
    // Modal sheets (.colDetail, .detail, .detailPanel, .shortlistColumn, and the header search's
    // full-screen phone sheet .popup, 9 Oct 2026) and .toast notifications are not action rows.
    const actionRows = allBottomAnchored.filter(
      (selector) =>
        ![".colDetail", ".detail", ".detailPanel", ".toast", ".shortlistColumn", ".popup"].includes(selector),
    );
    expect(actionRows).toEqual([".actionRow"]);
    const command = stripComments(readModule(path.join(WARD_ROOT, "coordinator/coordinator.module.css")));
    const phone = splitMediaBlocks(command).narrowBlocks.join("\n");
    expect(phone).toMatch(/\.shortlistActionRow\s*\{\s*position:\s*static;/u);
  });

  // ⚠️ DELIBERATELY LEFT UNSTRIPPED. This is an ABSENCE check: matching raw, comment-included
  // source is the CONSERVATIVE direction here — a comment merely mentioning the name (e.g. "do not
  // adopt PhoneHeaderCollapsePortal here") turns this red too, which is a false alarm a human reads
  // rather than a real adoption slipping through silently. Stripping comments would only make this
  // MORE permissive, the wrong direction for a safety check. Proved 2026-09-04: a comment-only
  // mention of the name in a ward `.tsx` file turned this assertion red.
  it("has no Ward Flow component adopting PhoneHeaderCollapsePortal — on this surface it is a no-op", () => {
    // Global Constraints / Decision 3: no `GlobalSearchShell` mounts on any ward route, so
    // `#phone-header-collapse-addon-slot` is never rendered here and the portal falls back to
    // rendering in place — wrapping anything in it would look like compliance and change
    // nothing. This assertion is the guard against a well-intentioned reviewer "fixing" that in.
    const offenders = tsFiles.filter((file) => readModule(file).includes("PhoneHeaderCollapsePortal"));
    expect(offenders).toEqual([]);
  });
});
