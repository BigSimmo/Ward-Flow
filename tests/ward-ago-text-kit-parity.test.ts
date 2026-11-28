import { describe, expect, it } from "vitest";

import { agoMinutes, agoText } from "@/components/ward-management/ward-ago-text";
import { durMinutes } from "@/components/wf/format";

// ward-ago-text keeps its own copy of the kit's duration words so the backend engine bundle stays
// inside its redeploy watch paths (backend.test.mjs, audit F-07). The two must read the same.
describe("ago text matches the kit's duration words", () => {
  it.each([60, 61, 75, 119, 300, 1439, 1440, 1500, 3060, 10_000])("%i minutes", (minutes) => {
    expect(agoMinutes(minutes)).toBe(durMinutes(minutes));
    expect(agoText(minutes)).toBe(`${durMinutes(minutes)} ago`);
  });

  it("says under an hour in minutes alone, and just now under a minute", () => {
    expect(agoText(0)).toBe("just now");
    expect(agoText(6)).toBe("6 min ago");
    expect(agoMinutes(0)).toBe("under 1 min");
  });
});
