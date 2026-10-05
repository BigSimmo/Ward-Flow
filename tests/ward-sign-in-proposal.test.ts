import { describe, expect, it } from "vitest";

import { SIGN_IN_PROPOSAL_SHIFTS } from "@/components/ward-flow-sign-in/proposal/sign-in-proposal";
import { SHIFT_PATTERN } from "@/components/ward-management/ward-operational-defaults";

/**
 * The sign-in proposal writes the shift pattern out because its folder imports no ward-management
 * code. The current sign-in screen offers 07:00 to 15:30, 14:30 to 22:30 and 22:00 to 07:30, which
 * no other screen uses; this pins the proposal to the one pattern every screen shares.
 */
describe("sign-in proposal shifts", () => {
  it("match the app's shift pattern exactly", () => {
    expect(SIGN_IN_PROPOSAL_SHIFTS.map(({ startHour, endHour }) => [startHour * 60, endHour * 60])).toEqual(
      SHIFT_PATTERN.map(({ startMinute, endMinute }) => [startMinute, endMinute]),
    );
    for (const shift of SIGN_IN_PROPOSAL_SHIFTS) {
      const pad = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
      expect(shift.hours).toBe(`${pad(shift.startHour)} to ${pad(shift.endHour)}`);
    }
  });
});
