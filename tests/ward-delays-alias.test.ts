import { describe, expect, it } from "vitest";

import {
  delaysAliasBannerCopy,
  parseDelaysAliasFrom,
} from "@/components/ward-management/delays/delays-alias";

describe("delays alias pedagogy (Wave 4 item 15)", () => {
  it("accepts only the three MERGE 01 bookmark names", () => {
    expect(parseDelaysAliasFrom("queue")).toBe("queue");
    expect(parseDelaysAliasFrom("exceptions")).toBe("exceptions");
    expect(parseDelaysAliasFrom("escalation")).toBe("escalation");
    expect(parseDelaysAliasFrom("transport")).toBeNull();
    expect(parseDelaysAliasFrom(null)).toBeNull();
  });

  it("names the old board in the banner copy", () => {
    expect(delaysAliasBannerCopy("queue")).toContain("Queue");
    expect(delaysAliasBannerCopy("exceptions")).toContain("Exceptions");
    expect(delaysAliasBannerCopy("escalation")).toContain("Escalation");
  });
});
