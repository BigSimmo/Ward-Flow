// Fork of `roleMenu` in src/components/ward-management/shell/ward-rail-entries.ts: the access admin's menu.

import { roleMenu, type RailEntry, type RoleMenu } from "@/components/ward-management/shell/ward-rail-entries";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";

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
  const governance = entries.find((entry) => entry.id === "governance");
  if (!governance || menu.main.some((item) => item.id === governance.id)) return menu;
  return {
    main: [governance, ...menu.main],
    more: menu.more
      .map((group) => ({ ...group, entries: group.entries.filter((entry) => entry.id !== governance.id) }))
      .filter((group) => group.entries.length > 0),
  };
}
