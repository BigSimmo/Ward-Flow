"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  ClipboardList,
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
function useQuickControls() {
  const pathname = usePathname();
  const home = useDeskHomeHref();
  const role = useEffectiveWardAccess().role;
  const canOpen = useCanOpenHref();
  const controls = (QUICK_BAR[role] ?? []).filter(
    (control) =>
      (control.kind === "referral" && canOpen(WARD_REFERRAL_INTAKE_HREF)) ||
      (control.kind === "link" && canOpen(control.href)) ||
      (control.kind === "tool" && (!NETWORK_TOOLS.has(control.tool) || seesNetworkBedFigures(role))),
  );
  const unconfirmed = useUnconfirmedCount(role === "coordinator");
  return { controls, unconfirmed, onHome: pathname === home && controls.length > 0 };
}

function press(control: QuickControl, button: HTMLElement) {
  if (control.kind === "referral") openWardDrawer("referral");
  else if (control.kind === "tool") requestToolsTool(control.tool, button);
}

/** The chip row in the home's hero, under the act now row. */
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
          const body = (
            <>
              <Icon aria-hidden="true" strokeWidth={1.75} />
              {control.label}
              {count ? (
                <b className={styles.count}>
                  <span aria-hidden="true">{count}</span>
                  <span className="sr-only">, {count} to do</span>
                </b>
              ) : null}
              <span className="sr-only">, {control.detail}</span>
            </>
          );
          return (
            <li key={controlKey(control)}>
              {control.kind === "link" ? (
                <Link href={control.href} className={styles.control} title={control.detail}>
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.control}
                  onClick={(event) => press(control, event.currentTarget)}
                  aria-haspopup="dialog"
                  title={control.detail}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function controlIcon(control: QuickControl): LucideIcon {
  if (control.kind === "link") return ClipboardList;
  return control.kind === "referral" ? Plus : (ICONS[control.tool] ?? Zap);
}

const controlKey = (control: QuickControl) =>
  control.kind === "tool" ? control.tool : control.kind === "link" ? control.href : "referral";

/**
 * Given to the desk home's band hero through WardQuickHeroProvider (layout), and drawn on the desk's home
 * only. A page top built with `HeroTop` draws it in its chip row, under the act row (page tops v6,
 * Josh 9 Nov 2026): 36px chips on every size, one row that scrolls sideways on a phone (it replaced
 * the phone's Quick actions sheet button).
 */
export function WardQuickHeroSlot() {
  const { controls, unconfirmed, onHome } = useQuickControls();
  if (!onHome) return null;
  return <QuickChipRow controls={controls} unconfirmed={unconfirmed} />;
}
