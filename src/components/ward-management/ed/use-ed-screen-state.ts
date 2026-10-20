"use client";

// The ED screen's own state, grouped by what it serves. Split out of `ed-screen.tsx` unchanged
// (fix list 2.5 and 9.6, 15 Oct 2026). `EdScreen` calls these hooks in the order their state was
// declared there, so every effect still runs in the same order.
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type {
  LegalFormReceiptCorrectionReason,
  LegalStatusChangeReason,
  UrgencyChangeReason,
} from "@/components/ward-management/ward-change-reasons";
import type { WardFlowContextValue } from "@/components/ward-management/ward-flow-provider";
import type { LegalStatus, ReferralGender } from "@/components/ward-management/ward-model";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { edById } from "@/components/ward-management/ward-sites";
import { useModalFocus, type useOptionalToast } from "@/components/wf";
import {
  BLANK_TRANSPORT_DRAFT,
  BLANK_TYPED_EXPIRY_DRAFT,
  DEFAULT_DRAFT,
  type LegalFormExpiryDraftState,
  type ReferralDraftState,
  type TransportDraftState,
} from "./ed-screen-model";

/** The raise-into-a-movement form: whether it is open, its draft, and the referral it is raised from. */
export function useEdReferralDraft() {
  const [referralOpen, setReferralOpen] = useState(false);
  const [draft, setDraft] = useState<ReferralDraftState>(DEFAULT_DRAFT);
  // Opus review round 2, 17 September 2026 (P2), item 6: which front-door referral (if any) the
  // open "Raise a referral" form is being raised FROM. `undefined` is the ordinary, unlinked case
  // (the form's existing behaviour, untouched). Set only by the inbox row's own "Raise into a
  // movement" button, alongside a gender prefill from that referral's own recorded gender — see
  // `referralWardGender` below — and cleared once the form is submitted or the generic toggle
  // opens a fresh, unlinked form instead.
  const [raisingFromReferralId, setRaisingFromReferralId] = useState<string | undefined>(undefined);
  return { referralOpen, setReferralOpen, draft, setDraft, raisingFromReferralId, setRaisingFromReferralId };
}

/** Values typed on the board that stay on this screen only. */
export function useEdBoardDrafts() {
  // Opus review round 2, 17 September 2026 (P2): the `gender_designation` gate's own refusal says
  // "Record gender first", and this is the control that lets an ED clinician actually do that once
  // a movement already exists — `draft.gender` above only ever answers the intake form's OWN
  // not-yet-raised referral. One draft value per movement, the same shape `urgencyDraft` below
  // holds for its own per-movement correction.
  const [genderRecordDraft, setGenderRecordDraft] = useState<Record<string, ReferralGender | "">>({});
  const [formOverrides, setFormOverrides] = useState<Record<string, string | null>>({});
  const [reviewStatusOverrides, setReviewStatusOverrides] = useState<Record<string, string>>({});
  const [clearanceOverrides, setClearanceOverrides] = useState<Record<string, "yes" | "no" | null>>({});
  const [presentationDrafts, setPresentationDrafts] = useState<Record<string, string>>({});
  const [planDrafts, setPlanDrafts] = useState<Record<string, string[]>>({});
  const hasBoardDrafts =
    Object.keys(formOverrides).length +
      Object.keys(clearanceOverrides).length +
      Object.keys(reviewStatusOverrides).length +
      Object.keys(presentationDrafts).length +
      Object.keys(planDrafts).length >
    0;
  return {
    genderRecordDraft,
    setGenderRecordDraft,
    formOverrides,
    setFormOverrides,
    reviewStatusOverrides,
    setReviewStatusOverrides,
    clearanceOverrides,
    setClearanceOverrides,
    presentationDrafts,
    setPresentationDrafts,
    planDrafts,
    setPlanDrafts,
    hasBoardDrafts,
  };
}

/** The panels a board row opens, one row at a time, and the transport booking popup. */
export function useEdRowPanels() {
  const [examinationOpenFor, setExaminationOpenFor] = useState<string | undefined>(undefined);
  const [examinationOutcome, setExaminationOutcome] = useState<
    "inpatient_order" | "community_order" | "revoked" | "further_examination_ordered" | undefined
  >(undefined);
  // RB3, item 19: same open-for-one-row-at-a-time shape as the examination toggle above.
  const [edOutcomeOpenFor, setEdOutcomeOpenFor] = useState<string | undefined>(undefined);
  // Task 2: urgency and legal status can change mid-flight. Both a coordinator and the referring
  // ED clinician may make either change (`EVENT_ROLE.CHANGE_URGENCY`/`CHANGE_LEGAL_STATUS`), so
  // this screen dispatches as role "ed" — the shortlist panel's own control dispatches as
  // "coordinator". Each control keeps its own open-for/draft state, the same shape the
  // examination toggle above already uses.
  const [urgencyChangeOpenFor, setUrgencyChangeOpenFor] = useState<string | undefined>(undefined);
  const [urgencyDraft, setUrgencyDraft] = useState<{
    urgency: 1 | 2 | 3;
    reason: UrgencyChangeReason | undefined;
  }>({
    urgency: 1,
    reason: undefined,
  });
  const [legalStatusChangeOpenFor, setLegalStatusChangeOpenFor] = useState<string | undefined>(undefined);
  const [legalStatusDraft, setLegalStatusDraft] = useState<{
    legalStatus: LegalStatus | undefined;
    reason: LegalStatusChangeReason | undefined;
  }>({ legalStatus: undefined, reason: undefined });

  // `TR-D1`: the sending team books the transport out, and this department is the sending team for
  // its own patients. One open-for id and one draft, the same shape the three toggles above use —
  // only one panel is open at a time, so one draft cannot be read against the wrong patient. The
  // draft starts BLANK and is reset to blank on every toggle; see `ESCORT_ANSWERS`.
  const [transportOpenFor, setTransportOpenFor] = useState<string | undefined>(undefined);
  // `fromRecord` is set only when the patient record opened the plan, so closing the plan goes back to
  // that record and not to a record nobody opened (review on PR #365).
  const [arrivalPlan, setArrivalPlan] = useState<{ id: string; fromRecord: boolean } | undefined>(undefined);
  const arrivalPlanOpenFor = arrivalPlan?.id;
  const arrivalPlanFromRecord = arrivalPlan?.fromRecord === true;
  const setArrivalPlanOpenFor = useCallback(
    (id: string | undefined) => setArrivalPlan(id === undefined ? undefined : { id, fromRecord: false }),
    [],
  );
  const openArrivalPlanFromRecord = useCallback((id: string) => setArrivalPlan({ id, fromRecord: true }), []);
  const [transportDraft, setTransportDraft] = useState<TransportDraftState>(BLANK_TRANSPORT_DRAFT);
  // Owner's third ruling, 2026-09-17: the booking control is a popup (dialog), never an inline
  // panel — `role="dialog"`, focus moved in on open, trapped while open, and released on Escape.
  // One ref suffices because `transportOpenFor` names at most one open movement at a time, so at
  // most one dialog is ever mounted.
  const transportDialogRef = useRef<HTMLDivElement | null>(null);
  // The dialog renders only for a listed, bookable movement, so the modal contract follows the
  // dialog element itself rather than `transportOpenFor` alone.
  const [transportDialogMounted, setTransportDialogMounted] = useState(false);
  const setTransportDialogNode = useCallback((node: HTMLDivElement | null) => {
    transportDialogRef.current = node;
    setTransportDialogMounted(node !== null);
  }, []);
  function closeTransportDialog() {
    setTransportOpenFor(undefined);
    setTransportDraft(BLANK_TRANSPORT_DRAFT);
  }
  /**
   * The shared modal contract (`useModalFocus`): the patient's sheet beneath and the page are inert
   * while the popup is open, focus moves to its first field, Tab wraps inside it, Escape closes only
   * the popup (handled first, so neither the sheet nor this screen's own Escape also fires), and
   * focus returns to the control that opened it. The stack reads the DOM live, so a field added to
   * the dialog later is trapped automatically.
   */
  const { rootRef: transportBackdropRef } = useModalFocus({
    open: transportDialogMounted,
    onClose: closeTransportDialog,
    panelRef: transportDialogRef,
    focusOnOpen: "immediate",
    keyPhase: "capture",
  });
  const [withdrawOpenFor, setWithdrawOpenFor] = useState<string | undefined>(undefined);
  // T3: one open-for id and one draft, the same shape every toggle above uses — only one panel is
  // open at a time, so one draft cannot be read against the wrong patient. "Record expiry from the
  // form" and "Record an extension" are the same panel wearing a different legend and submit
  // label, chosen at render time from `movement.legalForm.dueAt`.
  const [legalFormExpiryOpenFor, setLegalFormExpiryOpenFor] = useState<string | undefined>(undefined);
  const [legalFormExpiryDraft, setLegalFormExpiryDraft] = useState<LegalFormExpiryDraftState>(BLANK_TYPED_EXPIRY_DRAFT);
  // T4: one open-for id and one draft, the same shape every toggle above uses. The draft starts
  // `undefined`, never the first reason in the list — a reason nobody picked would be filed as a
  // clinician's own choice, the same discipline `declineDraft` above holds to.
  const [receiptCorrectionOpenFor, setReceiptCorrectionOpenFor] = useState<string | undefined>(undefined);
  const [receiptCorrectionReasonDraft, setReceiptCorrectionReasonDraft] = useState<
    LegalFormReceiptCorrectionReason | undefined
  >(undefined);
  const [communityReferralOpenFor, setCommunityReferralOpenFor] = useState<string | undefined>(undefined);
  const [communityTeamChoice, setCommunityTeamChoice] = useState<string>("");

  function toggleExamination(movementId: string) {
    setExaminationOpenFor((current) => (current === movementId ? undefined : movementId));
    setExaminationOutcome(undefined);
  }

  function toggleUrgencyChange(movementId: string, currentUrgency: 1 | 2 | 3) {
    setUrgencyChangeOpenFor((current) => (current === movementId ? undefined : movementId));
    setUrgencyDraft({ urgency: currentUrgency, reason: undefined });
  }

  // Blank on every open, as the legal form expiry below: the new status is a person's explicit
  // choice, never the current one or a default left standing (owner rule, 19 Oct 2026).
  function toggleLegalStatusChange(movementId: string) {
    setLegalStatusChangeOpenFor((current) => (current === movementId ? undefined : movementId));
    setLegalStatusDraft({ legalStatus: undefined, reason: undefined });
  }

  function toggleWithdrawReferral(movementId: string) {
    setWithdrawOpenFor((current) => (current === movementId ? undefined : movementId));
  }

  function toggleLegalFormExpiry(movementId: string) {
    setLegalFormExpiryOpenFor((current) => (current === movementId ? undefined : movementId));
    // Blanked on every open, the same ruling `toggleBookTransport` below records: a remembered
    // date or time from a previous patient's panel would stand in for an unmade decision, and a
    // legal form's expiry is exactly that kind of clinical fact.
    setLegalFormExpiryDraft(BLANK_TYPED_EXPIRY_DRAFT);
  }

  function toggleReceiptCorrection(movementId: string) {
    setReceiptCorrectionOpenFor((current) => (current === movementId ? undefined : movementId));
    // Blanked on every open, the same ruling `toggleLegalFormExpiry` above records: a remembered
    // reason from a previous patient's panel would stand in for an unmade decision.
    setReceiptCorrectionReasonDraft(undefined);
  }

  function toggleBookTransport(movementId: string) {
    setTransportOpenFor((current) => (current === movementId ? undefined : movementId));
    // ⚠️ **BLANKED ON EVERY OPEN, NOT ONLY ON EVERY CLOSE.** Carrying the previous patient's
    // answers into the next panel would be a remembered value standing in for an unmade decision —
    // the same ruling as a derived one, and harder to see because it was true once.
    setTransportDraft(BLANK_TRANSPORT_DRAFT);
  }

  return {
    examinationOpenFor,
    setExaminationOpenFor,
    examinationOutcome,
    setExaminationOutcome,
    edOutcomeOpenFor,
    setEdOutcomeOpenFor,
    urgencyChangeOpenFor,
    setUrgencyChangeOpenFor,
    urgencyDraft,
    setUrgencyDraft,
    legalStatusChangeOpenFor,
    setLegalStatusChangeOpenFor,
    legalStatusDraft,
    setLegalStatusDraft,
    transportOpenFor,
    setTransportOpenFor,
    arrivalPlanOpenFor,
    setArrivalPlanOpenFor,
    arrivalPlanFromRecord,
    openArrivalPlanFromRecord,
    transportDraft,
    setTransportDraft,
    setTransportDialogNode,
    closeTransportDialog,
    transportBackdropRef,
    withdrawOpenFor,
    setWithdrawOpenFor,
    legalFormExpiryOpenFor,
    setLegalFormExpiryOpenFor,
    legalFormExpiryDraft,
    setLegalFormExpiryDraft,
    receiptCorrectionOpenFor,
    setReceiptCorrectionOpenFor,
    receiptCorrectionReasonDraft,
    setReceiptCorrectionReasonDraft,
    communityReferralOpenFor,
    setCommunityReferralOpenFor,
    communityTeamChoice,
    setCommunityTeamChoice,
    toggleExamination,
    toggleUrgencyChange,
    toggleLegalStatusChange,
    toggleWithdrawReferral,
    toggleLegalFormExpiry,
    toggleReceiptCorrection,
    toggleBookTransport,
  };
}

export type DepartmentTabKey = "review" | "cleared" | "expected" | "forms" | "referred";

/** How the board is viewed: panes, sheets, filters, search, sort, the open record and the lists tab. */
export function useEdBoardView() {
  const [needsRailOpen, setNeedsRailOpen] = useState(false);
  const [phonePane, setPhonePane] = useState<"board" | "needs" | "lists">("board");
  /** Phone: the board row whose person sheet is open, and why the last tapped action is unavailable. */
  const [phoneSheetFor, setPhoneSheetFor] = useState<string | undefined>(undefined);
  const [phoneSheetReason, setPhoneSheetReason] = useState<string | undefined>(undefined);
  const [departmentListTab, setDepartmentListTab] = useState<DepartmentTabKey>("review");
  const [boardFilter, setBoardFilter] = useState<
    "all" | "not_reviewed" | "under_form" | "no_destination" | "discharge" | "withdrawn"
  >("all");
  /** v10 hero highlight: the pressed hero chip keeps its rows solid and dims the rest. */
  const [heroHighlight, setHeroHighlight] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const patientDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = patientDialogRef.current;
    if (!selectedPatientId || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => {
      dialog.close?.();
      trigger?.focus();
    };
  }, [selectedPatientId]);

  const [fullscreenBoard, setFullscreenBoard] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientSort, setPatientSort] = useState("longest");
  const [referralDetailsOpenFor, setReferralDetailsOpenFor] = useState<string>();
  return {
    needsRailOpen,
    setNeedsRailOpen,
    phonePane,
    setPhonePane,
    phoneSheetFor,
    setPhoneSheetFor,
    phoneSheetReason,
    setPhoneSheetReason,
    departmentListTab,
    setDepartmentListTab,
    boardFilter,
    setBoardFilter,
    heroHighlight,
    setHeroHighlight,
    selectedPatientId,
    setSelectedPatientId,
    patientDialogRef,
    fullscreenBoard,
    setFullscreenBoard,
    patientQuery,
    setPatientQuery,
    patientSort,
    setPatientSort,
    referralDetailsOpenFor,
    setReferralDetailsOpenFor,
  };
}

/** Escape closes the innermost open thing: the arrival plan, the transport popup, the record, then the larger board. */
export function useEdEscapeKey({
  arrivalPlanOpenFor,
  setArrivalPlanOpenFor,
  transportOpenFor,
  closeTransportDialog,
  selectedPatientId,
  setSelectedPatientId,
  fullscreenBoard,
  setFullscreenBoard,
}: {
  arrivalPlanOpenFor: string | undefined;
  setArrivalPlanOpenFor: (value: string | undefined) => void;
  transportOpenFor: string | undefined;
  closeTransportDialog: () => void;
  selectedPatientId: string | null;
  setSelectedPatientId: (value: string | null) => void;
  fullscreenBoard: boolean;
  setFullscreenBoard: (value: boolean) => void;
}) {
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        if (arrivalPlanOpenFor !== undefined) {
          setArrivalPlanOpenFor(undefined);
        } else if (transportOpenFor !== undefined) {
          closeTransportDialog();
        } else if (selectedPatientId !== null) {
          setSelectedPatientId(null);
        } else if (fullscreenBoard) {
          setFullscreenBoard(false);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- The dependencies it had inside EdScreen: the setters are useState setters and closeTransportDialog only calls them.
  }, [arrivalPlanOpenFor, transportOpenFor, selectedPatientId, fullscreenBoard]);
}

/** A2-1: announces a raised referral once its movement lands on this department's board. */
export function useEdRaiseAnnouncement({
  raisePendingRef,
  movements,
  department,
  registryPatients,
  referrals,
  toast,
  setSelectedPatientId,
}: {
  raisePendingRef: RefObject<Set<string> | null>;
  movements: WardFlowContextValue["movements"];
  department: ReturnType<typeof edById>;
  registryPatients: WardFlowContextValue["patients"];
  referrals: WardFlowContextValue["referrals"];
  toast: ReturnType<typeof useOptionalToast>;
  setSelectedPatientId: (value: string | null) => void;
}) {
  useEffect(() => {
    const before = raisePendingRef.current;
    if (before === null) return;
    const raised = movements.find((movement) => !before.has(movement.id) && movement.originEdId === department?.id);
    if (!raised) return;
    raisePendingRef.current = null;
    const name = resolveSubjectPatient(raised, { patients: registryPatients, referrals, movements }).displayName;
    toast?.push({
      tone: "success",
      title: "Referral raised",
      body: `${name} is on this department's board.`,
      action: {
        label: "Open row",
        onAction: () => setSelectedPatientId(raised.id),
      },
    });
    announceToWardShell(`Referral raised for ${name}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Runs when a raise lands, nothing else.
  }, [movements]);
}
