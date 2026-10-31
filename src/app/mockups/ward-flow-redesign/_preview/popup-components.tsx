"use client";

// Each page and popup loads on its own, so a frame compiles and downloads only what it draws.
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

import { useEffect, type ComponentType, type ReactNode } from "react";

import { openWardMenu } from "@/components/ward-management/shell/ward-drawer-bus";

const PopAlerts = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-alerts/pop-alerts").then((module) => module.PopAlerts),
);
const PopTools = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-tools/pop-tools").then((module) => module.PopTools),
);
const PopSearch = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-search/pop-search").then((module) => module.PopSearch),
);
const PopHelp = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-help/pop-help").then((module) => module.PopHelp),
);
const PopShortcuts = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-shortcuts/pop-shortcuts").then((module) => module.PopShortcuts),
);
const PopDemo = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-demo/pop-demo").then((module) => module.PopDemo),
);
const PopMenu = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-menu/pop-menu").then((module) => module.PopMenu),
);
const PopCreate = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-create/pop-create").then((module) => module.PopCreate),
);
const PopServicePicker = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-service-picker/pop-service-picker").then((module) => module.PopServicePicker),
);
const PopMorePages = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-more-pages/pop-more-pages").then((module) => module.PopMorePages),
);
const PopTour = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-tour/pop-tour").then((module) => module.PopTour),
);
const PopReferWard = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-refer-ward/pop-refer-ward").then((module) => module.PopReferWard),
);
const PopClearance = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-clearance/pop-clearance").then((module) => module.PopClearance),
);
const PopIdleWarning = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-idle-warning/pop-idle-warning").then((module) => module.PopIdleWarning),
);
const PopIdleLock = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-idle-lock/pop-idle-lock").then((module) => module.PopIdleLock),
);
const PopConfirmLeave = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-confirm-leave/pop-confirm-leave").then((module) => module.PopConfirmLeave),
);
const PopConfirmDiscard = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-confirm-discard/pop-confirm-discard").then(
    (module) => module.PopConfirmDiscard,
  ),
);
const PopStateLoading = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-state-loading/pop-state-loading").then((module) => module.PopStateLoading),
);
const PopStateEmpty = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-state-empty/pop-state-empty").then((module) => module.PopStateEmpty),
);
const PopStateError = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-state-error/pop-state-error").then((module) => module.PopStateError),
);
const PopStateOffline = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-state-offline/pop-state-offline").then((module) => module.PopStateOffline),
);
const PopStateToast = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-state-toast/pop-state-toast").then((module) => module.PopStateToast),
);

/**
 * shell-next (Josh, 31 Oct 2026): with `?shell=next` the Menu popup is the new frame's own phone Menu
 * (`shell-next/next-phone-menu.tsx`, which opens with the desk's capacity card), opened on load from
 * the header's Menu button as a tap would. Today's frame keeps the `pop-menu` mock-up.
 */
function PopMenuNext({ page }: { page: ReactNode }) {
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const menu = document.querySelector<HTMLButtonElement>('[data-testid="ward-bar-phone-menu"]');
      if (!menu && tries < 100) return;
      window.clearInterval(timer);
      if (menu) openWardMenu(menu);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);
  return <>{page}</>;
}

function PopMenuForFrame({ page }: { page: ReactNode }) {
  // As `preview-shell.tsx` reads it: the router's copy, else the browser's (the static preview).
  const shellParam =
    useSearchParams()?.get("shell") ??
    (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("shell"));
  const nextShell = shellParam === "next";
  return nextShell ? <PopMenuNext page={page} /> : <PopMenu page={page} />;
}

/**
 * Preview only: popups and states drawn by the preview itself rather than by their page. Keyed by
 * the `pop` name in `MOCKUP_POPUPS`. Each is given the page it opens over and returns what to draw:
 * usually the page with its overlay on top (shell overlays, page popups), or a state in its place.
 * The four page popups opened through `openOnLoad` (sheet, scenario, ward, forecast) are
 * not here; their pages open them.
 */
export const MOCKUP_POPUP_COMPONENTS: Readonly<Record<string, ComponentType<{ page: ReactNode }>>> = {
  alerts: PopAlerts,
  tools: PopTools,
  search: PopSearch,
  help: PopHelp,
  shortcuts: PopShortcuts,
  demo: PopDemo,
  menu: PopMenuForFrame,
  create: PopCreate,
  "service-picker": PopServicePicker,
  "more-pages": PopMorePages,
  tour: PopTour,
  "refer-ward": PopReferWard,
  clearance: PopClearance,
  "idle-warning": PopIdleWarning,
  "idle-lock": PopIdleLock,
  "confirm-leave": PopConfirmLeave,
  "confirm-discard": PopConfirmDiscard,
  "state-loading": PopStateLoading,
  "state-empty": PopStateEmpty,
  "state-error": PopStateError,
  "state-offline": PopStateOffline,
  "state-toast": PopStateToast,
};
