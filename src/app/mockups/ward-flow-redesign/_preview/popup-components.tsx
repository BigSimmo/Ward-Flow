"use client";

// Each page and popup loads on its own, so a frame compiles and downloads only what it draws.
import dynamic from "next/dynamic";

import type { ComponentType, ReactNode } from "react";

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
const PopWardSwitcher = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-ward-switcher/pop-ward-switcher").then((module) => module.PopWardSwitcher),
);
const PopShiftBrief = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-shift-brief/pop-shift-brief").then((module) => module.PopShiftBrief),
);
const PopDesk = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-desk/pop-desk").then((module) => module.PopDesk),
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
const PopBedRecord = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-bed-record/pop-bed-record").then((module) => module.PopBedRecord),
);
const PopConfirmBeds = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-confirm-beds/pop-confirm-beds").then((module) => module.PopConfirmBeds),
);
const PopBroadcast = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-broadcast/pop-broadcast").then((module) => module.PopBroadcast),
);
const PopWardNotices = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-ward-notices/pop-ward-notices").then((module) => module.PopWardNotices),
);
const PopReferWard = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-refer-ward/pop-refer-ward").then((module) => module.PopReferWard),
);
const PopEdActions = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-ed-actions/pop-ed-actions").then((module) => module.PopEdActions),
);
const PopLogTransport = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-log-transport/pop-log-transport").then((module) => module.PopLogTransport),
);
const PopOfficerJob = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-officer-job/pop-officer-job").then((module) => module.PopOfficerJob),
);
const PopRecordForm = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-record-form/pop-record-form").then((module) => module.PopRecordForm),
);
const PopRecordExam = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-record-exam/pop-record-exam").then((module) => module.PopRecordExam),
);
const PopAddTime = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-add-time/pop-add-time").then((module) => module.PopAddTime),
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
const PopStateNotWired = dynamic<{ page: ReactNode }>(() =>
  import("@/components/ward-redesign/pop-state-not-wired/pop-state-not-wired").then(
    (module) => module.PopStateNotWired,
  ),
);

/**
 * Preview only: popups and states drawn by the preview itself rather than by their page. Keyed by
 * the `pop` name in `MOCKUP_POPUPS`. Each is given the page it opens over and returns what to draw:
 * usually the page with its overlay on top (shell overlays, page popups), or a state in its place.
 * The five page popups opened through `openOnLoad` (sheet, scenario, ward, movement, forecast) are
 * not here; their pages open them.
 */
export const MOCKUP_POPUP_COMPONENTS: Readonly<Record<string, ComponentType<{ page: ReactNode }>>> = {
  alerts: PopAlerts,
  tools: PopTools,
  search: PopSearch,
  help: PopHelp,
  shortcuts: PopShortcuts,
  demo: PopDemo,
  menu: PopMenu,
  create: PopCreate,
  "ward-switcher": PopWardSwitcher,
  "shift-brief": PopShiftBrief,
  desk: PopDesk,
  "service-picker": PopServicePicker,
  "more-pages": PopMorePages,
  tour: PopTour,
  "bed-record": PopBedRecord,
  "confirm-beds": PopConfirmBeds,
  broadcast: PopBroadcast,
  "ward-notices": PopWardNotices,
  "refer-ward": PopReferWard,
  "ed-actions": PopEdActions,
  "log-transport": PopLogTransport,
  "officer-job": PopOfficerJob,
  "record-form": PopRecordForm,
  "record-exam": PopRecordExam,
  "add-time": PopAddTime,
  "state-loading": PopStateLoading,
  "state-empty": PopStateEmpty,
  "state-error": PopStateError,
  "state-offline": PopStateOffline,
  "state-toast": PopStateToast,
  "state-not-wired": PopStateNotWired,
};
