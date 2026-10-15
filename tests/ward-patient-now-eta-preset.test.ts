import { describe, expect, it } from "vitest";

import { etaPresetText } from "../src/components/ward-management/patients/patient-now-records";

describe("ETA preset text", () => {
  it("writes an ordinary time without a day", () => {
    expect(etaPresetText(600, 15)).toBe("10:15");
    expect(etaPresetText(600, 0)).toBe("10:00");
  });

  it("never writes 24:xx; a preset past midnight says tomorrow", () => {
    expect(etaPresetText(1435, 15)).toBe("00:10 tomorrow");
    expect(etaPresetText(1439, 60)).toBe("00:59 tomorrow");
    expect(etaPresetText(1380, 60)).toBe("00:00 tomorrow");
  });

  it("works on later demo days too", () => {
    expect(etaPresetText(1440 + 600, 15)).toBe("10:15");
    expect(etaPresetText(1440 + 1435, 15)).toBe("00:10 tomorrow");
  });
});
