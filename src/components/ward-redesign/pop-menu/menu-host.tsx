"use client";

import { usePathname } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Bell, Clock3, ListChecks, Plus } from "lucide-react";

import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import {
  CHROME_ROLE_LABELS,
  wardTasksAreActionableForRole,
  type WardChromeRole,
} from "@/components/ward-management/ward-chrome-role";
import { WARD_ALERTS_HREF } from "@/components/ward-management/ward-nav";
import { activeActNowItems } from "@/components/ward-management/ward-act-now-items";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

import { openWardDrawer } from "@/components/ward-management/shell/ward-drawer-bus";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import {
  BED_FINDER_MENU_ID as BED_FINDER_ID,
  isActiveRailEntry,
  railEntries,
  roleMenu,
  type RailEntry,
} from "@/components/ward-management/shell/ward-rail-entries";
import { useAccessNavFilter } from "@/components/ward-management/shell/ward-access";
import { useWardFeatureFlagCheck } from "@/components/ward-management/shell/ward-feature-flag-store";
import { isPhoneDesktopOnlyPath } from "@/components/ward-management/shell/ward-phone-desktop-only";
import { useDeskRoleLabel } from "@/components/ward-management/shell/ward-access-store";
import { countIn } from "@/components/ward-management/shell/ward-phone-menu-parts";
import { PhoneMenuSheetsMock } from "./menu-sheets";

/**
 * Mock-up fork of `shell/ward-phone-menu.tsx`: the menu's model (who, Needs you, the role's groups)
 * exactly as the app works it out, with the dock left out (the real bar still draws it) and the
 * sheets opened on load. The sheets themselves are the fork in `menu-sheets.tsx`.
 *
 * Original note: Phone menu (Josh, 10 Oct 2026, locked from the phone header and navigation mockups, set 9 with
 * the set 10 "Rise" plus). PHONE ONLY: the bar mounts it, and the rail's own sheet stays the menu
 * above 48rem, so desktop is unchanged.
 *
 * A tall bottom sheet: who you are working as, a page filter, what needs you, your other places,
 * then every page in the rail's own groups, and More. Nothing is listed twice. Every figure is the
 * rail's own `wardNavCounts` or the shared act-now list, never typed here.
 *
 * Device audit option A (Josh, 11 Oct 2026): the dock (two places for the role, a raised + that
 * rises out of the dock's curved edge, Tasks and Activity) sits on every phone page, not in the
 * Menu's foot. Needs you holds only what is act-now or overdue.
 */

/** A page in the dock: a rail entry id and what the role calls it there. */
type DockPage = { readonly kind: "page"; readonly id: string; readonly label: string };

/**
 * A dock slot right of the +. `queue` is the coordinator's one Alerts queue or, where that is not
 * this desk's, the Tasks drawer (today's behaviour). `alerts` is the Alerts screen, `activity` the
 * Activity drawer and `bed-finder` the Tools bed finder.
 */
type DockSlot =
  | DockPage
  | { readonly kind: "queue" }
  | { readonly kind: "alerts" }
  | { readonly kind: "activity" }
  | { readonly kind: "bed-finder"; readonly label: string };

const page = (id: string, label: string): DockPage => ({ kind: "page", id, label });

type ResolvedDockSlot =
  Exclude<DockSlot, DockPage> | { readonly kind: "page"; readonly entry: RailEntry; readonly label: string };

/**
 * C2 (Josh, 19 Oct 2026): a bottom bar per role. Two places left of the +, two slots right of it.
 * A ward gets My ward, Referrals, +, Alerts, Handover; the other roles in the B1 table get the same
 * idea from their own menu. Alerts and Activity stay two tabs (the merge was only a "could"). The
 * bed coordinator's dock is unchanged. A slot the desk cannot open is left out.
 */
const DOCK: Record<WardChromeRole, { readonly left: readonly DockPage[]; readonly right: readonly DockSlot[] }> = {
  coordinator: {
    left: [page("command", "Home"), page("referrals", "Referrals")],
    right: [{ kind: "queue" }, { kind: "activity" }],
  },
  ward: {
    left: [page("wards", "My ward"), page("referrals", "Referrals")],
    right: [{ kind: "alerts" }, page("handover", "Handover")],
  },
  ed: {
    left: [page("ed", "My ED"), page("referrals", "Referrals")],
    right: [{ kind: "alerts" }, { kind: "bed-finder", label: "Find a bed" }],
  },
  officer: {
    left: [page("officer", "My jobs"), page("alerts", "Alerts")],
    right: [page("on-call", "On-call"), { kind: "activity" }],
  },
  community: {
    left: [page("community", "My team"), page("referrals", "Referrals")],
    right: [{ kind: "alerts" }, { kind: "activity" }],
  },
  bed_manager: {
    left: [page("capacity", "Capacity"), page("wards", "Wards")],
    right: [{ kind: "alerts" }, page("handover", "Handover")],
  },
  executive: {
    left: [page("command", "Home"), page("statistics", "Statistics")],
    right: [{ kind: "queue" }, { kind: "activity" }],
  },
};

/** Counted pages that are work waiting on someone. Capacity counts free beds, so it is not here. */
/** Pages whose count joins Needs you, only while it is urgent (overdue). */
const OVERDUE_NEED_IDS = ["delays", "discharges"] as const;

export type CountMap = ReturnType<typeof useWardNavCounts>["counts"];
export type DrawerId = "tasks" | "activity" | "tools";

/** What the menu lists, for this role and these counts. Pure, so the sheet only renders it. */
function phoneMenuModel(
  role: WardChromeRole,
  counts: CountMap,
  dockRole: WardChromeRole = role,
  flagOn?: Parameters<typeof railEntries>[0],
  accessNav: (entries: readonly RailEntry[]) => RailEntry[] = (entries) => [...entries],
  roleLabel: string = CHROME_ROLE_LABELS[role],
) {
  // A page that needs a larger screen (the bed meeting TV view) is not offered on a phone at all.
  // Role access plan: only the screens the desk's role may open.
  const entries = accessNav(railEntries(flagOn)).filter((entry) => !isPhoneDesktopOnlyPath(entry.href));
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const resolve = (slot: DockSlot): ResolvedDockSlot[] => {
    // The Alerts tab only for a desk that may open the Alerts screen (role access plan).
    if (slot.kind === "alerts") return byId.has("alerts") ? [slot] : [];
    if (slot.kind !== "page") return [slot];
    const entry = byId.get(slot.id);
    return entry ? [{ kind: "page", entry, label: slot.label }] : [];
  };
  const dock = DOCK[dockRole].left.flatMap(resolve);
  const dockRight = DOCK[dockRole].right.flatMap(resolve);
  const needs = strictNeeds(byId, counts);
  // Nothing twice: a page in the dock or under Needs you leaves its group, and New referral is the +.
  const shown = new Set([
    "referral-intake",
    ...[...dock, ...dockRight].flatMap((slot) => (slot.kind === "page" ? [slot.entry.id] : [])),
    ...(dockRight.some((slot) => slot.kind === "alerts") ? ["alerts"] : []),
    ...(dockRight.some((slot) => slot.kind === "bed-finder") ? [BED_FINDER_ID] : []),
    ...needs.flatMap((need) => (need.entryId ? [need.entryId] : [])),
  ]);
  // B1 (Josh, 19 Oct 2026): the role's own menu first, then everything else in the rail's groups.
  const menu = roleMenu(entries, role);
  const main = menu.main.filter((item) => !shown.has(item.id));
  const groups = [
    { label: roleLabel, entries: main },
    ...menu.more.map((group) => ({ ...group, entries: group.entries.filter((entry) => !shown.has(entry.id)) })),
  ].filter((group) => group.entries.length > 0);
  return { entries, byId, dock, dockRight, needs, groups };
}

/**
 * Needs you (device audit option A, 11 Oct 2026) holds only what is act-now or overdue. The first
 * row is the act-now tasks: the same red rows Tasks leads with (`activeActNowItems`), which the
 * notifier and phone push also read. Home's "Overdue" counts queue referrals past their wait, a
 * different thing, so this row keeps its own noun. Then Waiting's severe causes (its count's `need`,
 * so Waiting also keeps its own row and badge) and Discharges while its count is urgent. Movements'
 * "still open" and Referrals' "awaiting a decision" stay in their groups.
 */
export type NeedRow = {
  id: string;
  /** The rail entry this row stands for, so it leaves its group. */
  entryId?: string;
  label: string;
  meta: string;
  count: number;
  /** A page to open, or the Tasks drawer when absent. */
  href?: string;
  icon: typeof Plus;
  actNow: boolean;
};

function strictNeeds(byId: ReadonlyMap<string, RailEntry>, counts: CountMap): NeedRow[] {
  const rows: NeedRow[] = [];
  for (const id of OVERDUE_NEED_IDS) {
    const entry = byId.get(id);
    const count = countIn(counts, id);
    // A badge that leads with its screen's own figure carries the act-on figure as `need`
    // (Waiting: the severe causes); otherwise the badge itself is the figure while it is urgent.
    const need = count?.need ?? (count?.urgent ? count : undefined);
    if (entry && need && need.value > 0) {
      rows.push({
        id,
        // A `need` is a different figure from the badge, so the page keeps its own row and badge.
        entryId: count?.need ? undefined : id,
        // Audit 6 (Josh, 20 Oct 2026): Waiting's severe causes are "At a time limit", so the menu
        // no longer shows two rows called Waiting with different numbers.
        label: id === "delays" && count?.need ? "At a time limit" : entry.label,
        // Mock-up: the meta names the noun, not where the rows sit; a time limit takes the clock.
        meta: id === "delays" && count?.need ? "people in Waiting" : need.noun,
        count: need.value,
        // shell-9: Delays opens filtered to the severe causes this row counts.
        href: id === "delays" ? `${entry.href}?show=severe` : entry.href,
        icon: id === "delays" && count?.need ? Clock3 : entry.icon,
        actNow: false,
      });
    }
  }
  return rows;
}

function actNowNeed(actNow: number, oneAlertsQueue: boolean): NeedRow[] {
  if (actNow <= 0) return [];
  // One Alerts queue: the row names Alerts and opens the Alerts screen, as the dock tab does.
  return oneAlertsQueue
    ? [
        {
          id: "act-now",
          label: "Act-now alerts",
          meta: "to act on in Alerts",
          count: actNow,
          href: WARD_ALERTS_HREF,
          icon: Bell,
          actNow: true,
        },
      ]
    : [
        {
          id: "act-now",
          label: "Act-now tasks",
          meta: "to act on in Tasks",
          count: actNow,
          icon: ListChecks,
          actNow: true,
        },
      ];
}

function announceGo(pathname: string, entry: RailEntry) {
  const active = isActiveRailEntry(pathname, entry);
  announceToWardShell(active ? `${entry.label}. This is the screen you are on.` : `${entry.label}.`);
}

export type PhoneMenuModel = ReturnType<typeof phoneMenuModel>;

export function PhoneMenuMock({ initial }: { initial: "menu" | "create" }) {
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const onOpenDrawer = (id: DrawerId) => openWardDrawer(id);
  const onNewReferral = () => openWardDrawer("referral");
  const pathname = usePathname() ?? "";
  const { counts, shellRole } = useWardNavCounts();
  const deskRoleLabel = useDeskRoleLabel(shellRole);
  // Mock-up: opened on load; the bar's own Menu and + still open the real sheets.
  const [open, setOpen] = useState(initial === "menu");
  const [createOpen, setCreateOpen] = useState(initial === "create");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [query, setQuery] = useState("");
  // One order for the signed-in person (device audit, 11 Oct 2026), as the desktop rail.
  // Q162 (Josh, 1 Nov 2026): each person keeps their own dock on every page, Transport included.
  // A signed-in transport officer still gets the officer's dock (A4-15), from their own role.
  const dockRole = shellRole;
  const flagOn = useWardFeatureFlagCheck();
  const accessNav = useAccessNavFilter();
  const {
    entries,
    byId,
    dockRight,
    needs: overdueNeeds,
    groups,
  } = phoneMenuModel(shellRole, counts, dockRole, flagOn, accessNav, deskRoleLabel);
  // Act-now tasks are the signed-in person's, gated as the bar's Tasks list is (`shellRole`).
  const {
    movements,
    units,
    configuration,
    inboxSnoozes,
    leaveBeds,
    admissions,
    patients,
    referrals,
    supportNotifications,
    plannedAdmissions,
    now: flowNow,
  } = useWardFlowSelect(
    "movements",
    "units",
    "configuration",
    "inboxSnoozes",
    "leaveBeds",
    "admissions",
    "patients",
    "referrals",
    "supportNotifications",
    "plannedAdmissions",
    "now",
  );
  // `useWardFlowSelect` returns a new object each render, so the memo lists the fields it reads, not
  // that object: typing in the menu search must not recount the act-now tasks.
  const actNowCount = useMemo(
    () =>
      wardTasksAreActionableForRole(shellRole)
        ? activeActNowItems(
            {
              movements,
              units,
              configuration,
              inboxSnoozes,
              leaveBeds,
              admissions,
              patients,
              referrals,
              supportNotifications,
              plannedAdmissions,
              // The bar's shape exactly, so this reuses the bar's task list instead of building its own
              // on every page load (F-11). The wording setting changes no act-now row.
              stuckHandoverMinutes: configuration.transportBookedTargetMinutes,
            },
            flowNow,
          ).length
        : 0,
    [
      shellRole,
      movements,
      units,
      configuration,
      inboxSnoozes,
      leaveBeds,
      admissions,
      patients,
      referrals,
      supportNotifications,
      plannedAdmissions,
      flowNow,
    ],
  );
  // One Alerts queue only for the bed coordinator's desk (whose list it is, as the act-now count
  // above) when its role may open the Alerts screen. Others keep the Tasks drawer.
  const oneAlertsQueue =
    wardTasksAreActionableForRole(shellRole) &&
    accessNav([{ id: "alerts", href: WARD_ALERTS_HREF, label: "Alerts" }]).length > 0;
  const needs = [...actNowNeed(actNowCount, oneAlertsQueue), ...overdueNeeds];
  // Nothing twice: with one Alerts queue the dock always carries Alerts, so it leaves its group.
  const menuGroups =
    oneAlertsQueue && dockRight.some((slot) => slot.kind === "queue")
      ? groups
          .map((group) => ({ ...group, entries: group.entries.filter((entry) => entry.id !== "alerts") }))
          .filter((group) => group.entries.length > 0)
      : groups;

  const close = () => setOpen(false);
  const closeCreate = () => setCreateOpen(false);
  const go = (entry: RailEntry) => {
    announceGo(pathname, entry);
    close();
  };
  const drawer = (id: DrawerId) => {
    close();
    onOpenDrawer(id);
  };
  const refer = () => {
    close();
    onNewReferral();
  };
  return (
    <>
      <PhoneMenuSheetsMock
        open={open}
        onClose={close}
        query={query}
        onQuery={setQuery}
        returnFocusRef={returnFocusRef}
        shellRole={shellRole}
        pathname={pathname}
        counts={counts}
        entries={entries}
        byId={byId}
        needs={needs}
        groups={menuGroups}
        onGo={go}
        onRefer={refer}
        onDrawer={drawer}
        switcherOpen={switcherOpen}
        onSwitch={() => {
          close();
          setSwitcherOpen(true);
        }}
        onCloseSwitcher={() => setSwitcherOpen(false)}
        createOpen={createOpen}
        onCloseCreate={closeCreate}
        onNewReferral={onNewReferral}
      />
    </>
  );
}
