"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Activity,
  BedDouble,
  BedSingle,
  House,
  Inbox,
  Clock3,
  Bell,
  ListChecks,
  Plus,
  Search,
  Settings,
  Truck,
  UserPlus,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Sheet } from "@/components/wf/sheet";
import { useMobileKeyboard } from "@/components/ward-management/shell/use-mobile-keyboard";
import { Dot, SrOnly } from "@/components/wf";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import {
  CHROME_ROLE_LABELS,
  wardTasksAreActionableForRole,
  type WardChromeRole,
} from "@/components/ward-management/ward-chrome-role";
import { WARD_ADD_PERSON_HREF, WARD_ALERTS_HREF } from "@/components/ward-management/ward-nav";
import { wardNavCountLabel, type WardNavCount } from "@/components/ward-management/ward-nav-counts";
import { wardNavRoleRank } from "@/components/ward-management/ward-nav-role-order";
import { activeActNowItems } from "@/components/ward-management/ward-act-now-items";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { SearchResultItem } from "@/components/ward-management/ward-global-search";
import { preloadWhenIdle } from "../preload-when-idle";
import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal-lazy";

import { useWardDataMode } from "../ward-shared-access";
import { isPhoneViewport, subscribeWardMenu } from "./ward-drawer-bus";
import { officerHref, settingsHref, unitHref } from "./ward-facade";
import { announceToWardShell } from "./ward-live-region";
import {
  BED_FINDER_MENU_ID as BED_FINDER_ID,
  isActiveRailEntry,
  isRoleMenuAction,
  railEntries,
  roleMenu,
  type RailEntry,
  type RoleMenuAction,
} from "./ward-rail-entries";
import { requestToolsTool } from "../tools/ward-tools-open";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { useAccessNavFilter } from "./ward-access";
import { useWardFeatureFlagCheck } from "./ward-feature-flag-store";
import { isPhoneDesktopOnlyPath } from "./ward-phone-desktop-only";
import { Chevron, MenuSearching, type PageRowRender, Section } from "./ward-phone-menu-parts";
import styles from "./ward-phone-menu.module.css";
import actNowStyles from "./ward-phone-menu-act-now.module.css";
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

/**
 * What the + starts. New referral is real; the rest open the page where that work is done.
 * Book transport is left out (audit round 2, A4-10) until a phone booking entry is wired: it opened
 * the officer's job list, which cannot start a booking.
 */
/*
 * shell-5 (13 Oct 2026): the Create items match the + button's name. Add patient joins (transport stays
 * out until a phone booking entry exists, per A4-10);
 * a delay is logged on its patient, so the row says it starts by choosing them. `href` names a page
 * that is not a Menu entry.
 */
const CREATE_LINKS: readonly {
  id: string;
  label: string;
  meta: string;
  icon: LucideIcon;
  href?: string;
  asButton?: boolean;
}[] = [
  { id: "delays", label: "Log a delay", meta: "Choose the patient, then the reason", icon: Clock3 },
  { id: "wards", label: "Update a bed", meta: "Open, close or hold a bed", icon: BedSingle },
  {
    id: "add-patient",
    label: "Add patient",
    meta: "New record with a UMRN",
    icon: UserPlus,
    href: WARD_ADD_PERSON_HREF,
  },
  {
    // The officer page lists existing transport jobs; booking one starts from the placement panel or the
    // community desk, so this row is a way to see the jobs, not to book.
    id: "transport-jobs",
    label: "Transport jobs",
    meta: "See booked transport and its status",
    icon: Truck,
    href: officerHref(),
    asButton: true,
  },
];

export type WardPhoneMenuProps = {
  /** The bar's Menu button, where focus returns when the menu closes. */
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  tasksCount: number;
  activityUnread: number;
  /** Opens one of the bar's own drawers once the menu has closed. */
  onOpenDrawer: (id: "tasks" | "activity" | "tools") => void;
  onNewReferral: () => void;
};

type CountMap = ReturnType<typeof useWardNavCounts>["counts"];
type DrawerId = "tasks" | "activity" | "tools";

function countIn(counts: CountMap, id: string): WardNavCount | undefined {
  return counts[id as keyof CountMap];
}

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
 * different thing, so this row keeps its own noun. Then Delays and Discharges while their count is
 * urgent. Movements' "still open" and Referrals' "awaiting a decision" stay in their groups.
 */
type NeedRow = {
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
    if (entry && count?.urgent && count.value > 0) {
      rows.push({
        id,
        entryId: id,
        label: entry.label,
        meta: count.noun,
        count: count.value,
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

function NeedRowLink({ row, onGo, onTasks }: { row: NeedRow; onGo: () => void; onTasks: () => void }) {
  const face = (
    <>
      <RowBody
        icon={row.icon}
        label={row.label}
        meta={
          <>
            <Dot tone={row.actNow ? "danger" : "warning"} />
            <span>{row.meta}</span>
          </>
        }
      />
      <CountChip value={row.count} className={styles.count} />
      <Chevron />
    </>
  );
  // Site review, 12 Oct 2026: the act-now row takes the approved tint and rounded marker
  // (`ward-phone-menu-act-now.module.css`), not the full red box the shared row rule drew.
  const common = {
    className: row.actNow ? `${styles.row} ${actNowStyles.actNow}` : styles.row,
    "data-act-marker": row.actNow || undefined,
    "aria-label": `${row.label}, ${row.count} ${row.meta}`,
    "data-testid": "ward-phone-menu-need",
  };
  return (
    <li>
      {row.href ? (
        <Link href={row.href} {...common} onClick={onGo}>
          {face}
        </Link>
      ) : (
        <button type="button" {...common} onClick={onTasks}>
          {face}
        </button>
      )}
    </li>
  );
}

function announceGo(pathname: string, entry: RailEntry) {
  const active = isActiveRailEntry(pathname, entry);
  announceToWardShell(active ? `${entry.label}. This is the screen you are on.` : `${entry.label}.`);
}

function CountChip({ value, className }: { value: number | undefined; className: string }) {
  if (!value) return null;
  return (
    <span className={className} aria-hidden="true">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function RowBody({ icon: Icon, label, meta }: { icon: typeof Plus; label: string; meta?: ReactNode }) {
  return (
    <>
      <Icon aria-hidden="true" className={styles.rowIcon} strokeWidth={1.75} />
      <span className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        {meta ? <span className={styles.rowMeta}>{meta}</span> : null}
      </span>
    </>
  );
}

function PageRow({
  entry,
  count,
  withMeta,
  pathname,
  onGo,
  onNewReferral,
}: {
  entry: RailEntry;
  count?: WardNavCount;
  withMeta?: boolean;
  pathname: string;
  onGo: (entry: RailEntry) => void;
  onNewReferral?: () => void;
}) {
  const meta =
    withMeta && count ? (
      <>
        <Dot tone={count.urgent ? "warning" : "neutral"} />
        <span>{count.noun}</span>
      </>
    ) : undefined;
  const face = (
    <>
      <RowBody icon={entry.icon} label={entry.label} meta={meta} />
      <CountChip value={count?.value} className={styles.count} />
      <Chevron />
    </>
  );
  // New referral (found by the filter) opens the slide-out in place, as the + does.
  if (entry.id === "referral-intake" && onNewReferral) {
    return (
      <li>
        <button
          type="button"
          className={styles.row}
          aria-label={wardNavCountLabel(entry.label, count)}
          data-testid="ward-phone-new-referral"
          onClick={onNewReferral}
        >
          {face}
        </button>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={entry.href}
        className={styles.row}
        aria-current={isActiveRailEntry(pathname, entry) ? "page" : undefined}
        aria-label={wardNavCountLabel(entry.label, count)}
        data-testid="ward-rail-link"
        onClick={() => onGo(entry)}
      >
        {face}
      </Link>
    </li>
  );
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

/** B1: a role menu item that opens a tool (the ED's Find a bed opens the Tools bed finder). */
function ActionRow({ action, onClose }: { action: RoleMenuAction; onClose: () => void }) {
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        aria-haspopup="dialog"
        data-testid="ward-phone-menu-bed-finder"
        onClick={(event) => {
          onClose();
          requestToolsTool("bed-finder", event.currentTarget);
          announceToWardShell(`${action.label}.`);
        }}
      >
        <RowBody icon={action.icon} label={action.label} />
        <Chevron />
      </button>
    </li>
  );
}

function MoreSection({ onDrawer, onClose }: { onDrawer: (id: DrawerId) => void; onClose: () => void }) {
  return (
    <section aria-label="More" className={styles.section}>
      <p className={styles.heading}>More</p>
      <ul className={styles.list}>
        <li>
          <button
            type="button"
            className={styles.row}
            data-testid="ward-phone-menu-tools"
            onClick={() => onDrawer("tools")}
          >
            <RowBody icon={Wrench} label="Tools" />
            <Chevron />
          </button>
        </li>
        <li>
          <Link href={settingsHref()} className={styles.row} onClick={onClose}>
            <RowBody icon={Settings} label="Settings" />
            <Chevron />
          </Link>
        </li>
        <DataModeRow onClose={onClose} />
      </ul>
      <p className={styles.note}>
        <Dot tone="neutral" />
        Synthetic prototype, not approved for clinical use
      </p>
    </section>
  );
}

/**
 * The data mode, still reachable on a phone now the header's Prototype pill is desktop only: a
 * quiet row saying which data this is, and the (unavailable) hospital records door. Nothing when
 * the page sits outside `WardSharedAccess`.
 */
function DataModeRow({ onClose }: { onClose: () => void }) {
  const dataMode = useWardDataMode();
  if (!dataMode) return null;
  return (
    <li className={styles.dataMode} data-testid="ward-phone-menu-data-mode">
      <span className={styles.rowText}>
        <span className={styles.rowLabel}>Data mode: Prototype</span>
        <span className={styles.dataModeDetail}>{dataMode.detail}</span>
      </span>
      <button
        type="button"
        className={styles.dataModeButton}
        data-testid="ward-phone-menu-hospital-records"
        onClick={() => {
          onClose();
          dataMode.openHospitalRecords();
        }}
      >
        Hospital records (unavailable)
      </button>
    </li>
  );
}

/**
 * Audit round 2 (S-34): the who-you-are row opens the Go to a desk drawer itself. It used to
 * go to Settings, where a second button opened the same drawer.
 */
function WhoLink({ role, onSwitch }: { role: WardChromeRole; onSwitch: () => void }) {
  return (
    <button
      type="button"
      className={styles.who}
      onClick={onSwitch}
      aria-haspopup="dialog"
      aria-label={`${CHROME_ROLE_LABELS[role]}. Go to a desk`}
      data-testid="ward-phone-menu-switch-workstation"
    >
      {/* v10 Menu sheet: an initials avatar. The prototype has no signed-in person, so the
          initials are the workstation's ("BC" for Bed coordinator), never an invented name. */}
      <span className={`${styles.avatar} ${styles.avatarInitials}`} aria-hidden="true">
        {CHROME_ROLE_LABELS[role]
          .split(/\s+/u)
          .slice(0, 2)
          .map((word) => word[0]?.toUpperCase() ?? "")
          .join("")}
      </span>
      <span className={styles.whoText}>
        <span className={styles.whoName}>{CHROME_ROLE_LABELS[role]}</span>
        {/* shell-2 (Josh, 13 Oct 2026): "Go to a desk", not "Switch workstation". Opening a desk
            goes to that desk's page; the Menu, Needs you and Tasks stay this workstation's own. */}
        <span className={styles.whoMeta}>Go to a desk</span>
      </span>
    </button>
  );
}

function CreateSheet({
  open,
  onClose,
  returnFocusRef,
  byId,
  onNewReferral,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  byId: ReadonlyMap<string, RailEntry>;
  onNewReferral: () => void;
}) {
  // Role access plan: New referral only for a desk whose role may raise one (review on PR #330).
  // The route's own gate too, so with the flag off an officer is not offered a sheet it cannot send.
  const gate = useRoleGate();
  const canRefer = byId.has("referral-intake") && gate("RECEIVE_REFERRAL").allowed;
  const router = useRouter();
  // shell-2: on a ward's own page, Update a bed opens that ward's beds, not the statewide list.
  const currentUnitId = /^\/ward-flow\/(?:ward|board)\/([^/?#]+)/u.exec(usePathname() ?? "")?.[1];
  return (
    <Sheet
      id="ward-phone-create"
      testId="ward-phone-create-sheet"
      open={open}
      onClose={onClose}
      title="Create"
      description="Start something new"
      mobileBreakpoint="phone"
      returnFocusRef={returnFocusRef}
      contentClassName={styles.sheet}
      headerClassName={styles.createHead}
      closeButtonClassName={styles.close}
      bodyClassName={`${styles.body} ${styles.createBody}`}
    >
      {canRefer ? (
        <button
          type="button"
          className={styles.createPrimary}
          data-testid="ward-phone-create-referral"
          onClick={() => {
            onClose();
            onNewReferral();
          }}
        >
          <Inbox aria-hidden="true" strokeWidth={1.75} />
          New referral
        </button>
      ) : null}
      <ul className={`${styles.list} ${styles.rich}`}>
        {CREATE_LINKS.flatMap((item) => {
          const entry = item.href !== undefined ? { href: item.href } : byId.get(item.id);
          return entry
            ? [
                <li key={item.id}>
                  {item.asButton ? (
                    <button
                      type="button"
                      className={styles.row}
                      data-testid={`ward-phone-create-${item.id}`}
                      onClick={() => {
                        onClose();
                        router.push(entry.href);
                        announceToWardShell(`${item.label}: ${item.meta}.`);
                      }}
                    >
                      <RowBody icon={item.icon} label={item.label} meta={<span>{item.meta}</span>} />
                      <Chevron />
                    </button>
                  ) : (
                    <Link
                      href={
                        item.id === "wards" && currentUnitId !== undefined
                          ? unitHref(decodeURIComponent(currentUnitId))
                          : entry.href
                      }
                      className={styles.row}
                      onClick={onClose}
                    >
                      <RowBody icon={item.icon} label={item.label} meta={<span>{item.meta}</span>} />
                      <Chevron />
                    </Link>
                  )}
                </li>,
              ]
            : [];
        })}
      </ul>
    </Sheet>
  );
}

type PhoneMenuModel = ReturnType<typeof phoneMenuModel>;

/**
 * Repo score follow-up (16 October 2026): the menu's search results need the app's whole search
 * engine, which a phone's first load no longer carries. They load once the browser is idle, so a
 * search normally finds them already there, and read "Searching…" until then.
 */
const loadMenuResults = () => import("./ward-phone-menu-results");
type MenuSearchResultsProps = ComponentProps<(typeof import("./ward-phone-menu-results"))["MenuSearchResults"]>;
// A failed load (offline before the code arrived) draws `MenuSearchRetry` in its place rather than
// failing the whole shell.
const MenuSearchResults = dynamic(
  () =>
    loadMenuResults().then(
      (m) => m.MenuSearchResults,
      () => MenuSearchRetry,
    ),
  { ssr: false, loading: () => <MenuSearching /> },
);
preloadWhenIdle(loadMenuResults);

/**
 * Stands in for the results when their code could not load. It tries again on each keystroke and
 * each time the menu opens, and shows the real results once they arrive.
 */
function MenuSearchRetry(props: MenuSearchResultsProps) {
  const [Results, setResults] = useState<ComponentType<MenuSearchResultsProps> | null>(null);
  const [failed, setFailed] = useState(false);
  const retryKey = Results ? "" : props.query;
  useEffect(() => {
    let live = true;
    loadMenuResults().then(
      (m) => {
        if (live) setResults(() => m.MenuSearchResults);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [retryKey]);
  if (Results) return <Results {...props} />;
  if (!failed) return <MenuSearching />;
  return (
    <Section label="Search unavailable">
      <li className={styles.empty}>Search could not load. Check the connection, then type again.</li>
    </Section>
  );
}

function MenuSearch({ query, onQuery }: { query: string; onQuery: (value: string) => void }) {
  return (
    <label className={styles.search}>
      <Search aria-hidden="true" strokeWidth={1.75} />
      <span className="sr-only">Go to a page or patient</span>
      <input
        type="search"
        value={query}
        placeholder="Go to a page or patient"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        enterKeyHint="search"
        onChange={(event) => onQuery(event.target.value)}
        data-testid="ward-phone-menu-search"
      />
    </label>
  );
}

/** With a search typed, the matching pages and records. Without one, Needs you, every page by group, then More. */
function MenuPages({
  query,
  entries,
  needs,
  groups,
  pageRow,
  onResult,
  onDrawer,
  onClose,
}: {
  query: string;
  entries: RailEntry[];
  /** Act-now and overdue rows only (device audit option A). */
  needs: NeedRow[];
  groups: PhoneMenuModel["groups"];
  pageRow: PageRowRender;
  onResult: (item: SearchResultItem) => void;
  onDrawer: (id: DrawerId) => void;
  onClose: () => void;
}) {
  if (query.trim().length > 0) {
    return <MenuSearchResults query={query} entries={entries} pageRow={pageRow} onGo={onResult} />;
  }
  return (
    <>
      <Section label="Needs you" rich>
        {needs.length === 0 ? (
          <li className={styles.empty}>Nothing is act-now or overdue.</li>
        ) : (
          needs.map((row) => <NeedRowLink key={row.id} row={row} onGo={onClose} onTasks={() => onDrawer("tasks")} />)
        )}
      </Section>
      {groups.map((group) => (
        <Section key={group.label} label={group.label}>
          {group.entries.map((entry) =>
            isRoleMenuAction(entry) ? <ActionRow key={entry.id} action={entry} onClose={onClose} /> : pageRow(entry),
          )}
        </Section>
      ))}
      <MoreSection onDrawer={onDrawer} onClose={onClose} />
    </>
  );
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
  const pageRow: PageRowRender = (entry, count = countIn(counts, entry.id), withMeta = false) => (
    <PageRow
      key={entry.id}
      entry={entry}
      count={count}
      withMeta={withMeta}
      pathname={pathname}
      onGo={go}
      onNewReferral={refer}
    />
  );

  return (
    <>
      <Sheet
        id="ward-phone-menu"
        testId="ward-phone-menu"
        open={open}
        onClose={close}
        title="Menu"
        mobileSize="viewport"
        mobileBreakpoint="phone"
        returnFocusRef={returnFocusRef}
        headerLeading={
          <WhoLink
            role={shellRole}
            onSwitch={() => {
              close();
              setSwitcherOpen(true);
            }}
          />
        }
        contentClassName={styles.sheet}
        headerClassName={styles.head}
        titleClassName="sr-only"
        closeButtonClassName={styles.close}
        bodyClassName={styles.body}
      >
        <MenuSearch query={query} onQuery={setQuery} />
        <MenuPages
          query={query}
          entries={entries}
          needs={needs}
          groups={menuGroups}
          pageRow={pageRow}
          onResult={(item) => {
            announceToWardShell(`${item.title}.`);
            close();
          }}
          onDrawer={drawer}
          onClose={close}
        />
      </Sheet>

      {switcherOpen ? <OperatorSwitcherModal isOpen onClose={() => setSwitcherOpen(false)} /> : null}

      <CreateSheet
        open={createOpen}
        onClose={closeCreate}
        returnFocusRef={returnFocusRef}
        byId={byId}
        onNewReferral={onNewReferral}
      />

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
