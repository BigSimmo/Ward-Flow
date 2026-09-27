import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NO TYPED PATIENT ROWS IN THE STRANDED DELAYED EGRESS TABLE.
 *
 * Owner's standing rule: a Ward Flow screen may show only what the records hold, "Not recorded",
 * a clearly labelled target, or content labelled illustrative — never an invented person, count or
 * figure. Until the 25 September 2026 audit (finding A1), `handover-page.tsx`'s "Stranded Delayed
 * Egress Bottlenecks" table typed six rows of invented patients (Arthur Pendelton, Cheryl Thorne,
 * Gavin MacIntyre, Margaret O'Connor, Tariq Al-Mansoor, Evelyn Vance), each under a real seeded
 * UMRN that belongs to a DIFFERENT seeded patient — e.g. UM100014 is Rowena Kestrel
 * (`ward-patients-seed.ts`), not Arthur Pendelton. This is the same class of defect A1 had
 * already found and fixed once in this file for `resolveMovementPatient` (see that function's own
 * doc comment): a typed name table that wins over the record.
 *
 * The table now derives every row from occupied admissions with a recorded hold (`blockReason`), through
 * `resolveAdmissionPatient` (the same resolver discipline as `resolveMovementPatient`), so none of
 * the old invented names or UMRNs can appear as literal source text again. This guard is a plain
 * text scan, not an AST walk, exactly as asked: whitespace is collapsed first so a name or UMRN
 * split across lines by Prettier still matches.
 */

const HANDOVER_PAGE = resolve(process.cwd(), "src/components/ward-management/handover/handover-page.tsx");

/** The six people the old table invented. `O'Connor` matches either a literal apostrophe or the
 *  `&apos;` entity the JSX actually used, so the guard still catches a verbatim copy-back of the
 *  old row. */
const INVENTED_PATIENTS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "Arthur Pendelton", pattern: /Arthur Pendelton/ },
  { name: "Cheryl Thorne", pattern: /Cheryl Thorne/ },
  { name: "Gavin MacIntyre", pattern: /Gavin MacIntyre/ },
  { name: "Margaret O'Connor", pattern: /Margaret O(?:'|&apos;)Connor/ },
  { name: "Tariq Al-Mansoor", pattern: /Tariq Al-Mansoor/ },
  { name: "Evelyn Vance", pattern: /Evelyn Vance/ },
];

describe("handover-page.tsx never types a patient row for Stranded Delayed Egress", () => {
  const collapsed = readFileSync(HANDOVER_PAGE, "utf8").replace(/\s+/g, " ");

  it.each(INVENTED_PATIENTS)("never types the invented patient $name", ({ pattern }) => {
    expect(collapsed).not.toMatch(pattern);
  });

  it("never types a UMRN literal (UM followed by six digits) anywhere in the page", () => {
    // The six invented rows each carried one of UM100014/16/27/28/29/31 as bare JSX text. A
    // resolved identity is always read through `identity.umrn` at render time, so no UMRN string
    // in this family should ever appear as a literal in the source again.
    expect(collapsed).not.toMatch(/UM\d{6}/u);
  });
});
