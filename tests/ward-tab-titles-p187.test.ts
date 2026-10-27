import { describe, expect, it } from "vitest";

import { metadata as homeMetadata } from "@/app/ward-flow/page";
import { generateMetadata as wardMetadata } from "@/app/ward-flow/ward/[unitId]/page";
import { knownWardUnit } from "@/components/ward-management/ward-known-places";

/** P187 (Josh, 27 Oct 2026): tab titles name the page first, then "· Ward Flow". */
describe("P187: tab titles", () => {
  it("names Home", () => {
    expect(homeMetadata.title).toBe("Home · Ward Flow");
  });

  it("names the ward first", async () => {
    const unit = knownWardUnit("dn-rph-acute")!;
    const { title } = await wardMetadata({ params: Promise.resolve({ unitId: unit.id }) });
    expect(title).toBe(`${unit.name} · Ward Flow`);
  });

  it("keeps the not-found title", async () => {
    const { title } = await wardMetadata({ params: Promise.resolve({ unitId: "no-such-ward-2026" }) });
    expect(title).toBe("Ward not found — Ward Flow");
  });
});
