"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import {
  Activity,
  BedSingle,
  House,
  Inbox,
  ChevronRight,
  Clock3,
  ListChecks,
  Plus,
  Search,
  Settings,
  Truck,
  UserPlus,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { useMobileKeyboard } from "@/components/ward-management/shell/use-mobile-keyboard";
import { Dot, SrOnly } from "@/components/wf";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import {
  CHROME_ROLE_LABELS,
  wardTasksAreActionableForRole,
  type WardChromeRole,
} from "@/components/ward-management/ward-chrome-role";
import { WARD_ADD_PERSON_HREF } from "@/components/ward-management/ward-nav";
import { wardNavCountLabel, type WardNavCount } from "@/components/ward-management/ward-nav-counts";
import { wardNavRoleRank } from "@/components/ward-management/ward-nav-role-order";
import { activeActNowItems } from "@/components/ward-management/ward-act-now-items";
import { NOTHING_FOUND, refusalFor } from "@/components/ward-management/search/search-refusals";
import { searchWardFlow } from "@/components/ward-management/search/ward-smart-search";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { useDebouncedValue } from "@/components/ward-management/search/use-debounced-value";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import {
  patientResultTitle,
  SearchResultIcon,
  smartSearchGroups,
  type SearchResultGroup,
  type SearchResultItem,
} from "@/components/ward-management/ward-global-search";
import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal";

import { useWardDataMode } from "../ward-shared-access";
import { isPhoneViewport, subscribeWardMenu } from "./ward-drawer-bus";
import { officerHref, settingsHref, unitHref } from "./ward-facade";
import { announceToWardShell } from "./ward-live-region";
import { isActiveRailEntry, RAIL_GROUPS, railEntries, type RailEntry } from "./ward-rail-entries";
import { useAccessNavFilter } from "./ward-access";
import { useWardFeatureFlagCheck } from "./ward-feature-flag-store";
import { isPhoneDesktopOnlyPath } from "./ward-phone-desktop-only";
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

type DockPlace = readonly [id: string, label: string];

/** Two places per role, beside the +. Ids are rail entry ids. */
const DOCK_PLACES: Record<WardChromeRole, readonly [DockPlace, DockPlace]> = {
  coordinator: [
    ["command", "Home"],
    ["referrals", "Referrals"],
  ],
  ward: [
    ["wards", "Wards"],
    ["referrals", "Referrals"],
  ],
  ed: [
    ["ed", "ED"],
    ["referrals", "Referrals"],
  ],
  officer: [
    ["officer", "Transport"],
    ["movements", "Movements"],
  ],
  community: [
    ["community", "Community"],
    ["referrals", "Referrals"],
  ],
  bed_manager: [
    ["command", "Home"],
    ["capacity", "Capacity"],
  ],
  executive: [
    ["command", "Home"],
    ["statistics", "Statistics"],
  ],
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
  const dock = DOCK_PLACES[dockRole].flatMap(([id, label]) => {
    const entry = byId.get(id);
    return entry ? [{ entry, label }] : [];
  });
  const needs = strictNeeds(byId, counts);
  // Nothing twice: a page in the dock or under Needs you leaves its group, and New referral is the +.
  const shown = new Set([
    "referral-intake",
    ...dock.map((place) => place.entry.id),
    ...needs.flatMap((need) => (need.entryId ? [need.entryId] : [])),
  ]);
  const rank = (id: string) => wardNavRoleRank(role, id) ?? Number.MAX_SAFE_INTEGER;
  const groups = RAIL_GROUPS.map((group) => ({
    label: group.label,
    entries: group.entries
      .flatMap(([id]) => byId.get(id) ?? [])
      .filter((entry) => !shown.has(entry.id))
      .toSorted((a, b) => rank(a.id) - rank(b.id)),
  })).filter((group) => group.entries.length > 0);
  return { entries, byId, dock, needs, groups };
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

function actNowNeed(actNow: number): NeedRow[] {
  return actNow > 0
    ? [
        {
          id: "act-now",
          label: "Act-now tasks",
          meta: "red rows in Tasks",
          count: actNow,
          icon: ListChecks,
          actNow: true,
        },
      ]
    : [];
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

const Chevron = () => <ChevronRight aria-hidden="true" className={styles.chevron} strokeWidth={1.75} />;

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
  counts,
  pathname,
  tasksCount,
  activityUnread,
  onGo,
  onCreate,
  onDrawer,
}: {
  places: ReturnType<typeof phoneMenuModel>["dock"];
  counts: CountMap;
  pathname: string;
  tasksCount: number;
  activityUnread: number;
  onGo: (entry: RailEntry) => void;
  onCreate: () => void;
  onDrawer: (id: DrawerId) => void;
}) {
  return (
    <nav className={styles.dock} aria-label="Quick open" data-testid="ward-phone-dock">
      {places.map(({ entry, label }) => (
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
            count={countIn(counts, entry.id)?.value}
            tail={dockTail(
              label,
              countIn(counts, entry.id)?.value,
              countIn(counts, entry.id)?.noun ?? "",
              wardNavCountLabel(label, countIn(counts, entry.id)),
            )}
          />
        </Link>
      ))}
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
      <button
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
      <button
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
    </nav>
  );
}

function Section({ label, rich, children }: { label: string; rich?: boolean; children: ReactNode }) {
  return (
    <section aria-label={label} className={styles.section}>
      <p className={styles.heading}>{label}</p>
      <ul className={rich ? `${styles.list} ${styles.rich}` : styles.list}>{children}</ul>
    </section>
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
        Synthetic prototype, not a medical device
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
  const router = useRouter();
  // shell-2: on a ward's own page, Update a bed opens that ward's beds, not the statewide list.
  const currentUnitId = /^\/mockups\/ward-flow\/(?:ward|board)\/([^/?#]+)/u.exec(usePathname() ?? "")?.[1];
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

type PageRowRender = (entry: RailEntry, count?: WardNavCount, withMeta?: boolean) => ReactNode;

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

/** Records per kind in the menu, the same short list the header search shows under All. */
const MENU_RESULTS_PER_GROUP = 6;
/** Audit round 2 (S-33): what "Show all N" opens a group to, the header search's per-kind limit. */
const MENU_RESULTS_FULL = 40;

/**
 * The menu's search is the app's one smart search (`searchWardFlow`, grouped by
 * `smartSearchGroups`), so it finds the same patients, movements, places, forms and tasks as the
 * header search. Pages come first from the rail's own role-ordered entries; a screen the engine
 * matches by keyword (for example "beds" for Capacity) joins them rather than being listed twice.
 */
function useMenuSearch(query: string, entries: RailEntry[]) {
  const { movements, patients, units, referrals, plannedAdmissions } = useWardFlow();
  const now = useWardFlowClock();
  const debouncedQuery = useDebouncedValue(query, 120);
  const trimmed = query.trim();
  const needle = debouncedQuery.trim();
  const isPending = trimmed !== needle;
  return useMemo(() => {
    if (!needle || isPending) return null;
    const refusal = refusalFor(needle);
    const results = searchWardFlow({
      query: needle,
      patients,
      movements,
      units,
      referrals,
      now,
      limitPerGroup: MENU_RESULTS_FULL,
      plannedAdmissions,
    });
    const viewHrefs = new Set(results.views.map((view) => view.href));
    const lower = needle.toLowerCase();
    const pages = entries.filter((entry) => entry.label.toLowerCase().includes(lower) || viewHrefs.has(entry.href));
    // A screen already listed as a page drops out, including an alias titled the same (Escalation
    // is "Delays" and redirects there).
    const pageHrefs = new Set(pages.map((entry) => entry.href));
    const pageLabels = new Set(pages.map((entry) => entry.label.toLowerCase()));
    const groups: SearchResultGroup[] = refusal
      ? []
      : smartSearchGroups(results, needle, units, { patients, referrals, movements, plannedAdmissions })
          .map((group) =>
            group.key === "views"
              ? {
                  ...group,
                  items: group.items.filter(
                    (item) => !pageHrefs.has(item.href) && !pageLabels.has(item.title.toLowerCase()),
                  ),
                }
              : group,
          )
          .filter((group) => group.items.length > 0);
    return { needle, refusal, pages, groups };
  }, [needle, isPending, entries, movements, patients, units, referrals, plannedAdmissions, now]);
}

function ResultRow({ item, onGo }: { item: SearchResultItem; onGo: (item: SearchResultItem) => void }) {
  const nameFor = usePatientNameDisplay();
  const title = patientResultTitle(item, nameFor);
  return (
    <li>
      {/* Announce the name as shown, so the discreet form is never read out in full. */}
      <Link
        href={item.href}
        className={styles.row}
        onClick={() => onGo({ ...item, title })}
        data-testid="ward-phone-menu-result"
      >
        <SearchResultIcon kind={item.kind} id={item.id} className={styles.rowIcon} />
        <span className={styles.rowText}>
          <span className={styles.rowLabel}>{title}</span>
          {item.meta ? <span className={styles.rowMeta}>{item.meta}</span> : null}
        </span>
        <Chevron />
      </Link>
    </li>
  );
}

function MenuResults({
  search,
  pageRow,
  onGo,
}: {
  search: NonNullable<ReturnType<typeof useMenuSearch>>;
  pageRow: PageRowRender;
  onGo: (item: SearchResultItem) => void;
}) {
  const { needle, refusal, pages, groups } = search;
  // Audit round 2 (S-33): each group shows six, then "Show all N" opens the rest in place. A new
  // query starts short again.
  const [expanded, setExpanded] = useState<{ needle: string; keys: ReadonlySet<string> }>({
    needle,
    keys: new Set(),
  });
  const openKeys = expanded.needle === needle ? expanded.keys : new Set<string>();
  return (
    <>
      {pages.length > 0 ? <Section label="Pages">{pages.map((entry) => pageRow(entry))}</Section> : null}
      {groups.map((group) => {
        const full = openKeys.has(group.key);
        const shown = full ? group.items : group.items.slice(0, MENU_RESULTS_PER_GROUP);
        return (
          <Section key={group.key} label={group.heading}>
            {shown.map((item) => (
              <ResultRow key={`${item.kind}-${item.id}`} item={item} onGo={onGo} />
            ))}
            {shown.length < group.items.length ? (
              <li>
                <button
                  type="button"
                  className={styles.row}
                  data-testid={`ward-phone-menu-show-all-${group.key}`}
                  onClick={() => setExpanded({ needle, keys: new Set([...openKeys, group.key]) })}
                >
                  <span className={styles.rowText}>
                    <span className={styles.rowLabel}>Show all {group.items.length}</span>
                  </span>
                </button>
              </li>
            ) : null}
          </Section>
        );
      })}
      {refusal ? (
        <p className={styles.empty}>{refusal.sentence}</p>
      ) : pages.length === 0 && groups.length === 0 ? (
        <p className={styles.empty}>{NOTHING_FOUND(needle)}</p>
      ) : null}
    </>
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
  const search = useMenuSearch(query, entries);
  if (query.trim().length > 0) {
    if (search) return <MenuResults search={search} pageRow={pageRow} onGo={onResult} />;
    return (
      <Section label="Searching">
        <li className={styles.empty}>Searching…</li>
      </Section>
    );
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
          {group.entries.map((entry) => pageRow(entry))}
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
    needs: overdueNeeds,
    groups,
  } = phoneMenuModel(shellRole, counts, dockRole, flagOn, accessNav);
  // Act-now tasks are the signed-in person's, gated as the bar's Tasks list is (`shellRole`).
  const flow = useWardFlow();
  const actNowCount = useMemo(
    () => (wardTasksAreActionableForRole(shellRole) ? activeActNowItems(flow, flow.now).length : 0),
    [shellRole, flow],
  );
  const needs = [...actNowNeed(actNowCount), ...overdueNeeds];

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
          groups={groups}
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
          counts={counts}
          pathname={pathname}
          tasksCount={tasksCount}
          activityUnread={activityUnread}
          onGo={(entry) => announceGo(pathname, entry)}
          onCreate={create}
          onDrawer={drawer}
        />
      </div>
    </>
  );
}
