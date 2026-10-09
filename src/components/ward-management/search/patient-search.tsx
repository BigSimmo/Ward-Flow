"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Clock, Copy, History, Lock, UserPlus, UsersRound, X } from "lucide-react";

import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardFoot,
  CardHead,
  Count,
  EmptyState,
  FilterChip,
  Hero,
  HeroStat,
  HeroTrack,
  Icon,
  LiveChip,
  Segmented,
  Select,
  StatusGlyph,
  TierTile,
  Timeline,
  Timer,
  buttonClass,
  cx,
  durMinutes,
} from "@/components/wf";

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
import { movementOriginService, movementSearchState, referralOriginService } from "./search-operational-state";
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
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./search.module.css";

const MS_PER_MINUTE = 60_000;

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

type KpiFacet = "all" | "live" | "unplaced" | "notin" | "breaches";

function isCommunityReferral(referral: Referral): boolean {
  return (
    referral.originSiteCode.includes("CMHT") ||
    referral.originSiteCode.includes("Clinic") ||
    (referral.homeRegion as unknown as string) === "Community"
  );
}

function matchesKpiFacet(result: PatientSearchResult, facet: KpiFacet, now: number): boolean {
  if (facet === "live") {
    if (result.kind === "movement" && !isOpen(result.movement)) return false;
    if (result.kind === "referral" && isCommunityReferral(result.referral)) return false;
  }
  if (facet === "unplaced") {
    if (result.kind === "movement" && (result.movement.acceptedUnitId || !isOpen(result.movement))) return false;
    if (result.kind === "referral" && result.referral.destinations.some((d) => d.acceptedUnitId)) return false;
  }
  if (facet === "notin") {
    if (result.kind === "movement") return false;
    if (result.kind === "referral" && !isCommunityReferral(result.referral)) return false;
  }
  if (facet === "breaches") {
    if (result.kind === "movement" && waitedHours(result.movement, now) * 60 < LONG_WAIT_MINUTES) return false;
    if (result.kind === "referral") return false;
  }
  return true;
}

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
  /** The person's record id when the subject resolves to one, for "Open patient". */
  personRecordId: string | null;
  /** When the movement opened or the referral was raised, in ward minutes. */
  openedAtInstant: number;
  /** The recorded legal due time, in ward minutes, for the "Form ending" sort. */
  legalDueAt: number | null;
  originalSubject: PatientSearchResult | { kind: "person"; patient: Patient };
}

export function PatientSearchPage() {
  const { movements, referrals, units, patients, admissions, dayZero } = useWardFlow();
  const now = useWardFlowClock();
  const [text, setText] = useState("");
  const [stage, setStage] = useState<MovementStage | "">("");
  const [edId, setEdId] = useState("");
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>("all");
  const [activeKpiFacet, setActiveKpiFacet] = useState<KpiFacet>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [settingFilter, setSettingFilter] = useState<string>("all");
  const [legalFilter, setLegalFilter] = useState<string>("all");
  const [waitFilter, setWaitFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"wait-desc" | "tier-asc" | "form-asc" | "name-asc" | "urm-asc" | "opened-desc">(
    "wait-desc",
  );
  const [viewMode, setViewMode] = useState<"cards" | "dense">("cards");
  const [requestedPreview, setPreview] = useState<PreviewSelection | null>(null);
  const [requestedSelectedId, setSelectedId] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const [accessRecord, setAccessRecord] = useState<AccessEntry[]>([]);

  const showToast = (msg: string) => setCopyNote(msg);

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

  const passes = (result: PatientSearchResult, skip: { facet?: boolean; presence?: boolean } = {}) =>
    (!isChip || matchesQuickChip(result, text, now)) &&
    (skip.facet || matchesKpiFacet(result, activeKpiFacet, now)) &&
    (skip.presence || presenceFilter === "all" || matchesPresence(result, presenceFilter)) &&
    (serviceFilter === "all" || matchesService(result, serviceFilter)) &&
    (settingFilter === "all" || matchesSetting(result, settingFilter, admissions)) &&
    (legalFilter === "all" || matchesLegal(result, legalFilter)) &&
    (waitFilter === "all" || matchesWait(result, waitFilter, now));

  const presenceCounts = {
    live: baseResults.filter((r) => passes(r, { presence: true }) && matchesPresence(r, "live")).length,
    community: baseResults.filter((r) => passes(r, { presence: true }) && matchesPresence(r, "community")).length,
    all: baseResults.filter((r) => passes(r, { presence: true })).length,
  };
  const facetCounts = {
    unplaced: baseResults.filter((r) => passes(r, { facet: true }) && matchesKpiFacet(r, "unplaced", now)).length,
    breaches: baseResults.filter((r) => passes(r, { facet: true }) && matchesKpiFacet(r, "breaches", now)).length,
  };

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
      if (settingFilter !== "all" && !matchesSetting(result, settingFilter, admissions)) return false;
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
    admissions,
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
        const operational = movementSearchState(m, admissions);
        const destUnit = m.acceptedUnitId ? units.find((u) => u.id === m.acceptedUnitId) : null;
        const destName = destUnit ? destUnit.name : "No ward yet";
        const svc = movementOriginService(m);

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
          setting: operational.setting,
          service: svc,
          legalStatus: legal,
          legalExpires,
          urgency,
          waitHours: waitH,
          openedAt: formatInstantWithDay(m.openedAt, now),
          destination: m.acceptedUnitId ?? null,
          destinationName: destName,
          holdStatus: operational.holdStatus,
          stage: stageCopy[m.stage].label,
          transportNeeded: Boolean(m.transport),
          transportStatus: operational.transportStatus,
          nurseEscort: Boolean(m.transport?.escortRequired),
          presence: "live",
          presenceLabel: "Live in Hospital",
          presenceDetail: `${operational.setting === "transit" ? "Collected from" : "Origin"} ${originText} · ${operational.holdStatus}`,
          clinicalNote: NO_CLINICAL_NOTE,
          personRecordId: info.patient?.id ?? null,
          openedAtInstant: m.openedAt,
          legalDueAt: m.legalForm?.dueAt ?? null,
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
        const svc = referralOriginService(ref.originSiteCode);

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
          personRecordId: info.patient?.id ?? null,
          openedAtInstant: ref.raisedAt,
          legalDueAt: null,
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
      if (sortBy === "form-asc") {
        // Recorded legal due times first, soonest first; rows without one keep the wait order.
        if (a.legalDueAt === null && b.legalDueAt === null) return b.waitHours - a.waitHours;
        if (a.legalDueAt === null) return 1;
        if (b.legalDueAt === null) return -1;
        return a.legalDueAt - b.legalDueAt;
      }
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "urm-asc") return a.urm.localeCompare(b.urm);
      if (sortBy === "opened-desc") return b.id.localeCompare(a.id);
      return 0;
    });
  }, [results, patients, referrals, movements, units, admissions, now, dayZero, sortBy]);

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
        ? requestedPreview.kind === "person"
          ? {
              kind: "person",
              patient:
                patients.find((patient) => patient.id === requestedPreview.patient.id) ?? requestedPreview.patient,
            }
          : selectedRow.originalSubject
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

  const applyKpiFacet = (facet: KpiFacet) => {
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

  const nowMs = now * MS_PER_MINUTE;
  const selectedTier = selectedPatient ? tierNumber(selectedPatient.urgency) : null;

  return (
    <div
      className={styles.screen}
      data-testid="ward-patient-search"
      data-ward-design="v6"
      data-ward-rebuilt-screen="patient-search"
    >
      <main id="main-content" className={styles.main}>
        <h1 className="sr-only">Patient Search</h1>
        <div data-testid="ward-patient-search-cockpit" className={styles.v6HeroWrap}>
          <Hero
            className={styles.v6Hero}
            eyebrow="Caseload"
            title="Statewide patients"
            stats={
              <>
                <HeroStat value={yieldMetrics.live} label="Live in hospital" className={styles.v6HeroStat} />
                <HeroStat value={yieldMetrics.unplaced} label="No ward yet" className={styles.v6HeroStat} />
                <HeroStat
                  value={yieldMetrics.breaches}
                  label={<span className={styles.v6HeroWrapLabel}>Waiting {LONG_WAIT_TEXT}</span>}
                  tone={yieldMetrics.breaches > 0 ? "warning" : undefined}
                  className={styles.v6HeroStat}
                />
              </>
            }
            aside={<LiveChip state="live" onHero />}
            bar={
              <div className={styles.v6HeroBar}>
                <form
                  className={styles.v6SearchForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const words = text.trim();
                    if (words.length === 0) return;
                    setAccessRecord((l) => recordSearch(l, { words, at: now }));
                  }}
                >
                  <PatientTypeahead
                    patients={patients}
                    referrals={referrals}
                    value={text}
                    onValueChange={setText}
                    label="Search"
                    placeholder="Search name, UMRN, ED or ward"
                    offerAddPerson={false}
                  />
                  <span className="sr-only">Find a person by name or record number</span>
                </form>
                {accessRecord.length > 0 ? (
                  <div className={styles.v6Session} aria-label="Searched this session">
                    <span className={styles.v6SessionLabel}>
                      <Icon icon={History} size={14} />
                      This session
                    </span>
                    {accessRecord.slice(0, 4).map((entry) => (
                      <button
                        key={`${entry.at}-${entry.words}`}
                        type="button"
                        className={styles.v6SessionChip}
                        onClick={() => setText(entry.words)}
                      >
                        <span className={styles.v6SessionWords}>{entry.words}</span>
                        <span className={styles.v6SessionAt}>{formatInstantWithDay(entry.at, now)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            }
            barAside={
              <>
                <HeroTrack
                  label="Who to show"
                  items={[
                    { id: "live", label: "Live", count: presenceCounts.live },
                    { id: "community", label: "Community", count: presenceCounts.community },
                    { id: "all", label: "All", count: presenceCounts.all },
                  ]}
                  value={presenceFilter === "live" || presenceFilter === "community" ? presenceFilter : "all"}
                  onChange={(next) => setPresenceFilter(next)}
                />
                <Link
                  href={WARD_ADD_PERSON_HREF}
                  className={buttonClass({ variant: "light", className: styles.v6AddLink })}
                  data-testid="ward-patient-search-add"
                  onClick={(event) => {
                    if (isNewTabClick(event)) {
                      handOffTypedPatientQuery("", "carried");
                      return;
                    }
                    handOffTypedPatientQuery(text, "carried");
                  }}
                >
                  <Icon icon={UserPlus} size={16} />
                  <span>Add patient</span>
                </Link>
              </>
            }
          />

          {/* The counts and filters below the bar that tests and assistive tech read directly. */}
          <div className="sr-only" data-testid="ward-patient-search-yield-strip">
            <span data-testid="ward-patient-search-yield-total">{yieldMetrics.total}</span>
            <span data-testid="ward-patient-search-yield-holds">{yieldMetrics.live}</span>
            <span data-testid="ward-patient-search-yield-transit">{yieldMetrics.transit}</span>
            <span data-testid="ward-patient-search-yield-unplaced">{yieldMetrics.unplaced}</span>
            <span id="kpi-breaches">
              Waiting {LONG_WAIT_TEXT}
              <span data-testid="ward-patient-search-yield-breaches">{yieldMetrics.breaches}</span>
              Your default, not a legal limit
            </span>

            <div aria-label="Quick queries">
              {QUICK_CHIPS.map((chip) => {
                const isActive = text === chip.query;
                return (
                  <button
                    key={chip.label}
                    type="button"
                    data-chip={chip.query}
                    onClick={() => setText(isActive ? "" : chip.query)}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            <label htmlFor="ward-patient-search-wait">Wait Band</label>
            <select
              id="ward-patient-search-wait"
              value={waitFilter}
              onChange={(e) => setWaitFilter(e.target.value)}
              aria-label="Wait Band"
            >
              <option value="all">Wait: Any ({unifiedCaseload.length})</option>
              <option value="under6">
                Under {SHORT_WAIT_HOURS} hours (
                {unifiedCaseload.filter((p) => p.waitHours < SHORT_WAIT_HOURS && p.waitHours > 0).length})
              </option>
              <option value="6to24">
                {SHORT_WAIT_HOURS} to {LONG_WAIT_HOURS} hours (
                {unifiedCaseload.filter((p) => p.waitHours >= SHORT_WAIT_HOURS && p.waitHours < LONG_WAIT_HOURS).length}
                )
              </option>
              <option value="over24">
                Over {LONG_WAIT_HOURS} hours ({unifiedCaseload.filter((p) => p.waitHours >= LONG_WAIT_HOURS).length})
              </option>
            </select>

            <label htmlFor="ward-patient-search-presence">Presence</label>
            <select
              id="ward-patient-search-presence"
              value={presenceFilter}
              onChange={(e) => setPresenceFilter(e.target.value as PresenceFilter)}
              aria-label="Presence"
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

          {refusal ? (
            <p className={styles.v6Refusal} data-testid="ward-patient-search-refusal-filter-bar">
              {refusal.sentence}
            </p>
          ) : null}
        </div>

        <Card className={styles.v6FilterBar} aria-label="Filters">
          <div className={styles.v6Chips}>
            <FilterChip
              pressed={activeKpiFacet === "unplaced"}
              onPressedChange={() => applyKpiFacet("unplaced")}
              count={facetCounts.unplaced}
              tone="neutral"
            >
              No ward yet
            </FilterChip>
            <FilterChip
              pressed={activeKpiFacet === "breaches"}
              onPressedChange={() => applyKpiFacet("breaches")}
              count={facetCounts.breaches}
              tone="warning"
            >
              Waiting {LONG_WAIT_TEXT}
            </FilterChip>
          </div>
          <span className={styles.v6BarDivider} aria-hidden="true" />
          <div className={styles.v6Selects}>
            <Select
              id="ward-patient-search-setting"
              boxClassName={styles.v6SelectBox}
              value={settingFilter}
              onChange={(e) => setSettingFilter(e.target.value)}
              aria-label="Setting"
            >
              <option value="all">Setting</option>
              <option value="ed">Emergency Dept</option>
              <option value="inpatient">Inpatient Ward</option>
              <option value="transit">In-Transit</option>
              <option value="community">Community</option>
              <option value="scheduled">Scheduled</option>
              <option value="discharged">Discharged</option>
            </Select>
            <Select
              id="ward-patient-search-service"
              boxClassName={styles.v6SelectBox}
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              aria-label="Service"
            >
              <option value="all">Service</option>
              <option value="East Metro">East Metro</option>
              <option value="North Metro">North Metro</option>
              <option value="South Metro">South Metro</option>
              <option value="WACHS">WACHS</option>
            </Select>
            <Select
              id="ward-patient-search-legal"
              boxClassName={styles.v6SelectBox}
              value={legalFilter}
              onChange={(e) => setLegalFilter(e.target.value)}
              aria-label="Legal Status"
            >
              <option value="all">All Legal Statuses ({unifiedCaseload.length})</option>
              {LEGAL_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({unifiedCaseload.filter((p) => p.legalStatus === opt.value).length})
                </option>
              ))}
            </Select>
            <Select
              id="ward-patient-search-tier"
              boxClassName={styles.v6SelectBox}
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              aria-label="Acuity Tier"
            >
              <option value="all">Tier</option>
              <option value="Tier 1">Tier 1</option>
              <option value="Tier 2">Tier 2</option>
              <option value="Tier 3">Tier 3</option>
            </Select>
          </div>
          <div className={styles.v6BarEnd}>
            {activeFilterCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                icon={X}
                onClick={resetAllFilters}
                aria-label={`Reset ${activeFilterCount} active filters`}
                data-testid="ward-patient-search-reset-filters"
              >
                Reset ({activeFilterCount})
              </Button>
            ) : (
              <button
                type="button"
                className="sr-only"
                onClick={resetAllFilters}
                data-testid="ward-patient-search-reset-filters"
              >
                Reset
              </button>
            )}
            <Segmented
              label="Row density"
              items={[
                { id: "cards", label: "Comfort" },
                { id: "dense", label: "Dense" },
              ]}
              value={viewMode}
              onChange={setViewMode}
            />
          </div>
        </Card>

        <div className={styles.v6Layout}>
          <Card
            className={styles.v6Results}
            aria-labelledby="ward-patient-search-results-console-title"
            data-testid="ward-patient-search-results-console"
          >
            <CardHead
              id="ward-patient-search-results-console-title"
              icon={UsersRound}
              title="Results"
              aside={<Count n={unifiedCaseload.length} />}
              action={
                <Segmented
                  label="Sort patient records"
                  items={[
                    { id: "wait-desc", label: "Longest wait" },
                    { id: "tier-asc", label: "Tier" },
                    { id: "form-asc", label: "Form ending" },
                    { id: "name-asc", label: "Name" },
                  ]}
                  value={sortBy === "wait-desc" || sortBy === "tier-asc" || sortBy === "form-asc" ? sortBy : "name-asc"}
                  onChange={setSortBy}
                />
              }
            />

            {refusal ? (
              <p className={styles.v6Status} role="status" aria-live="polite" data-testid="ward-patient-search-refusal">
                {refusal.sentence}
              </p>
            ) : null}

            {/* The people, movement and referral sections, the full record preview and the session's
                search record. `inert` (25 Sept 2026): out of the tab order and the accessibility tree,
                so the results are not read twice. */}
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
                  admissions={admissions}
                  now={now}
                  dayZero={dayZero}
                  onClose={() => setPreview(null)}
                />
              )}
              <AccessRecordPanel entries={accessRecord} now={now} />
            </div>

            {refusal ? null : unifiedCaseload.length === 0 ? (
              <EmptyState
                className={styles.v6Empty}
                title="No matching records"
                meta="No patient records match the current search and filters."
                action={
                  <Button size="sm" onClick={resetAllFilters}>
                    Reset all filters
                  </Button>
                }
              />
            ) : (
              <CardBody flush>
                <div className={styles.v6Head} aria-hidden="true">
                  <span>Tier</span>
                  <span>Patient</span>
                  <span>Where now</span>
                  <span>Legal</span>
                  <span>Stage</span>
                  <span className={styles.v6End}>Waiting</span>
                </div>
                {viewMode === "dense" ? (
                  <div className={styles.v6List} role="table" aria-label="Dense caseload list">
                    {unifiedCaseload.map((p) => renderRow(p, true))}
                  </div>
                ) : (
                  <div className={styles.v6List} aria-label="Caseload cards">
                    {unifiedCaseload.map((p) => renderRow(p, false))}
                  </div>
                )}
              </CardBody>
            )}
            <CardFoot meta={`${unifiedCaseload.length} ${unifiedCaseload.length === 1 ? "record" : "records"}`}>
              <span className={styles.v6Muted}>Names are invented</span>
            </CardFoot>
          </Card>

          <Card className={styles.v6Preview} role="region" aria-label="Patient details">
            {selectedPatient ? (
              <>
                <div className={styles.v6PreviewHead}>
                  <Avatar name={selectedPatient.name} size="lg" decorative />
                  <div className={styles.v6PreviewId}>
                    <h2 className={styles.v6PreviewName}>{selectedPatient.name}</h2>
                    <span className={styles.v6Sub}>
                      <span className={styles.v6Mono}>{selectedPatient.urm}</span> · {ageSexText(selectedPatient)} ·{" "}
                      {selectedPatient.service}
                    </span>
                  </div>
                </div>
                <div className={styles.v6PreviewStatus}>
                  {selectedTier !== null ? <TierTile tier={selectedTier} /> : null}
                  <span className={styles.v6Stage}>
                    <StatusGlyph tone={stageTone(selectedPatient)} size={9} />
                    {selectedPatient.stage}
                  </span>
                  <span className={styles.v6PreviewWait}>
                    <Icon icon={Clock} size={14} />
                    {selectedPatient.waitHours > 0 ? (
                      <Timer
                        at={selectedPatient.openedAtInstant * MS_PER_MINUTE}
                        now={nowMs}
                        direction="waiting"
                        hideFlagWord
                      />
                    ) : (
                      "No wait"
                    )}
                  </span>
                </div>
                <dl className={styles.v6Facts}>
                  <div>
                    <dt>Where now</dt>
                    <dd>{formatSiteAcronym(selectedPatient.origin)}</dd>
                    <dd className={styles.v6Sub}>Opened {selectedPatient.openedAt}</dd>
                  </div>
                  <div>
                    <dt>Heading to</dt>
                    <dd>{selectedPatient.destinationName}</dd>
                    <dd className={styles.v6Sub}>{selectedPatient.holdStatus}</dd>
                  </div>
                  <div>
                    <dt>Legal authority</dt>
                    <dd>{selectedPatient.legalStatus}</dd>
                    <dd className={styles.v6Sub}>{statutoryDetails.title}</dd>
                  </div>
                  <div>
                    <dt>Transport</dt>
                    <dd>{selectedPatient.transportStatus}</dd>
                    {selectedPatient.nurseEscort ? <dd className={styles.v6Sub}>Nurse escort</dd> : null}
                  </div>
                </dl>
                <div className={styles.v6PreviewSection}>
                  <span className={styles.v6SectionHead}>Legal due time</span>
                  <span className={cx(/left|overdue/.test(selectedPatient.legalExpires) && styles.v6Mono)}>
                    {selectedPatient.legalExpires === "Voluntary status"
                      ? "Not detained"
                      : selectedPatient.legalExpires}
                  </span>
                </div>
                <div className={styles.v6PreviewSection}>
                  <span className={styles.v6SectionHead}>Latest</span>
                  <Timeline
                    label="Latest for this record"
                    holdNew={false}
                    items={[
                      {
                        id: `${selectedPatient.id}-opened`,
                        at: selectedPatient.openedAt,
                        tone: "info",
                        text: `Record active from ${formatSiteAcronym(selectedPatient.origin)}`,
                      },
                    ]}
                  />
                </div>
                {selectedPatient.communityTeam ? (
                  <div className={styles.v6PreviewSection}>
                    <span className={styles.v6SectionHead}>Community team</span>
                    <span>{selectedPatient.communityTeam}</span>
                  </div>
                ) : null}
                <CardFoot
                  meta={
                    copyNote ? (
                      <span role="status" aria-live="polite">
                        {copyNote}
                      </span>
                    ) : undefined
                  }
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Copy}
                    iconOnly
                    aria-label="Copy summary"
                    title="Copy summary"
                    onClick={copyPatientSummary}
                  />
                  {selectedPatient.originalSubject.kind === "movement" ? (
                    <Link
                      className={buttonClass({ size: "sm" })}
                      href={`/mockups/ward-flow/movements/${selectedPatient.originalSubject.movement.id}`}
                    >
                      Open movement
                    </Link>
                  ) : (
                    <Link className={buttonClass({ size: "sm" })} href="/mockups/ward-flow/referrals/new">
                      New referral
                    </Link>
                  )}
                  {selectedPatient.personRecordId ? (
                    <Link
                      className={buttonClass({ variant: "pri", size: "sm" })}
                      href={`/mockups/ward-flow/people/${selectedPatient.personRecordId}`}
                    >
                      Open patient
                    </Link>
                  ) : null}
                </CardFoot>
              </>
            ) : (
              <EmptyState title="Nothing selected" meta="Choose a row to see the record." />
            )}
          </Card>
        </div>

        <WardPrototypeFooter
          testId="ward-patient-search-governance"
          note="Demonstration records only — Not a medical device. Cross-setting index across people, movements and active referrals."
        />
      </main>
    </div>
  );

  function renderRow(p: UnifiedCaseloadPatient, dense: boolean) {
    const isSelected = p.id === selectedId;
    const tier = tierNumber(p.urgency);
    const cell = dense ? ({ role: "cell" } as const) : {};
    const select = () => handleSelectPatient(p);
    return (
      <div
        key={p.id}
        className={cx(styles.v6Row, dense && styles.v6RowDense, isSelected && styles.selected)}
        data-id={p.id}
        data-testid={`ward-patient-search-case-${p.id}`}
        onClick={select}
        onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            select();
          }
        }}
        tabIndex={0}
        {...(dense
          ? { role: "row", "aria-selected": isSelected }
          : { role: "button", "aria-pressed": isSelected, "aria-label": `Patient ${p.name}` })}
      >
        <span {...cell} className={styles.v6TierCell}>
          {tier !== null ? <TierTile tier={tier} /> : <span className={styles.v6Muted}>{p.urgency}</span>}
        </span>
        <span {...cell} className={styles.v6Cell}>
          <span className={styles.v6Name}>
            {p.name}
            {p.confidential ? (
              <span className={styles.v6Restricted} data-testid={`ward-patient-confidential-${p.id}`}>
                <Icon icon={Lock} size={14} />
                Restricted
              </span>
            ) : null}
          </span>
          {dense ? null : (
            <span className={styles.v6Sub}>
              <span className={styles.v6Mono}>{p.urm}</span> · {ageSexText(p)} · {p.service}
            </span>
          )}
        </span>
        <span {...cell} className={styles.v6Cell}>
          <span className={styles.v6Strong}>{formatSiteAcronym(p.origin)}</span>
          {dense ? null : (
            <span className={styles.v6Sub}>
              {p.destinationName !== "No ward yet"
                ? p.destinationName
                : p.presence === "past"
                  ? "Discharged"
                  : "No ward yet"}
            </span>
          )}
        </span>
        <span {...cell} className={styles.v6Cell}>
          <span className={styles.v6Strong}>{p.legalStatus}</span>
          {dense ? null : (
            <span className={cx(styles.v6Sub, /left|overdue/.test(p.legalExpires) && styles.v6Mono)}>
              {p.legalExpires === "Voluntary status" ? "Not detained" : p.legalExpires}
            </span>
          )}
        </span>
        <span {...cell} className={styles.v6Cell}>
          <span className={styles.v6Stage}>
            <StatusGlyph tone={stageTone(p)} size={9} />
            {p.stage}
          </span>
          {dense ? null : <span className={styles.v6Sub}>{p.holdStatus}</span>}
        </span>
        <span {...cell} className={cx(styles.v6Cell, styles.v6End)}>
          <span className={styles.v6Wait}>{p.waitHours > 0 ? durMinutes(Math.round(p.waitHours * 60)) : "—"}</span>
          {dense ? null : <span className={styles.v6Sub}>waiting</span>}
        </span>
      </div>
    );
  }
}

function tierNumber(urgency: string): number | null {
  const match = /^Tier (\d)$/.exec(urgency);
  return match ? Number(match[1]) : null;
}

/** Colour as a glyph: placed and moving are good news, everything else waits in neutral. */
function stageTone(p: UnifiedCaseloadPatient): "success" | "info" | "neutral" {
  if (p.holdStatus === "Bed hold active") return "success";
  if (p.setting === "transit") return "info";
  return "neutral";
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
