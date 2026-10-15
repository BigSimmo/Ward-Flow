import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { useEffect, useRef, useState } from "react";
import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { type LeavingDestination } from "@/components/ward-management/ward-admissions";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import type { DischargeRecord, DischargeOpenHandle } from "@/components/ward-management/ward-discharge-records";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { sortDueFirst, type DueSortMode } from "@/components/ward-management/ward-due-sort";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { activeCommunityTreatmentOrder } from "@/components/ward-management/ward-patients";
import { useIsPhone, useOptionalToast, type WfTone } from "@/components/wf";
import { demoReadyTicks, type ReadyToLeaveItemId, type ReadyToLeaveUndo } from "./discharge-ready-to-leave";
import pageStyles from "./discharges-third-edition.module.css";
import {
  type GroupKey,
  GROUP_ORDER,
  groupDischarges,
  unitLabel,
  healthServiceLabel,
  RECORD_ACTOR,
  type Population,
  type WorkStatus,
  WORK_STATUS_LABELS,
  WORK_ORDER,
  recordStage,
  recordStatus,
  recordName,
  recordedMoment,
  BLOCKER_CATEGORIES,
  barrierCategory,
  barrierLabel,
  type Highlight,
  type TableView,
  matchesHighlight,
  stageTone,
} from "./discharge-board-model";

/**
 * The discharge workspace's state, effects, derived lists and handlers, moved unchanged and in
 * their original order from `discharge-board.tsx`. The sections read the result as `s`.
 */
export function useDischargeWorkspaceState({ initialAdmissionId }: { initialAdmissionId?: string }) {
  const {
    bedReleases,
    units,
    patients,
    dayZero,
    readDischargeRecords,
    openDischargeRecord,
    readDischargeRecord,
    dispatch,
    recordWardDeparture,
    rejections,
  } = useWardFlowSelect(
    "bedReleases",
    "units",
    "patients",
    "dayZero",
    "readDischargeRecords",
    "openDischargeRecord",
    "readDischargeRecord",
    "dispatch",
    "recordWardDeparture",
    "rejections",
  );
  const toast = useOptionalToast();
  const now = useWardFlowClock();
  const [population, setPopulation] = useState<Population>("releases");
  const [status, setStatus] = useState<WorkStatus | "all">("all");
  const [service, setService] = useState("all");
  const [ward, setWard] = useState("all");
  const [identity, setIdentity] = useState("all");
  const [destination, setDestination] = useState<string>("all");
  const [blockerCategory, setBlockerCategory] = useState<string>("all");
  const [sortMode, setSortMode] = useState<DueSortMode>("default");
  const [selected, setSelected] = useState<{ admissionId: string; handle: DischargeOpenHandle } | null>(null);
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [showUpdateDate, setShowUpdateDate] = useState(false);
  const [newTimeDraft, setNewTimeDraft] = useState<string>("");
  const [openError, setOpenError] = useState(false);
  const isPhone = useIsPhone();
  const [phoneChart, setPhoneChart] = useState<"days" | "barriers" | null>(null);
  // v10 phone: the filters sit one tap away behind the filter button beside Now and History.
  const [phoneFiltersOpen, setPhoneFiltersOpen] = useState(false);
  // v10 phone: a long group shows its first rows and a "Show N more" row, not every row.
  // v10 phone: the release sheet scrolls as one; transport and dossier open under it on request.
  const [phoneReleaseMore, setPhoneReleaseMore] = useState(false);
  const [phoneGroupsOpen, setPhoneGroupsOpen] = useState<Partial<Record<GroupKey, boolean>>>({});
  // v10 phone: each group header folds its rows; "Discharged · 24h" starts folded.
  const [phoneGroupsFolded, setPhoneGroupsFolded] = useState<Partial<Record<GroupKey, boolean>>>({
    "discharged-today": true,
  });
  const [drawerTab, setDrawerTab] = useState<"milestones" | "barriers" | "transport" | "dossier">("milestones");
  const [view, setView] = useState<TableView>("list");
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [copyNote, setCopyNote] = useState("");
  const detailRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(false);
  // A4-21 (audit 13 Oct 2026): a confirmed release records the departure from this sheet, with the
  // destination, through the same shared action the ward's bed drawer uses. The destination starts
  // from the default for each release, so one person's choice is never recorded against the next.
  const [departure, setDeparture] = useState<{ releaseId: string | null; destination: LeavingDestination }>({
    releaseId: null,
    destination: "discharged-to-the-community",
  });
  // Audit A1-12: a recorded departure offers Undo (`UNDO_DEPARTURE`), like the ward's bed drawer,
  // through the shared `useUndoableStep`; with no toast region the outcome is announced instead.
  const { offer: offerDeparture } = useUndoableStep({
    dispatch,
    rejections,
    now,
    routeRole: "coordinator",
    toast,
    onMessage: announceToWardShell,
  });
  const guarded = readDischargeRecords(RECORD_ACTOR);
  const records = guarded.status === "allowed" ? guarded.value : [];
  // Opens the linked stay once, on arrival; after that the coordinator's own choices stand.
  const openedFromLinkRef = useRef(false);
  const linkedRecordExists =
    initialAdmissionId !== undefined && records.some((record) => record.admissionId === initialAdmissionId);
  useEffect(() => {
    if (openedFromLinkRef.current || initialAdmissionId === undefined || !linkedRecordExists) return;
    openedFromLinkRef.current = true;
    // Opening is a guarded, audited receipt (an external write), so it cannot run during render;
    // the selection shows its outcome, once.
    let handle: DischargeOpenHandle;
    try {
      handle = openDischargeRecord(RECORD_ACTOR, initialAdmissionId);
    } catch {
      handle = { generation: -1, requestId: -1 };
    }
    setPopulation("records");
    setSelected({ admissionId: initialAdmissionId, handle });
  }, [initialAdmissionId, linkedRecordExists, openDischargeRecord]);
  const services = [...new Set(units.map(healthServiceLabel))].sort();
  const scopedUnits = units.filter((unit) => service === "all" || healthServiceLabel(unit) === service);
  const inScope = (unitId: string) => {
    const unit = units.find((candidate) => candidate.id === unitId);
    return (ward === "all" || ward === unitId) && (service === "all" || healthServiceLabel(unit) === service);
  };
  const scopedReleases = bedReleases.filter(
    (release) =>
      inScope(release.unitId) &&
      (blockerCategory === "all" ||
        (release.blocker !== null && release.blocker.toLowerCase().includes(blockerCategory.toLowerCase()))),
  );
  const groupedReleases = groupDischarges(scopedReleases, now);
  // Stream A, 9 Oct 2026: "Due first" orders each release group by its expected time, earliest
  // first; the groups themselves keep their order. Default keeps the band order.
  const releaseDue = (release: BedRelease) => release.expectedAt;
  const releaseGroups =
    sortMode === "due-first"
      ? {
          ...groupedReleases,
          blocked: sortDueFirst(groupedReleases.blocked, releaseDue),
          confirmed: sortDueFirst(groupedReleases.confirmed, releaseDue),
          expected: sortDueFirst(groupedReleases.expected, releaseDue),
        }
      : groupedReleases;
  const scopedRecords = records.filter(
    (record) =>
      inScope(record.unitId) &&
      (identity === "all" ||
        (identity === "linked" ? record.identity.kind === "linked" : record.identity.kind !== "linked")) &&
      (destination === "all" || record.leavingDestination === destination) &&
      (blockerCategory === "all" ||
        (record.blockReason !== null && record.blockReason.toLowerCase().includes(blockerCategory.toLowerCase()))),
  );
  const counts: Record<WorkStatus, number> =
    population === "releases"
      ? {
          blocked: releaseGroups.blocked.length,
          confirmed: releaseGroups.confirmed.length,
          expected: releaseGroups.expected.length,
          departed: releaseGroups["discharged-today"].length,
        }
      : (Object.fromEntries(
          WORK_ORDER.map((key) => [key, scopedRecords.filter((record) => recordStatus(record) === key).length]),
        ) as Record<WorkStatus, number>);
  const releaseStatus = new Map<string, WorkStatus>(
    GROUP_ORDER.flatMap((key) =>
      releaseGroups[key].map((release) => [release.id, key === "discharged-today" ? "departed" : key] as const),
    ),
  );
  const recordLit = (record: DischargeRecord) =>
    highlight?.kind === "status"
      ? recordStatus(record) === highlight.status
      : recordStage(record) !== "departed" &&
        matchesHighlight(highlight, record.expectedDischargeAt, record.blockReason, now);
  const releaseLit = (release: BedRelease) =>
    highlight?.kind === "status"
      ? releaseStatus.get(release.id) === highlight.status
      : release.state !== "discharged" && matchesHighlight(highlight, release.expectedAt, release.blocker, now);
  // Highlights dim the rest; every row stays.
  const dimmed = (lit: boolean) => (highlight !== null && !lit ? "true" : undefined);
  const statusHighlight = highlight?.kind === "status" ? highlight.status : null;
  const [readyTicks, setReadyTicks] = useState<Record<string, ReadyToLeaveItemId[]>>({});
  const [readyChange, setReadyChange] = useState<(ReadyToLeaveUndo & { releaseId: string }) | null>(null);
  const ticksFor = (id: string) => readyTicks[id] ?? demoReadyTicks(id);
  const setTick = (id: string, itemId: ReadyToLeaveItemId, on: boolean) =>
    setReadyTicks((current) => {
      const list = current[id] ?? demoReadyTicks(id);
      return {
        ...current,
        [id]: on ? [...list.filter((item) => item !== itemId), itemId] : list.filter((item) => item !== itemId),
      };
    });
  const litFirst = <T,>(list: T[], lit: (item: T) => boolean) =>
    highlight === null ? list : [...list.filter(lit), ...list.filter((item) => !lit(item))];
  const workOrderedRecords = scopedRecords
    .filter((record) => status === "all" || recordStatus(record) === status)
    .sort(
      (a, b) =>
        WORK_ORDER.indexOf(recordStatus(a)) - WORK_ORDER.indexOf(recordStatus(b)) ||
        (a.expectedDischargeAt ?? Infinity) - (b.expectedDischargeAt ?? Infinity),
    );
  // "Due first" is one list by expected discharge, earliest first. A record that has left, or has
  // no expected date, is not due and goes last in its work order.
  // Highlighted people (day chart or barrier bars) go first, then the chosen order.
  const visibleRecords = litFirst(
    sortMode === "due-first"
      ? sortDueFirst(workOrderedRecords, (record) =>
          recordStatus(record) === "departed" ? null : record.expectedDischargeAt,
        )
      : workOrderedRecords,
    recordLit,
  );
  const visibleReleaseGroups = GROUP_ORDER.filter(
    (key) => status === "all" || (key === "discharged-today" ? "departed" : key) === status,
  );
  const visibleReleaseIds = visibleReleaseGroups.flatMap((key) => releaseGroups[key].map((release) => release.id));
  const opened =
    selected && population === "records" && visibleRecords.some((record) => record.admissionId === selected.admissionId)
      ? readDischargeRecord(RECORD_ACTOR, selected.admissionId, selected.handle)
      : null;
  // Never retain the selected DTO: each render obtains a newly guarded current read.
  const detailRecord = opened?.status === "allowed" ? opened.value : null;
  const activeRecord = detailRecord;
  const detailRelease =
    population === "releases" && releaseId && visibleReleaseIds.includes(releaseId)
      ? scopedReleases.find((release) => release.id === releaseId)
      : undefined;
  const linkedReleaseRecord = detailRelease
    ? (records.find((record) => record.admissionId === detailRelease.admissionId) ?? null)
    : null;
  const releasePatientId =
    linkedReleaseRecord?.identity.kind === "linked" ? linkedReleaseRecord.identity.patient.id : null;
  // S-29 (Josh, audit round 2): a person on a CTO gets the community team or GP handover line.
  const releaseOnCto =
    releasePatientId !== null &&
    activeCommunityTreatmentOrder(patients.find((patient) => patient.id === releasePatientId)) !== undefined;
  const selectedUnitId = activeRecord?.unitId ?? detailRelease?.unitId;
  const canRecordDeparture = detailRelease?.state === "confirmed";
  const departureDestination: LeavingDestination =
    departure.releaseId === detailRelease?.id ? departure.destination : "discharged-to-the-community";
  // One primary per area: on a phone a blocked release keeps Clear blocker as the primary.
  const phoneClearBlocker = isPhone && !!detailRelease?.blocker && detailRelease.state !== "discharged";
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId);
  const shown = population === "records" ? visibleRecords.length : visibleReleaseIds.length;
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const closeDrawer = () => {
    setSelected(null);
    setReleaseId(null);
    setOpenError(false);
    setShowUpdateDate(false);
    restoreFocusRef.current = true;
  };
  useEffect(() => {
    if (!restoreFocusRef.current || selected !== null || releaseId !== null) return;
    restoreFocusRef.current = false;
    const trigger = triggerRef.current;
    (trigger?.isConnected ? trigger : listRef.current)?.focus();
  }, [selected, releaseId]);
  const clearSelection = () => {
    setSelected(null);
    setReleaseId(null);
    setOpenError(false);
    setShowUpdateDate(false);
  };
  const clearAllFilters = () => {
    setService("all");
    setWard("all");
    setStatus("all");
    setIdentity("all");
    setDestination("all");
    setBlockerCategory("all");
    clearSelection();
  };
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (selected !== null || releaseId !== null)) {
        closeDrawer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, releaseId]);
  const focusDetail = () => {
    queueMicrotask(() => {
      const first = detailRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (first ?? detailRef.current)?.focus();
    });
  };
  const openRecord = (record: DischargeRecord, opener?: HTMLElement | null) => {
    if (opener) triggerRef.current = opener;
    setReleaseId(null);
    setOpenError(false);
    setShowUpdateDate(false);
    try {
      setSelected({ admissionId: record.admissionId, handle: openDischargeRecord(RECORD_ACTOR, record.admissionId) });
    } catch {
      setSelected({ admissionId: record.admissionId, handle: { generation: -1, requestId: -1 } });
      setOpenError(false);
    }
    focusDetail();
  };
  const selectRelease = (id: string, opener: HTMLElement) => {
    triggerRef.current = opener;
    setSelected(null);
    setPhoneReleaseMore(false);
    setReleaseId(id);
    focusDetail();
  };
  const filtersActive =
    service !== "all" ||
    ward !== "all" ||
    status !== "all" ||
    identity !== "all" ||
    destination !== "all" ||
    blockerCategory !== "all";
  const openCount = counts.blocked + counts.confirmed + counts.expected;
  /* The charts under the table count PEOPLE: the admission records in scope that have not left,
     so a click can highlight the same rows the Admission records list shows. */
  const openScopedRecords = scopedRecords.filter((record) => recordStage(record) !== "departed");
  const barrierCounts = [...BLOCKER_CATEGORIES.map((category) => category.id), "other"]
    .map((id) => ({
      id,
      label: barrierLabel(id),
      count: openScopedRecords.filter(
        (record) => record.blockReason !== null && barrierCategory(record.blockReason) === id,
      ).length,
    }))
    .sort((a, b) => b.count - a.count);
  const highlightOn = (next: Highlight) => {
    setHighlight(next);
    // The charts count every open record in scope, so clear the list filters that could hide them.
    setStatus("all");
    setDestination("all");
    setBlockerCategory("all");
    if (population !== "records") {
      setPopulation("records");
      clearSelection();
    }
    // Highlighted people go to the top, so bring the top of the list into view.
    const list = listRef.current;
    if (list) {
      list.scrollTop = 0;
      if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 40rem)").matches) {
        list.scrollIntoView?.({ block: "start", behavior: wardScrollBehavior() });
      }
    }
  };
  const highlightedCount =
    population === "records"
      ? visibleRecords.filter(recordLit).length
      : visibleReleaseGroups.reduce((sum, key) => sum + releaseGroups[key].filter(releaseLit).length, 0);
  const datePassed =
    population === "records"
      ? openScopedRecords
          .filter((record) => record.expectedDischargeAt !== null && record.expectedDischargeAt < now)
          .map((record) => record.expectedDischargeAt as number)
      : scopedReleases
          .filter((release) => release.state !== "discharged" && release.expectedAt < now)
          .map((release) => release.expectedAt);
  const bedDaysPast = Math.round(datePassed.reduce((sum, at) => sum + (now - at), 0) / MINUTES_PER_DAY);
  const copySummary = () => {
    const text =
      `Discharges, ${population === "records" ? "admission records" : "bed releases"}, as of ${formatSheetMoment(now, dayZero)}. ` +
      `${openCount} open: ${counts.blocked} blocked, ${counts.confirmed} confirmed, ${counts.expected} expected. ` +
      `${datePassed.length} past the ward's date, ${bedDaysPast} bed days. ${counts.departed} departed.`;
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (!clipboard) {
      setCopyNote("Copying is not available in this browser.");
      return;
    }
    clipboard.writeText(text).then(
      () => setCopyNote("Summary copied."),
      () => setCopyNote("Copying is not available in this browser."),
    );
  };
  const detailTone: WfTone | null = activeRecord
    ? stageTone(recordStatus(activeRecord))
    : detailRelease
      ? detailRelease.blocker
        ? "danger"
        : detailRelease.state === "expected"
          ? "neutral"
          : "success"
      : null;
  const detailBadgeLabel = activeRecord
    ? recordStatus(activeRecord) === "blocked"
      ? "Blocked"
      : WORK_STATUS_LABELS[recordStage(activeRecord)]
    : detailRelease
      ? detailRelease.blocker
        ? "Blocked"
        : detailRelease.state === "discharged"
          ? "Departed"
          : WORK_STATUS_LABELS[detailRelease.state]
      : "";
  /* v10 phone: no tabs in the release sheet — milestones and the barrier always show, transport
     and dossier on request. Desktop and tablet keep the tabs. */
  const releasePaneClass = (tab: "milestones" | "barriers" | "transport" | "dossier") =>
    (isPhone ? tab === "milestones" || tab === "barriers" || phoneReleaseMore : drawerTab === tab)
      ? pageStyles.tabPane
      : pageStyles.tabPaneHidden;

  type BarrierRow = {
    id: string;
    blocker: string;
    lit: boolean;
    selected: boolean;
    title: string;
    mono: string | null;
    sub: string;
    when: string;
    open: (opener: HTMLElement) => void;
  };
  const barrierRows: BarrierRow[] =
    population === "records"
      ? visibleRecords
          .filter((record) => recordStage(record) !== "departed" && record.blockReason !== null)
          .map((record) => {
            const unit = units.find((candidate) => candidate.id === record.unitId);
            return {
              id: record.id,
              blocker: record.blockReason as string,
              lit: recordLit(record),
              selected: selected?.admissionId === record.admissionId,
              title: recordName(record),
              mono: record.identity.kind === "linked" ? record.identity.patient.umrn : null,
              sub: `${unitLabel(unit, record.unitId)} · ${healthServiceLabel(unit)}`,
              when: recordedMoment(record.expectedDischargeAt, dayZero),
              open: (opener: HTMLElement) => openRecord(record, opener),
            };
          })
      : (visibleReleaseGroups.includes("blocked") ? releaseGroups.blocked : []).map((release) => {
          const unit = units.find((candidate) => candidate.id === release.unitId);
          const linked = records.find((candidate) => candidate.admissionId === release.admissionId);
          return {
            id: release.id,
            blocker: release.blocker as string,
            lit: releaseLit(release),
            selected: releaseId === release.id,
            title: unitLabel(unit, release.unitId),
            mono: null,
            sub: linked ? `${healthServiceLabel(unit)} · ${recordName(linked)}` : healthServiceLabel(unit),
            when: recordedMoment(release.expectedAt, dayZero),
            open: (opener: HTMLElement) => selectRelease(release.id, opener),
          };
        });
  const unblockedCount =
    population === "records"
      ? visibleRecords.filter((record) => recordStage(record) !== "departed" && record.blockReason === null).length
      : (["confirmed", "expected"] as const)
          .filter((key) => visibleReleaseGroups.includes(key))
          .reduce((sum, key) => sum + releaseGroups[key].length, 0);
  const barrierGroups = [...BLOCKER_CATEGORIES.map((category) => category.id), "other"]
    .map((id) => ({ id, rows: barrierRows.filter((row) => barrierCategory(row.blocker) === id) }))
    .filter((group) => group.rows.length > 0)
    .sort((a, b) => b.rows.length - a.rows.length);
  const barrierMax = Math.max(1, ...barrierGroups.map((group) => group.rows.length));

  return {
    initialAdmissionId,
    bedReleases,
    units,
    patients,
    dayZero,
    readDischargeRecords,
    openDischargeRecord,
    readDischargeRecord,
    dispatch,
    recordWardDeparture,
    rejections,
    toast,
    now,
    population,
    setPopulation,
    status,
    setStatus,
    service,
    setService,
    ward,
    setWard,
    identity,
    setIdentity,
    destination,
    setDestination,
    blockerCategory,
    setBlockerCategory,
    sortMode,
    setSortMode,
    selected,
    setSelected,
    releaseId,
    setReleaseId,
    showUpdateDate,
    setShowUpdateDate,
    newTimeDraft,
    setNewTimeDraft,
    openError,
    setOpenError,
    isPhone,
    phoneChart,
    setPhoneChart,
    phoneFiltersOpen,
    setPhoneFiltersOpen,
    phoneReleaseMore,
    setPhoneReleaseMore,
    phoneGroupsOpen,
    setPhoneGroupsOpen,
    phoneGroupsFolded,
    setPhoneGroupsFolded,
    drawerTab,
    setDrawerTab,
    view,
    setView,
    highlight,
    setHighlight,
    copyNote,
    setCopyNote,
    detailRef,
    listRef,
    triggerRef,
    restoreFocusRef,
    departure,
    setDeparture,
    offerDeparture,
    guarded,
    records,
    openedFromLinkRef,
    linkedRecordExists,
    services,
    scopedUnits,
    inScope,
    scopedReleases,
    groupedReleases,
    releaseDue,
    releaseGroups,
    scopedRecords,
    counts,
    releaseStatus,
    recordLit,
    releaseLit,
    dimmed,
    statusHighlight,
    readyTicks,
    setReadyTicks,
    readyChange,
    setReadyChange,
    ticksFor,
    setTick,
    litFirst,
    workOrderedRecords,
    visibleRecords,
    visibleReleaseGroups,
    visibleReleaseIds,
    opened,
    detailRecord,
    activeRecord,
    detailRelease,
    linkedReleaseRecord,
    releasePatientId,
    releaseOnCto,
    selectedUnitId,
    canRecordDeparture,
    departureDestination,
    phoneClearBlocker,
    selectedUnit,
    shown,
    total,
    closeDrawer,
    clearSelection,
    clearAllFilters,
    focusDetail,
    openRecord,
    selectRelease,
    filtersActive,
    openCount,
    openScopedRecords,
    barrierCounts,
    highlightOn,
    highlightedCount,
    datePassed,
    bedDaysPast,
    copySummary,
    detailTone,
    detailBadgeLabel,
    releasePaneClass,
    barrierRows,
    unblockedCount,
    barrierGroups,
    barrierMax,
  } as const;
}

/** Everything the discharge workspace's sections read, from one call per render. */
export type DischargeWorkspaceState = ReturnType<typeof useDischargeWorkspaceState>;
