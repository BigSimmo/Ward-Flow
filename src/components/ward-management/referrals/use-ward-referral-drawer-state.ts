import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { patientRegistrationScope } from "../ward-patient-registration";
import {
  useReferralCommandCompletion,
  submissionId,
  useReferralPatientRegistration,
  useReferralRegistrationDraft,
} from "./use-referral-command-completion";
import { useState, useId, useEffect, useMemo, useRef, useCallback } from "react";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { hasOpenSheet } from "@/components/wf/sheet-focus";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { calendarDateOf, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { referralAgeBand } from "./referral-age-band";
import { cleanReferralContact, cleanReferralFields, cleanReferralText } from "./referral-text-clean";
import { referralDraftKeptOnScreen } from "./referral-draft-kept-check";
import { noticeDraftKept } from "./referral-draft-saved-notice";
import {
  URGENCY_LEVELS,
  HEALTH_SERVICES,
  type AtsCategory,
  type HomeRegion,
  type RecordedSex,
  type ReferralDestination,
  type Cohort,
  type HealthService,
  REFERRAL_HISTORY_LIMITS,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { OVERDUE_AFTER_MINUTES_BY_TIER } from "@/components/ward-management/ward-operational-defaults";
import {
  patientHeldBedUnitId,
  patientInBedOnUnit,
  resolveSubjectPatient,
} from "@/components/ward-management/ward-patient-resolver";
import {
  NOT_ON_SENDING_WARD_OTHER,
  type NotOnSendingWardReason,
} from "@/components/ward-management/ward-change-reasons";
import { edById, siteByCode, siteDirectory } from "@/components/ward-management/ward-sites";
import { catchmentRoutingDestinations, lookupCatchment } from "../ward-catchment";
import { suburbOptions } from "./referral-destination-options";
import { clearanceNeeded, communityPurposeRow, communityReferralError, communityUrgency } from "./community-short-form";
import { isTentativeDiagnosisBlock } from "../ward-diagnosis";
import { documentationError, intakeCharts, type DocumentationDraft } from "./referral-flow-panels";
import { UNIDENTIFIED_REFERRAL_PREFIX } from "./referral-inbox";
import {
  discardReferralDraft,
  retireAcceptedReferralDraft,
  draftFingerprint,
  draftNeedsChartReattachment,
  keepReferralDraft,
  readKeptReferralDraftAt,
  readLastReferrerContact,
  rememberReferrerContact,
  restartReferralDraft,
  useLiveReferralDraftKey,
  useReferralDraftAutosave,
  useReferralDraftRecovery,
} from "./referral-draft-store";
import { useReferralPatientSelection, useReferralRegistrationWork } from "./use-referral-patient-selection";
import { useReferralSectionNavigation } from "./use-referral-section-navigation";
import { drawerFootStatus } from "./referral-drawer-foot-status";
import { focusFirstInvalidField, referralInboxSummary } from "./referral-drawer-helpers";
import * as fromRecord from "./referral-record-prefill";
import { useReferralCarryOver } from "./use-referral-carry-over";
import { useReferralAlternatives } from "./use-referral-alternatives";
import { type ReferralTextInput } from "./referral-letter";
import { TIME_FIELD_ERROR, useIsPhone, useModalFocus, useOptionalToast } from "@/components/wf";
import { usePathname } from "next/navigation";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { profileForChromeRole } from "@/components/ward-management/settings/settings-profile";
import { createReadmissionIndex, priorDischargeWithinWindow } from "@/components/ward-management/ward-readmission";
import {
  CLEARANCE_CHECKS,
  REFERRAL_RISK_FLAGS,
  referralContactLimitError,
  referralIntakeError,
  REFERRAL_REASON_MAX_CHARACTERS,
  type ClearanceChecklist,
  type ReferralContact,
  type ReferralIntakeDetails,
  clearanceChecklistWords,
  referralNeedsWords,
} from "./referral-submission";
import * as warn from "./referral-send-warnings";
import {
  type MockPatientProfile,
  NOT_RECORDED,
  wardReferralDestinations,
  SAMPLE_PATIENTS,
  NO_PATIENT_KEY,
  PATIENT_KEY_PREFIX,
  sampleProfile,
  ageSexLabel,
  type WardCapacityRecord,
  useWardCapacity,
  type DrawerCategory,
  type DrawerSection,
  DESTINATIONS,
  sectionIdsFor,
  RISK_FLAG_LABELS,
  documentationNeeded,
  documentationItems,
  contactFieldErrors,
  communityDestinations,
  singleRecipientLabel,
  missingDestinationError,
  type KeptDraft,
  type CommunityNeeds,
  type EdNeeds,
  needsFor,
  patientKeyFor,
  GENDER_UNANSWERED,
  recordedSexAndGender,
  type ReferralGenderAnswer,
  isOwnLeaveGuardAnchor,
  isListedOrigin,
  type WardReferralDrawerContentProps,
} from "./ward-referral-drawer-model";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { NO_SENDING_WARD, useReferralUrlPrefill, useSheetSender } from "./use-referral-sheet-sender";
export { NO_SENDING_WARD };
/**
 * All of the referral slide-out's state, effects and handlers, moved unchanged and in their
 * original order from `ward-referral-drawer.tsx`. The sections read the result as `s`.
 */
export function useWardReferralDrawerState({
  onClose,
  onSelectPatient,
  withBackdrop = false,
  initialCategory = "ward",
  initialDestination,
  initialPatientId,
  initialOriginSiteCode,
  initialSendingTeam,
  initialUnitIds,
  closeRequestRef,
  view,
  onViewChange,
  onRestart,
}: WardReferralDrawerContentProps) {
  const searchId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef<number | null>(null);
  const capacityRecords = useWardCapacity();
  // Feature 11: sent as the referral's source; a ward page as its own ward (access plan 8, Josh 15 Oct 2026).
  const gate = useRoleGate();
  const access = useEffectiveWardAccess();
  const pathname = usePathname() ?? "";
  const deskRole = access.role === "coordinator" || access.role === "admin" ? wardChromeRole(pathname) : access.role;
  const myProfile = profileForChromeRole(deskRole); // Live audit 8 Nov 2026: a desk names itself.
  const addPatientGate = gate("ADD_PATIENT");
  const {
    movements,
    patients,
    referrals,
    rejections,
    configuration,
    dayZero,
    dispatch,
    wardReferralInbox,
    admissions,
    units,
  } = useWardFlowSelect(
    "movements",
    "patients",
    "referrals",
    "rejections",
    "configuration",
    "dayZero",
    "dispatch",
    "wardReferralInbox",
    "admissions",
    "units",
  );
  const { scenario, worldGeneration } = useWardFlowSelect("scenario", "worldGeneration");
  const now = useWardFlowClock();
  const { sendGate, sendingWard, senderMissing } = useSheetSender(gate, units, pathname, searchId);
  const toast = useOptionalToast();
  const urlPrefill = useReferralUrlPrefill({
    initialOriginSiteCode,
    initialPatientId,
    initialSendingTeam,
    initialUnitIds,
  });
  const effectiveInitialPatientId = initialPatientId ?? urlPrefill?.personId;
  const effectiveInitialOriginSiteCode = initialOriginSiteCode ?? urlPrefill?.site;
  const [prefillKey] = useState(() =>
    effectiveInitialPatientId ? patientKeyFor(effectiveInitialPatientId, { movements, patients, referrals }) : null,
  );
  const {
    draftStorageKey,
    draftRestored,
    draftOwnerVersion,
    storedDraft,
    kept,
    keepsAnotherPersonsDraft,
    draftDiscardOwner,
  } = useReferralDraftRecovery<KeptDraft>(
    `${scenario}/${worldGeneration}`,
    effectiveInitialPatientId,
    prefillKey,
    `${PATIENT_KEY_PREFIX}${effectiveInitialPatientId}`,
  );
  const [recoveryId] = useState(() => kept?.submissionId ?? submissionId());
  // An unnamed opening starts on nobody, not another site's.
  const fromEntryPoint = kept === null && prefillKey !== null;
  const initialPatientKey = kept?.activePatientKey ?? prefillKey ?? NO_PATIENT_KEY;
  const [activePatientKey, setActivePatientKey] = useState<string>(initialPatientKey);
  const [extraPatientKeys, setExtraPatientKeys] = useState<string[]>(
    initialPatientKey in SAMPLE_PATIENTS ? [] : [initialPatientKey],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const noPatientChosen = activePatientKey === NO_PATIENT_KEY;
  const liveDraftKey = useLiveReferralDraftKey(activePatientKey, draftStorageKey, keepsAnotherPersonsDraft);
  const [addedInFormKey, setAddedInFormKey] = useState<string | null>(null); // WT-28
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionId = useId();
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>(
    kept?.selectedUnitIds ?? [...(initialUnitIds ?? [])],
  );
  const [selectedRecipient, setSelectedRecipient] = useState(kept?.selectedRecipient ?? "");
  const [communityPurpose, setCommunityPurpose] = useState(kept?.communityPurpose ?? ("" as const));
  const { carry, start, carryFor } = useReferralCarryOver(kept, initialPatientKey); // Feature 39
  const [ageBand, setAgeBand] = useState<Cohort | "">(start.ageBand ?? "");
  // Finding 36: the soft note for an adult from 18 to 24, set with the prefilled band.
  const [ageBandNote, setAgeBandNote] = useState<string | null>(("ageBandNote" in start && start.ageBandNote) || null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [guardOpen, setGuardOpen] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const registrationDraft = useReferralRegistrationDraft();
  const { newPatientOpen, setNewPatientOpen, newPatient, setNewPatient } = registrationDraft;
  const { newPatientDateText, setNewPatientDateText, newPatientDirty, resetNewPatient } =
    useReferralRegistrationWork(registrationDraft);
  const guardKeepRef = useRef<HTMLButtonElement>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const [sentReferralId, setSentReferralId] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<Instant | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState<Partial<Record<DrawerSection | "contact", boolean>>>({});
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const [inboxUnitId, setInboxUnitId] = useState<string | null>(null);
  // v10 phone: the four steps are a list, and the chosen step opens as a tall sheet over it.
  const isPhone = useIsPhone();
  const [phoneStepOpen, setPhoneStepOpen] = useState(false);
  const sampleProfiles = useMemo(
    () =>
      Object.fromEntries(
        [...new Set([...Object.keys(SAMPLE_PATIENTS), ...extraPatientKeys, activePatientKey])].map((key) => [
          key,
          sampleProfile(key, { movements, patients, referrals, dayZero, admissions, units }, now),
        ]),
      ) as Record<string, MockPatientProfile>,
    [movements, patients, referrals, dayZero, admissions, units, now, extraPatientKeys, activePatientKey],
  );
  const defaultPatient = sampleProfiles[initialPatientKey]!;
  const [arrivalPlanOpen, setArrivalPlanOpen] = useState(false);
  const liveMovement = movements.find((m) => m.id === activePatientKey);
  const patientRecord = liveMovement
    ? resolveSubjectPatient(liveMovement, { patients, referrals, movements }).patient
    : activePatientKey.startsWith(PATIENT_KEY_PREFIX)
      ? patients.find((patient) => patient.id === activePatientKey.slice(PATIENT_KEY_PREFIX.length))
      : undefined;
  const movementCohort = liveMovement?.cohort;
  const effectiveCohort: Cohort | "" = movementCohort ?? ageBand;
  const arrivalRole = initialCategory === "community" ? "community" : initialCategory === "ed" ? "ed" : "ward";
  const recordState = { patients, referrals, movements }; // WS-06, WS-08, WS-11: referral-record-prefill.ts
  const [documentation, setDocumentation] = useState<DocumentationDraft>(
    () => kept?.documentation ?? fromRecord.documentationFromBoard(liveMovement),
  );
  const isMedicalCleared = documentation.medical === "yes";
  // A2-6 and WS-07 (H-0972): the draft, the details last sent in this tab, then the desk's profile.
  const [contact, setContact] = useState<ReferralContact>(() =>
    fromRecord.initialReferrerContact(kept?.contact, readLastReferrerContact<ReferralContact>(), myProfile),
  );
  const initialLookup = lookupCatchment(defaultPatient.suburb);
  const initialTeams = catchmentRoutingDestinations(initialLookup);
  const [catchmentSuburb, setCatchmentSuburb] = useState(kept?.catchmentSuburb ?? defaultPatient.suburb);
  const [catchmentTeam, setCatchmentTeam] = useState(
    kept?.catchmentTeam ?? (initialTeams?.length === 1 ? initialTeams[0] : defaultPatient.catchment),
  );
  const [catchmentService, setCatchmentService] = useState<HealthService | "">(
    kept?.catchmentService ?? HEALTH_SERVICES.find((service) => service === urlPrefill?.service) ?? "",
  );
  const [recordedRegion] = useState(() => fromRecord.recordedHomeRegion(patientRecord?.id, liveMovement, recordState));
  const [catchmentConfirmed, setCatchmentConfirmed] = useState(
    kept?.catchmentConfirmed ??
      ((fromEntryPoint && !!(initialTeams?.length === 1 ? initialTeams[0] : defaultPatient.catchment)?.trim()) ||
        fromRecord.catchmentFromRecord(patientRecord, catchmentTeam, recordedRegion)),
  );
  const [catchmentEditing, setCatchmentEditing] = useState(false);
  // Finding 40 (Josh, 27 Oct 2026): "Catchment not known" answers it for ward/ED; community still needs it.
  const [catchmentNotKnown, setCatchmentNotKnown] = useState(kept?.catchmentNotKnown ?? false);
  const catchmentAnswered = catchmentNotKnown || (catchmentConfirmed && !!catchmentTeam.trim());
  const [homeRegion, setHomeRegion] = useState<HomeRegion | "">(kept?.homeRegion ?? recordedRegion ?? "");
  const [activeSection, setActiveSection] = useState<DrawerSection>(
    (kept?.destType === "community" && kept.activeSection === "documentation" ? "referral" : kept?.activeSection) ??
      (catchmentConfirmed && !!homeRegion && !!liveMovement?.cohort ? "referral" : "patient"),
  );
  const [unidentified, setUnidentified] = useState<string | null>(kept?.unidentified ?? null);
  const liveOriginSite = liveMovement ? edById(liveMovement.originEdId)?.siteCode : undefined;
  // Smart idea 9 (19 Oct 2026): ED/community refer from their own place unless opener, draft or record differ.
  const deskScope = useEffectiveWardAccess().scope;
  const deskOriginSite = deskScope.kind === "ed" ? edById(deskScope.edId)?.siteCode : undefined;
  const deskSendingTeam = deskScope.kind === "team" ? deskScope.teamName : undefined;
  // Opener values (props or web address) win over a kept draft when the drawer starts.
  const openerSourceKind: "community" | "ed" | undefined =
    (initialSendingTeam ? "community" : undefined) ??
    (urlPrefill?.source === "ed" && effectiveInitialOriginSiteCode ? "ed" : undefined) ??
    (effectiveInitialOriginSiteCode && initialCategory !== "ward" && initialCategory !== "community"
      ? "ed"
      : undefined);
  const [sourceKind, setSourceKind] = useState<"community" | "ed">(
    openerSourceKind ??
      kept?.sourceKind ??
      (liveOriginSite || initialCategory === "ed" || deskOriginSite ? "ed" : "community"),
  );
  const [originSiteCode, setOriginSiteCode] = useState(
    effectiveInitialOriginSiteCode ?? kept?.originSiteCode ?? deskOriginSite ?? liveOriginSite ?? "",
  );
  const openJourney = fromRecord.openEdJourneyFor(patientRecord?.id, recordState);
  const [sendingTeam, setSendingTeam] = useState(initialSendingTeam ?? kept?.sendingTeam ?? deskSendingTeam ?? "");
  // WS-01 (workflow speed audit, 26 Oct 2026): from the record, else the journey the ED board shows.
  const [known] = useState(() => recordedSexAndGender(patientRecord, liveMovement));
  const [referralSex, setReferralSex] = useState<RecordedSex>(kept?.referralSex ?? known.sex);
  const [referralGender, setReferralGender] = useState<ReferralGenderAnswer>(kept?.referralGender ?? known.gender);
  const [highAcuity, setHighAcuity] = useState(start.highAcuity ?? false);
  const [arrivalEta, setArrivalEta] = useState(kept?.arrivalEta ?? "");
  const [destType, setDestType] = useState<DrawerCategory>(initialDestination ?? kept?.destType ?? "ward");
  // The record's status, or unanswered: never a default (owner rule, 19 Oct 2026; LEGAL-REF).
  const [legalStatus, setLegalStatus] = useState(() =>
    warn.legalStatusAnswer(
      start.legalStatus ??
        urlPrefill?.legal ??
        (defaultPatient.legalStatus.startsWith("Form")
          ? defaultPatient.legalStatus.split(" ").slice(0, 2).join(" ")
          : defaultPatient.legalStatus),
    ),
  );
  const sentLegal = warn.sentLegalStatus(legalStatus);
  const [urgency, setUrgency] = useState(
    kept?.urgency ??
      (urlPrefill?.ats ? (urlPrefill.ats <= 2 ? "1" : urlPrefill.ats === 3 ? "2" : "3") : defaultPatient.urgency),
  );
  const [atsCategory, setAtsCategory] = useState<AtsCategory | undefined>(kept?.atsCategory ?? urlPrefill?.ats);
  const [security, setSecurity] = useState(
    start.security ?? (defaultPatient.security.toLowerCase().includes("secure") ? "Secure" : "Open"),
  );
  const [provisionalDiag, setProvisionalDiag] = useState(
    kept?.provisionalDiag ??
      (urlPrefill?.complaint && isTentativeDiagnosisBlock(urlPrefill.complaint)
        ? urlPrefill.complaint
        : defaultPatient.provisionalDiag),
  );
  const [doctorNote, setDoctorNote] = useState(kept?.doctorNote ?? defaultPatient.doctorNote);
  const [notOnWard, setNotOnWard] = useState<KeptDraft["notOnWard"]>(kept?.notOnWard);
  // An answer belongs to the ward it was given for, so another ward's page asks again.
  const notOnWardReason = notOnWard && notOnWard.unitId === sendingWard?.id ? notOnWard.reason : "";
  function setNotOnWardReason(reason: NotOnSendingWardReason | "") {
    setNotOnWard(reason && sendingWard ? { unitId: sendingWard.id, reason } : undefined);
  }
  const [clinicalSummary, setClinicalSummary] = useState(kept?.clinicalSummary ?? defaultPatient.clinicalSummary);
  const [transport, setTransport] = useState(kept?.transport ?? "");
  const [transitNote, setTransitNote] = useState(kept?.transitNote ?? defaultPatient.transitNote);
  const [riskFlags, setRiskFlags] = useState<Record<string, boolean>>(kept?.riskFlags ?? defaultPatient.riskFlags);
  const [clearanceChecks, setClearanceChecks] = useState<ClearanceChecklist>(kept?.clearanceChecks ?? {});
  const [communityNeeds, setCommunityNeeds] = useState<CommunityNeeds>(start.communityNeeds ?? {});
  // D-77: a community referral's urgency is its first contact time (Josh, 23 Oct 2026).
  const community = destType === "community";
  const shownUrgency = community ? communityUrgency(communityNeeds.firstContact) : urgency;
  const sectionIds = sectionIdsFor(destType);
  const [edNeeds, setEdNeeds] = useState<EdNeeds>(kept?.edNeeds ?? {});
  const [edArrivalWrong, setEdArrivalWrong] = useState(false);
  const alternatives = useReferralAlternatives(destType === "ward" && !sendingWard, activePatientKey, kept);
  const draftNow: KeptDraft & { needsChartReattachment: boolean } = {
    submissionId: recoveryId,
    needsChartReattachment: draftNeedsChartReattachment(kept, documentation.charts),
    activePatientKey,
    destType,
    activeSection,
    ageBand,
    selectedUnitIds,
    selectedRecipient,
    ...(communityPurpose ? { communityPurpose } : {}),
    documentation,
    contact,
    catchmentSuburb,
    catchmentTeam,
    catchmentService,
    catchmentConfirmed,
    ...(catchmentNotKnown ? { catchmentNotKnown } : {}),
    homeRegion,
    sourceKind,
    originSiteCode,
    sendingTeam,
    referralSex,
    referralGender,
    highAcuity,
    arrivalEta,
    legalStatus,
    urgency,
    atsCategory,
    security,
    provisionalDiag,
    doctorNote,
    clinicalSummary,
    transport,
    transitNote,
    riskFlags,
    clearanceChecks,
    communityNeeds,
    edNeeds,
    unidentified,
    notOnWard,
    ...alternatives.draftField,
  };
  const [openingDraft] = useState(() => (kept ? "" : draftFingerprint(draftNow)));
  const draftJson = draftFingerprint(draftNow);
  // The enclosing Sheet or useWardModalFocus owns the scroll lock: a second save/restore raced stacked sheets.
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    // The phone (to 48rem, the same width the sheet layout uses) closes on a downward swipe.
    if (deltaY > 60 && isPhone) {
      requestClose();
    }
  };
  const drawerRef = useRef<HTMLDivElement>(null);
  const referralDirty = !sentReferralId && draftJson !== openingDraft;
  const dirty = referralDirty || newPatientDirty;
  const [initialKept] = useState(() => (kept ? { at: readKeptReferralDraftAt(), json: draftFingerprint(kept) } : null));
  const {
    sessionSaved: draftSessionSaved,
    keptAt: draftKeptAt,
    nowMs: draftNowMs,
    stop: stopDraftAutosave,
  } = useReferralDraftAutosave({
    draft: draftNow,
    storageKey: liveDraftKey,
    draftJson,
    contentJson: draftFingerprint({ ...draftNow, activeSection: undefined }),
    enabled: !keepsAnotherPersonsDraft,
    dirty: referralDirty,
    initialKeptAt: initialKept?.at ?? null,
    initialKeptJson: initialKept?.json ?? null,
  });
  const { submissionRef, submitReferral, submissionAwaitingRecord } = useReferralCommandCompletion({
    dispatch,
    referrals,
    generation: worldGeneration,
    draftOwnerVersion,
    recoveryId,
    setPending: setSendPending,
    onError: setFlowError,
    onRetired(intake) {
      retireAcceptedReferralDraft(draftNow, liveDraftKey, draftOwnerVersion);
      rememberReferrerContact(intake.referrer, draftOwnerVersion);
    },
    onCommitted() {
      setFlowError(null);
      stopDraftAutosave();
      announceToWardShell("Referral saved. Check the Referrals board for its record before sending again.");
    },
    onAccepted(created) {
      setSentReferralId(created.id);
      setSentAt(now);
    },
  });
  const { approveNextHistoryNavigation } = useDirtyStateGuard({
    isDirty:
      newPatientDirty || (!sentReferralId && !submissionAwaitingRecord && (referralDirty || draftKeptAt !== null)),
    value: JSON.stringify([draftJson, newPatient, newPatientDateText]),
    skipAnchor: isOwnLeaveGuardAnchor,
    // An unfinished Add patient form is not kept, so it always counts as unsaved.
    unloadSafe: () =>
      !newPatientDirty &&
      referralDraftKeptOnScreen(liveDraftKey, draftNow, {
        destType: initialDestination,
        sourceKind: openerSourceKind,
        originSiteCode: effectiveInitialOriginSiteCode,
        sendingTeam: initialSendingTeam,
      }),
  });
  const requestClose = useCallback(() => {
    if (guardOpen) return setGuardOpen(false);
    if (newPatientDirty || (referralDirty && !submissionAwaitingRecord)) return setGuardOpen(true);
    approveNextHistoryNavigation();
    onClose();
  }, [
    guardOpen,
    newPatientDirty,
    referralDirty,
    submissionAwaitingRecord,
    onClose,
    approveNextHistoryNavigation,
    setGuardOpen,
  ]);
  useEffect(() => {
    if (!closeRequestRef) return;
    closeRequestRef.current = requestClose;
    return () => {
      closeRequestRef.current = null;
    };
  }, [closeRequestRef, requestClose]);
  // Close guard for a modal over the drawer: declared before the drawer's own modal hook, so it leaves first.
  const guardBoxRef = useRef<HTMLDivElement | null>(null);
  const { rootRef: guardRootRef } = useModalFocus({
    open: guardOpen,
    onClose: () => setGuardOpen(false),
    panelRef: guardBoxRef,
    initialFocusRef: guardKeepRef,
    focusOnOpen: "immediate",
  });
  // Opened from an entry point with step 1 nearly answered, focus goes to what is still unanswered.
  useEffect(() => {
    if (!fromEntryPoint || activeSection !== "patient" || isPhone) return;
    const frame = requestAnimationFrame(() => {
      if (!homeRegion) document.getElementById(`${sectionId}-region`)?.focus();
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Once, on opening.
  }, []);
  function discardAndClose() {
    stopDraftAutosave({ resumeOnContentEdit: true });
    discardReferralDraft(draftDiscardOwner);
    resetNewPatient();
    setGuardOpen(false);
    approveNextHistoryNavigation();
    onClose();
  }
  function keepAndClose() {
    if (newPatientDirty) {
      setGuardOpen(true);
      return;
    }
    const kept = keepReferralDraft(draftNow, draftOwnerVersion, liveDraftKey);
    setGuardOpen(false);
    approveNextHistoryNavigation();
    onClose();
    noticeDraftKept(toast, kept);
  }
  function handleDrawerClose() {
    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchQuery("");
    } else {
      requestClose();
    }
  }
  // The enclosing Sheet owns focus when embedded. Register a modal only when this drawer has its own backdrop.
  useWardModalFocus(withBackdrop, drawerRef, handleDrawerClose);

  // A2-3: a sheet opened on nobody puts the cursor in the patient search.
  useEffect(() => {
    if (!noPatientChosen || activeSection !== "patient") return;
    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only on opening.
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || !areCharacterShortcutsEnabled()) return;
      if (hasOpenSheet() && !drawerRef.current?.contains(document.activeElement)) return;
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        const active = document.activeElement as HTMLElement | null;
        if (
          active?.tagName !== "INPUT" &&
          active?.tagName !== "TEXTAREA" &&
          active?.tagName !== "SELECT" &&
          !active?.isContentEditable
        ) {
          e.preventDefault();
          onViewChange("new");
          setActiveSection("patient");
          requestAnimationFrame(() => searchInputRef.current?.focus());
          setIsSearchOpen(true);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onViewChange]);

  const rawCurrentPatient = sampleProfiles[activePatientKey] ?? sampleProfiles["WF-009"]!;
  const currentPatient: MockPatientProfile =
    !rawCurrentPatient.gender && referralSex !== "Not recorded"
      ? { ...rawCurrentPatient, gender: referralSex.charAt(0).toUpperCase() }
      : rawCurrentPatient;
  const profileRecord = { movements, patients, referrals, dayZero, admissions, units };
  const { filteredPatients, handleSelectPatient } = useReferralPatientSelection({
    activePatientKey,
    searchQuery,
    profiles: sampleProfiles,
    record: profileRecord,
    now,
    dirty,
    revision: JSON.stringify([draftJson, worldGeneration, sendPending, sentReferralId, access]),
    ownerVersion: draftOwnerVersion,
    registrationDraft,
    setSearchQuery,
    setIsSearchOpen,
    onSelect: selectPatient,
  });

  function selectPatient(key: string, addedInForm: boolean) {
    resetNewPatient();
    const p = sampleProfiles[key] ?? sampleProfile(key, profileRecord, now);
    if (!sampleProfiles[key]) setExtraPatientKeys((keys) => [...keys, key]);
    setActivePatientKey(key);
    setAddedInFormKey(addedInForm ? key : null);
    setNotOnWard(undefined);
    setUnidentified(null);
    setNewPatientOpen(false);
    setSearchQuery("");
    setIsSearchOpen(false);
    setSelectedUnitIds([]);
    setSelectedRecipient("");
    setCommunityPurpose("");
    const matchedMovement = movements.find((movement) => movement.id === key);
    setDocumentation(fromRecord.documentationFromBoard(matchedMovement));
    setCatchmentSuburb(p.suburb);
    const teams = catchmentRoutingDestinations(lookupCatchment(p.suburb));
    const team = teams?.length === 1 ? teams[0]! : p.catchment;
    setCatchmentTeam(team);
    setCatchmentService("");
    setCatchmentEditing(false);
    setCatchmentNotKnown(false);
    const originSite = edById(matchedMovement?.originEdId ?? "")?.siteCode;
    if (originSite && !deskOriginSite) {
      setSourceKind("ed");
      setOriginSiteCode(originSite);
    }
    const record = matchedMovement
      ? resolveSubjectPatient(matchedMovement, { patients, referrals, movements }).patient
      : key.startsWith(PATIENT_KEY_PREFIX)
        ? patients.find((patient) => patient.id === key.slice(PATIENT_KEY_PREFIX.length))
        : undefined;
    // Finding 36 (Josh, 27 Oct 2026): the age band opens on the band the record's date of birth gives
    // on the demo day, still editable. With no usable date of birth it opens blank, as before.
    const band = dayZero instanceof Date ? referralAgeBand(record?.dateOfBirth, calendarDateOf(now, dayZero)) : null;
    const nextCarry = carryFor(key, !!band?.band);
    setAgeBand(band?.band ?? nextCarry.ageBand ?? "");
    setAgeBandNote(band?.note ?? null);
    const region = fromRecord.recordedHomeRegion(record?.id, matchedMovement, recordState);
    setHomeRegion(region ?? "");
    setCatchmentConfirmed(fromRecord.catchmentFromRecord(record, team, region));
    const identity = recordedSexAndGender(record, matchedMovement);
    setReferralSex(identity.sex);
    setReferralGender(identity.gender);
    setHighAcuity(nextCarry.highAcuity ?? false);
    setArrivalEta("");
    setConfirmationOpen(false);
    setFlowError(null);
    setAttempted({});
    setArrivalPlanOpen(false);
    const baseLegal = p.legalStatus.startsWith("Form") ? p.legalStatus.split(" ").slice(0, 2).join(" ") : p.legalStatus;
    setLegalStatus(warn.legalStatusAnswer(nextCarry.legalStatus ?? baseLegal));
    setUrgency(p.urgency);
    setAtsCategory(undefined);
    setSecurity(nextCarry.security ?? (p.security.toLowerCase().includes("secure") ? "Secure" : "Open"));
    setProvisionalDiag(p.provisionalDiag);
    setDoctorNote(p.doctorNote);
    setClinicalSummary(p.clinicalSummary);
    setTransport("");
    setTransitNote(p.transitNote);
    setRiskFlags(p.riskFlags);
    setClearanceChecks({});
    setCommunityNeeds(nextCarry.communityNeeds ?? {});
    setEdNeeds({});
    onSelectPatient?.(key);
    announceToWardShell(`Selected patient ${p.name} for clinical referral.`);
    if (addedInForm) activateSection("patient");
  }
  function toggleRisk(key: string) {
    setRiskFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const { newPatientError, setNewPatientError, pendingNewPatient, newPatientPending, addNewPatient } =
    useReferralPatientRegistration({
      patients,
      generation: worldGeneration,
      dispatch,
      now,
      dayZero,
      role: sendingWard ? "ward" : sourceKind === "ed" ? "ed" : "community",
      registrationScope: patientRegistrationScope(access.scope, sendingWard?.id),
      requiresRegistrationScope: access.scope.kind === "ward",
      allowed: addPatientGate.allowed,
      reason: addPatientGate.reason,
      patient: newPatient,
      onSelect: (id) => handleSelectPatient(`${PATIENT_KEY_PREFIX}${id}`, true),
      intentVersion: registrationDraft.intentVersion,
      getIntentVersion: registrationDraft.getIntentVersion,
    });

  // Live capacity for the patient's cohort (from the record or age band) and chosen bed security.
  const realTimeMatch = (() => {
    const patientCohort = movementCohort ?? ageBand;
    // A ward never refers to itself (Qodo's review), so the sending ward is not offered.
    const matchingRecords = capacityRecords.filter(
      (r) => r.cohort === patientCohort && r.security === security && r.unitId !== sendingWard?.id,
    );
    const readyBedsCount = matchingRecords.reduce((sum, r) => sum + r.readyBeds, 0);
    const pulledBedsCount = matchingRecords.reduce((sum, r) => sum + r.pulledBeds, 0);
    // Owner ruling, 2026-09-05: `readyBedsCount` subtracts NOTHING for this, so a figure never lurches with cleaning.
    const pendingPreparationCount = matchingRecords.reduce((sum, r) => sum + (r.pendingPreparation ?? 0), 0);
    // Audit 1 (decision 6), Josh 20 Oct: a fixed, neutral order (health service, then ward name),
    // never catchment first or most ready beds. Every matching ward stays listed.
    const sortedUnits = [...matchingRecords].sort(
      (a, b) => (a.healthService ?? "~").localeCompare(b.healthService ?? "~") || a.name.localeCompare(b.name),
    );
    return { readyBedsCount, pulledBedsCount, pendingPreparationCount, sortedUnits };
  })();

  /** The chosen wards still offered, so a ward the match no longer lists (the sending ward, or one a
   *  changed need rules out) neither counts toward the cap nor is sent to. */
  const offeredUnitIds = selectedUnitIds.filter((id) => realTimeMatch.sortedUnits.some((unit) => unit.unitId === id));
  const selectedDestinations: ReferralDestination[] =
    destType === "ward"
      ? wardReferralDestinations(offeredUnitIds, {
          sex: referralSex,
          gender: referralGender,
          security,
          legalStatus: sentLegal,
          highAcuity,
        })
      : !selectedRecipient
        ? []
        : destType === "community"
          ? communityDestinations(selectedRecipient, communityPurpose)
          : [{ kind: "emergency_department", edId: selectedRecipient, purpose: "psychiatric_review" }];
  const recipientLabels =
    destType === "ward"
      ? selectedDestinations
          .map((destination) =>
            destination.kind === "psychiatric_ward"
              ? capacityRecords.find((unit) => unit.unitId === destination.unitId)
              : undefined,
          )
          .filter((unit): unit is WardCapacityRecord => !!unit)
          .map((unit) => `${unit.hospital} · ${unit.name}`)
      : selectedRecipient
        ? [singleRecipientLabel(destType === "community", selectedRecipient, communityPurpose)]
        : [];

  // A ward refers its own inpatients (`movementSourceAdmission`); others warn and ask why (Josh, 16 Oct 2026).
  const patientOnSendingWard =
    !!sendingWard && !!patientRecord && patientInBedOnUnit(admissions, patientRecord.id, sendingWard.id);
  const notOnSendingWard = !!sendingWard && !patientOnSendingWard;
  // Only a ward bed is pulled, so only a ward referral meets the one-current-stay rule.
  const heldBedUnitId =
    destType === "ward" && notOnSendingWard && patientRecord
      ? patientHeldBedUnitId(admissions, patientRecord.id)
      : undefined;
  const heldBedWardName = heldBedUnitId
    ? (units.find((unit) => unit.id === heldBedUnitId)?.name ?? "another ward")
    : "";
  const notOnWardNote =
    sendingWard && notOnSendingWard && notOnWardReason
      ? `Not in a bed on ${sendingWard.name}: ${notOnWardReason}.`
      : "";
  const referralReason = notOnWardNote ? `${notOnWardNote} ${doctorNote}` : doctorNote;
  const reasonRoom = REFERRAL_REASON_MAX_CHARACTERS - (notOnWardNote ? notOnWardNote.length + 1 : 0);
  const reasonNoteRequired = notOnWardReason === NOT_ON_SENDING_WARD_OTHER;
  function patientError() {
    if (!patientRecord && unidentified === null)
      return 'Find a registered patient, add a new patient, or choose "Not yet identified".';
    if (!patientRecord && !unidentified?.trim()) return "Describe the unidentified person.";
    if (heldBedUnitId)
      return `This person already has a bed, or a pulled bed, on ${heldBedWardName}, so they cannot be sent as a new admission.`;
    if (sendingWard && notOnSendingWard && !notOnWardReason)
      return `This person is not in a bed on ${sendingWard.name}. Choose why the ward is referring them.`;
    if (!effectiveCohort) return "Choose the age band.";
    if (catchmentNotKnown && destType === "community")
      return "A community team referral needs a team. Choose the community team, or send to a ward or ED.";
    return null;
  }
  // WS-01: a ward referral answers gender before Send ("Not yet recorded" counts as an answer).
  const genderUnanswered = destType === "ward" && referralGender === "";
  const originValid = !!sendingWard || (!senderMissing && isListedOrigin(originSiteCode, sourceKind));
  // FORM-REF: the reason warns (`sendWarnings`); these block. Josh, 5 Nov 2026 (finding 2): the location and referring
  // service come from the sending desk and block only when nothing fills them: an accepted referral needs both to move.
  function referralError() {
    if (senderMissing) return NO_SENDING_WARD;
    if (!originValid)
      return sourceKind === "ed" ? "Choose the referring emergency department." : "Choose the location of referral.";
    if (sendingTeamMissing) return "Record the referring community service.";
    if (legalStatus === "") return warn.LEGAL_STATUS_UNANSWERED;
    if (!URGENCY_LEVELS.some((tier) => String(tier) === shownUrgency))
      return community ? "Choose when the team should first make contact." : "Choose the referral urgency.";
    if (genderUnanswered) return GENDER_UNANSWERED;
    const shortForm = community ? communityReferralError(communityPurpose, documentation) : null;
    if (shortForm) return shortForm;
    if (cleanReferralText(doctorNote).length > reasonRoom)
      return `Shorten the reason for referral to ${reasonRoom} characters or fewer.`;
    // PR #1474 review: an ED arrival time typed but not a real 24-hour time is fixed or cleared first.
    if (destType === "ed" && edArrivalWrong) return `${TIME_FIELD_ERROR}, for the expected arrival, or clear it.`;
    return null;
  }
  const needsSendingTeam = !sendingWard && !senderMissing && sourceKind === "community";
  const sendingTeamMissing = needsSendingTeam && !sendingTeam.trim();
  const needed: Record<DrawerSection, number> = {
    patient: [
      (!patientRecord && !unidentified?.trim()) || (notOnSendingWard && (!!heldBedUnitId || !notOnWardReason)),
      !effectiveCohort,
      catchmentNotKnown && destType === "community",
    ].filter(Boolean).length,
    referral:
      [
        !originValid,
        sendingTeamMissing,
        legalStatus === "",
        !URGENCY_LEVELS.some((tier) => String(tier) === shownUrgency),
        community && !communityPurpose,
        doctorNote.length > reasonRoom,
        genderUnanswered,
        destType === "ed" && edArrivalWrong,
      ].filter(Boolean).length + (community ? clearanceNeeded(documentation) : 0),
    documentation: community ? 0 : documentationNeeded(documentation),
    placement: (community ? selectedRecipient : selectedDestinations.length) ? 0 : 1,
  };
  const totalNeeded = needed.patient + needed.referral + needed.documentation + needed.placement;
  // L1 (review 12 Oct 2026): ONE count. "N of M ready", "Items left" and each step's "N needed" add up.
  // FORM-REF (5 Nov 2026): only blocking items count; contact and the rest warn (`sendWarnings`).
  const itemsTotal =
    4 +
    (sendingWard ? 0 : 1) +
    (needsSendingTeam ? 1 : 0) +
    (destType === "ward" ? 1 : 0) +
    (community ? 2 : documentationItems(documentation)) +
    1;
  // D-77: the community short form has no Documents step, so its checks skip triage and charts.
  const docsError = () => (community ? null : documentationError(documentation));
  // The history carries the unidentified label then the story; both must fit its limit or the reducer refuses.
  function storyError() {
    const label = unidentified?.trim();
    const prefix = !patientRecord && label ? UNIDENTIFIED_REFERRAL_PREFIX.length + label.length + 1 : 0;
    const room = REFERRAL_HISTORY_LIMITS.history - prefix;
    return cleanReferralText(clinicalSummary).length > room
      ? `Shorten the patient story to ${room} characters or fewer.`
      : null;
  }
  function sectionFor(error: string | null): DrawerSection | null {
    if (!error) return null;
    if (patientError() === error) return "patient";
    if (referralError() === error || storyError() === error) return "referral";
    if (docsError() === error) return "documentation";
    return "placement";
  }
  const { activateSection, selectSection, phCloseSheet, phOpenStep } = useReferralSectionNavigation({
    sectionId,
    bodyRef,
    isPhone,
    setActiveSection,
    setPreviewOpen,
    setConfirmationOpen,
    setIsSearchOpen,
    setPhoneStepOpen,
    setFlowError,
    sendPending,
    sentReferralId,
  });
  function goNext(section: "patient" | "referral" | "documentation") {
    const error =
      patientError() ??
      (section !== "patient" ? (referralError() ?? storyError()) : null) ??
      (section === "documentation" ? docsError() : null);
    setFlowError(error);
    if (error) {
      const failed = sectionFor(error);
      if (failed) {
        setAttempted((current) => ({ ...current, [failed]: true }));
        activateSection(failed, true);
      }
      return;
    }
    activateSection(sectionIds[sectionIds.indexOf(section) + 1] ?? "placement");
  }
  function goBack() {
    setFlowError(null);
    activateSection(sectionIds[sectionIds.indexOf(activeSection) - 1] ?? "patient");
  }
  function handleDispatch() {
    const error =
      patientError() ??
      referralError() ??
      storyError() ??
      docsError() ??
      (selectedDestinations.length ? null : missingDestinationError(destType === "community" && !!selectedRecipient));
    setFlowError(error);
    if (error) {
      const failed = sectionFor(error);
      if (failed) {
        setAttempted((current) => ({ ...current, [failed]: true }));
        activateSection(failed, true);
      }
      return;
    }
    setConfirmationOpen(true);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    requestAnimationFrame(() => confirmationHeadingRef.current?.focus());
  }
  function confirmAndSend(event: React.FormEvent) {
    event.preventDefault();
    if (sendPending || submissionRef.current || sentReferralId || !sendGate.allowed) return;
    const validation =
      patientError() ??
      referralError() ??
      storyError() ??
      docsError() ??
      referralContactLimitError(cleanReferralContact(contact));
    if (validation) {
      setFlowError(validation);
      setAttempted((current) => ({ ...current, contact: true }));
      focusFirstInvalidField(confirmationHeadingRef);
      return;
    }
    const needs = needsFor(destType, communityNeeds, edNeeds);
    const intake: ReferralIntakeDetails = cleanReferralFields({
      catchment: catchmentNotKnown
        ? { teamName: "", confirmed: true, notKnown: true }
        : { teamName: catchmentTeam.trim(), service: catchmentService || undefined, confirmed: catchmentAnswered },
      reasonForReferral: referralReason,
      legalStatus: sentLegal,
      riskFlags: REFERRAL_RISK_FLAGS.filter((flag) => riskFlags[flag]),
      medicalClearance: {
        cleared: isMedicalCleared,
        ...(isMedicalCleared
          ? {}
          : {
              ...(documentation.expectedAt ? { expectedAt: `${documentation.expectedAt}+08:00` } : {}),
              ...(documentation.contactName.trim() ? { contactName: documentation.contactName } : {}),
              ...(documentation.contactPhone.trim() ? { contactPhone: documentation.contactPhone } : {}),
            }),
      },
      triageAndRampCompleted: !community && documentation.triage === "yes",
      ...intakeCharts(documentation, community),
      additionalDocuments: !community && documentation.additional === "yes",
      referrer: contact,
      ...(destType === "ward"
        ? {
            arrival: { transport, reference: transitNote, estimatedAt: arrivalEta ? `${arrivalEta}+08:00` : undefined },
            ...(Object.keys(clearanceChecks).length ? { clearanceChecklist: clearanceChecks } : {}),
          }
        : {}),
      ...(needs && referralNeedsWords(needs).length ? { needs } : {}),
    });
    const intakeError = referralIntakeError(intake);
    if (intakeError) {
      setFlowError(intakeError);
      return;
    }
    const cohort = effectiveCohort || undefined;
    const tier = URGENCY_LEVELS.find((level) => String(level) === shownUrgency);
    if (!cohort || !tier || !selectedDestinations.length) {
      setFlowError("Check the patient, urgency and selected recipients.");
      return;
    }
    setFlowError(null);
    submitReferral({
      type: "RECEIVE_REFERRAL",
      role: sendingWard ? "ward" : sourceKind === "ed" ? "ed" : "community",
      now,
      patientId: patientRecord?.id,
      ageBand: cohort,
      homeRegion: homeRegion || undefined,
      suburb: suburbKnown ? { kind: "named", name: catchmentSuburb } : { kind: "unknown", reason: "not_known" },
      destinations: selectedDestinations,
      source: sendingWard ? "psychiatric_ward" : sourceKind === "ed" ? "ed_medical" : "community",
      originSiteCode: sendingWard?.siteCode ?? (originValid ? originSiteCode : undefined),
      ...(sendingWard ? { originUnitId: sendingWard.id, actingUnitId: sendingWard.id } : {}),
      sendingTeamName: needsSendingTeam && sendingTeam.trim() ? cleanReferralText(sendingTeam) : undefined,
      urgency: tier,
      ...(atsCategory === undefined ? {} : { atsCategory }),
      transportNeeded: destType === "ward" && transport !== "carer" && transport !== "Family or carer",
      history: cleanReferralText(unidentifiedHistory),
      tentativeDiagnosis: isTentativeDiagnosisBlock(provisionalDiag) ? provisionalDiag : undefined,
      ...alternatives.eventField,
      intake,
    });
  }
  // Recipient inboxes, read from the provider the ward screen already uses.
  const { inboxWards, inboxCount, inboxWard } = referralInboxSummary(capacityRecords, wardReferralInbox, inboxUnitId);

  const tier = URGENCY_LEVELS.find((level) => String(level) === shownUrgency);
  const tierLabel = tier === undefined ? "Not recorded" : urgencyTierLabel(tier);
  const recordedFlags = (Object.keys(RISK_FLAG_LABELS) as (keyof typeof RISK_FLAG_LABELS)[]).filter(
    (key) => riskFlags[key],
  );
  const clearance = warn.clearanceLabel(documentation.medical);
  // FORM-REF: the referrer's contact warns, never blocks, so each blank field is named as it is.
  const contactErrors = contactFieldErrors(contact);
  const contactNeeded = Object.keys(contactErrors).length;
  const sendWarnings = warn.referralSendWarnings({
    catchmentAnswered,
    homeRegion,
    reasonMissing: reasonNoteRequired && !doctorNote.trim(),
    documentation,
    contact,
  });
  const itemsLeft = totalNeeded;
  const itemsReady = itemsTotal - itemsLeft;
  const patientShowErrors = attempted.patient && activeSection === "patient";
  // No "Unknown Patient" referral: with no person on file, the referrer describes who it is for.
  const unidentifiedName =
    !patientRecord && unidentified?.trim() ? `${UNIDENTIFIED_REFERRAL_PREFIX}${unidentified.trim()}` : "";
  const unidentifiedHistory = unidentifiedName
    ? `${unidentifiedName}${clinicalSummary ? `\n${clinicalSummary}` : ""}`
    : clinicalSummary;
  // The sender's own submission, read back from the created referral.
  const sentDetails = sentReferralId ? referrals.find((referral) => referral.id === sentReferralId)?.intake : undefined;

  const destination = DESTINATIONS[destType];
  // A blank or unlisted suburb is sent as "Suburb not known" (no fixed address); the catchment card says which.
  const suburbKnown =
    !!catchmentSuburb &&
    suburbOptions().some((suburb) => suburb.toLowerCase() === catchmentSuburb.trim().toLowerCase());
  const originLabel = sendingWard
    ? sendingWard.name
    : originValid
      ? sourceKind === "ed"
        ? (siteDirectory.find((site) => site.code === originSiteCode)?.emergencyDepartment?.name ?? originSiteCode)
        : (siteByCode(originSiteCode)?.name ?? originSiteCode)
      : "";
  /** The board calls a referral overdue after this tier window, a service default (`OPERATIONAL_DEFAULT_LABEL`). */
  function decisionDueAt(from: Instant): string | undefined {
    return tier === undefined ? undefined : formatInstantWithDay(from + OVERDUE_AFTER_MINUTES_BY_TIER[tier], now);
  }
  // 28 day readmission: this person's most recent discharge in the 28 days before now, if any.
  const readmissionIndex = useMemo(
    () => createReadmissionIndex({ admissions, patients, referrals, movements, units }),
    [admissions, patients, referrals, movements, units],
  );
  const readmissionFlag = patientRecord ? priorDischargeWithinWindow(patientRecord, now, readmissionIndex) : null;
  const placeRow =
    selectedDestinations.length === 0
      ? "Choose"
      : recipientLabels.length === 1
        ? recipientLabels[0]!.split(" · ").at(-1)!
        : `${recipientLabels.length} chosen`;
  // Shown only once a ward referral has answered any clearance item.
  const checksDone =
    destType === "ward" && Object.keys(clearanceChecks).length
      ? CLEARANCE_CHECKS.filter((check) => clearanceChecks[check] === "done").length
      : undefined;
  const docsLeft = community ? clearanceNeeded(documentation) : needed.documentation;
  const tierState = tier === undefined ? "needed" : "done";
  const readyRows: { label: string; value: string; state: "done" | "follow" | "needed" }[] = [
    { label: "Refer to", value: destination.label, state: "done" },
    {
      label: "Patient",
      value: patientRecord ? currentPatient.name : unidentifiedName || "Needed",
      state: patientRecord || unidentifiedName ? "done" : "needed",
    },
    {
      label: "Catchment",
      value: catchmentNotKnown
        ? "Catchment not known"
        : catchmentConfirmed
          ? catchmentTeam
          : catchmentTeam.trim()
            ? `${catchmentTeam.trim()}, suggested`
            : "To confirm",
      state: catchmentAnswered ? "done" : "follow",
    },
    { label: "From", value: originLabel || "Needed", state: originValid ? "done" : "needed" },
    ...(community ? [communityPurposeRow(communityPurpose)] : []),
    {
      label: "Legal status",
      value: legalStatus === "" ? "Needed" : sentLegal,
      state: legalStatus === "" ? "needed" : sentLegal === NOT_RECORDED ? "follow" : "done",
    },
    ...(community
      ? []
      : [{ label: "Urgency", value: tier === undefined ? "Needed" : `Tier ${tier}`, state: tierState } as const]),
    {
      label: community ? "Clearance" : destination.check,
      value: docsLeft
        ? `${docsLeft} to answer`
        : checksDone !== undefined
          ? `${checksDone} of ${CLEARANCE_CHECKS.length} done`
          : documentation.medical === "no"
            ? "Clearance to follow"
            : "Answered",
      state: docsLeft ? "needed" : documentation.medical === "no" ? "follow" : "done",
    },
    {
      label: "Your contact",
      value: contactNeeded ? `${contactNeeded} not recorded` : contact.name,
      state: contactNeeded ? "follow" : "done",
    },
    { label: destination.places, value: placeRow, state: selectedDestinations.length ? "done" : "needed" },
  ];
  const draftNeeds = needsFor(destType, communityNeeds, edNeeds);
  const letterCharts = intakeCharts(documentation, community);
  const letterInput: ReferralTextInput = {
    destinationPhrase: destination.phrase,
    patientName: patientRecord ? currentPatient.name : unidentifiedName,
    umrn: patientRecord ? currentPatient.umrn : "",
    ageSex: patientRecord ? ageSexLabel(currentPatient) : "",
    suburb: catchmentSuburb,
    catchment: catchmentNotKnown
      ? "Catchment not known"
      : catchmentConfirmed && catchmentTeam.trim()
        ? catchmentTeam.trim()
        : undefined,
    from: originLabel,
    recipients: recipientLabels,
    urgency: tier === undefined ? "" : tierLabel,
    legalStatus: sentLegal,
    reason: referralReason,
    history: unidentifiedHistory,
    risks: recordedFlags.map((key) => RISK_FLAG_LABELS[key]),
    clearance: clearance.label,
    clearanceChecklist: destType === "ward" ? clearanceChecklistWords(clearanceChecks) : "",
    needs: draftNeeds ? referralNeedsWords(draftNeeds) : [],
    chartKinds: letterCharts.charts.map(({ kind }) => kind),
    chartsToFollow: letterCharts.chartsToFollow,
    referrer: { name: contact.name, role: contact.role, phone: contact.phone },
  };
  async function copyText(text: string, done: string) {
    try {
      await copyTextToClipboard(text);
      setCopyNotice(done);
    } catch {
      setCopyNotice("Copy unavailable in this browser");
    }
  }
  function chooseDestination(kind: DrawerCategory) {
    if (kind === destType || sendPending || sentReferralId) return;
    setDestType(kind);
    if (kind === "community" && activeSection === "documentation") setActiveSection("referral");
    setSelectedUnitIds([]);
    setSelectedRecipient("");
    setCommunityPurpose("");
    // Community hides "Catchment not known", so an earlier tick must not stay behind it unclearable.
    if (kind === "community") setCatchmentNotKnown(false);
    setConfirmationOpen(false);
    setFlowError(null);
    announceToWardShell(`Referring to ${DESTINATIONS[kind].phrase}.`);
  }

  const footStatus = drawerFootStatus({
    view,
    inboxWard,
    inboxWardCount: inboxWards.length,
    sentReferralId,
    sentAt,
    now,
    recipientLabels,
    submissionAwaitingRecord,
    flowError,
    confirmationOpen,
    contactNeeded,
    itemsLeft,
    itemsTotal,
    warningCount: sendWarnings.length,
  });

  // v10 phone: which of the four phone layouts shows. The list holds the steps; the sheet holds one
  // step (or the letter, or the contact check before Send). Desktop never reads this.
  const phMode: "list" | "sheet" | "sent" | "inbox" =
    view === "inbox"
      ? "inbox"
      : sentReferralId
        ? "sent"
        : phoneStepOpen || confirmationOpen || previewOpen
          ? "sheet"
          : "list";
  const phFirstNeeded = sectionIds.find((id) => needed[id] > 0);
  const phNeededLabels = readyRows.filter((row) => row.state === "needed").map((row) => row.label);
  const phNeedsLine = phNeededLabels.length
    ? `Needs ${phNeededLabels.slice(0, 3).join(", ")}${phNeededLabels.length > 3 ? ` and ${phNeededLabels.length - 3} more` : ""}`
    : "Every row the letter needs is ready";
  function phStepHint(id: DrawerSection): string {
    if (id === "patient") {
      return patientRecord
        ? `${currentPatient.name} · ${catchmentNotKnown ? "catchment not known" : catchmentConfirmed && catchmentTeam.trim() ? catchmentTeam : "catchment to confirm"}`
        : "Find a patient by name or UMRN";
    }
    if (id === "referral") {
      return originValid
        ? [originLabel, sentLegal, tier === undefined ? "urgency" : `Tier ${tier}`].join(" · ")
        : "Source · legal status · urgency";
    }
    if (id === "documentation") {
      return needed.documentation
        ? `${needed.documentation} to answer`
        : checksDone !== undefined
          ? `${checksDone} of ${CLEARANCE_CHECKS.length} done`
          : "Answered";
    }
    if (selectedDestinations.length) {
      return recipientLabels.length > 1
        ? `${recipientLabels[0]!.split(" · ").at(-1)} and ${recipientLabels.length - 1} more`
        : placeRow;
    }
    return destType === "ward" ? "Choose up to 3 wards" : destType === "community" ? "Choose a team" : "Choose an ED";
  }
  const phStepIndex = sectionIds.indexOf(activeSection);

  return {
    onClose: requestClose,
    onSelectPatient,
    withBackdrop,
    initialCategory,
    initialDestination,
    initialPatientId,
    initialOriginSiteCode,
    initialSendingTeam,
    initialUnitIds,
    closeRequestRef,
    view,
    onViewChange,
    onRestart,
    searchId,
    searchInputRef,
    touchStartY,
    capacityRecords,
    myProfile,
    gate,
    sendGate,
    carry,
    alternatives,
    sendingWard,
    senderMissing,
    notOnSendingWard,
    notOnWardReason,
    setNotOnWardReason,
    heldBedWardName,
    reasonRoom,
    reasonNoteRequired,
    addPatientGate,
    movements,
    patients,
    referrals,
    rejections,
    configuration,
    dayZero,
    dispatch,
    wardReferralInbox,
    admissions,
    units,
    now,
    urlPrefill,
    effectiveInitialPatientId,
    effectiveInitialOriginSiteCode,
    prefillKey,
    storedDraft,
    kept,
    keepsAnotherPersonsDraft,
    fromEntryPoint,
    openJourney,
    initialPatientKey,
    activePatientKey,
    setActivePatientKey,
    extraPatientKeys,
    setExtraPatientKeys,
    searchQuery,
    setSearchQuery,
    isSearchOpen,
    setIsSearchOpen,
    noPatientChosen,
    patientAddedInForm: addedInFormKey !== null && addedInFormKey === activePatientKey,
    bodyRef,
    sectionId,
    selectedUnitIds: offeredUnitIds,
    setSelectedUnitIds,
    selectedRecipient,
    setSelectedRecipient,
    communityPurpose,
    setCommunityPurpose,
    ageBand,
    setAgeBand,
    ageBandNote,
    previewOpen,
    setPreviewOpen,
    summaryOpen,
    setSummaryOpen,
    guardOpen,
    setGuardOpen,
    copyNotice,
    setCopyNotice,
    newPatientOpen,
    setNewPatientOpen,
    resetNewPatient,
    newPatient,
    newPatientDirty,
    newPatientDateText,
    setNewPatientDateText,
    setNewPatient,
    newPatientError,
    setNewPatientError,
    pendingNewPatient,
    newPatientPending,
    guardKeepRef,
    confirmationOpen,
    setConfirmationOpen,
    sendPending,
    submissionAwaitingRecord,
    setSendPending,
    sentReferralId,
    setSentReferralId,
    sentAt,
    setSentAt,
    flowError,
    setFlowError,
    attempted,
    setAttempted,
    submissionRef,
    confirmationHeadingRef,
    inboxUnitId,
    setInboxUnitId,
    isPhone,
    phoneStepOpen,
    setPhoneStepOpen,
    sampleProfiles,
    defaultPatient,
    arrivalPlanOpen,
    setArrivalPlanOpen,
    liveMovement,
    patientRecord,
    movementCohort,
    effectiveCohort,
    arrivalRole,
    documentation,
    setDocumentation,
    isMedicalCleared,
    contact,
    setContact,
    initialLookup,
    initialTeams,
    catchmentSuburb,
    setCatchmentSuburb,
    catchmentTeam,
    setCatchmentTeam,
    catchmentService,
    setCatchmentService,
    catchmentConfirmed,
    setCatchmentConfirmed,
    catchmentNotKnown,
    setCatchmentNotKnown,
    catchmentEditing,
    setCatchmentEditing,
    homeRegion,
    setHomeRegion,
    activeSection,
    setActiveSection,
    unidentified,
    setUnidentified,
    liveOriginSite,
    sourceKind,
    setSourceKind,
    deskOriginSite,
    originSiteCode,
    setOriginSiteCode,
    sendingTeam,
    setSendingTeam,
    referralSex,
    setReferralSex,
    referralGender,
    setReferralGender,
    highAcuity,
    setHighAcuity,
    arrivalEta,
    setArrivalEta,
    destType,
    setDestType,
    legalStatus,
    setLegalStatus,
    urgency,
    setUrgency,
    atsCategory,
    setAtsCategory,
    security,
    setSecurity,
    provisionalDiag,
    setProvisionalDiag,
    doctorNote,
    setDoctorNote,
    clinicalSummary,
    setClinicalSummary,
    transport,
    setTransport,
    transitNote,
    setTransitNote,
    riskFlags,
    setRiskFlags,
    clearanceChecks,
    setClearanceChecks,
    communityNeeds,
    setCommunityNeeds,
    edNeeds,
    setEdNeeds,
    edArrivalWrong,
    setEdArrivalWrong,
    draftNow,
    draftRestored: draftRestored && kept !== null,
    draftSessionSaved,
    needsChartReattachment: draftNow.needsChartReattachment,
    clearRecoveredDraft: () => {
      stopDraftAutosave();
      restartReferralDraft(draftDiscardOwner, draftStorageKey);
      onRestart();
    },
    openingDraft,
    draftJson,
    handleTouchStart,
    handleTouchEnd,
    drawerRef,
    dirty,
    initialKept,
    draftKeptAt,
    draftNowMs,
    stopDraftAutosave,
    requestClose,
    guardBoxRef,
    guardRootRef,
    discardAndClose,
    keepAndClose,
    handleDrawerClose,
    rawCurrentPatient,
    currentPatient,
    handleSelectPatient,
    toggleRisk,
    filteredPatients,
    addNewPatient,
    realTimeMatch,
    selectedDestinations,
    recipientLabels,
    patientError,
    referralError,
    originValid,
    needed,
    totalNeeded,
    itemsTotal,
    storyError,
    sectionFor,
    goNext,
    goBack,
    handleDispatch,
    confirmAndSend,
    inboxWards,
    inboxCount,
    inboxWard,
    tier,
    tierLabel,
    recordedFlags,
    clearance,
    contactErrors,
    contactNeeded,
    sendWarnings,
    itemsLeft,
    itemsReady,
    patientShowErrors,
    unidentifiedName,
    unidentifiedHistory,
    sentDetails,
    destination,
    suburbKnown,
    originLabel,
    decisionDueAt,
    readmissionIndex,
    readmissionFlag,
    placeRow,
    checksDone,
    readyRows,
    draftNeeds,
    letterInput,
    copyText,
    chooseDestination,
    selectSection,
    footStatus,
    phMode,
    phFirstNeeded,
    phNeededLabels,
    phNeedsLine,
    phStepHint,
    phCloseSheet,
    phOpenStep,
    phStepIndex,
    sectionIds,
  } as const;
}

/** Everything the referral slide-out's sections read, from one call per render. */
export type WardReferralDrawerState = ReturnType<typeof useWardReferralDrawerState>;
