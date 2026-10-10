"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type RefObject } from "react";
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

import { subscribeWardMenu } from "./ward-drawer-bus";
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
        setQuery("");
        setOpen(true);
        announceToWardShell("Menu opened.");
      }),
    [],
  );

  const entries = railEntries();
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const dock = DOCK_PLACES[role].map(([id, label]) => ({ entry: byId.get(id), label }));
  const countFor = (id: string): WardNavCount | undefined => counts[id as keyof typeof counts];

  const needs = NEEDS_IDS.flatMap((id) => {
    const entry = byId.get(id);
    const count = countFor(id);
    return entry && count && count.value > 0 ? [{ entry, count }] : [];
  })
    .toSorted((a, b) => Number(b.count.urgent) - Number(a.count.urgent))
    .slice(0, NEEDS_LIMIT);

  // Nothing twice: a page in the dock or under Needs you leaves its group, and New referral is the +.
  const shown = new Set([
    "referral-intake",
    ...dock.map((place) => place.entry?.id),
    ...needs.map((need) => need.entry.id),
  ]);
  const rank = (id: string) => wardNavRoleRank(role, id) ?? Number.MAX_SAFE_INTEGER;
  const groups = RAIL_GROUPS.map((group) => ({
    label: group.label,
    entries: group.entries
      .map(([id]) => byId.get(id))
      .filter((entry): entry is RailEntry => entry !== undefined && !shown.has(entry.id))
      .toSorted((a, b) => rank(a.id) - rank(b.id)),
  })).filter((group) => group.entries.length > 0);

  const needle = query.trim().toLowerCase();
  const results = needle ? entries.filter((entry) => entry.label.toLowerCase().includes(needle)) : [];

  function close() {
    setOpen(false);
  }

  function go(entry: RailEntry) {
    const active = isActiveRailEntry(pathname, entry);
    announceToWardShell(active ? `${entry.label}. This is the screen you are on.` : `${entry.label}.`);
    close();
  }

  function drawer(id: "tasks" | "activity" | "tools") {
    close();
    onOpenDrawer(id);
  }

  function row(entry: RailEntry, count?: WardNavCount, meta?: boolean) {
    const Icon = entry.icon;
    const active = isActiveRailEntry(pathname, entry);
    const rowContent = (
      <>
        <Icon aria-hidden="true" className={styles.rowIcon} strokeWidth={1.75} />
        <span className={styles.rowText}>
          <span className={styles.rowLabel}>{entry.label}</span>
          {meta && count ? (
            <span className={styles.rowMeta}>
              <Dot tone={count.urgent ? "warning" : "neutral"} />
              <span>{count.noun}</span>
            </span>
          ) : null}
        </span>
        {count && count.value > 0 ? (
          <span className={styles.count} aria-hidden="true">
            {count.value}
          </span>
        ) : null}
        <ChevronRight aria-hidden="true" className={styles.chevron} strokeWidth={1.75} />
      </>
    );
    return (
      <li key={entry.id}>
        {entry.id === "referral-intake" ? (
          <button
            type="button"
            className={styles.row}
            aria-label={wardNavCountLabel(entry.label, count)}
            data-testid="ward-phone-new-referral"
            onClick={() => {
              close();
              onNewReferral();
            }}
          >
            {rowContent}
          </button>
        ) : (
          <Link
            href={entry.href}
            className={styles.row}
            aria-current={active ? "page" : undefined}
            aria-label={wardNavCountLabel(entry.label, count)}
            data-testid="ward-rail-link"
            onClick={() => go(entry)}
          >
            {rowContent}
          </Link>
        )}
      </li>
    );
  }

  const dockSlot = (key: string, label: string, icon: typeof Plus, count: number, props: Record<string, unknown>) => {
    const Icon = icon;
    return (
      <button key={key} type="button" className={styles.dockItem} {...props}>
        <span className={styles.dockIcon}>
          <Icon aria-hidden="true" strokeWidth={1.75} />
          {count > 0 ? (
            <span className={styles.dockCount} aria-hidden="true">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </span>
        <span className={styles.dockLabel}>{label}</span>
      </button>
    );
  };

  const dockFoot = (
    <nav className={styles.dock} aria-label="Quick open" data-testid="ward-phone-dock">
      {dock.map(({ entry, label }) => {
        if (!entry) return null;
        const Icon = entry.icon;
        const count = countFor(entry.id);
        const active = isActiveRailEntry(pathname, entry);
        return (
          <Link
            key={entry.id}
            href={entry.href}
            className={styles.dockItem}
            aria-current={active ? "page" : undefined}
            aria-label={wardNavCountLabel(label, count)}
            data-testid="ward-rail-link"
            onClick={() => go(entry)}
          >
            <span className={styles.dockIcon}>
              <Icon aria-hidden="true" strokeWidth={1.75} />
              {count && count.value > 0 ? (
                <span className={styles.dockCount} aria-hidden="true">
                  {count.value > 99 ? "99+" : count.value}
                </span>
              ) : null}
            </span>
            <span className={styles.dockLabel}>{label}</span>
          </Link>
        );
      })}
      <span className={styles.riseSlot}>
        <button
          type="button"
          className={styles.rise}
          aria-label="Create: new referral, transport, delay or bed"
          aria-haspopup="dialog"
          data-testid="ward-phone-create"
          onClick={() => {
            close();
            setCreateOpen(true);
            announceToWardShell("Create opened.");
          }}
        >
          <Plus aria-hidden="true" strokeWidth={2} />
        </button>
      </span>
      {dockSlot("tasks", "Tasks", ListChecks, tasksCount, {
        "aria-label": `Tasks, ${tasksCount} outstanding`,
        "data-testid": "ward-phone-menu-tasks",
        "aria-haspopup": "dialog",
        onClick: () => drawer("tasks"),
      })}
      {dockSlot("activity", "Activity", RotateCcwClock, activityUnread, {
        "aria-label": activityUnread > 0 ? `Activity, ${activityUnread} unread` : "Activity",
        "data-testid": "ward-phone-menu-activity",
        "aria-haspopup": "dialog",
        onClick: () => drawer("activity"),
      })}
    </nav>
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
          <Link
            href={settingsHref()}
            className={styles.who}
            onClick={close}
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
        }
        contentClassName={styles.sheet}
        headerClassName={styles.head}
        titleClassName="sr-only"
        closeButtonClassName={styles.close}
        bodyClassName={styles.body}
        footerClassName={styles.foot}
        footer={dockFoot}
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

        {needle ? (
          <section aria-label="Pages found" className={styles.section}>
            {results.length ? (
              <ul className={styles.list}>{results.map((entry) => row(entry, countFor(entry.id)))}</ul>
            ) : (
              <p className={styles.empty}>No page called “{query.trim()}”.</p>
            )}
          </section>
        ) : (
          <>
            {needs.length ? (
              <section aria-label="Needs you" className={styles.section}>
                <p className={styles.heading}>Needs you</p>
                <ul className={`${styles.list} ${styles.rich}`}>
                  {needs.map(({ entry, count }) => row(entry, count, true))}
                </ul>
              </section>
            ) : null}
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label} className={styles.section}>
                <p className={styles.heading}>{group.label}</p>
                <ul className={styles.list}>{group.entries.map((entry) => row(entry, countFor(entry.id)))}</ul>
              </section>
            ))}
            <section aria-label="More" className={styles.section}>
              <p className={styles.heading}>More</p>
              <ul className={styles.list}>
                <li>
                  <button
                    type="button"
                    className={styles.row}
                    data-testid="ward-phone-menu-tools"
                    onClick={() => drawer("tools")}
                  >
                    <Wrench aria-hidden="true" className={styles.rowIcon} strokeWidth={1.75} />
                    <span className={styles.rowText}>
                      <span className={styles.rowLabel}>Tools</span>
                    </span>
                    <ChevronRight aria-hidden="true" className={styles.chevron} strokeWidth={1.75} />
                  </button>
                </li>
                <li>
                  <Link href={settingsHref()} className={styles.row} onClick={close}>
                    <Settings aria-hidden="true" className={styles.rowIcon} strokeWidth={1.75} />
                    <span className={styles.rowText}>
                      <span className={styles.rowLabel}>Settings</span>
                    </span>
                    <ChevronRight aria-hidden="true" className={styles.chevron} strokeWidth={1.75} />
                  </Link>
                </li>
              </ul>
              <p className={styles.note}>
                <Dot tone="neutral" />
                Synthetic prototype, not a medical device
              </p>
            </section>
          </>
        )}
      </Sheet>

      <Sheet
        id="ward-phone-create"
        testId="ward-phone-create-sheet"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create"
        description="Start something new"
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
            setCreateOpen(false);
            onNewReferral();
          }}
        >
          <Send aria-hidden="true" strokeWidth={1.75} />
          New referral
        </button>
        <ul className={`${styles.list} ${styles.rich}`}>
          {CREATE_LINKS.map((item) => {
            const entry = byId.get(item.id);
            if (!entry) return null;
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link href={entry.href} className={styles.row} onClick={() => setCreateOpen(false)}>
                  <Icon aria-hidden="true" className={styles.rowIcon} strokeWidth={1.75} />
                  <span className={styles.rowText}>
                    <span className={styles.rowLabel}>{item.label}</span>
                    <span className={styles.rowMeta}>
                      <span>{item.meta}</span>
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className={styles.chevron} strokeWidth={1.75} />
                </Link>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
