import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * A live page must not cite a fully replaced decision as if it still applied (rules audit, D-107,
 * 9 Nov 2026). Before this check, pages kept citing D-29, D-36 and D-37 as current long after D-70
 * and D-87 replaced them, and agents followed the old rule.
 *
 * Source of truth: the "Status of every entry" table at the top of docs/ward-flow/decisions.md.
 * Only rows marked exactly "Replaced by D-n" count; "Partly replaced" entries still apply in part.
 * A citation is fine when its own sentence says it is history (replaced, removed, withdrawn, once,
 * overruled, superseded, archived) or names the replacing decision, or is a range such as
 * "D-1 to D-81". The sentence may wrap onto the next line; a new sentence there does not count.
 */
const root = join(__dirname, "..");
const decisionsPath = join(root, "docs/ward-flow/decisions.md");

/** Generated indexes, the log itself, archives and dated review records quote old IDs on purpose. */
const SKIP = [
  "docs/history/",
  "docs/design/reviews/",
  "docs/ward-flow/decisions.md",
  "docs/ward-flow/OWNER-RULINGS.md",
  "docs/ward-flow/RULES.md",
];
const HISTORY_WORDS =
  /\b(replac\w*|removed|withdr[ae]wn?|once|overruled|supersed\w*|archiv(?:e|ed|es|ing|al)|retired|former(ly)?|old)\b/iu;

function fullyReplaced(markdown: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const line of markdown.split("\n")) {
    const row = line.match(/^\|\s*\[(D-\d+)\][^|]*\|[^|]*\|\s*([^|]*)\|/u);
    if (!row) continue;
    const status = row[2].trim();
    const whole = status.match(/^Replaced by ((?:D-\d+(?:,\s*)?)+)/u);
    if (whole) out.set(row[1], whole[1].split(/,\s*/u));
  }
  return out;
}

function staleCitations(text: string, replaced: Map<string, string[]>): string[] {
  const hits: string[] = [];
  const lines = text.split("\n");
  const sentenceEnd = /[.!?](?:\s|$)/u;
  lines.forEach((line, index) => {
    const withoutRanges = line.replace(/\bD-\d+\s+to\s+D-\d+\b/gu, "");
    for (const [id, by] of replaced) {
      const at = withoutRanges.search(new RegExp(`\\b${id}\\b(?!\\.\\d|-)`, "u"));
      if (at < 0) continue;
      // The citing sentence: this line, plus the next line's first sentence when this one runs on.
      const next = lines[index + 1] ?? "";
      const runsOn = !sentenceEnd.test(withoutRanges.slice(at));
      const context = runsOn ? `${line} ${next.split(sentenceEnd)[0]}` : line;
      if (HISTORY_WORDS.test(context)) continue;
      if (by.some((newer) => new RegExp(`\\b${newer}\\b`, "u").test(context))) continue;
      hits.push(`${index + 1}: cites ${id} (replaced by ${by.join(", ")})`);
    }
  });
  return hits;
}

function liveDocs(): string[] {
  const files: string[] = [join(root, "AGENTS.md"), join(root, "README.md")];
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      const rel = relative(root, path).split("\\").join("/");
      if (SKIP.some((skip) => rel === skip || rel.startsWith(skip))) continue;
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".md")) files.push(path);
    }
  };
  walk(join(root, "docs"));
  return files;
}

/**
 * D-121 item 5: code, tests and scripts are checked too. Test files that use D-numbers as synthetic
 * inputs to a checker (a temporary decisions.md, a fact marker) are skipped as a whole.
 */
const CODE_FIXTURE_FILES = [
  "tests/decision-log-integrity.test.ts",
  "tests/doc-facts.test.ts",
  "tests/pre-commit-ward-flow-main-guard.test.ts",
  "tests/replaced-decision-citations.test.ts",
  "tests/ward-doc-facts-history.test.ts",
];

/**
 * Wrong "D-37" citations in clinical files another thread owns (patient-chronology.ts:33,
 * patient-chronology-screen.tsx:~139, ward-nav.ts:577 on 10 Nov 2026): fixed in held clinical PR
 * (D-122). Take each entry off once that PR lands. Keyed by file and ID, not line, so edits there do
 * not break this test.
 */
// Paths are relative to the src tree.
const HELD_CLINICAL_FIXES: ReadonlyArray<readonly [string, string]> = [
  ["components/ward-management/reports/patient-chronology-screen.tsx", "D-37"], // fixed in held clinical PR
  ["components/ward-management/reports/patient-chronology.ts", "D-37"], // fixed in held clinical PR
  ["components/ward-management/ward-nav.ts", "D-37"], // fixed in held clinical PR
];

function codeFiles(): string[] {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      if (name === "node_modules") continue;
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(?:[cm]?[jt]sx?|json|css|sh|ps1)$/u.test(name)) files.push(path);
    }
  };
  for (const tree of ["src", "tests", "scripts"]) walk(join(root, tree));
  return files;
}

describe("live docs do not cite a replaced decision as current", () => {
  const replaced = fullyReplaced(readFileSync(decisionsPath, "utf8"));

  it("reads the replaced decisions from the status table", () => {
    expect(replaced.get("D-29")).toEqual(["D-70"]);
    expect(replaced.size).toBeGreaterThan(0);
  });

  it("flags a bare citation and allows a historical one", () => {
    const map = new Map([["D-29", ["D-70"]]]);
    expect(staleCitations("The Act period demo follows D-29.", map)).toHaveLength(1);
    expect(staleCitations("D-70 removed the D-29 demo.", map)).toHaveLength(0);
    expect(staleCitations("Rows D-1 to D-81 were checked.", new Map([["D-1", ["D-27"]]]))).toHaveLength(0);
    expect(staleCitations("The demo follows D-29, which D-70\nreplaced.", map)).toHaveLength(0);
    expect(staleCitations("Follow D-29 for legal forms.\nOld content lives in history.", map)).toHaveLength(1);
  });

  it("finds no stale citation in a live page", () => {
    const problems = liveDocs().flatMap((file) =>
      staleCitations(readFileSync(file, "utf8"), replaced).map((hit) => `${relative(root, file)}:${hit}`),
    );
    expect(problems).toEqual([]);
  });

  it("finds no stale citation in src, tests or scripts (D-121 item 5)", () => {
    const problems = codeFiles().flatMap((file) => {
      const rel = relative(root, file).split("\\").join("/");
      if (CODE_FIXTURE_FILES.includes(rel)) return [];
      return staleCitations(readFileSync(file, "utf8"), replaced)
        .filter(
          (hit) =>
            !HELD_CLINICAL_FIXES.some(([held, id]) => rel === ["src", held].join("/") && hit.includes(`cites ${id} `)),
        )
        .map((hit) => `${rel}:${hit}`);
    });
    expect(problems).toEqual([]);
  });

  it("keeps each held-clinical exemption in use", () => {
    // Once the held clinical PR lands these files stop citing D-37; a leftover entry would then
    // hide a new wrong citation, so drop the entry as soon as this fails.
    for (const [held, id] of HELD_CLINICAL_FIXES) {
      const hits = staleCitations(readFileSync(join(root, "src", held), "utf8"), replaced);
      expect(
        hits.some((hit) => hit.includes(`cites ${id} `)),
        `src/${held} no longer cites ${id}; remove it from HELD_CLINICAL_FIXES`,
      ).toBe(true);
    }
  });
});
