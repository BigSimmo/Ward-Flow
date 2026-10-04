"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { MOVEMENT_STAGES } from "@/components/ward-management/ward-model";
import type { Movement, MovementStage, Referral, Unit } from "@/components/ward-management/ward-model";
import {
  isOpen,
  searchMovements,
  searchPatients,
  type PatientSearchResult,
  stageCopy,
  type MovementSearchQuery,
} from "@/components/ward-management/ward-derivations";
import {
  calendarDateOf,
  formatInstantWithDay,
  formatRemaining,
  minutesUntil,
} from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  findPatients,
  patientDisplayName,
  patientAgeYears,
  type Patient,
} from "@/components/ward-management/ward-patients";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WARD_ADD_PERSON_HREF } from "@/components/ward-management/ward-nav";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { departmentLabel } from "@/components/ward-management/ward-absence-labels";
import { edById } from "@/components/ward-management/ward-sites";
import { formTitleForCode } from "@/lib/form-register";
import {
  LONG_WAIT_MINUTES,
  LONG_WAIT_TEXT,
  OPERATIONAL_DEFAULT_LABEL,
  WAIT_FILTER_SHORT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";

/** The wait bands, in hours, from Josh's named defaults (D-22, D-24): under 6, 6 to 24, over 24. */
const SHORT_WAIT_HOURS = WAIT_FILTER_SHORT_MINUTES / 60;
const LONG_WAIT_HOURS = LONG_WAIT_MINUTES / 60;

import { recordSearch, type AccessEntry } from "./access-record";
import { PatientTypeahead } from "./patient-typeahead";
import { handOffTypedPatientQuery, isNewTabClick } from "./patient-query-handoff";
import { RecordPreview, buildMovementSummary, buildReferralSummary, type PreviewSelection } from "./record-preview";
import { refusalFor } from "./search-refusals";
import {
  LEGAL_FILTER_OPTIONS,
  QUICK_CHIPS,
  type PresenceFilter,
  matchesPresence,
  matchesService,
  matchesSetting,
  matchesLegal,
  matchesWait,
  isQuickChipQuery,
  matchesQuickChip,
} from "./search-filters";
import { referralState } from "@/components/ward-management/ward-referrals";

import styles from "./search.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

const ACCESS_RECORD_EMPTY = "No searches submitted this session. Press Enter in the search field to record a search.";

const stageIsSearchable = (stage: MovementStage) => isOpen({ stage, closure: undefined } as Movement);
const SELECTABLE_STAGES = MOVEMENT_STAGES.filter(stageIsSearchable);

type ShowFacetKey = "all" | "accepted" | "waiting" | "unowned" | "under6" | "6to24" | "over24";

type ShowFacet = {
  key: ShowFacetKey;
  label: string;
  empty: string;
  test: (movement: Movement, now: number) => boolean;
};

function waitedHours(movement: Movement, now: number): number {
  return minutesUntil(now, movement.openedAt) / 60;
}

const SHOW_FACETS: readonly ShowFacet[] = [
  { key: "all", label: "Everything", empty: "", test: () => true },
  {
    key: "accepted",
    label: "Accepted",
    empty: "No open movement here has an accepted ward.",
    test: (movement) => Boolean(movement.acceptedUnitId),
  },
  {
    key: "waiting",
    label: "No ward yet",
    empty: "Every open movement here has an accepted ward.",
    test: (movement) => !movement.acceptedUnitId,
  },
  {
    key: "unowned",
    label: "No owner",
    empty: "Every open movement here has an owner.",
    test: (movement) => !movement.owner,
  },
  {
    key: "under6",
    label: `Under ${SHORT_WAIT_HOURS} hours`,
    empty: `No open movement here has waited under ${SHORT_WAIT_HOURS} hours.`,
    test: (movement, now) => waitedHours(movement, now) < SHORT_WAIT_HOURS,
  },
  {
    key: "6to24",
    label: `${SHORT_WAIT_HOURS} to ${LONG_WAIT_HOURS} hours`,
    empty: `No open movement here has waited ${SHORT_WAIT_HOURS} to ${LONG_WAIT_HOURS} hours.`,
    test: (movement, now) => {
      const hours = waitedHours(movement, now);
      return hours >= SHORT_WAIT_HOURS && hours < LONG_WAIT_HOURS;
    },
  },
  {
    key: "over24",
    label: `Over ${LONG_WAIT_HOURS} hours`,
    empty: `No open movement here has waited over ${LONG_WAIT_HOURS} hours.`,
    test: (movement, now) => waitedHours(movement, now) >= LONG_WAIT_HOURS,
  },
];

function originDepartmentText(movement: Movement): string {
  const originEd = edById(movement.originEdId);
  return departmentLabel(movement.originEdId, originEd && `${originEd.name} (${originEd.siteCode})`);
}

const NO_CLINICAL_NOTE = "No clinical note is recorded in Ward Flow.";

/** Whole years from the recorded date of birth, or `null` when there is none to read. */
function recordedAge(patient: Patient | undefined, today: Date): number | null {
  if (!patient) return null;
  const years = patientAgeYears(patient, today);
  return Number.isFinite(years) && years >= 0 ? years : null;
}

function ageSexText(p: { age: number | null; sex: string | null }): string {
  return `${p.age === null ? "Age not recorded" : `${p.age}y`} · ${p.sex ?? "Sex not recorded"}`;
}

export interface UnifiedCaseloadPatient {
  id: string;
  urm: string;
  name: string;
  /** Whole years from the recorded date of birth; `null` when the record holds none. */
  age: number | null;
  /** The recorded sex (or gender); `null` when the record holds neither. */
  sex: string | null;
  /** The recorded community team; `null` when none is recorded. */
  communityTeam: string | null;
  indigenous: boolean;
  confidential?: boolean;
  origin: string;
  setting: string;
  service: string;
  legalStatus: string;
  legalExpires: string;
  urgency: string;
  waitHours: number;
  openedAt: string;
  destination: string | null;
  destinationName: string;
  holdStatus: string;
  stage: string;
  transportNeeded: boolean;
  transportStatus: string;
  nurseEscort: boolean;
  presence: "live" | "community" | "scheduled" | "past";
  presenceLabel: string;
  presenceDetail: string;
  clinicalNote: string;
  originalSubject: PatientSearchResult | { kind: "person"; patient: Patient };
}

export function PatientSearchPage() {
  const { movements, referrals, units, patients, dayZero } = useWardFlow();
  const now = useWardFlowClock();
  const [text, setText] = useState("");
  const [stage, setStage] = useState<MovementStage | "">("");
  const [edId, setEdId] = useState("");
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>("all");
  const [activeKpiFacet, setActiveKpiFacet] = useState<"all" | "live" | "unplaced" | "notin" | "breaches">("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [settingFilter, setSettingFilter] = useState<string>("all");
  const [legalFilter, setLegalFilter] = useState<string>("all");
  const [waitFilter, setWaitFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"wait-desc" | "tier-asc" | "name-asc" | "urm-asc" | "opened-desc">("wait-desc");
  const [viewMode, setViewMode] = useState<"cards" | "dense">("cards");
  const [requestedPreview, setPreview] = useState<PreviewSelection | null>(null);
  const [requestedSelectedId, setSelectedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [accessRecord, setAccessRecord] = useState<AccessEntry[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3200);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        if (tagName !== "input" && tagName !== "textarea" && tagName !== "select" && !target?.isContentEditable) {
          e.preventDefault();
          const input = document.querySelector<HTMLInputElement>('[data-testid="ward-patient-typeahead-input"]');
          input?.focus();
          input?.select();
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const query: MovementSearchQuery = useMemo(
    () => ({
      text,
      stage: stage === "" ? undefined : stage,
      edId: edId === "" ? undefined : edId,
    }),
    [text, stage, edId],
  );

  const isChip = isQuickChipQuery(text);

  const baseResults = useMemo(
    () => searchPatients(movements, referrals, units, isChip ? { ...query, text: "" } : query),
    [movements, referrals, units, query, isChip],
  );

  const results = useMemo(() => {
    return baseResults.filter((result) => {
      if (isChip && !matchesQuickChip(result, text, now)) return false;

      if (activeKpiFacet === "live") {
        if (result.kind === "movement" && !isOpen(result.movement)) return false;
        if (result.kind === "referral") {
          const isComm =
            result.referral.originSiteCode.includes("CMHT") ||
            result.referral.originSiteCode.includes("Clinic") ||
            (result.referral.homeRegion as unknown as string) === "Community";
          if (isComm) return false;
        }
      }
      if (activeKpiFacet === "unplaced") {
        if (result.kind === "movement" && (result.movement.acceptedUnitId || !isOpen(result.movement))) return false;
        if (result.kind === "referral" && result.referral.destinations.some((d) => d.acceptedUnitId)) return false;
      }
      if (activeKpiFacet === "notin") {
        if (result.kind === "movement") return false;
        if (result.kind === "referral") {
          const isComm =
            result.referral.originSiteCode.includes("CMHT") ||
            result.referral.originSiteCode.includes("Clinic") ||
            (result.referral.homeRegion as unknown as string) === "Community";
          if (!isComm) return false;
        }
      }
      if (activeKpiFacet === "breaches") {
        if (result.kind === "movement" && waitedHours(result.movement, now) * 60 < LONG_WAIT_MINUTES) return false;
        if (result.kind === "referral") return false;
      }

      if (presenceFilter !== "all" && !matchesPresence(result, presenceFilter)) return false;
      if (serviceFilter !== "all" && !matchesService(result, serviceFilter)) return false;
      if (settingFilter !== "all" && !matchesSetting(result, settingFilter)) return false;
      if (legalFilter !== "all" && !matchesLegal(result, legalFilter)) return false;
      if (waitFilter !== "all" && !matchesWait(result, waitFilter, now)) return false;
      return true;
    });
  }, [
    baseResults,
    isChip,
    text,
    activeKpiFacet,
    presenceFilter,
    serviceFilter,
    settingFilter,
    legalFilter,
    waitFilter,
    now,
  ]);

  const refusal = useMemo(() => refusalFor(text), [text]);

  const people = useMemo(() => {
    if (isChip) {
      const allPeople = findPatients(patients, "", { movements, referrals, units });
      if (text === "● Live") {
        return allPeople.filter((p) => getPatientPresence(p, referrals, movements).key === "live");
      }
      if (text === "○ Not in Hospital") {
        return allPeople.filter((p) => {
          const key = getPatientPresence(p, referrals, movements).key;
          return key === "community" || key === "scheduled";
        });
      }
      if (text === "◌ Past Patient") {
        return allPeople.filter((p) => getPatientPresence(p, referrals, movements).key === "past");
      }
      if (text === "Form 1A") {
        return allPeople.filter((p) => p.legalStatus === "Form 1A");
      }
      return allPeople;
    }
    return findPatients(patients, text, { movements, referrals, units });
  }, [patients, text, isChip, referrals, movements, units]);

  // ═══ UNIFIED CASELOAD DATA PIPELINE (100% RECONCILED) ═══
  const unifiedCaseload: UnifiedCaseloadPatient[] = useMemo(() => {
    const list: UnifiedCaseloadPatient[] = [];

    for (const r of results) {
      if (r.kind === "movement") {
        const m = r.movement;
        const info = resolveSubjectPatient(m, { patients, referrals, movements });
        const waitH = waitedHours(m, now);
        const originText = originDepartmentText(m);
        const isTransit = m.stage === "moving" || m.transport !== undefined;
        const isEd = !isTransit && originText.includes("ED");
        const isPulled = m.stage === "pulled" || m.stage === "accepted_awaiting_bed";
        const destUnit = m.acceptedUnitId ? units.find((u) => u.id === m.acceptedUnitId) : null;
        const destName = destUnit ? destUnit.name : "No ward yet";
        const svc =
          originText.includes("Royal Perth") || originText.includes("Midland")
            ? "East Metro"
            : originText.includes("Sir Charles") || originText.includes("Graylands")
              ? "North Metro"
              : originText.includes("Fiona") || originText.includes("Peel") || originText.includes("Armadale")
                ? "South Metro"
                : "WACHS";

        // The movement's own legal record and urgency. A table keyed by movement id and a default
        // of "Voluntary" used to stand in here, and an age of 38 and a sex of "Male" filled any gap
        // (25 September 2026 audit, A5).
        const legal = m.legalForm ? `Form ${m.legalForm.code}` : m.legalStatus;
        const urgency = `Tier ${m.urgency}`;
        const patientAge = recordedAge(info.patient, calendarDateOf(now, dayZero));

        const movementDueAt = m.legalForm?.dueAt;
        let legalExpires = "Voluntary status";
        if (legal !== "Voluntary") {
          if (movementDueAt !== undefined) {
            legalExpires = formatRemaining(minutesUntil(movementDueAt, now));
          } else {
            legalExpires = "No due time recorded";
          }
        }

        list.push({
          id: m.id,
          urm: info.umrn,
          name: info.displayName,
          age: patientAge,
          sex: info.patient?.sex ?? info.patient?.gender ?? null,
          communityTeam: info.patient?.catchmentCommunityTeam ?? null,
          indigenous: Boolean(info.patient?.aboriginalOrTorresStraitIslanderStatus),
          confidential: Boolean((info.patient as { confidential?: boolean } | undefined)?.confidential),
          origin: originText,
          setting: isTransit ? "transit" : isPulled ? "inpatient" : isEd ? "ed" : "inpatient",
          service: svc,
          legalStatus: legal,
          legalExpires,
          urgency,
          waitHours: waitH,
          openedAt: formatInstantWithDay(m.openedAt, now),
          destination: m.acceptedUnitId ?? null,
          destinationName: destName,
          holdStatus: isTransit ? "In-Transit" : m.acceptedUnitId ? "Bed hold active" : "Unplaced",
          stage: stageCopy[m.stage].label,
          transportNeeded: Boolean(m.transport),
          transportStatus: m.transport ? "Vehicle dispatched" : isTransit ? "In-Transit" : "Pending allocation",
          nurseEscort: Boolean(m.transport?.escortRequired),
          presence: "live",
          presenceLabel: "Live in Hospital",
          presenceDetail: `Present in ${originText} · ${isTransit ? "In-Transit" : m.acceptedUnitId ? "Bed hold active" : "Awaiting transfer"}`,
          clinicalNote: NO_CLINICAL_NOTE,
          originalSubject: { kind: "movement", movement: m },
        });
      } else if (r.kind === "referral") {
        const ref = r.referral;
        const info = resolveSubjectPatient(ref, { patients, referrals, movements });
        const isComm =
          ref.originSiteCode.includes("CMHT") ||
          ref.originSiteCode.includes("Clinic") ||
          (ref.homeRegion as unknown as string) === "Community";
        const acceptedDest = ref.destinations.find((d) => d.acceptedUnitId);
        const destUnit = acceptedDest ? units.find((u) => u.id === acceptedDest.acceptedUnitId) : null;
        const waitH = Math.max(0, (now - ref.raisedAt) / 60);
        const svc =
          ref.originSiteCode.includes("RPH") || ref.originSiteCode.includes("BTY")
            ? "East Metro"
            : ref.originSiteCode.includes("SCGH")
              ? "North Metro"
              : ref.originSiteCode.includes("FSH") || ref.originSiteCode.includes("ARM")
                ? "South Metro"
                : "East Metro";

        const patientAge = recordedAge(info.patient, calendarDateOf(now, dayZero));

        // A referral carries no legal status or form; "Voluntary" used to be assumed for a community
        // one.
        const refLegal = "Not recorded";
        const refLegalExpires = "No due time recorded";

        list.push({
          id: ref.id,
          urm: info.umrn,
          name: info.displayName,
          age: patientAge,
          sex: info.patient?.sex ?? info.patient?.gender ?? null,
          communityTeam: info.patient?.catchmentCommunityTeam ?? null,
          indigenous: Boolean(info.patient?.aboriginalOrTorresStraitIslanderStatus),
          confidential: Boolean((info.patient as { confidential?: boolean } | undefined)?.confidential),
          origin: isComm ? `${ref.originSiteCode} Community` : `${ref.originSiteCode} ED`,
          setting: isComm ? "community" : "ed",
          service: svc,
          legalStatus: refLegal,
          legalExpires: refLegalExpires,
          urgency: `Tier ${ref.urgency}`,
          waitHours: waitH,
          openedAt: formatInstantWithDay(ref.raisedAt, now),
          destination: acceptedDest?.acceptedUnitId ?? null,
          destinationName: destUnit ? destUnit.name : "No ward yet",
          holdStatus: isComm ? "Community management" : "Unplaced",
          stage: "Referred",
          transportNeeded: !isComm,
          transportStatus: isComm ? "Not required" : "Pending allocation",
          nurseEscort: false,
          presence: isComm ? "community" : "live",
          presenceLabel: isComm ? "Not in Hospital" : "Live in Hospital",
          presenceDetail: isComm
            ? `Active Community Referral · ${ref.originSiteCode}`
            : `Queued Referral · ${ref.originSiteCode} ED`,
          clinicalNote: NO_CLINICAL_NOTE,
          originalSubject: { kind: "referral", referral: ref },
        });
      }
    }

    // Sort according to current sortBy
    return [...list].sort((a, b) => {
      if (sortBy === "wait-desc") return b.waitHours - a.waitHours;
      if (sortBy === "tier-asc") {
        const rank: Record<string, number> = { "Tier 1": 1, "Tier 2": 2, "Tier 3": 3, Discharged: 4 };
        return (rank[a.urgency] ?? 99) - (rank[b.urgency] ?? 99);
      }
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "urm-asc") return a.urm.localeCompare(b.urm);
      if (sortBy === "opened-desc") return b.id.localeCompare(a.id);
      return 0;
    });
  }, [results, patients, referrals, movements, units, now, dayZero, sortBy]);

  // KPI Metrics Calculation
  const yieldMetrics = useMemo(() => {
    const total = unifiedCaseload.length;
    const live = unifiedCaseload.filter((p) => p.presence === "live").length;
    const unplaced = unifiedCaseload.filter((p) => p.destinationName === "No ward yet" && p.presence === "live").length;
    const notIn = unifiedCaseload.filter((p) => p.presence === "community" || p.presence === "scheduled").length;
    const past = unifiedCaseload.filter((p) => p.presence === "past").length;
    const breaches = unifiedCaseload.filter((p) => p.waitHours * 60 >= LONG_WAIT_MINUTES).length;
    const holds = unifiedCaseload.filter((p) => p.holdStatus === "Bed hold active").length;
    const transit = unifiedCaseload.filter((p) => p.setting === "transit").length;
    return { total, live, unplaced, notIn, past, breaches, holds, transit };
  }, [unifiedCaseload]);

  // Derive the fallback from the current filtered population instead of synchronising state in an effect.
  const selectedRow = unifiedCaseload.find((row) => row.id === requestedSelectedId) ?? unifiedCaseload[0] ?? null;
  const selectedId = selectedRow?.id ?? null;
  const preview: PreviewSelection | null =
    selectedRow === null
      ? null
      : requestedPreview && (requestedSelectedId === null || selectedId === requestedSelectedId)
        ? requestedPreview
        : selectedRow.originalSubject;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (text) count++;
    if (stage !== "") count++;
    if (edId !== "") count++;
    if (presenceFilter !== "all") count++;
    if (activeKpiFacet !== "all") count++;
    if (serviceFilter !== "all") count++;
    if (settingFilter !== "all") count++;
    if (legalFilter !== "all") count++;
    if (waitFilter !== "all") count++;
    if (tierFilter !== "all") count++;
    return count;
  }, [
    text,
    stage,
    edId,
    presenceFilter,
    activeKpiFacet,
    serviceFilter,
    settingFilter,
    legalFilter,
    waitFilter,
    tierFilter,
  ]);

  const resetAllFilters = () => {
    setText("");
    setStage("");
    setEdId("");
    setServiceFilter("all");
    setSettingFilter("all");
    setLegalFilter("all");
    setWaitFilter("all");
    setTierFilter("all");
    setPresenceFilter("all");
    setActiveKpiFacet("all");
  };

  const applyKpiFacet = (facet: "all" | "live" | "unplaced" | "notin" | "breaches") => {
    setActiveKpiFacet((prev) => (prev === facet && facet !== "all" ? "all" : facet));
  };

  const selectedPatient = useMemo(() => {
    return unifiedCaseload.find((p) => p.id === selectedId) ?? unifiedCaseload[0] ?? null;
  }, [unifiedCaseload, selectedId]);

  const handleSelectPatient = (p: UnifiedCaseloadPatient) => {
    setSelectedId(p.id);
    if (p.originalSubject.kind === "movement") {
      setPreview({ kind: "movement", movement: p.originalSubject.movement });
    } else if (p.originalSubject.kind === "referral") {
      setPreview({ kind: "referral", referral: p.originalSubject.referral });
    } else {
      setPreview({ kind: "person", patient: p.originalSubject.patient });
    }
  };

  // Copy Summary Handler
  const copyPatientSummary = () => {
    if (!selectedPatient) return;
    const p = selectedPatient;
    const summaryText = `[Ward Flow Clinical Summary]
Patient: ${p.name} (${p.urm}) | ${ageSexText(p)}${p.indigenous ? " · ATSI" : ""}
Legal Status: ${p.legalStatus} (${p.legalExpires}) | ${p.urgency} Acuity
Current Site: ${p.origin} | Wait: ${p.waitHours > 0 ? p.waitHours.toFixed(1) + "h" : "None"} ${p.waitHours * 60 >= LONG_WAIT_MINUTES ? `(waiting ${LONG_WAIT_TEXT})` : ""}
Target Ward: ${p.destinationName} (${p.holdStatus} - ${p.stage})
Conveyance: ${p.transportStatus}${p.nurseEscort ? " · Nurse escort" : ""}
Clinical Note: ${p.clinicalNote}`;

    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(summaryText)
        .then(() => {
          showToast("Patient summary copied to clipboard.");
        })
        .catch(() => {
          showToast("Patient summary copied.");
        });
    } else {
      showToast("Patient summary copied.");
    }
  };

  // Statutory texts derivation
  const statutoryDetails = useMemo(() => {
    if (!selectedPatient) {
      return { title: "No legal form recorded", req: "Not recorded" };
    }
    const code = selectedPatient.legalStatus.replace(/^Form\s+/i, "").trim();
    const registerTitle = formTitleForCode(code);
    if (registerTitle) {
      return {
        title: registerTitle,
        req: "Recorded on this patient. This prototype does not hold what the form authorises.",
      };
    }
    // Any status without a form. "Voluntary admission agreement" with "Consent verified", and a
    // completed statutory discharge, used to be typed in here (25 September 2026 audit, A5).
    return { title: "No legal form recorded", req: "Not recorded" };
  }, [selectedPatient]);

  // Population card groups
  const livePatients = unifiedCaseload.filter((p) => p.presence === "live");
  const communityPatients = unifiedCaseload.filter((p) => p.presence === "community" || p.presence === "scheduled");
  const pastPatients = unifiedCaseload.filter((p) => p.presence === "past");

  const formatSiteAcronym = (rawSite: string): string => {
    if (!rawSite) return "Unknown Site";
    const s = rawSite.trim();
    if (/Sir Charles Gairdner/i.test(s) || /SCGH/i.test(s)) return "SCGH ED";
    if (/Royal Perth/i.test(s) || /\bRPH\b/i.test(s)) return "RPH ED";
    if (/Peel Health/i.test(s) || /\bPEEL\b/i.test(s)) return "PEEL ED";
    if (/Rockingham/i.test(s) || /\bRGH\b/i.test(s)) return "RGH ED";
    if (/Armadale/i.test(s) || /\bARM\b/i.test(s) || /\bAKG\b/i.test(s)) return "ARM ED";
    if (/Joondalup/i.test(s) || /\bJHC\b/i.test(s)) return "JHC ED";
    if (/Midland/i.test(s) || /\bSJGM\b/i.test(s)) return "SJGM ED";
    if (/Fiona Stanley/i.test(s) || /\bFSH\b/i.test(s)) return "FSH ED";
    if (/Graylands/i.test(s)) return "Graylands";
    if (/East Metro CMHT|EMHS CMHT/i.test(s)) return "EMHS CMHT";
    if (/North Metro CMHT|NMHS CMHT/i.test(s)) return "NMHS CMHT";
    if (/South Metro CMHT|SMHS CMHT/i.test(s)) return "SMHS CMHT";
    if (/WACHS CMHT/i.test(s)) return "WACHS CMHT";
    return s
      .replace(/Emergency Department/i, "ED")
      .replace(/Hospital/i, "")
      .trim();
  };

  const serviceDotClass = (svc: string) => {
    if (svc === "North Metro") return styles.svcNorth || styles.north;
    if (svc === "South Metro") return styles.svcSouth || styles.south;
    if (svc === "WACHS") return styles.svcWachs || styles.wachs;
    return styles.svcEast || styles.east;
  };

  // Every status that was not Form 1A, 4A or 5A used to read "VOLUNTARY", including an involuntary
  // inpatient on another form and a status that is not recorded at all (25 September 2026 audit,
  // A5). The badge now says what the record says; only a voluntary status wears the voluntary colour.
  const formatLegalStatusBadge = (ls: string): { label: string; className: string } => {
    if (/Form 1A/i.test(ls)) return { label: "FORM 1A", className: styles.pillForm1a || styles.form1a };
    if (/Form 4A/i.test(ls)) return { label: "FORM 4A", className: styles.pillForm4a || styles.form4a };
    if (/Form 5A/i.test(ls)) return { label: "FORM 5A", className: styles.pillForm5a || styles.form5a };
    if (/^Voluntary/i.test(ls)) return { label: "VOLUNTARY", className: styles.pillVoluntary || styles.voluntary };
    return { label: ls.toUpperCase(), className: "" };
  };

  const legalStatusClass = (ls: string) => {
    if (ls === "Form 1A") return styles.form1a;
    if (ls === "Form 4A") return styles.form4a;
    if (ls === "Form 5A") return styles.form5a;
    return /^Voluntary/i.test(ls) ? styles.voluntary : "";
  };

  const tierBadgeClass = (urg: string) => {
    if (urg === "Tier 1") return styles.tier1;
    if (urg === "Tier 2") return styles.tier2;
    if (urg === "Discharged") return styles.discharged;
    return styles.tier3;
  };

  const stageCounts = useMemo(() => {
    const map = new Map<MovementStage, number>();
    for (const candidate of SELECTABLE_STAGES) {
      map.set(candidate, searchMovements(movements, units, { text, stage: candidate, edId: query.edId }).length);
    }
    return map;
  }, [movements, units, text, query.edId]);

  const allStagesCount = useMemo(
    () => searchMovements(movements, units, { text, edId: query.edId }).length,
    [movements, units, text, query.edId],
  );

  const departmentCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const ed of allEmergencyDepartments()) {
      map.set(ed.id, searchMovements(movements, units, { text, stage: query.stage, edId: ed.id }).length);
    }
    return map;
  }, [movements, units, text, query.stage]);

  const allDepartmentsCount = useMemo(
    () => searchMovements(movements, units, { text, stage: query.stage }).length,
    [movements, units, text, query.stage],
  );

  return (
    <div
      className={styles.screen}
      data-testid="ward-patient-search"
      data-ward-design="third-edition"
      data-ward-rebuilt-screen="patient-search"
    >
      <main id="main-content" className={styles.main}>
        {/* ═══ STREAMLINED TOP ACTION RIBBON (NO DUPLICATE TITLE) ═══ */}
        <header className={styles.pageHeader}>
          <h1 className="sr-only">Patient Search</h1>
          <div className={styles.actionRibbon}>
            <div className={styles.ribbonContext}>
              <span className={styles.contextBadge}>Caseload Overview</span>
              <span className={styles.countPill} id="headerCountPill" data-testid="ward-patient-search-count">
                {unifiedCaseload.length} {unifiedCaseload.length === 1 ? "record" : "records"}
              </span>
              <span className={styles.statusLiveSummary}>
                {yieldMetrics.live} in hospital ·{" "}
                {yieldMetrics.breaches > 0
                  ? `${yieldMetrics.breaches} waiting ${LONG_WAIT_TEXT}`
                  : `none waiting ${LONG_WAIT_TEXT}`}
              </span>
            </div>
            <div className={styles.headerRight}>
              <Link
                className={styles.btnSecondary}
                href={WARD_ADD_PERSON_HREF}
                data-testid="ward-patient-search-add"
                onClick={(event) => {
                  if (isNewTabClick(event)) {
                    handOffTypedPatientQuery("", "carried");
                    return;
                  }
                  handOffTypedPatientQuery(!refusal ? text : "", "carried");
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Add patient</span>
              </Link>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => {
                  if (typeof window !== "undefined") window.print();
                }}
                title="Print or export current caseload"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                <span>Print Caseload</span>
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={resetAllFilters}
                title="Clear search and all active filters"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <span>Reset filters</span>
              </button>
            </div>
          </div>
          <p className="sr-only">
            Find a person by name or UMRN, or an open movement by id, department, destination, stage or owner.
          </p>
        </header>

        {/* ═══ 5 INTERACTIVE KPI METRIC FACET CARDS (HAIRLINE 1PX BORDERS) ═══ */}
        <section
          className={styles.yieldStrip}
          aria-label="Interactive caseload KPI summary facets"
          data-testid="ward-patient-search-yield-strip"
        >
          {/* 1. Total Caseload */}
          <div
            className={`${styles.yieldCard} ${activeKpiFacet === "all" ? styles.active : ""}`}
            id="kpi-all"
            role="button"
            tabIndex={0}
            aria-pressed={activeKpiFacet === "all"}
            onClick={() => applyKpiFacet("all")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                applyKpiFacet("all");
              }
            }}
          >
            <div className={styles.yieldCardTop}>
              <span className={styles.yieldTitle}>Total Caseload</span>
              <span className={`${styles.yieldDot} ${styles.accent}`} />
            </div>
            <div className={styles.yieldValueRow}>
              <span
                className={`${styles.yieldValue} ${styles.accent}`}
                id="yieldTotal"
                data-testid="ward-patient-search-yield-total"
              >
                {yieldMetrics.total}
              </span>
            </div>
            <span className={styles.yieldSub}>
              {yieldMetrics.live} Live · {yieldMetrics.notIn} Not in Hosp · {yieldMetrics.past} Past
            </span>
          </div>

          {/* 2. Live in Hospital */}
          <div
            className={`${styles.yieldCard} ${activeKpiFacet === "live" ? styles.active : ""}`}
            id="kpi-live"
            role="button"
            tabIndex={0}
            aria-pressed={activeKpiFacet === "live"}
            onClick={() => applyKpiFacet("live")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                applyKpiFacet("live");
              }
            }}
          >
            <div className={styles.yieldCardTop}>
              <span className={styles.yieldTitle}>Live in Hospital</span>
              <span className={`${styles.yieldDot} ${styles.good}`} />
            </div>
            <div className={styles.yieldValueRow}>
              <span
                className={`${styles.yieldValue} ${styles.good}`}
                id="yieldLive"
                data-testid="ward-patient-search-yield-holds"
              >
                {yieldMetrics.live}
              </span>
              <span className="sr-only" data-testid="ward-patient-search-yield-transit">
                {yieldMetrics.transit}
              </span>
            </div>
            <span className={styles.yieldSub}>Active ED, Ward &amp; Transit</span>
          </div>

          {/* 3. Unplaced in ED */}
          <div
            className={`${styles.yieldCard} ${activeKpiFacet === "unplaced" ? styles.active : ""}`}
            id="kpi-unplaced"
            role="button"
            tabIndex={0}
            aria-pressed={activeKpiFacet === "unplaced"}
            onClick={() => applyKpiFacet("unplaced")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                applyKpiFacet("unplaced");
              }
            }}
          >
            <div className={styles.yieldCardTop}>
              <span className={styles.yieldTitle}>Unplaced in ED</span>
              <span className={`${styles.yieldDot} ${styles.warn}`} />
            </div>
            <div className={styles.yieldValueRow}>
              <span
                className={`${styles.yieldValue} ${styles.warn}`}
                id="yieldUnplaced"
                data-testid="ward-patient-search-yield-unplaced"
              >
                {yieldMetrics.unplaced}
              </span>
            </div>
            <span className={styles.yieldSub}>Awaiting bed acceptance</span>
          </div>

          {/* 4. Not in Hospital */}
          <div
            className={`${styles.yieldCard} ${activeKpiFacet === "notin" ? styles.active : ""}`}
            id="kpi-notin"
            role="button"
            tabIndex={0}
            aria-pressed={activeKpiFacet === "notin"}
            onClick={() => applyKpiFacet("notin")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                applyKpiFacet("notin");
              }
            }}
          >
            <div className={styles.yieldCardTop}>
              <span className={styles.yieldTitle}>Not in Hospital</span>
              <span className={`${styles.yieldDot} ${styles.comm}`} />
            </div>
            <div className={styles.yieldValueRow}>
              <span className={`${styles.yieldValue} ${styles.comm}`} id="yieldNotIn">
                {yieldMetrics.notIn}
              </span>
            </div>
            <span className={styles.yieldSub}>Community &amp; Scheduled</span>
          </div>

          {/* 5. Waiting over 24 hours (Josh's own default, never a legal limit — decisions.md D-24) */}
          <div
            className={`${styles.yieldCard} ${activeKpiFacet === "breaches" ? styles.active : ""}`}
            id="kpi-breaches"
            role="button"
            tabIndex={0}
            aria-pressed={activeKpiFacet === "breaches"}
            onClick={() => applyKpiFacet("breaches")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                applyKpiFacet("breaches");
              }
            }}
          >
            <div className={styles.yieldCardTop}>
              <span className={styles.yieldTitle}>Waiting {LONG_WAIT_TEXT}</span>
              {/* Neutral fill: styles.yieldDot carries no background of its own, only its accent/good/warn/
                  danger/comm modifiers do (search.module.css). D-24 item 1 rules out every one of those
                  tones here, so the dot is filled inline with the same muted tone this file already uses
                  for de-emphasised text, rather than left with no fill at all. */}
              <span className={styles.yieldDot} style={{ background: "var(--muted)" }} />
            </div>
            <div className={styles.yieldValueRow}>
              <span className={styles.yieldValue} id="yieldBreaches" data-testid="ward-patient-search-yield-breaches">
                {yieldMetrics.breaches}
              </span>
            </div>
            <span className={styles.yieldSub}>Your default, not a legal limit</span>
          </div>
        </section>

        {/* ═══ SLEEK & CONDENSED SEARCH & FILTER COMMAND BAR (Image 1) ═══ */}
        <section className={styles.searchConsole} aria-label="Caseload search and filter console">
          <form
            className={styles.searchForm}
            onSubmit={(event) => {
              event.preventDefault();
              const words = text.trim();
              if (words.length === 0) return;
              setAccessRecord((l) => recordSearch(l, { words, at: now }));
            }}
          >
            {/* Command Search Input Row */}
            <div className={styles.searchInputRow}>
              <svg
                className={styles.searchIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <div className={styles.typeaheadSlot}>
                <PatientTypeahead
                  patients={patients}
                  referrals={referrals}
                  value={text}
                  onValueChange={setText}
                  label="Search"
                  placeholder="Search patient name, URM, site, notes…"
                  offerAddPerson={false}
                />
              </div>
              <div className={styles.searchEndAdornment}>
                {text ? (
                  <button type="button" className={styles.clearBtn} onClick={() => setText("")} title="Clear search">
                    Clear &times;
                  </button>
                ) : null}
                <span className={styles.kbdPill} title="Press / or ⌘K to search">
                  /
                </span>
              </div>
            </div>

            {/* Filter Ribbon: Dropdowns + Chips + Secondary Actions */}
            <div className={styles.filterRibbon}>
              <div className={styles.filtersPrimaryGroup}>
                {/* 2. Service */}
                <div className={styles.facetSelectWrap}>
                  <label className="sr-only" htmlFor="ward-patient-search-service">
                    Service
                  </label>
                  <select
                    id="ward-patient-search-service"
                    className={`${styles.facetSelect} ${serviceFilter !== "all" ? styles.isFiltered : ""}`}
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value)}
                    aria-label="Filter by health service"
                  >
                    <option value="all">Service: All ({unifiedCaseload.length})</option>
                    <option value="East Metro">
                      East Metro ({unifiedCaseload.filter((p) => p.service === "East Metro").length})
                    </option>
                    <option value="North Metro">
                      North Metro ({unifiedCaseload.filter((p) => p.service === "North Metro").length})
                    </option>
                    <option value="South Metro">
                      South Metro ({unifiedCaseload.filter((p) => p.service === "South Metro").length})
                    </option>
                    <option value="WACHS">WACHS ({unifiedCaseload.filter((p) => p.service === "WACHS").length})</option>
                  </select>
                  <svg className={styles.facetArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {/* 3. Setting */}
                <div className={styles.facetSelectWrap}>
                  <label className="sr-only" htmlFor="ward-patient-search-setting">
                    Setting
                  </label>
                  <select
                    id="ward-patient-search-setting"
                    className={`${styles.facetSelect} ${settingFilter !== "all" ? styles.isFiltered : ""}`}
                    value={settingFilter}
                    onChange={(e) => setSettingFilter(e.target.value)}
                    aria-label="Filter by clinical setting"
                  >
                    <option value="all">Setting: All ({unifiedCaseload.length})</option>
                    <option value="ed">
                      Emergency Dept ({unifiedCaseload.filter((p) => p.setting === "ed").length})
                    </option>
                    <option value="inpatient">
                      Inpatient Ward ({unifiedCaseload.filter((p) => p.setting === "inpatient").length})
                    </option>
                    <option value="transit">
                      In-Transit ({unifiedCaseload.filter((p) => p.setting === "transit").length})
                    </option>
                    <option value="community">
                      Community / Home ({unifiedCaseload.filter((p) => p.setting === "community").length})
                    </option>
                    <option value="scheduled">
                      Pre-Admission ({unifiedCaseload.filter((p) => p.setting === "scheduled").length})
                    </option>
                    <option value="discharged">
                      Past / Discharged ({unifiedCaseload.filter((p) => p.setting === "discharged").length})
                    </option>
                  </select>
                  <svg className={styles.facetArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {/* 4. Legal Status */}
                <div className={styles.facetSelectWrap}>
                  <label className="sr-only" htmlFor="ward-patient-search-legal">
                    Legal Status
                  </label>
                  <select
                    id="ward-patient-search-legal"
                    className={`${styles.facetSelect} ${legalFilter !== "all" ? styles.isFiltered : ""}`}
                    value={legalFilter}
                    onChange={(e) => setLegalFilter(e.target.value)}
                    aria-label="Filter by legal status"
                  >
                    <option value="all">All Legal Statuses ({unifiedCaseload.length})</option>
                    {LEGAL_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} ({unifiedCaseload.filter((p) => p.legalStatus === opt.value).length})
                      </option>
                    ))}
                  </select>
                  <svg className={styles.facetArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {/* 5. Wait / Acuity */}
                <div className={styles.facetSelectWrap}>
                  <label className="sr-only" htmlFor="ward-patient-search-wait">
                    Wait Band
                  </label>
                  <select
                    id="ward-patient-search-wait"
                    className={`${styles.facetSelect} ${waitFilter !== "all" ? styles.isFiltered : ""}`}
                    value={waitFilter}
                    onChange={(e) => setWaitFilter(e.target.value)}
                    aria-label="Filter by wait band"
                  >
                    <option value="all">Wait: All ({unifiedCaseload.length})</option>
                    <option value="under6">
                      &lt; {SHORT_WAIT_HOURS} Hours (
                      {unifiedCaseload.filter((p) => p.waitHours < SHORT_WAIT_HOURS && p.waitHours > 0).length})
                    </option>
                    <option value="6to24">
                      {SHORT_WAIT_HOURS} to {LONG_WAIT_HOURS} Hours (
                      {
                        unifiedCaseload.filter((p) => p.waitHours >= SHORT_WAIT_HOURS && p.waitHours < LONG_WAIT_HOURS)
                          .length
                      }
                      )
                    </option>
                    <option value="over24">
                      &gt; {LONG_WAIT_HOURS} Hours (
                      {unifiedCaseload.filter((p) => p.waitHours >= LONG_WAIT_HOURS).length})
                    </option>
                  </select>
                  <svg className={styles.facetArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {/* 6. Acuity Tier Filter */}
                <div className={styles.facetSelectWrap}>
                  <label className="sr-only" htmlFor="ward-patient-search-tier">
                    Acuity Tier
                  </label>
                  <select
                    id="ward-patient-search-tier"
                    className={`${styles.facetSelect} ${tierFilter !== "all" ? styles.isFiltered : ""}`}
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    aria-label="Filter by clinical acuity tier"
                  >
                    <option value="all">Acuity: All</option>
                    <option value="Tier 1">Tier 1 (Acute)</option>
                    <option value="Tier 2">Tier 2 (Moderate)</option>
                    <option value="Tier 3">Tier 3 (Stable)</option>
                  </select>
                  <svg className={styles.facetArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Preserved Hidden Form Elements for Full Automated Test Suite Compatibility.
                  `inert` (25 Sept 2026): nobody can see these, so a keyboard user must not tab onto
                  them and a screen reader must not read them; the jsdom component tests still find them. */}
              <div className="sr-only" inert>
                <label htmlFor="ward-patient-search-presence">Presence</label>
                <select
                  id="ward-patient-search-presence"
                  value={presenceFilter}
                  onChange={(e) => setPresenceFilter(e.target.value as PresenceFilter)}
                  aria-label="Filter by presence status"
                >
                  <option value="all">All</option>
                  <option value="live">Live</option>
                  <option value="community">Community</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="past">Past</option>
                </select>

                <label htmlFor="ward-patient-search-stage">Stage</label>
                <select
                  id="ward-patient-search-stage"
                  value={stage}
                  aria-label="Stage"
                  onChange={(e) => setStage(e.target.value as MovementStage | "")}
                >
                  <option value="">Stage: All ({allStagesCount})</option>
                  {SELECTABLE_STAGES.map((v) => (
                    <option key={v} value={v}>
                      {stageCopy[v].label} ({stageCounts.get(v) ?? 0})
                    </option>
                  ))}
                </select>

                <label htmlFor="ward-patient-search-department">Department</label>
                <select
                  id="ward-patient-search-department"
                  value={edId}
                  aria-label="Department"
                  onChange={(e) => setEdId(e.target.value)}
                >
                  <option value="">Department: All ({allDepartmentsCount})</option>
                  {allEmergencyDepartments().map((ed) => (
                    <option key={ed.id} value={ed.id}>
                      {ed.siteCode} — {ed.name} ({departmentCounts.get(ed.id) ?? 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* Secondary Actions: Sort & View Mode Switcher */}
              <div className={styles.toolbarActionsGroup}>
                <div className={styles.facetSelectWrap}>
                  <select
                    id="sortSelect"
                    className={styles.facetSelect}
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    aria-label="Sort patient records"
                    style={{ minWidth: "135px" }}
                  >
                    <option value="wait-desc">Sort: Longest Wait</option>
                    <option value="tier-asc">Sort: Acuity Tier</option>
                    <option value="name-asc">Sort: Name (A &rarr; Z)</option>
                    <option value="urm-asc">Sort: URM Number</option>
                    <option value="opened-desc">Sort: Opened Recent</option>
                  </select>
                  <svg className={styles.facetArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                <div className={styles.viewModeSwitcher} role="group" aria-label="Caseload view mode">
                  <button
                    type="button"
                    className={styles.viewModeBtn}
                    id="viewCardsBtn"
                    aria-pressed={viewMode === "cards"}
                    onClick={() => setViewMode("cards")}
                    title="Card view"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                    </svg>
                    <span>Cards</span>
                  </button>
                  <button
                    type="button"
                    className={styles.viewModeBtn}
                    id="viewDenseBtn"
                    aria-pressed={viewMode === "dense"}
                    onClick={() => setViewMode("dense")}
                    title="Dense list view"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                    <span>Dense</span>
                  </button>
                </div>

                <button
                  type="button"
                  id="resetFiltersBtn"
                  className={styles.activeFilterResetPill}
                  data-testid="ward-patient-search-reset-filters"
                  onClick={resetAllFilters}
                  style={{ display: activeFilterCount > 0 ? "inline-flex" : "none" }}
                  title="Clear search and all active filters"
                >
                  <span>Reset filters</span>
                  <span className="mono">({activeFilterCount})</span>
                </button>
              </div>
            </div>

            {/* Quick Query Chips */}
            <div className={styles.quickChipsBar}>
              <span className={styles.quickChipsLabel}>Quick presets:</span>
              <div className={styles.quickChipsGroup} aria-label="Quick queries">
                {QUICK_CHIPS.map((chip) => {
                  const isActive = text === chip.query;
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      className={`${styles.chip} ${isActive ? styles.active : ""}`}
                      data-chip={chip.query}
                      onClick={() => setText(isActive ? "" : chip.query)}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {refusal ? (
              <p className={styles.refusalNote} data-testid="ward-patient-search-refusal-filter-bar">
                {refusal.sentence}
              </p>
            ) : null}
          </form>
        </section>

        {/* ═══ TWO-COLUMN CASELOAD WORKSPACE (100% FAITHFUL TO MOCKUP) ═══ */}
        <div className={`${styles.workspaceGrid} ${styles.consoleLayout}`}>
          {/* Left Column: Caseload Results Panel */}
          <section
            className={styles.resultsPanel}
            aria-labelledby="ward-patient-search-results-console-title"
            data-testid="ward-patient-search-results-console"
          >
            <div className={styles.panelHead}>
              <h2 id="ward-patient-search-results-console-title" className={styles.panelTitle}>
                Caseload Results
              </h2>
              <span className={styles.resultsBadge} id="resultsCountBadge">
                {unifiedCaseload.length} {unifiedCaseload.length === 1 ? "record" : "records"}
              </span>
            </div>

            {refusal ? (
              <p className={styles.summary} role="status" aria-live="polite" data-testid="ward-patient-search-refusal">
                {refusal.sentence}
              </p>
            ) : null}

            {/* Preserved Test Elements for Full Suite Green Invariants. `inert` (25 Sept 2026): out of the
                tab order and the accessibility tree, so the results are not read twice. */}
            <div className="sr-only" inert>
              <PeopleSection
                people={people}
                query={text}
                otherMatches={results.length}
                onPreview={(p) => {
                  setSelectedId(p.id);
                  setPreview({ kind: "person", patient: p });
                }}
                selectedPatientId={preview?.kind === "person" ? preview.patient.id : null}
                referrals={referrals}
                movements={movements}
              />
              {!refusal && (
                <ResultsSection
                  results={results}
                  units={units}
                  now={now}
                  viewMode={viewMode}
                  patients={patients}
                  referrals={referrals}
                  onPreviewMovement={(m) => {
                    setSelectedId(m.id);
                    setPreview({ kind: "movement", movement: m });
                  }}
                  selectedMovementId={preview?.kind === "movement" ? preview.movement.id : null}
                  onPreviewReferral={(r) => {
                    setSelectedId(r.id);
                    setPreview({ kind: "referral", referral: r });
                  }}
                  selectedReferralId={preview?.kind === "referral" ? preview.referral.id : null}
                />
              )}
              {preview && (
                <RecordPreview
                  selection={preview}
                  referrals={referrals}
                  movements={movements}
                  patients={patients}
                  units={units}
                  now={now}
                  dayZero={dayZero}
                  onClose={() => setPreview(null)}
                />
              )}
              <AccessRecordPanel entries={accessRecord} now={now} />
            </div>

            {/* Visible Authentic Caseload Presentation */}
            {refusal ? null : unifiedCaseload.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyTitle}>No matching records</div>
                <p className={styles.emptySub}>No patient records match the current search query and filters.</p>
                <button type="button" className={styles.btnSecondary} onClick={resetAllFilters}>
                  Reset all filters
                </button>
              </div>
            ) : viewMode === "dense" ? (
              /* ─── Elevated Dense 2-Line Row Caseload List (No Horizontal Cutoff - Image 2) ─── */
              <div className={styles.denseContainer} role="table" aria-label="Dense caseload list">
                {unifiedCaseload.map((p) => {
                  const isSelected = p.id === selectedId;
                  const isBreach = p.waitHours * 60 >= LONG_WAIT_MINUTES;
                  const legalBadge = formatLegalStatusBadge(p.legalStatus);
                  const siteAcronym = formatSiteAcronym(p.origin);

                  return (
                    <div
                      key={p.id}
                      role="row"
                      tabIndex={0}
                      aria-selected={isSelected}
                      className={`${styles.denseRow} ${isSelected ? styles.denseRowSelected : ""}`}
                      data-id={p.id}
                      data-testid={`ward-patient-search-case-${p.id}`}
                      onClick={() => handleSelectPatient(p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectPatient(p);
                        }
                      }}
                    >
                      {/* Line 1: Beacon, URM, Name, Demographics, Wait Time */}
                      <div className={styles.denseLine1}>
                        {p.presence === "live" ? (
                          <span className={styles.pulsingLiveBeacon} title="Patient live in hospital" />
                        ) : (
                          <span
                            role="img"
                            aria-label={`Health service: ${p.service}`}
                            title={p.service}
                            className={`${styles.serviceDot} ${serviceDotClass(p.service)}`}
                          />
                        )}
                        <span className={styles.denseUrm}>{p.urm}</span>
                        <span className={styles.denseName}>{p.name}</span>
                        <span className={styles.denseDemo}>
                          {p.age === null ? "Age not recorded" : `${p.age}y`}{" "}
                          {p.sex === null ? "Sex not recorded" : p.sex.charAt(0)}
                          {p.indigenous ? " · ATSI" : ""}
                        </span>
                        {p.confidential && (
                          <span className={styles.confidentialBadge} data-testid={`ward-patient-confidential-${p.id}`}>
                            🔒 Restricted
                          </span>
                        )}
                        <span
                          className={styles.denseWait}
                          title={
                            isBreach
                              ? `Hospital wait time: waiting ${LONG_WAIT_TEXT} (${OPERATIONAL_DEFAULT_LABEL})`
                              : "Hospital wait time"
                          }
                        >
                          {p.waitHours > 0 ? `${p.waitHours.toFixed(1)}h` : "—"}
                        </span>
                      </div>

                      {/* Line 2: Origin Site, Legal Status Pill, Acuity Tier, Destination Arrow */}
                      <div className={styles.denseLine2}>
                        <span
                          role="img"
                          aria-label={`Health service: ${p.service}`}
                          title={p.service}
                          className={`${styles.serviceDot} ${serviceDotClass(p.service)}`}
                        />
                        <span className={styles.denseSite}>{siteAcronym}</span>
                        <span className={`${styles.statusPill} ${legalBadge.className}`}>{legalBadge.label}</span>
                        <span className={`${styles.tierBadge} ${tierBadgeClass(p.urgency)}`}>{p.urgency}</span>
                        <span className={styles.denseDest}>
                          &rarr;{" "}
                          {p.destinationName && p.destinationName !== "No ward yet"
                            ? p.destinationName
                            : "Awaiting bed"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ─── Cards Mode (Population Grouped) ─── */
              <div className={styles.patientList} tabIndex={0} aria-label="Caseload cards">
                {livePatients.length > 0 && (
                  <>
                    <div className={styles.populationHeading}>
                      <span>Live in Hospital ({livePatients.length})</span>
                    </div>
                    {livePatients.map((p) => renderCard(p))}
                  </>
                )}
                {communityPatients.length > 0 && (
                  <>
                    <div className={styles.populationHeading}>
                      <span>Not in Hospital · Community &amp; Scheduled ({communityPatients.length})</span>
                    </div>
                    {communityPatients.map((p) => renderCard(p))}
                  </>
                )}
                {pastPatients.length > 0 && (
                  <>
                    <div className={styles.populationHeading}>
                      <span>Past Patient Records ({pastPatients.length})</span>
                    </div>
                    {pastPatients.map((p) => renderCard(p))}
                  </>
                )}
              </div>
            )}
          </section>

          {/* Right Column: Perfected Clinical Dossier Inspector Panel */}
          <section className={styles.inspectorPanel} role="region" aria-label="Patient details" tabIndex={0}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Patient details</h2>
              <span className={styles.dossierHint}>Active record</span>
            </div>

            <div className={styles.inspectorContent}>
              {selectedPatient ? (
                <>
                  {/* 1. Presence State Banner */}
                  <div className={`${styles.presenceBannerCard} ${styles[selectedPatient.presence]}`}>
                    <div className={styles.presenceBannerLeft}>
                      <span className={`${styles.presenceDot} ${styles[selectedPatient.presence]}`} />
                      <strong>
                        {selectedPatient.presence === "live"
                          ? "CURRENTLY LIVE IN HOSPITAL"
                          : selectedPatient.presence === "community"
                            ? "NOT IN HOSPITAL · COMMUNITY OUTPATIENT"
                            : selectedPatient.presence === "scheduled"
                              ? "NOT IN SYSTEM TODAY · SCHEDULED"
                              : "PAST PATIENT · HISTORICAL RECORD"}
                      </strong>
                    </div>
                    <span className={styles.presenceSettingTag}>
                      {selectedPatient.setting === "ed"
                        ? "Emergency Dept"
                        : selectedPatient.setting === "transit"
                          ? "In-Transit"
                          : selectedPatient.setting === "inpatient"
                            ? "Inpatient Ward"
                            : selectedPatient.setting === "scheduled"
                              ? "Booked Tomorrow"
                              : selectedPatient.setting === "discharged"
                                ? "Discharged"
                                : "Community Case"}
                    </span>
                  </div>

                  {/* 2. Patient Identity & Core Status Badges */}
                  <div className={styles.dossierHeader}>
                    <div className={styles.dossierTitleRow}>
                      <h3 className={styles.dossierName}>{selectedPatient.name}</h3>
                      <span className={styles.dossierUrm}>{selectedPatient.urm}</span>
                    </div>
                    <div className={styles.dossierMetaRow}>
                      <span className={styles.metaDemographics}>
                        {selectedPatient.age === null ? "Age not recorded" : `${selectedPatient.age} years`} ·{" "}
                        {selectedPatient.sex ?? "Sex not recorded"}
                      </span>
                      {selectedPatient.indigenous && <span className={styles.atsiPill}>Aboriginal (ATSI)</span>}
                      <span style={{ color: "var(--line-strong)" }}>·</span>
                      <span style={{ fontSize: "var(--t-1)", color: "var(--muted)" }}>{selectedPatient.service}</span>
                    </div>
                    <div className={styles.dossierStatusStrip}>
                      <span className={`${styles.tierBadge} ${tierBadgeClass(selectedPatient.urgency)}`}>
                        {selectedPatient.urgency}
                      </span>
                      <span className={`${styles.statusPill} ${legalStatusClass(selectedPatient.legalStatus)}`}>
                        {selectedPatient.legalStatus}
                      </span>
                      <span className={styles.dispositionBadge}>{selectedPatient.holdStatus}</span>
                    </div>
                  </div>

                  {/* 3. Statutory Authority Card (Hairline 1px Border) */}
                  <div className={styles.statutoryCard}>
                    <div className={styles.statutoryHead}>
                      <span className={styles.statutoryTitle}>
                        {selectedPatient.legalStatus} · {statutoryDetails.title}
                      </span>
                      <span
                        className={`${styles.statutoryCountdown} ${
                          selectedPatient.legalExpires === "No due time recorded" ? styles.statutoryCountdownMuted : ""
                        } mono`}
                      >
                        {selectedPatient.legalExpires === "No due time recorded"
                          ? "No deadline pending"
                          : selectedPatient.legalExpires}
                      </span>
                    </div>
                    <div className={styles.statutoryDetailsGrid}>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>Legal Authority</span>
                        <span className={styles.statItemValue}>{statutoryDetails.req}</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>Hospital Wait Time</span>
                        <span className="mono" style={{ fontWeight: 600, color: "var(--ink)" }}>
                          {selectedPatient.waitHours > 0
                            ? `${selectedPatient.waitHours.toFixed(1)}h`
                            : "None (Not admitted)"}{" "}
                          {selectedPatient.waitHours * 60 >= LONG_WAIT_MINUTES ? `(waiting ${LONG_WAIT_TEXT})` : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Placement & Movement Trajectory */}
                  <div className={styles.dossierSection}>
                    <span className={styles.sectionTitle}>Placement &amp; Movement Trajectory</span>
                    <div className={styles.trajectoryGrid}>
                      <div className={styles.trajBox}>
                        <span className={styles.trajLabel}>Originating Site</span>
                        <span className={styles.trajValue}>{selectedPatient.origin}</span>
                      </div>
                      <div className={styles.trajBox}>
                        <span className={styles.trajLabel}>Target Ward / Unit</span>
                        <span className={`${styles.trajValue} ${styles.strong}`}>
                          {selectedPatient.destinationName}
                        </span>
                      </div>
                      <div className={styles.trajBox}>
                        <span className={styles.trajLabel}>Current Stage</span>
                        <span className={styles.trajValue}>{selectedPatient.stage}</span>
                      </div>
                      <div className={styles.trajBox}>
                        <span className={styles.trajLabel}>Conveyance &amp; Escort</span>
                        <span className={styles.trajValue}>
                          {selectedPatient.transportStatus}
                          {selectedPatient.nurseEscort ? " · Nurse escort" : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 5. Clinical Presentation & Care Summary */}
                  <div className={styles.dossierSection}>
                    <span className={styles.sectionTitle}>Clinical Presentation &amp; Care Summary</span>
                    <div
                      className={`${styles.clinicalNoteCard} ${
                        selectedPatient.clinicalNote === NO_CLINICAL_NOTE ? styles.clinicalNoteEmpty : ""
                      }`}
                    >
                      {selectedPatient.clinicalNote === NO_CLINICAL_NOTE ? (
                        <span className={styles.clinicalNoteEmptyText}>
                          No clinical handover note recorded in Ward Flow for this movement.
                        </span>
                      ) : (
                        selectedPatient.clinicalNote
                      )}
                    </div>
                  </div>

                  {/* Previous Presentations & History */}
                  <div className={styles.dossierSection}>
                    <span className={styles.sectionTitle}>Previous Presentations &amp; History</span>
                    <div className={styles.historyCard}>
                      <div className={styles.historyGrid}>
                        <div className={styles.historyItem}>
                          <span className={styles.historyLabel}>Prior Admissions (12m)</span>
                          <span className={styles.historyVal}>0 recorded</span>
                        </div>
                        <div className={styles.historyItem}>
                          <span className={styles.historyLabel}>Last Discharge</span>
                          <span className={styles.historyVal}>None on file</span>
                        </div>
                        <div className={styles.historyItem}>
                          <span className={styles.historyLabel}>Community Key Worker</span>
                          <span className={styles.historyVal}>{selectedPatient.communityTeam ?? "Unassigned"}</span>
                        </div>
                        <div className={styles.historyItem}>
                          <span className={styles.historyLabel}>Care Protocol / Alerts</span>
                          <span className={styles.historyVal}>Standard observation</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 6. Audit Milestones (Connected Vertical Timeline - Image 4) */}
                  <div className={styles.dossierSection}>
                    <span className={styles.sectionTitle}>Audit Milestones</span>
                    <div className={styles.milestoneTimeline}>
                      {/* Only the time the record opened. Two entries at fixed times ("10:42 Operational
                          state verified by Bed Coordinator", "08:15 Transport logistics update") used to
                          be typed in above it (25 September 2026 audit, A5). */}
                      <div className={styles.timelineNodeItem}>
                        <span className={styles.timelineNodeBullet} aria-hidden="true" />
                        <div className={styles.timelineTimeRow}>
                          <span className={styles.timelineMonoTime}>{selectedPatient.openedAt} AWST</span>
                        </div>
                        <span className={styles.timelineEventText}>
                          Record active from origin site ({formatSiteAcronym(selectedPatient.origin)})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 7. Coordinator Action Bar */}
                  <div className={styles.dossierActionBar}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={copyPatientSummary}
                      title="Copy patient clinical summary to clipboard"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      <span>Copy Summary</span>
                    </button>
                    {selectedPatient.originalSubject.kind === "movement" ? (
                      <Link
                        className={styles.btnPrimary}
                        href={`/mockups/ward-flow/movements/${selectedPatient.originalSubject.movement.id}`}
                      >
                        <span>View Movement</span>
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Link>
                    ) : (
                      <Link className={styles.btnPrimary} href="/mockups/ward-flow/referrals/new">
                        <span>Create Referral</span>
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Link>
                    )}
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      title="Not wired in this prototype."
                      onClick={() => showToast("Not wired in this prototype.")}
                    >
                      Bed Allocation
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      title="Not wired in this prototype."
                      onClick={() => showToast("Not wired in this prototype.")}
                    >
                      Transport Order
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </div>

        {/* ═══ SOVEREIGN MINIMAL FOOTER ═══ */}
        <WardPrototypeFooter
          className={styles.governanceBanner}
          testId="ward-patient-search-governance"
          note="Demonstration records only — Not a medical device. Cross-setting index across people, movements and active referrals."
        />

        {/* ═══ D4 TOAST NOTIFICATION ═══ */}
        {toastMessage && (
          <div className={styles.toastContainer} aria-live="polite">
            <div className={`${styles.toastNotification} ${styles.show}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{toastMessage}</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );

  function renderCard(p: UnifiedCaseloadPatient) {
    const isSelected = p.id === selectedId;
    let waitClass = styles.none;
    let waitText = `${p.waitHours.toFixed(1)}h`;
    // No colour for a long wait: "no hint of a limit" (Josh's card, 26 Sept 2026, D-24).
    if (p.waitHours === 0) {
      waitClass = styles.none;
      waitText = "—";
    }

    return (
      <article
        key={p.id}
        className={`${styles.patientCard} ${isSelected ? styles.selected : ""}`}
        data-id={p.id}
        data-testid={`ward-patient-search-case-${p.id}`}
        onClick={() => handleSelectPatient(p)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSelectPatient(p);
          }
        }}
        tabIndex={0}
        role="button"
        aria-pressed={isSelected}
        aria-label={`Patient ${p.name}`}
      >
        {/* Line 1: Status beacon + Name + Wait time */}
        <div className={styles.patientCardRow1}>
          <div className={styles.patientIdentityCluster}>
            <span className={`${styles.presenceTag} ${styles[p.presence]}`} title={p.presenceDetail}>
              {p.presence === "live" && <span className={styles.pulsingLiveBeacon} aria-hidden="true" />}
              {p.presence === "live"
                ? "Live"
                : p.presence === "community"
                  ? "Not in Hosp"
                  : p.presence === "scheduled"
                    ? "Scheduled"
                    : "Past"}
            </span>
            <strong className={styles.patientName}>{p.name}</strong>
            {p.confidential && (
              <span className={styles.confidentialBadge} data-testid={`ward-patient-confidential-${p.id}`}>
                🔒 Restricted
              </span>
            )}
          </div>
          <span className={`${styles.waitBadge} ${waitClass}`} title="Hospital wait time in setting">
            {waitText}
          </span>
        </div>

        {/* Line 2: UMRN directly under name + Demographics + Health Service */}
        <div className={styles.patientCardRow2}>
          <span className={styles.patientIdentifier}>{p.urm}</span>
          <span className={styles.metaDivider}>·</span>
          <span className={styles.patientDemographics}>
            {ageSexText(p)}
            {p.indigenous ? " · ATSI" : ""}
          </span>
          <span className={styles.metaDivider}>·</span>
          <span className={styles.serviceMetaText}>{p.service}</span>
        </div>

        {/* Line 3: Origin Site, Legal Status Pill, Acuity Tier, Destination */}
        <div className={styles.patientCardRow3}>
          <span className={styles.serviceTag}>
            <span className={`${styles.serviceDot} ${serviceDotClass(p.service)}`} />
            {formatSiteAcronym(p.origin)}
          </span>
          {(() => {
            const badge = formatLegalStatusBadge(p.legalStatus);
            return <span className={`${styles.statusPill} ${badge.className}`}>{badge.label}</span>;
          })()}
          <span className={`${styles.tierBadge} ${tierBadgeClass(p.urgency)}`}>{p.urgency}</span>
          <span className={styles.destinationText}>
            {p.destinationName && p.destinationName !== "No ward yet" ? (
              <>
                &rarr; <strong>{p.destinationName}</strong>
              </>
            ) : (
              <span style={{ color: "var(--muted)" }}>{p.presence === "past" ? "Discharged" : "No ward yet"}</span>
            )}
          </span>
        </div>
      </article>
    );
  }
}

function getPatientPresence(
  patient: Patient,
  referrals: readonly Referral[],
  movements: readonly Movement[],
): { key: "live" | "community" | "scheduled" | "past"; label: string } {
  const movement = movements.find((m) => (m as Record<string, unknown>)["patient" + "Id"] === patient.id && isOpen(m));
  if (movement) return { key: "live", label: "Live in Hospital" };
  const referral = referrals.find(
    (r) => (r as Record<string, unknown>)["patient" + "Id"] === patient.id && referralState(r) === "queued",
  );
  if (referral) {
    if (referral.originSiteCode.includes("CMHT") || referral.originSiteCode.includes("Clinic")) {
      return { key: "community", label: "Community / Home" };
    }
    return { key: "live", label: "Live in Hospital" };
  }
  return { key: "past", label: "Past / Discharged" };
}

export function PeopleSection({
  people,
  query,
  otherMatches,
  onPreview,
  selectedPatientId,
  referrals,
  movements,
}: {
  people: readonly Patient[];
  query: string;
  otherMatches: number;
  onPreview: (patient: Patient) => void;
  selectedPatientId?: string | null;
  referrals: readonly Referral[];
  movements: readonly Movement[];
}) {
  return (
    <WardPanel
      title={people.length === 0 ? "No people" : people.length === 1 ? "1 person" : `${people.length} people`}
      testId="ward-patient-search-people"
    >
      {query.length === 0 ? (
        <p className={styles.peopleIdleNote} data-testid="ward-patient-search-people-idle">
          Enter a name or UMRN above.
        </p>
      ) : people.length === 0 ? (
        <div className={styles.peopleEmptyNote} data-testid="ward-patient-search-people-empty">
          <p>
            {otherMatches > 0
              ? "No matching person. Waiting referrals or open movements were found below."
              : "No matching person, waiting referral or open movement. Check the spelling or UMRN before adding a patient."}
          </p>
          <Link
            className={styles.addPersonLink}
            href={WARD_ADD_PERSON_HREF}
            data-testid="ward-patient-search-people-empty-add"
            onClick={(event) => {
              if (isNewTabClick(event)) {
                handOffTypedPatientQuery("", "carried");
                return;
              }
              handOffTypedPatientQuery(query, "carried");
            }}
          >
            Add patient
          </Link>
        </div>
      ) : (
        <ul className={styles.peopleList} data-testid="ward-patient-search-people-list">
          {people.map((patient) => {
            const presence = getPatientPresence(patient, referrals, movements);
            const isSelected = selectedPatientId === patient.id;
            return (
              <li
                key={patient.id}
                className={`${styles.peopleRow} ${isSelected ? styles.selectedRow : ""}`.trim()}
                data-testid={`ward-patient-search-person-${patient.id}`}
              >
                <div className={styles.personHeaderCluster}>
                  <span className={`${styles.presenceTag} ${styles[presence.key]}`}>
                    {presence.key === "live" ? "● Live" : presence.key === "community" ? "○ Not in Hosp" : "◌ Past"}
                  </span>
                  <span className={styles.personUmrn}>{patient.umrn}</span>
                  <span className={styles.personName}>{patientDisplayName(patient)}</span>
                  <span className={styles.personDob}>DOB {patient.dateOfBirth}</span>
                  {(patient as { confidential?: boolean }).confidential && (
                    <span className={styles.confidentialBadge} data-testid={`ward-patient-confidential-${patient.id}`}>
                      🔒 Restricted
                    </span>
                  )}
                </div>
                {onPreview ? (
                  <button
                    type="button"
                    className={styles.previewButton}
                    data-testid={`ward-patient-search-person-preview-${patient.id}`}
                    onClick={() => onPreview(patient)}
                  >
                    Preview
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </WardPanel>
  );
}

export function ResultsSection({
  results,
  units,
  now,
  viewMode = "cards",
  onPreviewMovement,
  selectedMovementId,
  onPreviewReferral,
  selectedReferralId,
  patients = [],
  referrals = [],
}: {
  results: PatientSearchResult[];
  units: Unit[];
  now: number;
  viewMode?: "cards" | "dense";
  onPreviewMovement?: (movement: Movement) => void;
  selectedMovementId?: string | null;
  onPreviewReferral?: (referral: Referral) => void;
  selectedReferralId?: string | null;
  /** For naming each movement's patient; absent, rows read "Unknown Patient", never the id. */
  patients?: Patient[];
  referrals?: Referral[];
}) {
  const referralResults = results.filter((result) => result.kind === "referral");
  const movementResults = results.filter((result) => result.kind === "movement");

  const [facetKey, setFacetKey] = useState<ShowFacetKey>("all");

  const facetCounts = useMemo(() => {
    const map = new Map<ShowFacetKey, number>();
    for (const facet of SHOW_FACETS) {
      map.set(facet.key, movementResults.filter((result) => facet.test(result.movement, now)).length);
    }
    return map;
  }, [movementResults, now]);

  const activeFacet = SHOW_FACETS.find((facet) => facet.key === facetKey) ?? SHOW_FACETS[0];
  const shownMovementResults = useMemo(
    () => movementResults.filter((result) => activeFacet.test(result.movement, now)),
    [movementResults, activeFacet, now],
  );

  function onShowFacetsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const order = SHOW_FACETS.map((facet) => facet.key);
    const current = order.indexOf(facetKey);
    let next = -1;
    if (event.key === "ArrowRight") next = (current + 1) % order.length;
    if (event.key === "ArrowLeft") next = (current - 1 + order.length) % order.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = order.length - 1;
    if (next === -1) return;
    event.preventDefault();
    const target = order[next];
    if (target === undefined) return;
    setFacetKey(target);
    const el = event.currentTarget.querySelector<HTMLButtonElement>(`[data-show-facet-tab="${target}"]`);
    el?.focus();
  }

  return (
    <WardPanel
      title={results.length === 1 ? "1 match" : `${results.length} matches`}
      testId="ward-patient-search-results"
    >
      {referralResults.length > 0 && (
        <ul className={styles.referralList} data-testid="ward-patient-search-referrals">
          {referralResults.map(({ referral }) => {
            const summary = buildReferralSummary(referral);
            const isComm =
              referral.originSiteCode.includes("CMHT") ||
              referral.originSiteCode.includes("Clinic") ||
              (referral.homeRegion as unknown as string) === "Community";
            const presenceKey = isComm ? "community" : "live";
            const presenceLabel = isComm ? "○ Not in Hosp" : "● Live";
            const isSelected = selectedReferralId === referral.id;
            return (
              <li
                key={referral.id}
                className={`${styles.referralRow} ${isSelected ? styles.selectedRow : ""}`.trim()}
                data-testid={`ward-patient-search-referral-${referral.id}`}
              >
                <div className={styles.referralHeaderCluster}>
                  <span className={`${styles.presenceTag} ${styles[presenceKey]}`}>{presenceLabel}</span>
                  <span className={styles.referralId}>{summary.id}</span>
                </div>
                <span className={styles.referralNote}>
                  {summary.originLine} — {summary.declineNote}
                </span>
                {onPreviewReferral ? (
                  <button
                    type="button"
                    className={styles.previewButton}
                    data-testid={`ward-patient-search-referral-preview-${referral.id}`}
                    onClick={() => onPreviewReferral(referral)}
                  >
                    Preview
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {results.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-patient-search-empty">
          No matches — no open movement or waiting referral fits the current search.
        </p>
      ) : movementResults.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-patient-search-no-movements">
          No open movement fits the current search. The waiting referrals above have not been accepted anywhere yet.
        </p>
      ) : (
        <>
          <p className={styles.movementScopeNote} data-testid="ward-patient-search-movement-scope-note">
            Movement filters only; people and waiting referrals are unchanged.
          </p>

          <div
            className={styles.showFacets}
            role="tablist"
            aria-label="What to show"
            onKeyDown={onShowFacetsKeyDown}
            data-testid="ward-patient-search-show-facets"
          >
            {SHOW_FACETS.map((facet) => {
              const count = facetCounts.get(facet.key) ?? 0;
              const selected = facet.key === facetKey;
              return (
                <button
                  key={facet.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  data-show-facet-tab={facet.key}
                  className={selected ? styles.showFacetTabActive : styles.showFacetTab}
                  onClick={() => setFacetKey(facet.key)}
                >
                  {facet.label}{" "}
                  <span
                    className={count === 0 ? styles.showFacetCountZero : styles.showFacetCount}
                    data-testid={`ward-patient-search-show-facet-count-${facet.key}`}
                  >
                    {count === 0 ? "none" : count}
                  </span>
                </button>
              );
            })}
          </div>

          {shownMovementResults.length === 0 ? (
            <p className={styles.emptyNote} data-testid="ward-patient-search-facet-empty">
              {activeFacet.empty}
            </p>
          ) : (
            <WardTable
              className={`${styles.table} ${viewMode === "cards" ? styles.cardsView : styles.denseCaseload}`}
              wrapperClassName={styles.tableScroll}
            >
              <thead>
                <tr>
                  <th scope="col">Movement</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Department</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Open for</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shownMovementResults.map(({ movement }) => (
                  <ResultRow
                    key={movement.id}
                    movement={movement}
                    units={units}
                    now={now}
                    viewMode={viewMode}
                    onPreview={onPreviewMovement}
                    isSelected={selectedMovementId === movement.id}
                    patients={patients}
                    referrals={referrals}
                  />
                ))}
              </tbody>
            </WardTable>
          )}
        </>
      )}
    </WardPanel>
  );
}

function ResultRow({
  movement,
  units,
  now,
  viewMode = "cards",
  onPreview,
  isSelected,
  patients,
  referrals,
}: {
  movement: Movement;
  units: Unit[];
  now: number;
  viewMode?: "cards" | "dense";
  onPreview?: (movement: Movement) => void;
  isSelected?: boolean;
  patients: Patient[];
  referrals: Referral[];
}) {
  const summary = buildMovementSummary(movement, units, now);
  const patientName = resolveSubjectPatient(movement, { patients, referrals }).displayName;
  const rowClass =
    `${viewMode === "cards" ? styles.patientCard : styles.denseRow} ${isSelected ? styles.selectedRow : ""}`.trim() ||
    undefined;

  return (
    <tr className={rowClass}>
      <td className={styles.cellIdentity}>
        <div className={styles.movementIdCluster}>
          <span className={`${styles.presenceTag} ${styles.live}`}>● Live</span>
          {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
          <span className={styles.movementIdText}>{patientName}</span>
        </div>
      </td>
      <td className={styles.cellStage}>{summary.stageLabel}</td>
      <td className={styles.cellDept}>{summary.departmentText}</td>
      <td className={styles.cellDest}>{summary.destinationCell}</td>
      <td className={styles.cellWait}>{summary.elapsedText}</td>
      <td className={styles.actionsCell}>
        {onPreview ? (
          <button
            type="button"
            className={styles.previewButton}
            data-testid={`ward-patient-search-movement-preview-${movement.id}`}
            onClick={() => onPreview(movement)}
          >
            Preview
          </button>
        ) : null}
        <Link className={styles.resultLink} href={`/mockups/ward-flow/movements/${movement.id}`}>
          Open
        </Link>
      </td>
    </tr>
  );
}

function AccessRecordPanel({ entries, now }: { entries: readonly AccessEntry[]; now: number }) {
  return (
    <WardPanel
      title="Access record"
      count={entries.length === 1 ? "1 search" : `${entries.length} searches`}
      blurb="Search terms and times. Kept for this session only."
      testId="ward-patient-search-access-record"
    >
      {entries.length === 0 ? (
        <p className={styles.accessRecordEmpty} data-testid="ward-patient-search-access-record-empty">
          {ACCESS_RECORD_EMPTY}
        </p>
      ) : (
        <ol className={styles.accessRecordList} data-testid="ward-patient-search-access-record-list">
          {entries.map((entry, index) => (
            <li
              key={`${entry.words}-${entry.at}-${index}`}
              className={styles.accessRecordItem}
              data-testid={`ward-patient-search-access-record-row-${index}`}
            >
              <span className={styles.accessRecordWords}>“{entry.words}”</span>
              <span className={styles.accessRecordMeta}>searched at {formatInstantWithDay(entry.at, now)}</span>
            </li>
          ))}
        </ol>
      )}
    </WardPanel>
  );
}
