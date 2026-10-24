import { describe, expect, it } from "vitest";
import {
  DEMO_COMMUNITY_CASELOAD,
  DEMO_COMMUNITY_EGRESS,
} from "@/components/ward-management/community/community-demo-cohort";

describe("community sample time precision", () => {
  it("preserves the half-hour instants recorded in the original synthetic fixture", () => {
    // design/third-edition-mockups/community-team-third-edition.html:
    // same egress row (Today 11:30, Community Step-Down) and caseload rows
    // (Tier 1 High Acuity / RN T. Bradley; Tier 2 Case Management / RN C. Davis).
    expect(DEMO_COMMUNITY_EGRESS.find((row) => row.id === "EGR-03")?.kpiStatusLabel).toBe("Due Today 4:30pm");
    expect(DEMO_COMMUNITY_CASELOAD.find((row) => row.id === "CL-02")?.lastContact).toBe("20 Sep 11:30am (Clinic)");
    expect(DEMO_COMMUNITY_CASELOAD.find((row) => row.id === "CL-04")?.lastContact).toBe("18 Sep 9:30am (Home)");
  });

  it("retains whole hours where the synthetic fixture records whole hours", () => {
    expect(DEMO_COMMUNITY_CASELOAD.find((row) => row.id === "CL-01")?.lastContact).toBe("Yesterday 2pm (Home)");
    expect(DEMO_COMMUNITY_CASELOAD.find((row) => row.id === "CL-03")?.lastContact).toBe("19 Sep 3pm (Telehealth)");
    expect(DEMO_COMMUNITY_CASELOAD.find((row) => row.id === "CL-05")?.lastContact).toBe("17 Sep 4pm (Clinic)");
    expect(DEMO_COMMUNITY_CASELOAD.find((row) => row.id === "CL-06")?.lastContact).toBe("15 Sep 10am (Clinic)");
  });
});
