"use client";

import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { UserPlus } from "lucide-react";

import {
  Card,
  Drawer,
  Hero,
  Icon,
  LiveChip,
  SearchField,
  buttonClass,
  cx,
  phoneRows,
  useMediaQuery,
} from "@/components/wf";

import { MOVEMENT_STAGES } from "@/components/ward-management/ward-model";
import type { Movement, MovementStage } from "@/components/ward-management/ward-model";
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
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import {
  findPatients,
  foldPatientSearchText,
  nearPatients,
  patientAgeYears,
  type Patient,
} from "@/components/ward-management/ward-patients";
import { WARD_ADD_PERSON_HREF } from "@/components/ward-management/ward-nav";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { movementOriginLabel } from "@/components/ward-management/ward-movement-origin";
import { edById } from "@/components/ward-management/ward-sites";
import { LONG_WAIT_MINUTES, LONG_WAIT_TEXT } from "@/components/ward-management/ward-operational-defaults";

import { recordSearch, type AccessEntry } from "./access-record";
import { handOffTypedPatientQuery, isNewTabClick, takeHandedOffPatientSearchText } from "./patient-query-handoff";
import { RecordPreview, type PreviewSelection } from "./record-preview";
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
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import {
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
  DobField,
  DobToggle,
  ShiftSummary,
} from "./patient-census-view";

import styles from "./search.module.css";
import cs from "./census.module.css";
import { isCommunityReferral } from "./community-referral";
import {
  LONG_WAIT_HOURS,
  SHORT_WAIT_HOURS,
  countGroups,
  getPatientPresence,
  highlightTest,
  matchesTier,
  previewCardHidden,
  resultId,
  waitedHours,
} from "./patient-search-model";
import { AccessRecordPanel, PeopleSection, ResultsSection } from "./patient-search-sections";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { rememberReturnRow, rowWithAttribute, useReturnedView, useReturnToPlace } from "../use-return-to-place";

// Moved to `patient-search-sections.tsx`; re-exported so existing importers keep working.
export { ResultsSection };

const PATIENTS_ROUTE = "/ward-flow/search";
/**
 * What Back brings back (`use-return-to-place.ts`): the census's tab, filters, order and opened
 * groups. The typed search text and the date of birth are never kept.
 */
type PatientsPlace = {
  stage: MovementStage | "";
  edId: string;
  presenceFilter: PresenceFilter;
  activeKpiFacet: KpiFacet;
  serviceFilter: string;
  settingFilter: string;
  legalFilter: string;
  waitFilter: string;
  tierFilter: string;
  highlight: CensusHighlight | null;
  censusSort: CensusSort;
  tab: "now" | "history";
  openGroups: Record<CensusGroup, boolean>;
  showAllWard: boolean;
};
/** The census row: a table row on desktop and tablet, the row's own button on a phone. */
const censusRow = (id: string) => rowWithAttribute("data-id", id);

const stageIsSearchable = (stage: MovementStage) => isOpen({ stage, closure: undefined } as Movement);
const SELECTABLE_STAGES = MOVEMENT_STAGES.filter(stageIsSearchable);

type KpiFacet = "all" | "live" | "unplaced" | "notin" | "breaches";

function originDepartmentText(movement: Movement): string {
  const originEd = edById(movement.originEdId);
  return movementOriginLabel(movement, originEd && `${originEd.name} (${originEd.siteCode})`);
}

const NO_CLINICAL_NOTE = "No clinical note is recorded in Ward Flow.";

/** Whole years from the recorded date of birth, or `null` when there is none to read. */
function recordedAge(patient: Patient | undefined, today: Date): number | null {
  if (!patient) return null;
  const years = patientAgeYears(patient, today);
  return Number.isFinite(years) && years >= 0 ? years : null;
}

interface UnifiedCaseloadPatient {
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
  const thresholds = useDueSoonThresholds();
  const {
    movements,
    referrals,
    units,
    patients,
    admissions,
    plannedAdmissions = [],
    dayZero,
  } = useWardFlowSelect("movements", "referrals", "units", "patients", "admissions", "plannedAdmissions", "dayZero");
  const now = useWardFlowClock();
  // shell-6: a "Person not found" page can hand a UMRN over in memory, never in the address.
  const [text, setText] = useState(() => takeHandedOffPatientSearchText() ?? "");
  // Return to your place (usability item 3, 24 Oct 2026): null unless Back brought us here.
  const returned = useReturnedView<PatientsPlace>(PATIENTS_ROUTE);
  const [stage, setStage] = useState<MovementStage | "">(returned?.stage ?? "");
  const [edId, setEdId] = useState(returned?.edId ?? "");
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>(returned?.presenceFilter ?? "all");
  const [activeKpiFacet, setActiveKpiFacet] = useState<KpiFacet>(returned?.activeKpiFacet ?? "all");
  const [serviceFilter, setServiceFilter] = useState<string>(returned?.serviceFilter ?? "all");
  const [settingFilter, setSettingFilter] = useState<string>(returned?.settingFilter ?? "all");
  const [legalFilter, setLegalFilter] = useState<string>(returned?.legalFilter ?? "all");
  const [waitFilter, setWaitFilter] = useState<string>(returned?.waitFilter ?? "all");
  const [tierFilter, setTierFilter] = useState<string>(returned?.tierFilter ?? "all");
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
  const [highlight, setHighlight] = useState<CensusHighlight | null>(returned?.highlight ?? null);
  const [censusSort, setCensusSort] = useState<CensusSort>(returned?.censusSort ?? "wait");
  const [tab, setTab] = useState<"now" | "history">(returned?.tab ?? "now");
  const [openGroups, setOpenGroups] = useState<Record<CensusGroup, boolean>>(
    returned?.openGroups ?? {
      ask: true,
      wait: true,
      found: true,
      move: true,
      ward: false,
      off: false,
    },
  );
  const [showAllWard, setShowAllWard] = useState(returned?.showAllWard ?? false);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  useReturnToPlace<PatientsPlace>(
    PATIENTS_ROUTE,
    {
      stage,
      edId,
      presenceFilter,
      activeKpiFacet,
      serviceFilter,
      settingFilter,
      legalFilter,
      waitFilter,
      tierFilter,
      highlight,
      censusSort,
      tab,
      openGroups,
      showAllWard,
    },
    censusRow,
  );

  const showToast = (msg: string) => setCopyNote(msg);

  useEffect(() => {
    // The record drawer is modal: the search behind it stays put until it closes.
    if (detailsOpen) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.key === "/" && !areCharacterShortcutsEnabled())) return;
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
      words.set(movement.id, foldPatientSearchText(`${info.displayName} ${info.formalName} ${info.umrn}`));
    }
    for (const referral of referrals) {
      const info = resolveSubjectPatient(referral, context);
      words.set(referral.id, foldPatientSearchText(`${info.displayName} ${info.formalName} ${info.umrn}`));
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
          const isComm = isCommunityReferral(result.referral);
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
          const isComm = isCommunityReferral(result.referral);
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
      if (text === "● On this board") {
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
          name: info.formalName,
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
          presenceLabel: "On this board",
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
        const isComm = isCommunityReferral(ref);
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
          name: info.formalName,
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
          presenceLabel: isComm ? "Not in Hospital" : "On this board",
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
    const holds = unifiedCaseload.filter((p) => p.holdStatus === "Bed pulled").length;
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
    () =>
      buildCensus({ movements, referrals, units, patients, admissions, plannedAdmissions, now, thresholds, dayZero }),
    [movements, referrals, units, patients, admissions, plannedAdmissions, now, dayZero, thresholds],
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
        // A referral with a bed found has left the legacy record search (it only holds queued
        // referrals) but stays in the census, so it is filtered like a ward or person row instead of
        // dropped: dropping it made the list read "Bed found 31" under a hero "41" (device audit
        // 11 Oct 2026).
        const foundReferral = row.kind === "referral" && row.group === "found" && !caseIds.has(row.key);
        if ((row.kind === "movement" || row.kind === "referral") && !foundReferral) {
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
  // shell-16: the highlight chips count what the search and filters leave, as the tiles do.
  const countedRows =
    searching || legacyNarrowing || settingFilter !== "all" || presenceFilter !== "all" ? visibleRows : census.rows;
  const highlightCounts = Object.fromEntries(
    CENSUS_HIGHLIGHTS.map((chip) => [chip.id, countedRows.filter(chip.test).length]),
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
    rememberReturnRow(PATIENTS_ROUTE, row.key);
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
        ?.scrollIntoView({ block: "center", behavior: wardScrollBehavior() });
    }, 30);
    window.setTimeout(() => setFlashKey(null), 1800);
  };

  const jumpToGroup = (group: CensusGroup) => {
    setTab("now");
    setOpenGroups((current) => ({ ...current, [group]: true }));
    window.setTimeout(() => {
      document
        .getElementById(`ward-patient-search-group-${group}`)
        ?.scrollIntoView({ block: "start", behavior: wardScrollBehavior() });
    }, 30);
  };

  const copyText = (body: string, done: string) => {
    copyTextToClipboard(body).then(
      () => showToast(done),
      () => showToast("Copy was blocked by the browser"),
    );
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
  const flowLine = (() => {
    const closed = census.closedToday;
    const arrived = closed.filter((row) => row.outcome === "Arrived").length;
    const left = closed.filter((row) => row.outcome === "Discharged" || row.outcome === "Transferred").length;
    const stopped = closed.filter((row) => row.outcome === "Did not proceed").length;
    return `Today ${arrived} arrived · ${left} left · ${stopped} did not proceed`;
  })();
  // shell-16: History lists every closure and search whatever is typed, so it shows no count while
  // a search is on rather than a figure that disagrees with the result.
  const historyCount = searching ? undefined : census.closedToday.length + accessRecord.length;
  // P165: only a desk whose role can add a patient is offered the way in (the page refuses the rest).
  const canOpenHref = useCanOpenHref();
  const gate = useRoleGate();
  const canAddPatient = canOpenHref(WARD_ADD_PERSON_HREF) && gate("ADD_PATIENT").allowed;
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
      {/* D-91: the kit's one page search field, with the date of birth beside it and the count under it. */}
      <div className={cs.searchRow}>
        <SearchField
          className={cs.searchMain}
          label="Find a person by name, UMRN or place"
          placeholder={dobOn ? "Family or given name" : "Name, UMRN or place"}
          value={text}
          onValueChange={(next) => {
            setText(next);
            setTab("now");
          }}
          shortcut
          data-testid="ward-patient-typeahead-input"
          // The census, not a suggestion list, says how many people a search found. A date of birth
          // on its own reads as a plain total ("3 people"), as nothing was typed in the box.
          count={
            searching && !refusal
              ? {
                  shown: visibleRows.length,
                  total: needle === "" ? visibleRows.length : census.rows.length,
                  noun: "people",
                }
              : undefined
          }
        />
        {dobOn && !isPhone ? <DobField dob={dob} onDob={setDob} /> : null}
        <DobToggle dobOn={dobOn} onDobToggle={() => setDobOn((on) => !on)} />
      </div>
      {isPhone && dobOn ? <DobField dob={dob} onDob={setDob} phone /> : null}
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
  // Audit 24-7 item 2: a typo that finds nobody shows names one keystroke away before Add patient.
  const near =
    visibleRows.length === 0 && people.length === 0 && !refusal && !isChip
      ? nearPatients(
          patients,
          text.split(/\s+/).filter((term) => term.length > 0),
        )
      : [];
  const empty = (
    <CensusEmpty
      query={`${text} ${dobOn ? dob : ""}`.trim()}
      onReset={resetAllFilters}
      addHref={canAddPatient ? WARD_ADD_PERSON_HREF : undefined}
      onAdd={addPatientClick}
      near={near}
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
        onNavigate={closeable ? undefined : () => setDetailsOpen(false)}
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
        <h1 className="sr-only">Patients</h1>
        <div data-testid="ward-patient-search-cockpit" className={styles.v6HeroWrap}>
          <Hero
            className={cx(cs.censusHero, isPhone && cs.heroPhone)}
            eyebrow="Statewide census"
            title={`${liveCount} patients now`}
            titleMeta={isPhone ? flowLine : undefined}
            aside={
              <>
                {/* P140: Add patient comes first, away from the live/Demo chip, so it is not a mis-tap. */}
                {isPhone || !canAddPatient ? null : (
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
                {isPhone ? null : <FlowChip closed={census.closedToday} onOpen={() => setTab("history")} />}
                <LiveChip state="live" onHero />
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
            footKind={isPhone && canAddPatient ? "actions" : "line"}
            foot={
              isPhone && canAddPatient ? (
                <div className={cs.phoneHeroFoot}>
                  {/* The five group figures live once, in the band under the hero (device audit
                      11 Oct 2026): a three-up here repeated 51 / 41 / 242 directly above it. */}
                  {/* shell-17 (13 Oct 2026): no phone Commands sheet. It repeated Add patient, Menu
                      and the chips, and offered a bulk copy of patient rows on a handheld. */}
                  <div className={phoneRows.heroPills}>
                    <Link
                      href={WARD_ADD_PERSON_HREF}
                      className={cx(buttonClass({ variant: "onHero" }), phoneRows.heroPill, cs.heroPill)}
                      data-testid="ward-patient-search-add"
                      onClick={addPatientClick}
                    >
                      <Icon icon={UserPlus} size={16} />
                      <span>Add patient</span>
                    </Link>
                  </div>
                </div>
              ) : undefined
            }
          />

          {/* The counts and filters below the bar that tests and assistive tech read directly. Out of the
              Tab order (11 Oct 2026), so keyboard focus never lands on a control nobody can see. */}
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

            <div role="group" aria-label="Quick queries">
              {QUICK_CHIPS.map((chip) => {
                const isActive = text === chip.query;
                return (
                  <button
                    tabIndex={-1}
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
              tabIndex={-1}
              id="ward-patient-search-wait"
              value={waitFilter}
              onChange={(e) => setWaitFilter(e.target.value)}
              aria-label="Wait band"
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
              tabIndex={-1}
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
              tabIndex={-1}
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
              tabIndex={-1}
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
              tabIndex={-1}
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
              tabIndex={-1}
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
              tabIndex={-1}
              id="ward-patient-search-legal"
              value={legalFilter}
              onChange={(e) => setLegalFilter(e.target.value)}
              aria-label="Legal status"
            >
              <option value="all">All legal statuses ({unifiedCaseload.length})</option>
              {LEGAL_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({unifiedCaseload.filter((p) => p.legalStatus === opt.value).length})
                </option>
              ))}
            </select>

            <label htmlFor="ward-patient-search-tier">Acuity Tier</label>
            <select
              tabIndex={-1}
              id="ward-patient-search-tier"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              aria-label="Acuity tier"
            >
              <option value="all">Tier</option>
              <option value="Tier 1">Tier 1</option>
              <option value="Tier 2">Tier 2</option>
              <option value="Tier 3">Tier 3</option>
            </select>

            <button
              tabIndex={-1}
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
            onJump={jumpToGroup}
          />
        ) : null}
        {isPhone ? null : (
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
            <Card
              className={cs.side}
              role="region"
              aria-labelledby="ward-patient-search-side-title"
              data-preview-card
              data-wf-rail="1201"
            >
              <span id="ward-patient-search-side-title" className="sr-only">
                Patient details
              </span>
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
          note="Demonstration records only — Not approved for clinical use. Cross-setting index across people, movements, active referrals and beds."
        />
      </main>
    </div>
  );
}

const PHONE_QUERY = "(max-width: 40rem)";

/** Phone is its own design (Josh, 9 Oct 2026): below 40rem the census renders its phone layout. */
function usePhoneLayout(): boolean {
  return useMediaQuery(PHONE_QUERY);
}
