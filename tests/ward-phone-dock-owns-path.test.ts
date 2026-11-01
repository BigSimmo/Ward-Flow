// Q161 (Josh, 1 Nov 2026): on a page no dock tab owns, the phone bar's Menu lights instead.
import { describe, expect, it } from "vitest";

import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import { WARD_ALERTS_HREF, WARD_HOME_HREF } from "@/components/ward-management/ward-nav";
import { dockOwnsPath, type ResolvedDockSlot } from "@/components/ward-redesign/shell-next/next-phone-menu";

const entries = railEntries();
const entry = (id: string) => {
  const found = entries.find((item) => item.id === id);
  if (!found) throw new Error(`no rail entry ${id}`);
  return found;
};
// The coordinator's dock: Home, Referrals, +, Alerts, Activity.
const coordinatorDock: ResolvedDockSlot[] = [
  { kind: "page", entry: entry("command"), label: "Home" },
  { kind: "page", entry: entry("referrals"), label: "Referrals" },
  { kind: "queue" },
  { kind: "activity" },
];

describe("dockOwnsPath", () => {
  it("is true on a page the dock has a tab for", () => {
    expect(dockOwnsPath(coordinatorDock, WARD_HOME_HREF)).toBe(true);
    expect(dockOwnsPath(coordinatorDock, entry("referrals").href)).toBe(true);
    expect(dockOwnsPath(coordinatorDock, `${WARD_ALERTS_HREF}/`)).toBe(true);
  });

  it("is false on a page the dock has no tab for, so Menu lights", () => {
    expect(dockOwnsPath(coordinatorDock, entry("movements").href)).toBe(false);
    expect(dockOwnsPath(coordinatorDock, entry("discharges").href)).toBe(false);
  });
});
