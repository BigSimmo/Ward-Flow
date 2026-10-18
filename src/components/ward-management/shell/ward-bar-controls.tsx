"use client";

// The bar's own controls, moved out of `ward-bar.tsx` to keep it under the line cap: the phone
// Menu entry, the Service selector with its sheet, the drawer buttons and the primary action.
import Link from "next/link";
import {
  Bell,
  Hospital,
  Plus,
  Siren,
  Users,
  Check,
  ChevronDown,
  ClipboardCheck,
  ListChecks,
  Menu as MenuIcon,
  RotateCcwClock,
  Wrench,
} from "lucide-react";
import type { RefObject } from "react";

import { waitingText, type waitingInEds } from "@/components/ward-management/ward-shared-figures";
import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";
import type {
  ReferralSheetCategory,
  ReferralSheetRequest,
} from "@/components/ward-management/referrals/referral-sheet-link";

import { announceToWardShell } from "./ward-live-region";
import { WardPhoneMenu } from "./ward-phone-menu";
import { openWardMenu } from "./ward-drawer-bus";
import type { WardActivityContent, WardPrimaryAction } from "./ward-shell-types";
import {
  NOT_WIRED_SUFFIX,
  SERVICE_SCOPE_NOTE,
  SERVICE_SCOPE_SHEET_LINE,
  SERVICE_SWATCH_KEY,
  type WardBarPopoverId,
} from "./ward-bar-model";
import styles from "./ward-bar.module.css";

/**
 * The phone bar's Menu button and the phone menu it opens. The menu opens only on the phone; above
 * 48rem the rail's own sheet answers Menu.
 */
export function PhoneMenuEntry({
  menuRef,
  tasksCount,
  activityUnread,
  roleCategory,
  onOpenDrawer,
  onOpenReferral,
  liveOverSheet,
}: {
  /** Keeps Menu tappable while a sheet sits below the bar (see `headerLiveOverSheet`). */
  liveOverSheet: boolean;
  menuRef: RefObject<HTMLButtonElement | null>;
  tasksCount: number;
  activityUnread: number;
  roleCategory: ReferralSheetCategory;
  onOpenDrawer: (id: "tasks" | "activity" | "tools") => void;
  onOpenReferral: (request: ReferralSheetRequest, returnFocus: HTMLElement | null) => void;
}) {
  return (
    <>
      <button
        type="button"
        ref={menuRef}
        className={styles.phoneOnly}
        aria-label="Menu"
        aria-haspopup="dialog"
        aria-controls="ward-phone-menu"
        data-testid="ward-bar-phone-menu"
        data-sheet-inert-skip={liveOverSheet ? "" : undefined}
        onClick={(event) => openWardMenu(event.currentTarget)}
      >
        <MenuIcon aria-hidden="true" strokeWidth={1.75} />
      </button>
      <WardPhoneMenu
        returnFocusRef={menuRef}
        tasksCount={tasksCount}
        activityUnread={activityUnread}
        onOpenDrawer={onOpenDrawer}
        onNewReferral={() => onOpenReferral({ category: roleCategory }, menuRef.current)}
      />
    </>
  );
}

/** The Service selector: the scope badge, its live line on the phone, and the panel or sheet. */
export function WardBarServiceSelector({
  serviceTriggerRef,
  servicePanelRef,
  activeSwatchKey,
  isPhone,
  bandState,
  isFixedJurisdiction,
  openPanel,
  activeService,
  activeServiceBadgeLabel,
  routeTitle,
  closePopover,
  openPopover,
  scopeWaitingCount,
  service,
  selectService,
  allWaitingCount,
  waiting,
}: {
  serviceTriggerRef: RefObject<HTMLButtonElement | null>;
  servicePanelRef: RefObject<HTMLDivElement | null>;
  activeSwatchKey: string;
  isPhone: boolean;
  bandState: "ink" | "light" | undefined;
  isFixedJurisdiction: boolean;
  openPanel: WardBarPopoverId | null;
  activeService: HealthService | null | undefined;
  activeServiceBadgeLabel: string;
  routeTitle: string;
  closePopover: (id: WardBarPopoverId, announce?: boolean) => void;
  openPopover: (id: WardBarPopoverId) => void;
  scopeWaitingCount: number;
  service: HealthService | null;
  selectService: (next: HealthService | null) => void;
  allWaitingCount: number;
  waiting: ReturnType<typeof waitingInEds>;
}) {
  // Opted out of the React Compiler: before the 18 Oct 2026 file split this code ran unmemoised
  // inside WardBar, which the compiler skips. Memoising it changed nothing visible but added
  // several KB to the phone download (script-budget.json).
  "use no memo";
  return (
    <div className={styles.scopeBadgeContainer}>
      <button
        type="button"
        ref={serviceTriggerRef}
        className={styles.scopeBadgeBtn}
        data-testid="ward-bar-service-trigger"
        data-service={activeSwatchKey}
        // The phone service line takes the band's ink from its own attribute: CI WebKit did not
        // restyle it from the bar's data-band alone (release gate, 15 Oct 2026).
        data-band={isPhone ? bandState : undefined}
        data-locked={isFixedJurisdiction ? "true" : undefined}
        aria-haspopup={isFixedJurisdiction ? undefined : isPhone ? "dialog" : "true"}
        aria-expanded={isFixedJurisdiction ? undefined : openPanel === "service"}
        aria-controls={isFixedJurisdiction ? undefined : "ward-bar-service-panel"}
        aria-label={isFixedJurisdiction ? `Jurisdiction: ${activeService}` : `Service: ${activeServiceBadgeLabel}`}
        onClick={() => {
          if (isFixedJurisdiction) {
            announceToWardShell(`${routeTitle} is in ${activeService}.`);
            return;
          }
          if (openPanel === "service") {
            closePopover("service", false);
          } else {
            openPopover("service");
          }
        }}
      >
        <span className={styles.scopeDot} aria-hidden="true" />
        <span className={styles.scopeBadgeLabel}>{activeServiceBadgeLabel}</span>
        {!isFixedJurisdiction && <ChevronDown className={styles.scopeCaret} aria-hidden="true" strokeWidth={1.75} />}
        <span className="sr-only">{activeServiceBadgeLabel}</span>
      </button>
      {isPhone ? (
        <span className={styles.scopeLive} aria-hidden="true">
          {scopeWaitingCount} waiting · {activeServiceBadgeLabel}
        </span>
      ) : null}

      {isPhone && !isFixedJurisdiction && openPanel === "service" ? (
        <div
          className={styles.serviceScrim}
          data-ward-service-scrim=""
          data-sheet-inert-skip=""
          aria-hidden="true"
          onClick={() => closePopover("service", false)}
        />
      ) : null}
      {!isFixedJurisdiction && openPanel === "service" ? (
        <div
          id="ward-bar-service-panel"
          ref={servicePanelRef}
          className={styles.servicePanel}
          role={isPhone ? "dialog" : "group"}
          aria-modal={isPhone ? true : undefined}
          aria-label="Choose a health service"
          data-testid="ward-bar-service-panel"
        >
          <p className={styles.popoverHead}>Service</p>
          {/* Phone (v10 service sheet): the quiet line under the title. */}
          <p className={styles.serviceSheetNote} aria-hidden="true">
            {SERVICE_SCOPE_SHEET_LINE}
          </p>
          <p className="sr-only">{SERVICE_SCOPE_NOTE}</p>
          <button
            type="button"
            className={styles.serviceOption}
            aria-pressed={service === null}
            onClick={() => selectService(null)}
          >
            <span className={styles.serviceDot} data-service="statewide" aria-hidden="true" />
            {/* shell-23 (13 Oct 2026): one word. The header says Statewide, so the option does too. */}
            <span className={styles.serviceName}>Statewide</span>
            <span className={`${styles.serviceOptionCount} ${styles.serviceAllCount}`} aria-hidden="true">
              {waitingText(allWaitingCount)}
            </span>
            <Check className={styles.serviceCheck} aria-hidden="true" data-visible={service === null} />
          </button>
          <hr className={styles.popoverRule} />
          {HEALTH_SERVICES.map((candidate) => {
            const waitingCount = waiting.byService.get(candidate) ?? 0;
            return (
              <button
                key={candidate}
                type="button"
                className={styles.serviceOption}
                aria-pressed={service === candidate}
                onClick={() => selectService(candidate)}
              >
                <span className={styles.serviceDot} data-service={SERVICE_SWATCH_KEY[candidate]} aria-hidden="true" />
                <span className={styles.serviceName}>{candidate}</span>
                <span className={styles.serviceOptionCount} aria-hidden="true">
                  {waitingText(waitingCount)}
                </span>
                <Check className={styles.serviceCheck} aria-hidden="true" data-visible={service === candidate} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** The Activity, Tasks (or Alerts) and Tools buttons that open the bar's drawers. */
export function WardBarDrawerTriggers({
  activityTriggerRef,
  tasksTriggerRef,
  toolsTriggerRef,
  openPanel,
  closePopover,
  openPopover,
  activityHasUnread,
  unreadNoticeCount,
  shownActivity,
  oneAlertsQueue,
  isPhone,
  onAlertsScreen,
  tasksActiveCount,
}: {
  activityTriggerRef: RefObject<HTMLButtonElement | null>;
  tasksTriggerRef: RefObject<HTMLButtonElement | null>;
  toolsTriggerRef: RefObject<HTMLButtonElement | null>;
  openPanel: WardBarPopoverId | null;
  closePopover: (id: WardBarPopoverId, announce?: boolean) => void;
  openPopover: (id: WardBarPopoverId) => void;
  activityHasUnread: boolean;
  unreadNoticeCount: number;
  shownActivity: WardActivityContent;
  oneAlertsQueue: boolean;
  isPhone: boolean;
  onAlertsScreen: boolean;
  tasksActiveCount: number;
}) {
  // Opted out of the React Compiler, like the component above.
  "use no memo";
  return (
    <div className={styles.drawerTriggers}>
      <button
        type="button"
        ref={activityTriggerRef}
        className={styles.drawerTrigger}
        data-bar-mode="activity"
        data-testid="ward-bar-activity-trigger"
        aria-haspopup="dialog"
        aria-expanded={openPanel === "activity"}
        aria-controls="ward-bar-activity-drawer"
        onClick={() => (openPanel === "activity" ? closePopover("activity", false) : openPopover("activity"))}
      >
        <RotateCcwClock className={styles.triggerIcon} aria-hidden="true" strokeWidth={1.75} />
        <span className={styles.triggerLabel}>Activity</span>
        {activityHasUnread ? <span className={styles.unread} aria-hidden="true" /> : null}
        <span className="sr-only">
          {shownActivity ? ", synthetic activity" : ", activity not available for this page"}
          {activityHasUnread ? `, ${unreadNoticeCount} unread` : ""}
        </span>
      </button>

      <button
        type="button"
        ref={tasksTriggerRef}
        className={styles.drawerTrigger}
        data-bar-mode="tasks"
        data-testid="ward-bar-tasks-trigger"
        aria-haspopup={oneAlertsQueue && (isPhone || onAlertsScreen) ? undefined : "dialog"}
        aria-expanded={oneAlertsQueue && (isPhone || onAlertsScreen) ? undefined : openPanel === "tasks"}
        aria-controls={oneAlertsQueue && (isPhone || onAlertsScreen) ? undefined : "ward-bar-tasks-drawer"}
        aria-current={onAlertsScreen ? "page" : undefined}
        onClick={() => (openPanel === "tasks" ? closePopover("tasks", false) : openPopover("tasks"))}
      >
        {oneAlertsQueue ? (
          <Bell className={styles.triggerIcon} aria-hidden="true" strokeWidth={1.75} />
        ) : (
          <>
            <ListChecks className={`${styles.triggerIcon} ${styles.tasksWide}`} aria-hidden="true" strokeWidth={1.75} />
            {/* Phone (v10 lean bar): the clipboard. CSS shows one of the two, so desktop is unchanged. */}
            <ClipboardCheck
              className={`${styles.triggerIcon} ${styles.tasksPhone}`}
              aria-hidden="true"
              strokeWidth={1.75}
            />
          </>
        )}
        <span className={styles.triggerLabel}>{oneAlertsQueue ? "Alerts" : "Tasks"}</span>
        <span className={styles.badge} data-zero={tasksActiveCount === 0 || undefined}>
          {tasksActiveCount}
        </span>
      </button>

      <button
        type="button"
        ref={toolsTriggerRef}
        className={styles.drawerTrigger}
        data-bar-mode="tools"
        data-testid="ward-bar-tools-trigger"
        aria-haspopup="dialog"
        aria-expanded={openPanel === "tools"}
        aria-controls="ward-bar-tools-drawer"
        onClick={() => (openPanel === "tools" ? closePopover("tools", false) : openPopover("tools"))}
      >
        <Wrench className={styles.triggerIcon} aria-hidden="true" strokeWidth={1.75} />
        <span className={styles.triggerLabel}>Tools</span>
        <ChevronDown className={styles.triggerCaret} aria-hidden="true" strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** The bar's one primary action: New referral's menu, or a not-wired action's popover. */
export function WardBarPrimaryAction({
  primaryAction,
  primaryTriggerRef,
  primaryPanelRef,
  openPanel,
  closePopover,
  openPopover,
  openReferral,
  roleCategory,
}: {
  primaryAction: WardPrimaryAction | undefined;
  primaryTriggerRef: RefObject<HTMLButtonElement | null>;
  primaryPanelRef: RefObject<HTMLDivElement | null>;
  openPanel: WardBarPopoverId | null;
  closePopover: (id: WardBarPopoverId, announce?: boolean) => void;
  openPopover: (id: WardBarPopoverId) => void;
  openReferral: (request: ReferralSheetRequest, returnFocus: HTMLElement | null) => void;
  roleCategory: ReferralSheetCategory;
}) {
  // Opted out of the React Compiler, like the component above.
  "use no memo";
  return (
    <>
      {primaryAction && primaryAction.kind !== "none" ? <span className={styles.vsep} aria-hidden="true" /> : null}
      {primaryAction?.kind === "new-referral" ? (
        <div className={styles.primaryWrap}>
          <button
            type="button"
            ref={primaryTriggerRef}
            className={`${styles.primary} ${styles.referralPrimary}`}
            data-testid="ward-bar-primary-action"
            aria-haspopup="true"
            aria-expanded={openPanel === "primary"}
            aria-controls="ward-bar-primary-panel"
            onClick={() => (openPanel === "primary" ? closePopover("primary", false) : openPopover("primary"))}
          >
            <Plus className={styles.primaryIcon} aria-hidden="true" strokeWidth={1.75} />
            <span className={styles.primaryPrefix}>New </span>
            <span className={styles.primaryMain}>referral</span>
            <span className={styles.referralChevron} aria-hidden="true">
              <ChevronDown className={styles.triggerCaret} aria-hidden="true" strokeWidth={1.75} />
            </span>
          </button>
          {openPanel === "primary" ? (
            <div
              id="ward-bar-primary-panel"
              ref={primaryPanelRef}
              className={styles.primaryPanel}
              role="menu"
              aria-label={primaryAction.label}
              data-testid="ward-bar-primary-panel"
            >
              {primaryAction.menu.map((entry) => {
                const MenuIcon =
                  entry.destination === "community" ? Users : entry.destination === "ed" ? Siren : Hospital;
                return (
                  <Link
                    key={entry.destination}
                    href={entry.href}
                    role="menuitem"
                    className={styles.primaryMenuItem}
                    data-testid={`ward-bar-primary-menu-${entry.destination}`}
                    onClick={(e) => {
                      e.preventDefault();
                      openReferral(
                        { category: roleCategory, destination: entry.destination },
                        primaryTriggerRef.current,
                      );
                    }}
                  >
                    <MenuIcon className={styles.menuIcon} aria-hidden="true" strokeWidth={1.75} />
                    {entry.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : primaryAction && primaryAction.kind !== "none" ? (
        <div className={styles.primaryWrap}>
          <button
            type="button"
            ref={primaryTriggerRef}
            className={`${styles.primary} ${styles.referralPrimary}`}
            data-testid="ward-bar-primary-action"
            aria-haspopup="true"
            aria-expanded={openPanel === "primary"}
            aria-controls="ward-bar-primary-panel"
            onClick={() => {
              if (openPanel === "primary") {
                closePopover("primary", false);
                return;
              }
              openPopover("primary");
              announceToWardShell(`${primaryAction.label} ${NOT_WIRED_SUFFIX}`);
            }}
          >
            <span className={styles.primaryMain}>{primaryAction.label}</span>
            <span className={styles.referralChevron} aria-hidden="true">
              <ChevronDown className={styles.triggerCaret} aria-hidden="true" strokeWidth={1.75} />
            </span>
          </button>
          {openPanel === "primary" ? (
            <div
              id="ward-bar-primary-panel"
              ref={primaryPanelRef}
              className={styles.primaryPanel}
              role="group"
              aria-label={primaryAction.label}
              data-testid="ward-bar-primary-panel"
            >
              <p className={styles.popoverHead}>{primaryAction.label}</p>
              <p className={styles.popoverNote}>Not wired in this prototype.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
