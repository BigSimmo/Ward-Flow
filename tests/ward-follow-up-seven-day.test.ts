// Top 25 item 11 (`top25-follow-up-7day`): every discharge shows whether follow up within the
// window is arranged, with extra items on an active community treatment order. Warns, never blocks.

import { describe, expect, it } from "vitest";

import { followUpWithinWindowCheck } from "../src/components/ward-management/discharges/discharge-follow-up-check";
import { CLINICAL_VALUES } from "../src/components/ward-management/ward-clinical-values";
import { MINUTES_PER_DAY } from "../src/components/ward-management/ward-clock";
import type { Admission } from "../src/components/ward-management/ward-admissions";

const LEFT = 10_000;
const days = CLINICAL_VALUES.ctoFollowUpWindow.value;

function journey(appointmentAt: number): Admission["careJourney"] {
  return {
    followUp: {
      kind: "follow_up",
      contactId: "cmht" as never,
      serviceId: "svc-1",
      appointmentAt,
      mode: "in_person" as never,
      recordedAt: LEFT,
      recordedBy: "Ward",
      appointmentVersion: 1,
    },
    contacts: [],
  } as unknown as Admission["careJourney"];
}

describe("seven day follow up check (Top 25 item 11)", () => {
  it("uses the shared clinical value for the window", () => {
    expect(days).toBe(7);
  });

  it("warns when nothing is arranged", () => {
    const check = followUpWithinWindowCheck({
      followUp: null,
      careJourney: undefined,
      leftAt: LEFT,
      now: LEFT,
      onCto: false,
    });
    expect(check.status).toBe("not_arranged");
    expect(check.warning).toBe(true);
    expect(check.ctoItems).toBeUndefined();
  });

  it("is satisfied by an appointment inside the window", () => {
    const check = followUpWithinWindowCheck({
      followUp: { state: "arranged", recordedAt: LEFT, recordedBy: "Ward" },
      careJourney: journey(LEFT + 3 * MINUTES_PER_DAY),
      leftAt: LEFT,
      now: LEFT,
      onCto: false,
    });
    expect(check.status).toBe("booked_within");
    expect(check.warning).toBe(false);
  });

  it("warns on an appointment past the window", () => {
    const check = followUpWithinWindowCheck({
      followUp: { state: "arranged", recordedAt: LEFT, recordedBy: "Ward" },
      careJourney: journey(LEFT + (days + 1) * MINUTES_PER_DAY),
      leftAt: LEFT,
      now: LEFT,
      onCto: false,
    });
    expect(check.status).toBe("booked_outside");
    expect(check.warning).toBe(true);
  });

  it("asks for a date when arranged has no appointment time", () => {
    const check = followUpWithinWindowCheck({
      followUp: { state: "arranged", recordedAt: LEFT, recordedBy: "Ward" },
      careJourney: undefined,
      expectedDischargeAt: LEFT,
      now: LEFT,
      onCto: false,
    });
    expect(check.status).toBe("arranged_no_date");
    expect(check.warning).toBe(true);
  });

  it("adds community treatment order items only when an order is active", () => {
    const check = followUpWithinWindowCheck({
      followUp: null,
      careJourney: journey(LEFT + MINUTES_PER_DAY),
      leftAt: LEFT,
      now: LEFT,
      onCto: true,
    });
    expect(check.ctoItems?.map((item) => item.done)).toEqual([true, true, false]);
  });
});
