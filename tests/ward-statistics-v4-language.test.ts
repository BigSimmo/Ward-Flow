import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ═══ THE FOURTH-EDITION STATISTICS LANGUAGE, AND ITS CEILING ON DIAGRAMS ═══
 *
 * ⚠️ `npm run test:focused` CAN NEVER SELECT THIS FILE. It is `vitest related --run`, which picks by
 * the import graph, and this file imports nothing from `src/` — it reads CSS and HTML off disk. A
 * focused run that comes back green has not run this guard.
 *
 * Owner brief, 2026-09-06: *"you now have too many diagrams. Please focus on core useful ones then
 * state the stats as well for me clearly in data or tables and popup options."*
 *
 * **So the third edition's chart FLOOR becomes a chart CEILING here, and that is the whole point of
 * this edition.** A floor and a ceiling are not one guard pointed in opposite directions: a floor is
 * satisfied by ADDING, which is what people do under time pressure, while a ceiling is satisfied
 * only by DECIDING WHAT TO CUT. So this is the assertion most likely to be argued with rather than
 * obeyed, and it is stated as a number rather than as a principle for exactly that reason.
 *
 * These pages are published as artifacts, which supply their own document wrapper, so a carrier is
 * BODY CONTENT — not a whole HTML document. That is checked too.
 */

const DIR = join(process.cwd(), "docs/ward-flow/design/prototypes");
const SOURCE = "statistics-language-v4.css";

/**
 * Listed, never discovered by pattern. A pattern silently defines its own population, so a new
 * carrier joins the folder and the guard keeps passing without ever having looked at it — which is
 * what happened to the second edition's guard when four prototypes arrived unlisted.
 */
const CARRIERS = [
  "mockup-statistics-overview-v4.html",
  "mockup-statistics-service-v4.html",
  "mockup-statistics-cmht-v4.html",
  "mockup-statistics-ward-v4.html",
  "mockup-statistics-ed-v4.html",
] as const;

const canonical = readFileSync(join(DIR, SOURCE), "utf8");

/**
 * 🔴 **A MISSING CARRIER MUST NOT SILENCE THE CHECKS ON THE CARRIERS THAT ARE PRESENT.**
 *
 * The third edition's guard called `readFileSync` inside every loop, so one absent file threw and
 * the whole assertion died — reporting "this file is missing" and nothing at all about the four that
 * WERE on disk and might have been wrong. **An exception is not a failing assertion; it is the
 * absence of every assertion after it.** It cost a real defect: a carrier landed carrying retired
 * wording and the ENOENT masked it.
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
 * The third edition's caption check counted `role="img"` anywhere in the file. Every carrier copies
 * the language byte for byte, and **the language's own documentation comment contains the literal
 * characters `role="img"`** — the line telling builders every chart must carry one. The count was
 * therefore always exactly one higher than the number of real charts.
 *
 * ⚠️ **IT DID NOT GO RED AND GET FIXED — IT WENT RED AND GOT OBEYED.** Three builders hit it
 * independently, all three diagnosed it correctly as a miscount, and all three added a caption for a
 * chart that does not exist rather than hand it back. **A guard can manufacture the very thing it
 * claims to observe.**
 *
 * ⚠️ **WITH A CEILING IN FORCE THAT MISCOUNT WOULD NOW CONDEMN CORRECT WORK RATHER THAN MERELY
 * INVITE PADDING** — a file with three real charts would read as four and fail. Same bug, worse
 * consequence, which is why the fix travels with the edition instead of being left behind in v3.
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
  expect(close, `${file} has no closing style tag`).toBeGreaterThan(-1);
  return html.slice(from, close);
}

/** The ceiling the owner asked for, as a number rather than as a principle. */
const MAX_CHARTS = 3;

describe("the fourth-edition statistics language", () => {
  it("the source of record is a real stylesheet, not an empty one", () => {
    // Floor the POPULATION, never the finding: byte-identity against an empty string passes for
    // every file on disk.
    expect(canonical.length).toBeGreaterThan(15_000);
    expect(canonical).toContain("--background: #ffffff");
    expect(canonical).toContain("@media print");
    expect(canonical).toContain("@media (forced-colors: active)");
    // The fourth edition's own additions must actually be in the source of record, or five carriers
    // will copy a stylesheet that cannot style what the brief asks them to build.
    expect(canonical).toContain(".reveal");
    expect(canonical).toContain("tabular-nums");
    /*
     * Catch the early-close trap where it is AUTHORED. The carriers are checked for it too, but a
     * failure naming five carriers points at five innocent files instead of the one that must change.
     */
    expect(
      canonical.includes("</" + "style"),
      "the canonical stylesheet contains a literal style close-tag; every carrier that copies it " +
        "will end its style element there and render unstyled. Reword; do not escape.",
    ).toBe(false);
  });

  it("every listed carrier exists", () => {
    const onDisk = new Set(readdirSync(DIR));
    for (const file of CARRIERS) expect(onDisk.has(file), `${file} is listed but not on disk`).toBe(true);
  });

  it("no fourth-edition mockup has joined the folder without being listed here", () => {
    const fingerprint = canonical.slice(0, 400);
    const unlisted = readdirSync(DIR)
      .filter((f) => f.endsWith(".html") && !CARRIERS.includes(f as (typeof CARRIERS)[number]))
      .filter((f) => readFileSync(join(DIR, f), "utf8").includes(fingerprint));
    expect(unlisted, `these carry the v4 block but are not listed: ${unlisted.join(", ")}`).toEqual([]);
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

  it("🔴 no carrier ends its own style element early with a literal close-tag", () => {
    /*
     * 🔴 THE DEFECT THAT PASSED EVERY OTHER CHECK ON THE SECOND EDITION AND WOULD HAVE SHIPPED.
     * Per the HTML spec a style element's raw text ends at the first literal close sequence, comment
     * or not. The element closed 233 lines early, every rule after it rendered as visible page text,
     * and the screen was unstyled. Byte-identity passed; a jsdom parse passed; only a browser showed
     * it.
     */
    const offenders: string[] = [];
    for (const { file, html } of existing()) {
      const n = (html.match(/<\/style/gu) ?? []).length;
      if (n !== 1) offenders.push(`${file}: ${n} occurrences of a style close-tag (expected exactly 1)`);
    }
    expect(offenders, "reword the comment; do not escape it.").toEqual([]);
    expect(CARRIERS.length).toBe(5);
  });

  it("⚠️ every carrier is artifact-shaped body content, not a whole document", () => {
    /*
     * ⚠️ **THE FAILURE IS INVISIBLE WHERE A BUILDER WOULD LOOK FOR IT.** The artifact runtime wraps
     * the file in its own doctype/html/head/body. A carrier that ships its own gets nested or dropped
     * at publish time — while a local browser opens that same file perfectly, because browsers
     * tolerate both shapes. So a builder checking their work locally sees nothing wrong, and this is
     * the only place it can be caught before publication.
     *
     * 🔴 **THE FIRST DRAFT MATCHED `<head` AS A SUBSTRING, SO IT FIRED ON `<header>` — AND THE
     * LANGUAGE MANDATES `<header>`,** in `.panel > header`, for every panel's title bar. The guard
     * therefore condemned all five carriers for using the element the stylesheet they are required
     * to copy tells them to use. **It was a guard fighting its own design system.**
     *
     * ⚠️ **A BUILDER CAUGHT IT AND HANDED IT BACK RATHER THAN STRIPPING THEIR `<header>` TAGS**,
     * which is the outcome the brief asked for and the opposite of what happened in the third
     * edition, where three builders satisfied a miscount instead of questioning it. The lookahead
     * below is the fix: `<head` counts only when the next character ends the tag name.
     */
    const FORBIDDEN: Array<[string, RegExp]> = [
      ["<!doctype", /<!doctype/iu],
      ["<html>", /<html(?=[\s>])/iu],
      ["<head>", /<head(?=[\s>])/iu],
      ["<body>", /<body(?=[\s>])/iu],
    ];
    const offenders: string[] = [];
    for (const { file, html } of existing()) {
      for (const [name, pattern] of FORBIDDEN) {
        if (pattern.test(html)) offenders.push(`${file}: contains ${name}`);
      }
      if (!/<title>/iu.test(html)) offenders.push(`${file}: has no <title>, so it has no name in the gallery`);
    }
    expect(
      offenders,
      "an artifact carrier is body content with its own <title> and <style> at the top. The runtime " +
        "supplies the document wrapper.",
    ).toEqual([]);
  });

  it("🔴 draws AT MOST three charts — the owner asked for fewer diagrams", () => {
    /*
     * 🔴 **THIS IS THE RULE THE EDITION EXISTS FOR.** The third edition put eight SVGs on one page
     * and the owner's response was that there were too many diagrams.
     *
     * A chart is anything carrying `role="img"` in the MARKUP. Sparklines marked `aria-hidden` are
     * deliberately not counted — they are a figure's ornament, not a diagram competing for attention.
     */
    const offenders: string[] = [];
    for (const { file, html } of existing()) {
      const charts = (markupOf(html).match(/role="img"/gu) ?? []).length;
      if (charts > MAX_CHARTS) offenders.push(`${file}: ${charts} charts (the ceiling is ${MAX_CHARTS})`);
      if (charts === 0) offenders.push(`${file}: no chart at all — the ceiling is not a ban`);
    }
    expect(offenders, `cut to the ${MAX_CHARTS} that answer the page's question; state the rest as numbers.`).toEqual(
      [],
    );
  });

  it("🔴 states its figures as data — tables and disclosures, not only pictures", () => {
    /*
     * The other half of the same brief: *"state the stats as well for me clearly in data or tables
     * and popup options."*
     *
     * ⚠️ **THE CEILING ABOVE AND THIS FLOOR ARE ONE RULE IN TWO DIRECTIONS AND MUST BE READ
     * TOGETHER.** Cutting charts is only an improvement if the numbers arrive somewhere else;
     * removing either assertion lets a page satisfy the brief by simply losing information, which
     * is the cheapest way to obey "fewer diagrams" and the one nobody would notice.
     */
    const offenders: string[] = [];
    for (const { file, html } of existing()) {
      const markup = markupOf(html);
      const tables = (markup.match(/<table\b/gu) ?? []).length;
      const reveals = (markup.match(/<details\b/gu) ?? []).length;
      const summaries = (markup.match(/<summary\b/gu) ?? []).length;
      if (tables < 2) offenders.push(`${file}: ${tables} tables (at least 2 — the figures must read as data)`);
      if (reveals < 3) offenders.push(`${file}: ${reveals} disclosures (at least 3 — detail belongs behind a click)`);
      if (summaries < reveals) offenders.push(`${file}: ${reveals} disclosures but only ${summaries} summaries`);
    }
    expect(offenders).toEqual([]);
  });

  it("⚠️ every chart states its reading in words as well as in ink", () => {
    /*
     * Colour and shape are never the only carrier. A greyscale printout and a reader with no colour
     * perception both get the reading from the caption.
     */
    const offenders: string[] = [];
    for (const { file, html } of existing()) {
      const markup = markupOf(html);
      const charts = (markup.match(/role="img"/gu) ?? []).length;
      const captions = (markup.match(/class="chart-caption"/gu) ?? []).length;
      if (captions < charts) offenders.push(`${file}: ${charts} charts but only ${captions} written captions`);
    }
    expect(offenders).toEqual([]);
  });

  it("⚠️ no carrier is appended to itself — the corruption that passes MORE, not less", () => {
    /*
     * 🔴 A SIBLING WORKTREE'S TEST FILE WENT FROM 367 LINES TO 1101 ON 2026-09-06 — its own content
     * appended twice over, every added line already present. It does not fail; it passes, three times
     * over, and every count quoted from that run inflates while nothing goes red.
     */
    const doubled = existing()
      .filter(({ html }) => html.split(html.slice(0, 300)).length - 1 > 1)
      .map(({ file }) => file);
    expect(doubled, `these contain their own opening more than once: ${doubled.join(", ")}`).toEqual([]);
  });

  it("🔴 draws no bar charts — the owner asked for lines and arcs", () => {
    /*
     * ⚠️ THE CHECK IS ON <rect> IN A CHART, NOT ON THE WORD "bar". A screen may describe a bar chart
     * in prose perfectly legitimately — the ban is on drawing one. Rects used for a chart BACKGROUND
     * are the one legitimate use, so the allowance is narrow and stated.
     */
    const offenders: string[] = [];
    for (const { file, html } of existing()) {
      const rects = (html.match(/<rect\b/gu) ?? []).length;
      if (rects > 2) offenders.push(`${file}: ${rects} <rect> elements — a bar chart, or close to one`);
    }
    expect(offenders, "up to two rects per file are allowed for a plot background.").toEqual([]);
  });

  it("⚠️ every class the markup uses is a class the stylesheet defines", () => {
    /*
     * An undefined class renders its element with no styling at all, while byte-identity passes and
     * a jsdom parse succeeds — the same shape as the early-close trap. One-directional on purpose:
     * used-but-undefined is a defect; defined-but-unused is not, because the shared language carries
     * primitives every carrier is entitled to ignore.
     */
    const offenders: string[] = [];
    let classUses = 0;
    for (const { file, html } of existing()) {
      const open = html.indexOf("<style>");
      const close = html.indexOf("</style>", open);
      if (open < 0 || close < 0) continue;
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
    // reports zero orphans and this passes having examined nothing.
    expect(classUses, "no class attributes were read — the scan is broken, not the files").toBeGreaterThan(150);
    expect(offenders, "these classes render unstyled. Add the rule to the page block, or fix the name.").toEqual([]);
  });

  it("⚠️ every var() a carrier's <style> block uses has a matching declaration in that same block", () => {
    /*
     * 🔴 **THE DEFECT THIS GUARD EXISTS FOR.** The five published mockups painted with four custom
     * properties nobody ever declared — `--r2`, `--t-sm`, `--t-xs`, and `--text-body` used as a colour
     * when it is declared only as a font size. An unresolved var() invalidates the WHOLE declaration
     * and the browser silently drops it — no console error, nothing that reads as breakage. The
     * disclosure summaries simply rendered at the inherited size with square corners, which looks like
     * a design choice. It reached the owner in five published artifacts and no check caught it.
     *
     * 🔴 **THE TRAP THE FIRST VERSION OF THIS SWEEP FELL INTO.** Collecting every `--x:` declaration in
     * the file — including ones inside `@media (forced-colors: active)` — reports a file clean while
     * its ordinary rules are being discarded, because that block is an override for a reader who
     * cannot see colour, never a definition for anyone else. So USES are collected from the whole
     * style block (a token used inside forced-colors must still resolve there), but DECLARATIONS are
     * collected only after stripping forced-colors blocks out, brace-balanced.
     */
    function stripForcedColors(css: string): string {
      let out = "";
      let i = 0;
      for (;;) {
        const at = css.indexOf("@media", i);
        if (at < 0) return out + css.slice(i);
        const braceAt = css.indexOf("{", at);
        if (braceAt < 0) return out + css.slice(i);
        const condition = css.slice(at, braceAt);
        if (!/forced-colors/u.test(condition)) {
          out += css.slice(i, braceAt + 1);
          i = braceAt + 1;
          continue;
        }
        // Walk to the matching close brace so a nested rule inside the override doesn't confuse us.
        let depth = 1;
        let j = braceAt + 1;
        while (j < css.length && depth > 0) {
          if (css[j] === "{") depth += 1;
          else if (css[j] === "}") depth -= 1;
          j += 1;
        }
        out += css.slice(i, at);
        i = j;
      }
    }

    const offenders: string[] = [];
    let totalUses = 0;

    for (const { file, html } of existing()) {
      const open = html.indexOf("<style>");
      const close = html.indexOf("</style>", open);
      if (open < 0 || close < 0) continue; // reported by "has a <style> block" elsewhere
      const css = html.slice(open + "<style>".length, close);
      const normal = stripForcedColors(css);

      const uses = [...css.matchAll(/var\(\s*(--[A-Za-z0-9-]+)/gu)].map((m) => m[1]);
      totalUses += uses.length;
      const used = new Set(uses);
      const declared = new Set([...normal.matchAll(/^\s*(--[A-Za-z0-9-]+)\s*:/gmu)].map((m) => m[1]));
      const missing = [...used].filter((v) => !declared.has(v)).sort();

      if (missing.length > 0) offenders.push(`${file}: ${missing.join(", ")}`);
    }

    // Floor the POPULATION, never the finding: a var() regex that silently stops matching reports
    // zero undeclared for every file, which reads identically to a genuinely clean repository. The
    // five carriers currently carry roughly 1470 raw var() references between them (48 distinct
    // custom-property names, ~290 uses per carrier, per a direct count against the checked-in files
    // on 2026-09-06) — 800 is comfortably below that real number, with room for future edits, and
    // light-years above the zero a broken regex would produce.
    expect(totalUses, "no var() reference was collected at all — the scan is broken, not the files").toBeGreaterThan(
      800,
    );
    expect(
      offenders,
      "an unresolved var() invalidates the whole declaration and the browser silently drops it. Declare " +
        "the token in this same block (outside forced-colors), or fix the name.",
    ).toEqual([]);
  });

  it("🔴 says it once — the prose ceiling, and the data floor that stops a page obeying it by deleting", () => {
    /*
     * 🔴 **OWNER, 2026-09-06: "you have excessive explanations for me … please compact and perfect."**
     *
     * Measured before this ceiling was set, so it is calibrated against the real files rather than
     * guessed: the five carriers ran 1788–2390 prose words each, with 16–19 blocks over 45 words and
     * single paragraphs reaching 130. The tables were 158–318 words. **So the bloat was entirely
     * prose, and a ceiling on TOTAL words would have pushed a builder to delete table rows — the
     * data — to satisfy a limit the sentences had blown.** Tables are excluded from the count for
     * that reason, and floored separately below.
     *
     * ⚠️ **THE FLOORS ARE NOT DECORATION. THE CHEAPEST WAY TO OBEY "LESS TEXT" IS TO DELETE THE
     * CAVEATS**, and on these screens the caveats are the clinical safety: the note saying this board
     * is a convenience rather than the record, and the footnote saying which figures are invented. A
     * page that loses those reads as more authoritative than the one that kept them, which is the
     * exact opposite of what the trim is for.
     */
    const strip = (s: string) =>
      s
        .replace(/<[^>]*>/gu, " ")
        .replace(/&[a-z]+;/gu, " ")
        .replace(/\s+/gu, " ")
        .trim();
    const wordCount = (s: string) => strip(s).split(" ").filter(Boolean).length;

    const offenders: string[] = [];
    let pagesMeasured = 0;

    for (const { file, html } of existing()) {
      const markup = markupOf(html);
      pagesMeasured += 1;

      let tableWords = 0;
      for (const t of markup.matchAll(/<table\b[\s\S]*?<\/table>/gu)) tableWords += wordCount(t[0]);
      const prose = markup.replace(/<table\b[\s\S]*?<\/table>/gu, " ");
      const proseWords = wordCount(prose);

      if (proseWords > 950) offenders.push(`${file}: ${proseWords} prose words (ceiling 950)`);

      // ⚠️ The floor, in the same loop so neither can be read without the other.
      if (tableWords < 140)
        offenders.push(`${file}: only ${tableWords} words of table (floor 140) — data was cut, not prose`);

      const longest = [...prose.matchAll(/<(p|li|dd|dt)\b[^>]*>([\s\S]*?)<\/\1>/gu)]
        .map((m) => ({ n: wordCount(m[2]), text: strip(m[2]).slice(0, 60) }))
        .filter((b) => b.n > 45)
        .sort((a, b) => b.n - a.n);
      if (longest.length > 0) {
        offenders.push(
          `${file}: ${longest.length} blocks over 45 words, longest ${longest[0].n} ("${longest[0].text}…")`,
        );
      }

      // The clinical caveats that must survive the trim, named rather than counted.
      if (!/class="scope"/u.test(markup)) offenders.push(`${file}: the ruling-R17 scope note is gone`);
      if (!/class="footnote"/u.test(markup)) offenders.push(`${file}: the invented-figures footnote is gone`);

      /*
       * ⚠️ **PRESENCE IS NOT CONTENT.** The first draft asked only whether `class="scope"` appeared,
       * which a builder under a word ceiling satisfies with the single word "Note." — the element
       * survives, the caveat does not, and the page reads as more authoritative than it should while
       * the guard stays green. Under a ceiling that pressure is real, not hypothetical: every word
       * spent on a caveat is a word unavailable elsewhere.
       *
       * 🔴 **AND THE FIRST FIX WAS DECORATION.** It counted words in a fixed 2500-character window
       * from the class attribute, which sweeps in everything AFTER the element — so a scope stubbed
       * to "Note." still measured ~400 words and passed. It was caught only by mutating a real file
       * and requiring the floor to fire; reading the code, it looked correct. **A window is not an
       * element.** This walks the element's own nesting to its matching close tag.
       *
       * ⚠️ **A WORD FLOOR CATCHES A STUB. IT CANNOT CATCH A LIE**, and must not be read as though it
       * does — a padded but meaningless caveat passes. It is deliberately a size check rather than a
       * wording check, because pinning the phrasing would redden every honest rewrite.
       */
      const elementAt = (cls: string): string | undefined => {
        const at = markup.indexOf(`class="${cls}"`);
        if (at < 0) return undefined;
        const open = markup.lastIndexOf("<", at);
        const tag = /^<([a-zA-Z][\w-]*)/u.exec(markup.slice(open))?.[1];
        if (tag === undefined) return undefined;
        /*
         * ⚠️ **SCANNED WITH indexOf, DELIBERATELY, RATHER THAN WITH A CONSTRUCTED REGEXP.** The first
         * attempt built one from a template literal — `new RegExp(`<${tag}\\b`)` — and a backslash was
         * halved on the way into this file, so the pattern held a literal BACKSPACE (0x08) instead of
         * a word boundary and matched nothing. Its sibling lost `\\s` the same way and degraded to a
         * literal "s", which happened to still match `</p>` and hid the problem.
         *
         * 🔴 **THE GUARD THEN REPORTED THE FILE AS FINE, WHICH IS WHAT A CORRECT FILE ALSO LOOKS
         * LIKE.** It was caught only by mutating a real caveat down to one word and requiring this to
         * fire. String scanning has no escapes to lose.
         */
        const openTag = `<${tag}`;
        const closeTag = `</${tag}`;
        const endsName = (ch: string | undefined) => ch === undefined || ch === ">" || ch === "/" || /\s/u.test(ch);
        let depth = 0;
        let cursor = open;
        for (let guard = 0; guard < 20_000; guard += 1) {
          let nextOpen = markup.indexOf(openTag, cursor);
          while (nextOpen >= 0 && !endsName(markup[nextOpen + openTag.length])) {
            nextOpen = markup.indexOf(openTag, nextOpen + 1);
          }
          let nextClose = markup.indexOf(closeTag, cursor);
          while (nextClose >= 0 && !endsName(markup[nextClose + closeTag.length])) {
            nextClose = markup.indexOf(closeTag, nextClose + 1);
          }
          if (nextClose < 0) return markup.slice(open);
          if (nextOpen >= 0 && nextOpen < nextClose) {
            depth += 1;
            cursor = nextOpen + 1;
            continue;
          }
          depth -= 1;
          cursor = nextClose + 1;
          if (depth === 0) return markup.slice(open, nextClose);
        }
        return markup.slice(open);
      };
      const substance = (cls: string, floor: number) => {
        const el = elementAt(cls);
        if (el === undefined) return; // reported above
        const words = wordCount(el);
        if (words < floor) offenders.push(`${file}: .${cls} is down to ~${words} words — a stub, not a caveat`);
      };
      substance("scope", 15);
      substance("footnote", 40);
    }

    // Floor the POPULATION, never the finding.
    expect(pagesMeasured, "no page was measured at all").toBe(CARRIERS.length);
    expect(
      offenders,
      "say it once. Cut explanation, never data and never a caveat — and if a figure needs a " +
        "paragraph to be understood, put the paragraph behind a disclosure.",
    ).toEqual([]);
  });

  it("⚠️ uses no retired capacity wording", () => {
    /*
     * Owner ruling R-B-09: "Ready" is the one word for min(allocatable, empty).
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
