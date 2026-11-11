import { describe, expect, it } from "vitest";

import {
  communityFirstContactAt,
  communityFirstContactWords,
} from "@/components/ward-management/discharges/community-first-contact";
import { applyCareChange, emptyCareJourney, type CareJourney } from "@/components/ward-management/ward-care-journey";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";

/*
 * Item 22, community first contact date on the ward's discharge record. Synthetic records only,
 * built with the same `applyCareChange` stamp the store uses for `RECORD_ADMISSION_CARE`.
 */
const DAY = 24 * 60;
const DAY_ZERO = perthMidnight(2026, 10, 10); // Tue 10 Nov 2026, Perth
const APPOINTMENT = 2 * DAY + 9 * 60; // 12 Nov, 09:00

function withFollowUp(): CareJourney {
  return applyCareChange(
    emptyCareJourney(),
    {
      kind: "follow_up",
      contactId: "demo-adult-clinician",
      serviceId: "demo-team",
      appointmentAt: APPOINTMENT,
      mode: "clinic",
    },
    0,
    WARD_FLOW_ROLE_LABELS.ward,
  );
}
const contact = (care: CareJourney, outcome: "completed" | "attempted", contactedAt: number, by: string) =>
  applyCareChange(care, { kind: "contact", outcome, contactedAt }, contactedAt, by);

describe("community first contact date", () => {
  it("is blank until the community team records a contact", () => {
    expect(communityFirstContactAt({})).toBeNull();
    expect(communityFirstContactWords({ careJourney: withFollowUp() }, DAY_ZERO)).toBeNull();
    // An attempt is not a first contact, and a ward's own entry is not the community record.
    let care = contact(withFollowUp(), "attempted", APPOINTMENT - 60, WARD_FLOW_ROLE_LABELS.community);
    care = contact(care, "completed", APPOINTMENT + 30, WARD_FLOW_ROLE_LABELS.ward);
    expect(communityFirstContactWords({ careJourney: care }, DAY_ZERO)).toBeNull();
  });

  it("shows the date the community record holds, the earliest completed contact", () => {
    let care = contact(withFollowUp(), "completed", APPOINTMENT + 15, WARD_FLOW_ROLE_LABELS.community);
    care = contact(care, "completed", APPOINTMENT + 2 * DAY, WARD_FLOW_ROLE_LABELS.community);
    expect(communityFirstContactAt({ careJourney: care })).toBe(care.contacts[0]!.contactedAt);
    expect(communityFirstContactWords({ careJourney: care }, DAY_ZERO)).toBe("Community team first saw them: 12 Nov");
  });

  it("reads a contact saved under the earlier community label", () => {
    const care = contact(withFollowUp(), "completed", APPOINTMENT + 15, "Community service");
    expect(communityFirstContactWords({ careJourney: care }, DAY_ZERO)).toBe("Community team first saw them: 12 Nov");
  });
});
