import { describe, expect, it } from "vitest";
import { referralAgeBand, YOUTH_UP_TO_24_NOTE } from "@/components/ward-management/referrals/referral-age-band";

// Finding 36 (Josh, 27 Oct 2026): the referral age band is prefilled from the date of birth,
// read against the demo day. Synthetic dates only.
const DEMO_DAY = new Date("2026-08-15T12:00:00+08:00");

describe("referralAgeBand", () => {
  it("reads under 18 as Youth, with no note", () => {
    expect(referralAgeBand("2008-08-16", DEMO_DAY)).toEqual({ band: "Youth" });
  });

  it("reads 18 to 24 as Adult, with the youth service note", () => {
    expect(referralAgeBand("2008-08-15", DEMO_DAY)).toEqual({ band: "Adult", note: YOUTH_UP_TO_24_NOTE });
    expect(referralAgeBand("2001-08-16", DEMO_DAY)).toEqual({ band: "Adult", note: YOUTH_UP_TO_24_NOTE });
    expect(YOUTH_UP_TO_24_NOTE).toBe("Youth service may accept up to 24");
  });

  it("reads 25 to 64 as Adult, with no note", () => {
    expect(referralAgeBand("2001-08-15", DEMO_DAY)).toEqual({ band: "Adult" });
    expect(referralAgeBand("1961-08-16", DEMO_DAY)).toEqual({ band: "Adult" });
  });

  it("reads 65 and over as Older adult", () => {
    expect(referralAgeBand("1961-08-15", DEMO_DAY)).toEqual({ band: "Older adult" });
  });

  it("gives no band when the record holds no usable date of birth", () => {
    expect(referralAgeBand(undefined, DEMO_DAY)).toBeNull();
    expect(referralAgeBand("", DEMO_DAY)).toBeNull();
    expect(referralAgeBand("not a date", DEMO_DAY)).toBeNull();
    expect(referralAgeBand("2030-01-01", DEMO_DAY)).toBeNull();
  });
});
