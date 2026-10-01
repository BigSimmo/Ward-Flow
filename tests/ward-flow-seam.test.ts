import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Ward Flow's seam with the rest of this repository.
 *
 * WHY THIS EXISTS. Ward Flow is a synthetic, offline prototype living inside a clinical knowledge
 * base that has nothing to do with bed flow. It stays here on purpose, because it gets the Next 16
 * setup, the design tokens, the test harness and the accumulated rules for free. The day it stops
 * being a prototype — a real address, real data, its own release cadence — it has to leave, and the
 * only thing deciding whether leaving costs an afternoon or a fortnight is how many places it
 * touches the host.
 *
 * Measured 2026-08-29 across `main`, `claude/ward-flow-ward-board` and
 * `claude/ward-flow-phases-6-7-design`, and identical on all three: SEVEN shared modules reached
 * outward across twelve import statements, ZERO imports reaching in, and FOUR hardcoded references
 * to the ward route outside Ward Flow's own folders. That is the entire bill for extraction.
 *
 * Nothing here protects correctness. It protects the exit door. A dependency added for convenience
 * is invisible at the time and expensive later — exactly the kind of cost nobody notices accruing —
 * so this test makes widening the seam a decision someone has to make out loud.
 *
 * THE TEST IS THE RULE. There is deliberately no prose copy in AGENTS.md or CLAUDE.md: a second
 * statement of the same fact drifts from the enforced one, and this project has already spent a day
 * discovering what happens when prose and code disagree about a number. The reasoning lives in this
 * header, where it travels with the assertions it explains.
 *
 * HOW TO READ A FAILURE. The three invariants below are exact and must never move. The
 * shared-module list is a CEILING, not a measurement: if it fires, the fix is a stated reason for
 * the new dependency, not a re-measurement. A ratchet that gets re-baselined whenever it fires is
 * not a ratchet — this repository has already produced several checks that could not fail, and
 * "somebody updated the expected number" is how the next one would arrive.
 */

const WARD_DIRS = ["src/components/ward-management", "src/app/mockups/ward-flow"];

/**
 * The shared modules Ward Flow may reach outward for, each with the reason it is not worth
 * duplicating. This is a ceiling. Any new entry is not a measurement error to be corrected; it is
 * a decision, and it needs its reason written beside it here before this list grows.
 */
const APPROVED_SHARED_MODULES = new Map([
  ["@/components/ui-primitives", "the repository's buttons and form controls"],
  [
    "@/components/clinical-dashboard/brand",
    "the product wordmark, so the prototype is not misread as a separate product",
  ],
  ["@/components/ui/sheet", "the slide-over panel primitive"],
  [
    "@/components/ui/sheet-focus",
    "Ward Lead UI decision, 2026-09-23: receipt/upload dialogs share the already-approved Sheet " +
      "singleton for topmost Escape, inert background and safe focus return; a separate stack " +
      "would conflict with nested Sheets. This exact lifecycle dependency travels with Sheet " +
      "when extracted; it does not approve the rest of components/ui.",
  ],
  [
    "@/components/ui/tooltip",
    "the existing portal, viewport positioning and focus/Escape lifecycle for the drawn closed-rail card; avoids clipping inside the required scrolling rail without duplicating overlay infrastructure (visual wave Task 1)",
  ],
  [
    "@/components/developer-area/ward-flow-access-gate",
    "the passwordless gate that keeps Ward Flow private without Clinical KB database access",
  ],
  ["@/components/contextual-back-link", "shared back navigation"],
  ["@/lib/form-register", "shared form registration"],
  ["@/lib/client-store-factory", "shared client-side store helper"],
  [
    "@/components/ui/missing-value",
    "the shared empty-value renderer, which distinguishes a field that CANNOT apply from one nobody filled in -- arrived with main and is a clinical-meaning distinction, not a convenience",
  ],
]);

/**
 * Files outside Ward Flow that hardcode its route. Not imports, so there is no code coupling — but
 * every one needs editing on the day Ward Flow leaves, so a guard counting only imports would
 * report a seam of seven when it is seven plus these. Named individually rather than counted,
 * because a count of four tells the next reader nothing about which four are legitimate.
 */
const APPROVED_ROUTE_REFERENCES = new Map([
  ["src/lib/developer-area/headers.ts", "route list for the developer-area header"],
  ["src/proxy.ts", "the constellation-to-network redirect kept for historical deep links"],
  [
    "src/lib/developer-area/link-access-shared.ts",
    "where the access gate sends a visitor who asked for no page: Ward Flow, since the developer hub it used to name was retired",
  ],
  /*
   * ⚠️ THESE TWO ARE NOT OUTSIDE WARD FLOW — THEY ARE WARD FLOW, SITED ELSEWHERE ON PURPOSE, and
   * they are here because the literal this guard matches (`mockups/ward-flow`) is a PREFIX of
   * their own route (`/mockups/ward-flow-sign-in`). They reference nothing; they are named by it.
   *
   * Why the sign-in screen is a sibling rather than a child: `src/app/mockups/ward-flow/layout.tsx`
   * mounts the rail, the bar and the provider around every nested route with no per-route opt-out,
   * and a sign-in screen is specified to carry none of them. It imports no ward-management code at
   * all, which is what keeps this guard's real subject — code coupling — untouched.
   *
   * 🔴 On the day Ward Flow leaves, these two move WITH it rather than needing an edit, which is
   * the opposite of every other entry above. Kept in the list anyway, because the alternative is
   * teaching the guard a second concept of "inside" and this list is read by people.
   */
  [
    "src/app/mockups/ward-flow-sign-in/page.tsx",
    "Ward Flow's own sign-in route — a sibling of the subtree, not a reference to it",
  ],
  [
    "src/components/ward-flow-sign-in/ward-flow-sign-in-screen.tsx",
    "Ward Flow's own sign-in screen — names its sibling route; imports no ward-management code",
  ],
  [
    "src/app/mockups/ward-flow-digest/route.ts",
    "Ward Flow's own digest GET route — a sibling document that deliberately does not inherit the interactive shell",
  ],
  [
    "src/app/page.tsx",
    'the front page: Ward Flow is the only app left, so "/" redirects to its Coordinator view (Josh, 26 September 2026)',
  ],
]);

const WARD_ROUTE_LITERAL = "mockups/ward-flow";

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...walk(full));
    } else {
      found.push(full);
    }
  }
  return found;
}

function toPosix(path: string): string {
  return path.split("\\").join("/");
}

function sourceFiles(dir: string): string[] {
  return walk(dir)
    .map(toPosix)
    .filter((file) => /\.tsx?$/.test(file));
}

function isWardPath(path: string): boolean {
  return WARD_DIRS.some((dir) => path === dir || path.startsWith(dir + "/"));
}

/**
 * Every static module specifier in a file: `import ... from`, bare `import "..."`, and
 * `export ... from`. Parsed with the TypeScript compiler rather than matched with a regex, so a
 * path named in a comment or a string is not mistaken for a dependency — several files here discuss
 * the ward route in prose, and one of them is on the approved list for an unrelated reason.
 */
function moduleSpecifiers(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

/** Resolve a specifier to a repo-relative path, or null when it is a bare package (react, next). */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return "src/" + specifier.slice(2);
  if (specifier.startsWith(".")) {
    return toPosix(relative(resolve("."), resolve(posix.dirname(fromFile), specifier)));
  }
  return null;
}

describe("ward flow keeps its seam with the rest of the repository", () => {
  const wardFiles = WARD_DIRS.flatMap(sourceFiles);
  const allSourceFiles = sourceFiles("src");

  it("reaches outward for no shared module beyond the approved list", () => {
    const reached = new Map<string, string[]>();
    for (const file of wardFiles) {
      for (const specifier of moduleSpecifiers(file)) {
        if (!specifier.startsWith("@/")) continue;
        const target = resolveSpecifier(file, specifier);
        if (target && isWardPath(target)) continue;
        if (APPROVED_SHARED_MODULES.has(specifier)) continue;
        reached.set(specifier, [...(reached.get(specifier) ?? []), file]);
      }
    }

    expect(
      [...reached].map(([specifier, files]) => specifier + " <- " + files.join(", ")),
      "Ward Flow reached outward for a shared module that is not on the approved list. This is a " +
        "ceiling, not a measurement: do not add the module to APPROVED_SHARED_MODULES merely to " +
        "make this pass. Every entry is a line item in the cost of ever extracting Ward Flow, so " +
        "add it only with a stated reason beside it — or import nothing and leave the seam alone.",
    ).toEqual([]);
  });

  it("has nothing outside it importing ward code", () => {
    const inbound: string[] = [];
    for (const file of allSourceFiles) {
      if (isWardPath(file)) continue;
      for (const specifier of moduleSpecifiers(file)) {
        const target = resolveSpecifier(file, specifier);
        if (target && isWardPath(target)) inbound.push(file + " -> " + specifier);
      }
    }

    expect(
      inbound,
      "Something outside Ward Flow imported ward code. Invariant, not a budget: the prototype is a " +
        "leaf, and the moment the host app depends on it, extracting it stops being a folder move " +
        "and becomes a refactor of the host.",
    ).toEqual([]);
  });

  it("never reaches outward by relative path", () => {
    const escapes: string[] = [];
    for (const file of wardFiles) {
      for (const specifier of moduleSpecifiers(file)) {
        if (!specifier.startsWith(".")) continue;
        const target = resolveSpecifier(file, specifier);
        if (target && !isWardPath(target)) escapes.push(file + " -> " + specifier);
      }
    }

    expect(
      escapes,
      "Ward Flow reached outside its own folders with a relative import. Invariant: a relative " +
        "escape is a dependency the approved-module ceiling above cannot see, so it would widen the " +
        "seam without ever failing that check.",
    ).toEqual([]);
  });

  it("has its route hardcoded outside itself only in the explicitly approved places", () => {
    const unexpected = allSourceFiles
      .filter((file) => !isWardPath(file))
      .filter((file) => !APPROVED_ROUTE_REFERENCES.has(file))
      .filter((file) => readFileSync(file, "utf8").includes(WARD_ROUTE_LITERAL));

    expect(
      unexpected,
      "A file outside Ward Flow hardcoded its route. These are not imports, so nothing else catches " +
        "them, and each is a file needing an edit on the day Ward Flow leaves. Name it in " +
        "APPROVED_ROUTE_REFERENCES with its reason, or route around it.",
    ).toEqual([]);
  });

  it("still knows what the seam costs", () => {
    // A canary for the lists above being quietly emptied, and for the scan losing its place. A test
    // asserting only "no violations" passes exactly as cleanly when its allowlists have been
    // deleted, or when it scanned nothing at all, as when the code is right. An absent signal reads
    // exactly like a passing one.
    // 7 -> 8 on 2026-09-03, when main's `MissingValue` arrived with the discharge board and the
    // console. Raised deliberately rather than adjusted: this pin exists so that widening the
    // seam is a decision somebody makes, not a diff nobody reads.
    // 8 -> 9 on 2026-09-13: Task 1 deliberately reuses Tooltip's portal and focus lifecycle for
    // the drawing's closed-rail card; the specific extraction cost is documented beside its entry.
    // 9 → 10 on 2026-09-23: the same Sheet stack must coordinate custom Ward dialogs.
    expect(APPROVED_SHARED_MODULES.size).toBe(10);
    // ⚠️ AND THE MEMBERSHIP, NOT ONLY THE COUNT. A size pin cannot tell a widening from a SWAP:
    // remove one approved module, add another, and the count stays unchanged while Ward Flow's seam
    // has changed — which is the thing this list exists to control. The argument is already made
    // twelve lines above about APPROVED_ROUTE_REFERENCES: "named individually rather than counted,
    // because a count of four tells the next reader nothing about which four are legitimate." It
    // applies here word for word. Hand-written rather than derived from the map, because a list
    // computed from the thing it checks is a tautology that passes whatever the map says.
    expect([...APPROVED_SHARED_MODULES.keys()].sort()).toEqual([
      "@/components/clinical-dashboard/brand",
      "@/components/contextual-back-link",
      "@/components/developer-area/ward-flow-access-gate",
      "@/components/ui-primitives",
      "@/components/ui/missing-value",
      "@/components/ui/sheet",
      "@/components/ui/sheet-focus",
      "@/components/ui/tooltip",
      "@/lib/client-store-factory",
      "@/lib/form-register",
    ]);
    // 4 -> 6 on 2026-09-12, when the sign-in screen arrived as a SIBLING route
    // (`/mockups/ward-flow-sign-in`) whose path contains this guard's literal as a prefix. Raised
    // deliberately, like the module pin above: the two new entries are Ward Flow's own files, and
    // the reasons beside them say so rather than letting a bare count imply four more couplings.
    // 6 -> 7 on 2026-09-13: the digest is another intentional Ward-owned sibling. It serves the
    // authoritative static document without mounting the interactive subtree's provider or chrome.
    // 7 -> 6 on 2026-09-25: the developer hub's panel list was retired with the hub itself (the
    // PsychSift removal, batch 3a), so the one entry that pointed there went with the file.
    // 6 -> 7 the same day: with the hub gone, the access gate's default destination became Ward Flow.
    // 7 -> 6 in the final PsychSift removal: the mockups layout no longer has a client wrapper that
    // skipped Ward Flow's routes by name, because there is no PsychSift shell left to skip.
    // 6 -> 7 on 2026-09-26: the front page "/" had no page after the PsychSift removal and showed
    // "not found"; Josh ruled it opens the Coordinator view, so src/app/page.tsx names the route.
    expect(APPROVED_ROUTE_REFERENCES.size).toBe(7);
    expect(wardFiles.length).toBeGreaterThan(50);
    expect(allSourceFiles.length).toBeGreaterThan(wardFiles.length);
  });
});
