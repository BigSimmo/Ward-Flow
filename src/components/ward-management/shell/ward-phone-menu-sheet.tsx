"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentProps, type ComponentType, type ReactNode, type RefObject } from "react";
import { BedSingle, CircleHelp, Inbox, Clock3, Plus, Search, Settings, UserPlus, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Sheet } from "@/components/wf/sheet";
import { Dot } from "@/components/wf";
import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { WARD_ADD_PERSON_HREF } from "@/components/ward-management/ward-nav";
import { wardNavCountLabel, type WardNavCount } from "@/components/ward-management/ward-nav-counts";
import type { SearchResultItem } from "@/components/ward-management/ward-global-search";
import { preloadWhenIdle } from "../preload-when-idle";
import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal-lazy";

import { useWardDataMode } from "../ward-shared-access";
import { settingsHref, unitHref } from "./ward-facade";
import { announceToWardShell } from "./ward-live-region";
import { isActiveRailEntry, isRoleMenuAction, type RailEntry, type RoleMenuAction } from "./ward-rail-entries";
import { requestToolsTool } from "../tools/ward-tools-open";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { useCanOpenHref } from "./ward-access";
import { Chevron, CountChip, countIn, MenuSearching, type PageRowRender, Section } from "./ward-phone-menu-parts";
import { WardMyWards } from "./ward-my-wards";
import { useWardHelpRow } from "@/components/ward-management/help/ward-help-link";
import type { CountMap, DrawerId, NeedRow, PhoneMenuModel } from "./ward-phone-menu";
import styles from "./ward-phone-menu.module.css";
import actNowStyles from "./ward-phone-menu-act-now.module.css";

/**
 * What the + starts. New referral is real; the rest open the page where that work is done.
 * Book transport is left out (audit round 2, A4-10) until a phone booking entry is wired: it opened
 * the officer's job list, which cannot start a booking.
 */
/*
 * shell-5 (13 Oct 2026): the Create items match the + button's name. Add patient joins (transport stays
 * out until a phone booking entry exists, per A4-10);
 * a delay is logged on its patient, so the row says it starts by choosing them. `href` names a page
 * that is not a Menu entry. UX audit (21 Oct 2026): "Transport jobs" left, as it is a page to look at,
 * not something to start, and the menu already lists Transport.
 */
const CREATE_LINKS: readonly {
  id: string;
  label: string;
  meta: string;
  icon: LucideIcon;
  href?: string;
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
];

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
        <HelpRow onClose={onClose} />
        <DataModeRow onClose={onClose} />
      </ul>
      <p className={styles.note}>
        <Dot tone="neutral" />
        Synthetic prototype, not approved for clinical use
      </p>
    </section>
  );
}

/** Help: says "New" until this desk's tour is seen, and opens the tour until then. */
function HelpRow({ onClose }: { onClose: () => void }) {
  const help = useWardHelpRow();
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        aria-label={help.label}
        data-testid="ward-phone-menu-help"
        onClick={() => {
          onClose();
          help.open();
        }}
      >
        <RowBody icon={CircleHelp} label="Help" meta={help.isNew ? "New" : undefined} />
        <Chevron />
      </button>
    </li>
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
  // Add patient is not a Menu entry, so it asks the same access table and the route's own gate
  // itself: a desk that cannot add a patient is not offered a page that refuses it (D-80).
  const canOpen = useCanOpenHref();
  const canAddPatient = canOpen(WARD_ADD_PERSON_HREF) && gate("ADD_PATIENT").allowed;
  // shell-2: on a ward's own page, Update a bed opens that ward's beds, not the statewide list.
  const currentUnitId = /^\/ward-flow\/(?:ward|board)\/([^/?#]+)/u.exec(usePathname() ?? "")?.[1];
  const rows = CREATE_LINKS.flatMap((item) => {
    if (item.id === "add-patient" && !canAddPatient) return [];
    const entry = item.href !== undefined ? { href: item.href } : byId.get(item.id);
    return entry
      ? [
          <li key={item.id}>
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
          </li>,
        ]
      : [];
  });
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
      {rows.length > 0 ? (
        <ul className={`${styles.list} ${styles.rich}`}>{rows}</ul>
      ) : canRefer ? null : (
        // An officer or executive desk has nothing to start, so the sheet says so rather than open empty.
        <p className={styles.empty}>Nothing to start from this desk.</p>
      )}
    </Sheet>
  );
}

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
      {/* UX audit (21 Oct 2026): "Needs you" is Home's one list; this section says what it holds. */}
      <Section label="Act now and overdue" rich>
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
      <WardMyWards variant="sheet" onNavigate={onClose} />
      <MoreSection onDrawer={onDrawer} onClose={onClose} />
    </>
  );
}

/**
 * The phone Menu sheet, the Create sheet and the operator switcher. Its own chunk, loaded by
 * `ward-phone-menu.tsx` once the browser is idle; the menu's state and model stay in that file.
 */
export function PhoneMenuSheets({
  open,
  onClose,
  query,
  onQuery,
  returnFocusRef,
  shellRole,
  pathname,
  counts,
  entries,
  byId,
  needs,
  groups,
  onGo,
  onRefer,
  onDrawer,
  switcherOpen,
  onSwitch,
  onCloseSwitcher,
  createOpen,
  onCloseCreate,
  onNewReferral,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  onQuery: (value: string) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  shellRole: WardChromeRole;
  pathname: string;
  counts: CountMap;
  entries: RailEntry[];
  byId: PhoneMenuModel["byId"];
  needs: NeedRow[];
  groups: PhoneMenuModel["groups"];
  onGo: (entry: RailEntry) => void;
  onRefer: () => void;
  onDrawer: (id: DrawerId) => void;
  switcherOpen: boolean;
  onSwitch: () => void;
  onCloseSwitcher: () => void;
  createOpen: boolean;
  onCloseCreate: () => void;
  onNewReferral: () => void;
}) {
  const pageRow: PageRowRender = (entry, count = countIn(counts, entry.id), withMeta = false) => (
    <PageRow
      key={entry.id}
      entry={entry}
      count={count}
      withMeta={withMeta}
      pathname={pathname}
      onGo={onGo}
      onNewReferral={onRefer}
    />
  );
  return (
    <>
      <Sheet
        id="ward-phone-menu"
        testId="ward-phone-menu"
        open={open}
        onClose={onClose}
        title="Menu"
        mobileSize="viewport"
        mobileBreakpoint="phone"
        returnFocusRef={returnFocusRef}
        headerLeading={<WhoLink role={shellRole} onSwitch={onSwitch} />}
        contentClassName={styles.sheet}
        headerClassName={styles.head}
        titleClassName="sr-only"
        closeButtonClassName={styles.close}
        bodyClassName={styles.body}
      >
        <MenuSearch query={query} onQuery={onQuery} />
        <MenuPages
          query={query}
          entries={entries}
          needs={needs}
          groups={groups}
          pageRow={pageRow}
          onResult={(item) => {
            announceToWardShell(`${item.title}.`);
            onClose();
          }}
          onDrawer={onDrawer}
          onClose={onClose}
        />
      </Sheet>

      {switcherOpen ? <OperatorSwitcherModal isOpen onClose={onCloseSwitcher} /> : null}

      <CreateSheet
        open={createOpen}
        onClose={onCloseCreate}
        returnFocusRef={returnFocusRef}
        byId={byId}
        onNewReferral={onNewReferral}
      />
    </>
  );
}
