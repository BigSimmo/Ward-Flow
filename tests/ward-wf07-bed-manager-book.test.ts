/**
 * WF-07: site bed manager booking with valid initials "TH" must not be refused for initials.
 * Live report claimed HTTP 422 for TH — not reproduced as a normalise/server-rule bug; guard the
 * shared rule and the bed_manager role allow-list.
 */
import { describe, expect, it } from "vitest";

import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import {
  normalisePlannedAdmissionInitials,
  plannedInitialsRefusal,
} from "@/components/ward-management/ward-admissions";

describe("WF-07 bed manager BOOK_PLANNED_ADMISSION initials", () => {
  it("lets bed_manager take BOOK_PLANNED_ADMISSION", () => {
    expect(EVENT_ROLE.BOOK_PLANNED_ADMISSION).toContain("bed_manager");
  });

  it("accepts TH / t.h. and refuses TH2 with a digit-named message", () => {
    expect(normalisePlannedAdmissionInitials("TH")).toBe("TH");
    expect(normalisePlannedAdmissionInitials("t.h.")).toBe("TH");
    expect(normalisePlannedAdmissionInitials("TH2")).toBeNull();
    expect(plannedInitialsRefusal("TH2")).toMatch(/number/i);
  });
});
