// WF-20 / WF-07 (Josh, 5 Nov 2026): a locked step names who owns it; booking initials match the server.
import { describe, expect, it } from "vitest";

import { normalisePlannedAdmissionInitials } from "@/components/ward-management/ward-admissions";
import { roleOwnerHint, withOwnerHint } from "@/components/ward-management/ward-role-permissions";

describe("WF-20 owner hints", () => {
  it("points a site bed manager and ED at the bed coordinator for coordinator-owned steps", () => {
    expect(roleOwnerHint("ed", "PULL_PATIENT")).toBe("Ask the bed coordinator to do this.");
    expect(roleOwnerHint("bed_manager", "PULL_PATIENT")).toBe("Ask the bed coordinator to do this.");
    expect(withOwnerHint("Ward or coordinator only", "ed", "PULL_PATIENT")).toBe(
      "Ward or coordinator only. Ask the bed coordinator to do this.",
    );
  });

  it("says nothing extra when the role may take the step", () => {
    expect(roleOwnerHint("coordinator", "PULL_PATIENT")).toBeUndefined();
    expect(withOwnerHint("x", "coordinator", "PULL_PATIENT")).toBe("x");
  });
});

describe("WF-07 initials rule", () => {
  it("accepts the one to three letters the server accepts", () => {
    expect(normalisePlannedAdmissionInitials("TH")).toBe("TH");
    expect(normalisePlannedAdmissionInitials("t.h.")).toBe("TH");
    expect(normalisePlannedAdmissionInitials("ABCD")).toBeNull();
  });
});
