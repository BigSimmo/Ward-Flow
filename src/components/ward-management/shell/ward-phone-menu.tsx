"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ComponentType, type RefObject } from "react";
import { Activity, BedDouble, House, Bell, ListChecks, Plus } from "lucide-react";

import { useMobileKeyboard } from "@/components/ward-management/shell/use-mobile-keyboard";
import { SrOnly } from "@/components/wf";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import {
  CHROME_ROLE_LABELS,
  wardTasksAreActionableForRole,
  type WardChromeRole,
} from "@/components/ward-management/ward-chrome-role";
import { WARD_ALERTS_HREF } from "@/components/ward-management/ward-nav";
import { wardNavCountLabel } from "@/components/ward-management/ward-nav-counts";
import { wardNavRoleRank } from "@/components/ward-management/ward-nav-role-order";
import { activeActNowItems } from "@/components/ward-management/ward-act-now-items";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { preloadWhenIdle } from "../preload-when-idle";

import { isPhoneViewport, subscribeWardMenu } from "./ward-drawer-bus";
import { announceToWardShell } from "./ward-live-region";
import {
  BED_FINDER_MENU_ID as BED_FINDER_ID,
  isActiveRailEntry,
  railEntries,
  roleMenu,
  type RailEntry,
} from "./ward-rail-entries";
import { requestToolsTool } from "../tools/ward-tools-open";
import { useAccessNavFilter } from "./ward-access";
import { useWardFeatureFlagCheck } from "./ward-feature-flag-store";
import { isPhoneDesktopOnlyPath } from "./ward-phone-desktop-only";
import { CountChip, countIn } from "./ward-phone-menu-parts";
import styles from "./ward-phone-menu.module.css";
import pageDock from "./ward-phone-page-dock.module.css";

/**
 * Phone menu (Josh, 10 Oct 2026, locked from the phone header and navigation mockups, set 9 with
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

export type WardPhoneMenuProps = {
  /** The bar's Menu button, where focus returns when the menu closes. */
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  tasksCount: number;
  activityUnread: number;
  /** Opens one of the bar's own drawers once the menu has closed. */
  onOpenDrawer: (id: "tasks" | "activity" | "tools") => void;
  onNewReferral: () => void;
};

export type CountMap = ReturnType<typeof useWardNavCounts>["counts"];
export type DrawerId = "tasks" | "activity" | "tools";

/** What the menu lists, for this role and these counts. Pure, so the sheet only renders it. */
function phoneMenuModel(
  role: WardChromeRole,
  counts: CountMap,
  dockRole: WardChromeRole = role,
  flagOn?: Parameters<typeof railEntries>[0],
  accessNav: (entries: readonly RailEntry[]) => RailEntry[] = (entries) => [...entries],
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
  const rank = (id: string) => wardNavRoleRank(role, id) ?? Number.MAX_SAFE_INTEGER;
  // B1 (Josh, 19 Oct 2026): the role's own menu first, then everything else in the rail's groups.
  const menu = roleMenu(entries, role, rank);
  const main = menu.main.filter((item) => !shown.has(item.id));
  const groups = [
    { label: CHROME_ROLE_LABELS[role], entries: main },
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
        label: entry.label,
        meta: need.noun,
        count: need.value,
        // shell-9: Delays opens filtered to the severe causes this row counts.
        href: id === "delays" ? `${entry.href}?show=severe` : entry.href,
        icon: entry.icon,
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
          meta: "red rows in Alerts",
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
          meta: "red rows in Tasks",
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

/**
 * F-19 (WCAG 2.5.3): the name comes from the visible label plus a screen-reader-only tail, so it
 * starts with the word on screen ("Referrals, 7 awaiting a decision") and voice control can say it.
 * No aria-label: the visible count chip is hidden from the name and repeated in the tail.
 */
function dockTail(label: string, value: number | undefined, detail: string, plain: string): string {
  if (value) return `, ${value > 99 ? "99+" : value} ${detail}`;
  return plain.startsWith(label) ? plain.slice(label.length) : "";
}

function DockFace({
  icon: Icon,
  label,
  count,
  tail,
}: {
  icon: typeof Plus;
  label: string;
  count: number | undefined;
  tail: string;
}) {
  return (
    <>
      <span className={styles.dockIcon} aria-hidden="true">
        <Icon aria-hidden="true" strokeWidth={1.75} />
        <CountChip value={count} className={styles.dockCount} />
      </span>
      <span className={styles.dockLabel}>{label}</span>
      {tail ? <SrOnly>{tail}</SrOnly> : null}
    </>
  );
}

function PhoneDock({
  places,
  right,
  counts,
  pathname,
  tasksCount,
  activityUnread,
  oneAlertsQueue,
  onGo,
  onCreate,
  onDrawer,
}: {
  places: ResolvedDockSlot[];
  /** C2: the two slots right of the +, per role. */
  right: ResolvedDockSlot[];
  counts: CountMap;
  pathname: string;
  tasksCount: number;
  /** One Alerts queue: the Tasks tab is the Alerts tab and opens the Alerts screen. */
  oneAlertsQueue: boolean;
  activityUnread: number;
  onGo: (entry: RailEntry) => void;
  onCreate: () => void;
  onDrawer: (id: DrawerId) => void;
}) {
  const alertsLink = (count: number | undefined) => (
    <Link
      key="alerts"
      href={WARD_ALERTS_HREF}
      className={styles.dockItem}
      aria-current={pathname.replace(/\/+$/u, "") === WARD_ALERTS_HREF ? "page" : undefined}
      data-testid="ward-phone-menu-alerts"
      onClick={() => announceToWardShell("Alerts.")}
    >
      <DockFace
        icon={Bell}
        label="Alerts"
        count={count}
        tail={count === undefined ? "" : dockTail("Alerts", count, "outstanding", `Alerts, ${count} outstanding`)}
      />
    </Link>
  );
  const slot = (item: ResolvedDockSlot) => {
    switch (item.kind) {
      case "page": {
        const { entry, label } = item;
        const count = countIn(counts, entry.id);
        return (
          <Link
            key={entry.id}
            href={entry.href}
            className={styles.dockItem}
            aria-current={isActiveRailEntry(pathname, entry) ? "page" : undefined}
            data-testid="ward-phone-dock-link"
            onClick={() => onGo(entry)}
          >
            {/* Home is the house in the dock (v10 phone mockup); the rail keeps its own icon. */}
            <DockFace
              icon={entry.id === "command" ? House : entry.icon}
              label={label}
              count={count?.value}
              tail={dockTail(label, count?.value, count?.noun ?? "", wardNavCountLabel(label, count))}
            />
          </Link>
        );
      }
      case "queue":
        return oneAlertsQueue ? (
          alertsLink(tasksCount)
        ) : (
          <button
            key="tasks"
            type="button"
            className={styles.dockItem}
            aria-haspopup="dialog"
            data-testid="ward-phone-menu-tasks"
            onClick={() => onDrawer("tasks")}
          >
            <DockFace
              icon={ListChecks}
              label="Tasks"
              count={tasksCount}
              tail={dockTail("Tasks", tasksCount, "outstanding", `Tasks, ${tasksCount} outstanding`)}
            />
          </button>
        );
      case "alerts":
        // The desk's own Alerts screen. The count is the coordinator's queue, so it is not shown here.
        return alertsLink(undefined);
      case "activity":
        return (
          <button
            key="activity"
            type="button"
            className={styles.dockItem}
            aria-haspopup="dialog"
            data-testid="ward-phone-menu-activity"
            onClick={() => onDrawer("activity")}
          >
            <DockFace
              icon={Activity}
              label="Activity"
              count={activityUnread}
              tail={dockTail("Activity", activityUnread, "unread", "Activity")}
            />
          </button>
        );
      case "bed-finder":
        return (
          <button
            key="bed-finder"
            type="button"
            className={styles.dockItem}
            aria-haspopup="dialog"
            data-testid="ward-phone-dock-bed-finder"
            onClick={(event) => {
              requestToolsTool("bed-finder", event.currentTarget);
              announceToWardShell(`${item.label}.`);
            }}
          >
            <DockFace icon={BedDouble} label={item.label} count={undefined} tail="" />
          </button>
        );
    }
  };
  return (
    <nav className={styles.dock} aria-label="Quick open" data-testid="ward-phone-dock">
      {places.map(slot)}
      <span className={styles.riseSlot}>
        <button
          type="button"
          className={styles.rise}
          aria-label="Create: new referral, delay, bed or patient"
          aria-haspopup="dialog"
          data-testid="ward-phone-create"
          onClick={onCreate}
        >
          <Plus aria-hidden="true" strokeWidth={2} />
        </button>
      </span>
      {right.map(slot)}
    </nav>
  );
}

export type PhoneMenuModel = ReturnType<typeof phoneMenuModel>;

/**
 * The Menu and Create sheets (their rows, search and More) are their own chunk, so a phone's first
 * load carries only the dock. They load once the browser is idle, so a tap normally finds them
 * already there. A failed load (offline before the code arrived) retries each time the menu opens.
 */
const loadMenuSheets = () => import("./ward-phone-menu-sheet");
type PhoneMenuSheetsProps = ComponentProps<(typeof import("./ward-phone-menu-sheet"))["PhoneMenuSheets"]>;
const PhoneMenuSheets = dynamic(
  () =>
    loadMenuSheets().then(
      (m) => m.PhoneMenuSheets,
      () => PhoneMenuSheetsRetry,
    ),
  { ssr: false },
);
preloadWhenIdle(loadMenuSheets);

function PhoneMenuSheetsRetry(props: PhoneMenuSheetsProps) {
  const [Sheets, setSheets] = useState<ComponentType<PhoneMenuSheetsProps> | null>(null);
  const opened = props.open || props.createOpen || props.switcherOpen;
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    if (Sheets || !opened) return;
    let live = true;
    loadMenuSheets().then(
      (m) => {
        if (live) setSheets(() => m.PhoneMenuSheets);
      },
      () => {
        if (!live) return;
        // Close what was opened, so the next tap is a fresh open that retries the load.
        latest.current.onClose();
        latest.current.onCloseCreate();
        latest.current.onCloseSwitcher();
        announceToWardShell("Menu could not load. Check the connection, then try again.");
      },
    );
    return () => {
      live = false;
    };
  }, [Sheets, opened]);
  return Sheets ? <Sheets {...props} /> : null;
}

export function WardPhoneMenu({
  returnFocusRef,
  tasksCount,
  activityUnread,
  onOpenDrawer,
  onNewReferral,
}: WardPhoneMenuProps) {
  const pathname = usePathname() ?? "";
  const { counts, shellRole, role: routeRole } = useWardNavCounts();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // The sheets mount on the first open, not on page load: mounting the dynamic component would fetch
  // its chunk straight away instead of when the browser is idle.
  const [sheetsMounted, setSheetsMounted] = useState(false);
  if (!sheetsMounted && (open || createOpen || switcherOpen)) setSheetsMounted(true);
  const [query, setQuery] = useState("");
  // F-07: marks <html data-wf-keyboard> so the dock hides and pinned footers lift over the keyboard.
  useMobileKeyboard({ trackState: false });

  useEffect(
    () =>
      subscribeWardMenu(() => {
        // The rail's own sheet answers above 48rem.
        if (!isPhoneViewport()) return;
        setQuery("");
        setOpen(true);
        announceToWardShell("Menu opened.");
      }),
    [],
  );

  // One order for the signed-in person (device audit, 11 Oct 2026), as the desktop rail.
  // The officer's phone is the officer's own (audit round 2, A4-15): on the officer route the dock
  // holds Transport and Movements, not the coordinator's Home and Referrals.
  const dockRole = routeRole === "officer" ? routeRole : shellRole;
  const flagOn = useWardFeatureFlagCheck();
  const accessNav = useAccessNavFilter();
  const {
    entries,
    byId,
    dock,
    dockRight,
    needs: overdueNeeds,
    groups,
  } = phoneMenuModel(shellRole, counts, dockRole, flagOn, accessNav);
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
  const create = () => {
    close();
    setCreateOpen(true);
    announceToWardShell("Create opened.");
  };
  const refer = () => {
    close();
    onNewReferral();
  };
  return (
    <>
      {sheetsMounted ? (
        <PhoneMenuSheets
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
      ) : null}

      {/* The dock on every phone page (device audit option A). Hidden above 48rem by its CSS. */}
      <div className={`${pageDock.pageDock} ${pageDock.rise}`} data-wf-page-dock="rise">
        <PhoneDock
          places={dock}
          right={dockRight}
          counts={counts}
          pathname={pathname}
          tasksCount={tasksCount}
          activityUnread={activityUnread}
          oneAlertsQueue={oneAlertsQueue}
          onGo={(entry) => announceGo(pathname, entry)}
          onCreate={create}
          onDrawer={drawer}
        />
      </div>
    </>
  );
}
