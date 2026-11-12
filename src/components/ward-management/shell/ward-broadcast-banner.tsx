"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { usePathname } from "next/navigation";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import {
  COORDINATOR_DESK_ACKNOWLEDGER_ID,
  broadcastKind,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import {
  bannerEntriesForDesk,
  type AlertDesk,
  type BannerEntry,
} from "@/components/ward-management/alerts/global-alert-view";
import { useActNowNotificationPreference } from "@/components/ward-management/shell/ward-act-now-notifications";
import { OFFICER_DESK_ID, currentDeskId } from "@/components/ward-management/settings/workstation-desks";
import { wardChromeRole, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { useAccessShellRole, useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";
import type { WardBroadcastBannerPreviewProps } from "./ward-broadcast-banner-preview";
// The banner's styles stay in the shell's first stylesheet, in the same order as before, though only
// the lazy body (and the preview, ward-broadcast-banner-preview.tsx) reads their class names.
import "./ward-broadcast-banner.module.css";

// The banner's body (answers, counts, actions) is its own chunk so the shared shell does not carry it
// on every first load. It stays server-rendered, so a live alert paints in the first HTML with no
// shift, and it is fetched once the page is idle so a new alert does not wait on the network.
const loadBannerBody = () => import("./ward-broadcast-banner-body");
const BannerBody = dynamic(withLoadRetry(() => loadBannerBody().then((m) => m.BannerBody)));
preloadWhenIdle(loadBannerBody);

// Preview mode (#25), for tests and previews only, loads on demand so no screen carries it.
const BannerPreview = dynamic(
  withLoadRetry(() => import("./ward-broadcast-banner-preview").then((m) => m.WardBroadcastBannerPreview)),
);

export interface WardBroadcastBannerProps extends Partial<WardBroadcastBannerPreviewProps> {
  /** Overrides the desk read from the route. Tests and previews only. */
  currentUnitId?: string;
}

/**
 * The desk the banner speaks for. A coordinator, and every desk while the role-access flag is off,
 * keeps the route's desk as before. Another desk keeps the route's desk only on a place's page (a
 * ward, ED, team or officer page, which its access gate already let it open): D-80 has a site bed
 * manager answer for the ward whose page it is on. On any other page it is its own desk, with the
 * place its access names, and never the coordinator's desk (access audit, 31 Oct 2026).
 */
function bannerDesk(
  routeRole: WardChromeRole,
  routeDeskId: string | null,
  access: WardAccess,
  accessRole: WardChromeRole,
): AlertDesk {
  if (access.role === "coordinator" || routeRole !== "coordinator") {
    return { role: routeRole, id: routeRole === "coordinator" ? COORDINATOR_DESK_ACKNOWLEDGER_ID : routeDeskId };
  }
  const scope = access.scope;
  const id =
    scope.kind === "ward"
      ? (scope.unitIds[0] ?? null)
      : scope.kind === "ed"
        ? scope.edId
        : access.role === "officer"
          ? OFFICER_DESK_ID
          : null;
  return { role: accessRole, id };
}

/**
 * THE ONE GLOBAL ALERT SLOT (option A, 10 Oct 2026). Sits under the top bar on every page and
 * shows the most urgent live alert for the desk this route is. Red (a thin edge, never a fill) only
 * when this desk must act now. No full screen flash: one pulse on arrival, then a steady edge.
 *
 * Given `activeAlert` it draws that one alert instead (preview mode, #25), through
 * `WardBroadcastBannerPreview` (`ward-broadcast-banner-preview.tsx`), which loads on demand so this
 * every-screen module does not carry it (6 Nov 2026).
 */
export function WardBroadcastBanner({ currentUnitId, activeAlert, ...preview }: WardBroadcastBannerProps) {
  if (activeAlert !== undefined) return <BannerPreview activeAlert={activeAlert} {...preview} />;
  return <ContextBroadcastBanner currentUnitId={currentUnitId} />;
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
  const access = useEffectiveWardAccess();
  const accessRole = useAccessShellRole(routeRole);
  const desk: AlertDesk = currentUnitId
    ? { role: "ward", id: currentUnitId }
    : bannerDesk(routeRole, currentDeskId(pathname), access, accessRole);

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
