import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * D-39 (Josh, 15 October 2026: "you should have purged all these numberings from the site").
 * Screens name a person by name and UMRN, or say the record kind. A record's own id is never
 * printed as text. This scan catches the plain shapes: `{referral.id}` as a JSX text child, and a
 * visible string such as `Referral ${referral.id}`. Ids in keys, test ids, ids and links are fine.
 */
const ROOT = join(process.cwd(), "src/components/ward-management");

// Statistics screens keep admission ids because they show no patient identity (D-39). A catchment
// answer cites its source document's id, which is not a patient record.
const ALLOWED_DIRS = ["statistics/"];
const ALLOWED_LINES = [/\{answer\.document\.id\}/];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

const RECORD = String.raw`[A-Za-z]+(?:\.[A-Za-z]+)*\.(?:id|referralId|admissionId|movementId|releaseId)`;
const TEXT_CHILD = new RegExp(String.raw`^\s*\{${RECORD}\}\s*$|>\s*\{${RECORD}\}\s*<`);
const LABELLED = new RegExp(String.raw`(?:Referral|Admission|Movement|Release|Patient) \$\{${RECORD}\}`);

describe("record numbers stay off Ward Flow screens (D-39)", () => {
  it("prints no referral, admission, movement or release id as screen text", () => {
    const offending = sourceFiles(ROOT).flatMap((file) => {
      const name = relative(ROOT, file).replaceAll("\\", "/");
      if (ALLOWED_DIRS.some((dir) => name.startsWith(dir))) return [];
      return readFileSync(file, "utf8")
        .split("\n")
        .map((line, index) => ({ line, at: `${name}:${index + 1}` }))
        .filter(
          ({ line }) => (TEXT_CHILD.test(line) || LABELLED.test(line)) && !ALLOWED_LINES.some((ok) => ok.test(line)),
        )
        .map(({ at, line }) => `${at} ${line.trim()}`);
    });
    expect(offending).toEqual([]);
  });
});
