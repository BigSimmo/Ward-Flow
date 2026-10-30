"use client";

import type { ComponentType, ReactNode } from "react";

import { PopAlerts } from "@/components/ward-redesign/pop-alerts/pop-alerts";
import { PopActivity } from "@/components/ward-redesign/pop-activity/pop-activity";
import { PopTools } from "@/components/ward-redesign/pop-tools/pop-tools";
import { PopSearch } from "@/components/ward-redesign/pop-search/pop-search";
import { PopHelp } from "@/components/ward-redesign/pop-help/pop-help";
import { PopShortcuts } from "@/components/ward-redesign/pop-shortcuts/pop-shortcuts";
import { PopDemo } from "@/components/ward-redesign/pop-demo/pop-demo";
import { PopMenu } from "@/components/ward-redesign/pop-menu/pop-menu";
import { PopCreate } from "@/components/ward-redesign/pop-create/pop-create";
import { PopWardSwitcher } from "@/components/ward-redesign/pop-ward-switcher/pop-ward-switcher";
import { PopShiftBrief } from "@/components/ward-redesign/pop-shift-brief/pop-shift-brief";
import { PopDesk } from "@/components/ward-redesign/pop-desk/pop-desk";
import { PopServicePicker } from "@/components/ward-redesign/pop-service-picker/pop-service-picker";
import { PopMorePages } from "@/components/ward-redesign/pop-more-pages/pop-more-pages";
import { PopTour } from "@/components/ward-redesign/pop-tour/pop-tour";
import { PopBedRecord } from "@/components/ward-redesign/pop-bed-record/pop-bed-record";
import { PopConfirmBeds } from "@/components/ward-redesign/pop-confirm-beds/pop-confirm-beds";
import { PopBroadcast } from "@/components/ward-redesign/pop-broadcast/pop-broadcast";
import { PopWardNotices } from "@/components/ward-redesign/pop-ward-notices/pop-ward-notices";
import { PopReferWard } from "@/components/ward-redesign/pop-refer-ward/pop-refer-ward";
import { PopEdActions } from "@/components/ward-redesign/pop-ed-actions/pop-ed-actions";
import { PopLogTransport } from "@/components/ward-redesign/pop-log-transport/pop-log-transport";
import { PopOfficerJob } from "@/components/ward-redesign/pop-officer-job/pop-officer-job";
import { PopRecordForm } from "@/components/ward-redesign/pop-record-form/pop-record-form";
import { PopRecordExam } from "@/components/ward-redesign/pop-record-exam/pop-record-exam";
import { PopAddTime } from "@/components/ward-redesign/pop-add-time/pop-add-time";
import { PopStateLoading } from "@/components/ward-redesign/pop-state-loading/pop-state-loading";
import { PopStateEmpty } from "@/components/ward-redesign/pop-state-empty/pop-state-empty";
import { PopStateError } from "@/components/ward-redesign/pop-state-error/pop-state-error";
import { PopStateOffline } from "@/components/ward-redesign/pop-state-offline/pop-state-offline";
import { PopStateToast } from "@/components/ward-redesign/pop-state-toast/pop-state-toast";
import { PopStateNotWired } from "@/components/ward-redesign/pop-state-not-wired/pop-state-not-wired";

/**
 * Preview only: popups and states drawn by the preview itself rather than by their page. Keyed by
 * the `pop` name in `MOCKUP_POPUPS`. Each is given the page it opens over and returns what to draw:
 * usually the page with its overlay on top (shell overlays, page popups), or a state in its place.
 * The five page popups opened through `openOnLoad` (sheet, scenario, ward, movement, forecast) are
 * not here; their pages open them.
 */
export const MOCKUP_POPUP_COMPONENTS: Readonly<Record<string, ComponentType<{ page: ReactNode }>>> = {
  alerts: PopAlerts,
  activity: PopActivity,
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
