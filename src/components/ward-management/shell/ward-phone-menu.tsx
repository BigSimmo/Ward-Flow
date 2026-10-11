"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import {
  Activity,
  BedSingle,
  Building2,
  House,
  Inbox,
  ChevronRight,
  Clock3,
  ListChecks,
  Plus,
  Search,
  Settings,
  Siren,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { Dot } from "@/components/wf";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { wardNavCountLabel, type WardNavCount } from "@/components/ward-management/ward-nav-counts";
import { wardNavRoleRank } from "@/components/ward-management/ward-nav-role-order";
import { WARD_NEW_REFERRAL_MENU } from "@/components/ward-management/ward-nav";
import { activeActNowItems } from "@/components/ward-management/ward-act-now-items";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { useWardPhoneShellPreview } from "@/components/ward-management/preview/ward-phone-shell-preview";
import { wardPreviewStandIn, type WardPreviewOption } from "@/components/ward-management/preview/ward-preview-routes";
import { NOTHING_FOUND, refusalFor } from "@/components/ward-management/search/search-refusals";
import { searchWardFlow } from "@/components/ward-management/search/ward-smart-search";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import {
  SearchResultIcon,
  smartSearchGroups,
  type SearchResultGroup,
  type SearchResultItem,
} from "@/components/ward-management/ward-global-search";

import { useWardDataMode } from "../ward-shared-access";
import { isPhoneViewport, subscribeWardMenu } from "./ward-drawer-bus";
import { movementHref, settingsHref } from "./ward-facade";
import { announceToWardShell } from "./ward-live-region";
import { isActiveRailEntry, RAIL_GROUPS, railEntries, type RailEntry } from "./ward-rail-entries";
import styles from "./ward-phone-menu.module.css";
import pageDock from "./ward-phone-page-dock.module.css";

/**
 * Phone menu (Josh, 10 Oct 2026, locked from the phone header and navigation mockups, set 9 with
 * the set 10 "Rise" plus). PHONE ONLY: the bar mounts it, and the rail's own sheet stays the menu
 * above 48rem, so desktop is unchanged.
 *
 * A tall bottom sheet: who you are working as, a page filter, what needs you, your other places,
 * then every page in the rail's own groups, and More. Its foot is the dock: two places for the
 * role, a raised + that rises out of the dock's own curved edge, Tasks and Activity. Nothing is
 * listed twice. Every figure is the rail's own `wardNavCounts`, never typed here.
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
const NEEDS_IDS = ["referrals", "delays", "discharges", "movements"] as const;
const NEEDS_LIMIT = 4;

/** What the + starts. New referral is real; the rest open the page where that work is done. */
const CREATE_LINKS = [
  { id: "officer", label: "Book transport", meta: "For an accepted patient", icon: Truck },
  { id: "delays", label: "Log a delay", meta: "Reason and who it waits on", icon: Clock3 },
  { id: "wards", label: "Update a bed", meta: "Open, close or hold a bed", icon: BedSingle },
] as const;

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
function phoneMenuModel(role: WardChromeRole, counts: CountMap, previewNeedsOnly = false) {
  const entries = railEntries();
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const dock = DOCK_PLACES[role].flatMap(([id, label]) => {
    const entry = byId.get(id);
    return entry ? [{ entry, label }] : [];
  });
  const needs = NEEDS_IDS.flatMap((id) => {
    const entry = byId.get(id);
    const count = countIn(counts, id);
    return entry && count && count.value > 0 ? [{ entry, count }] : [];
  })
    .toSorted((a, b) => Number(b.count.urgent) - Number(a.count.urgent))
    .slice(0, NEEDS_LIMIT);
  // Nothing twice: a page in the dock or under Needs you leaves its group, and New referral is the +.
  const shown = new Set([
    "referral-intake",
    ...dock.map((place) => place.entry.id),
    // Preview: Needs you is act-now rows, not pages, so every page stays in its group.
    ...(previewNeedsOnly ? [] : needs.map((need) => need.entry.id)),
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
 * Device audit mockups (11 Oct 2026, preview only): Needs you holds only what is act-now or
 * overdue. Movements' "still open" and Referrals' "awaiting a decision" are not that, so they leave
 * the list and stay in their groups. Act-now rows carry the thin red edge.
 */
type NeedRow = {
  id: string;
  label: string;
  meta: string;
  count?: number;
  href: string;
  icon: typeof Plus;
  actNow: boolean;
};

const ACT_NOW_RECORDS_SHOWN = 3;

function previewNeeds(
  option: WardPreviewOption,
  byId: ReadonlyMap<string, RailEntry>,
  counts: CountMap,
  actNow: readonly InboxItem[],
): NeedRow[] {
  const rows: NeedRow[] = [];
  const movements = byId.get("movements");
  if (option === "C") {
    // C lists the act-now records themselves, the same rows the Tasks list leads with.
    for (const item of actNow.slice(0, ACT_NOW_RECORDS_SHOWN)) {
      rows.push({
        id: item.id,
        label: item.title,
        meta: item.detail,
        href: item.href ?? (item.movementId ? movementHref(item.movementId) : (movements?.href ?? "")),
        icon: item.icon,
        actNow: true,
      });
    }
  } else if (actNow.length > 0 && movements) {
    rows.push({
      id: "act-now",
      label: "Act now",
      meta: "to act on now",
      count: actNow.length,
      href: movements.href,
      icon: movements.icon,
      actNow: true,
    });
  }
  for (const id of ["delays", "discharges"] as const) {
    const entry = byId.get(id);
    const count = countIn(counts, id);
    if (entry && count?.urgent && count.value > 0) {
      rows.push({
        id,
        label: entry.label,
        meta: count.noun,
        count: count.value,
        href: entry.href,
        icon: entry.icon,
        actNow: false,
      });
    }
  }
  return rows;
}

function NeedRowLink({ row, onGo }: { row: NeedRow; onGo: () => void }) {
  return (
    <li>
      <Link
        href={row.href}
        className={styles.row}
        data-act-now={row.actNow || undefined}
        aria-label={row.count === undefined ? `${row.label}, ${row.meta}` : `${row.label}, ${row.count} ${row.meta}`}
        data-testid="ward-phone-menu-need"
        onClick={onGo}
      >
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
      </Link>
    </li>
  );
}

type DockLook = "menu" | "rise" | "float" | "flat";

const PREVIEW_DOCK_LOOK: Record<WardPreviewOption, Exclude<DockLook, "menu">> = {
  A: "rise",
  B: "float",
  C: "flat",
};

/** B's capsule steps aside while the page scrolls down and comes back on the way up. */
function useHideOnScrollDown(enabled: boolean): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let last = -1;
    const onScroll = (event: Event) => {
      const target = event.target;
      const top =
        target instanceof HTMLElement ? target.scrollTop : (document.scrollingElement?.scrollTop ?? window.scrollY);
      if (last >= 0 && Math.abs(top - last) > 6) setHidden(top > last && top > 80);
      last = top;
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [enabled]);
  return enabled && hidden;
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

function DockFace({ icon: Icon, label, count }: { icon: typeof Plus; label: string; count: number | undefined }) {
  return (
    <>
      <span className={styles.dockIcon}>
        <Icon aria-hidden="true" strokeWidth={1.75} />
        <CountChip value={count} className={styles.dockCount} />
      </span>
      <span className={styles.dockLabel}>{label}</span>
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
  look = "menu",
}: {
  look?: DockLook;
  places: ReturnType<typeof phoneMenuModel>["dock"];
  counts: CountMap;
  pathname: string;
  tasksCount: number;
  activityUnread: number;
  onGo: (entry: RailEntry) => void;
  onCreate: () => void;
  onDrawer: (id: DrawerId) => void;
}) {
  const createLabel = "Create: new referral, transport, delay or bed";
  const create =
    look === "float" ? (
      <span className={styles.riseSlot}>
        <button
          type="button"
          className={pageDock.capsuleNew}
          aria-label={createLabel}
          aria-haspopup="dialog"
          data-testid="ward-phone-create"
          onClick={onCreate}
        >
          <Plus aria-hidden="true" strokeWidth={2} />
        </button>
      </span>
    ) : look === "flat" ? (
      <button
        type="button"
        className={pageDock.flatNew}
        aria-label={createLabel}
        aria-haspopup="dialog"
        data-testid="ward-phone-create"
        onClick={onCreate}
      >
        <span className={pageDock.flatNewTile}>
          <Plus aria-hidden="true" strokeWidth={2} />
        </span>
        <span className={pageDock.flatNewLabel}>New</span>
      </button>
    ) : (
      <span className={styles.riseSlot}>
        <button
          type="button"
          className={styles.rise}
          aria-label={createLabel}
          aria-haspopup="dialog"
          data-testid="ward-phone-create"
          onClick={onCreate}
        >
          <Plus aria-hidden="true" strokeWidth={2} />
        </button>
      </span>
    );
  return (
    <nav
      className={look === "float" ? `${styles.dock} ${pageDock.capsule}` : styles.dock}
      aria-label="Quick open"
      data-testid="ward-phone-dock"
    >
      {places.map(({ entry, label }) => (
        <Link
          key={entry.id}
          href={entry.href}
          className={styles.dockItem}
          aria-current={isActiveRailEntry(pathname, entry) ? "page" : undefined}
          aria-label={wardNavCountLabel(label, countIn(counts, entry.id))}
          data-testid="ward-rail-link"
          onClick={() => onGo(entry)}
        >
          {/* Home is the house in the dock (v10 phone mockup); the rail keeps its own icon. */}
          <DockFace
            icon={entry.id === "command" ? House : entry.icon}
            label={label}
            count={countIn(counts, entry.id)?.value}
          />
        </Link>
      ))}
      {create}
      <button
        type="button"
        className={styles.dockItem}
        aria-label={`Tasks, ${tasksCount} outstanding`}
        aria-haspopup="dialog"
        data-testid="ward-phone-menu-tasks"
        onClick={() => onDrawer("tasks")}
      >
        <DockFace icon={ListChecks} label="Tasks" count={tasksCount} />
      </button>
      <button
        type="button"
        className={styles.dockItem}
        aria-label={activityUnread > 0 ? `Activity, ${activityUnread} unread` : "Activity"}
        aria-haspopup="dialog"
        data-testid="ward-phone-menu-activity"
        onClick={() => onDrawer("activity")}
      >
        <DockFace icon={Activity} label="Activity" count={activityUnread} />
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

function WhoLink({ role, onClose }: { role: WardChromeRole; onClose: () => void }) {
  return (
    <Link
      href={settingsHref()}
      className={styles.who}
      onClick={onClose}
      aria-label={`${CHROME_ROLE_LABELS[role]}. Switch workstation in Settings`}
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
        <span className={styles.whoMeta}>Switch workstation</span>
      </span>
    </Link>
  );
}

const REFERRAL_DESTINATION_ICONS = { ward: Building2, community: Users, ed: Siren } as const;

/** Preview C: the create item that belongs to the page you are on comes first after New referral. */
function pageCreateId(pathname: string): string | null {
  const page = wardPreviewStandIn(pathname) ?? pathname;
  if (page.startsWith("/mockups/ward-flow/transport")) return "officer";
  if (page.startsWith("/mockups/ward-flow/ward/") || page.startsWith("/mockups/ward-flow/board/")) return "wards";
  if (page.startsWith("/mockups/ward-flow/delays")) return "delays";
  return null;
}

function CreateRow({
  item,
  entry,
  onClose,
}: {
  item: (typeof CREATE_LINKS)[number];
  entry: RailEntry;
  onClose: () => void;
}) {
  return (
    <li>
      <Link href={entry.href} className={styles.row} onClick={onClose}>
        <RowBody icon={item.icon} label={item.label} meta={<span>{item.meta}</span>} />
        <Chevron />
      </Link>
    </li>
  );
}

function CreateSheet({
  open,
  onClose,
  returnFocusRef,
  byId,
  onNewReferral,
  option = null,
  pathname = "",
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  byId: ReadonlyMap<string, RailEntry>;
  onNewReferral: () => void;
  /** Device audit mockups only. Null draws today's sheet. */
  option?: WardPreviewOption | null;
  pathname?: string;
}) {
  const links = CREATE_LINKS.flatMap((item) => {
    const entry = byId.get(item.id);
    return entry ? [{ item, entry }] : [];
  });
  const pageId = option === "C" ? pageCreateId(pathname) : null;
  const pageLink = links.find(({ item }) => item.id === pageId);
  const otherLinks = links.filter(({ item }) => item.id !== pageId);
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
      {option === "B" ? (
        <section aria-label="Refer to" className={styles.section}>
          <p className={styles.heading}>Or refer straight to</p>
          <ul className={styles.list}>
            {WARD_NEW_REFERRAL_MENU.map((entry) => {
              const Icon = REFERRAL_DESTINATION_ICONS[entry.destination as keyof typeof REFERRAL_DESTINATION_ICONS];
              return (
                <li key={entry.destination}>
                  <Link href={entry.href} className={styles.row} onClick={onClose}>
                    <RowBody icon={Icon ?? Inbox} label={entry.label} />
                    <Chevron />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {pageLink ? (
        <section aria-label="For this page" className={styles.section}>
          <p className={styles.heading}>For this page</p>
          <ul className={`${styles.list} ${styles.rich}`}>
            <CreateRow item={pageLink.item} entry={pageLink.entry} onClose={onClose} />
          </ul>
        </section>
      ) : null}
      {option === "B" || pageLink ? <p className={styles.heading}>Something else</p> : null}
      <ul className={`${styles.list} ${styles.rich}`}>
        {otherLinks.map(({ item, entry }) => (
          <CreateRow key={item.id} item={item} entry={entry} onClose={onClose} />
        ))}
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
        onChange={(event) => onQuery(event.target.value)}
        data-testid="ward-phone-menu-search"
      />
    </label>
  );
}

/** Records per kind in the menu, the same short list the header search shows under All. */
const MENU_RESULTS_PER_GROUP = 6;

/**
 * The menu's search is the app's one smart search (`searchWardFlow`, grouped by
 * `smartSearchGroups`), so it finds the same patients, movements, places, forms and tasks as the
 * header search. Pages come first from the rail's own role-ordered entries; a screen the engine
 * matches by keyword (for example "beds" for Capacity) joins them rather than being listed twice.
 */
function useMenuSearch(query: string, entries: RailEntry[]) {
  const { movements, patients, units, referrals, plannedAdmissions, now } = useWardFlow();
  // Not deferred: a stale list under new text could open the wrong record.
  const needle = query.trim();
  return useMemo(() => {
    if (!needle) return null;
    const refusal = refusalFor(needle);
    const results = searchWardFlow({
      query: needle,
      patients,
      movements,
      units,
      now,
      limitPerGroup: MENU_RESULTS_PER_GROUP,
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
  }, [needle, entries, movements, patients, units, referrals, plannedAdmissions, now]);
}

function ResultRow({ item, onGo }: { item: SearchResultItem; onGo: (item: SearchResultItem) => void }) {
  return (
    <li>
      <Link href={item.href} className={styles.row} onClick={() => onGo(item)} data-testid="ward-phone-menu-result">
        <SearchResultIcon kind={item.kind} id={item.id} className={styles.rowIcon} />
        <span className={styles.rowText}>
          <span className={styles.rowLabel}>{item.title}</span>
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
  return (
    <>
      {pages.length > 0 ? <Section label="Pages">{pages.map((entry) => pageRow(entry))}</Section> : null}
      {groups.map((group) => (
        <Section key={group.key} label={group.heading}>
          {group.items.map((item) => (
            <ResultRow key={`${item.kind}-${item.id}`} item={item} onGo={onGo} />
          ))}
        </Section>
      ))}
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
  strictNeeds,
  actNowTotal,
  groups,
  pageRow,
  onResult,
  onDrawer,
  onClose,
}: {
  query: string;
  entries: RailEntry[];
  needs: PhoneMenuModel["needs"];
  /** Device audit mockups only: act-now and overdue rows in place of `needs`. */
  strictNeeds: NeedRow[] | null;
  actNowTotal: number;
  groups: PhoneMenuModel["groups"];
  pageRow: PageRowRender;
  onResult: (item: SearchResultItem) => void;
  onDrawer: (id: DrawerId) => void;
  onClose: () => void;
}) {
  const search = useMenuSearch(query, entries);
  if (search) return <MenuResults search={search} pageRow={pageRow} onGo={onResult} />;
  return (
    <>
      {strictNeeds ? (
        <Section label="Needs you" rich>
          {strictNeeds.length === 0 ? (
            <li className={styles.empty}>Nothing is act-now or overdue.</li>
          ) : (
            strictNeeds.map((row) => <NeedRowLink key={row.id} row={row} onGo={onClose} />)
          )}
          {strictNeeds.some((row) => row.actNow && row.count === undefined) && actNowTotal > ACT_NOW_RECORDS_SHOWN ? (
            <li>
              <button type="button" className={styles.row} onClick={() => onDrawer("tasks")}>
                <RowBody icon={ListChecks} label={`All ${actNowTotal} act-now in Tasks`} />
                <Chevron />
              </button>
            </li>
          ) : null}
        </Section>
      ) : needs.length > 0 ? (
        <Section label="Needs you" rich>
          {needs.map(({ entry, count }) => pageRow(entry, count, true))}
        </Section>
      ) : null}
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
  const { counts, role } = useWardNavCounts();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");

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

  const preview = useWardPhoneShellPreview();
  const { entries, byId, dock, needs, groups } = phoneMenuModel(role, counts, preview !== null);

  // Device audit mockups (preview routes only): the dock moves onto the page and Needs you keeps
  // only act-now and overdue rows. Null on every live page, which draws today's menu unchanged.
  const flow = useWardFlow();
  const actNow = useMemo(() => (preview ? activeActNowItems(flow, flow.now) : []), [preview, flow]);
  const strictNeeds = preview ? previewNeeds(preview, byId, counts, actNow) : null;
  // Nothing twice: a page listed under Needs you leaves its group.
  const needIds = new Set(strictNeeds?.map((row) => row.id) ?? []);
  const shownGroups = strictNeeds
    ? groups
        .map((group) => ({ ...group, entries: group.entries.filter((entry) => !needIds.has(entry.id)) }))
        .filter((group) => group.entries.length > 0)
    : groups;
  const dockLook = preview ? PREVIEW_DOCK_LOOK[preview] : null;
  const dockHidden = useHideOnScrollDown(dockLook === "float");

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
        headerLeading={<WhoLink role={role} onClose={close} />}
        contentClassName={styles.sheet}
        headerClassName={styles.head}
        titleClassName="sr-only"
        closeButtonClassName={styles.close}
        bodyClassName={styles.body}
        footerClassName={styles.foot}
        footer={
          preview ? undefined : (
            <PhoneDock
              places={dock}
              counts={counts}
              pathname={pathname}
              tasksCount={tasksCount}
              activityUnread={activityUnread}
              onGo={go}
              onCreate={create}
              onDrawer={drawer}
            />
          )
        }
      >
        <MenuSearch query={query} onQuery={setQuery} />
        <MenuPages
          query={query}
          entries={entries}
          needs={needs}
          strictNeeds={strictNeeds}
          actNowTotal={actNow.length}
          groups={shownGroups}
          pageRow={pageRow}
          onResult={(item) => {
            announceToWardShell(`${item.title}.`);
            close();
          }}
          onDrawer={drawer}
          onClose={close}
        />
      </Sheet>

      <CreateSheet
        open={createOpen}
        onClose={closeCreate}
        returnFocusRef={returnFocusRef}
        byId={byId}
        onNewReferral={onNewReferral}
        option={preview}
        pathname={pathname}
      />

      {dockLook ? (
        <div
          className={`${pageDock.pageDock} ${pageDock[dockLook]}`}
          data-wf-page-dock={dockLook}
          data-hidden={dockHidden || undefined}
        >
          <PhoneDock
            look={dockLook}
            places={dock}
            counts={counts}
            pathname={pathname}
            tasksCount={tasksCount}
            activityUnread={activityUnread}
            onGo={(entry) => announceGo(pathname, entry)}
            onCreate={() => {
              setCreateOpen(true);
              announceToWardShell("Create opened.");
            }}
            onDrawer={onOpenDrawer}
          />
        </div>
      ) : null}
    </>
  );
}
