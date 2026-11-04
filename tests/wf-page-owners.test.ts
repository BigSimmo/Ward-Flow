import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PAGE_OWNERS } from "@/components/ward-management/ward-page-owners";

describe("PAGE_OWNERS (kit rule a, 3 Nov 2026)", () => {
  it("names the eight owning pages", () => {
    expect(Object.keys(PAGE_OWNERS).sort()).toEqual(
      ["capacity", "discharges", "home", "movements", "referrals", "transport", "waiting", "wards"].sort(),
    );
  });

  it.each(Object.entries(PAGE_OWNERS))("%s points at a real page under src/app/ward-flow", (_key, owner) => {
    expect(owner.route.startsWith("/ward-flow")).toBe(true);
    const dir = join(process.cwd(), "src/app", ...owner.route.slice(1).split("/"));
    expect(existsSync(join(dir, "page.tsx")), `${owner.route} has no page.tsx`).toBe(true);
  });

  it("gives every page a distinct route and name", () => {
    const owners = Object.values(PAGE_OWNERS);
    expect(new Set(owners.map((owner) => owner.route)).size).toBe(owners.length);
    expect(new Set(owners.map((owner) => owner.name)).size).toBe(owners.length);
  });
});
