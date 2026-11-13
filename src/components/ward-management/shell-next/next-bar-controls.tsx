"use client";

// Fork of src/components/ward-management/shell/ward-bar-controls.tsx: the mock-ups' bar controls.

// The bar's own controls, moved out of `ward-bar.tsx` to keep it under the line cap: the phone
// Menu entry, the Service selector with its sheet, the drawer buttons and the primary action.
import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Plus, Check, ChevronDown, Menu as MenuIcon, RotateCcwClock, Wrench } from "lucide-react";
import { useCallback, useState, type KeyboardEvent, type RefObject } from "react";

import { ContextualBackLink, navigateContextuallyBack } from "@/components/contextual-back-link";
import { waitingText, type waitingInEds } from "@/components/ward-management/ward-shared-figures";
import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";
import type {
  ReferralSheetCategory,
  ReferralSheetRequest,
} from "@/components/ward-management/referrals/referral-sheet-link";

import { WARD_REFERRAL_INTAKE_HREF, WARD_TRIAGE_NEW_HREF } from "@/components/ward-management/ward-nav";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import type { NewMenuKind } from "@/components/ward-management/shell-next/next-new-menu";
import { NEW_MENU_ID } from "@/components/ward-management/shell-next/next-new-menu-id";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { NextPhoneMenu } from "@/components/ward-management/shell-next/next-phone-menu";
import { hasMovedInWardFlow, markWardRouteReplace } from "@/components/ward-management/shell/ward-back";
import { openWardMenu } from "@/components/ward-management/shell/ward-drawer-bus";
import type { WardPrimaryAction } from "@/components/ward-management/shell/ward-shell-types";
import {
  NOT_WIRED_SUFFIX,
  SERVICE_SCOPE_NOTE,
  SERVICE_SCOPE_SHEET_LINE,
  type WardBarPopoverId,
} from "@/components/ward-management/shell/ward-bar-model";
import styles from "@/components/ward-management/shell/ward-bar.module.css";
import polish from "@/components/ward-management/shell-next/next-bar.module.css";

/**
 * The header's Back control (`ward-back.ts`): the previous Ward Flow screen, else `parentHref`.
 * `phone` draws it as a button in the Menu button's place on a phone, where `buttonRef` makes it the
 * phone sheets' focus return; otherwise it is a link leading the tablet and desktop bar.
 */
/**
 * Audit 7 NB-06: the phone Back is a button, so the unsaved-changes guard's link listener never sees
 * it. With no Ward Flow history it replaces the page, and a half-typed form was dropped without the
 * question the desktop Back link asks. Ask the same mounted guards first.
 */
export function confirmLeavingShell(proceed?: () => void): boolean {
  if (typeof window === "undefined") return true;
  // With the kit's styled confirm mounted, the guard returns false at once, asks, and on Leave
  // without saving runs `proceed`, which passes this check once. Without it, the browser asks.
  const confirmNavigation = (
    window as typeof window & { __wardFlowConfirmNavigation?: (proceed?: () => void) => boolean }
  ).__wardFlowConfirmNavigation;
  return confirmNavigation ? confirmNavigation(proceed) : true;
}

export function WardBarBack({
  parentHref,
  phone,
  liveOverSheet = false,
  buttonRef,
}: {
  parentHref: string;
  phone: boolean;
  liveOverSheet?: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const router = useRouter();
  if (phone) {
    return (
      <button
        type="button"
        ref={buttonRef}
        className={`${styles.phoneOnly} ${styles.phoneBack}`}
        aria-label="Back"
        data-testid="ward-bar-phone-back"
        data-sheet-inert-skip={liveOverSheet ? "" : undefined}
        onClick={function goBack() {
          navigateContextuallyBack(router, parentHref, hasMovedInWardFlow, markWardRouteReplace, () =>
            confirmLeavingShell(goBack),
          );
        }}
      >
        <ArrowLeft aria-hidden="true" strokeWidth={1.75} />
      </button>
    );
  }
  return (
    <ContextualBackLink
      fallbackHref={parentHref}
      canUseHistory={hasMovedInWardFlow}
      onFallback={markWardRouteReplace}
      className={styles.deskBack}
      aria-label="Back"
      data-testid="ward-bar-back"
    >
      <ArrowLeft aria-hidden="true" strokeWidth={2} />
      <span>Back</span>
    </ContextualBackLink>
  );
}

/**
 * The phone bar's Menu button and the phone menu it opens. The menu opens only on the phone; above
 * 48rem the rail's own sheet answers Menu. On a phone's drill-down screen (`backHref`) Back takes
 * the button's place; a tablet keeps Menu beside the bar's own Back. The menu stays mounted, as it
 * also draws the dock.
 */
export function NextPhoneMenuEntry({
  backHref,
  backRef,
  returnFocusRef,
  menuRef,
  tasksCount,
  activityUnread,
  roleCategory,
  onOpenDrawer,
  onOpenReferral,
  liveOverSheet,
}: {
  /** The parent page on a drill-down screen, where Back replaces Menu. */
  backHref?: string;
  backRef: RefObject<HTMLButtonElement | null>;
  /** Whichever of Back and Menu the phone shows: where the menu's sheets return focus. */
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  /** Keeps Menu tappable while a sheet sits below the bar (see `headerLiveOverSheet`). */
  liveOverSheet: boolean;
  menuRef: RefObject<HTMLButtonElement | null>;
  tasksCount: number;
  activityUnread: number;
  roleCategory: ReferralSheetCategory;
  onOpenDrawer: (id: "tasks" | "activity" | "tools") => void;
  onOpenReferral: (request: ReferralSheetRequest, returnFocus: HTMLElement | null) => void;
}) {
  // Q161 (Josh, 1 Nov 2026): on a page no dock tab owns, Menu lights as the way to where you are.
  const [dockOwnsPage, setDockOwnsPage] = useState(true);
  return (
    <>
      {backHref ? <WardBarBack parentHref={backHref} phone liveOverSheet={liveOverSheet} buttonRef={backRef} /> : null}
      <button
        type="button"
        ref={menuRef}
        // D3 (design audit, 5 Nov 2026): where a closed pop-up hands focus when its opener has gone.
        data-wf-focus-fallback=""
        className={styles.phoneOnly}
        aria-label="Menu"
        aria-haspopup="dialog"
        aria-controls="ward-phone-menu"
        data-testid="ward-bar-phone-menu"
        data-back-replaced={backHref ? "" : undefined}
        data-here={dockOwnsPage ? undefined : ""}
        data-sheet-inert-skip={liveOverSheet ? "" : undefined}
        onClick={(event) => openWardMenu(event.currentTarget)}
      >
        <MenuIcon aria-hidden="true" strokeWidth={1.75} />
      </button>
      <NextPhoneMenu
        returnFocusRef={returnFocusRef}
        tasksCount={tasksCount}
        activityUnread={activityUnread}
        onOpenDrawer={onOpenDrawer}
        onNewReferral={() => onOpenReferral({ category: roleCategory }, returnFocusRef.current)}
        onDockOwnsPageChange={setDockOwnsPage}
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
  deskPlace,
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
  /**
   * ROLE BRANCH (every desk but the coordinator): the desk's own place in words ("Dabakarn",
   * "Peel ED", "Midland team", "Royal Perth Hospital"). The chip then names the place, locked, and
   * its dot keeps the place's service colour; the service stays in the spoken name.
   */
  deskPlace?: string;
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
        aria-haspopup={isFixedJurisdiction ? undefined : "dialog"}
        aria-expanded={isFixedJurisdiction ? undefined : openPanel === "service"}
        aria-controls={isFixedJurisdiction ? undefined : "ward-bar-service-panel"}
        aria-label={
          deskPlace
            ? `Your place: ${deskPlace}${activeService ? `, ${activeService}` : ""}`
            : isFixedJurisdiction
              ? `Jurisdiction: ${activeService}`
              : `Service: ${activeServiceBadgeLabel}`
        }
        onClick={() => {
          if (deskPlace) {
            announceToWardShell(`Your place is ${deskPlace}${activeService ? `, in ${activeService}` : ""}.`);
            return;
          }
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
        <span className={styles.scopeBadgeLabel}>{deskPlace ?? activeServiceBadgeLabel}</span>
        {!isFixedJurisdiction && <ChevronDown className={styles.scopeCaret} aria-hidden="true" strokeWidth={1.75} />}
        <span className="sr-only">{deskPlace ?? activeServiceBadgeLabel}</span>
      </button>
      {isPhone ? (
        <span className={styles.scopeLive} aria-hidden="true">
          {/* The waiting figure is the service's, so its line keeps the service's name. */}
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
          // A5 (accessibility check, 2 Nov 2026): a named dialog at every size; only the phone sheet is modal.
          role="dialog"
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
  oneAlertsQueue: boolean;
  isPhone: boolean;
  onAlertsScreen: boolean;
  tasksActiveCount: number;
}) {
  // Opted out of the React Compiler, like the component above.
  "use no memo";
  const directToScreen = oneAlertsQueue && (isPhone || onAlertsScreen);
  return (
    <div className={styles.drawerTriggers}>
      {/* Josh, 31 Oct 2026: Activity keeps its own button (the Home and Activity redesign gave it
          Changes, Recent activity and Notices), so it is not folded into Alerts. */}
      <button
        type="button"
        ref={activityTriggerRef}
        className={styles.drawerTrigger}
        data-bar-mode="activity"
        data-testid="ward-bar-activity-trigger"
        aria-haspopup="dialog"
        aria-expanded={openPanel === "activity"}
        aria-controls="ward-bar-activity-drawer"
        // One name, without the stray space the visible label and a hidden tail gave it.
        aria-label={`Activity${activityHasUnread ? `, ${unreadNoticeCount} unread ${unreadNoticeCount === 1 ? "notice" : "notices"}` : ""}`}
        onClick={() => (openPanel === "activity" ? closePopover("activity", false) : openPopover("activity"))}
      >
        <RotateCcwClock className={styles.triggerIcon} aria-hidden="true" strokeWidth={1.75} />
        <span className={styles.triggerLabel}>Activity</span>
        {activityHasUnread ? <span className={styles.unread} aria-hidden="true" /> : null}
      </button>

      <button
        type="button"
        ref={tasksTriggerRef}
        className={styles.drawerTrigger}
        data-bar-mode="tasks"
        data-testid="ward-bar-tasks-trigger"
        aria-haspopup={directToScreen ? undefined : "dialog"}
        aria-expanded={directToScreen ? undefined : openPanel === "tasks"}
        aria-controls={directToScreen ? undefined : "ward-bar-tasks-drawer"}
        aria-current={onAlertsScreen ? "page" : undefined}
        onClick={() => (openPanel === "tasks" ? closePopover("tasks", false) : openPopover("tasks"))}
      >
        {/* Josh, 31 Oct 2026: one name and one icon on every desk, the bell and "Alerts". A desk whose
            list is the bed coordinator's opens the same panel, under the same name. */}
        <Bell className={styles.triggerIcon} aria-hidden="true" strokeWidth={1.75} />
        <span className={styles.triggerLabel}>Alerts</span>
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
        title="Quick actions, look ups, print and share, and demo controls"
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

// The New menu (built 7 Nov 2026) loads on first use, so a phone's first load does not carry it.
const loadNewMenu = () => import("@/components/ward-management/shell-next/next-new-menu");
const NewMenu = dynamic(
  withLoadRetry(() => loadNewMenu().then((module) => module.NewMenu)),
  { ssr: false },
);

/**
 * The bar's New button (Josh's approved mock-up, built 7 Nov 2026): "New" with a caret, opening the
 * Triage or Referral menu. Referral opens today's referral slide-out unchanged; Triage opens Start a
 * triage. A desk that may refer but not triage keeps today's New referral button (see below).
 */
function WardBarNewMenuButton({
  primaryTriggerRef,
  onReferral,
}: {
  primaryTriggerRef: RefObject<HTMLButtonElement | null>;
  onReferral: () => void;
}) {
  const router = useRouter();
  // The button the menu sits under and the row that takes focus on opening, or null while closed.
  const [open, setOpen] = useState<{ trigger: HTMLElement; row: number } | null>(null);
  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(null);
      if (returnFocus) primaryTriggerRef.current?.focus();
    },
    [primaryTriggerRef],
  );
  // The menu loads on first use. When it cannot (offline before it has loaded), New opens the
  // referral slide-out as New referral did, which shows its own Try again.
  const openMenu = (trigger: HTMLElement, row: number) =>
    void loadNewMenu().then(
      () => setOpen({ trigger, row }),
      () => onReferral(),
    );
  const choose = (kind: NewMenuKind) => {
    setOpen(null);
    if (kind === "triage") router.push(WARD_TRIAGE_NEW_HREF);
    // After the menu has gone, so the slide-out hands focus back to the button as today.
    else window.setTimeout(onReferral, 0);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    // Escape on the button closes an open menu, before focus has moved into it.
    if (event.key === "Escape" && open !== null) {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    openMenu(event.currentTarget, event.key === "ArrowUp" ? 1 : 0);
  };
  return (
    <div className={styles.primaryWrap}>
      <button
        type="button"
        ref={primaryTriggerRef}
        // Josh, 30 Oct 2026: even padding and its neighbours' height (`preview-bar.module.css`).
        className={`${styles.primary} ${styles.referralPrimary} ${polish.primaryEven}`}
        data-testid="ward-bar-primary-action"
        aria-haspopup="menu"
        aria-expanded={open !== null}
        aria-controls={open !== null ? NEW_MENU_ID : undefined}
        onPointerEnter={() => void loadNewMenu().catch(() => undefined)}
        onFocus={() => void loadNewMenu().catch(() => undefined)}
        onKeyDown={onKeyDown}
        onClick={(event) => {
          if (open !== null) setOpen(null);
          else openMenu(event.currentTarget, 0);
        }}
      >
        <Plus className={styles.primaryIcon} aria-hidden="true" strokeWidth={1.75} />
        <span className={styles.primaryMain}>New</span>
        <ChevronDown className={styles.triggerCaret} aria-hidden="true" strokeWidth={1.75} />
      </button>
      {open !== null ? (
        <NewMenu trigger={open.trigger} phone={false} initial={open.row} onClose={close} onChoose={choose} />
      ) : null}
    </div>
  );
}

/** The bar's one primary action: New (Triage or Referral), New referral, or a not-wired action's popover. */
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
  const canOpen = useCanOpenHref();
  const gate = useRoleGate();
  // A desk that cannot open the intake (bed manager, #820) gets no New referral button.
  if (primaryAction?.kind === "new-referral" && !canOpen(WARD_REFERRAL_INTAKE_HREF)) return null;
  // Triage and risk (7 Nov 2026): a desk that may also triage gets New, with Triage and Referral.
  const canTriage = canOpen(WARD_TRIAGE_NEW_HREF) && gate("RECORD_TRIAGE_SIGNED").allowed;
  return (
    <>
      {primaryAction && primaryAction.kind !== "none" ? <span className={styles.vsep} aria-hidden="true" /> : null}
      {primaryAction?.kind === "new-referral" && canTriage ? (
        <WardBarNewMenuButton
          primaryTriggerRef={primaryTriggerRef}
          onReferral={() => openReferral({ category: roleCategory }, primaryTriggerRef.current)}
        />
      ) : primaryAction?.kind === "new-referral" ? (
        // UX audit (21 Oct 2026): New referral opens the form at once. The drawer's own "Refer to"
        // switch (Ward, Community, ED) is the one place the destination is chosen, so the bar no
        // longer asks the same question in a menu first.
        <div className={styles.primaryWrap}>
          <button
            type="button"
            ref={primaryTriggerRef}
            // Josh, 30 Oct 2026: even padding and its neighbours' height (`preview-bar.module.css`).
            className={`${styles.primary} ${styles.referralPrimary} ${polish.primaryEven}`}
            data-testid="ward-bar-primary-action"
            onClick={() => {
              openReferral({ category: roleCategory }, primaryTriggerRef.current);
            }}
          >
            <Plus className={styles.primaryIcon} aria-hidden="true" strokeWidth={1.75} />
            <span className={styles.primaryPrefix}>New </span>
            <span className={styles.primaryMain}>referral</span>
          </button>
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
