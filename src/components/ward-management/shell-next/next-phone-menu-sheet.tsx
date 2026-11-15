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
  CircleHelp,
  ClipboardList,
  ClipboardPen,
  Inbox,
  Clock3,
  LogOut,
  PhoneOutgoing,
  Pin,
  Plus,
  Repeat,
  Search,
  Send,
  Settings,
  UserPlus,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Sheet } from "@/components/wf/sheet";
import { Dot } from "@/components/wf";
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
}: {
  onDrawer: (id: DrawerId) => void;
  onClose: () => void;
  onSwitch: () => void;
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
  tool?: "call-log" | "remind";
};

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
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  canRefer: boolean;
  onNewReferral: () => void;
  items: readonly CreateItem[];
}) {
  const stored = useCreateSheetLayout();
  const [editing, setEditing] = useState(false);
  const focusAfterSave = useRef<string | null>(null);
  const byKey = new Map(items.map((item) => [item.key, item]));
  const layout = resolveCreateLayout(stored, new Set(byKey.keys()));
  const pinned = layout.pinned.flatMap((key) => byKey.get(key) ?? []);
  const links = layout.links.flatMap((key) => byKey.get(key) ?? []);
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
  const save = (next: { pinned: CreateItemId[]; links: CreateItemId[] }, said: string, focus: string) => {
    saveCreateSheetLayout(next);
    announceToWardShell(said);
    focusAfterSave.current = focus;
  };
  const togglePin = (item: CreateItem) => {
    const isPinned = layout.pinned.includes(item.key);
    const without = (list: CreateItemId[]) => list.filter((key) => key !== item.key);
    save(
      isPinned
        ? { pinned: without(layout.pinned), links: [...without(layout.links), item.key] }
        : { pinned: [...without(layout.pinned), item.key], links: without(layout.links) },
      isPinned ? `${item.label} moved to quick links.` : `${item.label} pinned.`,
      `pin-${item.key}`,
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
  const editRows = (group: "pinned" | "links", list: readonly CreateItem[]) => (
    <ul className={`${styles.list} ${styles.rich}`} data-testid={`ward-phone-create-edit-${group}`}>
      {list.length === 0 ? (
        <li className={styles.empty}>
          {group === "pinned" ? "Nothing pinned. Pin a start to show it as a full row." : "No quick links."}
        </li>
      ) : (
        list.map((item, index) => (
          <li key={item.key} className={editStyles.editRow}>
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
              <button
                type="button"
                className={editStyles.editButton}
                aria-label={`Move ${item.label} up`}
                data-create-edit={`up-${item.key}`}
                disabled={index === 0}
                onClick={() => move(group, item, -1)}
              >
                <ArrowUp aria-hidden="true" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                className={editStyles.editButton}
                aria-label={`Move ${item.label} down`}
                data-create-edit={`down-${item.key}`}
                disabled={index === list.length - 1}
                onClick={() => move(group, item, 1)}
              >
                <ArrowDown aria-hidden="true" strokeWidth={1.75} />
              </button>
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
          {stored !== null ? (
            <p className={styles.createMore}>
              <button type="button" onClick={reset} data-testid="ward-phone-create-reset">
                Reset to the standard sheet
              </button>
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
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  byId: ReadonlyMap<string, RailEntry>;
  onNewReferral: () => void;
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
}: {
  onSwitch: () => void;
  activityRow?: boolean;
  /** Start a triage, listed straight after Referrals for a desk that may triage (Josh, 15 Nov 2026). */
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
        </Section>
      ))}
      <WardMyWards variant="sheet" onNavigate={onClose} />
      <MoreSection onDrawer={onDrawer} onClose={onClose} onSwitch={onSwitch} activityRow={activityRow} />
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
}: {
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
      />
    </>
  );
}
