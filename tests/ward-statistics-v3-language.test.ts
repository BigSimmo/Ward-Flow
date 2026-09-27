import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ═══ THE THIRD-EDITION STATISTICS LANGUAGE LIVES IN EXACTLY ONE PLACE ═══
 *
 * ⚠️ `npm run test:focused` CAN NEVER SELECT THIS FILE. It is `vitest related --run`, which picks by
 * the import graph, and this file imports nothing from `src/` — it reads CSS and HTML off disk. A
 * focused run that comes back green has not run this guard.
 *
 * The third edition exists because the second one was its OWN colour scheme. It invented
 * `--ground: #f1f4f8`, `--ink: #0d1421` and a dozen more names that exist nowhere in the product,
 * while the application's system of record (`src/app/ckb-v2-tokens.css`) says
 * `--background: #ffffff`. So the mockups and the application they are the spec for did not look
 * like one product — and the mockup is the thing an engineer copies from.
 *
 * `statistics-language-v3.css` is the source of record. Every carrier copies its WHOLE content as
 * the first thing inside its `<style>` element and appends its own rules below.
 */

const DIR = join(process.cwd(), "docs/ward-flow/design/prototypes");
const SOURCE = "statistics-language-v3.css";

/**
 * Listed, never discovered by pattern. A pattern silently defines its own population, so a new
 * carrier joins the folder and the guard keeps passing without ever having looked at it — which is
 * exactly what happened to the second edition's guard when four statistics prototypes arrived
 * unlisted and it sat red on the integration line unnoticed.
 */
const CARRIERS = [
  "mockup-statistics-overview-v3.html",
  "mockup-statistics-service-v2.html",
  "mockup-statistics-cmht-v3.html",
  "mockup-statistics-ward-v3.html",
  "mockup-statistics-ed-v3.html",
] as const;

const canonical = readFileSync(join(DIR, SOURCE), "utf8");

/**
 * 🔴 **A MISSING CARRIER MUST NOT SILENCE THE CHECKS ON THE CARRIERS THAT ARE PRESENT.**
 *
 * The first draft called `readFileSync` inside every loop, so one absent file threw and the whole
 * assertion died — reporting "this file is missing" and nothing at all about the four that WERE on
 * disk and might have been wrong. **A guard that stops at the first gap reports a crash instead of
 * its findings**, which is the same family as a guard whose population empties: from the outside you
 * cannot tell "nothing wrong" from "never looked".
 *
 * A missing file is still a failure — `every listed carrier exists` is the one place it is reported.
 */
function existing(): Array<{ file: string; html: string }> {
  const found: Array<{ file: string; html: string }> = [];
  for (const file of CARRIERS) {
    try {
      found.push({ file, html: readFileSync(join(DIR, file), "utf8") });
    } catch {
      /* reported by "every listed carrier exists" */
    }
  }
  return found;
}

/**
 * 🔴 **THE GUARD THAT MADE THREE BUILDERS PAD THEIR WORK TO SATISFY A MISCOUNT.**
 *
 * The caption check counted `role="img"` anywhere in the file. Every carrier copies
 * `statistics-language-v3.css` byte for byte, and **that stylesheet's own documentation comment
 * contains the literal characters `role="img"`** — the line telling builders every chart must carry
 * one. So the count was always exactly one higher than the number of real charts, and captions could
 * never legitimately equal charts.
 *
 * ⚠️ **IT DID NOT GO RED AND GET FIXED — IT WENT RED AND GOT OBEYED.** Three builders hit it
 * independently, all three diagnosed it correctly as a miscount, and all three added a caption for a
 * chart that does not exist rather than hand it back. **A guard the work bends around is worse than
 * no guard**: it silently authored content, and that padding is now indistinguishable from a real
 * caption in three finished files.
 *
 * Counting markup means counting markup, so the style element is stripped first.
 */
function markupOf(html: string): string {
  const open = html.indexOf("<style>");
  if (open < 0) return html;
  const close = html.indexOf("</style>", open);
  if (close < 0) return html;
  return html.slice(0, open) + html.slice(close + "</style>".length);
}

function styleBlock(file: string): string {
  const html = readFileSync(join(DIR, file), "utf8");
  const open = html.indexOf("<style>");
  expect(open, `${file} has no <style> block`).toBeGreaterThan(-1);
  const from = open + "<style>".length;
  const close = html.indexOf("</style>", from);
  expect(close, `${file} has no closing </style>`).toBeGreaterThan(-1);
  return html.slice(from, close);
}

describe("the third-edition statistics language", () => {
  it("the source of record is a real stylesheet, not an empty one", () => {
    // Floor the POPULATION, never the finding: a byte-identity check against an
    // empty string passes for every file on disk.
    expect(canonical.length).toBeGreaterThan(15_000);
    expect(canonical).toContain("--background: #ffffff");
    expect(canonical).toContain("@media print");
    expect(canonical).toContain("@media (forced-colors: active)");
    /*
     * The carriers are checked for this too, but the SOURCE is where it would originate — and a
     * failure naming five carriers points at five innocent files instead of the one that has to
     * change. Catch it where it is authored.
     */
    expect(
      canonical.includes("</style"),
      "the canonical stylesheet contains a literal style close-tag; every carrier that copies it " +
        "will end its style element there and render unstyled. Reword; do not escape.",
    ).toBe(false);
  });

  it("every listed carrier exists", () => {
    const onDisk = new Set(readdirSync(DIR));
    for (const file of CARRIERS) expect(onDisk.has(file), `${file} is listed but not on disk`).toBe(true);
  });

  it("no third-edition mockup has joined the folder without being listed here", () => {
    const fingerprint = canonical.slice(0, 400);
    const unlisted = readdirSync(DIR)
      .filter((f) => f.endsWith(".html") && !CARRIERS.includes(f as (typeof CARRIERS)[number]))
      .filter((f) => readFileSync(join(DIR, f), "utf8").includes(fingerprint));
    expect(unlisted, `these carry the v3 block but are not listed: ${unlisted.join(", ")}`).toEqual([]);
  });

  it.each(CARRIERS)("%s begins with the language, byte for byte", (file) => {
    const block = styleBlock(file);
    if (!block.startsWith(canonical)) {
      let i = 0;
      while (i < canonical.length && block[i] === canonical[i]) i += 1;
      const line = canonical.slice(0, i).split("\n").length;
      throw new Error(
        `${file} diverges from ${SOURCE} at character ${i} (line ${line}).\n` +
          `  ${SOURCE} has: ${JSON.stringify(canonical.slice(i, i + 70))}\n` +
          `  ${file} has: ${JSON.stringify(block.slice(i, i + 70))}\n` +
          `Do not hand-patch the copy. Edit ${SOURCE} and re-cut.`,
      );
    }
    expect(block.startsWith(canonical)).toBe(true);
  });

  it("🔴 no carrier ends its own style element early with a literal </style", () => {
    /*
     * 🔴 THE DEFECT THAT PASSED EVERY OTHER CHECK ON THE SECOND EDITION AND WOULD HAVE SHIPPED.
     * A mockup carried the literal text of a style close tag inside a CSS comment. Per the HTML
     * spec a style element's raw text ends at the first literal `</style` sequence, comment or not
     * — the same trap as `</script>` inside a script. The element closed 233 lines early, every
     * rule after it rendered as visible page text, and the screen was unstyled.
     *
     * ⚠️ NOTHING CAUGHT IT. `styleBlock` reads to the FIRST terminator, so the truncated block
     * still began with the canonical block byte for byte and every assertion passed. A jsdom parse
     * passes too: the document is well-formed, it simply means something other than what its author
     * wrote. Correct by every measure except what it does in a browser.
     */
    const offenders: string[] = [];
    for (const { file, html } of existing()) {
      const n = (html.match(/<\/style/gu) ?? []).length;
      if (n !== 1) offenders.push(`${file}: ${n} occurrences of "</style" (expected exactly 1)`);
    }
    expect(
      offenders,
      "a literal </style inside the block ends the element there, whatever surrounds it. Reword the " +
        "comment; do not escape it.",
    ).toEqual([]);
    expect(CARRIERS.length).toBe(5);
  });

  it("⚠️ no carrier is appended to itself — the corruption that passes MORE, not less", () => {
    /*
     * 🔴 A SIBLING WORKTREE'S TEST FILE WENT FROM 367 LINES TO 1101 ON 2026-09-06 — its own content
     * appended twice over, every added line already present. **It does not fail. It passes, three
     * times over**, and every count quoted from that run inflates while nothing goes red. It was
     * found only because an unrelated pre-commit hook blocked for half an hour.
     *
     * The check is four lines and the class is wide, so it is worth having wherever files are
     * written by script.
     */
    const doubled = existing()
      .filter(({ html }) => html.split(html.slice(0, 300)).length - 1 > 1)
      .map(({ file }) => file);
    expect(doubled, `these files contain their own opening content more than once: ${doubled.join(", ")}`).toEqual([]);
  });

  it("🔴 draws no bar charts — the owner asked for lines and arcs", () => {
    /*
     * Owner brief, 2026-09-06: "live diagrams that are easy to interpret simply, ideally lines or
     * circles … rather than bar charts". A bar answers "how big is each"; a line answers "which way
     * is this going", which is what every one of these screens is for.
     *
     * ⚠️ THE CHECK IS ON <rect> IN A CHART, NOT ON THE WORD "bar". A screen can describe a bar chart
     * in prose perfectly legitimately — the ban is on drawing one. `<rect>` is how one is drawn in
     * SVG; lines use `<path>`/`<polyline>`, arcs use `<circle>`/`<path>`. Rects used for a chart
     * BACKGROUND are the one legitimate use, so the allowance is narrow and stated: at most two per
     * file, which covers a plot ground and a clip rect without covering a series.
     */
    const offenders: string[] = [];
    for (const { file, html } of existing()) {
      const rects = (html.match(/<rect\b/gu) ?? []).length;
      if (rects > 2) offenders.push(`${file}: ${rects} <rect> elements — a bar chart, or close to one`);
    }
    expect(
      offenders,
      "charts in this language are lines and arcs. <rect> draws bars; use <path>, <polyline>, " +
        "<circle>. Up to two rects per file are allowed for a plot background.",
    ).toEqual([]);
  });

  it("⚠️ every chart states its reading in words as well as in ink", () => {
    /*
     * Colour and shape are never the only carrier. A greyscale printout and a reader with no colour
     * perception both get the reading from the caption, which is why every carrier must have at
     * least one `role="img"` chart AND at least one written caption.
     */
    const offenders: string[] = [];
    for (const { file, html } of existing()) {
      const markup = markupOf(html);
      const charts = (markup.match(/role="img"/gu) ?? []).length;
      const captions = (markup.match(/class="chart-caption"/gu) ?? []).length;
      if (charts === 0) offenders.push(`${file}: no chart carries role="img"`);
      if (captions < charts) offenders.push(`${file}: ${charts} charts but only ${captions} written captions`);
    }
    expect(offenders).toEqual([]);
  });

  it("⚠️ every class the markup uses is a class the stylesheet defines", () => {
    /*
     * ⚠️ **AN UNDEFINED CLASS IS THE SAME FAMILY AS THE EARLY-CLOSE TRAP: WELL-FORMED AND SILENTLY
     * WRONG.** A typo in a class name — `.stat-fig` for `.stat-figure`, or a primitive renamed in the
     * language but not in a carrier — renders that element with no styling at all. Byte-identity
     * cannot see it (the canonical block is intact), a jsdom parse cannot see it (the document is
     * well-formed), and the page still "works". It is simply broken in one place, visually only.
     *
     * The check is deliberately ONE-DIRECTIONAL. **Used-but-undefined is a defect; defined-but-unused
     * is not** — the shared language carries primitives every carrier is entitled to ignore, so
     * asserting the reverse would redden five correct files.
     */
    const offenders: string[] = [];
    let classUses = 0;
    for (const { file, html } of existing()) {
      const open = html.indexOf("<style>");
      const close = html.indexOf("</style>", open);
      if (open < 0 || close < 0) continue; // reported by the byte-identity row
      const css = html.slice(open + "<style>".length, close);
      const markup = html.slice(0, open) + html.slice(close + "</style>".length);

      const used = new Set<string>();
      for (const m of markup.matchAll(/\sclass="([^"]+)"/gu)) {
        for (const token of m[1].split(/\s+/u)) if (token) used.add(token);
      }
      const defined = new Set((css.match(/\.[A-Za-z][\w-]*/gu) ?? []).map((c) => c.slice(1)));
      classUses += used.size;

      const orphans = [...used].filter((c) => !defined.has(c)).sort();
      if (orphans.length > 0) offenders.push(`${file}: ${orphans.join(", ")}`);
    }

    // Floor the POPULATION, never the finding: if the class regex stops matching, every carrier
    // reports zero orphans and this passes having examined nothing at all.
    expect(classUses, "no class attributes were read — the scan is broken, not the files").toBeGreaterThan(150);
    expect(
      offenders,
      "these classes are used in the markup but defined in no stylesheet, so those elements render " +
        "with no styling at all. Add the rule to the page block, or fix the name.",
    ).toEqual([]);
  });

  it("⚠️ uses no retired capacity wording", () => {
    /*
     * Owner ruling R-B-09: "Ready" is the one word for min(allocatable, empty). "Available now",
     * "you can fill today" and "no bed free" are retired for that figure.
     *
     * ⚠️ "no free bed" IS LEGAL and is deliberately not matched — it names the raw `allocatable`
     * gate, a DIFFERENT number, and `ward-eligibility.ts` already uses it. The word order is the
     * entire distinction, and the second edition got it wrong in two files because the instruction
     * given to the builders used the banned order.
     */
    const offenders: string[] = [];
    for (const { file, html } of existing()) {
      for (const phrase of ["available now", "you can fill today", "no bed free"]) {
        if (html.toLowerCase().includes(phrase)) offenders.push(`${file}: "${phrase}"`);
      }
    }
    expect(offenders, 'retired wording for min(allocatable, empty). The ruled word is "Ready".').toEqual([]);
  });
});
