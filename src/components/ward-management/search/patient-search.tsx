"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { UserPlus } from "lucide-react";

import { Card, Drawer, Hero, Icon, LiveChip, buttonClass, cx } from "@/components/wf";

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
  formatInstant,
  formatInstantWithDay,
  formatRemaining,
  minutesUntil,
} from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  findPatients,
  foldPatientSearchText,
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

import {
  CENSUS_GROUPS,
  CENSUS_HIGHLIGHTS,
  buildCensus,
  censusLine,
  parseDob,
  sortCensusRows,
  type CensusGroup,
  type CensusHighlight,
  type CensusRow,
  type CensusSort,
} from "./patient-census";
import {
  CensusDetail,
  CensusEmpty,
  CensusHistory,
  CensusMapPills,
  CensusTable,
  FlowChip,
  PhoneCensus,
  PhoneDobField,
  SearchAdornment,
  ShiftSummary,
} from "./patient-census-view";

import styles from "./search.module.css";
import cs from "./census.module.css";

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
  const { movements, referrals, units, patients, admissions, plannedAdmissions = [], dayZero } = useWardFlow();
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
  // The legacy list's order. The census sorts itself (`censusSort`); this keeps the inert record list stable.
  const sortBy = "wait-desc" as "wait-desc" | "tier-asc" | "form-asc" | "name-asc" | "urm-asc" | "opened-desc";
  const viewMode = "cards" as "cards" | "dense";
  const [requestedPreview, setPreview] = useState<PreviewSelection | null>(null);
  const [requestedSelectedId, setSelectedId] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const [accessRecord, setAccessRecord] = useState<AccessEntry[]>([]);
  // Below the two column layout the record card would sit under every row, so a tap opens it in a
  // drawer instead, and focus goes back to the row on close.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsTriggerRef = useRef<HTMLElement | null>(null);
  const [dobOn, setDobOn] = useState(false);
  const [dob, setDob] = useState("");
  const [soleDismissedFor, setSoleDismissedFor] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<CensusHighlight | null>(null);
  const [censusSort, setCensusSort] = useState<CensusSort>("wait");
  const [tab, setTab] = useState<"now" | "history">("now");
  const [openGroups, setOpenGroups] = useState<Record<CensusGroup, boolean>>({
    wait: true,
    found: true,
    move: true,
    ward: false,
    off: false,
  });
  const [showAllWard, setShowAllWard] = useState(false);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [phoneGroup, setPhoneGroup] = useState<CensusGroup>("wait");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const showToast = (msg: string) => setCopyNote(msg);

  useEffect(() => {
    // The record drawer is modal: the search behind it stays put until it closes.
    if (detailsOpen) return;
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
  }, [detailsOpen]);

  const query: MovementSearchQuery = useMemo(
    () => ({
      text,
      stage: stage === "" ? undefined : stage,
      edId: edId === "" ? undefined : edId,
    }),
    [text, stage, edId],
  );

  const isChip = isQuickChipQuery(text);

  /*
   * Each row's person, as the table shows them: display name and record number. The engine's own
   * text match reads the record's id, department, ward, stage and owner, none of which holds the
   * name, so typing a name the table shows used to empty the table (9 Oct 2026).
   */
  const subjectWords = useMemo(() => {
    const words = new Map<string, string>();
    const context = { patients, referrals, movements };
    for (const movement of movements) {
      const info = resolveSubjectPatient(movement, context);
      words.set(movement.id, foldPatientSearchText(`${info.displayName} ${info.umrn}`));
    }
    for (const referral of referrals) {
      const info = resolveSubjectPatient(referral, context);
      words.set(referral.id, foldPatientSearchText(`${info.displayName} ${info.umrn}`));
    }
    return words;
  }, [patients, referrals, movements]);

  const baseResults = useMemo(() => {
    const needle = foldPatientSearchText(text);
    if (isChip || needle === "") return searchPatients(movements, referrals, units, { ...query, text: "" });
    const byRecord = new Set(searchPatients(movements, referrals, units, query).map(resultId));
    return searchPatients(movements, referrals, units, { ...query, text: "" }).filter(
      (result) => byRecord.has(resultId(result)) || (subjectWords.get(resultId(result)) ?? "").includes(needle),
    );
  }, [movements, referrals, units, query, isChip, text, subjectWords]);

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
      if (tierFilter !== "all" && !matchesTier(result, tierFilter)) return false;
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
    tierFilter,
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
    if (dobOn && parseDob(dob) !== null) count++;
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
    dobOn,
    dob,
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
    setDob("");
    setDobOn(false);
  };

  // The counts beside each stage and department match the same way the table does, name included.
  const { stageCounts, allStagesCount, departmentCounts, allDepartmentsCount } = useMemo(() => {
    const needle = isChip ? "" : foldPatientSearchText(text);
    const countMovements = (stage?: MovementStage, edId?: string) => {
      const byRecord = new Set(searchMovements(movements, units, { text, stage, edId }).map((m) => m.id));
      return searchMovements(movements, units, { text: "", stage, edId }).filter(
        (m) =>
          text.trim() === "" ||
          byRecord.has(m.id) ||
          (needle !== "" && (subjectWords.get(m.id) ?? "").includes(needle)),
      ).length;
    };
    return {
      stageCounts: new Map<MovementStage, number>(
        SELECTABLE_STAGES.map((candidate) => [candidate, countMovements(candidate, query.edId)]),
      ),
      allStagesCount: countMovements(undefined, query.edId),
      departmentCounts: new Map<string, number>(
        allEmergencyDepartments().map((ed) => [ed.id, countMovements(query.stage, ed.id)]),
      ),
      allDepartmentsCount: countMovements(query.stage, undefined),
    };
  }, [movements, units, text, isChip, subjectWords, query.stage, query.edId]);

  // ═══ THE CENSUS (Josh's pick, 9 Oct 2026: direction A with search bar 1) ═══
  // Every person the app holds, grouped by where they are now. The movement and referral rows are
  // the same records as `unifiedCaseload` above, so every search and filter that narrows that list
  // narrows these rows the same way; the bed and record rows answer the typed name or UMRN.
  const census = useMemo(
    () => buildCensus({ movements, referrals, units, patients, admissions, plannedAdmissions, now, dayZero }),
    [movements, referrals, units, patients, admissions, plannedAdmissions, now, dayZero],
  );
  const isPhone = usePhoneLayout();
  const needle = isChip ? "" : foldPatientSearchText(text);
  const dobIso = dobOn ? parseDob(dob) : null;
  const searching = needle !== "" || dobIso !== null;
  // Ward and person rows carry no stage, department, service, legal, wait or tier, so those filters
  // leave them out; a setting or presence filter keeps the ward rows it names.
  const legacyNarrowing =
    isChip ||
    stage !== "" ||
    edId !== "" ||
    activeKpiFacet !== "all" ||
    serviceFilter !== "all" ||
    legalFilter !== "all" ||
    waitFilter !== "all" ||
    tierFilter !== "all";

  const caseIds = useMemo(() => new Set(unifiedCaseload.map((row) => row.id)), [unifiedCaseload]);
  const peopleIds = useMemo(() => new Set<string>(people.map((person) => person.id)), [people]);
  const visibleRows = useMemo(() => {
    const lifted = highlightTest(highlight);
    return sortCensusRows(
      (refusal ? [] : census.rows).filter((row) => {
        if (row.kind === "movement" || row.kind === "referral") {
          // A place shown in the census also finds the case, not only the legacy record search.
          if (!caseIds.has(row.key) && !(needle.length >= 2 && row.placeText.includes(needle))) return false;
        } else {
          if (legacyNarrowing) return false;
          const onWard = row.kind === "admission" && row.group === "ward";
          if (settingFilter === "inpatient" && !(onWard && !row.awayAtEd)) return false;
          if (settingFilter === "ed" && !(onWard && row.awayAtEd)) return false;
          if (settingFilter !== "all" && settingFilter !== "inpatient" && settingFilter !== "ed") return false;
          if (presenceFilter !== "all" && !(presenceFilter === "live" && onWard)) return false;
          if (
            needle !== "" &&
            !row.searchText.includes(needle) &&
            !(row.patientRecordId !== null && peopleIds.has(row.patientRecordId)) &&
            !(needle.length >= 2 && row.placeText.includes(needle))
          ) {
            return false;
          }
        }
        return dobIso === null || (row.dob ?? "").startsWith(dobIso);
      }),
      censusSort,
      lifted,
    );
  }, [
    census,
    refusal,
    caseIds,
    peopleIds,
    legacyNarrowing,
    settingFilter,
    presenceFilter,
    needle,
    dobIso,
    censusSort,
    highlight,
  ]);

  const groupTotals = countGroups(census.rows);
  const groupMatches = countGroups(visibleRows);
  const liveCount = census.rows.length - groupTotals.off;
  const highlightCounts = Object.fromEntries(
    CENSUS_HIGHLIGHTS.map((chip) => [chip.id, census.rows.filter(chip.test).length]),
  ) as Record<CensusHighlight, number>;

  // A search that finds exactly one person opens them; otherwise the panel shows this shift until a
  // row is chosen.
  // Closing that detail keeps it closed until the search itself changes.
  const searchKey = `${needle}|${dobIso ?? ""}`;
  const selectedCensus =
    visibleRows.find((row) => row.key === requestedSelectedId) ??
    (searching && visibleRows.length === 1 && soleDismissedFor !== searchKey ? visibleRows[0]! : null);
  const selectedId = selectedCensus?.key ?? null;
  const selectedRow = unifiedCaseload.find((row) => row.id === selectedId) ?? null;
  // The drawer belongs to the row that opened it. If that row leaves the results the drawer closes,
  // and the open flag is cleared here (during render, not in an effect) so the shortcut comes back
  // and the drawer cannot reopen by itself if the row later returns.
  const drawerOpen = detailsOpen && requestedSelectedId !== null && selectedId === requestedSelectedId;
  if (detailsOpen && !drawerOpen) setDetailsOpen(false);

  // If the page widens into two columns while the drawer is open (a tablet turned to landscape, a
  // wider window), the side card now shows the same record, so the drawer closes. The phone layout
  // unmounts the card, so the observer re-attaches to the new card when that layout changes.
  useEffect(() => {
    if (!drawerOpen || typeof ResizeObserver === "undefined") return;
    const card = document.querySelector<HTMLElement>("[data-preview-card]");
    if (card === null) return;
    const observer = new ResizeObserver(() => {
      if (!previewCardHidden()) setDetailsOpen(false);
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, [drawerOpen, isPhone]);
  const preview: PreviewSelection | null =
    selectedRow === null
      ? requestedPreview?.kind === "person"
        ? {
            kind: "person",
            patient: patients.find((patient) => patient.id === requestedPreview.patient.id) ?? requestedPreview.patient,
          }
        : null
      : requestedPreview && (requestedSelectedId === null || selectedId === requestedSelectedId)
        ? requestedPreview.kind === "person"
          ? {
              kind: "person",
              patient:
                patients.find((patient) => patient.id === requestedPreview.patient.id) ?? requestedPreview.patient,
            }
          : selectedRow.originalSubject
        : selectedRow.originalSubject;

  const selectRow = (row: CensusRow, trigger?: HTMLElement) => {
    setSelectedId(row.key);
    setExpandedKey((current) => (current === row.key ? null : row.key));
    if (trigger && !isPhone && previewCardHidden()) {
      detailsTriggerRef.current = trigger;
      setDetailsOpen(true);
    }
    const movement = row.kind === "movement" ? movements.find((m) => m.id === row.key) : undefined;
    const referral = row.kind === "referral" ? referrals.find((r) => r.id === row.key) : undefined;
    const person = row.patientRecordId ? patients.find((p) => p.id === row.patientRecordId) : undefined;
    setPreview(
      movement
        ? { kind: "movement", movement }
        : referral
          ? { kind: "referral", referral }
          : person
            ? { kind: "person", patient: person }
            : null,
    );
  };

  const jumpToRow = (row: CensusRow) => {
    setTab("now");
    setOpenGroups((current) => ({ ...current, [row.group]: true }));
    if (row.group === "ward") setShowAllWard(true);
    selectRow(row);
    setFlashKey(row.key);
    window.setTimeout(() => {
      document
        .querySelector(`[data-id="${CSS.escape(row.key)}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 30);
    window.setTimeout(() => setFlashKey(null), 1800);
  };

  const jumpToGroup = (group: CensusGroup) => {
    setTab("now");
    setPhoneGroup(group);
    setOpenGroups((current) => ({ ...current, [group]: true }));
    window.setTimeout(() => {
      document
        .getElementById(`ward-patient-search-group-${group}`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 30);
  };

  const copyText = (body: string, done: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(body).then(
        () => showToast(done),
        () => showToast("Copy was blocked by the browser"),
      );
    } else {
      showToast("Copy was blocked by the browser");
    }
  };
  const copyRow = (row: CensusRow) => copyText(`${censusLine(row)} (synthetic)`, "Summary copied");
  const copyList = () => {
    const chip = CENSUS_HIGHLIGHTS.find((entry) => entry.id === highlight);
    const list = chip
      ? visibleRows.filter(chip.test)
      : visibleRows.filter((row) => row.group !== "ward" && row.group !== "off");
    copyText(
      [`Patients at ${formatInstant(now)} (synthetic)`, ...list.map((row) => `- ${censusLine(row)}`)].join("\n"),
      `${list.length} ${list.length === 1 ? "row" : "rows"} copied`,
    );
  };

  // While a search runs on the phone, a group with no match gives way to the first one with any.
  const phoneGroupShown =
    searching && groupMatches[phoneGroup] === 0
      ? (CENSUS_GROUPS.find((group) => groupMatches[group.id] > 0)?.id ?? phoneGroup)
      : phoneGroup;
  const historyCount = census.closedToday.length + accessRecord.length;
  const addPatientClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (isNewTabClick(event)) {
      handOffTypedPatientQuery("", "carried");
      return;
    }
    handOffTypedPatientQuery(text, "carried");
  };

  const searchForm = (
    <form
      className={cx(cs.searchForm, isPhone && cs.searchFormPhone)}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const words = `${text} ${dobOn ? dob : ""}`.trim();
        if (words.length === 0) return;
        setAccessRecord((l) => recordSearch(l, { words, text, dob: dobOn ? dob : undefined, at: now }));
      }}
    >
      <PatientTypeahead
        patients={patients}
        referrals={referrals}
        value={text}
        onValueChange={(next) => {
          setText(next);
          setTab("now");
        }}
        label="Search"
        placeholder={dobOn ? "Family or given name" : "Name, UMRN or place"}
        offerAddPerson={false}
        suggestions={false}
        adornment={
          <SearchAdornment
            dobOn={dobOn}
            onDobToggle={() => setDobOn((on) => !on)}
            dob={dob}
            onDob={setDob}
            count={searching ? visibleRows.length : null}
            empty={text.length === 0}
            phone={isPhone}
          />
        }
      />
      {isPhone && dobOn ? <PhoneDobField dob={dob} onDob={setDob} /> : null}
      <span className="sr-only">Find a person by name or record number</span>
      {/* The census, not the typeahead, says how many people a search found. */}
      <p className="sr-only" role="status" aria-live="polite">
        {!searching || refusal
          ? ""
          : visibleRows.length === 0
            ? "Nobody matches."
            : `${visibleRows.length} invented ${visibleRows.length === 1 ? "person" : "people"} found.`}
      </p>
    </form>
  );

  const history = (
    <CensusHistory
      searches={accessRecord}
      closed={census.closedToday}
      now={now}
      onRerun={(entry) => {
        setText(entry.text ?? entry.words);
        setDob(entry.dob ?? "");
        setDobOn(entry.dob !== undefined);
        setTab("now");
      }}
    />
  );
  const empty = (
    <CensusEmpty
      query={`${text} ${dobOn ? dob : ""}`.trim()}
      onReset={resetAllFilters}
      addHref={WARD_ADD_PERSON_HREF}
      onAdd={addPatientClick}
    />
  );
  const refusalNotice = refusal ? (
    <p className={cs.notice} role="status" aria-live="polite" data-testid="ward-patient-search-refusal">
      {refusal.sentence}
    </p>
  ) : null;
  const detailOrSummary = (closeable: boolean) =>
    selectedCensus ? (
      <CensusDetail
        row={selectedCensus}
        now={now}
        onClose={
          closeable
            ? () => {
                setSelectedId(null);
                setSoleDismissedFor(searchKey);
              }
            : undefined
        }
        onCopy={copyRow}
        copyNote={copyNote}
      />
    ) : (
      <ShiftSummary
        rows={census.rows}
        closedToday={census.closedToday}
        now={now}
        highlight={highlight}
        highlightCounts={highlightCounts}
        onSelect={jumpToRow}
        onHighlight={(chip) => {
          setTab("now");
          setHighlight((current) => (current === chip ? null : chip));
        }}
        onHistory={() => setTab("history")}
      />
    );

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
            className={cx(cs.censusHero, isPhone && cs.heroPhone)}
            eyebrow="Statewide census"
            title={`${liveCount} patients now`}
            aside={
              <>
                {isPhone ? null : <FlowChip closed={census.closedToday} onOpen={() => setTab("history")} />}
                <LiveChip state="live" onHero />
                {isPhone ? null : (
                  <Link
                    href={WARD_ADD_PERSON_HREF}
                    className={buttonClass({ variant: "light", size: "sm" })}
                    data-testid="ward-patient-search-add"
                    onClick={addPatientClick}
                  >
                    <Icon icon={UserPlus} size={14} />
                    <span>Add patient</span>
                  </Link>
                )}
              </>
            }
            bar={
              <div className={cs.heroBar}>
                {searchForm}
                {isPhone ? null : (
                  <CensusMapPills
                    totals={groupTotals}
                    matched={groupMatches}
                    searching={searching}
                    onJump={jumpToGroup}
                  />
                )}
              </div>
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

            <label htmlFor="ward-patient-search-setting">Setting</label>
            <select
              id="ward-patient-search-setting"
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
            </select>

            <label htmlFor="ward-patient-search-service">Service</label>
            <select
              id="ward-patient-search-service"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              aria-label="Service"
            >
              <option value="all">Service</option>
              <option value="East Metro">East Metro</option>
              <option value="North Metro">North Metro</option>
              <option value="South Metro">South Metro</option>
              <option value="WACHS">WACHS</option>
            </select>

            <label htmlFor="ward-patient-search-legal">Legal Status</label>
            <select
              id="ward-patient-search-legal"
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
            </select>

            <label htmlFor="ward-patient-search-tier">Acuity Tier</label>
            <select
              id="ward-patient-search-tier"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              aria-label="Acuity Tier"
            >
              <option value="all">Tier</option>
              <option value="Tier 1">Tier 1</option>
              <option value="Tier 2">Tier 2</option>
              <option value="Tier 3">Tier 3</option>
            </select>

            <button
              type="button"
              onClick={resetAllFilters}
              data-testid="ward-patient-search-reset-filters"
              aria-label={activeFilterCount > 0 ? `Reset ${activeFilterCount} active filters` : "Reset"}
            >
              Reset ({activeFilterCount})
            </button>
          </div>

          {refusal ? (
            <p className={styles.v6Refusal} data-testid="ward-patient-search-refusal-filter-bar">
              {refusal.sentence}
            </p>
          ) : null}
        </div>

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

        {isPhone ? (
          <PhoneCensus
            rows={visibleRows}
            totals={groupTotals}
            matched={groupMatches}
            searching={searching}
            needle={needle}
            group={phoneGroupShown}
            onGroup={setPhoneGroup}
            highlight={highlight}
            onHighlight={setHighlight}
            highlightCounts={highlightCounts}
            lifted={highlightTest(highlight)}
            expandedKey={expandedKey}
            onExpand={(row) => selectRow(row)}
            onCopy={copyRow}
            copyNote={copyNote}
            tab={tab}
            onTab={setTab}
            history={history}
            historyCount={historyCount}
            empty={refusalNotice ?? empty}
          />
        ) : (
          <div className={cs.layout}>
            <CensusTable
              rows={refusal ? [] : visibleRows}
              totalPeople={census.rows.length}
              searching={searching}
              needle={needle}
              sort={censusSort}
              onSort={setCensusSort}
              highlight={highlight}
              onHighlight={setHighlight}
              highlightCounts={highlightCounts}
              lifted={highlightTest(highlight)}
              openGroups={openGroups}
              onToggleGroup={(group, open) => setOpenGroups((current) => ({ ...current, [group]: open }))}
              showAllWard={showAllWard}
              onShowAllWard={() => setShowAllWard(true)}
              selectedKey={selectedId}
              flashKey={flashKey}
              onSelect={selectRow}
              tab={tab}
              onTab={setTab}
              liveCount={liveCount}
              historyCount={historyCount}
              history={history}
              onCopyList={copyList}
              copyNote={selectedCensus ? null : copyNote}
              empty={refusal ? null : empty}
              notice={refusalNotice}
            />
            <Card className={cs.side} role="region" aria-label="Patient details" data-preview-card>
              {detailOrSummary(true)}
            </Card>
          </div>
        )}

        <Drawer
          open={drawerOpen}
          onClose={() => {
            setDetailsOpen(false);
          }}
          title="Patient details"
          closeLabel="Close patient details"
          closeButtonClassName={styles.v6DetailsDrawerClose}
          returnFocusRef={detailsTriggerRef}
          testId="ward-patient-search-details"
        >
          <div className={styles.v6DetailsSheet}>{detailOrSummary(false)}</div>
        </Drawer>

        <WardPrototypeFooter
          testId="ward-patient-search-governance"
          note="Demonstration records only — Not a medical device. Cross-setting index across people, movements, active referrals and beds."
        />
      </main>
    </div>
  );
}

const PHONE_QUERY = "(max-width: 40rem)";

function subscribePhone(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const list = window.matchMedia(PHONE_QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/** Phone is its own design (Josh, 9 Oct 2026): below 40rem the census renders its phone layout. */
function usePhoneLayout(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

function highlightTest(highlight: CensusHighlight | null): (row: CensusRow) => boolean {
  const chip = CENSUS_HIGHLIGHTS.find((entry) => entry.id === highlight);
  return chip ? chip.test : () => false;
}

function countGroups(rows: readonly CensusRow[]): Record<CensusGroup, number> {
  const counts: Record<CensusGroup, number> = { wait: 0, found: 0, move: 0, ward: 0, off: 0 };
  for (const row of rows) counts[row.group] += 1;
  return counts;
}

/**
 * The stylesheet decides when the page is one column, from the page's own width, and hides the side
 * card then. A tap opens the drawer exactly when that card cannot be seen.
 */
function previewCardHidden(): boolean {
  if (typeof document === "undefined") return false;
  const card = document.querySelector<HTMLElement>("[data-preview-card]");
  return card !== null && getComputedStyle(card).display === "none";
}

function resultId(result: PatientSearchResult): string {
  return result.kind === "movement" ? result.movement.id : result.referral.id;
}

/** The Tier select holds "Tier 1" to "Tier 3", the same words each row shows. */
function matchesTier(result: PatientSearchResult, tier: string): boolean {
  const urgency = result.kind === "movement" ? result.movement.urgency : result.referral.urgency;
  return `Tier ${urgency}` === tier;
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
