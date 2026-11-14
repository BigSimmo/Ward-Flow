import { describe, expect, it } from "vitest";
import { patientMode } from "@/components/ward-management/patients/patient-mode";
import { waitlistedStayFor } from "@/components/ward-management/patients/patient-open-work";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

// Lead-VM-1: a wait-list stay with no movement is waiting for a bed, as Search and the board say.
describe("wait-list stay on the person page", () => {
  const waitlisted = wardAdmissions.filter((a) => a.state === "waitlisted" && a.patientId && a.movementId == null);

  it("finds the seeded wait-list stays by person", () => {
    expect(waitlisted.length).toBeGreaterThan(0);
    for (const stay of waitlisted) {
      expect(waitlistedStayFor(stay.patientId ?? undefined, wardAdmissions)?.id).toBe(stay.id);
    }
  });

  it("finds nothing for an unknown person or none given", () => {
    expect(waitlistedStayFor("PT-NOBODY", wardAdmissions)).toBeUndefined();
    expect(waitlistedStayFor(undefined, wardAdmissions)).toBeUndefined();
  });

  it("leaves the mode idle: the page words the wait, patientMode still reads no open movement", () => {
    expect(patientMode({ admission: waitlisted[0] })).toBe("idle");
  });
});
