import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NO INVENTED WARD-SCREEN LOG CLAIMS (Josh's ruling, 26 Sept 2026: "go ahead with all your
 * recommendations").
 *
 * The ward screen's Decisions tab and ward log used to state things no record in this prototype
 * actually holds: a specific Mental Health Act form number for a leave bed nobody records ("Form
 * 2A/2B"), a notification to Environmental Services and to the Statewide Bed Bureau that never
 * happens, a "Statutory Protection Invariant" label asserting the WA Mental Health Act 2014 as the
 * source of a UI note, a "Live Clinical Feed" heading over what is really a static ledger, and a
 * typed "Day Shift commenced … verified by Nurse Unit Manager" line built from no event at all.
 * Josh's ruling: a screen may show only what the records hold, "Not recorded", clearly labelled
 * targets, or content labelled illustrative — never an invented form number, notification, or
 * typed-in log entry standing in for one.
 *
 * This is a plain text scan of the one file these claims lived in, not a structural parser or a
 * repository-wide sweep: it exists to stop these exact phrases from silently coming back into
 * `ward-screen.tsx`, not to catch every rephrasing of the same claim or every other file. See that
 * file's own diff (26 Sept 2026) for the corrected wording beside each one.
 */

const WARD_SCREEN_FILE = resolve(process.cwd(), "src/components/ward-management/ward/ward-screen.tsx");

const FORBIDDEN = [
  "Form 2A",
  "Environmental Services notified",
  "Statewide Bed Bureau",
  "Live Clinical Feed",
  "Statutory Protection Invariant",
  "Day Shift commenced",
  // Review, 26 Sept 2026: a second Bureau claim was split across two source lines, and the leave
  // panel promised "zero identifying medical details" although each record names a stay.
  "Bed Bureau",
  "zero identifying medical details",
  "Authorised patient leave",
  "Real-time bed distribution",
  "Live Capacity Distribution",
];

describe("ward screen carries no invented log claim", () => {
  // Whitespace is collapsed first, so a phrase wrapped across two source lines is still found.
  const source = readFileSync(WARD_SCREEN_FILE, "utf8").replace(/\s+/gu, " ");

  it("reads a plausible file, not an empty one (floors the denominator below)", () => {
    expect(source.length).toBeGreaterThan(1000);
  });

  for (const phrase of FORBIDDEN) {
    it(`never contains ${JSON.stringify(phrase)}`, () => {
      expect(source).not.toContain(phrase);
    });
  }
});
