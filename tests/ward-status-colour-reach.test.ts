// tests/ward-status-colour-reach.test.ts
//
// 🔴 A WARD RULE THAT REACHES PAST THE WARD LAYER FOR A STATUS COLOUR LOSES ITS HIGH-CONTRAST
// HANDLING, AND NOTHING REPORTED IT.
//
// `ward-tokens.module.css` re-points `--ward-danger`, `--ward-warning`, `--ward-success` and their
// `-soft` partners to system colours inside `@media (forced-colors: active)`. Those aliases resolve
// to `--danger-text` / `--warning-text` / `--success-text` and the `-bg` partners in normal mode —
// and NEITHER app-level forced-colors block re-points those six names. Measured by extracting the
// declarations from inside each block rather than reading the file: `--danger`, `--warning` and
// `--success` are re-pointed; the six `-text` and `-bg` names are absent from both.
//
// So the two spellings behave identically in every mode a developer looks at, and differently in
// the one nobody renders: `var(--ward-danger)` becomes `CanvasText` under Windows High Contrast,
// and `var(--danger-text)` stays a themed colour the mode has already decided to ignore. **On a
// clinical screen that is a warning that stops looking like a warning**, and it was invisible to
// every test here — `ward-forced-colors-tokens.test.ts` reads the TOKEN LAYER only and never opens
// a consumer stylesheet, so it is green either way. That is the gap this fills.
//
// ⚠️ THIS DERIVES "PROTECTED" RATHER THAN LISTING IT. It reads the forced-colors blocks of both app
// layers and the ward layer, and treats a token as protected if any of them re-points it. That
// matters for the fix nobody in this room owns: if the six names are ever added to
// `ckb-v2-tokens.css` — the cleaner fix, which touches a file serving the whole product and so was
// written up as a proposal instead of taken — this guard notices on its own, with no edit and no
// stale list left behind. The first assertion says so in terms and asks to be deleted.
//
// ⚠️ AND IT RECORDS MEASUREMENTS, NOT CEILINGS — changed 2026-09-06 and the reason is in the
// RECORDED docblock below. Each recorded file's number must EQUAL its measured count, so improving
// a file goes red and asks for the new figure exactly as adding to one does. A ceiling could only
// fail upward, which made a stale one a silent licence; an exact record has no weak setting,
// because the only edit that turns it green is writing the true number. A file not listed records
// an implicit zero.
//
// ⚠️ THREE LIMITS, WRITTEN DOWN RATHER THAN DISCOVERED IN SIX WEEKS.
//
// 1. THIS GATE'S CLEAN RESULT IS PARTLY HELD UP BY THE FORMAT GATE, NOT BY ITSELF. The parser used
//    to miss any `var()` with leading whitespace, and the reason there were zero live instances is
//    that Prettier rewrites `var( --x )` and the multi-line form back to `var(--x)` — confirmed by
//    running `prettier --parser css` on both. `SKIP_FORMAT_GUARD=1` exists, and AGENTS.md records
//    that an agent pushing from its own environment bypasses the pre-push hook entirely. The
//    whitespace hole is fixed, so this coupling no longer hides anything HERE — but a gate whose
//    coverage rests on another gate that has a documented bypass should say so, or the next person
//    reads a clean sweep as unconditional.
//
// 2. IT SCORES EACH FILE'S OWN TEXT AND FOLLOWS NO `composes:`. Ward CSS has 92 of them. "Zero uses
//    in this file" and "no class here renders a raw status colour" are different claims, and this
//    gate only makes the first. Measured on the recorded files: add-patient 0, person 0, ed 1 — and
//    ed's is `wardTokens`, the bridge — so the limit does not bite on anything recorded below.
//
// 3. COVERAGE IS PROVEN OVER SHAPES, NOT OVER THE LANGUAGE. A planted regression was used to prove
//    the gate can actually go red per file; `var()` inside `calc()`, inside a custom-property
//    definition, and behind `@supports` are untested. The honest claim is the count of files a
//    planted regression reddened, never "the parser is sound".
//
// Being a `readFileSync` scanner it imports nothing from `src/`, so `npm run test:focused` can
// never select it. It runs in the full suite.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const WARD = "src/components/ward-management";
const FORCED_COLOURS_LAYERS = [
  "src/app/ckb-v2-tokens.css",
  "src/app/globals.css",
  join(WARD, "ward-tokens.module.css"),
];

/** The six roles a ward rule must not reach for directly, each with the alias that is protected. */
const REACHES: Readonly<Record<string, string>> = {
  "--danger-text": "--ward-danger",
  "--warning-text": "--ward-warning",
  "--success-text": "--ward-success",
  "--danger-bg": "--ward-danger-soft",
  "--warning-bg": "--ward-warning-soft",
  "--success-bg": "--ward-success-soft",
};

/**
 * What each recorded file measures, and why it is recorded at all.
 *
 * 🔴 **THESE ARE MEASUREMENTS, NOT CEILINGS — and the difference is the whole point.** The number
 * must EQUAL the count, so improving a file goes red and asks for the new figure, exactly as adding
 * to one does. An unlisted file records an implicit zero and behaves as it always has.
 *
 * ⚠️ **A CEILING WAS A LICENCE AND THIS IS DEMONSTRATED, NOT ARGUED.** On 2026-09-06 three files
 * still held ceilings of 8, 7 and 2 after Ward Builder Four's work had cleared all three to zero.
 * **Two genuine regressions were planted in `person.module.css` and the file reported `3 passed` —
 * completely green.** Seventeen clinical status colours could have lost their high-contrast
 * handling with nothing reported, because a file UNDER its ceiling passes silently forever.
 *
 * 🔴 **AND EXACT EQUALITY CANNOT BE DEFEATED BY LOOSENING, WHICH IS WHY IT REPLACED THE CEILING
 * RATHER THAN SUPPLEMENTING IT.** Raising a ceiling hides new debt and looks like maintenance —
 * small, plausible, and precisely what somebody blocked at 11pm does. An exact record has no weak
 * setting: **the only edit that turns it green is writing the true number**, which is the action
 * wanted. Slack can no longer accumulate, so nobody inherits anybody else's staleness either.
 *
 * The cost, stated rather than hoped away: anyone who changes a count in one of these files — in
 * either direction, including as a side effect of an unrelated refactor — must also update one
 * line. Five records against 51 stylesheets. Full argument, and the scope-by-touched-files design
 * that was rejected because it would have done nothing on a full run of `main`:
 * `docs/ward-flow/ratchet-slack-proposal-2026-09-06.md`.
 *
 * The reason on each entry is what makes it reviewable: "held by another chat on a date" is
 * checkable and expires, where a bare filename is a permanent excuse nobody can audit.
 */
const RECORDED: readonly { readonly file: string; readonly measured: number; readonly because: string }[] = [
  {
    file: "ward-tokens.module.css",
    measured: 6,
    because:
      "THE BRIDGE ITSELF — these six uses ARE the alias definitions that make every other file safe. " +
      "Re-pointing them at their own aliases would be circular. Permanent and correct.",
  },
  {
    file: "ward/ward.module.css",
    measured: 0,
    because:
      "CLEARED at the fold on 2026-09-06. The ceiling of 24 was a hold while Ward Builder Four was " +
      "walking every route; that work landed, and the fold then pushed the file to 29 — the ceiling " +
      "caught it, which is the gate doing its job. All 31 uses are now on the aliases, so the hold " +
      "has no subject. A ceiling above zero on a file nobody is holding is a licence, not a record.",
  },
  {
    file: "patients/add-patient.module.css",
    measured: 0,
    because:
      "CLEARED 2026-09-06. The hold for Ward Builder Four ended when their work landed; all three " +
      "of their files measure zero. See the block comment above this list for why the ceilings " +
      "were dropped the moment the hold expired rather than at the next tidy-up.",
  },
  { file: "ed/ed.module.css", measured: 0, because: "CLEARED 2026-09-06, with add-patient and person." },
  { file: "patients/person.module.css", measured: 0, because: "CLEARED 2026-09-06, with add-patient and ed." },
  {
    file: "tools/ward-mha-calculator.module.css",
    measured: 15,
    because:
      "Recorded 2026-09-25 (test fixer). New MHA calculator tool; every reach is the fallback in " +
      "`var(--ward-warning, var(--warning-text))`-shaped pairs behind a declared --ward-* alias.",
  },
  {
    file: "ward-global-search.module.css",
    measured: 2,
    because:
      "Recorded 2026-09-25 (test fixer). Two DIRECT reaches (success background and text, ~line " +
      "490), not fallbacks. The search screen is owned by the remove-invented-data thread, so this " +
      "records them rather than editing its file; re-pointing them at --ward-* aliases is its work.",
  },
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const posix = (path: string): string => path.split("\\").join("/");

/**
 * Blank block-comment bodies, preserving newlines. **Written with string operations and no regex at
 * all**, because a token named in prose must never be read as a declaration — and because an escape
 * inside a pattern is a thing that can be mangled on the way to disk. This repository has already
 * shipped a guard whose word-boundary escape reached the file as a literal backspace byte, matched
 * nothing anywhere, and passed green over an empty list for a whole commit.
 */
function stripComments(css: string): string {
  let out = "";
  let index = 0;
  while (index < css.length) {
    if (css[index] === "/" && css[index + 1] === "*") {
      const close = css.indexOf("*/", index + 2);
      const end = close < 0 ? css.length : close + 2;
      for (const character of css.slice(index, end)) out += character === "\n" ? "\n" : " ";
      index = end;
      continue;
    }
    out += css[index];
    index += 1;
  }
  return out;
}

/**
 * Every custom property re-pointed inside a `forced-colors` block, across all three layers.
 * Brace-matched rather than read to end of file, so a block that is not the last one in its file
 * cannot swallow the rules that follow it.
 */
function protectedTokens(): ReadonlySet<string> {
  const found = new Set<string>();
  for (const file of FORCED_COLOURS_LAYERS) {
    const css = readFileSync(file, "utf8");
    let index = 0;
    for (;;) {
      const at = css.indexOf("@media", index);
      if (at < 0) break;
      const open = css.indexOf("{", at);
      if (open < 0) break;
      const header = css.slice(at, open);
      let depth = 0;
      let end = open;
      for (; end < css.length; end += 1) {
        if (css[end] === "{") depth += 1;
        else if (css[end] === "}") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      if (header.includes("forced-colors")) {
        for (const line of css.slice(open, end).split("\n")) {
          const colon = line.indexOf(":");
          const name = colon < 0 ? "" : line.slice(0, colon).trim();
          if (name.startsWith("--")) found.add(name);
        }
      }
      index = end + 1;
    }
  }
  return found;
}

/** Every `var(--token)` in the source, found without a regex. */
function tokensUsedIn(css: string): string[] {
  const used: string[] = [];
  let index = css.indexOf("var(");
  while (index >= 0) {
    // ⚠️ LEADING WHITESPACE IS TRIMMED BEFORE THE SEPARATOR HUNT, AND WITHOUT THIS A SINGLE SPACE
    // HID A TOKEN COMPLETELY. `var( --success-text)` put the space at index 0, so the first
    // separator was found at 0, the slice was the empty string, and `"" in REACHES` is false.
    // The `.trim()` below could not help — the slice was already empty. Same family as the
    // nested-fallback hole documented below, one character earlier in the string. Found by Ward
    // Lead and Ward Verifier independently, 2026-09-06; zero live instances in `src/**/*.css`,
    // so it was a hole in the detector rather than a defect in the estate.
    const rest = css.slice(index + "var(".length).replace(/^\s+/u, "");
    // Cut at the first separator, so a FALLBACK is not swallowed into the token name and a longer
    // hyphenated property is never truncated into a shorter one.
    let end = rest.length;
    for (const separator of [",", ")", " "]) {
      const at = rest.indexOf(separator);
      if (at >= 0 && at < end) end = at;
    }
    used.push(rest.slice(0, end).trim());
    // ⚠️ ADVANCE PAST THE `var(`, NEVER PAST THE CLOSING PAREN. This resumed at the first `)` until
    // 2026-09-06, which STEPPED OVER A NESTED `var(` ENTIRELY: on
    // `var(--success-bg-hover, var(--success-bg))` the outer read returned
    // "--success-bg-hover, var(--success-bg" — correctly not a token — and the scan then resumed
    // after the inner `)`, so the unprotected fallback was never visited. **An unprotected token
    // hidden in a fallback was invisible to this guard**, which is the one place it is easiest to
    // hide and the shape the ward stylesheets already use in seven other rules.
    //
    // Not live when found — none of those seven named a status token in the fallback position — so
    // nothing was being missed today. It was a hole in the detector, not a defect in the estate,
    // and the two are indistinguishable from a green.
    index = css.indexOf("var(", index + "var(".length);
  }
  return used;
}

function unprotectedUsesIn(css: string, safe: ReadonlySet<string>): string[] {
  return tokensUsedIn(stripComments(css)).filter((token) => token in REACHES && !safe.has(token));
}

const SAFE = protectedTokens();
const SHEETS = walk(WARD)
  .map(posix)
  .filter((file) => file.endsWith(".css"));

describe("no ward rule reaches past the ward layer for a status colour", () => {
  it("reads a real population and a real set of protected tokens (anti-vacuity)", () => {
    // Floored on what was WALKED, never on what was found. A scanner that reads nothing reports a
    // clean estate, and these two assertions are the only thing standing between the two.
    expect(SHEETS.length, `only ${SHEETS.length} ward stylesheets found — the walk is broken`).toBeGreaterThan(40);
    expect(
      SAFE.size,
      "no tokens were read out of any forced-colors block, so every use below would look protected",
    ).toBeGreaterThan(50);

    // The premise, asserted rather than assumed.
    expect(
      Object.keys(REACHES).filter((token) => SAFE.has(token)),
      "an app layer now re-points these six directly, which is the cleaner fix and makes every " +
        "ceiling below meaningless. This guard has served its purpose: DELETE it, rather than " +
        "adjusting it to stay green.",
    ).toEqual([]);
  });

  it("finds a reaching use, ignores an aliased one, and ignores one written in a comment", () => {
    // 🔴 WITHOUT THIS THE GUARD IS DECORATION. Every file that was mine now reports zero, so the
    // assertion below passes over an empty list — which is precisely what a detector matching
    // nothing at all produces. This is the arm that tells the two apart, and it is checked in both
    // directions so that widening the exemptions cannot quietly disarm it.
    const fixture = [
      "/* prose mentioning var(--danger-text), which is evidence and must not be read as code */",
      ".reaches { color: var(--danger-text); }",
      ".alsoReaches { background: var(--warning-bg); }",
      ".aliased { color: var(--ward-danger); }",
      ".unrelated { color: var(--ward-text); }",
      // 🔴 THE NESTED-FALLBACK PAIR, ADDED 2026-09-06 BECAUSE THE DETECTOR MISSED THE FIRST ONE.
      // A fallback is the easiest place in CSS to hide a token, and the parser used to resume
      // scanning after the first `)` — stepping over the inner `var(` entirely. The ward
      // stylesheets already use this shape in seven rules, so it was one edit away from mattering.
      // Both directions: the unprotected fallback must be FOUND, and the aliased one must not,
      // because a fix that simply matched more aggressively would fire on `--success-bg-hover`.
      //
      // ⚠️ **AND `--success-bg-hover` IS NOT WHAT I FIRST CALLED IT.** I described it as "a real and
      // separate property whose name merely starts with a token name". **It is defined nowhere** —
      // not in any stylesheet, not in any TypeScript, verified whole-tree with a control proving the
      // search finds `--success-bg`. It exists as one use in `ward/ward.module.css`, this fixture,
      // and one row in `docs/ward-flow/parked-debt-2026-09-04.md`. **It is a dead reference kept
      // alive entirely by its fallback.**
      //
      // Both readings say "do not re-point it" and they are different instructions, which is why
      // the wrong one mattered: *a real property* means leave it forever, while *a dead reference
      // carried by its fallback* means leave it AND it is latent — the day someone defines that
      // name, or tidies the fallback away as redundant, this declaration changes behaviour and
      // nothing here catches it. **The fallback is load-bearing.** Same trap as `--wd-tap-target`
      // three rows below it in that same register.
      ".hidesInFallback { background: var(--success-bg-hover, var(--success-bg)); }",
      ".fallbackIsAliased { background: var(--warning-bg-hover, var(--ward-warning-soft)); }",
      // 🔴 THE LEADING-WHITESPACE TRIO, ADDED 2026-09-06 BECAUSE A SINGLE SPACE HID A TOKEN
      // COMPLETELY. The separator hunt took the first of "," ")" " " — so on `var( --x)` the
      // space sat at index 0, the slice was empty, and the trim below could not rescue it.
      // Three shapes, all silent before the fix and all found after it.
      ".spacedAfter { color: var( --warning-text); }",
      ".spacedBothSides { color: var( --success-text ); }",
      ".spacedOverLines {",
      "  border-color: var(",
      "    --danger-bg",
      "  );",
      "}",
    ].join("\n");
    expect(unprotectedUsesIn(fixture, SAFE).sort()).toEqual([
      "--danger-bg",
      "--danger-text",
      "--success-bg",
      "--success-text",
      "--warning-bg",
      "--warning-text",
    ]);
  });

  it("keeps every file's measured count exactly equal to its record, and every unlisted file at zero", () => {
    const records = new Map(RECORDED.map((entry) => [entry.file, entry]));
    const wrong: string[] = [];
    for (const sheet of SHEETS) {
      const relative = sheet.slice(`${WARD}/`.length);
      const count = unprotectedUsesIn(readFileSync(sheet, "utf8"), SAFE).length;
      const entry = records.get(relative);
      const recorded = entry?.measured ?? 0;
      if (count === recorded) continue;
      // ⚠️ THE MESSAGE IS WRITTEN FOR THE IMPROVING CASE FIRST, because that is the case that decides
      // whether this gate survives. A gate whose message reads like an accusation on work that made
      // the file better gets widened; one that reads like bookkeeping gets obeyed.
      wrong.push(
        count < recorded
          ? [
              `  ${relative} measures ${count}, and its record says ${recorded}.`,
              "      You have improved this file. Record the new number:",
              `        { file: "${relative}", measured: ${count}, because: "..." }`,
              "      This is bookkeeping, not a fault. The record exists so the next person knows what",
              "      is genuinely left here rather than inheriting a number nobody has re-derived.",
            ].join("\n")
          : [
              `  ${relative} measures ${count}, and its record says ${recorded} — ` +
                `${count - recorded} new reach(es) past the --ward-* layer.`,
              ...(entry ? [`      recorded because: ${entry.because}`] : []),
            ].join("\n"),
      );
    }
    expect(
      wrong,
      [
        "a ward stylesheet's status-colour count no longer matches its record:",
        ...wrong,
        "",
        "  Use the alias instead of the raw role: " +
          Object.entries(REACHES)
            .map(([from, to]) => `${from} -> ${to}`)
            .join(", "),
        "  The alias resolves to the same value in every ordinary mode, so nothing changes on screen",
        "  except under forced colours, where it starts working.",
      ].join("\n"),
    ).toEqual([]);
  });
});
