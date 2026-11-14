import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { DESK_PERSONAS } from "@/components/ward-management/shell/ward-desk-personas";

/**
 * The held clinical PR's whole-folder source guards (D-186, D-189), in one file. Each bans a pattern
 * from every file of a folder (or from source comments), which a rendered test cannot prove, so this
 * file is on the source-text ratchet's list (tests/source-text-tests.json) as that test's header
 * allows: "a guard over every file in src". Every other check of this work renders the screen or calls
 * the code. Moved here unchanged from ward-clinical-d189-placement-authorisation.test.ts,
 * ward-clinical-d189-transport-legal-named.test.ts, ward-clinical-d189-triage.test.ts and
 * ward-clinical-d186-triage.test.ts. Synthetic data only.
 */

/**
 * The source guard, in the style of `ward-fix-D-legal-position-guard.test.ts`: code lines only, so a
 * comment may still explain the history. Outside `ward-authorisation.ts`, only the files that hold or
 * carry the invented flag as data may name `.authorised` (D-189 item 8(a)).
 */
const WARD_DIR = "src/components/ward-management";
const AUTHORISATION_READERS = new Set([
  // The one place it is read.
  "ward-authorisation.ts",
  // The sample generator builds stories and places nobody (D-189 item 9(a): left alone).
  "ward-movements.ts",
  "ward-demo-network.ts",
  // The statistics contract and derivation carry the field as data for the executive bed finder.
  "statistics/executive-statistics-derivations.ts",
  "statistics/statistics-ward-screen.tsx",
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/u.test(name) ? [path] : [];
  });
}

function codeLines(text: string): { line: number; code: string }[] {
  return text
    .split("\n")
    .map((code, index) => ({ line: index + 1, code }))
    .filter(({ code }) => !/^\s*(?:\/\/|\/?\*|\{\s*\/\*)/u.test(code));
}

describe("D-189 item 8(a): source guard", () => {
  it("no other ward file reads the invented flag", () => {
    const files = walk(WARD_DIR);
    expect(files.length).toBeGreaterThan(200);
    const offenders = files
      .map((file) => relative(WARD_DIR, file).replaceAll("\\", "/"))
      .filter((file) => !AUTHORISATION_READERS.has(file))
      .flatMap((file) =>
        codeLines(readFileSync(join(WARD_DIR, file), "utf8"))
          // `styles.authorised` is a CSS class for leave authorised by a psychiatrist, not the flag.
          .filter(({ code }) => /(?<!styles)\.authorised\b/u.test(code))
          .map(({ line, code }) => `${file}:${line}: ${code.trim()}`),
      );
    expect(offenders, "read authorisation through ward-authorisation.ts").toEqual([]);
  });

  // D-189 item 6: the screens that showed a ward's authorisation. The refusal and alert texts behind
  // the switch keep D-186 item 8's wording, because they cannot show until Q42 is signed.
  const FACT_SCREENS = [
    "ward/ward-screen.tsx",
    "capacity/capacity-ward-drawer.tsx",
    "hub/hub-screen.tsx",
    "hub/hub-place-row.tsx",
    "tools/ward-bed-finder.tsx",
    "tools/ward-tool-find-bed.tsx",
  ];

  it("no screen that showed a ward's facts says it is or is not set up for involuntary admissions", () => {
    const offenders = FACT_SCREENS.flatMap((file) =>
      codeLines(readFileSync(join(WARD_DIR, file), "utf8"))
        .filter(({ code }) =>
          /set up for involuntary admissions|authorised for involuntary admissions|Voluntary only|voluntary only/u.test(
            code,
          ),
        )
        .map(({ line, code }) => `${file}:${line}: ${code.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe("D-186 item 4: no hand-written 'not Voluntary' check outside the named rules", () => {
  /**
   * Named exceptions, each a display or a different named rule:
   * - ward-eligibility.ts: the D-69 rule ("needs an involuntary-capable bed until status is set"),
   *   which deliberately differs from isNotVoluntary for a blank status (plan item 7).
   * - referrals/ward-referral-drawer-referral-step.tsx: keeps the record's own status in a select.
   * - search/patient-search.tsx: chooses the words "Voluntary status" for a search row.
   */
  const ALLOWED = [
    "src/components/ward-management/ward-legal-meaning.ts",
    "src/components/ward-management/ward-eligibility.ts",
    "src/components/ward-management/referrals/ward-referral-drawer-referral-step.tsx",
    "src/components/ward-management/search/patient-search.tsx",
  ];
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return /\.tsx?$/.test(entry) ? [full] : [];
    });
  }
  const code = (source: string) =>
    source
      .split("\n")
      .filter((line) => !/^\s*(?:\/\/|\*|\/\*)/u.test(line))
      .join("\n");

  it('finds !== "Voluntary" only in the named files', () => {
    const root = process.cwd();
    const found = sourceFiles(join(root, "src"))
      .filter((file) => /!==?\s*"Voluntary"/u.test(code(readFileSync(file, "utf8"))))
      .map((file) => relative(root, file).split("\\").join("/"))
      .sort();
    expect(found.filter((file) => !ALLOWED.includes(file))).toEqual([]);
  });
});

const TRIAGE_DIR = "src/components/ward-management/triage";
const triageSources = () =>
  readdirSync(TRIAGE_DIR)
    .filter((file) => /\.(ts|tsx)$/u.test(file))
    .map((file) => [file, readFileSync(join(TRIAGE_DIR, file), "utf8")] as const);

describe("A9-29: no fixed signer anywhere in Triage", () => {
  it("keeps no fixed signer in Triage: no SIGNED_IN, no staff-list import and no persona name typed in", () => {
    const names = Object.values(DESK_PERSONAS).map((persona) => persona.name);
    const files = triageSources();
    expect(files.length).toBeGreaterThan(10);
    for (const [file, text] of files) {
      expect(text, file).not.toMatch(/\bSIGNED_IN\b/u);
      expect(text, file).not.toContain("ward-staff-names-seed");
      for (const name of names) expect(text, `${file}: ${name}`).not.toContain(name);
    }
  });
});

describe("F-80 (D-189 item 5): crisis numbers stay copy-only text, never a call link", () => {
  it("has no call link anywhere in Triage", () => {
    for (const [file, text] of triageSources()) expect(text, file).not.toMatch(/\b(?:tel|callto|sms):/iu);
  });
});

describe("D-186 Q12 and D-209 item 8: the crisis numbers' note", () => {
  // A source comment is the only place this note lives, so reading the source is the point.
  it("keeps the note that names the check and its source", () => {
    const safety = readFileSync(join(TRIAGE_DIR, "triage-risk-safety.ts"), "utf8").replace(/\s+/g, " ");
    expect(safety).toContain("checked against the Mental Health Commission WA Helplines page");
  });
});

describe("D-186 item 4: the D-69 rule keeps its name", () => {
  // The rule's name lives only in its comment; its behaviour is checked in
  // ward-clinical-d189-placement-legal-rules.test.ts.
  it("names the D-69 rule in ward-eligibility.ts", () => {
    expect(readFileSync(join(WARD_DIR, "ward-eligibility.ts"), "utf8")).toContain(
      'THE D-69 RULE, "needs an involuntary-capable bed until status is set"',
    );
  });
});

describe("D-187 item 19: the design-only redesign board keeps the raise guard", () => {
  // The redesign copy (D-89, D-91) raises only from its inbox, which a test render does not reach, so
  // its guard is read here. The live board's behaviour is checked rendered in
  // ward-clinical-review-fixes-2.dom.test.tsx.
  it("refuses an unfinished draft and sends an interval only for Intermittent", () => {
    const redesign = readFileSync("src/components/ward-redesign/ed-board/ed-board-redesign.tsx", "utf8").replace(
      /\s+/g,
      " ",
    );
    expect(redesign).toContain("referralDraftBlockedReason({ ...draft, patientFound: draft.patientId !== undefined })");
    expect(redesign).toContain(
      'intervalMinutes: observation === "intermittent" ? draft.observationIntervalMinutes : null',
    );
  });
});

describe("D-194 item 3 (review R5): past 24 hours is neutral on the owner tile", () => {
  // A colour is the stylesheet's; jsdom draws none. The tile's band is checked rendered in
  // ward-clinical-review-fixes.dom.test.tsx.
  it("gives the owner tile's band 3 no danger colour", () => {
    const css = readFileSync(join(WARD_DIR, "delays/waiting-polish.module.css"), "utf8");
    expect(css).toMatch(/\.ownLongest\[data-band="3"\]\s*\{/u);
    expect(css).not.toMatch(/\.ownLongest\[data-band="3"\]\s*\{[^}]*--wf-danger/u);
  });
});
