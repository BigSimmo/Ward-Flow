"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

import { useIsPhone } from "@/components/wf";
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
 * On phone the bar sits at the foot of the home's hero band, under its "need a person now" line, not
 * above the title (Josh, 9 Nov 2026). The hero may draw after the bar, so watch until it appears.
 */
function usePhoneHeroSlot(active: boolean): HTMLElement | null {
  const isPhone = useIsPhone();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const watching = active && isPhone;
  useEffect(() => {
    if (!watching) return;
    const find = () => {
      const hero = document.querySelector<HTMLElement>('[data-wf-hero="band"]');
      setSlot((current) => (current === hero ? current : hero));
    };
    const frame = requestAnimationFrame(find);
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [watching]);
  if (!watching) return null;
  return slot && slot.isConnected ? slot : null;
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
  const onHome = pathname === home && controls.length > 0;
  const heroSlot = usePhoneHeroSlot(onHome);
  if (!onHome) return null;
  const press = (control: QuickControl, button: HTMLElement) => {
    if (control.kind === "referral") openWardDrawer("referral");
    else requestToolsTool(control.tool, button);
  };
  const bar = (
    <nav
      className={styles.bar}
      data-in-hero={heroSlot ? "" : undefined}
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
  return heroSlot ? createPortal(bar, heroSlot) : bar;
}
