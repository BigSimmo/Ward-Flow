"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Button, StatusGlyph } from "@/components/wf";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import {
  COORDINATOR_DESK_ACKNOWLEDGER_ID,
  broadcastKind,
  formatTimeRemaining,
  type WardBroadcastAlert,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import { bannerEntriesForDesk, type BannerEntry } from "@/components/ward-management/alerts/global-alert-view";
import { useActNowNotificationPreference } from "@/components/ward-management/shell/ward-act-now-notifications";
import { currentDeskId } from "@/components/ward-management/settings/workstation-desks";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import type { Instant } from "@/components/ward-management/ward-clock";
import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";
import styles from "./ward-broadcast-banner.module.css";

// The banner's body (answers, counts, actions) is its own chunk so the shared shell does not carry it
// on every first load. It stays server-rendered, so a live alert paints in the first HTML with no
// shift, and it is fetched once the page is idle so a new alert does not wait on the network.
const loadBannerBody = () => import("./ward-broadcast-banner-body");
const BannerBody = dynamic(() => loadBannerBody().then((m) => m.BannerBody));
preloadWhenIdle(loadBannerBody);

export interface WardBroadcastBannerProps {
  /** Overrides the desk read from the route. Tests and previews only. */
  currentUnitId?: string;
  /** Optional controlled alert (#25). When omitted, reads from WardFlowProvider context. */
  activeAlert?: WardBroadcastAlert | null;
  /** Optional reference clock for controlled mode (#25). */
  now?: string | Instant;
  /** Optional quick +2h extension callback (#25). */
  onExtend?: () => void;
  /** Optional stand-down / resolved callback (#25). */
  onClear?: () => void;
}

function toControlledMinutes(val: string | Instant): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const parsed = Date.parse(val);
  if (Number.isNaN(parsed)) return 0;
  return Math.floor(parsed / 60_000);
}

function computeControlledRemainingMinutes(expiresAt: string | Instant, now?: string | Instant): number {
  const expMin = toControlledMinutes(expiresAt);
  const nowMin = now !== undefined ? toControlledMinutes(now) : Math.floor(Date.now() / 60_000);
  return expMin - nowMin;
}

/**
 * THE ONE GLOBAL ALERT SLOT (option A, 10 Oct 2026). Sits under the top bar on every page and
 * shows the most urgent live alert for the desk this route is. Red (a thin edge, never a fill) only
 * when this desk must act now. No full screen flash: one pulse on arrival, then a steady edge.
 */
export function WardBroadcastBanner(props: WardBroadcastBannerProps) {
  if (props.activeAlert !== undefined) {
    return (
      <ControlledBroadcastBanner
        activeAlert={props.activeAlert}
        now={props.now}
        onExtend={props.onExtend}
        onClear={props.onClear}
      />
    );
  }
  return <ContextBroadcastBanner currentUnitId={props.currentUnitId} />;
}

function ControlledBroadcastBanner({
  activeAlert,
  now,
  onExtend,
  onClear,
}: {
  activeAlert: WardBroadcastAlert | null;
  now?: string | Instant;
  onExtend?: () => void;
  onClear?: () => void;
}) {
  const [, setClockTick] = useState(0);
  useEffect(() => {
    if (now !== undefined || !activeAlert) return;
    const timer = window.setInterval(() => setClockTick((t) => t + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [activeAlert, now]);

  if (!activeAlert || activeAlert.status === "stood_down" || activeAlert.status === "expired") {
    return null;
  }
  const remainingMinutes = computeControlledRemainingMinutes(activeAlert.expiresAt, now);
  if (remainingMinutes <= 0) {
    return null;
  }
  const timeLabel = formatTimeRemaining(remainingMinutes as Instant, 0 as Instant);
  const isCritical = activeAlert.severity === "critical";

  return (
    <section
      className={styles.banner}
      data-tone={isCritical ? "critical" : "warning"}
      data-severity={activeAlert.severity}
      data-testid="ward-broadcast-banner"
      role={isCritical ? "alert" : "status"}
      aria-live={isCritical ? "assertive" : "polite"}
      aria-atomic="true"
      aria-label={activeAlert.title ?? activeAlert.message}
    >
      <span className="sr-only">These counts are invented figures.</span>
      <div className={styles.row}>
        <div className={styles.lead}>
          <StatusGlyph tone={isCritical ? "danger" : "warning"} size={12} />
          <strong className={styles.headline}>{activeAlert.title ?? activeAlert.message}</strong>
          {activeAlert.author ? <span className={styles.meta}>{activeAlert.author}</span> : null}
        </div>
        <div className={styles.actions}>
          <span className={styles.meta} title="Time until this alert ends">
            <span className={styles.mono}>{timeLabel}</span>
          </span>
          {onExtend ? (
            <Button size="sm" onClick={onExtend}>
              Extend <span>+2h</span>
            </Button>
          ) : null}
          {onClear ? (
            <Button size="sm" variant="ghost" onClick={onClear}>
              Stand Down — Resolved
            </Button>
          ) : null}
        </div>
      </div>
      {activeAlert.title && activeAlert.title !== activeAlert.message ? (
        <p className={styles.message}>{activeAlert.message}</p>
      ) : null}
    </section>
  );
}

function ContextBroadcastBanner({ currentUnitId }: { currentUnitId?: string }) {
  const { broadcastAlerts, dispatch, units, movements, patients, referrals } = useWardFlowSelect(
    "broadcastAlerts",
    "dispatch",
    "units",
    "movements",
    "patients",
    "referrals",
  );
  const now = useWardFlowClock();
  const pathname = usePathname() ?? "";
  const routeRole = wardChromeRole(pathname);
  const role = currentUnitId ? "ward" : routeRole;
  const routeDesk = currentUnitId ?? currentDeskId(pathname);
  const desk = { role, id: role === "coordinator" ? COORDINATOR_DESK_ACKNOWLEDGER_ID : routeDesk };

  const entries = bannerEntriesForDesk(broadcastAlerts, movements, desk, now, units);
  const top = entries[0];
  useActNowNotice(top, desk.id);
  // Top 25 item 25: the desks EVENT_ROLE lets extend or stand down an alert can do it from here.
  const gate = useRoleGate();
  const actingRole = useRouteRole();

  if (!top) return null;
  const more = entries.length - 1;
  const manageable = broadcastKind(top.alert) !== "pull_now";
  const alertId = top.alert.id;
  const lifecycle = manageable
    ? {
        extend: gate("EXTEND_BROADCAST_ALERT").allowed
          ? () => {
              dispatch({ type: "EXTEND_BROADCAST_ALERT", role: actingRole, now, alertId });
            }
          : undefined,
        standDown: gate("STAND_DOWN_BROADCAST_ALERT").allowed
          ? () => {
              dispatch({ type: "STAND_DOWN_BROADCAST_ALERT", role: actingRole, now, alertId });
            }
          : undefined,
      }
    : undefined;

  return (
    <BannerBody
      key={top.alert.id}
      entry={top}
      more={more}
      desk={desk}
      now={now}
      units={units}
      lookup={{ patients, referrals, movements }}
      onDispatch={dispatch}
      lifecycle={lifecycle}
    />
  );
}

/**
 * A browser notification when a new red alert reaches this desk, using the act-now opt-in from
 * Settings. Carries no patient name or record number: the operating system may show it on a lock
 * screen.
 */
function useActNowNotice(top: BannerEntry | undefined, deskId: string | null) {
  const [enabled] = useActNowNotificationPreference();
  const seen = useRef<Set<string>>(new Set());
  const id = top?.tone === "act_now" ? `${top.alert.id}:${deskId ?? ""}` : null;
  useEffect(() => {
    if (!id || seen.current.has(id)) return;
    seen.current.add(id);
    if (!enabled || typeof window === "undefined" || window.Notification?.permission !== "granted") return;
    try {
      new window.Notification("Ward Flow: act now", {
        body: "A Pull now alert needs an answer. Synthetic demo data.",
        tag: "ward-flow-pull-now",
      });
    } catch {
      // Notifications are best effort.
    }
  }, [id, enabled]);
}
