import {
  WARD_COMMAND_HREF,
  WARD_ED_HREF,
  WARD_HOME_HREF,
  WARD_NAV,
  WARD_VIEWS,
  type WardNavItem,
  type WardViewItem,
} from "@/components/ward-management/ward-nav";
import { BedDouble, type LucideIcon } from "lucide-react";

import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { WARD_NAV_ICONS, WARD_VIEW_ICONS } from "@/components/ward-management/ward-nav-icons";
import type { WardFeatureFlag } from "@/components/ward-management/ward-feature-flags";

import { edHref, patientHref } from "./ward-facade";

/**
 * The rail's grouped entries, shared by the desktop rail (`ward-rail.tsx`) and the phone menu
 * (`ward-phone-menu.tsx`), so the two can never list different pages under different names.
 */
export type RailEntry = {
  id: string;
  href: string;
  label: string;
  icon: (typeof WARD_VIEW_ICONS)[keyof typeof WARD_VIEW_ICONS];
  /** Shown only while this feature flag is on. */
  flag?: WardFeatureFlag;
};

// Owner-requested navigation, 2026-09-13. Select presentation entries only;
// the complete route registry and contextual links remain available to the product.
export const RAIL_GROUPS = [
  {
    label: "Today",
    entries: [
      ["command", "Home"],
      ["movements", "Movements"],
      ["capacity", "Capacity"],
      ["delays", "Waiting"],
      // Behind the `bed-meeting-tv` feature flag (15 Oct 2026).
      ["bed-meeting", "Bed meeting TV"],
    ],
  },
  {
    label: "Where",
    entries: [
      ["hub", "Places"],
      // shell-18 (Josh, 13 Oct 2026): one name per page, the same in Menu, header and h1.
      ["ed", "All EDs"],
      ["wards", "All wards"],
      ["community", "Community"],
      ["officer", "Transport"],
    ],
  },
  {
    label: "Work",
    entries: [
      ["search", "Patients"],
      ["referral-intake", "New referral"],
      ["referrals", "Referrals"],
      ["handover", "Handover"],
      ["discharges", "Discharges"],
    ],
  },
  {
    label: "Reports and reference",
    entries: [
      ["governance", "Governance"],
      ["statistics", "Statistics"],
      ["legal-forms", "Legal forms"],
      ["out-of-area", "Out of area"],
      ["alerts", "Alerts"],
      ["on-call", "On-call"],
      // D-72 (21 Oct 2026): seclusion, restraint and incidents, operational only.
      ["seclusion", "Seclusion"],
    ],
  },
] as const;

/**
 * B1 (Josh, 19 Oct 2026): each role's own short menu, in order. Everything else stays one tap away
 * under More, so no page is removed. Ids are rail entry ids, plus `BED_FINDER_MENU_ID`, which opens
 * the Tools bed finder rather than a page. A label here is what the role calls that page; an id the
 * desk cannot open is simply left out (the access filter runs first).
 *
 * The coordinator's menu reads as the B1 table does (overall review, 20 Oct 2026): "Needs you" opens
 * Home, the way the ward desk's "Coming and going" opens Movements. Only
 * the menu words change; the pages keep their names until B5 and B3 rename them. Waiting moves to
 * More with every other page. B1's officer
 * "Run sheet" has no screen yet (Movements' Run sheet button is not wired, and Movements is not part
 * of the officer desk), so the officer gets My jobs and Alerts until one is built.
 */
export const BED_FINDER_MENU_ID = "bed-finder";

export type RoleMenuItem = readonly [id: string, label: string];

export const ROLE_MENUS: Record<WardChromeRole, readonly RoleMenuItem[]> = {
  coordinator: [
    ["command", "Needs you"],
    // Josh, 21 Oct 2026 (UX audit): the rail uses the page's own name, Capacity, now that D-74
    // keeps the current screens and the B5 rename to Beds will not happen.
    ["capacity", "Capacity"],
    ["movements", "Movements"],
    ["referrals", "Referrals"],
    ["handover", "Handover"],
  ],
  ward: [
    ["wards", "My ward"],
    ["movements", "Coming and going"],
    ["referrals", "Referrals to answer"],
    ["handover", "Handover"],
  ],
  ed: [
    ["ed", "My ED board"],
    ["referrals", "My referrals"],
    ["referral-intake", "New referral"],
    [BED_FINDER_MENU_ID, "Find a bed"],
  ],
  officer: [
    ["officer", "My jobs"],
    ["alerts", "Alerts"],
  ],
  // Not in the B1 table: the same idea, the desk's own place first and its daily work after it.
  community: [
    ["community", "My team"],
    ["referrals", "Referrals"],
    ["referral-intake", "New referral"],
  ],
  bed_manager: [
    ["capacity", "Capacity"],
    ["wards", "Wards"],
    ["movements", "Movements"],
    ["delays", "Waiting"],
    ["handover", "Handover"],
  ],
  executive: [["statistics", "Statistics"]],
};

/** A role menu item that opens a tool instead of a page (B1's ED "Find a bed"). */
export type RoleMenuAction = { kind: "bed-finder"; id: typeof BED_FINDER_MENU_ID; label: string; icon: LucideIcon };

export type RoleMenuItemEntry = RailEntry | RoleMenuAction;

export function isRoleMenuAction(item: RoleMenuItemEntry): item is RoleMenuAction {
  return "kind" in item && item.kind === "bed-finder";
}

export type RoleMenu = {
  /** The role's own short menu, in its order, with the role's labels. */
  main: RoleMenuItemEntry[];
  /** Every other page the desk may open, in the rail's groups. */
  more: { label: string; entries: RailEntry[] }[];
};

/**
 * Splits `entries` (already filtered for flags and the desk's access) into the role's own menu and
 * More. Nothing is dropped: an entry is in exactly one of the two. `rank` orders each More group.
 */
export function roleMenu(
  entries: readonly RailEntry[],
  role: WardChromeRole,
  rank: (id: string) => number = () => 0,
): RoleMenu {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const main: RoleMenuItemEntry[] = ROLE_MENUS[role].flatMap(([id, label]): RoleMenuItemEntry[] => {
    if (id === BED_FINDER_MENU_ID) return [{ kind: "bed-finder", id: BED_FINDER_MENU_ID, label, icon: BedDouble }];
    const entry = byId.get(id);
    return entry ? [{ ...entry, label }] : [];
  });
  const inMain = new Set(main.map((item) => item.id));
  const more = RAIL_GROUPS.map((group) => ({
    label: group.label,
    entries: entries
      .filter((entry) => !inMain.has(entry.id) && group.entries.some(([id]) => id === entry.id))
      .toSorted((left, right) => rank(left.id) - rank(right.id)),
  })).filter((group) => group.entries.length > 0);
  return { main, more };
}

/**
 * The rail's entries, without any whose feature flag is off. `flagOn` defaults to every flag on,
 * so a caller that does not know the flags sees the full registry.
 */
export function railEntries(flagOn: (flag: WardFeatureFlag | undefined) => boolean = () => true): RailEntry[] {
  const views: RailEntry[] = WARD_VIEWS.map((item: WardViewItem) => ({
    id: item.id,
    href: item.href,
    label: item.label,
    icon: WARD_VIEW_ICONS[item.id],
  }));
  const nav: RailEntry[] = WARD_NAV.map((item: WardNavItem) => ({
    id: item.id,
    href: item.href,
    label: item.label,
    icon: WARD_NAV_ICONS[item.id],
    ...(item.flag ? { flag: item.flag } : {}),
  }));
  const registry = new Map([...views, ...nav].map((entry) => [entry.id, entry]));
  // The rail's Emergency entry opens the statewide ED index rather than the `ed` nav entry's one
  // example department, the same way Wards opens All wards rather than one ward.
  const hrefOverride: Record<string, string> = { ed: WARD_ED_HREF };
  return RAIL_GROUPS.flatMap((group) =>
    group.entries.flatMap(([id, label]) => {
      const entry = registry.get(id)!;
      return flagOn(entry.flag) ? [{ ...entry, label, href: hrefOverride[id] ?? entry.href }] : [];
    }),
  );
}

function normalizePath(p: string): string {
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

/** Detail routes belong to their hub instead of restoring removed example links. */
const ACTIVE_BEYOND_HREF: Record<string, (norm: string, entryHref: string) => boolean> = {
  command: (norm) => norm === WARD_HOME_HREF || norm === WARD_COMMAND_HREF,
  wards: (norm) => new RegExp(`^${WARD_HOME_HREF}/(ward|board)/`).test(norm),
  ed: (norm) => norm === WARD_ED_HREF || norm.startsWith(edHref("")),
  community: (norm, entryHref) => norm.startsWith(`${entryHref}/`),
  movements: (norm, entryHref) => norm.startsWith(`${entryHref}/`),
  statistics: (norm, entryHref) => norm.startsWith(`${entryHref}/`),
  search: (norm) => norm.startsWith(patientHref("")),
};

export function isActiveRailEntry(pathname: string, entry: RailEntry): boolean {
  const norm = normalizePath(pathname);
  const entryHref = normalizePath(entry.href);
  return norm === entryHref || (ACTIVE_BEYOND_HREF[entry.id]?.(norm, entryHref) ?? false);
}
