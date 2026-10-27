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
 * The coordinator's menu reads as the B1 table does (overall review, 20 Oct 2026), led by Home. Josh,
 * 27 Oct 2026: "Home" is back on the desktop rail. Home v7 (22 Oct) had named it "My list" after
 * Home's first tab, and it no longer read as the way home. Only
 * the menu words change; the pages keep their names until B5 and B3 rename them. Waiting moved to
 * More on 20 Oct and came back with All EDs on 27 Oct (Josh). B1's officer
 * "Run sheet" has no screen yet (Movements' Run sheet button is not wired, and Movements is not part
 * of the officer desk), so the officer gets My jobs and Alerts until one is built.
 */
export const BED_FINDER_MENU_ID = "bed-finder";

export type RoleMenuItem = readonly [id: string, label: string];

/**
 * H-0281 (27 Oct 2026): the one menu definition. The desktop rail, its More panel and the phone
 * menu all read it, so a role's menu order lives in one place.
 */
type RoleMenuDefinition = {
  /** The role's own short menu, in order, with the role's labels. */
  main: readonly RoleMenuItem[];
  /**
   * The ids that come first inside each More group, in this order. An id not named keeps its
   * `RAIL_GROUPS` position after the named ones, so this only ever reorders: forgetting an id costs
   * it a good position and nothing else (owner ruling 2026-09-06, "reorder real screens only").
   */
  moreFirst: readonly string[];
};

const ROLE_MENU_DEFINITIONS: Record<WardChromeRole, RoleMenuDefinition> = {
  coordinator: {
    main: [
      // Josh, 27 Oct 2026: the rail's Home button, as it was before Home v7 named it My list.
      ["command", "Home"],
      // Josh, 21 Oct 2026 (UX audit): the rail uses the page's own name, Capacity, now that D-74
      // keeps the current screens and the B5 rename to Beds will not happen.
      ["capacity", "Capacity"],
      ["movements", "Movements"],
      // Josh, 27 Oct 2026: Waiting and All EDs come back to the coordinator's own menu, the delays
      // it chases and who is stuck in which ED, one tap each.
      ["delays", "Waiting"],
      ["ed", "All EDs"],
      ["referrals", "Referrals"],
      ["handover", "Handover"],
    ],
    // The rail's own curated order (owner-approved 2026-09-13).
    moreFirst: [],
  },
  ward: {
    main: [
      ["wards", "My ward"],
      ["movements", "Coming and going"],
      ["referrals", "Referrals to answer"],
      ["handover", "Handover"],
    ],
    // A nurse in charge wants their beds and who is coming to them first, then the other places,
    // then the ward's own daily work: discharges are what frees their beds.
    moreFirst: [
      "capacity",
      "delays",
      "command",
      "ed",
      "hub",
      "community",
      "officer",
      "discharges",
      "search",
      "referral-intake",
      "governance",
      "statistics",
      "out-of-area",
    ],
  },
  ed: {
    main: [
      ["ed", "My ED board"],
      ["referrals", "My referrals"],
      ["referral-intake", "New referral"],
      [BED_FINDER_MENU_ID, "Find a bed"],
    ],
    // An ED is waiting on other people: where its patients have got to and what holds them up come
    // before capacity, which it cannot act on.
    moreFirst: [
      "movements",
      "delays",
      "capacity",
      "command",
      "wards",
      "hub",
      "community",
      "officer",
      "search",
      "handover",
      "discharges",
      "governance",
      "statistics",
      "out-of-area",
    ],
  },
  officer: {
    main: [
      ["officer", "My jobs"],
      ["alerts", "Alerts"],
    ],
    moreFirst: ["command", "delays", "capacity", "movements", "governance"],
  },
  // Not in the B1 table: the same idea, the desk's own place first and its daily work after it.
  community: {
    main: [
      ["community", "My team"],
      ["referrals", "Referrals"],
      ["referral-intake", "New referral"],
    ],
    moreFirst: [],
  },
  bed_manager: {
    main: [
      ["capacity", "Capacity"],
      ["wards", "Wards"],
      ["movements", "Movements"],
      ["delays", "Waiting"],
      // #821 (multi-account test, 26 Oct 2026): its own wards' incoming referrals, read only (D-80),
      // were reachable only from Waiting's "Open Referrals" link.
      ["referrals", "Referrals"],
      ["handover", "Handover"],
    ],
    moreFirst: [],
  },
  executive: { main: [["statistics", "Statistics"]], moreFirst: [] },
};

/** Each role's own short menu, read from `ROLE_MENU_DEFINITIONS`. */
export const ROLE_MENUS = Object.fromEntries(
  Object.entries(ROLE_MENU_DEFINITIONS).map(([role, definition]) => [role, definition.main]),
) as Record<WardChromeRole, readonly RoleMenuItem[]>;

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
 * More. Nothing is dropped: an entry is in exactly one of the two. Each More group puts the role's
 * `moreFirst` ids first, then the rest in their `RAIL_GROUPS` order.
 */
export function roleMenu(entries: readonly RailEntry[], role: WardChromeRole): RoleMenu {
  const { main: mainItems, moreFirst } = ROLE_MENU_DEFINITIONS[role];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const main: RoleMenuItemEntry[] = mainItems.flatMap(([id, label]): RoleMenuItemEntry[] => {
    if (id === BED_FINDER_MENU_ID) return [{ kind: "bed-finder", id: BED_FINDER_MENU_ID, label, icon: BedDouble }];
    const entry = byId.get(id);
    return entry ? [{ ...entry, label }] : [];
  });
  const inMain = new Set(main.map((item) => item.id));
  const rank = (id: string) => {
    const at = moreFirst.indexOf(id);
    return at === -1 ? Number.MAX_SAFE_INTEGER : at;
  };
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
