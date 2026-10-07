"use client";

import { Activity, Clock, Lock, MapPin, Plus, Search, Send, ShieldAlert, ShieldCheck, User, X } from "lucide-react";
import Link from "next/link";
import { useState, useId, useEffect, useMemo, useRef, useCallback } from "react";

import {
  catchmentCanRouteAutomatically,
  catchmentRoutingDestinations,
  lookupCatchment,
} from "@/components/ward-management/ward-catchment";
import { isTentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import {
  CatchmentSection,
  ClinicalPresentationSection,
  DocumentationSection,
  DrawerNext,
  LocationsSection,
  ReferringSourceSection,
  SendContactDialog,
} from "@/components/ward-management/referrals/referral-flow-sections";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { formTitleForCode } from "@/lib/form-register";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  arrivalEtaLabel,
  arrivalModeLabel,
  ArrivalTimeModal,
  canSetArrivalPlan,
  isArrivalLate,
} from "@/components/ward-management/referrals/arrival-time-modal";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import { calendarDateOf, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import {
  RECORDED_SEXES,
  URGENCY_LEVELS,
  type Cohort,
  type HealthService,
  type HomeRegion,
  type Movement,
  type Referral,
  type ReferralDestination,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { patientAgeYears, type Patient } from "@/components/ward-management/ward-patients";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { allEmergencyDepartments, edById, siteByCode, wardSites } from "@/components/ward-management/ward-sites";
import styles from "./ward-referral-drawer.module.css";

/**
 * The legal-status choices, as bare register codes. Their visible text is built from the Chief
 * Psychiatrist register at render time by `legalStatusOptionLabel` below — never written here.
 *
 * `"Voluntary"` is not a form code and the register has no entry for it, so that option keeps its
 * own label and is not in this list.
 */
const LEGAL_STATUS_FORM_CODES = ["1A", "4A", "5A"] as const;

/**
 * "Form 4A (Transport order)" — the register's own title, looked up at render time.
 *
 * Mirrors `ward-legal-forms.ts`'s `legalFormName` exactly, including its `null` contract: a code
 * the register does not list renders as the BARE code, never a substituted or locally-invented
 * title. It is a small function of its own rather than a call to that one because `legalFormName`
 * takes a whole `LegalForm`, and this select owns bare codes with no form record behind them —
 * casting a `{ code }` object into a `LegalForm` would assert a shape that does not exist here.
 *
 * ⚠️ **THE POINT IS THAT THE TITLE IS NEVER SOURCE TEXT.**
 * `tests/ward-form-labels-from-register.test.ts` scans this directory's string literals and JSX
 * text for `Form <code> (<description>)` and fails on any match, on the reasoning that a correctly
 * built label is computed by a function call and so cannot appear as a literal. Writing a title
 * back into the JSX re-breaks that guard, which is how the three labels this replaced were caught.
 */
function legalStatusOptionLabel(code: string): string {
  const title = formTitleForCode(code);
  return title === null ? `Form ${code}` : `Form ${code} (${title})`;
}

type WardReferralDrawerProps = {
  onClose: () => void;
  onSelectPatient?: (patientId: string) => void;
  withBackdrop?: boolean;
  initialCategory?: "community" | "ed" | "ward";
};

type MockPatientProfile = {
  id: string;
  name: string;
  /** Whole years, or empty when the record holds no date of birth. */
  age: string;
  /** The first letter of the recorded sex, or empty when none is recorded. */
  gender: string;
  umrn: string;
  dob: string;
  medicare: string;
  origin: string;
  legalStatus: string;
  recordedExpiry: string;
  security: string;
  initials: string;
  provisionalDiag: string;
  doctorNote: string;
  clinicalSummary: string;
  cohort: string;
  suburb: string;
  catchment: string;
  destType: string;
  urgency: string;
  transportVal: string;
  transitNote: string;
  riskFlags: {
    aggression: boolean;
    absconding: boolean;
    medical: boolean;
    vulnerable: boolean;
    suicide: boolean;
  };
};

const NOT_RECORDED = "Not recorded";

/**
 * The drawer's sample patients: four real movements and one unregistered walk-in. Only the form
 * mode and the transport picked first are set here; every fact about the person comes from the
 * record through `sampleProfile`.
 *
 * These used to be typed-in profiles laid over real movement ids, each with a made-up name,
 * Medicare number, diagnosis, doctor, clinical summary and risk flags. WF-009 read "Tobias Wren"
 * where the record says Bao Davenport, and the medical-clearance switch below writes to that real
 * movement (25 September 2026 audit, A6). Josh chose "Real details" on 25 September 2026: the
 * record's own name, record number, origin, legal status and urgency, "Not recorded" where it holds
 * none, and the free-text fields start empty.
 */
const SAMPLE_PATIENTS: Record<string, { destType: string; transportVal: string }> = {
  "WF-009": { destType: "ward", transportVal: "mht" },
  "WF-004": { destType: "ward", transportVal: "mht" },
  "WF-002": { destType: "community", transportVal: "carer" },
  "WF-006": { destType: "ward", transportVal: "stjohn" },
  custom: { destType: "ward", transportVal: "police" },
};

const NO_RISK_FLAGS: MockPatientProfile["riskFlags"] = {
  aggression: false,
  absconding: false,
  medical: false,
  vulnerable: false,
  suicide: false,
};

function sampleProfile(
  key: string,
  record: { movements: Movement[]; patients: Patient[]; referrals: Referral[]; dayZero: Date },
  now: Instant,
): MockPatientProfile {
  const sample = SAMPLE_PATIENTS[key] ?? SAMPLE_PATIENTS.custom!;
  const movement = record.movements.find((candidate) => candidate.id === key);
  const blank = {
    id: key,
    medicare: NOT_RECORDED,
    provisionalDiag: "",
    doctorNote: "",
    clinicalSummary: "",
    destType: sample.destType,
    transportVal: sample.transportVal,
    transitNote: "",
    riskFlags: NO_RISK_FLAGS,
  };
  if (!movement) {
    return {
      ...blank,
      name: "Unregistered Walk-In",
      age: "",
      gender: "",
      umrn: NOT_RECORDED,
      dob: NOT_RECORDED,
      origin: NOT_RECORDED,
      legalStatus: NOT_RECORDED,
      recordedExpiry: NOT_RECORDED,
      security: "Open",
      initials: "UR",
      cohort: NOT_RECORDED,
      suburb: "",
      catchment: "",
      urgency: "",
    };
  }
  const info = resolveSubjectPatient(movement, record);
  const patient = info.patient;
  const years = patient ? patientAgeYears(patient, calendarDateOf(now, record.dayZero)) : Number.NaN;
  const dueAt = movement.legalForm?.dueAt;
  return {
    ...blank,
    name: info.displayName,
    age: Number.isFinite(years) && years >= 0 ? String(years) : "",
    gender: patient?.sex ? patient.sex.charAt(0).toUpperCase() : "",
    umrn: info.umrn,
    dob: patient?.dateOfBirth ?? NOT_RECORDED,
    origin: edById(movement.originEdId)?.name ?? NOT_RECORDED,
    legalStatus: movement.legalForm ? `Form ${movement.legalForm.code}` : movement.legalStatus,
    recordedExpiry:
      dueAt === undefined ? NOT_RECORDED : `Clinician-entered expiry: ${formatInstantWithDay(dueAt, now)}`,
    security: movement.security,
    initials: info.initials,
    cohort: movement.cohort,
    suburb: patient?.suburb ?? "",
    catchment: patient?.catchmentCommunityTeam ?? "",
    urgency: String(movement.urgency),
  };
}

/** "42M" as before when both are recorded; otherwise it says which part is missing. */
function ageSexLabel(profile: MockPatientProfile): string {
  if (profile.age && profile.gender) return `${profile.age}${profile.gender}`;
  if (profile.age) return `${profile.age}, sex not recorded`;
  if (profile.gender) return `age not recorded, ${profile.gender}`;
  return "age and sex not recorded";
}

export type WardCapacityRecord = {
  unitId: string;
  name: string;
  hospital: string;
  healthService: HealthService | undefined;
  cohort: Cohort;
  security: "Open" | "Secure";
  readyBeds: number;
  /** `bedStates().pulled` — allocated to a named patient who has not arrived yet. */
  pulledBeds: number;
  /** `bedStates().closed` — physically empty, but the ward is not offering it. */
  closedBeds: number;
  /** Of `readyBeds`, how many are still being made ready. */
  pendingPreparation?: number;
};

/**
 * Every ward in the network, with its live bed figures, read from the model.
 *
 * This used to be a typed-in list of eleven wards with typed bed counts. Five of those wards do not
 * exist in the network, and outside the provider the typed counts were shown as they stood (25
 * September 2026 audit, A6). "Secure" means a wholly locked ward, the meaning the model's own
 * restriction notice gives it (`isMoreRestrictiveThanRequired`, `ward-derivations.ts`).
 */
export function useWardCapacity(): WardCapacityRecord[] {
  let flow: ReturnType<typeof useWardFlow> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    flow = useWardFlow();
  } catch {
    flow = null;
  }
  const units = flow?.units;
  const bedReleases = flow?.bedReleases;
  const admissions = flow?.admissions;
  const leaveBeds = flow?.leaveBeds;
  return useMemo(() => {
    if (!units || !bedReleases) return [];
    return units.map((unit) => {
      // The ruled bed boxes (`ward-bed-states.ts`): Ready · Pulled · Closed · Occupied.
      const states = bedStates(unit, admissions ?? [], bedReleases, leaveBeds ?? []);
      return {
        unitId: unit.id,
        name: unit.name,
        hospital: siteByCode(unit.siteCode)?.name ?? unit.siteCode,
        healthService: unitHealthService(unit),
        cohort: unit.cohort,
        security: unitHasOpenBeds(unit) ? "Open" : "Secure",
        readyBeds: states.ready,
        pulledBeds: states.pulled,
        closedBeds: states.closed,
        pendingPreparation: bedsPendingPreparation(unit.id, [...bedReleases]),
      };
    });
  }, [units, bedReleases, admissions, leaveBeds]);
}

export function WardReferralDrawer(props: WardReferralDrawerProps) {
  return <WardReferralDrawerContent key={props.initialCategory ?? "ward"} {...props} />;
}

function WardReferralDrawerContent({
  onClose,
  onSelectPatient,
  withBackdrop = false,
  initialCategory = "ward",
}: WardReferralDrawerProps) {
  const searchId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef<number | null>(null);

  const capacityRecords = useWardCapacity();

  const initialPatientKey = initialCategory === "community" ? "WF-002" : initialCategory === "ed" ? "WF-004" : "WF-009";

  const [activePatientKey, setActivePatientKey] = useState<string>(initialPatientKey);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"patient" | "referral" | "documentation" | "locations">("patient");
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionId = useId();
  const { movements, patients, referrals, dayZero, dispatch, rejections } = useWardFlow();
  const now = useWardFlowClock();
  const sampleProfiles = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(SAMPLE_PATIENTS).map((key) => [
          key,
          sampleProfile(key, { movements, patients, referrals, dayZero }, now),
        ]),
      ) as Record<string, MockPatientProfile>,
    [movements, patients, referrals, dayZero, now],
  );
  const defaultPatient = sampleProfiles[initialPatientKey]!;
  const [localMedicalCleared, setLocalMedicalCleared] = useState<Record<string, boolean>>({});
  const [arrivalPlanOpen, setArrivalPlanOpen] = useState(false);
  const liveMovement = movements.find((m) => m.id === activePatientKey);
  const arrivalRole = initialCategory === "community" ? "community" : initialCategory === "ed" ? "ed" : "ward";
  const isMedicalCleared = localMedicalCleared[activePatientKey] ?? liveMovement?.medicalClearance?.cleared ?? false;

  function handleToggleMedicalClearance() {
    const nextVal = !isMedicalCleared;
    setLocalMedicalCleared((prev) => ({ ...prev, [activePatientKey]: nextVal }));
    if (liveMovement) {
      dispatch({
        type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
        role: "ed",
        now,
        movementId: liveMovement.id,
        cleared: nextVal,
      });
    }
    announceToWardShell(
      `Pre-admission medical clearance for ${currentPatient.name} marked as ${nextVal ? "CLEARED" : "PENDING"}.`,
    );
  }

  // Form field state - fully synced and editable
  const [legalStatus, setLegalStatus] = useState(
    defaultPatient.legalStatus.startsWith("Form")
      ? defaultPatient.legalStatus.split(" ").slice(0, 2).join(" ")
      : defaultPatient.legalStatus,
  );
  const [urgency, setUrgency] = useState(defaultPatient.urgency);
  const [destType, setDestType] = useState<string>(initialCategory);
  const [security, setSecurity] = useState(
    defaultPatient.security.toLowerCase().includes("secure") ? "Secure" : "Open",
  );
  const [provisionalDiag, setProvisionalDiag] = useState(defaultPatient.provisionalDiag);
  const [clinicalSummary, setClinicalSummary] = useState(defaultPatient.clinicalSummary);
  const [riskFlags, setRiskFlags] = useState<Record<string, boolean>>(defaultPatient.riskFlags);
  const [catchmentConfirmed, setCatchmentConfirmed] = useState(false);
  const [catchmentEditing, setCatchmentEditing] = useState(false);
  const [catchmentQuery, setCatchmentQuery] = useState("");
  const [confirmedClinic, setConfirmedClinic] = useState("");
  const [confirmedSuburb, setConfirmedSuburb] = useState("");
  const [referringSetting, setReferringSetting] = useState<"" | "community" | "emergency">("");
  const [referringService, setReferringService] = useState("");
  const [homeRegion, setHomeRegion] = useState<HomeRegion | "">(
    (movements.find((movement) => movement.id === initialPatientKey)?.homeRegion ?? "") as HomeRegion | "",
  );
  const [originSiteCode, setOriginSiteCode] = useState("");
  const [ageBand, setAgeBand] = useState<Cohort | "">(
    movements.find((movement) => movement.id === initialPatientKey)?.cohort ?? "",
  );
  const [clearanceAnswer, setClearanceAnswer] = useState<"" | "yes" | "no">("");
  const [clearanceWhen, setClearanceWhen] = useState("");
  const [clearanceName, setClearanceName] = useState("");
  const [clearanceNumber, setClearanceNumber] = useState("");
  const [triageRamp, setTriageRamp] = useState<"" | "yes" | "no">("");
  const [medicationChartAttached, setMedicationChartAttached] = useState(false);
  const [observationChartAttached, setObservationChartAttached] = useState(false);
  const [anythingElse, setAnythingElse] = useState<"" | "yes" | "no">("");
  const [anythingElseNote, setAnythingElseNote] = useState("");
  const [referrerRole, setReferrerRole] = useState<WardFlowRole | "">("");
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [selectedEdId, setSelectedEdId] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [callbackPhone, setCallbackPhone] = useState("");
  const [callbackEmail, setCallbackEmail] = useState("");
  const [callbackLocation, setCallbackLocation] = useState("");

  // Body scroll locking on mobile/desktop while drawer is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (deltaY > 60 && typeof window !== "undefined" && window.innerWidth <= 640) {
      onClose();
    }
  };

  const drawerRef = useRef<HTMLDivElement>(null);

  const handleDrawerClose = useCallback(() => {
    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchQuery("");
    } else {
      onClose();
    }
  }, [isSearchOpen, onClose]);

  // The enclosing Sheet owns focus when embedded. Register another modal only
  // when this drawer supplies its own backdrop.
  useWardModalFocus(withBackdrop, drawerRef, handleDrawerClose);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA" &&
          document.activeElement?.tagName !== "SELECT"
        ) {
          e.preventDefault();
          setActiveSection("patient");
          requestAnimationFrame(() => searchInputRef.current?.focus());
          setIsSearchOpen(true);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const currentPatient = sampleProfiles[activePatientKey] ?? sampleProfiles["WF-009"]!;

  function handleSelectPatient(key: string) {
    const p = sampleProfiles[key];
    if (!p) return;
    setActivePatientKey(key);
    setSearchQuery("");
    setIsSearchOpen(false);
    setArrivalPlanOpen(false);

    // Synchronize all form fields with selected patient profile
    const baseLegal = p.legalStatus.startsWith("Form") ? p.legalStatus.split(" ").slice(0, 2).join(" ") : p.legalStatus;
    setLegalStatus(baseLegal);
    setUrgency(p.urgency);
    setDestType(p.destType);
    setSecurity(p.security.toLowerCase().includes("secure") ? "Secure" : "Open");
    setProvisionalDiag(p.provisionalDiag);
    setClinicalSummary(p.clinicalSummary);
    setRiskFlags(p.riskFlags);
    setCatchmentConfirmed(false);
    setCatchmentEditing(false);
    setCatchmentQuery("");
    setConfirmedClinic("");
    setConfirmedSuburb("");
    setSelectedUnitIds([]);
    setSelectedEdId("");
    setSelectedTeam("");
    setContactOpen(false);
    const nextMovement = movements.find((movement) => movement.id === key);
    setHomeRegion(nextMovement?.homeRegion ?? "");
    setAgeBand(nextMovement?.cohort ?? "");

    if (onSelectPatient) {
      onSelectPatient(key);
    }
    announceToWardShell(`Selected patient ${p.name} for clinical referral.`);
  }

  function toggleRisk(key: string) {
    setRiskFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Searches the sample patients above, and nothing else.
  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const profiles = Object.values(sampleProfiles);
    if (!q) return profiles;
    return profiles.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.umrn.toLowerCase().includes(q) ||
        p.dob.toLowerCase().includes(q) ||
        p.origin.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, sampleProfiles]);

  // The bed figure on the patient card. Ready beds are not reduced while a bed is being made
  // ready (owner ruling, 2026-09-05): the number stays, and preparation is a separate sentence.
  const patientCohort = currentPatient.cohort;
  let bedPillText = "Community Transfer";
  if (destType === "ed") {
    bedPillText = "Observation beds not recorded";
  } else if (destType !== "community") {
    const matchingRecords = capacityRecords.filter(
      (record) => record.cohort === patientCohort && record.security === security,
    );
    const readyBedsCount = matchingRecords.reduce((sum, record) => sum + record.readyBeds, 0);
    const pulledBedsCount = matchingRecords.reduce((sum, record) => sum + record.pulledBeds, 0);
    const closedBedsCount = matchingRecords.reduce((sum, record) => sum + record.closedBeds, 0);
    bedPillText = `${readyBedsCount} Bed${readyBedsCount === 1 ? "" : "s"} Ready · ${pulledBedsCount} Pulled · ${closedBedsCount} Closed`;
  }

  const subject = liveMovement ? resolveSubjectPatient(liveMovement, { movements, patients, referrals }) : undefined;
  const recordedSuburb = currentPatient.suburb.trim();
  const suburbLookup = recordedSuburb ? lookupCatchment(recordedSuburb) : null;
  const autoClinics =
    suburbLookup && catchmentCanRouteAutomatically(suburbLookup)
      ? [...new Set(catchmentRoutingDestinations(suburbLookup) ?? [])]
      : [];
  const autoClinic = autoClinics.length === 1 ? autoClinics[0]! : null;
  const autoSuburb = suburbLookup && suburbLookup.suburb ? suburbLookup.suburb : "";

  const searchLookup = catchmentQuery.trim().length >= 2 ? lookupCatchment(catchmentQuery.trim()) : null;
  const searchChoices: { clinic: string; suburb: string }[] = [];
  let searchNote = "";
  if (searchLookup?.state === "unknown") {
    searchNote = "That suburb is not in the catchment table. Nothing has been filled in.";
  } else if (searchLookup?.state === "contested") {
    searchNote = "This suburb has more than one catchment. Choose one.";
    const suburbName = searchLookup.suburb;
    for (const answer of searchLookup.answers) {
      for (const clinic of answer.clinics) {
        searchChoices.push({ clinic, suburb: suburbName });
      }
    }
  } else if (searchLookup && catchmentCanRouteAutomatically(searchLookup)) {
    const suburbName = searchLookup.suburb ?? "";
    for (const clinic of [...new Set(catchmentRoutingDestinations(searchLookup) ?? [])]) {
      searchChoices.push({ clinic, suburb: suburbName });
    }
    if (searchChoices.length === 0) searchNote = "No catchment team is recorded for that suburb.";
  }

  function confirmCatchment(clinic: string, suburb: string) {
    setConfirmedClinic(clinic);
    setConfirmedSuburb(suburb);
    setCatchmentConfirmed(true);
    setCatchmentEditing(false);
    setCatchmentQuery("");
  }

  const departments = allEmergencyDepartments();
  const teamOptions = communityTeamOptions();
  const sourceServices =
    referringSetting === "community"
      ? teamOptions.map((team) => ({ value: team, label: team }))
      : referringSetting === "emergency"
        ? departments.map((department) => ({ value: department.id, label: department.name }))
        : [];
  const serviceLabel =
    referringSetting === "emergency"
      ? (departments.find((department) => department.id === referringService)?.name ?? "")
      : referringService;

  function chooseSetting(next: "community" | "emergency") {
    setReferringSetting(next);
    setReferringService("");
    if (next === "community") setReferrerRole("community");
    if (next === "emergency") setReferrerRole("ed");
  }

  function chooseService(value: string) {
    setReferringService(value);
    if (referringSetting === "emergency") {
      const department = departments.find((item) => item.id === value);
      if (department) setOriginSiteCode(department.siteCode);
    }
  }

  const placeCount = selectedUnitIds.length + (selectedEdId ? 1 : 0) + (selectedTeam ? 1 : 0);
  const atCap = placeCount >= 3;

  function toggleUnit(unitId: string) {
    setSelectedUnitIds((current) => {
      if (current.includes(unitId)) return current.filter((id) => id !== unitId);
      const nextCount = current.length + (selectedEdId ? 1 : 0) + (selectedTeam ? 1 : 0) + 1;
      if (nextCount > 3) return current;
      return [...current, unitId];
    });
  }

  function chooseEd(id: string) {
    if (id && !selectedEdId && selectedUnitIds.length + (selectedTeam ? 1 : 0) + 1 > 3) return;
    setSelectedEdId(id);
  }

  function chooseTeam(name: string) {
    if (name && !selectedTeam && selectedUnitIds.length + (selectedEdId ? 1 : 0) + 1 > 3) return;
    setSelectedTeam(name);
  }

  const waitlistByUnit = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const movement of movements) {
      if (movement.closure) continue;
      for (const unitId of movement.waitlistedUnitIds ?? []) {
        counts[unitId] = (counts[unitId] ?? 0) + 1;
      }
    }
    return counts;
  }, [movements]);

  const summary = [
    ...selectedUnitIds.map((id) => {
      const unit = capacityRecords.find((record) => record.unitId === id);
      return unit ? `${unit.hospital} · ${unit.name}` : id;
    }),
    ...(selectedEdId ? [departments.find((department) => department.id === selectedEdId)?.name ?? selectedEdId] : []),
    ...(selectedTeam ? [selectedTeam] : []),
  ];

  const patientReady = catchmentConfirmed;
  const referralReady =
    referringSetting !== "" &&
    referringService !== "" &&
    homeRegion !== "" &&
    originSiteCode !== "" &&
    ageBand !== "" &&
    (urgency === "1" || urgency === "2" || urgency === "3");
  const documentationReady =
    clearanceAnswer !== "" &&
    triageRamp !== "" &&
    referrerRole !== "" &&
    (clearanceAnswer !== "no" ||
      (clearanceWhen.trim() !== "" && clearanceName.trim() !== "" && clearanceNumber.trim() !== "")) &&
    (anythingElse !== "yes" || anythingElseNote.trim() !== "");

  function goTo(section: "patient" | "referral" | "documentation" | "locations") {
    setActiveSection(section);
    setIsSearchOpen(false);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }

  function markClearance(answer: "yes" | "no") {
    setClearanceAnswer(answer);
    const shouldBeCleared = answer === "yes";
    if (shouldBeCleared !== isMedicalCleared) handleToggleMedicalClearance();
  }

  const callbackReady =
    callbackPhone.trim() !== "" && callbackEmail.includes("@") && referrerRole !== "" && callbackLocation.trim() !== "";
  const sendBaseline = useRef<number | null>(null);

  useEffect(() => {
    if (sendBaseline.current === null) return;
    const before = sendBaseline.current;
    sendBaseline.current = null;
    const latestRejection = rejections[rejections.length - 1];
    if (rejections.length > before) {
      announceToWardShell(latestRejection?.reason ?? "The referral was not accepted.");
      return;
    }
    announceToWardShell("Referral sent.");
  }, [rejections, referrals]);

  function handleDispatch() {
    if (!callbackReady || !referralReady || !patientReady || !documentationReady || placeCount === 0 || !ageBand) {
      announceToWardShell("The referral is not ready to send.");
      return;
    }
    const destinations: ReferralDestination[] = [];
    if (selectedUnitIds.length > 0) {
      const sex = liveMovement && RECORDED_SEXES.includes(liveMovement.sex) ? liveMovement.sex : "Not recorded";
      destinations.push({
        kind: "psychiatric_ward",
        sex,
        gender: liveMovement?.gender,
        secureBedNeeded: security === "Secure",
        involuntaryBedNeeded: legalStatus !== "Voluntary" && legalStatus !== "Not recorded",
        highAcuityNursingNeeded: false,
        requestedUnitIds: selectedUnitIds,
      });
    }
    if (selectedEdId) {
      destinations.push({ kind: "emergency_department", edId: selectedEdId, purpose: "psychiatric_review" });
    }
    if (selectedTeam) {
      destinations.push({ kind: "community_team", teamName: selectedTeam });
    }
    sendBaseline.current = rejections.length;
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: referringSetting === "emergency" ? "ed" : "community",
      now,
      patientId: subject?.patient?.id,
      ageBand,
      suburb: confirmedSuburb ? { kind: "named", name: confirmedSuburb } : { kind: "unknown", reason: "not_known" },
      destinations,
      homeRegion,
      source: referringSetting === "emergency" ? "ed_medical" : "community",
      sendingTeamName: serviceLabel || undefined,
      urgency: Number(urgency) as 1 | 2 | 3,
      originSiteCode,
      transportNeeded: Boolean(liveMovement?.arrivalDetails),
      history: clinicalSummary,
      tentativeDiagnosis: isTentativeDiagnosisBlock(provisionalDiag) ? provisionalDiag : undefined,
      referrerPhone: callbackPhone.trim(),
      referrerEmail: callbackEmail.trim(),
      referrerRole,
      referrerLocation: callbackLocation.trim(),
      medicationChartAttached,
      observationChartAttached,
      triageAndRampCompleted: triageRamp === "yes",
      anythingElseNote: anythingElse === "yes" ? anythingElseNote : undefined,
      clearanceExpectedNote: clearanceAnswer === "no" ? clearanceWhen.trim() : undefined,
      clearanceContactName: clearanceAnswer === "no" ? clearanceName.trim() : undefined,
      clearanceContactNumber: clearanceAnswer === "no" ? clearanceNumber.trim() : undefined,
    });
    setContactOpen(false);
  }

  return (
    <>
      {withBackdrop ? <div className={styles.drawerBackdrop} onClick={onClose} aria-hidden="true" /> : null}
      <div
        ref={drawerRef}
        className={styles.drawerWide}
        role={withBackdrop ? "dialog" : "complementary"}
        aria-modal={withBackdrop ? true : undefined}
        aria-labelledby="referralDrawerTitle"
        onKeyDownCapture={(event) => {
          if (event.key === "Escape" && isSearchOpen) {
            event.preventDefault();
            event.stopPropagation();
            setIsSearchOpen(false);
            setSearchQuery("");
          }
        }}
      >
        <div className={styles.drawerHead} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className={styles.dragHandle} aria-hidden="true" />
          <div className={styles.drawerHeadTop}>
            <div className={styles.drawerHeadLeft}>
              <h2 className={styles.drawerTitle} id="referralDrawerTitle">
                <Send className={styles.headingIcon} aria-hidden="true" />
                <span>Referrals</span>
                <span className={styles.categoryBadge} data-testid="ward-referral-drawer-category-badge">
                  {destType === "community"
                    ? "Community Referral"
                    : destType === "ed"
                      ? "ED Referral"
                      : "Ward Referral"}
                </span>
              </h2>
              <div className={styles.drawerSubhead}>Patient details, referral draft and live placement options.</div>
            </div>
            <button
              type="button"
              className={styles.drawerCloseBtn}
              onClick={onClose}
              aria-label="Close referral side drawer"
            >
              <span>Esc</span>
              <X aria-hidden="true" style={{ width: 13, height: 13 }} />
            </button>
          </div>
        </div>

        <div className={styles.sectionNav} role="group" aria-label="Referral sections">
          {(
            [
              ["patient", "Patient", User],
              ["referral", "Referral", ShieldCheck],
              ["documentation", "Documentation", Activity],
              ["locations", "Locations", MapPin],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={activeSection === id}
              aria-controls={`${sectionId}-${id}`}
              onClick={() => {
                setActiveSection(id);
                setIsSearchOpen(false);
                if (bodyRef.current) bodyRef.current.scrollTop = 0;
              }}
            >
              <Icon aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <div ref={bodyRef} className={styles.drawerBody}>
          <div id={`${sectionId}-patient`} className={styles.sectionPanel} hidden={activeSection !== "patient"}>
            {/* 1. PATIENT SELECTION & CLINICAL IDENTITY DOSSIER */}
            <section className={styles.refCard}>
              <div className={styles.refCardHead}>
                <h3 className={styles.refCardTitle}>
                  <User aria-hidden="true" style={{ width: 14, height: 14 }} />
                  <span>Patient overview</span>
                </h3>
                <div className={styles.refCardHeadActions}>
                  <Link
                    href="/mockups/ward-flow/referrals/new"
                    className={styles.newReferralLink}
                    onClick={onClose}
                    title="Open full page referral intake"
                  >
                    <Plus aria-hidden="true" style={{ width: 12, height: 12 }} />
                    <span>Full intake</span>
                  </Link>
                </div>
              </div>

              <div className={styles.patientSearchWrap}>
                <Search className={styles.patientSearchIcon} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="search"
                  id={searchId}
                  className={styles.patientSearchInput}
                  aria-label="Search sample patients"
                  placeholder="Search sample patients by name or UMRN…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim().length > 0) setIsSearchOpen(true);
                  }}
                  autoComplete="off"
                  spellCheck="false"
                  data-gramm="false"
                  data-enable-grammarly="false"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className={styles.patientSearchClear}
                    onClick={() => {
                      setSearchQuery("");
                      setIsSearchOpen(false);
                    }}
                    aria-label="Clear search input"
                  >
                    <X aria-hidden="true" style={{ width: 12, height: 12 }} />
                  </button>
                ) : null}
                <kbd className={styles.patientSearchKbd}>/</kbd>

                {/* Sample patient search results */}
                {isSearchOpen && filteredPatients.length > 0 ? (
                  <div className={styles.patientSearchResults} role="listbox" aria-label="Matching sample patients">
                    {filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="option"
                        aria-selected={activePatientKey === p.id}
                        className={styles.patientSearchResultItem}
                        data-active={activePatientKey === p.id}
                        onClick={() => handleSelectPatient(p.id)}
                      >
                        <div>
                          <div className={styles.searchResultName}>
                            {p.name} ({ageSexLabel(p)})
                          </div>
                          <div className={styles.searchResultMeta}>
                            UMRN: {p.umrn} · DOB: {p.dob} · {p.origin.split("·")[0].trim()}
                          </div>
                        </div>
                        <span className={styles.searchResultBadge}>{p.legalStatus.split("·")[0].trim()}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Prominent Selected Patient Identity Banner Card */}
              <div className={styles.patientBannerCard}>
                <div className={styles.patientBannerHead}>
                  <div className={styles.patientBannerProfile}>
                    <div className={styles.patientBannerAvatar}>{currentPatient.initials}</div>
                    <div className={styles.patientBannerIdentity}>
                      <div className={styles.patientBannerName}>
                        {currentPatient.name} ({ageSexLabel(currentPatient)})
                      </div>
                      <div className={styles.patientBannerSub}>
                        UMRN: {currentPatient.umrn} · DOB: {currentPatient.dob} · Medicare: {currentPatient.medicare}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.patientSwitchBtn}
                    onClick={() => {
                      setSearchQuery("");
                      setIsSearchOpen(true);
                      searchInputRef.current?.focus();
                    }}
                  >
                    <span>Switch</span>
                  </button>
                </div>

                {/* Structured Clinical Priority Grid (Rule 5: Legal Order -> Clinical Acuity -> Bed Compatibility) */}
                <div className={styles.triagePriorityGrid} role="region" aria-label="Clinical Priority Grid">
                  {/* 1. Legal Order */}
                  <div className={`${styles.triagePriorityCard} ${styles.legalOrderPillar}`}>
                    <div className={styles.triagePillarHead}>
                      <span className={styles.triagePillarTitle}>
                        <ShieldAlert aria-hidden="true" style={{ width: 13, height: 13 }} />
                        <span>Legal Order</span>
                      </span>
                      <span className={styles.triagePillarBadge} data-tone="default">
                        Statutory
                      </span>
                    </div>
                    <div className={styles.triagePillarBody}>
                      <div className={styles.triagePillarPrimary}>{currentPatient.legalStatus}</div>
                      <div className={styles.statutoryRecordedTime}>
                        <div className={styles.statutoryExpiryLine}>
                          <span className={styles.triageMetaLabel}>Expiry:</span>
                          <strong>{currentPatient.recordedExpiry}</strong>
                        </div>
                        <LegalLimitsNotChecked variant="tag" />
                      </div>
                      <div className={styles.triagePillarFoot}>Order status: {legalStatus} compliance</div>
                    </div>
                  </div>

                  {/* 2. Clinical Acuity */}
                  <div className={`${styles.triagePriorityCard} ${styles.clinicalAcuityPillar}`}>
                    <div className={styles.triagePillarHead}>
                      <span className={styles.triagePillarTitle}>
                        <Activity aria-hidden="true" style={{ width: 13, height: 13 }} />
                        <span>Clinical Acuity</span>
                      </span>
                      <span
                        className={styles.triagePillarBadge}
                        data-tone={urgency === "1" ? "danger" : urgency === "2" ? "warn" : "default"}
                      >
                        {urgency ? `Tier ${urgency}` : "Not recorded"}
                      </span>
                    </div>
                    <div className={styles.triagePillarBody}>
                      <div className={styles.triagePillarPrimary}>
                        <span className={styles.triageScoreLabel}>Urgency:</span>
                        <span className={styles.triagePriorityScore}>
                          {/* The recorded tier only, as in the urgency list: no typed hour window (D-22). */}
                          {(() => {
                            const tier = URGENCY_LEVELS.find((level) => String(level) === urgency);
                            return tier === undefined ? "Not recorded" : urgencyTierLabel(tier);
                          })()}
                        </span>
                      </div>
                      <div className={styles.triageDiagSub}>
                        Diag: <em>{provisionalDiag || "Not recorded"}</em>
                      </div>
                      <div className={styles.triageAcuityTags}>
                        {riskFlags.aggression && (
                          <span className={styles.acuityRiskBadge} data-risk="high">
                            Aggression Risk
                          </span>
                        )}
                        {riskFlags.suicide && (
                          <span className={styles.acuityRiskBadge} data-risk="high">
                            Suicide / Self-Harm Risk
                          </span>
                        )}
                        {riskFlags.absconding && (
                          <span
                            className={styles.acuityRiskBadge}
                            data-risk={currentPatient.legalStatus.startsWith("Form") ? "high" : "medium"}
                          >
                            Absconding Risk
                          </span>
                        )}
                        {riskFlags.vulnerable && (
                          <span className={styles.acuityRiskBadge} data-risk="medium">
                            Vulnerable
                          </span>
                        )}
                        {riskFlags.medical && (
                          <span className={styles.acuityRiskBadge} data-risk="medium">
                            Medical
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3. Bed Compatibility */}
                  <div className={`${styles.triagePriorityCard} ${styles.bedCompatibilityPillar}`}>
                    <div className={styles.triagePillarHead}>
                      <span className={styles.triagePillarTitle}>
                        <Lock aria-hidden="true" style={{ width: 13, height: 13 }} />
                        <span>Bed Compatibility</span>
                      </span>
                      <span className={styles.triagePillarBadge} data-tone={security === "Secure" ? "warn" : "default"}>
                        {security} Unit
                      </span>
                    </div>
                    <div className={styles.triagePillarBody}>
                      <div className={styles.triagePillarPrimary}>
                        {currentPatient.cohort} · {security} Ward
                      </div>
                      <div className={styles.triageCompatSub}>Origin: {currentPatient.origin.split("·")[0].trim()}</div>
                      <div className={styles.triageBedAvailability}>
                        <span className={styles.triageBedCount}>{bedPillText}</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Pre-Admission Medical Clearance Checkpoint */}
                  <div
                    className={`${styles.triagePriorityCard} ${styles.medicalClearancePillar}`}
                    data-testid="ward-referral-medical-clearance-card"
                  >
                    <div className={styles.triagePillarHead}>
                      <span className={styles.triagePillarTitle}>
                        <ShieldCheck aria-hidden="true" style={{ width: 13, height: 13 }} />
                        <span>Medical Clearance</span>
                      </span>
                      <span
                        className={styles.triagePillarBadge}
                        data-tone={isMedicalCleared ? "good" : "warn"}
                        data-testid="ward-referral-clearance-status"
                      >
                        {isMedicalCleared ? "Cleared" : "Pending"}
                      </span>
                    </div>
                    <div className={styles.triagePillarBody}>
                      <div className={styles.triagePillarPrimary}>
                        {isMedicalCleared ? "Fit for Admission & Travel" : "Awaiting Medical Signoff"}
                      </div>
                      <div className={styles.triageCompatSub}>
                        {isMedicalCleared ? "Signed off for inpatient transfer" : "Pre-admission medical exam required"}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className={styles.medicalClearanceToggleBtn}
                          data-cleared={isMedicalCleared}
                          data-testid="ward-referral-medical-clearance-toggle"
                          onClick={handleToggleMedicalClearance}
                        >
                          {isMedicalCleared ? "✓ Medical Cleared (Toggle)" : "○ Mark Medically Cleared"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <CatchmentSection
              suggestion={autoClinic}
              confirmedClinic={confirmedClinic}
              confirmed={catchmentConfirmed}
              editing={catchmentEditing}
              query={catchmentQuery}
              choices={searchChoices}
              note={searchNote}
              onConfirmSuggestion={() => confirmCatchment(autoClinic ?? "", autoSuburb)}
              onChange={() => {
                setCatchmentEditing(true);
                setCatchmentConfirmed(false);
              }}
              onQuery={setCatchmentQuery}
              onPick={confirmCatchment}
            />
            {patientReady ? <DrawerNext onClick={() => goTo("referral")} /> : null}
          </div>
          <div id={`${sectionId}-referral`} className={styles.sectionPanel} hidden={activeSection !== "referral"}>
            {/* 2. STATUTORY LEGAL STATUS & PLACEMENT URGENCY */}
            <section className={styles.refCard}>
              <div className={styles.refCardHead}>
                <h3 className={styles.refCardTitle}>
                  <ShieldAlert aria-hidden="true" style={{ width: 13, height: 13 }} />
                  <span>2. Legal status &amp; Placement Urgency</span>
                </h3>
                <span className="badgePill">WA Recorded forms Compliance</span>
              </div>
              <p className={styles.refCardSubtitle}>
                Statutory orders establish mandatory examination timelines, escort authority, and locked ward criteria.
              </p>

              <div className={styles.fieldGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="refLegalSelect">
                    <span>Legal status</span>
                    <span className={styles.fieldLabelHint}>Mandatory Order</span>
                  </label>
                  <select
                    className={styles.fieldSelect}
                    id="refLegalSelect"
                    value={legalStatus}
                    onChange={(e) => setLegalStatus(e.target.value)}
                  >
                    {/* The record's own status stays selectable even when it is not one of the usual
                      choices, so the select never shows a different status from the one recorded. */}
                    {legalStatus !== "Voluntary" &&
                    !LEGAL_STATUS_FORM_CODES.some((code) => legalStatus === `Form ${code}`) ? (
                      <option value={legalStatus}>
                        {legalStatus.startsWith("Form ") ? legalStatusOptionLabel(legalStatus.slice(5)) : legalStatus}
                      </option>
                    ) : null}
                    {LEGAL_STATUS_FORM_CODES.map((code) => (
                      <option key={code} value={`Form ${code}`}>
                        {legalStatusOptionLabel(code)}
                      </option>
                    ))}
                    <option value="Voluntary">Voluntary</option>
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="refUrgencySelect">
                    <span>Clinical Urgency Horizon</span>
                    <span className={styles.fieldLabelHint}>Recorded tier</span>
                  </label>
                  <select
                    className={styles.fieldSelect}
                    id="refUrgencySelect"
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                  >
                    {urgency === "" ? <option value="">Not recorded</option> : null}
                    {URGENCY_LEVELS.map((level) => (
                      <option key={level} value={String(level)}>
                        {urgencyTierLabel(level)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="refDestTypeSelect">
                    <span>Placement Destination Tier</span>
                    <span className={styles.fieldLabelHint}>Care Pathway</span>
                  </label>
                  <select
                    className={styles.fieldSelect}
                    id="refDestTypeSelect"
                    value={destType}
                    onChange={(e) => setDestType(e.target.value)}
                  >
                    <option value="ward">Inpatient Acute Psychiatric Ward Bed</option>
                    <option value="community">Community Mental Health Team (CMHT Assertive Transfer)</option>
                    <option value="ed">Specialist ED Mental Health Observation Unit</option>
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="refSecuritySelect">
                    <span>Security Level Requirement</span>
                    <span className={styles.fieldLabelHint}>Ward Physicality</span>
                  </label>
                  <select
                    className={styles.fieldSelect}
                    id="refSecuritySelect"
                    value={security}
                    onChange={(e) => setSecurity(e.target.value)}
                  >
                    <option value="Secure">Secure Unit (Locked High-Dependency Bay)</option>
                    <option value="Open">Open Acute Ward (Standard Observation Bay)</option>
                  </select>
                </div>
              </div>
            </section>
            <ReferringSourceSection
              setting={referringSetting}
              service={referringService}
              services={sourceServices}
              homeRegion={homeRegion}
              originSiteCode={originSiteCode}
              sites={wardSites.map((site) => ({ code: site.code, name: site.name }))}
              ageBand={ageBand}
              onSetting={chooseSetting}
              onService={chooseService}
              onHomeRegion={setHomeRegion}
              onOriginSite={setOriginSiteCode}
              onAgeBand={setAgeBand}
            />
            <ClinicalPresentationSection
              diagnosis={provisionalDiag}
              story={clinicalSummary}
              riskFlags={riskFlags}
              onDiagnosis={setProvisionalDiag}
              onStory={setClinicalSummary}
              onToggleRisk={toggleRisk}
            />
            {referralReady ? <DrawerNext onClick={() => goTo("documentation")} /> : null}
          </div>
          <div
            id={`${sectionId}-documentation`}
            className={styles.sectionPanel}
            hidden={activeSection !== "documentation"}
          >
            <DocumentationSection
              clearance={clearanceAnswer}
              clearanceWhen={clearanceWhen}
              clearanceName={clearanceName}
              clearanceNumber={clearanceNumber}
              triageRamp={triageRamp}
              medicationAttached={medicationChartAttached}
              observationAttached={observationChartAttached}
              anythingElse={anythingElse}
              anythingElseNote={anythingElseNote}
              serviceLabel={serviceLabel}
              role={referrerRole}
              onClearance={markClearance}
              onClearanceWhen={setClearanceWhen}
              onClearanceName={setClearanceName}
              onClearanceNumber={setClearanceNumber}
              onTriageRamp={setTriageRamp}
              onMedicationFile={() => setMedicationChartAttached(true)}
              onObservationFile={() => setObservationChartAttached(true)}
              onAnythingElse={setAnythingElse}
              onAnythingElseNote={setAnythingElseNote}
              onRole={setReferrerRole}
            />
            {documentationReady ? <DrawerNext onClick={() => goTo("locations")} /> : null}
          </div>
          <div id={`${sectionId}-locations`} className={styles.sectionPanel} hidden={activeSection !== "locations"}>
            <LocationsSection
              units={capacityRecords}
              waitlistByUnit={waitlistByUnit}
              clinic={confirmedClinic}
              selectedUnitIds={selectedUnitIds}
              onToggleUnit={toggleUnit}
              departments={departments.map((department) => ({ id: department.id, name: department.name }))}
              selectedEdId={selectedEdId}
              onSelectEd={chooseEd}
              teams={teamOptions}
              selectedTeam={selectedTeam}
              onSelectTeam={chooseTeam}
              atCap={atCap}
              summary={summary}
              onOpenSend={() => {
                setCallbackLocation(serviceLabel);
                setContactOpen(true);
              }}
              arrival={
                liveMovement && canSetArrivalPlan(liveMovement) ? (
                  <section className={styles.refCard} data-testid="ward-referral-arrival-plan-card">
                    <div className={styles.refCardHead}>
                      <h3 className={styles.refCardTitle}>
                        <Clock aria-hidden="true" style={{ width: 14, height: 14 }} />
                        <span>Arrival plan</span>
                      </h3>
                    </div>
                    <div className={styles.arrivalPlanCard}>
                      {liveMovement.arrivalDetails ? (
                        <ul className={styles.arrivalPlanFacts}>
                          <li>Mode: {arrivalModeLabel(liveMovement.arrivalDetails.mode)}</li>
                          <li>Tracking: {liveMovement.arrivalDetails.trackingNumber ?? "Not recorded"}</li>
                          <li>
                            Estimated ward time: {arrivalEtaLabel(liveMovement.arrivalDetails.estimatedArrivalAt, now)}{" "}
                            AWST
                          </li>
                        </ul>
                      ) : (
                        <p className={styles.plainCopy}>
                          No arrival plan recorded. Setting one records how they are arriving and the estimated ward
                          time.
                        </p>
                      )}
                      {isArrivalLate(liveMovement, now) ? (
                        <p className={styles.arrivalLate} role="status" data-testid="ward-referral-arrival-late">
                          Arrival late — more than {LATE_ARRIVAL_GRACE_MINUTES} minutes past the estimated ward time.
                          Not marked arrived.
                        </p>
                      ) : null}
                      <div className={styles.arrivalPlanAction}>
                        <button
                          type="button"
                          className={styles.patientChipBtn}
                          data-testid="ward-referral-arrival-plan-toggle"
                          onClick={() => setArrivalPlanOpen(true)}
                        >
                          {liveMovement.arrivalDetails ? "Edit arrival plan" : "Set arrival plan"}
                        </button>
                      </div>
                    </div>
                  </section>
                ) : null
              }
              contact={
                contactOpen ? (
                  <SendContactDialog
                    phone={callbackPhone}
                    email={callbackEmail}
                    role={referrerRole}
                    location={callbackLocation}
                    canSend={callbackReady}
                    onPhone={setCallbackPhone}
                    onEmail={setCallbackEmail}
                    onRole={setReferrerRole}
                    onLocation={setCallbackLocation}
                    onSend={handleDispatch}
                    onCancel={() => setContactOpen(false)}
                  />
                ) : null
              }
            />
          </div>
        </div>
        {/* 6. SEND REFERRAL STICKY ACTION FOOTER */}
        <div className={styles.sendReferralFoot}>
          <div className={styles.sendActionCluster}>
            <button type="button" className={styles.btnCancelReferral} onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
      {liveMovement ? (
        <ArrivalTimeModal
          isOpen={arrivalPlanOpen}
          onClose={() => setArrivalPlanOpen(false)}
          movement={liveMovement}
          role={arrivalRole}
        />
      ) : null}
    </>
  );
}
