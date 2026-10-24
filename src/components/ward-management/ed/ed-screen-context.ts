// Everything the ED screen's sections read, in one object. `EdScreen` builds it once per render from
// the records, its hooks and its derivations, and hands it to each section (fix list 2.5 and 9.6,
// 15 Oct 2026). A type only: nothing here runs.
import type { FormEvent } from "react";
import type { createReadmissionIndex } from "@/components/ward-management/ward-readmission";
import type { DueSoonThresholds, Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowContextValue } from "@/components/ward-management/ward-flow-provider";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { edById, siteByCode } from "@/components/ward-management/ward-sites";
import type { EdStepEvent } from "./ed-screen-model";
import type { edScreenActions } from "./ed-screen-actions";
import type { deriveEdScreen } from "./ed-screen-derivations";
import type { useEdInboxDecline } from "./use-ed-screen-decline";
import type { useEdBoardDrafts, useEdBoardView, useEdReferralDraft, useEdRowPanels } from "./use-ed-screen-state";

type EdScreenRecords = {
  thresholds: DueSoonThresholds;
  movements: WardFlowContextValue["movements"];
  units: WardFlowContextValue["units"];
  referrals: WardFlowContextValue["referrals"];
  dayZero: WardFlowContextValue["dayZero"];
  dispatch: WardFlowContextValue["dispatch"];
  raise: WardRaise;
  registryPatients: WardFlowContextValue["patients"];
  now: Instant;
  readmissionIndex: ReturnType<typeof createReadmissionIndex>;
  accessTarget: number;
  holdLabel: string;
  department: NonNullable<ReturnType<typeof edById>>;
  site: ReturnType<typeof siteByCode>;
  thisEdId: string;
  isPhone: boolean;
  isTabletPortrait: boolean;
  boardTable: boolean;
  needsRailSlides: boolean;
  recordEdStep: (event: EdStepEvent) => void;
  submitReferral: (event: FormEvent<HTMLFormElement>) => void;
  referralFieldsDisabled?: boolean;
  referralSaveMessage?: string;
};

export type EdScreenContext = EdScreenRecords &
  ReturnType<typeof useEdReferralDraft> &
  ReturnType<typeof useEdBoardDrafts> &
  ReturnType<typeof useEdRowPanels> &
  ReturnType<typeof useEdBoardView> &
  ReturnType<typeof useEdInboxDecline> &
  ReturnType<typeof deriveEdScreen> &
  ReturnType<typeof edScreenActions>;
