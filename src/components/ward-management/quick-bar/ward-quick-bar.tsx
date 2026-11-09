"use client";

import { usePathname } from "next/navigation";
import {
  BellRing,
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
export function WardQuickBar() {
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
  if (pathname !== home || controls.length === 0) return null;
  const press = (control: QuickControl, button: HTMLElement) => {
    if (control.kind === "referral") openWardDrawer("referral");
    else requestToolsTool(control.tool, button);
  };
  return (
    <nav
      className={styles.bar}
      aria-label="Quick controls"
      data-testid="ward-quick-bar"
      data-wf-quick-bar=""
      data-print-hide
    >
      <ul className={styles.list}>
        {controls.map((control) => {
          const Icon = control.kind === "referral" ? Plus : (ICONS[control.tool] ?? Zap);
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
                  <b className={styles.count} aria-label={`, ${count} to do`}>
                    {count}
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
