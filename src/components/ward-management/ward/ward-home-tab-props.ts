import type React from "react";

import type { Unit, Movement, Rejection, DeclineReason } from "@/components/ward-management/ward-model";
import type { OverrideEntry } from "@/components/ward-management/ward-derivations";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { absentOnOrder } from "@/components/ward-management/ward-absence-tasks";
import type { resolveSubjectPatient, ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import type { BedItem } from "./ward-bed-tone";
import type { ComingRowUndo } from "./ward-coming-and-going";
import type { WardBedFilter } from "./ward-telemetry-ribbon";
import type { WardFlowTab, WardShiftView } from "./ward-home-tab-model";

// The props of `WardHomeTab`, split out of `ward-home-tab.tsx` to keep it under its line cap.
export interface WardHomeTabProps {
  unit: Unit;
  units: Unit[];
  capacity: { available: number; occupied: number };
  accepted: Movement[];
  heldAfterStop?: Movement[];
  incoming: Movement[];
  withdrawn: Movement[];
  overridesHere: OverrideEntry[];
  now: Instant;
  presentation: "overview" | "answer";
  activeAnswerIndex: number;
  setAnswerIndex: React.Dispatch<React.SetStateAction<number>>;
  visibleIncoming: Movement[];
  declineOpenFor: string | null | undefined;
  toggleDecline: (movementId: string) => void;
  declineReason: DeclineReason | "" | undefined;
  setDeclineReason:
    React.Dispatch<React.SetStateAction<DeclineReason | undefined>> | ((reason: DeclineReason | undefined) => void);
  submitDecline: (event: React.FormEvent<HTMLFormElement>, movementId: string) => void;
  priorRejectionCountRef: React.MutableRefObject<number>;
  rejections: Rejection[];
  dispatch: (action: WardFlowEvent) => void;
  setCheckToken: React.Dispatch<React.SetStateAction<number>>;
  recentAnswers: Array<{ key: string; movementId: string; outcome: string; reason?: string; at?: Instant }>;
  breakdown: { confirmedToday: number; expectedToday: number; onLeave: number };
  capacityConfirmationForm?: () => React.ReactNode;
  pendingBedReleasesCount: number;
  unitLeaveBedsCount: number;
  resolvePatientIdentity: (movementOrAdmission: Parameters<typeof resolveSubjectPatient>[0]) => ResolvedPatientInfo;
  lastActionRejection: Rejection | null | undefined;
  overrideReasonForm: (movementId: string) => React.ReactNode;
  onAcceptInPrinciple?: (movementId: string, unitId: string, extendedHold?: boolean) => void;
  /** Why this desk may not answer the ward's referrals at all, such as the site bed manager (D-80). */
  answerBlockedReason?: string;
  liveFormAlerts: Array<{
    key: string;
    title: string;
    countdown: string;
    text: string;
    tone: "critical" | "warning" | "info";
    actionLabel?: string;
    actionTarget?: "answer" | "arrival" | "discharges";
    movementId?: string;
  }>;
  onOpenDecisions?: () => void;
  morningRollupConfirmed?: boolean;
  morningRollupTimeLabel?: string;
  onConfirmMorningRollup?: () => void;
  onConfirmBedsAndMorningRollup?: () => void;
  onOpenConfirmNumbers?: () => void;
  onOpenArrival?: (movementId: string) => void;
  /** Pull a bed for an accepted patient from the Ward flow Admissions list (A1-6). */
  onPullPatient?: (movementId: string, unitId: string) => void;
  onOpenDischarges?: () => void;
  onConfirmRelease?: (releaseId: string) => void; // WH4: the phone round's Confirm discharge
  /** The ward's beds, as the bed board draws them. Drives Every bed. */
  bedsList?: BedItem[];
  /** Audit A3-1: this ward's absences on an order, from `absentOnOrder` (one Act now row each). */
  absencesOnOrder?: ReturnType<typeof absentOnOrder>;
  /** Opens the bed's dossier. */
  onSelectBed?: (bedNumber: number) => void;
  /** A quiet line under the bed squares (the coordinator's refresh request). */
  squaresAfter?: React.ReactNode;
  /** Simplification 26 Nov 2026 (item 6): the refresh request mark, in the desktop checks card. */
  refreshMark?: React.ReactNode;
  /** Wave 4 (W7): the inline Undo on an arrival row just pulled ("Undo pull · until 10:46"). */
  undoPullFor?: (movementId: string) => ComingRowUndo | null;
  /** Ruling 11 (D-191): Confirm arrival with no pulled bed opens the pull step, then the arrival. */
  onPullThenArrive?: (movementId: string) => void;
  /** The bed board's filter, owned by the screen so the hero pills can set it. */
  bedFilter?: WardBedFilter;
  onBedFilterChange?: (filter: WardBedFilter) => void;
  /** Find box text from the screen's tool row: beds that do not match fade. */
  bedQuery?: string;
  /** Which list the Ward flow panel shows. */
  flowTab?: WardFlowTab;
  onFlowTabChange?: (tab: WardFlowTab) => void;
  /** Which view This shift shows. */
  shiftView?: WardShiftView;
  onShiftViewChange?: (view: WardShiftView) => void;
  /** True once the morning rollup is past its time and still not confirmed. */
  morningRollupOverdue?: boolean;
  /** Opens every arrival in full (the arrivals view). */
  onOpenArrivals?: () => void;
  /** Opens the full bed list. */
  onOpenBeds?: () => void;
  /** Lets the screen return focus to a bed's tile when its drawer closes. */
  registerBedTrigger?: (bedNumber: number, element: HTMLButtonElement | null) => void;
  /**
   * Bed board (v10 pass 3, opened by Place or move): replaces Every bed and This shift, so Ward flow
   * stays beside it in the rail exactly as on Home.
   */
  bedArea?: React.ReactNode;
  /**
   * Phone (v10): which of This shift or Ward flow is open as a bottom sheet. Passed only on a
   * phone; when it is undefined the cards sit in the page as on desktop.
   */
  phonePanel?: "shift" | "flow" | null;
  onPhonePanelChange?: (panel: "shift" | "flow" | null) => void;
  /** Desktop and iPad (WH2, 3 Nov 2026): whether the This shift sheet is open over Ward home. */
  shiftSheetOpen?: boolean;
  onShiftSheetOpenChange?: (open: boolean) => void;
  /** Phone: the hero's foot facts (shift, cohort, roster, checking), kept in Ward figures. */
  phoneHeroFoot?: React.ReactNode;
  /** Phone: the one line under Ward figures, right now, while it is closed. */
  phoneFiguresSummary?: string;
  /** Desktop and tablet: the checks card's counts on one line, shown while it is folded (D-276). */
  checksSummary?: string;
  /** Phone: the find box, which sits under Every bed. */
  phoneFind?: React.ReactNode;
  /** Phone: the shift name and hours, under the This shift sheet's title. */
  phoneShiftLabel?: string;
  /** Phone: tells the screen a bed's card is open in the round, so the ward card steps aside. */
  onWalkingChange?: (walking: boolean) => void;
  /** Opens placing and moving (the bed board) inside Ward home (`WardPlaceOrMove`). */
  onOpenBoard?: () => void;
  /** People accepted for this ward and waiting to be placed in a bed. */
  boardWaitingCount?: number;
}
