"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import {
  BedDouble,
  ChevronRight,
  Clock3,
  ListChecks,
  Plus,
  RotateCcwClock,
  Search,
  Send,
  Settings,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { Dot } from "@/components/wf";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { wardNavCountLabel, type WardNavCount } from "@/components/ward-management/ward-nav-counts";
import { wardNavRoleRank } from "@/components/ward-management/ward-nav-role-order";

import { isPhoneViewport, subscribeWardMenu } from "./ward-drawer-bus";
import { settingsHref } from "./ward-facade";
import { announceToWardShell } from "./ward-live-region";
import { isActiveRailEntry, RAIL_GROUPS, railEntries, type RailEntry } from "./ward-rail-entries";
import styles from "./ward-phone-menu.module.css";

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
  { id: "officer", label: "Book transport", meta: "Opens Transport", icon: Truck },
  { id: "delays", label: "Log a delay", meta: "Opens Delays", icon: Clock3 },
  { id: "wards", label: "Update a bed", meta: "Opens Wards", icon: BedDouble },
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
function phoneMenuModel(role: WardChromeRole, counts: CountMap) {
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
    ...needs.map((need) => need.entry.id),
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
          aria-label={wardNavCountLabel(label, countIn(counts, entry.id))}
          data-testid="ward-rail-link"
          onClick={() => onGo(entry)}
        >
          <DockFace icon={entry.icon} label={label} count={countIn(counts, entry.id)?.value} />
        </Link>
      ))}
      <span className={styles.riseSlot}>
        <button
          type="button"
          className={styles.rise}
          aria-label="Create: new referral, transport, delay or bed"
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
        <DockFace icon={RotateCcwClock} label="Activity" count={activityUnread} />
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
      </ul>
      <p className={styles.note}>
        <Dot tone="neutral" />
        Synthetic prototype, not a medical device
      </p>
    </section>
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
      <span className={styles.avatar} aria-hidden="true">
        <UserRound aria-hidden="true" strokeWidth={1.75} />
      </span>
      <span className={styles.whoText}>
        <span className={styles.whoName}>{CHROME_ROLE_LABELS[role]}</span>
        <span className={styles.whoMeta}>Switch workstation</span>
      </span>
    </Link>
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
      bodyClassName={styles.body}
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
        <Send aria-hidden="true" strokeWidth={1.75} />
        New referral
      </button>
      <ul className={`${styles.list} ${styles.rich}`}>
        {CREATE_LINKS.flatMap((item) => {
          const entry = byId.get(item.id);
          return entry
            ? [
                <li key={item.id}>
                  <Link href={entry.href} className={styles.row} onClick={onClose}>
                    <RowBody icon={item.icon} label={item.label} meta={<span>{item.meta}</span>} />
                    <Chevron />
                  </Link>
                </li>,
              ]
            : [];
        })}
      </ul>
    </Sheet>
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

  const { entries, byId, dock, needs, groups } = phoneMenuModel(role, counts);
  const needle = query.trim().toLowerCase();
  const results = entries.filter((entry) => entry.label.toLowerCase().includes(needle));

  const close = () => setOpen(false);
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
  const pageRow = (entry: RailEntry, count = countIn(counts, entry.id), withMeta = false) => (
    <PageRow
      key={entry.id}
      entry={entry}
      count={count}
      withMeta={withMeta}
      pathname={pathname}
      onGo={go}
      onNewReferral={() => {
        close();
        onNewReferral();
      }}
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
        }
      >
        <label className={styles.search}>
          <Search aria-hidden="true" strokeWidth={1.75} />
          <span className="sr-only">Go to a page</span>
          <input
            type="search"
            value={query}
            placeholder="Go to a page"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            data-testid="ward-phone-menu-search"
          />
        </label>

        {needle && results.length === 0 ? <p className={styles.empty}>No page called “{query.trim()}”.</p> : null}
        {needle && results.length > 0 ? (
          <Section label="Pages found">{results.map((entry) => pageRow(entry))}</Section>
        ) : null}
        {!needle && needs.length > 0 ? (
          <Section label="Needs you" rich>
            {needs.map(({ entry, count }) => pageRow(entry, count, true))}
          </Section>
        ) : null}
        {!needle
          ? groups.map((group) => (
              <Section key={group.label} label={group.label}>
                {group.entries.map((entry) => pageRow(entry))}
              </Section>
            ))
          : null}
        {!needle ? <MoreSection onDrawer={drawer} onClose={close} /> : null}
      </Sheet>

      <CreateSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        returnFocusRef={returnFocusRef}
        byId={byId}
        onNewReferral={onNewReferral}
      />
    </>
  );
}
