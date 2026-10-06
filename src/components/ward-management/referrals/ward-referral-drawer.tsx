"use client";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Ambulance,
  ArrowRight,
  Clock,
  Lock,
  MapPin,
  Plus,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState, useId, useEffect, useMemo, useRef, useCallback } from "react";

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
  URGENCY_LEVELS,
  type Cohort,
  type HealthService,
  type Movement,
  type Referral,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { patientAgeYears, type Patient } from "@/components/ward-management/ward-patients";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
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

function transportLabel(code: string): string {
  switch (code) {
    case "mht":
      return "Mental Health Transport (Contracted MHT)";
    case "police":
      return "Police Escort (WAPOL Transit)";
    case "rfds":
      return "RFDS Aeromedical Flight Escort";
    case "stjohn":
      return "St John Ambulance (Priority 2 Escort)";
    case "carer":
      return "Patient / Carer Accompanied Transport";
    default:
      return "Mental Health Transport";
  }
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
  const [activeSection, setActiveSection] = useState<"patient" | "referral" | "clinical" | "placement">("patient");
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionId = useId();
  const [selectedDestUnitId, setSelectedDestUnitId] = useState<string | null>(null);
  const [expandedGates, setExpandedGates] = useState<Record<string, boolean>>({});
  function toggleGates(unitId: string) {
    setExpandedGates((prev) => ({ ...prev, [unitId]: !prev[unitId] }));
  }

  const { movements, patients, referrals, dayZero, dispatch } = useWardFlow();
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
  const [doctorNote, setDoctorNote] = useState(defaultPatient.doctorNote);
  const [clinicalSummary, setClinicalSummary] = useState(defaultPatient.clinicalSummary);
  const [transport, setTransport] = useState(defaultPatient.transportVal);
  const [transitNote, setTransitNote] = useState(defaultPatient.transitNote);
  const [riskFlags, setRiskFlags] = useState<Record<string, boolean>>(defaultPatient.riskFlags);

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
    setSelectedDestUnitId(null);
    setArrivalPlanOpen(false);

    // Synchronize all form fields with selected patient profile
    const baseLegal = p.legalStatus.startsWith("Form") ? p.legalStatus.split(" ").slice(0, 2).join(" ") : p.legalStatus;
    setLegalStatus(baseLegal);
    setUrgency(p.urgency);
    setDestType(p.destType);
    setSecurity(p.security.toLowerCase().includes("secure") ? "Secure" : "Open");
    setProvisionalDiag(p.provisionalDiag);
    setDoctorNote(p.doctorNote);
    setClinicalSummary(p.clinicalSummary);
    setTransport(p.transportVal);
    setTransitNote(p.transitNote);
    setRiskFlags(p.riskFlags);

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

  // Real-time capacity match & consequence derivation bound to live capacity records
  const realTimeMatch = useMemo(() => {
    // The recorded urgency tier only (26 Sept 2026). The hour windows ("< 2 hours", "Active Breach")
    // were typed here with no source, and Ward Flow computes no placement deadline (legal D5).
    const recordedTier = URGENCY_LEVELS.find((level) => String(level) === urgency);
    const acuityTarget = recordedTier === undefined ? "not recorded" : urgencyTierLabel(recordedTier);
    // The catchment and suburb come from the person's record; a made-up "South Metropolitan" or
    // "Metropolitan" used to stand in when it held none.
    const catchmentTitle = currentPatient.catchment
      ? `${currentPatient.catchment} Catchment`
      : "Catchment not recorded";

    if (destType === "community") {
      return {
        pillText: "Community Transfer",
        pillTone: "south" as const,
        targetDestination: "Catchment Community Mental Health Team",
        catchmentTitle,
        consequences: [
          `Routing to: Catchment Community Mental Health Team (${currentPatient.suburb ? `${currentPatient.suburb} catchment` : "suburb not recorded"})`,
          `Statutory Invariant: A bed request and a community referral cannot travel together.`,
          `Order status: Non-inpatient community follow-up and assertive outreach under ${legalStatus}.`,
          `Transport Logistics: ${transportLabel(transport)} — community clinic appointment notified.`,
        ],
      };
    }

    if (destType === "ed") {
      // Ward Flow holds no emergency department observation beds. "1 Bed Ready" and an observation
      // unit at every department used to be typed in here (25 September 2026 audit, A6).
      const edName = currentPatient.origin.split("·")[0].trim();
      return {
        pillText: "Observation beds not recorded",
        pillTone: "muted" as const,
        targetDestination: edName,
        catchmentTitle,
        consequences: [
          `Placement candidate: ${currentPatient.name} (${ageSexLabel(currentPatient)} · Observation Tier)`,
          `Current Origin: ${currentPatient.origin}`,
          `Recorded urgency: ${acuityTarget}.`,
          `Eligible Bays: observation beds are not recorded in Ward Flow.`,
        ],
      };
    }

    // Acute Inpatient Ward Bed dynamically bound to live capacity records
    const patientCohort = currentPatient.cohort;

    const matchingRecords = capacityRecords.filter((r) => r.cohort === patientCohort && r.security === security);

    const readyBedsCount = matchingRecords.reduce((sum, r) => sum + r.readyBeds, 0);
    const pulledBedsCount = matchingRecords.reduce((sum, r) => sum + r.pulledBeds, 0);
    const closedBedsCount = matchingRecords.reduce((sum, r) => sum + r.closedBeds, 0);
    // Owner ruling, 2026-09-05. `readyBedsCount` deliberately subtracts NOTHING for this:
    // a ward's figure must not lurch as cleaning starts and stops. The number stays; the
    // sentence beside it is what was missing here.
    const pendingPreparationCount = matchingRecords.reduce((sum, r) => sum + (r.pendingPreparation ?? 0), 0);
    const pillText = `${readyBedsCount} Bed${readyBedsCount === 1 ? "" : "s"} Ready · ${pulledBedsCount} Pulled · ${closedBedsCount} Closed`;
    const pillTone = readyBedsCount > 0 ? ("good" as const) : ("danger" as const);

    const sortedUnits = [...matchingRecords].sort((a, b) => {
      const aMatch =
        a.healthService && currentPatient.catchment?.toLowerCase().includes(a.healthService.toLowerCase()) ? 1 : 0;
      const bMatch =
        b.healthService && currentPatient.catchment?.toLowerCase().includes(b.healthService.toLowerCase()) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return b.readyBeds - a.readyBeds;
    });

    const bestUnit = sortedUnits[0];
    const targetDestination = bestUnit
      ? `${bestUnit.hospital} ${bestUnit.name} (${bestUnit.readyBeds} Bed${bestUnit.readyBeds === 1 ? "" : "s"} Ready)`
      : `${patientCohort} ${security} Unit`;

    const eligibleWards =
      sortedUnits
        .slice(0, 3)
        .map((u) => `${u.name} (${u.readyBeds} bed${u.readyBeds === 1 ? "" : "s"} ready)`)
        .join(" · ") || "No eligible beds currently open";

    return {
      pillText,
      pillTone,
      pendingPreparationCount,
      targetDestination,
      sortedUnits,
      catchmentTitle,
      consequences: [
        `Placement candidate: ${currentPatient.name} (${ageSexLabel(currentPatient)} · ${security} Unit)`,
        `Current Origin: ${currentPatient.origin}`,
        `Recorded urgency: ${acuityTarget}.`,
        `Authorized Escort: ${transportLabel(transport)} · Destination: ${targetDestination}`,
        `Eligible Wards: ${eligibleWards}`,
      ],
    };
  }, [destType, security, legalStatus, urgency, transport, currentPatient, capacityRecords]);

  const effectiveDestination = useMemo(() => {
    if (destType === "ward" && selectedDestUnitId && realTimeMatch.sortedUnits) {
      const matched = realTimeMatch.sortedUnits.find((u) => u.unitId === selectedDestUnitId);
      if (matched) {
        return `${matched.hospital} ${matched.name} (${matched.readyBeds} Bed${matched.readyBeds === 1 ? "" : "s"} Ready)`;
      }
    }
    return realTimeMatch.targetDestination;
  }, [destType, selectedDestUnitId, realTimeMatch.sortedUnits, realTimeMatch.targetDestination]);

  function handleDispatch() {
    announceToWardShell("Sending the referral is not wired in this prototype.");
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
              ["clinical", "Clinical", Activity],
              ["placement", "Placement", MapPin],
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
                        <span className={styles.triageBedCount}>{realTimeMatch.pillText}</span>
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

            {liveMovement && canSetArrivalPlan(liveMovement) ? (
              <section className={styles.refCard} data-testid="ward-referral-arrival-plan-card">
                <div className={styles.refCardHead}>
                  <h3 className={styles.refCardTitle}>
                    <Clock aria-hidden="true" style={{ width: 14, height: 14 }} />
                    <span>Arrival plan</span>
                  </h3>
                  <span className="badgePill">Ward ETA</span>
                </div>
                <div className={styles.arrivalPlanCard}>
                  {liveMovement.arrivalDetails ? (
                    <ul className={styles.arrivalPlanFacts}>
                      <li>Mode: {arrivalModeLabel(liveMovement.arrivalDetails.mode)}</li>
                      <li>Tracking: {liveMovement.arrivalDetails.trackingNumber ?? "Not recorded"}</li>
                      <li>
                        Estimated ward time: {arrivalEtaLabel(liveMovement.arrivalDetails.estimatedArrivalAt, now)} AWST
                      </li>
                    </ul>
                  ) : (
                    <p className={styles.refCardSubtitle}>
                      No arrival plan recorded. Setting one records how they are arriving and the estimated ward time,
                      and clears the pull clock.
                    </p>
                  )}
                  {isArrivalLate(liveMovement, now) ? (
                    <p
                      className={styles.arrivalLate}
                      role="status"
                      data-testid="ward-referral-arrival-late"
                      title={OPERATIONAL_DEFAULT_LABEL}
                    >
                      Arrival late — more than {LATE_ARRIVAL_GRACE_MINUTES} minutes past the estimated ward time. Not
                      marked arrived.
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
            ) : null}
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
          </div>
          <div id={`${sectionId}-clinical`} className={styles.sectionPanel} hidden={activeSection !== "clinical"}>
            {/* 3. CLINICAL PRESENTATION & DIAGNOSTIC DOSSIER */}
            <section className={styles.refCard}>
              <div className={styles.refCardHead}>
                <h3 className={styles.refCardTitle}>
                  <Activity aria-hidden="true" style={{ width: 14, height: 14 }} />
                  <span>3. Clinical Presentation &amp; Diagnostic Dossier</span>
                </h3>
                <span className="badgePill">Clinical Assessment</span>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="refDiagSelect">
                    <span>Provisional Psychiatric Diagnosis</span>
                    <span className={styles.fieldLabelHint}>Primary Impairment</span>
                  </label>
                  <select
                    className={styles.fieldSelect}
                    id="refDiagSelect"
                    value={provisionalDiag}
                    onChange={(e) => setProvisionalDiag(e.target.value)}
                  >
                    <option value="">Not recorded</option>
                    <option value="psychosis">Schizophreniform Disorder / Acute Psychotic Episode</option>
                    <option value="bipolar">Bipolar I Disorder · Acute Mania with Psychosis</option>
                    <option value="depression">Major Depressive Episode · Severe with Suicide Risk</option>
                    <option value="delirium">Delirium / Organic Mental Disorder</option>
                    <option value="substance">Substance-Induced Psychotic Disorder</option>
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="refDocInput">
                    <span>Referring Clinician &amp; Origin Unit</span>
                    <span className={styles.fieldLabelHint}>AHPRA Practitioner</span>
                  </label>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    id="refDocInput"
                    value={doctorNote}
                    onChange={(e) => setDoctorNote(e.target.value)}
                    data-gramm="false"
                    data-enable-grammarly="false"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="refSummaryText">
                  <span>Mental State Examination &amp; Presentation Summary</span>
                  <span className={styles.fieldLabelHint}>Clinical Narrative</span>
                </label>
                <textarea
                  className={styles.clinicalTextarea}
                  id="refSummaryText"
                  rows={3}
                  value={clinicalSummary}
                  onChange={(e) => setClinicalSummary(e.target.value)}
                  data-gramm="false"
                  data-enable-grammarly="false"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>

              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel} id="riskFlagsLabel">
                  <span>Active Behavioural &amp; Clinical Risk Flags</span>
                  <span className={styles.fieldLabelHint}>Select all active</span>
                </div>
                <div className={styles.riskTagGrid} role="group" aria-labelledby="riskFlagsLabel">
                  <button
                    type="button"
                    className={styles.riskTagChip}
                    data-checked={riskFlags.aggression}
                    onClick={() => toggleRisk("aggression")}
                  >
                    <AlertTriangle aria-hidden="true" style={{ width: 13, height: 13 }} />
                    <span>Aggression Risk</span>
                  </button>
                  <button
                    type="button"
                    className={styles.riskTagChip}
                    data-checked={riskFlags.absconding}
                    onClick={() => toggleRisk("absconding")}
                  >
                    <ArrowRight aria-hidden="true" style={{ width: 13, height: 13 }} />
                    <span>Absconding Risk</span>
                  </button>
                  <button
                    type="button"
                    className={styles.riskTagChip}
                    data-checked={riskFlags.medical}
                    onClick={() => toggleRisk("medical")}
                  >
                    <Activity aria-hidden="true" style={{ width: 13, height: 13 }} />
                    <span>Acute Medical Comorbidity</span>
                  </button>
                  <button
                    type="button"
                    className={styles.riskTagChip}
                    data-checked={riskFlags.vulnerable}
                    onClick={() => toggleRisk("vulnerable")}
                  >
                    <ShieldAlert aria-hidden="true" style={{ width: 13, height: 13 }} />
                    <span>Vulnerable Adult Protection</span>
                  </button>
                  <button
                    type="button"
                    className={styles.riskTagChip}
                    data-checked={riskFlags.suicide}
                    onClick={() => toggleRisk("suicide")}
                  >
                    <AlertCircle aria-hidden="true" style={{ width: 13, height: 13 }} />
                    <span>Suicide / Self-Harm Vigilance</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
          <div id={`${sectionId}-placement`} className={styles.sectionPanel} hidden={activeSection !== "placement"}>
            {/* 4. AUTHORIZED TRANSPORT & ESCORT LOGISTICS */}
            <section className={styles.refCard}>
              <div className={styles.refCardHead}>
                <h3 className={styles.refCardTitle}>
                  <Ambulance aria-hidden="true" style={{ width: 14, height: 14 }} />
                  <span>4. Authorized Transport &amp; Escort Logistics</span>
                </h3>
                <span className="badgePill">Escort Authority</span>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="refTransportSelect">
                    <span>Authorized Transport Provider</span>
                    <span className={styles.fieldLabelHint}>Escort Tier</span>
                  </label>
                  <select
                    className={styles.fieldSelect}
                    id="refTransportSelect"
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                  >
                    <option value="mht">Mental Health Transport Service (Contracted MHT)</option>
                    <option value="police">Police Escort (WAPOL Involuntary Transit)</option>
                    <option value="rfds">RFDS Aeromedical Flight Escort</option>
                    <option value="stjohn">St John Ambulance (Priority 2 Clinical Escort)</option>
                    <option value="carer">Patient / Carer Accompanied Transport</option>
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="refTransitInput">
                    <span>Dispatch Reference / Staging Bay</span>
                    <span className={styles.fieldLabelHint}>Transport Coordination</span>
                  </label>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    id="refTransitInput"
                    value={transitNote}
                    onChange={(e) => setTransitNote(e.target.value)}
                    data-gramm="false"
                    data-enable-grammarly="false"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
              </div>
            </section>

            {/* 5. REAL-TIME INPATIENT CAPACITY MATCH */}
            <section className={styles.refCard}>
              <div className={styles.refCardHead}>
                <h3 className={styles.refCardTitle}>
                  <Users aria-hidden="true" style={{ width: 14, height: 14 }} />
                  <span>5. Real-Time Inpatient Capacity Match</span>
                </h3>
                <span
                  className="badgePill"
                  style={{
                    color:
                      realTimeMatch.pillTone === "south"
                        ? "var(--svc-south)"
                        : realTimeMatch.pillTone === "muted"
                          ? "var(--muted)"
                          : "var(--good)",
                    fontWeight: 700,
                  }}
                >
                  {realTimeMatch.pillText}
                </span>
              </div>
              {/*
            Its OWN block, never appended to the pill above. `ward-screen.tsx` found in a browser
            that "Ready 2" immediately followed by "1 still being made ready" reads as 21. Renders
            only when there is one: an absence here is silence, never a "0 being made ready", which
            would be a claim nobody made. Wording copied verbatim from `ward-board.tsx` rather than
            written again - four screens stating one clinical fact should state it identically.
          */}
              {(realTimeMatch.pendingPreparationCount ?? 0) > 0 ? (
                <p className={styles.beingMadeReady} data-testid="referral-drawer-pending-preparation">
                  {realTimeMatch.pendingPreparationCount} of them{" "}
                  {realTimeMatch.pendingPreparationCount === 1 ? "is" : "are"} still being made ready - the bed stays
                  offered and stays counted, but the ward cannot admit into it yet.
                </p>
              ) : null}

              {/* Destination Rows with Distinct Card Borders & Status Indicators (Alternative 2 3-Tier Status Matrix) */}
              <div className={styles.destinationList} role="list" aria-label="Placement Destination Options">
                {destType === "ward" && realTimeMatch.sortedUnits && realTimeMatch.sortedUnits.length > 0 ? (
                  (() => {
                    const tier1Units = realTimeMatch.sortedUnits.filter((u) => u.readyBeds > 0);
                    const tier2Units = realTimeMatch.sortedUnits.filter((u) => u.readyBeds === 0);

                    const renderUnitCard = (u: WardCapacityRecord, isTier1: boolean) => {
                      const isSelected = (selectedDestUnitId ?? realTimeMatch.sortedUnits?.[0]?.unitId) === u.unitId;
                      const isGateExpanded = expandedGates[u.unitId] ?? false;

                      return (
                        <div
                          key={u.unitId}
                          role="listitem"
                          className={`${styles.destinationRowCard} ${isTier1 ? styles.destinationRowCardReady : styles.destinationRowCardTurnaround}`}
                          data-selected={isSelected}
                          onClick={() => setSelectedDestUnitId(u.unitId)}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedDestUnitId(u.unitId);
                            }
                          }}
                        >
                          <div className={styles.destRowMain}>
                            <div className={styles.destRowHeader}>
                              <span
                                className={styles.destStatusIndicator}
                                data-available={u.readyBeds > 0}
                                aria-hidden="true"
                              />
                              <span className={styles.destRowHospital}>{u.hospital}</span>
                              <span className={styles.destAllocationId}>{u.unitId}</span>
                            </div>
                            <div className={styles.destRowUnitName}>{u.name}</div>
                            <div className={styles.destRowTags}>
                              <span className={styles.destTag}>{u.healthService}</span>
                              <span className={styles.destTag}>{u.cohort}</span>
                              <span className={styles.destTag}>{u.security} Unit</span>
                            </div>
                          </div>

                          <div className={styles.destRowCapacity}>
                            <div className={styles.destBedCountGroup}>
                              <span className={styles.destReadyCount} data-has-beds={u.readyBeds > 0}>
                                <strong>{u.readyBeds}</strong> Ready
                              </span>
                              <span className={styles.destHeldCount}>
                                <strong>{u.pulledBeds}</strong> Pulled
                              </span>
                              <span className={styles.destHeldCount}>
                                <strong>{u.closedBeds}</strong> Closed
                              </span>
                            </div>
                            {(u.pendingPreparation ?? 0) > 0 ? (
                              <span className={styles.destPrepBadge}>{u.pendingPreparation} cleaning</span>
                            ) : null}
                            <span className={styles.destSelectIndicator}>
                              {isSelected ? "Selected Target" : "Select Target"}
                            </span>
                          </div>

                          {/* Interactive Criteria Gate Dropdown */}
                          <div className={styles.gateSummary} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className={`${styles.gateToggle} ${isTier1 ? "" : styles.gateToggleWarn}`}
                              onClick={() => toggleGates(u.unitId)}
                              aria-expanded={isGateExpanded}
                            >
                              <span>
                                {isTier1
                                  ? "✓ 10/10 Statutory & Clinical Criteria Met"
                                  : "✓ 10/10 Clinical Criteria Met · Bed Turnaround in Progress"}
                              </span>
                              <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                                {isGateExpanded ? "▲ Hide Verification Gates" : "▼ Show Verification Gates"}
                              </span>
                            </button>
                            {isGateExpanded ? (
                              <div className={styles.gateGrid}>
                                <div className={styles.gatePillPassed}>
                                  ✓ Age Cohort: {u.cohort} (Patient is {ageSexLabel(currentPatient)})
                                </div>
                                <div className={styles.gatePillPassed}>✓ Legal Status: {legalStatus} Permitted</div>
                                <div className={styles.gatePillPassed}>
                                  ✓ Clinical Acuity: {u.security} Unit Appropriate
                                </div>
                                <div className={styles.gatePillPassed}>✓ Gender Designation: Ensuite Bed Ready</div>
                                <div className={isMedicalCleared ? styles.gatePillPassed : styles.gatePillPending}>
                                  {isMedicalCleared
                                    ? "✓ Medical Clearance: Affirmed (ECG & Labs Clear)"
                                    : "⏳ Medical Clearance: Pending MO Signoff"}
                                </div>
                                <div className={styles.gatePillPassed}>✓ Security Assessment: Non-Forensic Case</div>
                                <div className={styles.gatePillPassed}>
                                  ✓ Catchment Agreement: {u.healthService ?? "Metro Reciprocal"} Active
                                </div>
                                <div className={styles.gatePillPassed}>
                                  ✓ Nursing Ratio: Standard Acute (No 1:1 Special Order)
                                </div>
                                <div className={styles.gatePillPassed}>
                                  ✓ Physical Mobility: Ground Floor Direct Access
                                </div>
                                <div className={isTier1 ? styles.gatePillPassed : styles.gatePillPending}>
                                  {isTier1
                                    ? "✓ Bed Availability: Ready to Admit"
                                    : "⏳ Bed Status: Awaiting Bed Turnover"}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <>
                        {tier1Units.length > 0 ? (
                          <div className={styles.tierSection}>
                            <div className={`${styles.secHeader} ${styles.secHeaderGood}`}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span className={`${styles.pulseDot} ${styles.pulseDotGood}`} />
                                <span>TIER 1: READY TO PLACE NOW (IMMEDIATE CONFIRMED VACANCIES)</span>
                              </div>
                              <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                                {tier1Units.length} Available
                              </span>
                            </div>
                            {tier1Units.map((u) => renderUnitCard(u, true))}
                          </div>
                        ) : null}

                        {tier2Units.length > 0 ? (
                          <div className={styles.tierSection}>
                            <div className={`${styles.secHeader} ${styles.secHeaderWarn}`}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span className={styles.pulseDot} />
                                <span>TIER 2: SUITABLE COHORT · AWAITING DISCHARGE TURNAROUND</span>
                              </div>
                              <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                                {tier2Units.length} Units Full
                              </span>
                            </div>
                            {tier2Units.map((u) => renderUnitCard(u, false))}
                          </div>
                        ) : null}
                      </>
                    );
                  })()
                ) : destType === "community" ? (
                  <div className={styles.destinationRowCard} data-selected={true}>
                    <div className={styles.destRowMain}>
                      <div className={styles.destRowHeader}>
                        <span className={styles.destStatusIndicator} data-available={true} aria-hidden="true" />
                        <span className={styles.destRowHospital}>Catchment CMHT</span>
                        <span className={styles.destAllocationId}>cmht-outreach</span>
                      </div>
                      <div className={styles.destRowUnitName}>Community Mental Health Team</div>
                      <div className={styles.destRowTags}>
                        <span className={styles.destTag}>{currentPatient.catchment || "South Metropolitan"}</span>
                        <span className={styles.destTag}>Assertive Outreach</span>
                      </div>
                    </div>
                    <div className={styles.destRowCapacity}>
                      <span className={styles.destReadyCount} data-has-beds={true}>
                        <strong>Community</strong> Transfer
                      </span>
                      <span className={styles.destSelectIndicator}>Active Route</span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.destinationRowCard} data-selected={true}>
                    <div className={styles.destRowMain}>
                      <div className={styles.destRowHeader}>
                        <span className={styles.destStatusIndicator} data-available={true} aria-hidden="true" />
                        <span className={styles.destRowHospital}>{currentPatient.origin.split("·")[0].trim()}</span>
                        <span className={styles.destAllocationId}>ed-obs-tier</span>
                      </div>
                      <div className={styles.destRowUnitName}>Specialist ED Mental Health Observation Unit</div>
                      <div className={styles.destRowTags}>
                        <span className={styles.destTag}>Observation Tier</span>
                        <span className={styles.destTag}>Rapid Stabilization</span>
                      </div>
                    </div>
                    <div className={styles.destRowCapacity}>
                      <span className={styles.destReadyCount} data-has-beds={true}>
                        <strong>1 Bed</strong> Ready
                      </span>
                      <span className={styles.destSelectIndicator}>Active Route</span>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.consequenceCard}>
                <div className={styles.cqHeader}>
                  <span>Matching Inpatient Capacity in Catchment</span>
                  <span className="badgePill" style={{ color: "var(--accent)", fontWeight: 600 }}>
                    {realTimeMatch.catchmentTitle}
                  </span>
                </div>
                <ul className={styles.cqList}>
                  {realTimeMatch.consequences.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </div>
        {/* 6. SEND REFERRAL STICKY ACTION FOOTER */}
        <div className={styles.sendReferralFoot}>
          <div className={styles.sendTargetSummary}>
            <span className={styles.sendTargetLabel}>
              <MapPin aria-hidden="true" style={{ width: 14, height: 14 }} />
              <span>Destination preview · demo draft</span>
            </span>
            <span className={styles.sendTargetName}>{effectiveDestination}</span>
          </div>
          <div className={styles.sendActionCluster}>
            <button type="button" className={styles.btnCancelReferral} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnSendReferral}
              onClick={handleDispatch}
              title="Not wired in this prototype."
            >
              <Send aria-hidden="true" style={{ width: 15, height: 15 }} />
              <span>Send referral</span>
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
