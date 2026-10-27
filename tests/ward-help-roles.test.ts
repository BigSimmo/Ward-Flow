import { describe, expect, it } from "vitest";
import { ROLE_REFERENCE } from "@/components/ward-management/help/ward-help-roles";
import { DESK_GUIDES } from "@/components/ward-management/help/ward-help-guide";
import { ACCESS_ROLE_LABELS, ROLE_SCREENS } from "@/components/ward-management/ward-role-access";

describe("Help roles reference", () => {
  it("lists every access role once, plus the TV board", () => {
    const ids = ROLE_REFERENCE.map((r) => r.id);
    expect(ids).toEqual([...Object.keys(ROLE_SCREENS), "tv"]);
  });
  it("uses the app labels, with Bed manager in Help only", () => {
    for (const r of ROLE_REFERENCE) {
      if (r.id === "tv") continue;
      const want = r.id === "bed_manager" ? "Bed manager" : ACCESS_ROLE_LABELS[r.id];
      expect(r.name).toBe(want);
      expect(r.summary).toBe(DESK_GUIDES[r.id].summary);
    }
    expect(ACCESS_ROLE_LABELS.bed_manager).toBe("Site bed manager");
    expect(ROLE_REFERENCE.map((r) => r.name)).toEqual(expect.arrayContaining(["Executive", "Access admin", "TV board"]));
  });
});
