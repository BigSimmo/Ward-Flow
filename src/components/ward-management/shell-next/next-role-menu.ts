// Fork of `roleMenu` in src/components/ward-management/shell/ward-rail-entries.ts: the access admin's menu.

import {
  roleMenu,
  type RailEntry,
  type RoleMenu,
  type RoleMenuItemEntry,
} from "@/components/ward-management/shell/ward-rail-entries";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { UserCog } from "lucide-react";

/**
 * The real `roleMenu`, with one approved change (Josh, 30 Oct 2026).
 *
 * ROLE BRANCH (admin): the access admin borrows the executive's chrome, whose own menu (Statistics,
 * Capacity) it may not open, so its rail showed an empty list with Governance waiting under More.
 * Governance, which it may open, now leads its own menu. Everything else stays where `roleMenu` puts it.
 */
export function nextRoleMenu(entries: readonly RailEntry[], role: WardChromeRole, accessAdmin: boolean): RoleMenu {
  const menu = roleMenu(entries, role);
  if (!accessAdmin) return menu;
  // Audit four #30 (D-257: Staff access is the admin's area; D-59: no permission change, the desk can
  // already open Settings): the admin's daily work gets its own rail row, the Settings access tab.
  const staffAccess: RailEntry = {
    id: "staff-access",
    // settingsHref() plus the Staff access tab; written out so the rail adds no facade code.
    href: "/bedchart/settings#access",
    label: "Staff access",
    icon: UserCog,
  };
  const withStaffAccess = (main: readonly RoleMenuItemEntry[]) =>
    main.some((item) => item.id === staffAccess.id) ? [...main] : [...main, staffAccess];
  const governance = entries.find((entry) => entry.id === "governance");
  if (!governance || menu.main.some((item) => item.id === governance.id))
    return { ...menu, main: withStaffAccess(menu.main) };
  return {
    main: withStaffAccess([governance, ...menu.main]),
    more: menu.more
      .map((group) => ({ ...group, entries: group.entries.filter((entry) => entry.id !== governance.id) }))
      .filter((group) => group.entries.length > 0),
  };
}
