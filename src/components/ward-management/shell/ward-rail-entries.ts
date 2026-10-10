import {
  WARD_COMMAND_HREF,
  WARD_ED_HREF,
  WARD_HOME_HREF,
  WARD_NAV,
  WARD_VIEWS,
  type WardNavItem,
  type WardViewItem,
} from "@/components/ward-management/ward-nav";
import { WARD_NAV_ICONS, WARD_VIEW_ICONS } from "@/components/ward-management/ward-nav-icons";

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
      ["delays", "Delays"],
      ["network", "Network"],
    ],
  },
  {
    label: "Where",
    entries: [
      ["hub", "Places"],
      ["ed", "Emergency"],
      ["wards", "Wards"],
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
    label: "Checks",
    entries: [
      ["governance", "Governance"],
      ["statistics", "Statistics"],
      ["legal-forms", "Legal"],
      ["out-of-area", "Out of area"],
      ["alerts", "Alerts"],
      ["on-call", "On-call"],
    ],
  },
] as const;

export function railEntries(): RailEntry[] {
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
  }));
  const registry = new Map([...views, ...nav].map((entry) => [entry.id, entry]));
  // The rail's Emergency entry opens the statewide ED index rather than the `ed` nav entry's one
  // example department, the same way Wards opens All wards rather than one ward.
  const hrefOverride: Record<string, string> = { ed: WARD_ED_HREF };
  return RAIL_GROUPS.flatMap((group) =>
    group.entries.map(([id, label]) => {
      const entry = registry.get(id)!;
      return { ...entry, label, href: hrefOverride[id] ?? entry.href };
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
