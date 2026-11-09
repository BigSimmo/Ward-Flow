"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BellRing,
  ChevronRight,
  CalendarClock,
  ChartColumn,
  Clock4,
  MapPinned,
  MessageSquareText,
  PhoneCall,
  PhoneOutgoing,
  Plus,
  SearchCheck,
  BedSingle,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { PhoneSheet, useIsPhone } from "@/components/wf";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { seesNetworkBedFigures } from "@/components/ward-management/ward-role-access";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import { shiftConfirmations } from "@/components/ward-management/capacity/shift-confirmations";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useCanOpenHref, useDeskHomeHref } from "@/components/ward-management/shell/ward-access";
import { openWardDrawer } from "@/components/ward-management/shell/ward-drawer-bus";
import { requestToolsTool } from "@/components/ward-management/tools/ward-tools-open";
import type { ToolsSheetToolId } from "@/components/ward-management/tools/ward-tools-sheet";
import { QUICK_BAR, type QuickControl } from "./ward-quick-bar-spec";
import styles from "./ward-quick-bar.module.css";

const ICONS: Partial<Record<ToolsSheetToolId, LucideIcon>> = {
  "quick-actions": Zap,
  "bed-finder": SearchCheck,
  "call-log": PhoneOutgoing,
  messages: MessageSquareText,
  "update-bed": BedSingle,
  remind: BellRing,
  "leave-due": CalendarClock,
  "form-times": Clock4,
  contacts: PhoneCall,
  catchment: MapPinned,
  figures: ChartColumn,
};

/** Tools that read network bed figures, which some desks never see (seesNetworkBedFigures). */
const NETWORK_TOOLS = new Set<ToolsSheetToolId>(["bed-finder", "figures", "messages"]);

/** The coordinator's Ward updates count: wards not confirmed since this shift began. */
function useUnconfirmedCount(enabled: boolean): number | undefined {
  const { units, now } = useWardFlowSelect("units", "now");
  return enabled ? shiftConfirmations(units, now).waiting.length : undefined;
}

/**
 * One row of the desk's most used controls under the top bar, on the desk's home only (Josh, 8 Nov
 * 2026). Each control opens its tool in the Tools side panel on the same page, never a new page.
 */
function useQuickControls() {
  const pathname = usePathname();
  const home = useDeskHomeHref();
  const role = useEffectiveWardAccess().role;
  const canOpen = useCanOpenHref();
  const controls = (QUICK_BAR[role] ?? []).filter(
    (control) =>
      (control.kind === "referral" && canOpen(WARD_REFERRAL_INTAKE_HREF)) ||
      (control.kind === "tool" && (!NETWORK_TOOLS.has(control.tool) || seesNetworkBedFigures(role))),
  );
  const unconfirmed = useUnconfirmedCount(role === "coordinator");
  return { controls, unconfirmed, onHome: pathname === home && controls.length > 0 };
}

function press(control: QuickControl, button: HTMLElement) {
  if (control.kind === "referral") openWardDrawer("referral");
  else requestToolsTool(control.tool, button);
}

/** Desktop and tablet: the chip row, at the foot of the home's hero under the act now row. */
function QuickChipRow({
  controls,
  unconfirmed,
}: {
  controls: readonly QuickControl[];
  unconfirmed: number | undefined;
}) {
  return (
    <nav
      className={styles.bar}
      data-in-hero=""
      aria-label="Quick controls"
      data-testid="ward-quick-bar"
      data-wf-quick-bar=""
      data-print-hide
    >
      <ul className={styles.list}>
        {controls.map((control) => {
          const Icon = controlIcon(control);
          const count = control.kind === "tool" && control.tool === "quick-actions" ? unconfirmed : undefined;
          return (
            <li key={control.kind === "tool" ? control.tool : "referral"}>
              <button
                type="button"
                className={styles.control}
                onClick={(event) => press(control, event.currentTarget)}
                aria-haspopup="dialog"
                title={control.detail}
              >
                <Icon aria-hidden="true" strokeWidth={1.75} />
                {control.label}
                {count ? (
                  <b className={styles.count}>
                    <span aria-hidden="true">{count}</span>
                    <span className="sr-only">, {count} to do</span>
                  </b>
                ) : null}
                <span className="sr-only">, {control.detail}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function controlIcon(control: QuickControl): LucideIcon {
  return control.kind === "referral" ? Plus : (ICONS[control.tool] ?? Zap);
}

/**
 * Given to the desk home's band hero through WardQuickHeroProvider (layout), and drawn on the desk's home
 * only. It sits under the act now row, as in the confirmed header design (Josh, 9 Nov 2026): a chip
 * row on desktop and tablet, one Quick actions button on phone.
 */
export function WardQuickHeroSlot() {
  const { controls, unconfirmed, onHome } = useQuickControls();
  const isPhone = useIsPhone();
  if (!onHome) return null;
  return isPhone ? (
    <QuickActionsLauncher controls={controls} unconfirmed={unconfirmed} />
  ) : (
    <QuickChipRow controls={controls} unconfirmed={unconfirmed} />
  );
}

/**
 * Phone (Josh, 9 Nov 2026): one "Quick actions" button at the foot of the hero, under the
 * need-a-person line, instead of a sideways row of chips. It names the first few controls and opens
 * them all in a bottom sheet; each row then opens its tool on this page, as the chips did.
 */
function QuickActionsLauncher({
  controls,
  unconfirmed,
}: {
  controls: readonly QuickControl[];
  unconfirmed: number | undefined;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const preview = controls
    .slice(0, 3)
    .map((control) => control.label)
    .join(" · ");
  const rest = controls.length - 3;
  return (
    <nav
      className={styles.launch}
      aria-label="Quick controls"
      data-testid="ward-quick-bar"
      data-wf-quick-bar=""
      data-in-hero=""
      data-print-hide
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.launchButton}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        data-testid="ward-quick-launch"
      >
        <span className={styles.launchIcon} aria-hidden="true">
          <Zap aria-hidden="true" strokeWidth={1.75} />
        </span>
        <span className={styles.launchText}>
          <b>Quick actions</b>
          <small>
            {preview}
            {rest > 0 ? ` +${rest}` : ""}
          </small>
        </span>
        {unconfirmed ? (
          <b className={styles.count}>
            <span aria-hidden="true">{unconfirmed}</span>
            <span className="sr-only">, {unconfirmed} to do</span>
          </b>
        ) : null}
        <ChevronRight className={styles.launchChevron} aria-hidden="true" strokeWidth={1.75} />
      </button>
      <PhoneSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Quick actions"
        description="Each opens here, on this page"
        returnFocusRef={buttonRef}
      >
        <ul className={styles.sheetList} data-testid="ward-quick-sheet">
          {controls.map((control) => {
            const Icon = controlIcon(control);
            const count = control.kind === "tool" && control.tool === "quick-actions" ? unconfirmed : undefined;
            return (
              <li key={control.kind === "tool" ? control.tool : "referral"}>
                <button
                  type="button"
                  className={styles.sheetRow}
                  aria-haspopup="dialog"
                  onClick={() => {
                    setOpen(false);
                    const anchor = buttonRef.current;
                    if (anchor) requestAnimationFrame(() => press(control, anchor));
                  }}
                >
                  <span className={styles.sheetIcon} aria-hidden="true">
                    <Icon aria-hidden="true" strokeWidth={1.75} />
                  </span>
                  <span className={styles.launchText}>
                    <b>{control.label}</b>
                    <small>{control.detail}</small>
                  </span>
                  {count ? (
                    <b className={styles.sheetCount}>
                      <span aria-hidden="true">{count}</span>
                      <span className="sr-only">, {count} to do</span>
                    </b>
                  ) : null}
                  <ChevronRight className={styles.sheetChevron} aria-hidden="true" strokeWidth={1.75} />
                </button>
              </li>
            );
          })}
        </ul>
      </PhoneSheet>
    </nav>
  );
}
