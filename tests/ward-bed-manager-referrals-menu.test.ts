import { describe, expect, it } from "vitest";

import { railEntries, roleMenu } from "@/components/ward-management/shell/ward-rail-entries";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { screenDecision, screenForPath, type WardAccess } from "@/components/ward-management/ward-role-access";

// #821 (multi-account test, 26 Oct 2026): the site bed manager reached Referrals only from Waiting.
describe("the site bed manager's menu", () => {
  const { units } = seedWardFlowStateAt(0);
  const access: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: units[0]!.siteCode } };
  const open = railEntries().filter(
    (entry) => screenDecision(access, screenForPath(entry.href), wardPlaceLookup(units)).open,
  );

  it("lists Referrals in its own menu, not only under More", () => {
    const { main, more } = roleMenu(open, "bed_manager");
    expect(main.map((item) => item.label)).toContain("Referrals");
    expect(more.flatMap((group) => group.entries.map((entry) => entry.id))).not.toContain("referrals");
  });
});
