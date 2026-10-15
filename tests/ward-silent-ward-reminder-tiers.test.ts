import { describe, expect, it } from "vitest";

import {
  SILENT_WARD_ANOTHER_WARD_SUGGESTION,
  silentWardReminder,
} from "@/components/ward-management/delays/delays-derivations";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";

// Top 25 item 7 (flag top25-silent-ward): reminders at the two set times, and from the second one a
// suggestion to ask another ward. Reminders only, nothing is reallocated (owner ruling, 15 Oct 2026).
const FIRST = CLINICAL_VALUES.silentWardFirstReminder.value;
const SECOND = CLINICAL_VALUES.silentWardSecondReminder.value;
const SENT = 8 * 60; // 08:00, inside the 07:00 to 15:00 shift.

describe("silent ward reminder tiers", () => {
  it("uses the two clinical values as its tiers", () => {
    expect(silentWardReminder(SENT, SENT + FIRST - 1, { suggestAnotherWard: true })).toBeUndefined();
    expect(silentWardReminder(SENT, SENT + FIRST, { suggestAnotherWard: true })).toContain(
      `Ward silent ${FIRST / 60} hours`,
    );
    expect(silentWardReminder(SENT, SENT + SECOND, { suggestAnotherWard: true })).toContain(
      `Ward silent ${SECOND / 60} hours`,
    );
  });

  it("suggests another ward only from the second reminder, and only with the flag on", () => {
    expect(silentWardReminder(SENT, SENT + FIRST, { suggestAnotherWard: true })).not.toContain(
      SILENT_WARD_ANOTHER_WARD_SUGGESTION,
    );
    expect(silentWardReminder(SENT, SENT + SECOND, { suggestAnotherWard: true })).toContain(
      SILENT_WARD_ANOTHER_WARD_SUGGESTION,
    );
    // Past the end of the shift it still suggests.
    expect(silentWardReminder(SENT, 16 * 60, { suggestAnotherWard: true })).toContain(
      SILENT_WARD_ANOTHER_WARD_SUGGESTION,
    );
    // Flag off: exactly the old line.
    expect(silentWardReminder(SENT, SENT + SECOND)).toBe(silentWardReminder(SENT, SENT + SECOND, {}));
    expect(silentWardReminder(SENT, SENT + SECOND)).not.toContain(SILENT_WARD_ANOTHER_WARD_SUGGESTION);
  });

  it("is a suggestion in words, not an action", () => {
    expect(SILENT_WARD_ANOTHER_WARD_SUGGESTION).toContain("Nothing is moved automatically");
    expect(SILENT_WARD_ANOTHER_WARD_SUGGESTION).not.toMatch(/[;—→]/);
  });
});
