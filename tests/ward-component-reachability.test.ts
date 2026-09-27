import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **79 TEST CASES REPORT GREEN ABOUT WARD SCREENS NO COORDINATOR CAN OPEN.**
 *
 * Measured 2026-09-06 (`docs/ward-flow/unreachable-ward-screens-2026-09-06.md`): eleven ward
 * components sit outside the import graph of all 33 ward routes. Five were replaced by merges whose
 * old routes now redirect, three are orphaned with their parent, one is referenced by nothing at
 * all. **The components are not the finding. The coverage is.** A reader counting green ticks
 * concludes the ED home screen, the morning handover and the escalation board are covered. They are
 * covered; they are simply not reachable.
 *
 * **This is `ward-mode-workspace-reachability` one level down.** That guard watches
 * `WardModeWorkspace` MODES and caught 42 tests standing over dead surfaces. Nothing watched
 * COMPONENTS, and the component-level version is nearly twice the size.
 *
 * ⚠️ **WHY THIS IS A GUARD AND NOT A DOCBLOCK IN EACH TEST FILE.** "This tests an unreachable
 * screen" written in a comment is satisfied by the comment existing. It stays exactly as
 * true-looking on the day the screen comes back, and the person who re-points the route has no
 * reason to open thirteen test files to find out. **The property below fails in BOTH directions**,
 * which a comment cannot do:
 *
 * - a test starts rendering a NEWLY orphaned component → `declares every orphan` goes red;
 * - an orphaned screen becomes REACHABLE again → `holds no stale declaration` goes red, naming the
 *   entry to delete.
 *
 * **The second is the one that matters and the one a comment gets wrong.** Nothing has to remember.
 *
 * ⚠️ **THIS FILE DECLARES; IT DOES NOT RETIRE.** Nothing here deletes a test, skips a case, or
 * touches a screen. The owner has not said whether these screens are finished with or parked, and
 * `docs/agents/dead-code-deletion.md` governs any removal. The declaration is honest under either
 * answer, which is the whole reason it could be written before he answers.
 */

const ROOT = process.cwd();
const WARD_ROUTES = join(ROOT, "src", "app", "mockups", "ward-flow");
const WARD_COMPONENTS = join(ROOT, "src", "components", "ward-management");

function walk(dir: string, keep: (path: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path, keep));
    else if (keep(path)) out.push(path);
  }
  return out;
}

const isSource = (path: string) => /\.tsx?$/u.test(path) && !/\.d\.ts$/u.test(path);

/**
 * ⚠️ **COMMENTS ARE STRIPPED, FOR THE REASON `ward-mode-workspace-reachability` RECORDS AT LENGTH:
 * a file that documents this problem accurately would otherwise be named as causing it.** Several
 * ward files mention `morning-page.tsx` in prose while importing nothing from it. **A mention is not
 * an import**, and a guard that invents violations gets widened until the real ones fall out.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/\/\/[^\n]*/gu, " ");
}

/** `@/x` resolves to `src/x`; `./x` and `../x` resolve against the importing file. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(ROOT, "src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(join(fromFile, ".."), specifier);
  else return null; // a package, not our tree

  const candidates = [`${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const IMPORT_SPECIFIER = /(?:import|export)[^;]*?from\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/gu;

function importsOf(file: string): string[] {
  const source = withoutComments(readFileSync(file, "utf8"));
  const out: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1] ?? match[2];
    if (!specifier) continue;
    const resolved = resolveSpecifier(file, specifier);
    if (resolved) out.push(resolved);
  }
  return out;
}

/**
 * Every module a coordinator's browser can reach, closed transitively from the routes themselves.
 *
 * ⚠️ **THE CLOSURE MUST BE TRANSITIVE, AND A SHALLOWER MEASUREMENT HAS ALREADY BEEN WRONG HERE.**
 * `coordinator/flow-diagram.tsx` has no direct app-route reference and looked orphaned to an earlier
 * pass; it is rendered by `CoordinatorScreen`, which has one. **That reachability verdict went stale
 * within a day** (recorded by Ward Builder Three in
 * `tests/ward-ready-figure-preparation-qualifier.test.ts`). This closure reports it REACHABLE —
 * checked deliberately, as a positive control on the instrument rather than on the tree, because a
 * scan that cannot see that edge would declare live screens dead and its list would look tidy.
 *
 * ⚠️ **TYPE-ONLY IMPORTS ARE FOLLOWED, AND THAT IS THE SAFE DIRECTION.** `import type { X } from
 * "./y"` carries no runtime edge, so following it can only make the reachable set LARGER than the
 * browser's. **The consequence is worth stating because it is what a retirement rests on: this scan
 * can fail to notice an orphan, but it cannot invent one.** Anything it calls unreachable is
 * unreachable under the stricter runtime rule too. `morning-tour.tsx` reaches `morning-page.tsx`
 * by exactly such a type-only import, and both are still outside the closure.
 */
function reachableFromRoutes(): Set<string> {
  const seeds = walk(WARD_ROUTES, (path) => /(?:^|[\\/])(?:page|layout|template|default)\.tsx?$/u.test(path));
  const seen = new Set<string>(seeds);
  const queue = [...seeds];
  while (queue.length > 0) {
    for (const next of importsOf(queue.pop()!)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

const rel = (path: string) => relative(ROOT, path).replaceAll("\\", "/");

/**
 * **The eleven, as measured on 2026-09-06.** Each entry says what happened, because the remedy
 * differs: a replaced screen wants its tests re-pointed at the replacement, a transitively-dead
 * child comes back with its parent, and an unused primitive is a different conversation entirely.
 *
 * ⚠️ **`morning/` LEFT THIS LIST ON 2026-09-17 (item 41, owner-approved), AND ITS EXIT IS A
 * DELETION, NOT A REWORD** — the same convention `statistics-primitives.tsx`'s entry above and the
 * third-edition shell entries below already use. The two entries that named `morning-page.tsx` and
 * `morning-tour.tsx` are gone because the files themselves are gone: `docs/agents/dead-code-deletion.md`
 * governed that removal, not this guard, and a declaration naming a module that no longer exists on
 * disk fails "declares nothing it cannot point at" below rather than staying silently stale.
 */
const DECLARED_UNREACHABLE: readonly { module: string; why: string }[] = [
  {
    module: "src/components/ward-management/escalation/escalation-board.tsx",
    why: "/escalation redirects to /delays",
  },
  {
    module: "src/components/ward-management/tracker/live-tracker.tsx",
    why: "/transport redirects to /movements",
  },
  {
    module: "src/components/ward-management/community/community-home.tsx",
    why: "/community renders CommunityIndex instead",
  },
  {
    module: "src/components/ward-management/community/community-team-hub.tsx",
    why: "/community/[teamId] renders CommunityScreen instead",
  },
  {
    module: "src/components/ward-management/community/community-figures.tsx",
    why: "transitively dead — reached only from community-home",
  },
  {
    module: "src/components/ward-management/community/community-teams-table.tsx",
    why: "transitively dead — reached only from community-home",
  },
  {
    module: "src/components/ward-management/ed/ed-home.tsx",
    why: "/ed/[edId] renders EdScreen instead",
  },
  {
    module: "src/components/ward-management/ed/ed-service-bands.tsx",
    why: "reached only from ed-home",
  },
  /*
   * 🔴 **THE SECOND-EDITION CHROME — RETIRED, 2026-09-11, IN THE SAME CHANGE THAT MOUNTED THE
   * THIRD-EDITION SHELL.** These three entries are the honest record of a retirement, not of a
   * neglect, and the distinction matters because the two look identical from here.
   *
   * `src/app/mockups/ward-flow/layout.tsx` used to mount `WardChromeHeader` (which renders
   * `WardChromeSearch` and `WardStatsToggle`/`WardStatsPanel`) alongside `shell/ward-bar.tsx`. Both
   * render `WardGlobalSearch`, so every one of the thirty-six ward routes carried two search boxes
   * and two task controls — measured by rendering all thirty-six, not inferred. That fold was
   * reverted (`fbfc2bb00f`) and re-landed as a PAIR: the shell mounts and the chrome it replaces
   * stops mounting. Master plan §1.3 item 1.2 asks for exactly that ("in place of
   * `WardChromeHeader` + `WardShellHeader`"), and owner question Q-6 answered Yes.
   *
   * ⚠️ **DECLARED, NOT DELETED — and this file's own header says why it is allowed to do that.**
   * `ward-chrome-header-actions.dom.test.tsx`, `ward-standing-strip.dom.test.tsx` and
   * `ward-facade-agrees-with-screens.test.ts` still render these components and still pass. Nothing
   * of theirs was removed to make the retirement land; `docs/agents/dead-code-deletion.md` governs
   * whether the modules themselves go, and that is a different decision with a different owner.
   *
   * ⚠️ **`ward-facade-agrees-with-screens.test.ts` IS THE ONE TO READ TWICE.** Its `tasks` reader
   * and its tasks-noun assertion both read `WardChromeHeader`'s markup, and that markup is now
   * painted on no screen — so those two cases prove the facade agrees with a surface a coordinator
   * cannot open. They were left pointing there deliberately rather than re-pointed at
   * `shell/ward-bar.tsx`: the bar renders a bare digit in a badge and no noun at all, so
   * `TASKS_NOUN` would have had no renderer to be checked against and the re-point would have
   * quietly become a deletion of the noun contract. This entry is what keeps that visible.
   *
   * ⚠️ **`ward-chrome-search.tsx` IS DECLARED THOUGH NO TEST RENDERS IT DIRECTLY**, so the
   * assertion above would not have named it. It is here as a pin that fails by itself: if anything
   * ever mounts it again, "holds no stale declaration" goes red and names this line, which a
   * comment saying the same thing could never do.
   */
  {
    module: "src/components/ward-management/ward-chrome-header.tsx",
    why: "RETIRED 2026-09-11 — shell/ward-bar.tsx replaced it; layout.tsx mounts the bar instead",
  },
  {
    module: "src/components/ward-management/ward-chrome-search.tsx",
    why: "RETIRED 2026-09-11 — reached only from ward-chrome-header; the bar owns the one search box",
  },
  {
    module: "src/components/ward-management/ward-standing-strip.tsx",
    why: "RETIRED 2026-09-11 — reached only from ward-chrome-header; the bar carries no figures panel",
  },
  {
    module: "src/components/ward-management/movements/traffic-diagram.tsx",
    why: "standalone movements visual component; tested directly in ward-movements-traffic-diagram.dom.test.tsx",
  },
  /*
   * ✅ **`ward-service-scope-bar.tsx` — its entry was deleted when Delays (screens D1) became the
   * first route-rendered screen to mount `WardServiceScopeBar`; Capacity (C1) and Movements (D2)
   * mount it too.**
   */
  /*
   * ✅ **THE THIRD-EDITION SHELL — REMOVED, Task 8, 2026-09-11.** `WardRail`, `WardBar` and
   * `WardLiveRegion` mounted in `src/app/mockups/ward-flow/layout.tsx`, exactly as the paragraph
   * this replaces predicted: "the moment plan §1.3 item 1.2 lands... `layout.tsx` becomes the
   * route-reachable seed... and the 'holds no stale declaration' assertion below will find them
   * reachable on its own and name these exact three lines to delete." It did, and this is that
   * deletion — not a reword, per this file's own established convention (see
   * `statistics-primitives.tsx`'s entry, below, retired the same way).
   */
  /*
   * ✅ **`statistics-primitives.tsx` CAME BACK, AND ITS ENTRY IS DELETED RATHER THAN REWORDED.**
   *
   * It was declared here as *"referenced by nothing in src/ at all"* — true when written, sourced
   * from a census of the ward routes as they then were. A new screen has since imported it, and the
   * chain is a real one, opened end to end rather than inferred from a grep:
   *
   *     src/app/mockups/ward-flow/statistics/service/[serviceId]/page.tsx
   *       -> StatisticsServiceScreen  (statistics-service-screen.tsx:7)
   *         -> StatFootnote           (statistics-primitives.tsx)
   *
   * 🔴 **This file went red for the reason it exists** — its own assertion is *"holds no stale
   * declaration, so a screen coming back reddens its own marking"*, and that is precisely what
   * happened. **A declaration of absence is a measurement with a date on it**, and the danger is not
   * that it ages but that nothing notices: an unreachable-module list is exactly the document
   * somebody later reads as permission to delete. Recorded here rather than silently dropped,
   * because the next person to meet a red in this file should see that a red here has been correct
   * at least once.
   *
   *
   * ⚠️ **The second half of the guard's own message — "check whether those tests should now be
   * counted as real coverage" — is answered here rather than left hanging.** They should, and they
   * now are by construction rather than by anybody deciding: the component is imported by a screen
   * that a route renders, so the reachability walk reaches it from a route on its own. Nothing was
   * added to make that true and nothing has to be maintained to keep it true.
   */
];

describe("every ward component a test renders is one a coordinator can still reach", () => {
  const reachable = reachableFromRoutes();
  /*
   * ⚠️ **COMPONENTS ONLY — `.tsx`. THE FIRST VERSION WALKED EVERY WARD MODULE AND NAMED FIVE
   * FALSE ORPHANS.**
   *
   * `ward-contention.ts`, `tracker-derivations.ts`, `ed-home-derivations.ts`,
   * `ward-referral-visibility.ts` and `statistics-claims-register.ts` are all imported by tests and
   * reached by no route — and flagging them is wrong, because **a logic module tested directly is
   * not a test standing over a screen nobody can open.** That is the ordinary, good shape of a unit
   * test. Some of those five are genuinely dead code, which is a real question with a DIFFERENT
   * remedy (`docs/agents/dead-code-deletion.md`) and a different owner conversation — recorded in
   * `docs/ward-flow/unreachable-ward-screens-2026-09-06.md`, not enforced here.
   *
   * **The harm this guard exists for is a RENDERED SCREEN**: cases that paint a page, assert on its
   * text, and report green while no route reaches it. Narrowing to `.tsx` is what makes the failure
   * message mean one thing.
   */
  const isComponent = (path: string) => /\.tsx$/u.test(path);
  const wardModules = new Set(walk(WARD_COMPONENTS, isComponent).map(rel));
  const reachableWard = new Set([...reachable].map(rel).filter((path) => wardModules.has(path)));

  const testedWard = new Map<string, string[]>();
  for (const file of walk(join(ROOT, "tests"), isSource)) {
    for (const imported of importsOf(file).map(rel)) {
      if (!wardModules.has(imported)) continue;
      testedWard.set(imported, [...(testedWard.get(imported) ?? []), rel(file)]);
    }
  }

  it("finds the routes, the components and the tests, so nothing below can pass by measuring nothing", () => {
    /*
     * ⚠️ **THE FLOOR IS ON THE POPULATION, NEVER ON THE VIOLATIONS.** A floor on the findings goes
     * red the moment somebody does the right thing and fixes them all, which teaches the next person
     * to delete the guard. These three ask only whether the scan still sees what it scans.
     *
     * The middle one is the load-bearing case: an alias change or a moved route directory would make
     * `reachableWard` empty, at which point EVERY ward component reads as unreachable and the
     * declaration list would look like an under-count rather than a broken scan.
     */
    expect(wardModules.size, "no ward components found — WARD_COMPONENTS is wrong").toBeGreaterThan(50);
    expect(
      reachableWard.size,
      "no ward component is reachable from any route, which cannot be true while the app runs — " +
        "the import resolver or the route seed is broken, not the tree",
    ).toBeGreaterThan(20);
    expect(testedWard.size, "no test imports any ward component — the tests walk is wrong").toBeGreaterThan(50);
  });

  it("declares every orphan a test renders, so a newly dead screen cannot go unnoticed", () => {
    const declared = new Set(DECLARED_UNREACHABLE.map((entry) => entry.module));
    const undeclared = [...testedWard.entries()]
      .filter(([module]) => !reachableWard.has(module) && !declared.has(module))
      .map(([module, files]) => `${module} <- ${files.join(", ")}`);

    expect(
      undeclared,
      "these ward components are rendered by tests but reached by no route. That is not necessarily " +
        "wrong — a screen may have been replaced deliberately — but it must be SAID, because the " +
        "cases below it report green about a screen nobody can open. Add an entry to " +
        "DECLARED_UNREACHABLE with what happened, or re-point the tests at the replacement.",
    ).toEqual([]);
  });

  it("holds no stale declaration, so a screen coming back reddens its own marking", () => {
    /*
     * 🔴 **THIS IS THE ASSERTION A COMMENT CANNOT MAKE.** "This tests an unreachable screen" in a
     * docblock reads exactly as true on the day the screen becomes reachable again, and the person
     * re-pointing the route has no reason to open thirteen test files. Here the declaration itself
     * fails, names the line, and says to delete it.
     */
    const revived = DECLARED_UNREACHABLE.filter((entry) => reachableWard.has(entry.module)).map(
      (entry) => `${entry.module} (declared unreachable because: ${entry.why})`,
    );

    expect(
      revived,
      "these components ARE reachable from a route now, so declaring them unreachable is a false " +
        "statement about the tests that render them. Delete their DECLARED_UNREACHABLE entries — " +
        "and check whether those tests should now be counted as real coverage.",
    ).toEqual([]);
  });

  it("declares nothing it cannot point at, so a rename cannot leave a phantom entry standing", () => {
    // A declaration naming a module that no longer exists is not harmless: it reads as a live
    // marking while guarding nothing, and it makes the list look longer than the problem is.
    const missing = DECLARED_UNREACHABLE.filter((entry) => !wardModules.has(entry.module)).map((entry) => entry.module);
    expect(missing, "declared modules that do not exist — renamed, moved or already deleted").toEqual([]);
  });
});
