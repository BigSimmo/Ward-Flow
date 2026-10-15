import { useState, useId, useEffect, useMemo, useRef, useCallback } from "react";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  ATS_CATEGORIES,
  URGENCY_LEVELS,
  HEALTH_SERVICES,
  RECORDED_SEXES,
  type AtsCategory,
  type HomeRegion,
  type RecordedSex,
  type ReferralGender,
  type ReferralDestination,
  type Cohort,
  type HealthService,
  REFERRAL_HISTORY_LIMITS,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { OVERDUE_AFTER_MINUTES_BY_TIER } from "@/components/ward-management/ward-operational-defaults";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { type Gender } from "@/components/ward-management/ward-patients";
import { edById, siteByCode, siteDirectory } from "@/components/ward-management/ward-sites";
import { catchmentRoutingDestinations, lookupCatchment } from "../ward-catchment";
import { suburbOptions } from "./referral-destination-options";
import { isTentativeDiagnosisBlock } from "../ward-diagnosis";
import { documentationError, EMPTY_DOCUMENTATION, type DocumentationDraft } from "./referral-flow-panels";
import { UNIDENTIFIED_REFERRAL_PREFIX } from "./referral-inbox";
import {
  discardReferralDraft,
  keepReferralDraft,
  readKeptReferralDraft,
  readKeptReferralDraftAt,
  readLastReferrerContact,
  rememberReferrerContact,
  useReferralDraftAutosave,
} from "./referral-draft-store";
import { type ReferralTextInput } from "./referral-letter";
import { useIsPhone, useModalFocus, type WfTone } from "@/components/wf";
import { usePathname } from "next/navigation";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { profileForChromeRole } from "@/components/ward-management/settings/settings-profile";
import { createReadmissionIndex, priorDischargeWithinWindow } from "@/components/ward-management/ward-readmission";
import {
  CLEARANCE_CHECKS,
  REFERRAL_RISK_FLAGS,
  referralContactError,
  referralIntakeError,
  type ClearanceChecklist,
  type ReferralContact,
  type ReferralIntakeDetails,
  clearanceChecklistWords,
  referralNeedsWords,
} from "./referral-submission";
import { recordIdFromParam } from "@/components/ward-management/shell/ward-record-address";
import {
  type MockPatientProfile,
  NOT_RECORDED,
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
  SECTION_IDS,
  RISK_FLAG_LABELS,
  documentationNeeded,
  documentationItems,
  CONTACT_FIELD_COUNT,
  contactFieldErrors,
  recipientSummary,
  type KeptDraft,
  type CommunityNeeds,
  type EdNeeds,
  needsFor,
  patientKeyFor,
  isOwnLeaveGuardAnchor,
  type WardReferralDrawerContentProps,
} from "./ward-referral-drawer-model";

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
  // No sign-in: the route gives the role, and the role gives the profile (or why there is none).
  const myProfile = profileForChromeRole(wardChromeRole(usePathname() ?? ""));
  // Feature 11: the sheet dispatches as the referral's source; routes whose role `EVENT_ROLE` omits
  // keep it through the listed cross-role pairs in `ward-role-permissions.ts`.
  const gate = useRoleGate();
  const sendGate = gate("RECEIVE_REFERRAL");
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
  const now = useWardFlowClock();

  const urlPrefill = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const personId = recordIdFromParam(params.get("patientId")?.trim()) ?? undefined;
    if (initialPatientId && personId && initialPatientId !== personId) return null;
    if (!personId && (initialPatientId || initialOriginSiteCode || initialSendingTeam || initialUnitIds?.length)) {
      return null;
    }
    const site = params.get("site")?.trim() || undefined;
    const service = params.get("service")?.trim() || undefined;
    const atsRaw = Number(params.get("ats"));
    const ats = ATS_CATEGORIES.find((value) => value === atsRaw);
    const legal = params.get("legal")?.trim() || undefined;
    const complaint = params.get("complaint")?.trim() || undefined;
    const source = params.get("source")?.trim() === "ed" ? ("ed" as const) : undefined;
    if (!personId && !site && !service && !ats && !legal && !complaint) return null;
    return { personId, site, service, ats, legal, complaint, source };
  }, [initialOriginSiteCode, initialPatientId, initialSendingTeam, initialUnitIds]);
  const effectiveInitialPatientId = initialPatientId ?? urlPrefill?.personId;
  const effectiveInitialOriginSiteCode = initialOriginSiteCode ?? urlPrefill?.site;

  const [prefillKey] = useState(() =>
    effectiveInitialPatientId ? patientKeyFor(effectiveInitialPatientId, { movements, patients, referrals }) : null,
  );
  // A Refer link names its person: it reopens a kept draft only when that draft is for the same
  // person, and never someone else's.
  const [storedDraft] = useState(() => readKeptReferralDraft<KeptDraft>());
  const kept =
    !effectiveInitialPatientId ||
    (storedDraft !== null &&
      ((prefillKey !== null && storedDraft.activePatientKey === prefillKey) ||
        storedDraft.activePatientKey === `${PATIENT_KEY_PREFIX}${effectiveInitialPatientId}`))
      ? storedDraft
      : null;
  // Another person's kept draft stays as it was: this sheet does not autosave over it.
  const keepsAnotherPersonsDraft = storedDraft !== null && kept === null;
  // Option B (Josh, 13 Oct 2026): opened from a place that names the person (ED, a community team,
  // Home), the record answers step 1 where it can, so the sheet opens on Referral with step 1 done.
  const fromEntryPoint = kept === null && prefillKey !== null;
  // A2-3 (audit 13 Oct 2026): opened plainly, with no named person, the sheet starts on nobody,
  // never a demo person from another site.
  const initialPatientKey = kept?.activePatientKey ?? prefillKey ?? NO_PATIENT_KEY;

  const [activePatientKey, setActivePatientKey] = useState<string>(initialPatientKey);
  const [extraPatientKeys, setExtraPatientKeys] = useState<string[]>(
    initialPatientKey in SAMPLE_PATIENTS ? [] : [initialPatientKey],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const noPatientChosen = activePatientKey === NO_PATIENT_KEY;
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionId = useId();
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>(
    kept?.selectedUnitIds ?? [...(initialUnitIds ?? [])],
  );
  const [selectedRecipient, setSelectedRecipient] = useState(kept?.selectedRecipient ?? "");
  const [ageBand, setAgeBand] = useState<Cohort | "">(kept?.ageBand ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [guardOpen, setGuardOpen] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [newPatient, setNewPatient] = useState({
    familyName: "",
    givenName: "",
    dateOfBirth: "",
    umrn: "",
    gender: "" as Gender | "",
    suburb: "",
  });
  const [newPatientError, setNewPatientError] = useState<string | null>(null);
  const pendingNewPatient = useRef<number | null>(null);
  const guardKeepRef = useRef<HTMLButtonElement>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const [sentReferralId, setSentReferralId] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<Instant | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState<Partial<Record<DrawerSection | "contact", boolean>>>({});
  const submissionRef = useRef<{ intake: ReferralIntakeDetails; rejectionCount: number } | null>(null);
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
          sampleProfile(key, { movements, patients, referrals, dayZero }, now),
        ]),
      ) as Record<string, MockPatientProfile>,
    [movements, patients, referrals, dayZero, now, extraPatientKeys, activePatientKey],
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
  const [documentation, setDocumentation] = useState<DocumentationDraft>(kept?.documentation ?? EMPTY_DOCUMENTATION);
  const isMedicalCleared = documentation.medical === "yes";
  // A2-6: the details last sent in this tab fill in, so the referrer types them once. Failing that,
  // opened from an entry point, the referrer's own details come from their profile when one is set.
  const [contact, setContact] = useState<ReferralContact>(() => {
    if (kept?.contact) return kept.contact;
    const lastSent = readLastReferrerContact<ReferralContact>();
    if (lastSent) return lastSent;
    if (
      (effectiveInitialPatientId || effectiveInitialOriginSiteCode || initialSendingTeam) &&
      myProfile.status === "available"
    ) {
      const { name, role, phone, email, location } = myProfile.profile;
      return { name, role, phone, email, location };
    }
    return { name: "", email: "", phone: "", role: "", location: "" };
  });
  const initialLookup = lookupCatchment(defaultPatient.suburb);
  const initialTeams = catchmentRoutingDestinations(initialLookup);
  const [catchmentSuburb, setCatchmentSuburb] = useState(kept?.catchmentSuburb ?? defaultPatient.suburb);
  const [catchmentTeam, setCatchmentTeam] = useState(
    kept?.catchmentTeam ?? (initialTeams?.length === 1 ? initialTeams[0] : defaultPatient.catchment),
  );
  const [catchmentService, setCatchmentService] = useState<HealthService | "">(
    kept?.catchmentService ?? HEALTH_SERVICES.find((service) => service === urlPrefill?.service) ?? "",
  );
  // From an entry point, a catchment the suburb lookup or the record names counts as confirmed;
  // Change on the catchment card reopens it.
  const [catchmentConfirmed, setCatchmentConfirmed] = useState(
    kept?.catchmentConfirmed ??
      (fromEntryPoint && !!(initialTeams?.length === 1 ? initialTeams[0] : defaultPatient.catchment)?.trim()),
  );
  const [catchmentEditing, setCatchmentEditing] = useState(false);
  const [homeRegion, setHomeRegion] = useState<HomeRegion | "">(kept?.homeRegion ?? liveMovement?.homeRegion ?? "");
  const [activeSection, setActiveSection] = useState<DrawerSection>(
    kept?.activeSection ?? (catchmentConfirmed && !!homeRegion && !!liveMovement?.cohort ? "referral" : "patient"),
  );
  const [unidentified, setUnidentified] = useState<string | null>(kept?.unidentified ?? null);
  // What a menu or link asks for wins over a kept draft; the draft fills in everything else.
  // L6 (review 12 Oct 2026): a person already in an ED is referred from that ED by default.
  const liveOriginSite = liveMovement ? edById(liveMovement.originEdId)?.siteCode : undefined;
  const [sourceKind, setSourceKind] = useState<"community" | "ed">(
    (initialSendingTeam ? "community" : undefined) ??
      (urlPrefill?.source === "ed" && effectiveInitialOriginSiteCode ? "ed" : undefined) ??
      (effectiveInitialOriginSiteCode && initialCategory !== "ward" && initialCategory !== "community"
        ? "ed"
        : kept?.sourceKind) ??
      (liveOriginSite || initialCategory === "ed" ? "ed" : "community"),
  );
  const [originSiteCode, setOriginSiteCode] = useState(
    effectiveInitialOriginSiteCode ?? kept?.originSiteCode ?? liveOriginSite ?? "",
  );
  const [sendingTeam, setSendingTeam] = useState(initialSendingTeam ?? kept?.sendingTeam ?? "");
  const [referralSex, setReferralSex] = useState<RecordedSex>(
    kept?.referralSex ?? RECORDED_SEXES.find((sex) => sex === patientRecord?.sex) ?? "Not recorded",
  );
  const [referralGender, setReferralGender] = useState<ReferralGender | "">(
    kept?.referralGender ?? patientRecord?.gender ?? "",
  );
  const [highAcuity, setHighAcuity] = useState(kept?.highAcuity ?? false);
  const [arrivalEta, setArrivalEta] = useState(kept?.arrivalEta ?? "");
  const [destType, setDestType] = useState<DrawerCategory>(initialDestination ?? kept?.destType ?? "ward");
  // Form field state - fully synced and editable
  const [legalStatus, setLegalStatus] = useState(
    kept?.legalStatus ??
      urlPrefill?.legal ??
      (defaultPatient.legalStatus.startsWith("Form")
        ? defaultPatient.legalStatus.split(" ").slice(0, 2).join(" ")
        : destType === "community" && defaultPatient.legalStatus === NOT_RECORDED
          ? "Voluntary"
          : defaultPatient.legalStatus),
  );
  const [urgency, setUrgency] = useState(
    kept?.urgency ??
      (urlPrefill?.ats ? (urlPrefill.ats <= 2 ? "1" : urlPrefill.ats === 3 ? "2" : "3") : defaultPatient.urgency),
  );
  const [atsCategory, setAtsCategory] = useState<AtsCategory | undefined>(kept?.atsCategory ?? urlPrefill?.ats);
  const [security, setSecurity] = useState(
    kept?.security ?? (defaultPatient.security.toLowerCase().includes("secure") ? "Secure" : "Open"),
  );
  const [provisionalDiag, setProvisionalDiag] = useState(
    kept?.provisionalDiag ??
      (urlPrefill?.complaint && isTentativeDiagnosisBlock(urlPrefill.complaint)
        ? urlPrefill.complaint
        : defaultPatient.provisionalDiag),
  );
  const [doctorNote, setDoctorNote] = useState(kept?.doctorNote ?? defaultPatient.doctorNote);
  const [clinicalSummary, setClinicalSummary] = useState(kept?.clinicalSummary ?? defaultPatient.clinicalSummary);
  const [transport, setTransport] = useState(kept?.transport ?? defaultPatient.transportVal);
  const [transitNote, setTransitNote] = useState(kept?.transitNote ?? defaultPatient.transitNote);
  const [riskFlags, setRiskFlags] = useState<Record<string, boolean>>(kept?.riskFlags ?? defaultPatient.riskFlags);
  const [clearanceChecks, setClearanceChecks] = useState<ClearanceChecklist>(kept?.clearanceChecks ?? {});
  const [communityNeeds, setCommunityNeeds] = useState<CommunityNeeds>(kept?.communityNeeds ?? {});
  const [edNeeds, setEdNeeds] = useState<EdNeeds>(kept?.edNeeds ?? {});

  const draftNow: KeptDraft = {
    activePatientKey,
    destType,
    activeSection,
    ageBand,
    selectedUnitIds,
    selectedRecipient,
    documentation,
    contact,
    catchmentSuburb,
    catchmentTeam,
    catchmentService,
    catchmentConfirmed,
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
  };
  // What the draft looked like on opening. A restored draft is never clean, so closing it asks again.
  const [openingDraft] = useState(() => (kept ? "" : JSON.stringify(draftNow)));
  const draftJson = JSON.stringify(draftNow);

  // The enclosing Sheet or standalone useWardModalFocus owns the shared scroll lock.
  // A second per-drawer save/restore raced with stacked sheets and could leave body locked.

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

  // Asks before an unsent draft is lost: Keep editing, Keep draft or Discard.
  const dirty = !sentReferralId && draftJson !== openingDraft;
  // Autosave to the same tab-memory store as Keep draft, so no close path loses typed work (D-18:
  // memory only, never browser storage).
  const [initialKept] = useState(() => (kept ? { at: readKeptReferralDraftAt(), json: JSON.stringify(kept) } : null));
  const {
    keptAt: draftKeptAt,
    nowMs: draftNowMs,
    stop: stopDraftAutosave,
  } = useReferralDraftAutosave({
    draft: draftNow,
    draftJson,
    enabled: !keepsAnotherPersonsDraft,
    dirty,
    initialKeptAt: initialKept?.at ?? null,
    initialKeptJson: initialKept?.json ?? null,
  });
  useDirtyStateGuard({
    isDirty: !sentReferralId && (dirty || draftKeptAt !== null),
    skipAnchor: isOwnLeaveGuardAnchor,
  });
  const requestClose = useCallback(() => {
    if (guardOpen) setGuardOpen(false);
    else if (dirty) setGuardOpen(true);
    else onClose();
  }, [guardOpen, dirty, onClose]);
  useEffect(() => {
    if (!closeRequestRef) return;
    closeRequestRef.current = requestClose;
    return () => {
      closeRequestRef.current = null;
    };
  }, [closeRequestRef, requestClose]);
  // The close guard is a modal over the drawer, on the shared contract: the drawer behind is inert,
  // focus starts on Keep editing, Tab wraps inside the guard, Escape closes only the guard, and focus
  // returns to the control that asked to close. Declared before the drawer's own modal hook so it
  // leaves the stack first when both close together.
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
    stopDraftAutosave();
    discardReferralDraft();
    setGuardOpen(false);
    onClose();
  }
  function keepAndClose() {
    keepReferralDraft(draftNow);
    setGuardOpen(false);
    onClose();
    announceToWardShell("Referral draft kept until this tab reloads.");
  }

  const handleDrawerClose = useCallback(() => {
    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchQuery("");
    } else {
      requestClose();
    }
  }, [isSearchOpen, requestClose]);

  // The enclosing Sheet owns focus when embedded. Register another modal only
  // when this drawer supplies its own backdrop.
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
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA" &&
          document.activeElement?.tagName !== "SELECT"
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

  function handleSelectPatient(key: string) {
    const p = sampleProfiles[key] ?? sampleProfile(key, { movements, patients, referrals, dayZero }, now);
    if (!sampleProfiles[key]) setExtraPatientKeys((keys) => [...keys, key]);
    setActivePatientKey(key);
    setAgeBand("");
    setUnidentified(null);
    setNewPatientOpen(false);
    setSearchQuery("");
    setIsSearchOpen(false);
    setSelectedUnitIds([]);
    setSelectedRecipient("");
    setDocumentation(EMPTY_DOCUMENTATION);
    setCatchmentSuburb(p.suburb);
    const teams = catchmentRoutingDestinations(lookupCatchment(p.suburb));
    setCatchmentTeam(teams?.length === 1 ? teams[0] : p.catchment);
    setCatchmentService("");
    setCatchmentConfirmed(false);
    setCatchmentEditing(false);
    setHomeRegion(movements.find((movement) => movement.id === key)?.homeRegion ?? "");
    const originSite = edById(movements.find((movement) => movement.id === key)?.originEdId ?? "")?.siteCode;
    if (originSite) {
      setSourceKind("ed");
      setOriginSiteCode(originSite);
    }
    const matchedMovement = movements.find((movement) => movement.id === key);
    const record = matchedMovement
      ? resolveSubjectPatient(matchedMovement, { patients, referrals, movements }).patient
      : key.startsWith(PATIENT_KEY_PREFIX)
        ? patients.find((patient) => patient.id === key.slice(PATIENT_KEY_PREFIX.length))
        : undefined;
    setReferralSex(RECORDED_SEXES.find((sex) => sex === record?.sex) ?? "Not recorded");
    setReferralGender(record?.gender ?? "");
    setHighAcuity(false);
    setArrivalEta("");
    setConfirmationOpen(false);
    setFlowError(null);
    setAttempted({});
    setArrivalPlanOpen(false);

    // Synchronize all form fields with selected patient profile
    const baseLegal = p.legalStatus.startsWith("Form") ? p.legalStatus.split(" ").slice(0, 2).join(" ") : p.legalStatus;
    setLegalStatus(destType === "community" && baseLegal === NOT_RECORDED ? "Voluntary" : baseLegal);
    setUrgency(p.urgency);
    setAtsCategory(undefined);
    setSecurity(p.security.toLowerCase().includes("secure") ? "Secure" : "Open");
    setProvisionalDiag(p.provisionalDiag);
    setDoctorNote(p.doctorNote);
    setClinicalSummary(p.clinicalSummary);
    setTransport(p.transportVal);
    setTransitNote(p.transitNote);
    setRiskFlags(p.riskFlags);
    setClearanceChecks({});
    setCommunityNeeds({});
    setEdNeeds({});

    if (onSelectPatient) {
      onSelectPatient(key);
    }
    announceToWardShell(`Selected patient ${p.name} for clinical referral.`);
  }

  function toggleRisk(key: string) {
    setRiskFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // The sample patients first, then any other registered person whose name or UMRN matches.
  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const profiles = Object.values(sampleProfiles).filter((p) => p.id !== NO_PATIENT_KEY);
    if (!q) return profiles;
    const matches = profiles.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.umrn.toLowerCase().includes(q) ||
        p.dob.toLowerCase().includes(q) ||
        p.origin.toLowerCase().includes(q)
      );
    });
    const shown = new Set(profiles.map((p) => p.umrn));
    const record = { movements, patients, referrals, dayZero };
    const more = patients
      .filter(
        (patient) =>
          !shown.has(patient.umrn) &&
          (`${patient.givenName} ${patient.familyName}`.toLowerCase().includes(q) ||
            `${patient.familyName}, ${patient.givenName}`.toLowerCase().includes(q) ||
            patient.umrn.toLowerCase().includes(q)),
      )
      .slice(0, 8)
      .map((patient) => sampleProfile(patientKeyFor(patient.id, record) ?? "custom", record, now));
    return [...matches, ...more];
  }, [searchQuery, sampleProfiles, movements, patients, referrals, dayZero, now]);

  // A new person is linked as soon as the record accepts them.
  useEffect(() => {
    if (pendingNewPatient.current === null || patients.length <= pendingNewPatient.current) return;
    pendingNewPatient.current = null;
    const added = patients[patients.length - 1];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Link only the record the provider accepted.
    if (added) handleSelectPatient(`${PATIENT_KEY_PREFIX}${added.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Runs when the record grows, nothing else.
  }, [patients]);
  function addNewPatient(event: React.FormEvent) {
    event.preventDefault();
    const familyName = newPatient.familyName.trim();
    const givenName = newPatient.givenName.trim();
    const umrn = newPatient.umrn.trim();
    if (!familyName || !givenName) return setNewPatientError("Enter the family and given names.");
    if (!newPatient.dateOfBirth) return setNewPatientError("Enter the date of birth.");
    if (!umrn) return setNewPatientError("Enter the UMRN.");
    if (!addPatientGate.allowed) return setNewPatientError(addPatientGate.reason ?? null);
    setNewPatientError(null);
    pendingNewPatient.current = patients.length;
    dispatch({
      type: "ADD_PATIENT",
      role: sourceKind === "ed" ? "ed" : "community",
      now,
      givenName,
      familyName,
      umrn,
      dateOfBirth: newPatient.dateOfBirth,
      ...(newPatient.gender ? { gender: newPatient.gender } : {}),
      ...(newPatient.suburb.trim() ? { suburb: newPatient.suburb.trim() } : {}),
    });
  }

  // Live capacity for the patient's cohort and the chosen bed security.
  // Cheap enough to work out on each render, and the cohort can come from the record or the age band.
  const realTimeMatch = (() => {
    const patientCohort = movementCohort ?? ageBand;
    const matchingRecords = capacityRecords.filter((r) => r.cohort === patientCohort && r.security === security);
    const readyBedsCount = matchingRecords.reduce((sum, r) => sum + r.readyBeds, 0);
    const pulledBedsCount = matchingRecords.reduce((sum, r) => sum + r.pulledBeds, 0);
    // Owner ruling, 2026-09-05. `readyBedsCount` deliberately subtracts NOTHING for this:
    // a ward's figure must not lurch as cleaning starts and stops. The number stays; the
    // sentence beside it is what was missing here.
    const pendingPreparationCount = matchingRecords.reduce((sum, r) => sum + (r.pendingPreparation ?? 0), 0);
    const sortedUnits = [...matchingRecords].sort((a, b) => {
      const aMatch = a.healthService === catchmentService && catchmentConfirmed ? 1 : 0;
      const bMatch = b.healthService === catchmentService && catchmentConfirmed ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return b.readyBeds - a.readyBeds;
    });
    return { readyBedsCount, pulledBedsCount, pendingPreparationCount, sortedUnits };
  })();

  const selectedDestinations: ReferralDestination[] =
    destType === "ward"
      ? selectedUnitIds
          .filter((id) => realTimeMatch.sortedUnits.some((unit) => unit.unitId === id))
          .map((unitId) => ({
            kind: "psychiatric_ward",
            unitId,
            sex: referralSex,
            gender: referralGender || undefined,
            secureBedNeeded: security === "Secure",
            involuntaryBedNeeded: legalStatus !== "Voluntary",
            highAcuityNursingNeeded: highAcuity,
          }))
      : !selectedRecipient
        ? []
        : destType === "community"
          ? [{ kind: "community_team", teamName: selectedRecipient }]
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
        ? [destType === "community" ? selectedRecipient : (edById(selectedRecipient)?.name ?? selectedRecipient)]
        : [];

  function patientError() {
    if (!patientRecord && unidentified === null)
      return 'Find a registered patient, add a new patient, or choose "Not yet identified".';
    if (!patientRecord && !unidentified?.trim()) return "Describe the unidentified person.";
    if (!effectiveCohort) return "Choose the age band.";
    if (!catchmentConfirmed || !catchmentTeam.trim()) return "Confirm the patient's catchment before continuing.";
    if (!homeRegion) return "Choose the patient's home region.";
    return null;
  }
  function referralError() {
    if (
      !originSiteCode ||
      !siteDirectory.some((site) => site.code === originSiteCode && (sourceKind !== "ed" || !!site.emergencyDepartment))
    )
      return "Choose the location of referral.";
    if (sourceKind === "community" && !sendingTeam.trim()) return "Record the referring community service.";
    if (!URGENCY_LEVELS.some((tier) => String(tier) === urgency)) return "Choose the referral urgency.";
    return null;
  }
  const originValid =
    !!originSiteCode &&
    siteDirectory.some((site) => site.code === originSiteCode && (sourceKind !== "ed" || !!site.emergencyDepartment));
  const needed: Record<DrawerSection, number> = {
    patient: [
      !patientRecord && !unidentified?.trim(),
      !effectiveCohort,
      !catchmentConfirmed || !catchmentTeam.trim(),
      !homeRegion,
    ].filter(Boolean).length,
    referral: [
      !originValid,
      sourceKind === "community" && !sendingTeam.trim(),
      !URGENCY_LEVELS.some((tier) => String(tier) === urgency),
    ].filter(Boolean).length,
    documentation: documentationNeeded(documentation),
    placement: selectedDestinations.length ? 0 : 1,
  };
  const totalNeeded = needed.patient + needed.referral + needed.documentation + needed.placement;
  // L1 (review 12 Oct 2026): ONE count. "N of M ready", "Items left" and each step's "N needed"
  // all count the same items, so the steps add up to the summary and four Complete steps read as
  // all ready. The checklist rows below are labels for the letter, not a second count.
  // A2-9 (audit 13 Oct 2026): the contact details asked at Send are items too, so the hero never
  // reads "0 items left" while Confirm refuses for an empty contact field (`itemsLeft` below).
  const itemsTotal =
    4 + (sourceKind === "community" ? 3 : 2) + documentationItems(documentation) + 1 + CONTACT_FIELD_COUNT;
  // The saved history carries the unidentified label ahead of the patient story, so the two together
  // must fit the history limit or the reducer refuses the referral with no visible reason.
  function storyError() {
    const label = unidentified?.trim();
    const prefix = !patientRecord && label ? UNIDENTIFIED_REFERRAL_PREFIX.length + label.length + 1 : 0;
    const room = REFERRAL_HISTORY_LIMITS.history - prefix;
    return clinicalSummary.length > room ? `Shorten the patient story to ${room} characters or fewer.` : null;
  }
  function sectionFor(error: string | null): DrawerSection | null {
    if (!error) return null;
    if (patientError() === error) return "patient";
    if (referralError() === error || storyError() === error) return "referral";
    if (documentationError(documentation) === error) return "documentation";
    return "placement";
  }
  function goNext(section: "patient" | "referral" | "documentation") {
    const error =
      patientError() ??
      (section !== "patient" ? (referralError() ?? storyError()) : null) ??
      (section === "documentation" ? documentationError(documentation) : null);
    setFlowError(error);
    if (error) {
      const failed = sectionFor(error);
      if (failed) setAttempted((current) => ({ ...current, [failed]: true }));
      return;
    }
    setActiveSection(section === "patient" ? "referral" : section === "referral" ? "documentation" : "placement");
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }
  function goBack() {
    setFlowError(null);
    setActiveSection((current) =>
      current === "placement" ? "documentation" : current === "documentation" ? "referral" : "patient",
    );
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }
  function handleDispatch() {
    const error =
      patientError() ??
      referralError() ??
      storyError() ??
      documentationError(documentation) ??
      (selectedDestinations.length ? null : "Select at least one referral location.");
    setFlowError(error);
    if (error) {
      const failed = sectionFor(error);
      if (failed) setAttempted((current) => ({ ...current, [failed]: true }));
      return;
    }
    setConfirmationOpen(true);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    requestAnimationFrame(() => confirmationHeadingRef.current?.focus());
  }
  function confirmAndSend(event: React.FormEvent) {
    event.preventDefault();
    if (sendPending || sentReferralId || !sendGate.allowed) return;
    const validation =
      patientError() ??
      referralError() ??
      storyError() ??
      documentationError(documentation) ??
      referralContactError(contact);
    if (validation) {
      setFlowError(validation);
      setAttempted((current) => ({ ...current, contact: true }));
      return;
    }
    const needs = needsFor(destType, communityNeeds, edNeeds);
    const intake: ReferralIntakeDetails = {
      catchment: { teamName: catchmentTeam.trim(), service: catchmentService || undefined, confirmed: true },
      reasonForReferral: doctorNote,
      legalStatus,
      riskFlags: REFERRAL_RISK_FLAGS.filter((flag) => riskFlags[flag]),
      medicalClearance: {
        cleared: isMedicalCleared,
        ...(isMedicalCleared
          ? {}
          : {
              expectedAt: `${documentation.expectedAt}+08:00`,
              contactName: documentation.contactName,
              contactPhone: documentation.contactPhone,
            }),
      },
      triageAndRampCompleted: documentation.triage === "yes",
      charts: documentation.charts,
      additionalDocuments: documentation.additional === "yes",
      referrer: contact,
      ...(destType === "ward"
        ? {
            arrival: { transport, reference: transitNote, estimatedAt: arrivalEta ? `${arrivalEta}+08:00` : undefined },
            ...(Object.keys(clearanceChecks).length ? { clearanceChecklist: clearanceChecks } : {}),
          }
        : {}),
      ...(needs && referralNeedsWords(needs).length ? { needs } : {}),
    };
    const intakeError = referralIntakeError(intake);
    if (intakeError) {
      setFlowError(intakeError);
      return;
    }
    const cohort = effectiveCohort || undefined;
    const tier = URGENCY_LEVELS.find((level) => String(level) === urgency);
    if (!cohort || !tier || !homeRegion || !selectedDestinations.length) {
      setFlowError("Check the patient, urgency and selected recipients.");
      return;
    }
    submissionRef.current = { intake, rejectionCount: rejections.length };
    setSendPending(true);
    setFlowError(null);
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: sourceKind === "ed" ? "ed" : "community",
      now,
      patientId: patientRecord?.id,
      ageBand: cohort,
      homeRegion,
      suburb: suburbKnown ? { kind: "named", name: catchmentSuburb } : { kind: "unknown", reason: "not_known" },
      destinations: selectedDestinations,
      source: sourceKind === "ed" ? "ed_medical" : "community",
      originSiteCode,
      sendingTeamName: sourceKind === "community" ? sendingTeam : undefined,
      urgency: tier,
      ...(atsCategory === undefined ? {} : { atsCategory }),
      transportNeeded: destType === "ward" && transport !== "carer",
      history: unidentifiedHistory,
      tentativeDiagnosis: isTentativeDiagnosisBlock(provisionalDiag) ? provisionalDiag : undefined,
      intake,
    });
  }
  useEffect(() => {
    const submitted = submissionRef.current;
    if (!sendPending || !submitted) return;
    const created = referrals.find((referral) => referral.intake === submitted.intake);
    if (created) {
      stopDraftAutosave();
      discardReferralDraft();
      rememberReferrerContact(submitted.intake.referrer);
      setSentReferralId(created.id);
      setSentAt(now);
      setSendPending(false);

      announceToWardShell("Referral sent to the selected locations.");
    } else if (rejections.length > submitted.rejectionCount) {
      setFlowError(rejections[rejections.length - 1]?.reason ?? "Referral could not be sent.");
      setSendPending(false);
    }
  }, [sendPending, referrals, rejections, patientRecord?.id, now, stopDraftAutosave]);

  // Recipient inboxes, read from the provider the ward screen already uses.
  const inboxWards = capacityRecords
    .map((unit) => {
      const entries = wardReferralInbox?.(unit.unitId) ?? [];
      const toDecide = entries.filter((entry) => entry.state === "queued" && entry.withdrawnAt === undefined).length;
      return { unit, entries: entries.length, toDecide };
    })
    .filter((ward) => ward.entries > 0);
  const inboxCount = inboxWards.reduce((sum, ward) => sum + ward.toDecide, 0);
  const inboxWard = inboxWards.find((ward) => ward.unit.unitId === inboxUnitId) ?? inboxWards[0];

  const tier = URGENCY_LEVELS.find((level) => String(level) === urgency);
  const tierLabel = tier === undefined ? "Not recorded" : urgencyTierLabel(tier);
  const recordedFlags = (Object.keys(RISK_FLAG_LABELS) as (keyof typeof RISK_FLAG_LABELS)[]).filter(
    (key) => riskFlags[key],
  );
  const clearance: { label: string; tone: WfTone } =
    documentation.medical === "yes"
      ? { label: "Cleared", tone: "success" }
      : documentation.medical === "no"
        ? { label: "Pending", tone: "warning" }
        : { label: "Not answered", tone: "neutral" };
  const contactErrors = attempted.contact ? contactFieldErrors(contact) : {};
  const contactNeeded = Object.keys(contactFieldErrors(contact)).length;
  const itemsLeft = totalNeeded + contactNeeded;
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
  // A blank or unlisted suburb is sent as "Suburb not known", so a person of no fixed address can
  // still be referred. The catchment card says which will be sent.
  const suburbKnown =
    !!catchmentSuburb &&
    suburbOptions().some((suburb) => suburb.toLowerCase() === catchmentSuburb.trim().toLowerCase());
  const originLabel = originValid
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
  const readyRows: { label: string; value: string; state: "done" | "follow" | "needed" }[] = [
    { label: "Refer to", value: destination.label, state: "done" },
    {
      label: "Patient",
      value: patientRecord ? currentPatient.name : unidentifiedName || "Needed",
      state: patientRecord || unidentifiedName ? "done" : "needed",
    },
    {
      label: "Catchment",
      value: catchmentConfirmed ? catchmentTeam : "To confirm",
      state: catchmentConfirmed ? "done" : "needed",
    },
    { label: "From", value: originLabel || "Needed", state: originValid ? "done" : "needed" },
    { label: "Legal status", value: legalStatus, state: legalStatus === NOT_RECORDED ? "follow" : "done" },
    {
      label: "Urgency",
      value: tier === undefined ? "Needed" : `Tier ${tier}`,
      state: tier === undefined ? "needed" : "done",
    },
    {
      label: destination.check,
      value: needed.documentation
        ? `${needed.documentation} to answer`
        : checksDone !== undefined
          ? `${checksDone} of ${CLEARANCE_CHECKS.length} done`
          : documentation.medical === "no"
            ? "Clearance to follow"
            : "Answered",
      state: needed.documentation ? "needed" : documentation.medical === "no" ? "follow" : "done",
    },
    {
      label: "Your contact",
      value: contactNeeded ? `${contactNeeded} to fill at Send` : contact.name,
      state: contactNeeded ? "needed" : "done",
    },
    { label: destination.places, value: placeRow, state: selectedDestinations.length ? "done" : "needed" },
  ];
  const draftNeeds = needsFor(destType, communityNeeds, edNeeds);
  const letterInput: ReferralTextInput = {
    destinationPhrase: destination.phrase,
    patientName: patientRecord ? currentPatient.name : unidentifiedName,
    umrn: patientRecord ? currentPatient.umrn : "",
    ageSex: patientRecord ? ageSexLabel(currentPatient) : "",
    suburb: catchmentSuburb,
    from: originLabel,
    recipients: recipientLabels,
    urgency: tier === undefined ? "" : tierLabel,
    legalStatus,
    reason: doctorNote,
    history: unidentifiedHistory,
    risks: recordedFlags.map((key) => RISK_FLAG_LABELS[key]),
    clearance: clearance.label,
    clearanceChecklist: destType === "ward" ? clearanceChecklistWords(clearanceChecks) : "",
    needs: draftNeeds ? referralNeedsWords(draftNeeds) : [],
    referrer: { name: contact.name, role: contact.role, phone: contact.phone },
  };
  async function copyText(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice(done);
    } catch {
      setCopyNotice("Copy unavailable in this browser");
    }
  }
  function chooseDestination(kind: DrawerCategory) {
    if (kind === destType || sendPending || sentReferralId) return;
    setDestType(kind);
    setSelectedUnitIds([]);
    setSelectedRecipient("");
    setConfirmationOpen(false);
    setFlowError(null);
    if (kind === "community" && legalStatus === NOT_RECORDED) setLegalStatus("Voluntary");
    announceToWardShell(`Referring to ${DESTINATIONS[kind].phrase}.`);
  }

  function selectSection(id: DrawerSection) {
    if (sendPending || sentReferralId) return;
    setPreviewOpen(false);
    setConfirmationOpen(false);

    setFlowError(null);
    setActiveSection(id);
    setIsSearchOpen(false);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }

  const footStatus = (() => {
    if (view === "inbox") {
      return {
        tone: "info" as WfTone,
        first: inboxWard ? `${inboxWard.unit.name} inbox · ${inboxWard.toDecide} to decide` : "No referrals waiting",
        second: `${inboxWards.length} ${inboxWards.length === 1 ? "ward has" : "wards have"} referrals`,
      };
    }
    if (sentReferralId) {
      return {
        tone: "success" as WfTone,
        first: `Sent ${sentAt === null ? "" : formatInstantWithDay(sentAt, now)} · ${sentReferralId}`,
        second: `${recipientLabels.length} ${recipientLabels.length === 1 ? "location" : "locations"} notified`,
      };
    }
    if (flowError) {
      return { tone: "danger" as WfTone, first: flowError, second: recipientSummary(recipientLabels), alert: true };
    }
    if (confirmationOpen) {
      return {
        tone: (contactNeeded ? (attempted.contact ? "danger" : "neutral") : "success") as WfTone,
        first: contactNeeded
          ? `${contactNeeded} contact ${contactNeeded === 1 ? "detail" : "details"} needed`
          : "Ready to send",
        second: recipientSummary(recipientLabels),
      };
    }
    return {
      tone: (itemsLeft ? "neutral" : "success") as WfTone,
      // Audit 11 Oct 2026: the same unit as Ready to send, so "4 of 9" and this line agree.
      first: itemsLeft > 0 ? `${itemsLeft} of ${itemsTotal} items still needed` : "All items in",
      second: recipientSummary(recipientLabels),
    };
  })();

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
  const phFirstNeeded = SECTION_IDS.find((id) => needed[id] > 0);
  const phNeededLabels = readyRows.filter((row) => row.state === "needed").map((row) => row.label);
  const phNeedsLine = phNeededLabels.length
    ? `Needs ${phNeededLabels.slice(0, 3).join(", ")}${phNeededLabels.length > 3 ? ` and ${phNeededLabels.length - 3} more` : ""}`
    : "Every row the letter needs is ready";
  function phStepHint(id: DrawerSection): string {
    if (id === "patient") {
      return patientRecord
        ? `${currentPatient.name} · ${catchmentConfirmed && catchmentTeam.trim() ? catchmentTeam : "catchment to confirm"}`
        : "Find a patient by name or UMRN";
    }
    if (id === "referral") {
      return originValid
        ? [originLabel, legalStatus, tier === undefined ? "urgency" : `Tier ${tier}`].join(" · ")
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
  function phCloseSheet() {
    setPhoneStepOpen(false);
    setPreviewOpen(false);
    setConfirmationOpen(false);
    setFlowError(null);
  }
  function phOpenStep(id: DrawerSection) {
    selectSection(id);
    setPhoneStepOpen(true);
  }
  const phStepIndex = SECTION_IDS.indexOf(activeSection);

  return {
    onClose,
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
    bodyRef,
    sectionId,
    selectedUnitIds,
    setSelectedUnitIds,
    selectedRecipient,
    setSelectedRecipient,
    ageBand,
    setAgeBand,
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
    newPatient,
    setNewPatient,
    newPatientError,
    setNewPatientError,
    pendingNewPatient,
    guardKeepRef,
    confirmationOpen,
    setConfirmationOpen,
    sendPending,
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
    draftNow,
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
  } as const;
}

/** Everything the referral slide-out's sections read, from one call per render. */
export type WardReferralDrawerState = ReturnType<typeof useWardReferralDrawerState>;
