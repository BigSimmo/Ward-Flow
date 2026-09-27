import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * ═══ A COLOURED ROW FLAG MUST NOT BE THE ONLY PLACE THE INFORMATION APPEARS ═══════════════════
 *
 * ## What this guard is actually for, and why it is not the guard I set out to write
 *
 * `statistics-v4.module.css` carries a severity stripe on `.dtable tbody tr[data-tone]`, with a
 * comment claiming it works by "width, not hue alone, so it survives greyscale". Two of us spent a
 * while arguing about whether the three tones being the identical 3px was a defect. **Both of us
 * were reading a rule that selects no element on any screen.** The only `data-tone` in the
 * statistics tree sits on an SVG `<circle>` in the emergency-department wait chart.
 *
 * The row-severity mechanism that actually renders is a DIFFERENT attribute — `data-level`, styled
 * in `statistics.module.css`, hue-only across `urgent`/`stalled`/`ok` with no width difference at
 * all. So the live mechanism has precisely the property we were debating in the dead one.
 *
 * **And it is still not a defect, which is the part that decides what this file asserts.** The ED
 * wait row derives `level` from `waitMinutes`, and the same row prints `splitDuration(waitMinutes)`
 * in a text column. A reader who cannot separate red from amber reads "2d 4h" and knows. The colour
 * is redundant reinforcement of a value stated in words, which is what WCAG 1.4.1 asks for.
 *
 * ⚠️ **So the obvious guard — "the three severity widths must differ" — would have been WRONG.** It
 * would have gone red on this correct table and demanded a change it does not need. The property
 * that matters is not how the flag is drawn; it is whether anything is carried by the drawing alone.
 *
 * ## The property
 *
 * For every `<tr>` carrying a severity attribute, the value the flag is computed FROM must also be
 * printed somewhere in that row's own cells. That is checkable without rendering, and it fires on
 * the real mistake: a coloured row whose driver never reaches the page.
 *
 * ## What this does NOT cover, and why the one thing outside it is still sound
 *
 * The property is scoped to `<tr>`. **The ED wait chart has no rows** — its dots carry severity as
 * `style={{ fill: waitDotColor(tone) }}` and are invisible to this file.
 *
 * ⚠️ **I first justified that chart by saying every dot carries a `<title>` with the id and the
 * duration. Ward Verifier was right to attack it: an SVG `<title>` is a TOOLTIP.** A screen reader
 * gets it; a sighted reader who cannot separate the hues does not, unless they hover every dot in
 * turn. That is a weaker standard than "printed in the cell", and had it been the only defence the
 * chart would have failed.
 *
 * **The load-bearing fact is geometry, not the tooltip** (`statistics-ed-screen.tsx`):
 *
 * ```
 * x = (waitMinutes / axisMaxMinutes) * CHART_WIDTH   the dot's POSITION is the value
 * threshold24hX, threshold48hX                        both cutoffs are DRAWN on the axis
 * tone                                                derived from waitMinutes at those same cutoffs
 * ```
 *
 * So a reader seeing no colour at all still sees which side of the 24h and 48h lines each dot sits
 * on — the exact fact the hue encodes, in position. Three redundant encodings, and 1.4.1 is
 * satisfied before the tooltip is reached. (`x` is clamped to the dot radius at both ends so a dot
 * is never drawn half off the chart; the axis is sized to exceed the longest wait, so the clamp is
 * a guard against degenerate input rather than something that bends the encoding where the
 * thresholds sit.)
 *
 * 🔴 **Written here because the tooltip argument would survive a re-layout and the geometry one
 * would not.** Lane the chart by unit, make the axis categorical, turn it into a donut — the
 * `<title>` sentence stays true and still reads as sufficient, while the chart has silently become
 * colour-alone. Whoever re-lays it needs to meet the reason that actually holds.
 *
 * ⚠️ **And one limit of the property itself, worth stating rather than widening the test for.** It
 * proves the VALUE is visible, not that the THRESHOLD is. For a table that is enough: a reader
 * comparing "2d 4h" against "18h" gets the ordering, which is the decision. For the chart it is
 * enough only because the cutoffs are drawn. **A future screen flagging rows against a cutoff
 * nobody can see would satisfy this file and still leave a reader unable to tell which rows are
 * flagged.** (Ward Verifier.)
 *
 * ## Failing closed
 *
 * If the analyser cannot resolve a flag's driver, that is a finding, not a pass. A parser that
 * quietly understands nothing reports a clean tree, and a clean tree is exactly what a broken
 * parser and a correct codebase both look like.
 *
 * ⚠️ **`npm run test:focused` cannot select this file.** It selects by import graph and this test
 * reads source as text, importing none of it. Run it by path.
 */

const STATISTICS_DIR = "src/components/ward-management/statistics";

/** The attributes that put a status colour on a table row. Both spellings are live in this tree. */
const SEVERITY_ATTRIBUTES = ["data-level", "data-tone"] as const;

interface RowFinding {
  readonly file: string;
  readonly attribute: string;
  /** The expression written in the attribute, e.g. `level` or `"crit"`. */
  readonly flagExpression: string;
  /** Identifiers the flag is computed from, resolved from the driver's definition. */
  readonly driverIdentifiers: readonly string[];
  /** Identifiers printed inside the row's own cells. */
  readonly printedIdentifiers: readonly string[];
  /** Empty when the row is sound; otherwise why it is not. */
  readonly violation: string | undefined;
}

/** Identifiers that are never a data driver, so their presence proves nothing. */
const NOT_A_DRIVER = new Set([
  "undefined",
  "null",
  "true",
  "false",
  "const",
  "let",
  "return",
  "if",
  "else",
  "typeof",
  "String",
  "Number",
  "Boolean",
  "Math",
]);

/**
 * Whole property paths, not bare identifiers.
 *
 * ⚠️ **The first version of this collected bare identifiers and the COLOUR_ONLY fixture passed it.**
 * A driver of `row.waitMinutes` and a printed `row.id` share the token `row`, and every row in every
 * table prints `row.something` — so the check was satisfied by the object the row is built from
 * rather than by the datum the colour stands for. `row.waitMinutes` and `row.id` are different
 * tokens here, and do not intersect.
 */
function identifiersIn(expression: string): string[] {
  const found = new Set<string>();
  // Strip string literals first: `? "urgent" :` otherwise contributes `urgent` as though it were a
  // datum, and a cell rendering the literal word would then satisfy the check by coincidence.
  const withoutLiterals = expression.replace(/"[^"]*"|'[^']*'|`[^`]*`/gu, '""');
  for (const match of withoutLiterals.matchAll(/\b[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*/gu)) {
    const path = match[0];
    if (!NOT_A_DRIVER.has(path.split(".")[0])) found.add(path);
  }
  return [...found].sort();
}

/**
 * A threshold is not the datum. `waitMinutes >= MINUTES_PER_DAY` is driven by the wait, and a row
 * that printed only the threshold would say nothing about the person in it.
 */
function isThresholdConstant(name: string): boolean {
  return /^[A-Z0-9_]+$/u.test(name.split(".")[0]);
}

/** Slice from `openAt` to the index just past the matching `>` of that JSX opening tag. */
function endOfOpeningTag(source: string, openAt: number): number {
  let depth = 0;
  for (let i = openAt; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ">" && depth === 0) return i + 1;
  }
  return source.length;
}

/**
 * Resolve what a flag identifier is computed from, by finding its `const <name> =` binding in the
 * nearest enclosing scope above the row. Returns undefined when no binding is found — the caller
 * treats that as a finding rather than a pass.
 */
function resolveDriver(source: string, rowAt: number, flagName: string): string | undefined {
  const before = source.slice(0, rowAt);
  const binding = new RegExp(`\\bconst\\s+${flagName}\\s*=`, "gu");
  let last = -1;
  for (const match of before.matchAll(binding)) last = match.index + match[0].length;
  if (last < 0) return undefined;

  // Read to the terminating `;` at nesting depth zero, so a ternary spanning lines is captured whole.
  let depth = 0;
  for (let i = last; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    else if (ch === ";" && depth === 0) return source.slice(last, i);
    if (depth < 0) return source.slice(last, i);
  }
  return undefined;
}

/** Identifiers appearing inside JSX expression containers in the row BODY (never the opening tag). */
function printedInRowBody(rowBody: string): string[] {
  const found = new Set<string>();
  let i = 0;
  while (i < rowBody.length) {
    const open = rowBody.indexOf("{", i);
    if (open < 0) break;
    let depth = 1;
    let j = open + 1;
    while (j < rowBody.length && depth > 0) {
      if (rowBody[j] === "{") depth += 1;
      else if (rowBody[j] === "}") depth -= 1;
      j += 1;
    }
    for (const name of identifiersIn(rowBody.slice(open + 1, j - 1))) found.add(name);
    i = j;
  }
  return [...found].sort();
}

export function analyseSeverityRows(file: string, source: string): RowFinding[] {
  const findings: RowFinding[] = [];
  for (const match of source.matchAll(/<tr\b/gu)) {
    const openAt = match.index;
    const tagEnd = endOfOpeningTag(source, openAt);
    const openingTag = source.slice(openAt, tagEnd);

    for (const attribute of SEVERITY_ATTRIBUTES) {
      const attributeMatch = openingTag.match(new RegExp(`${attribute}=(\\{[^}]*\\}|"[^"]*")`, "u"));
      if (attributeMatch === null) continue;

      const raw = attributeMatch[1];
      const flagExpression = raw.startsWith("{") ? raw.slice(1, -1).trim() : raw;

      // A string literal is a constant colour: nothing computed it, so nothing can be printed.
      if (raw.startsWith('"')) {
        findings.push({
          file,
          attribute,
          flagExpression,
          driverIdentifiers: [],
          printedIdentifiers: [],
          violation: `${attribute}=${raw} is a constant colour — the row states its severity only by hue`,
        });
        continue;
      }

      const flagName = /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(flagExpression) ? flagExpression : undefined;
      const driverExpression = flagName === undefined ? flagExpression : resolveDriver(source, openAt, flagName);

      if (driverExpression === undefined) {
        findings.push({
          file,
          attribute,
          flagExpression,
          driverIdentifiers: [],
          printedIdentifiers: [],
          violation: `could not resolve what \`${flagExpression}\` is computed from — failing closed rather than assuming it is printed`,
        });
        continue;
      }

      const closeAt = source.indexOf("</tr>", tagEnd);
      const rowBody = source.slice(tagEnd, closeAt < 0 ? source.length : closeAt);

      const driverIdentifiers = identifiersIn(driverExpression).filter(
        (n) => n !== flagName && !isThresholdConstant(n),
      );
      const printedIdentifiers = printedInRowBody(rowBody);
      const shared = driverIdentifiers.filter((n) => printedIdentifiers.includes(n));

      findings.push({
        file,
        attribute,
        flagExpression,
        driverIdentifiers,
        printedIdentifiers,
        violation:
          shared.length > 0
            ? undefined
            : `the row is coloured by \`${flagExpression}\` (from ${driverIdentifiers.join(", ") || "nothing resolvable"}) but prints none of it — the colour is the only carrier`,
      });
    }
  }
  return findings;
}

describe("a coloured row flag is never the only carrier of its information", () => {
  const files = readdirSync(STATISTICS_DIR).filter((f) => f.endsWith(".tsx"));
  const findings = files.flatMap((file) =>
    analyseSeverityRows(file, readFileSync(`${STATISTICS_DIR}/${file}`, "utf8")),
  );

  it("walked a population that contains every statistics screen", () => {
    // Floor the population. A scan over an empty or truncated file list reports "clean", and clean
    // is indistinguishable from correct.
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const screen of [
      "statistics-ed-screen.tsx",
      "statistics-overview-screen.tsx",
      "statistics-service-screen.tsx",
      "statistics-compare-screen.tsx",
      "statistics-ward-screen.tsx",
    ]) {
      expect(files).toContain(screen);
    }
  });

  it("found the severity-flagged rows that exist today, so a silent parser failure cannot pass", () => {
    // Anti-vacuity. If the analyser stops recognising `<tr data-level={...}>`, every later assertion
    // in this file becomes a statement about an empty set.
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.map((f) => f.file)).toContain("statistics-ed-screen.tsx");
  });

  it("resolves the ED wait row's driver to the elapsed wait it prints", () => {
    // Anchors the parser to a row whose correctness was established by reading it. If this stops
    // holding, the analyser has changed meaning, not just verdict.
    const edRow = findings.find((f) => f.file === "statistics-ed-screen.tsx" && f.attribute === "data-level");
    expect(edRow).toBeDefined();
    expect(edRow?.driverIdentifiers).toContain("waitMinutes");
    expect(edRow?.printedIdentifiers).toContain("waitMinutes");
    expect(edRow?.violation).toBeUndefined();
  });

  it("goes red on the real ED screen the moment that column stops printing the wait", () => {
    // ⚠️ This is the mutation proof, kept rather than performed once and discarded.
    //
    // A disk mutation would have restored the file and left nothing behind; this one runs the real
    // source through the real analyser on every future run, so the guard cannot quietly stop
    // covering the one row it was built for. It is also the only form available while another agent
    // owns that file — editing it to prove a point would have collided with live work.
    // ⚠️ The mutation is scoped to the row, and the first version of it was not.
    // `real.replace("{splitDuration(waitMinutes)}", …)` hit an IDENTICAL string ~40 lines earlier —
    // the `<title>` of the SVG wait-chart dot — so the table cell was never touched and the guard
    // correctly reported no violation. The failing assertion read as a broken guard; it was a
    // broken mutation. Slice the row first, mutate inside it, put it back.
    const real = readFileSync(`${STATISTICS_DIR}/statistics-ed-screen.tsx`, "utf8");
    const flagAt = real.indexOf("data-level=");
    const rowStart = real.lastIndexOf("<tr", flagAt);
    const rowEnd = real.indexOf("</tr>", flagAt) + "</tr>".length;
    expect(flagAt, "the ED screen must still flag its wait rows").toBeGreaterThan(0);

    const row = real.slice(rowStart, rowEnd);
    const mutatedRow = row.replace("splitDuration(waitMinutes)", "splitDuration(0)");
    expect(mutatedRow, "the mutation must actually change the row").not.toBe(row);
    const mutated = real.slice(0, rowStart) + mutatedRow + real.slice(rowEnd);

    const after = analyseSeverityRows("statistics-ed-screen.tsx", mutated).find((f) => f.attribute === "data-level");
    expect(after?.violation).toMatch(/the colour is the only carrier/u);
  });

  it("no statistics row carries its severity in colour alone", () => {
    const violations = findings.filter((f) => f.violation !== undefined);
    expect(
      violations.map((f) => `${f.file}: <tr ${f.attribute}> — ${f.violation}`),
      "A status colour on a table row must reinforce something the row already says in words.",
    ).toEqual([]);
  });
});

describe("the analyser itself", () => {
  // ⚠️ These fixtures are the reason this guard can be trusted. The real tree is clean, so the
  // violation branch never executes against it — an unreachable branch is free to hold a wrong
  // expectation forever. These run it.

  const SOUND = `
    {rows.map((row) => {
      const level = row.waitMinutes >= 2880 ? "urgent" : undefined;
      return (
        <tr key={row.id} data-level={level}>
          <th scope="row">{row.id}</th>
          <td>{splitDuration(row.waitMinutes)}</td>
        </tr>
      );
    })}
  `;

  const COLOUR_ONLY = `
    {rows.map((row) => {
      const level = row.waitMinutes >= 2880 ? "urgent" : undefined;
      return (
        <tr key={row.id} data-level={level}>
          <th scope="row">{row.id}</th>
          <td>Waiting</td>
        </tr>
      );
    })}
  `;

  const CONSTANT_HUE = `
    <tr data-tone="crit">
      <th scope="row">Total</th>
    </tr>
  `;

  const UNRESOLVABLE = `
    <tr data-level={somethingFromElsewhere}>
      <th scope="row">{row.id}</th>
    </tr>
  `;

  it("passes a row that prints the value its colour is derived from", () => {
    expect(analyseSeverityRows("fixture.tsx", SOUND).map((f) => f.violation)).toEqual([undefined]);
  });

  it("fails a row whose driver never reaches the page", () => {
    const [finding] = analyseSeverityRows("fixture.tsx", COLOUR_ONLY);
    expect(finding.violation).toMatch(/the colour is the only carrier/u);
    expect(finding.driverIdentifiers).toContain("row.waitMinutes");
  });

  it("fails a row coloured by a constant", () => {
    const [finding] = analyseSeverityRows("fixture.tsx", CONSTANT_HUE);
    expect(finding.violation).toMatch(/constant colour/u);
  });

  it("fails closed when it cannot find the driver's definition", () => {
    const [finding] = analyseSeverityRows("fixture.tsx", UNRESOLVABLE);
    expect(finding.violation).toMatch(/could not resolve/u);
  });
});
