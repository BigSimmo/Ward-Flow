import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **A WHOLE WARD JOURNEY WALKED INTO A REDIRECT AND NOTHING NOTICED FOR THREE DAYS.**
 *
 * MERGE 03 (owner-approved 2026-09-05) folded the live transport tracker into `MovementsScreen`, and
 * `src/app/mockups/ward-flow/transport/page.tsx` became a bookmark backstop that calls
 * `redirect("/mockups/ward-flow/movements")`. `tests/ui-ward-roles.spec.ts` went on navigating to
 * `/mockups/ward-flow/transport` and then waiting for `ward-live-tracker` — a test id the redirect
 * TARGET never renders, because the only file that declares it (`tracker/live-tracker.tsx`) is
 * imported by nothing and is itself a deletion candidate.
 *
 * ⚠️ **THERE WAS ALREADY A GUARD FOR THIS EXACT SHAPE AND IT COULD NOT SEE IT.**
 * `ward-links-never-point-at-redirect-stubs.test.ts` derives its stubs from the route files — the
 * right property, done well — but walks `src/app/mockups/ward-flow` and
 * `src/components/ward-management` for the LINKS. It does not walk `tests/`. So an in-app link into
 * a stub is caught, and a spec's own `page.goto` into one is invisible. **The population a guard
 * walks is the thing to check, not its assertion.** This file is that guard's missing half, and
 * deliberately reuses its derived-from-disk approach rather than a hand-maintained list.
 *
 * ---
 *
 * ## The property, and why it is not simply "never navigate to a stub"
 *
 * A stub navigation is not by itself a defect. `ui-ward-management.spec.ts:375` navigates to
 * `/mockups/ward-flow/queue` ON PURPOSE and says so in its own comment: it asserts only on the
 * shared `ClinicalRail` chrome, which `DelaysScreen` — the redirect target — mounts just as well.
 * That test is correct and must stay green. A guard that reddened it would be reddening correct
 * work, and guards that do that get widened until they mean nothing.
 *
 * So the property is about the HANDLES, not the navigation:
 *
 * > After navigating to a redirect stub, a spec may not wait for a test id that the redirect
 * > TARGET cannot render.
 *
 * Both sides come off disk — the stubs from the route files, the renderable ids from the target's
 * own transitive import closure — so a stub promoted back to a real screen stops being covered on
 * the same day, and a newly folded screen is covered on the day it folds.
 *
 * ## Skipped is reported, not excused
 *
 * On this line all three offending navigations sit inside `test.describe.skip(...)`, retired
 * 2026-09-06, so none can fail today. **They are reported anyway, and the message says which kind
 * each one is.** A skip decides whether a test RUNS; it does not repair the navigation, and
 * un-skipping one revives a broken journey with no warning — the broken-and-never-worked-identical
 * shape. `origin/main` reached the same conclusion by a different route and re-pointed its three
 * transport cases at Movements on 2026-09-06.
 *
 * 🔴 **AND THIS GUARD THEREFORE TAKES A SIDE IN AN OPEN OWNER DECISION. SAYING SO IS THE POINT.**
 *
 * Settled between three chats on 2026-09-08: the ward master line RETIRED the transport cases by
 * skipping them; `origin/main` RE-POINTED them at Movements. Both are defensible, so which one
 * survives the merge is **Josh's ruling**, not a mechanical pick — the reason first given for taking
 * main's side ("those assertions cannot pass") was withdrawn by its own author once the enclosing
 * `describe.skip` was actually opened.
 *
 * The two outcomes are not symmetric for this file:
 *
 *     main's re-point wins   → the navigation is gone, and this guard goes green on its own.
 *     the retirement stands  → the navigation is still written down, and this guard stays RED
 *                              FOREVER on something the owner deliberately chose.
 *
 * ⚠️ **The second case is a guard reddening on correct work, which is how guards get switched off —
 * so it must be answered with a `PARKED` entry for those two findings, the same mechanism this file
 * used to carry for the morning case (see below), and never by widening the rule or deleting the
 * file.** The rule this guard asserts — that a skip is a decision about whether a test RUNS and not
 * a repair of the navigation — is a real position and it may lose. Losing it is not evidence the
 * guard was wrong to hold it.
 *
 * ⚠️ **THE EXCEPTION IS NARROW AND IT IS NOT "SKIPPED", AND IT IS EMPTY TODAY.** `ui-ward-morning.
 * spec.ts` carried the one `PARKED` entry this file has ever held, keyed on the whole finding, with
 * the condition that retired it: the owner's ruling on the morning/handover cross-link question
 * (outstanding issue #ZWJ71W). **That ruling landed on 17 Sept 2026 as a repoint, not a restore** —
 * Morning's surviving coverage moved to `tests/ui-ward-capacity-morning-moved.spec.ts`, which no
 * longer navigates to the `/morning` stub at all, so the entry's own stated condition ("delete this
 * entry with the repoint") applied and it was deleted in the same change, along with the two tests
 * that existed only to prove that one entry — see git history for their exact wording if this shape
 * is needed again. `PARKED` stays declared, empty, ready for whatever narrow case needs it next.
 * **Never exempt a whole spec, and never exempt "skipped blocks" as a class** — that would make this
 * guard blind to every future defect anybody switches off, which is the one thing it exists to see.
 */

const ROOT = process.cwd();
const WARD_ROUTES = join(ROOT, "src", "app", "mockups", "ward-flow");
const TESTS_ROOT = join(ROOT, "tests");
const WARD_ROUTE_PREFIX = "/mockups/ward-flow";

const rel = (path: string) => relative(ROOT, path).replaceAll("\\", "/");

/**
 * ⚠️ **COMMENTS ARE STRIPPED BEFORE ANY DECISION, AND THE LINE-COMMENT ARM NEEDS THE LOOKBEHIND.**
 * `https://` contains `//`, so an unguarded line-comment pattern truncates any line carrying a URL —
 * in a file whose entire subject is navigation, that would delete the evidence before the guard read
 * it. This is the same repair `ward-links-never-point-at-redirect-stubs.test.ts` carries, and its
 * own residue applies here unchanged: a PROTOCOL-RELATIVE `"//host/path"` has no `:` before it and
 * would still be eaten. None exists in the ward specs today.
 *
 * The other direction matters just as much and is tested below: a route file may explain in prose
 * why it does NOT redirect, and a spec may carry a commented-out `page.goto`. Neither is real.
 */
const stripComments = (source: string) =>
  source
    // 🔴 **A BLOCK COMMENT IS REPLACED BY ITS OWN NEWLINES, NOT BY A SPACE, AND THE FIRST VERSION
    // OF THIS FILE GOT IT WRONG.** Collapsing a comment to one space renumbers every line after it,
    // and `spec:line` locations are this file's entire output. It reported the two transport
    // navigations at lines 185 and 201; they are at 246 and 272. **A finding that points at the
    // wrong line sends its reader to innocent code, which is worse than no finding at all** — they
    // look, see nothing wrong, and learn to discount the guard.
    .replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, ""))
    .replace(/(?<!:)\/\/[^\n]*/gu, "");

/* ------------------------------------------------------------------ *
 * 1. Which ward routes are redirect stubs — derived, never listed.
 * ------------------------------------------------------------------ */

/** Maps a stub route to the route it redirects at. Dynamic segments cannot be literal goto targets. */
function redirectStubs(): Map<string, string> {
  const stubs = new Map<string, string>();
  const visit = (dir: string, route: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith("[")) continue;
        visit(path, `${route}/${entry.name}`);
      } else if (entry.name === "page.tsx") {
        const source = stripComments(readFileSync(path, "utf8"));
        const target = /\bredirect\(\s*["'`]([^"'`]+)["'`]\s*\)/u.exec(source);
        if (target) stubs.set(route, target[1]);
      }
    }
  };
  visit(WARD_ROUTES, WARD_ROUTE_PREFIX);
  return stubs;
}

/* ------------------------------------------------------------------ *
 * 2. What a given route can actually render.
 * ------------------------------------------------------------------ */

/** `@/x` -> `src/x`; `./x` and `../x` against the importing file. Packages are outside the tree. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(ROOT, "src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(join(fromFile, ".."), specifier);
  else return null;

  for (const candidate of [`${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const IMPORT_SPECIFIER = /(?:import|export)[^;]*?from\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/gu;

function importsOf(file: string): string[] {
  const source = stripComments(readFileSync(file, "utf8"));
  const out: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1] ?? match[2];
    const resolved = specifier ? resolveSpecifier(file, specifier) : null;
    if (resolved) out.push(resolved);
  }
  return out;
}

/**
 * Every test id a browser landing on `route` could paint.
 *
 * ⚠️ **THE LAYOUTS ON THE PATH ARE SEEDED ALONGSIDE THE PAGE, AND OMITTING THEM WOULD INVENT
 * VIOLATIONS.** Ward chrome — the rail, the phone header, the brand link — is rendered by
 * `mockups/ward-flow/layout.tsx`, not by any screen. A closure seeded from `page.tsx` alone would
 * declare every chrome handle unrenderable on every route, which is exactly the
 * reddens-on-everything failure this guard must not have.
 *
 * ⚠️ **TYPE-ONLY IMPORTS ARE FOLLOWED, AND THAT IS THE SAFE DIRECTION** — the same reasoning
 * `ward-component-reachability.test.ts` records. Following them can only make the reachable set
 * LARGER than the browser's, so this closure can fail to notice a defect but cannot invent one.
 * Every verdict it reports is true under the stricter runtime rule too.
 */
/** Every ward source file — the routes and the components they render. */
function wardSourceFiles(): string[] {
  const found: string[] = [];
  const visit = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.tsx?$/u.test(entry.name) && !/\.d\.ts$/u.test(entry.name)) found.push(path);
    }
  };
  visit(WARD_ROUTES);
  visit(join(ROOT, "src", "components", "ward-management"));
  return found;
}

function routeClosure(route: string): Set<string> {
  const segments = route.replace(`${WARD_ROUTE_PREFIX}`, "").split("/").filter(Boolean);
  const seeds: string[] = [];
  let dir = WARD_ROUTES;
  const consider = (file: string) => {
    if (existsSync(file)) seeds.push(file);
  };
  consider(join(dir, "layout.tsx"));
  for (const segment of segments) {
    dir = join(dir, segment);
    if (!existsSync(dir)) break;
    consider(join(dir, "layout.tsx"));
  }
  consider(join(dir, "page.tsx"));

  const seen = new Set(seeds);
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

/** Every test id a browser landing on `route` could paint. */
function renderableTestIds(route: string): Set<string> {
  const ids = new Set<string>();
  for (const file of routeClosure(route)) {
    const source = stripComments(readFileSync(file, "utf8"));
    // Literal attributes, and the `data-testid={\`ward-tracker-row-${id}\`}` template form, whose
    // static prefix is what a spec's `[data-testid^="..."]` selector matches on.
    for (const match of source.matchAll(/data-testid=(?:["'`]([^"'`{}]+)["'`]|\{\s*`([^`$]*))/gu)) {
      const id = (match[1] ?? match[2]).trim();
      if (id) ids.add(id);
    }
    /*
     * 🔴 **IDS ARRIVING AS A PROP ARE NOT WRITTEN AS `data-testid=` ANYWHERE, AND MISSING THEM
     * INVENTS VIOLATIONS.** Eleven ward components render `data-testid={testId}` from a prop —
     * `WardPanel`, `WardTable`, `WardDailySheet`, `CapacityScreen`'s group bodies and more — so the
     * id itself is written at the CALL SITE, 70 times, as `testId="ward-…"`. Scanning only the
     * attribute would leave every one of those out of the renderable set and report any spec waiting
     * for one as a defect.
     *
     * ⚠️ **This is the direction that matters, and it is the opposite of the type-only-import
     * decision above.** An id this misses is a FALSE POSITIVE — a guard accusing correct code —
     * whereas a reachable file it wrongly includes only costs a missed defect. False positives are
     * what get a guard switched off, so this arm is deliberately generous.
     */
    for (const match of source.matchAll(/\btestId=\{?["'`]([^"'`{}]+)["'`]/gu)) {
      const id = match[1].trim();
      if (id) ids.add(id);
    }
  }
  return ids;
}

/**
 * Every ACCESSIBLE NAME a browser landing on `route` could expose to `getByRole(…, { name })`.
 *
 * 🔴 **THIS ARM EXISTS BECAUSE THE GUARD WOULD NOT HAVE CAUGHT THE VERY REPAIR IT WAS WRITTEN
 * ABOUT.** `origin/main` re-pointed its Movements tests deliberately by the panel's accessible name
 * rather than by a new test id — *"`WardPanel` already names every panel via `aria-label`, so this
 * needs no hook added to a screen for a test's benefit"*, which is the right instinct. A guard that
 * only reads `getByTestId` is blind to the whole idiom, so it could not have told those re-pointed
 * tests from broken ones. Named as a limit in the original report; closed here.
 *
 * The names come from the same place the ids did — the call site. `WardPanel` renders
 * `aria-label={title}` and `<Heading>{title}</Heading>` from one `title` prop, so a literal
 * `title="Who is being carried"` is simultaneously the region's name and its heading's name.
 * `aria-label="…"` written directly is collected too.
 *
 * ⚠️ **Deliberately generous, for the reason the `testId` arm is:** a name this misses becomes a
 * FALSE POSITIVE against correct code, while a name it over-collects only costs a missed defect.
 */
function renderableNames(route: string): Set<string> {
  const names = new Set<string>();
  for (const file of routeClosure(route)) {
    const source = stripComments(readFileSync(file, "utf8"));
    for (const match of source.matchAll(/\b(?:title|aria-label|label)=\{?["'`]([^"'`{}]+)["'`]/gu)) {
      const name = match[1].trim();
      if (name) names.add(name);
    }
  }
  return names;
}

/* ------------------------------------------------------------------ *
 * 3. What a spec waits for after a navigation.
 * ------------------------------------------------------------------ */

/**
 * The source from `offset` to the end of the block that ENCLOSES it — the rest of the `test(...)`
 * callback or helper function the navigation sits in.
 *
 * ⚠️ **SCOPING IS THE WHOLE DIFFICULTY, AND BOTH LAZY OPTIONS ARE WRONG IN A REPORTABLE WAY.**
 * Scanning to the next `page.goto` runs a helper's segment on into unrelated callers; scanning a
 * fixed number of lines is arbitrary. Walking to the enclosing block's closing brace is the thing
 * that is actually meant: everything a spec waits for inside the function that navigated, it waited
 * for on the page it navigated to.
 *
 * Braces inside strings and template literals are skipped — `getByRole("region", { name: "x}" })`
 * is not common but a scanner that miscounts one brace silently truncates a segment and reports a
 * clean estate, which is the direction that hides defects.
 */
function enclosingBlockAfter(source: string, offset: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = offset; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      if (depth === 0) return source.slice(offset, i);
      depth -= 1;
    }
  }
  return source.slice(offset);
}

const WARD_SPECS = () =>
  readdirSync(TESTS_ROOT)
    .filter((name) => /^ui-ward-.*\.spec\.ts$/u.test(name))
    .sort()
    .map((name) => join(TESTS_ROOT, name));

/**
 * Link TEXT to the route it goes to, resolved off disk.
 *
 * 🔴 **A CLICK IS A NAVIGATION AND THE FIRST VERSION OF THIS GUARD COULD NOT SEE ONE.** Several ward
 * journeys navigate by clicking a real `<Link>` rather than by `page.goto`, **on purpose** — a full
 * load remounts `WardFlowProvider` and reseeds shared state, which would make a client-side routing
 * failure indistinguishable from a pass. Those specs say so in their own comments. So the idiom that
 * exists precisely to catch routing failures was the one the guard was blind to.
 *
 * ⚠️ **THE FIRST ATTEMPT AT THIS MIS-PAIRED A LABEL WITH A NEIGHBOUR'S HREF AND WOULD HAVE INVENTED
 * A FINDING.** Matching `href:` and `label:` within a fixed character window resolved
 * `"New referral"` to `/out-of-area`; it is `/referrals/new`. The entry writes
 * `href: WARD_REFERRAL_INTAKE_HREF` — a CONSTANT, not a literal — so the window skipped past it and
 * paired the label with the next literal href it found. **A windowed match across a list of similar
 * objects silently pairs the wrong two fields**, and every route in that list looks plausible, so
 * nothing about the output would have looked wrong. Fixed by walking BALANCED object literals and
 * resolving href constants, exactly as the sibling link guard resolves `href={CONST}`.
 */
function linkDestinations(): Map<string, string> {
  const sources = [...wardSourceFiles()];
  const constants = new Map<string, string>();
  for (const file of sources) {
    for (const match of stripComments(readFileSync(file, "utf8")).matchAll(
      /(?:export\s+)?const\s+([A-Z0-9_]+)(?::[^=]+)?\s*=\s*["'`](\/mockups\/ward-flow[^"'`]*)["'`]/gu,
    )) {
      constants.set(match[1], match[2]);
    }
  }

  const byLabel = new Map<string, string>();
  for (const file of sources) {
    const source = stripComments(readFileSync(file, "utf8"));
    for (let i = 0; i < source.length; i += 1) {
      if (source[i] !== "{") continue;
      let depth = 0;
      let end = i;
      for (; end < source.length; end += 1) {
        if (source[end] === "{") depth += 1;
        else if (source[end] === "}") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      const object = source.slice(i, end + 1);
      i = end;
      // One flat literal only: a nested brace means this is not a single nav entry.
      if (object.length > 600 || object.indexOf("{", 1) !== -1) continue;
      const label = /\blabel:\s*["'`]([^"'`]+)["'`]/u.exec(object);
      if (!label) continue;
      const literal = /\bhref:\s*["'`](\/mockups\/ward-flow[^"'`]*)["'`]/u.exec(object);
      const reference = /\bhref:\s*([A-Z0-9_]+)\s*[,}]/u.exec(object);
      const href = literal?.[1] ?? (reference ? constants.get(reference[1]) : undefined);
      if (href) byLabel.set(label[1], href);
    }
  }
  return byLabel;
}

const NAVIGATION = /page\.goto\(\s*["'`](\/mockups\/ward-flow[^"'`$]*)["'`]/gu;
/** `await page.getByRole("link", { name: "Delays", exact: true }).click()` — a navigation too. */
const LINK_CLICK = /getByRole\(\s*["'`]link["'`]\s*,\s*\{[^}]*?name:\s*["'`]([^"'`]+)["'`][^}]*\}\s*\)/gu;
/** `getByTestId("x")`, `[data-testid="x"]`, and the `^=` prefix form specs use for row families. */
const AWAITED_TEST_ID = /getByTestId\(\s*["'`]([^"'`]+)["'`]|data-testid\s*[\^*$]?=\s*\\?["']([^"'\\]+)/gu;

/**
 * `getByRole("region", { name: "Who is being carried" })` and its heading/banner siblings.
 * A REGEX or a variable name is deliberately not matched — see the call site.
 */
const AWAITED_ROLE_NAME = /getByRole\(\s*["'`][a-z]+["'`]\s*,\s*\{[^}]*?name:\s*["'`]([^"'`]+)["'`]/gu;

type Finding = {
  readonly spec: string;
  readonly line: number;
  readonly via: "goto" | "click";
  readonly stub: string;
  readonly target: string;
  readonly missing: readonly string[];
  readonly dormant: boolean;
};

/**
 * Dormancy is judged LEXICALLY — whether a `test.describe.skip` / `test.skip` opens above this
 * navigation in the same file. It is advisory only: every finding fails this guard either way, so
 * the label can never drop one from the list.
 *
 * ⚠️ **AND IT IS WRONG IN ONE MEASURED CASE, NAMED HERE RATHER THAN LEFT TO BE DISCOVERED.**
 * `ui-ward-morning.spec.ts` navigates inside the helper `gotoMorning`, which is DEFINED above the
 * two skipped describes and CALLED only from inside them. Lexical position says active; the call
 * graph says dormant, and the call graph is right. It is reported ACTIVE.
 *
 * That is the safe direction, and the reason this is not worth a call-graph walk: the error
 * OVER-states urgency — "this fails today" about something that does not — rather than under-stating
 * it. A version erring the other way would quietly describe a live red as harmless.
 */
/**
 * 🔴 **ONLY A POSITIVE WAIT COUNTS, AND THE NAME ARM PRODUCED A FALSE POSITIVE THE HOUR IT WAS
 * WRITTEN BY SKIPPING THIS.** It reported `ui-ward-management.spec.ts:375` for waiting on the name
 * `"Priority queue"` after landing on `/queue` → `/delays`. It does not wait for it:
 *
 *     const header = page.locator("header").filter({ has: page.getByRole("heading", { name: "Priority queue" }) });
 *     await expect(header.getByText("Ward Flow", { exact: true })).toBeHidden();
 *
 * The name is a **filter**, and the assertion on it is **negative**. This guard's property is that a
 * spec must not wait for something the redirect target cannot paint — a `toBeHidden()` on a locator
 * matching nothing does not hang, it passes. So the finding was true about the name and false about
 * the defect, which is the worst kind: correct evidence, wrong verdict.
 *
 * ⚠️ **THE UNDERLYING SITUATION IS STILL A REAL WEAKNESS AND IS NOT SILENCED, ONLY MOVED.** That
 * assertion passes vacuously — an empty locator is hidden — and the spec's own comment says so in as
 * many words. It is a checks-that-cannot-fail problem, not a walks-into-a-redirect problem, and it
 * belongs to that file's owner. Reported in `spec-redirect-guard-2026-09-08.md` and routed, not
 * fixed here: this session may not edit `tests/ui-ward-*.spec.ts`.
 */
function isPositiveWait(segment: string, index: number): boolean {
  if (/\bhas:\s*[\w.]*$/u.test(segment.slice(Math.max(0, index - 40), index))) return false;
  const statement = segment.slice(index, index + 240).split(";")[0];
  return !/toBeHidden|not\s*\.\s*toBeVisible|toHaveCount\(\s*0\s*\)/u.test(statement);
}

function looksDormant(before: string): boolean {
  const opened = [...before.matchAll(/\btest\.describe\.skip\s*\(/gu)].length;
  return opened > 0 || /\btest\.skip\s*\(/u.test(before.slice(-400));
}

/**
 * The detector, over spec SOURCE rather than spec paths, so both directions can be proved on
 * synthetic input below without writing a spec-shaped file into `tests/` for a test's benefit —
 * and without copying a real spec, which would go stale the moment the original changed.
 */
function analyse(
  specs: readonly { readonly path: string; readonly source: string }[],
  /*
   * ⚠️ **INJECTABLE FOR ONE CONTROL ONLY, AND THE REASON IS A PROPERTY OF THE ESTATE, NOT A
   * CONVENIENCE.** The real run always resolves link destinations off disk. But NO ward label points
   * at a redirect stub today — and it cannot, because the sibling guard
   * `ward-links-never-point-at-redirect-stubs.test.ts` fails the moment one does. So the click arm
   * has no real red case available to prove itself on, by construction, and a click arm that has only
   * ever been seen returning nothing is indistinguishable from one that is wired up wrong.
   * The control below injects a map in which one label DOES reach a stub. Nothing else may pass this.
   */
  destinationsForControl?: ReadonlyMap<string, string>,
): Finding[] {
  const stubs = redirectStubs();
  const destinations = destinationsForControl ?? linkDestinations();
  const ids = new Map<string, Set<string>>();
  const names = new Map<string, Set<string>>();
  const findings: Finding[] = [];

  /** Every navigation in one spec, however it is written, as `{ offset, route, via }`. */
  const navigationsIn = (source: string) => {
    const out: { offset: number; route: string; via: "goto" | "click" }[] = [];
    for (const match of source.matchAll(NAVIGATION)) {
      out.push({ offset: match.index ?? 0, route: match[1], via: "goto" });
    }
    for (const match of source.matchAll(LINK_CLICK)) {
      // A name this cannot resolve is skipped, never guessed: an unresolved label is a link whose
      // destination is not statically derivable, and inventing one would accuse the wrong route.
      const route = destinations.get(match[1]);
      if (route) out.push({ offset: match.index ?? 0, route, via: "click" });
    }
    return out.sort((a, b) => a.offset - b.offset);
  };

  for (const { path, source: raw } of specs) {
    const source = stripComments(raw);
    for (const { offset, route, via } of navigationsIn(source)) {
      const stubRoute = route.replace(/[?#].*$/u, "").replace(/\/$/u, "");
      const target = stubs.get(stubRoute);
      if (!target) continue;

      if (!ids.has(target)) ids.set(target, renderableTestIds(target));
      if (!names.has(target)) names.set(target, renderableNames(target));
      const availableIds = [...ids.get(target)!];
      const availableNames = names.get(target)!;

      const segment = enclosingBlockAfter(source, offset);

      const missing: string[] = [];
      const awaitedIds = new Set<string>();
      for (const wait of segment.matchAll(AWAITED_TEST_ID)) {
        const id = (wait[1] ?? wait[2]).trim();
        if (id && isPositiveWait(segment, wait.index ?? 0)) awaitedIds.add(id);
      }
      for (const id of awaitedIds) {
        if (!availableIds.some((known) => known === id || known.startsWith(id) || id.startsWith(known))) {
          missing.push(`testid ${id}`);
        }
      }

      /*
       * Accessible-name waits. Only LITERAL names are judged — a regex (`name: /^Referral board\b/u`)
       * or a variable is skipped rather than guessed, which loses defects and invents none.
       */
      const awaitedNames = new Set<string>();
      for (const wait of segment.matchAll(AWAITED_ROLE_NAME)) {
        const name = wait[1].trim();
        if (name && isPositiveWait(segment, wait.index ?? 0)) awaitedNames.add(name);
      }
      for (const name of awaitedNames) {
        if (!availableNames.has(name)) missing.push(`name "${name}"`);
      }

      if (missing.length > 0) {
        findings.push({
          spec: path,
          line: source.slice(0, offset).split("\n").length,
          via,
          stub: stubRoute,
          target,
          missing: missing.sort(),
          dormant: looksDormant(source.slice(0, offset)),
        });
      }
    }
  }
  return findings;
}

const findingsIn = (specPaths: readonly string[]): Finding[] =>
  analyse(specPaths.map((path) => ({ path: rel(path), source: readFileSync(path, "utf8") })));

/**
 * 🟢 **PARKED IS EMPTY TODAY — see this file's own top-of-file comment ("THE EXCEPTION IS NARROW")
 * for what it held until 17 Sept 2026 and why the owner's ruling retired the entry rather than
 * widening or deleting this mechanism.**
 *
 * The entry it held, for the record: `ui-ward-morning.spec.ts` navigated to `/morning` and waited
 * for `ward-morning-page`, which `CapacityScreen` — the redirect target — does not render. The open
 * question was the owner's ruling on the morning/handover cross-link question, tracked as
 * outstanding issue #ZWJ71W (`docs/outstanding-issues.md`) — never "owner ruling D9"; D9 itself
 * (`docs/superpowers/specs/2026-08-25-ward-flow-phase-4-specialist-boards-design.md:98`) is the
 * already-built shift-handover page, a settled decision, unrelated to this one. That ruling landed
 * 2026-09-17 as a repoint (Morning's surviving coverage moved to
 * `tests/ui-ward-capacity-morning-moved.spec.ts`), not a restore, so the entry's own stated
 * condition applied and it was deleted.
 *
 * ⚠️ **THE MECHANISM IS KEPT DECLARED, EMPTY, FOR THE NEXT NARROW CASE.** Kept keyed on the whole
 * finding rather than the file, for the same reason it always was: a file-level exemption would
 * swallow the next real defect written into whatever spec next needs one, which is the failure mode
 * of every allowlist that was ever widened one line at a time.
 */
const PARKED: readonly {
  readonly spec: string;
  readonly stub: string;
  readonly missing: readonly string[];
  readonly until: string;
}[] = [];

const isParked = (f: Finding) =>
  PARKED.some(
    (p) =>
      p.spec === f.spec &&
      p.stub === f.stub &&
      p.missing.length === f.missing.length &&
      p.missing.every((id, i) => id === f.missing[i]),
  );

/**
 * 🔴 **THE LINE IS LABELLED `goto@` BECAUSE AN UNLABELLED ONE ALREADY CAUSED A FALSE ACCUSATION.**
 *
 * 2026-09-08: this guard printed `ui-ward-roles.spec.ts:246` and `:272`, the NAVIGATION lines. Two
 * peers wrote 247 and 273, the WAIT lines one below. I compared the two bare numbers, saw both peers
 * off by exactly one in the same direction, inferred that one had relayed the other's figure rather
 * than measuring, and **published that as a correction in two documents. Nobody was wrong. We were
 * counting different things.**
 *
 * ⚠️ **The heuristic was good and that is what makes it dangerous** — two correct measurements of
 * adjacent lines are indistinguishable from one measurement relayed with an off-by-one, and the
 * relay explanation is usually the right one. **Establish what is being counted before comparing two
 * counts.** A bare `file:line` invites exactly that comparison, so this one says which population it
 * belongs to; a reader can now disagree with the number without first having to guess the unit.
 */
const describeFinding = (f: Finding) =>
  `${f.spec} ${f.via}@${f.line} — ${f.dormant ? "DORMANT (skipped)" : "ACTIVE (runs today)"} — ` +
  `${f.via === "goto" ? "goto" : "clicks a link to"} ${f.stub} which redirects to ${f.target}, ` +
  `then waits for ${f.missing.join(", ")}`;

/* ------------------------------------------------------------------ *
 * The guard.
 * ------------------------------------------------------------------ */

describe("no ward spec navigates into a redirect stub and then waits for the screen it replaced", () => {
  it("strips a real comment, and does not eat a URL or a prose mention of redirect(", () => {
    // A commented-out navigation is not a navigation. If this arm broke, the guard would invent
    // violations out of retired code somebody deliberately left as a record.
    expect(stripComments('// await page.goto("/mockups/ward-flow/transport");').trim()).toBe("");

    // The defect direction: a URL on the same line as a real navigation. A stripper that reads
    // `https://` as a line comment deletes the goto that follows it and reports a clean estate.
    const withUrl = 'const docs = "https://www.health.wa.gov.au/x"; await page.goto("/mockups/ward-flow/queue");';
    expect(
      stripComments(withUrl),
      "a URL is being read as a line comment again, so a navigation after it on the same line is " +
        "deleted before this guard sees it",
    ).toContain("/mockups/ward-flow/queue");

    // And the reason route files must be stripped too: `movements/page.tsx` and `ward-nav.ts`
    // both discuss redirect() in prose while redirecting nothing.
    const prose = "/**\n * This page does NOT redirect( — see MERGE 03.\n */\nexport default function P() {}";
    expect(/\bredirect\(/u.test(stripComments(prose))).toBe(false);
  });

  it("reports the line a navigation is really on, across a block comment", () => {
    /*
     * The regression control for the defect this file shipped and then fixed: a stripper that
     * collapses a block comment to one space renumbers everything below it, and every finding this
     * guard emits is a `spec:line` location. Ward specs carry very long block comments — the two
     * transport navigations were mislocated by 61 and 71 lines.
     */
    const source = ["/**", " * three", " * comment", " * lines", " */", 'await page.goto("/x");'].join("\n");
    const stripped = stripComments(source);
    expect(
      stripped.slice(0, stripped.indexOf("page.goto")).split("\n").length,
      "line numbering shifted across a block comment again, so this guard's locations point at " +
        "innocent code some distance above the real navigation",
    ).toBe(source.slice(0, source.indexOf("page.goto")).split("\n").length);
  });

  it("scopes a navigation to its own enclosing block, not to the rest of the file", () => {
    const source = [
      "async function gotoStub(page) {",
      '  await page.goto("/x");',
      '  await expect(page.getByTestId("inside")).toBeVisible();',
      "}",
      'test("other", async ({ page }) => {',
      '  await expect(page.getByTestId("outside")).toBeVisible();',
      "});",
    ].join("\n");
    const segment = enclosingBlockAfter(source, source.indexOf("await page.goto"));
    expect(segment, "the navigation's own waits were lost, so real defects would go unreported").toContain("inside");
    expect(
      segment,
      "the segment ran past the end of the function that navigated, so waits belonging to an " +
        "unrelated test would be blamed on this navigation",
    ).not.toContain("outside");
  });

  it("can see the ids a live screen renders, so a clean result is not measurement failure", () => {
    // Anti-vacuity, and it is the control that matters most: if `renderableTestIds` returned an
    // empty set for everything, EVERY awaited id would look unrenderable and this guard would
    // redden on the whole estate — as useless as one that reddens on nothing.
    const movements = renderableTestIds("/mockups/ward-flow/movements");
    expect(
      movements.size,
      "the import closure found no test ids on Movements at all — the walk has broken, and every " +
        "verdict this guard reports is measurement failure rather than evidence",
    ).toBeGreaterThan(3);
    expect(movements, "Movements no longer renders its own root id; the closure is not reaching the screen").toContain(
      "ward-movements-page",
    );

    /*
     * The prop arm, proved on a real screen rather than asserted in a comment. `CapacityScreen`
     * reaches `WardTable`, which writes `data-testid={testId}`; the id itself is only ever written
     * at the call site as `testId="ward-capacity-gap-table"`. If this regressed, every spec waiting
     * on a panel or table id would be accused of a defect it does not have.
     */
    expect(
      renderableTestIds("/mockups/ward-flow/capacity"),
      "an id supplied through a `testId` prop is no longer being collected, so this guard will " +
        "report false defects against every panel and table handle in the estate",
    ).toContain("ward-capacity-gap-table");

    const stubs = redirectStubs();
    expect(
      [...stubs.keys()],
      "no ward route is a redirect stub any more, so this guard has no subjects. If the merges " +
        "were undone that is fine; if the route walk broke, it is not testing anything.",
    ).not.toHaveLength(0);
  });

  it("responds to the repair, not merely to the file", () => {
    /*
     * 🔴 **THE CONTROL THAT MATTERS, AND THE ONE A GUARD IS MOST OFTEN SHIPPED WITHOUT.** Being red
     * on `ui-ward-roles.spec.ts` proves this file can fail. It does NOT prove it would go green once
     * somebody fixed that spec — a guard hard-wired to redden on any navigation into a stub would
     * produce exactly the same red, and would then redden forever on a repaired file.
     *
     * Both directions are run over the same synthetic spec, differing only in the id waited for.
     * Real ids on both sides: `ward-live-tracker` is declared solely by the unreachable
     * `tracker/live-tracker.tsx`, `ward-movements-page` by the screen the redirect lands on.
     */
    const spec = (testId: string) =>
      [
        'test("t", async ({ page }) => {',
        '  await page.goto("/mockups/ward-flow/transport", { waitUntil: "domcontentloaded" });',
        `  await expect(page.getByTestId("${testId}")).toBeVisible();`,
        "});",
      ].join("\n");

    expect(
      analyse([{ path: "synthetic.spec.ts", source: spec("ward-live-tracker") }]).map(describeFinding),
      "the detector did not report a navigation into a redirect stub that waits for an id only the " +
        "abandoned screen declared — the exact defect this file exists for",
    ).toHaveLength(1);

    expect(
      analyse([{ path: "synthetic.spec.ts", source: spec("ward-movements-page") }]).map(describeFinding),
      "the detector reported a defect after the navigation was re-anchored on a handle the redirect " +
        "TARGET really renders. It is reddening on the navigation itself rather than on the broken " +
        "expectation, so it would stay red through the repair and get switched off.",
    ).toEqual([]);
  });

  it("resolves a link label to its route, including the one written as a constant", () => {
    const destinations = linkDestinations();
    expect(
      destinations.size,
      "no ward link labels resolved at all — the nav walk has broken, and the click arm is now " +
        "silently inert rather than finding nothing",
    ).toBeGreaterThan(15);

    // The plain case.
    expect(destinations.get("Delays")).toBe("/mockups/ward-flow/delays");

    /*
     * 🔴 **THE REGRESSION CONTROL FOR A MIS-PAIRING THAT WOULD HAVE INVENTED A FINDING.** The first
     * version matched `label:` and `href:` within a fixed character window, which resolved
     * "New referral" to `/out-of-area` — the NEXT entry's route. Its own href is the constant
     * `WARD_REFERRAL_INTAKE_HREF`, so the window skipped over it and paired the label with whatever
     * literal came next. Every route in that list is plausible, so nothing in the output looked wrong.
     */
    expect(
      destinations.get("New referral"),
      "a link label has been paired with a neighbouring entry's href again — the object walk or the " +
        "href-constant resolution has regressed, and this guard will accuse the wrong route",
    ).toBe("/mockups/ward-flow/referrals/new");
  });

  it("treats a click into a stub as a navigation, and only when it lands in one", () => {
    /*
     * The click arm, both directions, on an injected destination map — see `analyse`'s parameter for
     * why no real one can serve: the sibling link guard makes a label-that-reaches-a-stub impossible
     * by construction, so this arm has no natural red case to prove itself on.
     */
    const spec = (label: string) =>
      [
        'test("t", async ({ page }) => {',
        `  await page.getByRole("link", { name: "${label}", exact: true }).click();`,
        '  await expect(page.getByTestId("ward-live-tracker")).toBeVisible();',
        "});",
      ].join("\n");
    const destinations = new Map([
      ["Retired screen", "/mockups/ward-flow/transport"], // a stub
      ["Movements", "/mockups/ward-flow/movements"], // a live route
    ]);

    expect(
      analyse([{ path: "synthetic.spec.ts", source: spec("Retired screen") }], destinations).map(describeFinding),
      "a click that lands on a redirect stub and then waits for the retired screen's handle was not " +
        "reported — the click arm is not wired to the same check as `page.goto`",
    ).toHaveLength(1);

    expect(
      analyse([{ path: "synthetic.spec.ts", source: spec("Movements") }], destinations).map(describeFinding),
      "a click to a LIVE route was reported as a defect — the click arm is firing on the click " +
        "rather than on the destination",
    ).toEqual([]);
  });

  it("judges a wait scoped by accessible name, which it used to be blind to", () => {
    /*
     * 🔴 **THE ARM THAT WOULD HAVE CAUGHT THE VERY REPAIR THIS GUARD WAS WRITTEN ABOUT.** `origin/main`
     * re-pointed its Movements tests by the panel's accessible NAME, deliberately, so a test-id-only
     * guard could not have told those from broken ones. Both names below are real:
     * "Transport right now" is a `WardPanel title=` literal on `MovementsScreen`; the other is not.
     */
    const spec = (name: string) =>
      [
        'test("t", async ({ page }) => {',
        '  await page.goto("/mockups/ward-flow/transport", { waitUntil: "domcontentloaded" });',
        `  await expect(page.getByRole("region", { name: "${name}" })).toBeVisible();`,
        "});",
      ].join("\n");

    expect(
      analyse([{ path: "synthetic.spec.ts", source: spec("Vehicles right now") }]).map(describeFinding),
      "a wait on an accessible name the redirect target cannot expose was not reported — the name " +
        "arm is inert, and main's re-pointed Movements tests would still be invisible to this guard",
    ).toHaveLength(1);

    expect(
      analyse([{ path: "synthetic.spec.ts", source: spec("Transport right now") }]).map(describeFinding),
      "a wait on a panel name Movements really renders was reported as a defect — `title=` literals " +
        "are not reaching the renderable-name set, so every panel-scoped assertion is now accused",
    ).toEqual([]);
  });

  it("ignores a name used as a filter, and a negative assertion", () => {
    /*
     * The false positive this arm produced in its first hour, kept as a control. `ui-ward-management`
     * lands on `/queue` → `/delays` and mentions "Priority queue" — as a `filter({ has: … })` feeding
     * a `toBeHidden()`. A hidden assertion on a locator matching nothing PASSES; it does not hang. So
     * it is not this guard's defect, and reporting it was correct evidence attached to a wrong verdict.
     */
    const filtered = [
      'test("t", async ({ page }) => {',
      '  await page.goto("/mockups/ward-flow/queue", { waitUntil: "domcontentloaded" });',
      '  const header = page.locator("header").filter({ has: page.getByRole("heading", { name: "Priority queue" }) });',
      '  await expect(header.getByText("Ward Flow", { exact: true })).toBeHidden();',
      "});",
    ].join("\n");
    expect(
      analyse([{ path: "synthetic.spec.ts", source: filtered }]).map(describeFinding),
      "a name used as a locator FILTER, asserted absent, was reported as a wait — this guard is " +
        "accusing a test that passes for exactly the reason its own comment gives",
    ).toEqual([]);

    const negated = [
      'test("t", async ({ page }) => {',
      '  await page.goto("/mockups/ward-flow/transport", { waitUntil: "domcontentloaded" });',
      '  await expect(page.getByTestId("ward-live-tracker")).toBeHidden();',
      "});",
    ].join("\n");
    expect(
      analyse([{ path: "synthetic.spec.ts", source: negated }]).map(describeFinding),
      "asserting a retired screen's handle is ABSENT after landing on its replacement was reported " +
        "as a defect. That assertion is true and passes; the guard is firing on the id, not the wait.",
    ).toEqual([]);
  });

  it("passes a spec that navigates only to live routes", () => {
    // The negative control. `ui-ward-discharges.spec.ts` navigates to `/discharges`, which is a
    // real screen — a guard that reddens on everything would redden here too.
    const clean = join(TESTS_ROOT, "ui-ward-discharges.spec.ts");
    expect(existsSync(clean), "the negative control spec has been renamed; pick another live-route spec").toBe(true);
    expect(
      findingsIn([clean]).map(describeFinding),
      "this guard reported a defect in a spec that never navigates to a redirect stub, so it is " +
        "reddening on correct work and its verdicts elsewhere cannot be trusted either",
    ).toEqual([]);
  });

  /**
   * 🔴 **THE TWO CONTROLS THAT USED TO LIVE HERE — "does not let a parked entry cover a different
   * defect in the same spec" and "keeps every parked entry earning its place" — PROVED PROPERTIES OF
   * THE ONE `PARKED` ENTRY THIS FILE EVER HELD.** That entry named the Morning screen's own Playwright
   * spec; it was deleted 17 Sept 2026 when the owner's ruling repointed Morning's surviving coverage at
   * Capacity (see the top-of-file comment and the comment above the now-empty `PARKED` array). With
   * `PARKED` empty, both controls would run against nothing — `isParked` trivially returns `false`
   * for every input, and a `for (const parked of PARKED)` loop with nothing to iterate proves
   * nothing on every run. Keeping either would be exactly the shape this codebase elsewhere calls a
   * check that cannot fail: it always looks green and never tests anything again. Removed rather
   * than left to decay silently; see git history for their exact assertions if a future `PARKED`
   * entry needs the same two proofs re-built against it.
   */

  it("finds no ward spec waiting for a screen its navigation redirects away from", () => {
    const specs = WARD_SPECS();
    expect(specs.length, "no ward Playwright specs were found — the walk over tests/ has broken").toBeGreaterThan(5);

    expect(
      findingsIn(specs)
        .filter((f) => !isParked(f))
        .map(describeFinding),
      "a ward browser journey navigates to a route kept only so old bookmarks do not 404, and then " +
        "waits for a handle the redirect TARGET cannot render. It will not 404 — it will land on a " +
        "different screen and time out on an id nothing paints, which is the harder failure to read. " +
        "Point the navigation at the screen that absorbed it and re-anchor the assertion there. " +
        "A finding marked DORMANT is inside a skipped block: it cannot fail today, but the broken " +
        "navigation is still written down and un-skipping it revives the journey with no warning. " +
        "Skipping is not repairing — see this file's header before adding any exemption.",
    ).toEqual([]);
  });
});
