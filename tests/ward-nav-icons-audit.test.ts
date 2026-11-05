import { describe, expect, it } from "vitest";
import { Bell, DoorOpen, Hourglass, LogOut, MapPin, Siren } from "lucide-react";

import { WARD_NAV_ICONS, WARD_VIEW_ICONS } from "@/components/ward-management/ward-nav-icons";

// Icon audit (3 Nov 2026): one distinct, plain-meaning line icon per menu destination.
describe("menu icons", () => {
  it("gives every destination its own icon, so the icon-only rail never shows two the same", () => {
    const icons = Object.values(WARD_NAV_ICONS);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("keeps the audit's fixes", () => {
    expect(WARD_NAV_ICONS.ed).toBe(Siren);
    expect(WARD_NAV_ICONS.alerts).toBe(Bell);
    expect(WARD_NAV_ICONS.discharges).toBe(DoorOpen);
    expect(WARD_NAV_ICONS.discharges).not.toBe(LogOut);
    expect(WARD_NAV_ICONS.hub).toBe(MapPin);
    expect(WARD_VIEW_ICONS.delays).toBe(Hourglass);
  });
});
