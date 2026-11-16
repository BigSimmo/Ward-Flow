"use client";

// Fork of src/components/ward-management/shell/ward-phone-menu-sheet.tsx (shell-next, Josh, 31 Oct 2026):
// the phone Menu gains a top block (the desk's capacity card and Activity) passed in as `top`.

import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Fragment,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Activity,
  Ambulance,
  ArrowDown,
  ArrowUp,
  BedSingle,
  BellRing,
  CalendarCheck,
  CalendarClock,
  ChartColumn,
  CircleHelp,
  CircleMinus,
  CirclePlus,
  ClipboardList,
  ClipboardPen,
  Inbox,
  Clock3,
  LogOut,
  Map as MapIcon,
  Megaphone,
  MessageSquareText,
  PanelBottom,
  PhoneCall,
  PhoneOutgoing,
  Pin,
  Plus,
  Repeat,
  Search,
  SearchCheck,
  Send,
  Settings,
  UserPlus,
  UserSearch,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ToolsSheetToolId } from "@/components/ward-management/tools/ward-tools-sheet";

import { Sheet } from "@/components/wf/sheet";
import { Dot, Field, Select } from "@/components/wf";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { WARD_ADD_PERSON_HREF, WARD_TRIAGE_NEW_HREF } from "@/components/ward-management/ward-nav";
import { wardNavCountLabel, type WardNavCount } from "@/components/ward-management/ward-nav-counts";
import type { SearchResultItem } from "@/components/ward-management/ward-global-search";
import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";
import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal-lazy";

import { useWardDataMode } from "@/components/ward-management/ward-shared-access";
import { useCanLeaveDemo, useLeaveDemo } from "@/components/ward-management/shell/leave-demo";
import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";
import { settingsHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import {
  isActiveRailEntry,
  isRoleMenuAction,
  type RailEntry,
  type RoleMenuAction,
} from "@/components/ward-management/shell/ward-rail-entries";
import { requestToolsTool } from "@/components/ward-management/tools/ward-tools-open";
import {
  usePhoneCreateOptions,
  type PhoneCreateId,
} from "@/components/ward-management/shell/ward-phone-create-options";
import {
  Chevron,
  chipText,
  CountChip,
  countIn,
  MenuSearching,
  type PageRowRender,
  Section,
} from "@/components/ward-management/shell/ward-phone-menu-parts";
import { WardMyWards } from "@/components/ward-management/shell/ward-my-wards";
import {
  resolveCreateLayout,
  saveCreateSheetLayout,
  useCreateSheetLayout,
  type CreateItemId,
  type ResolvedCreateLayout,
} from "@/components/ward-management/shell/ward-create-sheet-store";
import { useAwaitingTriageCount } from "@/components/ward-management/triage/use-triage-people";
import { useWardHelpRow } from "@/components/ward-management/help/ward-help-link";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import {
  ACCESS_ADMIN_PERSONA,
  DESK_PERSONAS,
  useDeskPersona,
} from "@/components/ward-management/shell/ward-desk-personas";
import { useShellPersonaRole } from "@/components/ward-management/settings/persona-sync";
import type { CountMap, DrawerId, NeedRow, PhoneMenuModel } from "@/components/ward-management/shell/ward-phone-menu";
import type { DockOption } from "@/components/ward-management/shell-next/next-phone-menu";
import styles from "@/components/ward-management/shell/ward-phone-menu.module.css";
import editStyles from "@/components/ward-management/shell-next/next-create-edit.module.css";
import actNowStyles from "@/components/ward-management/shell/ward-phone-menu-act-now.module.css";

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
  id: PhoneCreateId;
  label: string;
  meta: string;
  icon: LucideIcon;
  href?: string;
}[] = [
  { id: "delays", label: "Log a delay", meta: "Choose the patient, then the reason", icon: Clock3 },
  { id: "wards", label: "Update a bed", meta: "Open or close a bed", icon: BedSingle },
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
    // axe 4.14: the name keeps the row's visible order (label, its words, then the count chip).
    "aria-label": `${row.label}, ${row.meta}: ${chipText(row.count)}`,
    "data-testid": "ward-phone-menu-need",
  };
  return (
    <li>
      {row.href ? (
        <Link href={row.href} prefetch={true} {...common} onClick={onGo}>
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
      {/* axe 4.14 joins visible words with no gap; these spaces take no room in the flex and grid row. */}
      <span className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span> {meta ? <span className={styles.rowMeta}>{meta}</span> : null}
      </span>{" "}
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
  // axe 4.14: a row that shows its count's words reads them in the order shown, then the chip.
  const name =
    meta && count ? `${entry.label}, ${count.noun}: ${chipText(count.value)}` : wardNavCountLabel(entry.label, count);
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
          aria-label={name}
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
        prefetch={true}
        className={styles.row}
        aria-current={isActiveRailEntry(pathname, entry) ? "page" : undefined}
        aria-label={name}
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

function MoreSection({
  onDrawer,
  onClose,
  onSwitch,
  activityRow = false,
  onEditBar,
}: {
  onDrawer: (id: DrawerId) => void;
  onClose: () => void;
  onSwitch: () => void;
  /** Edit bar (Josh, 16 Nov 2026): choose what the bottom bar's spots open. */
  onEditBar?: () => void;
  /** Josh, 8 Nov 2026: Activity gets a row here when the desk's dock does not carry it. */
  activityRow?: boolean;
}) {
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
        {activityRow ? (
          <li>
            <button
              type="button"
              className={styles.row}
              data-testid="ward-phone-menu-activity-row"
              onClick={() => onDrawer("activity")}
            >
              <RowBody icon={Activity} label="Activity" />
              <Chevron />
            </button>
          </li>
        ) : null}
        {onEditBar ? (
          <li>
            <button
              type="button"
              className={styles.row}
              aria-haspopup="dialog"
              data-testid="ward-phone-menu-edit-bar"
              onClick={onEditBar}
            >
              <RowBody icon={PanelBottom} label="Edit bottom bar" />
              <Chevron />
            </button>
          </li>
        ) : null}
        <li>
          <Link href={settingsHref()} className={styles.row} onClick={onClose}>
            <RowBody icon={Settings} label="Settings" />
            <Chevron />
          </Link>
        </li>
        <HelpRow onClose={onClose} />
        <DeskRow onSwitch={onSwitch} onClose={onClose} />
        <SignOutRow />
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
 * Sign out of the shared board, with the account it signs out of. In the local demo on a front-door
 * site, Leave the demo instead (live audit item 22); nothing on the open local demo.
 */
function SignOutRow() {
  const session = useContext(SharedSessionContext);
  const canLeaveDemo = useCanLeaveDemo();
  const leave = useLeaveDemo();
  if (!session) {
    return canLeaveDemo ? (
      <li>
        <button type="button" className={styles.row} data-testid="ward-phone-menu-leave-demo" onClick={leave}>
          <RowBody icon={LogOut} label="Leave the demo" />
        </button>
      </li>
    ) : null;
  }
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        data-testid="ward-phone-menu-sign-out"
        onClick={() => session.signOut()}
      >
        <RowBody icon={LogOut} label="Sign out" meta={session.accountEmail} />
      </button>
    </li>
  );
}

/**
 * DK1 (Josh, 3 Nov 2026): Switch desk for an account with more than one membership; in the local
 * demo, "Try another desk (demo)" opens the desk drawer the who row used to open. Nothing for a
 * signed-in account with one membership.
 */
function DeskRow({ onSwitch, onClose }: { onSwitch: () => void; onClose: () => void }) {
  const session = useContext(SharedSessionContext);
  const switchRole = session?.switchRole;
  if (session && !switchRole) return null;
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        aria-haspopup={switchRole ? undefined : "dialog"}
        data-testid="ward-phone-menu-switch-workstation"
        onClick={() => {
          if (!switchRole) return onSwitch();
          // Close the sheet first, as the executive phone menu does, before the desk changes.
          onClose();
          switchRole();
        }}
      >
        <RowBody icon={Repeat} label={switchRole ? "Switch desk" : "Try another desk (demo)"} />
        <Chevron />
      </button>
    </li>
  );
}

/**
 * Who the menu is for: the desk's person and role, as the rail's person card names them. DK1 (Josh,
 * 3 Nov 2026): it no longer opens "Go to a desk"; the account rows sit under Tools and settings.
 */
function WhoLink() {
  const personaRole = useShellPersonaRole();
  const access = useEffectiveWardAccess();
  const persona = useDeskPersona(access.role === "admin" ? ACCESS_ADMIN_PERSONA : DESK_PERSONAS[personaRole]);
  return (
    <div className={styles.who} data-testid="ward-phone-menu-who">
      <span className={`${styles.avatar} ${styles.avatarInitials}`} aria-hidden="true">
        {persona.initials}
      </span>
      <span className={styles.whoText}>
        <span className={styles.whoName}>{persona.name}</span>
        <span className={styles.whoMeta}>{persona.role}</span>
      </span>
    </div>
  );
}

/** One start on the coordinator's + sheet: a page to open (`href`) or a Tools pop-up (`tool`). */
type CreateItem = {
  key: CreateItemId;
  icon: LucideIcon;
  label: string;
  meta: string;
  href?: string;
  tool?: ToolsSheetToolId;
};

/**
 * More starts the coordinator can add to the + sheet (Josh, 16 Nov 2026: "add more options for
 * editing to pin here"). Each is a Tools pop-up or page this desk already has, with the Tools sheet's
 * own name; they sit under "Not shown" until someone adds or pins one.
 */
const MORE_CREATE_ITEMS: readonly CreateItem[] = [
  { key: "bed-finder", icon: SearchCheck, label: "Find a bed", meta: "Ready beds by ward", tool: "bed-finder" },
  { key: "feed", icon: Inbox, label: "Hospital feed", meta: "Messages to confirm", tool: "feed" },
  { key: "leave-due", icon: CalendarCheck, label: "Due back", meta: "Leave ending today", tool: "leave-due" },
  { key: "messages", icon: MessageSquareText, label: "Bed summary", meta: "Email or Teams text", tool: "messages" },
  { key: "contacts", icon: PhoneCall, label: "On-call", meta: "Who is on now", tool: "contacts" },
  { key: "form-times", icon: CalendarClock, label: "Form times", meta: "When a form runs out", tool: "form-times" },
  { key: "catchment", icon: MapIcon, label: "Suburb lookup", meta: "Team by suburb or postcode", tool: "catchment" },
  { key: "figures", icon: ChartColumn, label: "Key figures", meta: "Beds, flow and waits", tool: "figures" },
  {
    key: "find-patient",
    icon: UserSearch,
    label: "Find a patient",
    meta: "By name, UMRN or place",
    href: "/ward-flow/search",
  },
  { key: "broadcast", icon: Megaphone, label: "Broadcast", meta: "To chosen units", href: "/ward-flow/alerts" },
];

/**
 * The coordinator's + sheet (Josh, 8 Nov 2026, "+ sheet reordered"): New referral alone on top, then
 * the pinned starts as full rows, then the rest as quiet links. Edit (Josh, 15 Nov 2026, D-247) lets
 * each person pin, unpin and reorder them; the arrangement is kept on this device
 * (`ward-create-sheet-store.ts`) and Reset goes back to the standard sheet.
 */
function CoordinatorCreateSheet({
  open,
  onClose,
  returnFocusRef,
  canRefer,
  onNewReferral,
  items,
  onEditBar,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  canRefer: boolean;
  onNewReferral: () => void;
  items: readonly CreateItem[];
  onEditBar?: () => void;
}) {
  const stored = useCreateSheetLayout();
  const [editing, setEditing] = useState(false);
  const focusAfterSave = useRef<string | null>(null);
  const byKey = new Map(items.map((item) => [item.key, item]));
  const layout = resolveCreateLayout(stored, new Set(byKey.keys()));
  const pinned = layout.pinned.flatMap((key) => byKey.get(key) ?? []);
  const links = layout.links.flatMap((key) => byKey.get(key) ?? []);
  const hidden = layout.hidden.flatMap((key) => byKey.get(key) ?? []);
  // A pinned or moved row changes place, so the button that moved it takes focus again there.
  useEffect(() => {
    if (focusAfterSave.current === null) return;
    document.querySelector<HTMLElement>(`[data-create-edit="${focusAfterSave.current}"]`)?.focus();
    focusAfterSave.current = null;
  });
  const close = () => {
    setEditing(false);
    onClose();
  };
  const save = (next: ResolvedCreateLayout, said: string, focus: string) => {
    saveCreateSheetLayout(next);
    announceToWardShell(said);
    focusAfterSave.current = focus;
  };
  const togglePin = (item: CreateItem) => {
    const isPinned = layout.pinned.includes(item.key);
    const without = (list: CreateItemId[]) => list.filter((key) => key !== item.key);
    save(
      isPinned
        ? { pinned: without(layout.pinned), links: [...without(layout.links), item.key], hidden: layout.hidden }
        : {
            pinned: [...without(layout.pinned), item.key],
            links: without(layout.links),
            hidden: without(layout.hidden),
          },
      isPinned ? `${item.label} moved to quick links.` : `${item.label} pinned.`,
      `pin-${item.key}`,
    );
  };
  // More starts (Josh, 16 Nov 2026): minus takes a start off the sheet, plus puts it back as a quick link.
  const toggleShown = (item: CreateItem) => {
    const isHidden = layout.hidden.includes(item.key);
    const without = (list: CreateItemId[]) => list.filter((key) => key !== item.key);
    save(
      isHidden
        ? { pinned: layout.pinned, links: [...layout.links, item.key], hidden: without(layout.hidden) }
        : { pinned: without(layout.pinned), links: without(layout.links), hidden: [...layout.hidden, item.key] },
      isHidden ? `${item.label} added to quick links.` : `${item.label} taken off the sheet.`,
      `show-${item.key}`,
    );
  };
  const move = (group: "pinned" | "links", item: CreateItem, step: -1 | 1) => {
    const list = [...layout[group]];
    const from = list.indexOf(item.key);
    const to = from + step;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    // At the end of the list the button that moved it is gone, so focus goes to the other one.
    const edge = to === 0 || to === list.length - 1;
    save(
      { ...layout, [group]: list },
      `${item.label} moved ${step < 0 ? "up" : "down"}.`,
      `${edge ? (step < 0 ? "down" : "up") : step < 0 ? "up" : "down"}-${item.key}`,
    );
  };
  const reset = () => {
    saveCreateSheetLayout(null);
    announceToWardShell("Back to the standard sheet.");
  };
  const editRows = (group: "pinned" | "links" | "hidden", list: readonly CreateItem[]) => (
    <ul className={`${styles.list} ${styles.rich}`} data-testid={`ward-phone-create-edit-${group}`}>
      {list.length === 0 ? (
        <li className={styles.empty}>
          {group === "pinned"
            ? "Nothing pinned. Pin a start to show it as a full row."
            : group === "links"
              ? "No quick links."
              : "Everything is on the sheet."}
        </li>
      ) : (
        list.map((item, index) => (
          <li key={item.key} className={`${editStyles.editRow} ${editStyles.editRowLead}`}>
            {/* Minus takes it off the sheet; plus, under Not shown, adds it back as a quick link. */}
            <button
              type="button"
              className={`${editStyles.editButton} ${group === "hidden" ? editStyles.editAdd : editStyles.editRemove}`}
              aria-label={group === "hidden" ? `Add ${item.label}` : `Remove ${item.label}`}
              data-create-edit={`show-${item.key}`}
              onClick={() => toggleShown(item)}
            >
              {group === "hidden" ? (
                <CirclePlus aria-hidden="true" strokeWidth={1.75} />
              ) : (
                <CircleMinus aria-hidden="true" strokeWidth={1.75} />
              )}
            </button>
            <RowBody icon={item.icon} label={item.label} />
            <span className={editStyles.editActions}>
              <button
                type="button"
                className={
                  group === "pinned" ? `${editStyles.editButton} ${editStyles.editPinned}` : editStyles.editButton
                }
                aria-label={group === "pinned" ? `Unpin ${item.label}` : `Pin ${item.label}`}
                data-create-edit={`pin-${item.key}`}
                onClick={() => togglePin(item)}
              >
                {/* The pin shows the state: filled in the accent while pinned, an outline while a quick link. */}
                <Pin aria-hidden="true" strokeWidth={1.75} fill={group === "pinned" ? "currentColor" : "none"} />
              </button>
              {/* No arrow at either end of a list (a same-size gap keeps the columns lined up). */}
              {group === "hidden" || index === 0 ? (
                <span className={editStyles.editGap} aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  className={editStyles.editButton}
                  aria-label={`Move ${item.label} up`}
                  data-create-edit={`up-${item.key}`}
                  onClick={() => move(group, item, -1)}
                >
                  <ArrowUp aria-hidden="true" strokeWidth={1.75} />
                </button>
              )}
              {group === "hidden" || index === list.length - 1 ? (
                <span className={editStyles.editGap} aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  className={editStyles.editButton}
                  aria-label={`Move ${item.label} down`}
                  data-create-edit={`down-${item.key}`}
                  onClick={() => move(group, item, 1)}
                >
                  <ArrowDown aria-hidden="true" strokeWidth={1.75} />
                </button>
              )}
            </span>
          </li>
        ))
      )}
    </ul>
  );
  const runItem = (item: CreateItem, event: MouseEvent<HTMLElement>) => {
    close();
    if (item.tool) requestToolsTool(item.tool, event.currentTarget);
  };
  return (
    <Sheet
      id="ward-phone-create"
      testId="ward-phone-create-sheet"
      open={open}
      onClose={close}
      title={editing ? "Edit Create" : "Create"}
      description={editing ? "Pin what you start most. Saved on this phone." : "Start something new"}
      mobileBreakpoint="phone"
      returnFocusRef={returnFocusRef}
      contentClassName={styles.sheet}
      headerClassName={styles.createHead}
      closeButtonClassName={styles.close}
      bodyClassName={`${styles.body} ${styles.createBody}`}
      headerActions={
        <button
          type="button"
          className={editStyles.createEdit}
          aria-pressed={editing}
          data-testid="ward-phone-create-edit"
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? "Done" : "Edit"}
        </button>
      }
    >
      {editing ? (
        <>
          <section className={editStyles.editGroup} aria-labelledby="ward-create-edit-pinned">
            <h3 id="ward-create-edit-pinned" className={styles.createHeading}>
              Pinned
            </h3>
            {editRows("pinned", pinned)}
          </section>
          <section className={editStyles.editGroup} aria-labelledby="ward-create-edit-links">
            <h3 id="ward-create-edit-links" className={styles.createHeading}>
              Quick links
            </h3>
            {editRows("links", links)}
          </section>
          <section className={editStyles.editGroup} aria-labelledby="ward-create-edit-hidden">
            <h3 id="ward-create-edit-hidden" className={styles.createHeading}>
              Not shown
            </h3>
            {editRows("hidden", hidden)}
          </section>
          {stored !== null || onEditBar ? (
            <p className={styles.createMore}>
              {stored !== null ? (
                <button type="button" onClick={reset} data-testid="ward-phone-create-reset">
                  Reset to the standard sheet
                </button>
              ) : null}
              {stored !== null && onEditBar ? <span className={styles.createMoreDot} aria-hidden="true" /> : null}
              {onEditBar ? (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  data-testid="ward-phone-create-edit-bar"
                  onClick={() => {
                    setEditing(false);
                    onEditBar();
                  }}
                >
                  Edit bottom bar
                </button>
              ) : null}
            </p>
          ) : null}
        </>
      ) : (
        <>
          {canRefer ? (
            <div className={styles.createSingle}>
              <button
                type="button"
                className={styles.createPrimary}
                data-testid="ward-phone-create-referral"
                onClick={() => {
                  close();
                  onNewReferral();
                }}
              >
                <Inbox aria-hidden="true" strokeWidth={1.75} />
                New referral
              </button>
            </div>
          ) : null}
          {pinned.length > 0 ? (
            <ul className={`${styles.list} ${styles.rich}`} data-testid="ward-phone-create-coordinator">
              {pinned.map((item) => (
                <li key={item.key}>
                  {item.tool ? (
                    <button
                      type="button"
                      className={styles.row}
                      data-testid={`ward-phone-create-${item.key}`}
                      onClick={(event) => runItem(item, event)}
                    >
                      <RowBody icon={item.icon} label={item.label} meta={<span>{item.meta}</span>} />
                      <Chevron />
                    </button>
                  ) : (
                    <Link
                      href={item.href!}
                      className={styles.row}
                      onClick={close}
                      data-testid={`ward-phone-create-${item.key}`}
                    >
                      <RowBody icon={item.icon} label={item.label} meta={<span>{item.meta}</span>} />
                      <Chevron />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {links.length > 0 ? (
            <p className={styles.createMore} data-testid="ward-phone-create-links">
              {links.map((item, index) => (
                <Fragment key={item.key}>
                  {index > 0 ? <span className={styles.createMoreDot} aria-hidden="true" /> : null}
                  {item.tool ? (
                    <button
                      type="button"
                      data-testid={`ward-phone-create-${item.key}`}
                      onClick={(event) => runItem(item, event)}
                    >
                      {item.label}
                    </button>
                  ) : (
                    <Link href={item.href!} onClick={close} data-testid={`ward-phone-create-${item.key}`}>
                      {item.label}
                    </Link>
                  )}
                </Fragment>
              ))}
            </p>
          ) : null}
        </>
      )}
    </Sheet>
  );
}

function CreateSheet({
  open,
  onClose,
  returnFocusRef,
  byId,
  onNewReferral,
  coordinator = false,
  onEditBar,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  byId: ReadonlyMap<string, RailEntry>;
  onNewReferral: () => void;
  onEditBar?: () => void;
  /** The coordinator's + leads with the phone work of the day (Josh, 8 Nov 2026). */
  coordinator?: boolean;
}) {
  const { canRefer, canTriage, ids } = usePhoneCreateOptions(byId);
  const canOpen = useCanOpenHref();
  // shell-2: on a ward's own page, Update a bed opens that ward's beds, not the statewide list.
  const currentUnitId = /^\/ward-flow\/(?:ward|board)\/([^/?#]+)/u.exec(usePathname() ?? "")?.[1];
  const rows = CREATE_LINKS.flatMap((item) => {
    if (!ids.includes(item.id)) return [];
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
  // Coordinator (Josh, 8 Nov 2026, "+ sheet reordered"): New referral alone on top, then the calls
  // and asks a coordinator makes all day, then the rarer starts as quiet links underneath.
  // Triage on the phone (Josh, 15 Nov 2026, D-247): New triage is a full row under New referral, with
  // how many referrals await it, not a quiet link at the foot of the sheet.
  const awaitingTriage = useAwaitingTriageCount();
  const coordItems: CreateItem[] = coordinator
    ? (
        [
          ...(canTriage
            ? [
                {
                  key: "triage" as const,
                  icon: ClipboardList,
                  label: "New triage",
                  meta: awaitingTriage > 0 ? `${awaitingTriage} awaiting triage` : "Choose the person, then the form",
                  href: WARD_TRIAGE_NEW_HREF,
                },
              ]
            : []),
          {
            key: "call-log" as const,
            icon: PhoneOutgoing,
            label: "Log a call",
            meta: "What a ward or team told you",
            tool: "call-log" as const,
          },
          {
            key: "ask" as const,
            icon: Send,
            label: "Ask wards for a bed",
            meta: "Choose the patient, then the wards",
            href: "/ward-flow/waiting",
          },
          {
            key: "transport" as const,
            icon: Ambulance,
            label: "Book transport",
            meta: "For a patient ready to move",
            href: "/ward-flow/transport/officer",
          },
          {
            key: "remind" as const,
            icon: BellRing,
            label: "Remind me",
            meta: "A nudge at a set time",
            tool: "remind" as const,
          },
          ...CREATE_LINKS.filter((item) => ids.includes(item.id)).map((item) => ({
            key: item.id,
            icon: item.icon,
            label: item.label,
            meta: item.meta,
            href:
              item.id === "wards" && currentUnitId !== undefined
                ? unitHref(decodeURIComponent(currentUnitId))
                : (item.href ?? byId.get(item.id)?.href),
          })),
          // More starts (Josh, 16 Nov 2026): the coordinator's own Tools, off the sheet until added.
          ...MORE_CREATE_ITEMS,
        ] as CreateItem[]
      ).filter((row) => row.tool !== undefined || (row.href !== undefined && canOpen(row.href)))
    : [];
  if (coordinator) {
    return (
      <CoordinatorCreateSheet
        open={open}
        onClose={onClose}
        returnFocusRef={returnFocusRef}
        canRefer={canRefer}
        onNewReferral={onNewReferral}
        items={coordItems}
        onEditBar={onEditBar}
      />
    );
  }
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
      {/* Triage and risk (built 7 Nov 2026): New triage beside New referral. */}
      <div className={canRefer && canTriage ? styles.createPair : styles.createSingle}>
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
        {canTriage ? (
          <Link
            href={WARD_TRIAGE_NEW_HREF}
            // Josh (7 Nov 2026): one filled button per sheet. New triage is the outlined one.
            className={canRefer ? `${styles.createPrimary} ${styles.createOutline}` : styles.createPrimary}
            data-testid="ward-phone-create-triage"
            onClick={onClose}
          >
            <ClipboardList aria-hidden="true" strokeWidth={1.75} />
            New triage
          </Link>
        ) : null}
      </div>
      {rows.length > 0 ? (
        <ul className={`${styles.list} ${styles.rich}`}>{rows}</ul>
      ) : canRefer || canTriage ? null : (
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
const loadMenuResults = () => import("@/components/ward-management/shell/ward-phone-menu-results");
type MenuSearchResultsProps = ComponentProps<
  (typeof import("@/components/ward-management/shell/ward-phone-menu-results"))["MenuSearchResults"]
>;
// A failed load (offline before the code arrived) draws `MenuSearchRetry` in its place rather than
// failing the whole shell.
const MenuSearchResults = dynamic(
  withLoadRetry(() =>
    loadMenuResults().then(
      (m) => m.MenuSearchResults,
      () => MenuSearchRetry,
    ),
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
  onSwitch,
  activityRow,
  triageRow,
  onEditBar,
}: {
  onSwitch: () => void;
  activityRow?: boolean;
  onEditBar?: () => void;
  /**
   * Start a triage for a desk that may triage (Josh, 15 Nov 2026, D-247): straight after Referrals,
   * or at the end of the desk's own section where Referrals sits in the dock.
   */
  triageRow?: ReactNode;
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
  const hasReferralsRow = groups.some((group) => group.entries.some((entry) => entry.id === "referrals"));
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
      {groups.map((group, groupIndex) => (
        <Section key={group.label} label={group.label}>
          {group.entries.map((entry) =>
            isRoleMenuAction(entry) ? (
              <ActionRow key={entry.id} action={entry} onClose={onClose} />
            ) : entry.id === "referrals" && triageRow ? (
              <Fragment key={entry.id}>
                {pageRow(entry)}
                {triageRow}
              </Fragment>
            ) : (
              pageRow(entry)
            ),
          )}
          {/* A desk whose dock carries Referrals (ward, ED, community) has no Referrals row here, so
              Start a triage ends the desk's own section instead. */}
          {groupIndex === 0 && !hasReferralsRow ? triageRow : null}
        </Section>
      ))}
      <WardMyWards variant="sheet" onNavigate={onClose} />
      <MoreSection
        onDrawer={onDrawer}
        onClose={onClose}
        onSwitch={onSwitch}
        activityRow={activityRow}
        onEditBar={onEditBar}
      />
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
  pathname,
  shellRole,
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
  top,
  activityRow,
  bar,
}: {
  /** Edit bar (Josh, 16 Nov 2026): the bottom bar's spots, their choices, and saving them. */
  bar: EditBarProps;
  /** shell-next: drawn under the search box while nothing is typed. */
  top?: ReactNode;
  /** Activity gets a Menu row when the dock does not carry it (Josh, 8 Nov 2026). */
  activityRow?: boolean;
  open: boolean;
  onClose: () => void;
  query: string;
  onQuery: (value: string) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  /** The shell's role. The who row now names the desk's person instead (DK1). */
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
  // Triage on the phone (Josh, 15 Nov 2026, D-247): Start a triage gets a Menu row, with how many
  // referrals await it, for every desk that may sign one (the + sheet's own test). A pen on the
  // clipboard, as Handover's clipboard list sits just below it in the Menu.
  const { canTriage } = usePhoneCreateOptions(byId);
  const awaitingTriage = useAwaitingTriageCount();
  const triageRow = canTriage
    ? pageRow(
        { id: "triage-new", href: WARD_TRIAGE_NEW_HREF, label: "Start a triage", icon: ClipboardPen },
        awaitingTriage > 0 ? { value: awaitingTriage, noun: "awaiting triage", urgent: false } : undefined,
      )
    : undefined;
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
        headerLeading={<WhoLink />}
        contentClassName={styles.sheet}
        headerClassName={styles.head}
        titleClassName="sr-only"
        closeButtonClassName={styles.close}
        bodyClassName={styles.body}
      >
        <MenuSearch query={query} onQuery={onQuery} />
        {query.trim() ? null : top}
        <MenuPages
          query={query}
          entries={entries}
          needs={needs}
          groups={groups}
          pageRow={pageRow}
          triageRow={triageRow}
          onResult={(item) => {
            announceToWardShell(`${item.title}.`);
            onClose();
          }}
          onDrawer={onDrawer}
          activityRow={activityRow}
          onClose={onClose}
          onSwitch={onSwitch}
          onEditBar={bar.options.length > 1 ? bar.onOpen : undefined}
        />
      </Sheet>

      {switcherOpen ? <OperatorSwitcherModal isOpen onClose={onCloseSwitcher} /> : null}

      <CreateSheet
        open={createOpen}
        onClose={onCloseCreate}
        returnFocusRef={returnFocusRef}
        byId={byId}
        onNewReferral={onNewReferral}
        coordinator={shellRole === "coordinator"}
        onEditBar={bar.options.length > 1 ? bar.onOpen : undefined}
      />

      <EditBarSheet {...bar} returnFocusRef={returnFocusRef} />
    </>
  );
}

/** What `next-phone-menu.tsx` hands the Edit bar sheet. */
export type EditBarProps = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Every choice this desk has for a spot, under the Menu's own groups. */
  options: readonly DockOption[];
  /** Each spot's key now, or null where the desk cannot open that spot (it is not drawn). */
  current: readonly (string | null)[];
  /** Each spot's standard key, for a spot this desk cannot open and for Reset. */
  standard: readonly string[];
  /** How many spots sit left of the +. */
  leftCount: number;
  /** Whether this desk's bar differs from the standard one on this device. */
  chosen: boolean;
  /** Saves every spot in order; `null` goes back to the standard bar. */
  onSave: (slots: readonly string[] | null) => void;
};

/** A spot's icon in the Edit bar picture, as the bar draws it. */
function BarIcon({ icon: Icon }: { icon: typeof Plus | undefined }) {
  return Icon ? <Icon aria-hidden="true" strokeWidth={1.75} /> : null;
}

/** A spot's name, from where it sits beside the +. */
function spotName(index: number, leftCount: number, total: number): string {
  if (index < leftCount) return leftCount > 1 && index === 0 ? "Far left" : "Left of +";
  return total - leftCount > 1 && index === total - 1 ? "Far right" : "Right of +";
}

/**
 * Edit bar (Josh, 16 Nov 2026: "allow for change of option for the main action bar also"). One
 * picker per spot of the bottom bar, the + staying in the middle. Choosing what another spot already
 * opens swaps the two, so nothing is ever in the bar twice. Saved on this phone, for this desk only.
 */
function EditBarSheet({
  open,
  onClose,
  options,
  current,
  standard,
  leftCount,
  chosen,
  onSave,
  returnFocusRef,
}: EditBarProps & { returnFocusRef: RefObject<HTMLButtonElement | null> }) {
  const labelFor = new Map(options.map((option) => [option.key, option.label]));
  const iconFor = new Map(options.map((option) => [option.key, option.icon]));
  const groups = [...new Set(options.map((option) => option.group))];
  const choose = (index: number, key: string) => {
    const next = current.map((slot, at) => slot ?? standard[at]);
    const from = next.indexOf(key);
    if (from === index) return;
    // A choice already in another spot swaps places with this spot's.
    if (from >= 0) next[from] = next[index];
    next[index] = key;
    onSave(next);
    announceToWardShell(
      from >= 0
        ? `${labelFor.get(key) ?? "That"} swapped with ${labelFor.get(next[from]) ?? "the other spot"}.`
        : `${spotName(index, leftCount, current.length)} now opens ${labelFor.get(key) ?? "that"}.`,
    );
  };
  return (
    <Sheet
      id="ward-phone-edit-bar"
      testId="ward-phone-edit-bar"
      open={open}
      onClose={onClose}
      title="Edit bottom bar"
      description="Choose what each spot opens. The + stays in the middle. Saved on this phone."
      mobileBreakpoint="phone"
      returnFocusRef={returnFocusRef}
      contentClassName={styles.sheet}
      headerClassName={styles.createHead}
      closeButtonClassName={styles.close}
      bodyClassName={`${styles.body} ${styles.createBody}`}
    >
      {/* A picture of the bar as it will look; the pickers below say the same in words. */}
      <div className={editStyles.barPreview} aria-hidden="true" data-testid="ward-phone-edit-bar-preview">
        {current.map((key, index) => (
          <Fragment key={index}>
            {index === leftCount ? (
              <span className={editStyles.barPlus}>
                <Plus aria-hidden="true" strokeWidth={2} />
              </span>
            ) : null}
            <span className={editStyles.barSpot}>
              {key === null ? null : <BarIcon icon={iconFor.get(key)} />}
              {key === null ? "" : (labelFor.get(key) ?? "")}
            </span>
          </Fragment>
        ))}
      </div>
      <section className={editStyles.barSpots} aria-label="Spots">
        {current.map((key, index) =>
          key === null ? null : (
            <Field
              key={index}
              label={spotName(index, leftCount, current.length)}
              layout="row"
              className={editStyles.barField}
            >
              <Select
                value={key}
                data-testid={`ward-phone-edit-bar-spot-${index}`}
                onChange={(event) => choose(index, event.currentTarget.value)}
              >
                {groups.map((group) => (
                  <optgroup key={group} label={group}>
                    {options
                      .filter((option) => option.group === group)
                      .map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
          ),
        )}
      </section>
      {chosen ? (
        <p className={styles.createMore}>
          <button
            type="button"
            data-testid="ward-phone-edit-bar-reset"
            onClick={() => {
              onSave(null);
              announceToWardShell("Back to the standard bar.");
            }}
          >
            Reset to the standard bar
          </button>
        </p>
      ) : null}
    </Sheet>
  );
}
