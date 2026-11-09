"use client";

import { WardPeekButton } from "@/components/ward-management/board/ward-peek";
import { useRef, useState } from "react";
import { useWardRecordActors } from "@/components/ward-management/shell/ward-access";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Filter,
  OctagonAlert,
  Printer,
  TrendingUp,
  Ambulance,
} from "lucide-react";
import { releaseBand, type ReleaseBand } from "@/components/ward-management/ward-bed-availability";
import { dayOf, formatSheetMoment } from "@/components/ward-management/ward-clock";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { LEAVING_DESTINATIONS, type LeavingDestination } from "@/components/ward-management/ward-admissions";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { ListExportButton } from "@/components/ward-management/ward-list-export-button";
import {
  Button,
  Card,
  DrawerFootRow,
  Field,
  Hero,
  LiveChip,
  PanelDrawer,
  PhoneSheet,
  Select,
  ShowMoreRow,
  SrOnly,
  StatusGlyph,
  type HeroNextStep,
} from "@/components/wf";
import { criteriaLedTileChip, dischargeCriteriaStatus } from "@/components/ward-management/ward-discharge-criteria";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { CriteriaLedTag } from "@/components/ward-management/ward/ward-criteria-led-tag";
import { DischargeBarrierBars, DischargeDayChart, type DischargeDay } from "./discharge-flow-charts";
import styles from "./discharges.module.css";
import releaseList from "./discharge-release-list.module.css";
import {
  GROUP_CAP,
  GROUP_NOTES,
  GROUP_TITLES,
  HELD_UP,
  PHONE_GROUP_TITLES,
  heldUpByReason,
  pastWords,
  releaseActionLabel,
  releaseActionPart,
  type ReleasePanelPart,
  useOpenGroupsForPrint,
} from "./discharge-release-actions";
import pageStyles from "./discharges-third-edition.module.css";
import wardPin from "../ward-pinned-switch.module.css";
import {
  PHONE_GROUP_TONES,
  GROUP_ORDER,
  BAND_LABELS,
  unitLabel,
  healthServiceLabel,
  WORK_STATUS_LABELS,
  WORK_ORDER,
  kpiCardLabel,
  recordStage,
  recordStatus,
  recordName,
  recordedMoment,
  recordedDate,
  matchesHighlight,
  perthDay,
  stageTone,
} from "./discharge-board-model";
import { DischargePopulationSwitch, DischargeFilterCard } from "./discharge-board-filters";
import {
  DischargeRecordDetail,
  DischargeReleaseDetail,
  dischargeDrawerTabs,
  recordDrawerHead,
  releaseDrawerHead,
} from "./discharge-detail-panes";
import { useDischargeDeskView } from "./discharge-desk-view";
import { useDischargeWorkspaceState } from "./use-discharge-workspace-state";
// Closing-the-loop package B (24 Oct 2026): the weekend and holiday list. Since the redesign (approved
// 31 Oct 2026) it is a compact notice ABOVE the list, so it loads with the board: loaded lazily, the
// server's copy vanished on hydration and came back, and the whole list jumped (layout shift 0.21).
import { DischargeWeekendPrep } from "./discharge-weekend-prep";
import { followUpWithinWindowCheck } from "./discharge-follow-up-check";
import { DischargeAskOverdueWards } from "./discharge-message-ward";
import { OnBehalfReasonForm } from "../on-behalf-reason-form-lazy";

/**
 * Task 6, spec D9: the discharge and egress board. A coordinator's whole reason to open this
 * board is "which bed do I chase, and which one is simply on its way" — so releases are grouped
 * by how much work is left on them, worst first: a **blocked** release needs somebody to act on
 * it right now, a **confirmed** one is just waiting for the clock, a **expected** one is a
 * belief rather than a fact yet, and **discharged today** is done. Within a group, releases are
 * ordered by `releaseBand` — the same "now / by midday / by 1600 / tonight" ladder the capacity
 * board uses (`ward-bed-availability.ts`), so the two boards never disagree about how soon
 * "soon" is.
 *
 * This board is LIVE, unlike `HandoverPage` — it reads `useWardFlow()` on every render and never
 * freezes a snapshot. There is nothing here a coordinator needs to have held still while they
 * read it; the opposite is true, a discharge board that lagged reality would be actively
 * misleading about which bed is actually free to chase next.
 */

/** Days the chart covers after today; the column before them gathers every date already passed. */
const CHART_DAYS_AHEAD = 14;

/** Recorded (DC4): the days of recorded discharges it lists. */
const RECORDED_DAYS = 7;

/** Moved to `./discharge-board-model` and `./discharge-board-parts`; re-exported so imports keep working. */
export { groupDischarges } from "./discharge-board-model";
export { DischargeGroupSection } from "./discharge-board-parts";

/**
 * `initialAdmissionId`: a Tasks link (`?admissionId=`) opens that stay's detail once on arrival.
 * Redesign (approved by Josh, 31 Oct 2026): person first, one action a row, barriers beside the list;
 * the nurse in charge and the site bed manager read it through role branches (`useDischargeDeskView`).
 */
export function DischargeBoard({ initialAdmissionId }: { initialAdmissionId?: string } = {}) {
  const { worldGeneration } = useWardFlowSelect("worldGeneration");
  const actors = useWardRecordActors();
  // Clear receipts synchronously when generation, role or place changes.
  return (
    <DischargeWorkspace key={`${worldGeneration}:${JSON.stringify(actors)}`} initialAdmissionId={initialAdmissionId} />
  );
}

function DischargeWorkspace({ initialAdmissionId }: { initialAdmissionId?: string }) {
  const base = useDischargeWorkspaceState({ initialAdmissionId });
  useOpenGroupsForPrint(base.setPhoneGroupsOpen, GROUP_ORDER);
  /* Josh, 30 Oct: on Now the barrier panel and the day chart count bed releases, the list's
     own rows, and a click on either highlights within Now; it never switches to History. History keeps
     today's admission-record counts and behaviour. */
  const nowView = base.population === "releases";
  const { releaseGroups: groups } = base;
  const toWorkCount = groups.blocked.length + groups.confirmed.length + groups.expected.length;
  const openReleases = base.scopedReleases.filter((release) => release.state !== "discharged");
  const overdueOpen = openReleases.filter((release) => release.expectedAt < base.now);
  const overdueWards = new Set(overdueOpen.map((release) => release.unitId)).size;
  const highlightWithinView: typeof base.highlightOn = (next) => {
    if (!nowView) {
      base.highlightOn(next);
      return;
    }
    base.setHighlight(next);
    // A status filter could hide the highlighted rows, so it goes back to all statuses.
    base.setStatus("all");
    const list = base.listRef.current;
    if (list) {
      list.scrollTo?.({ top: 0 });
      if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 46.4375rem)").matches) {
        list.scrollIntoView?.({ block: "start", behavior: wardScrollBehavior() });
      }
    }
  };
  const copyCounts = nowView
    ? () => {
        const text =
          `Discharges, by bed, as of ${formatSheetMoment(base.now, base.dayZero)}. ` +
          `${toWorkCount} to work now of ${openReleases.length} open: ${groups.blocked.length} held up, ` +
          `${groups.confirmed.length} confirmed, ${groups.expected.length} expected · ` +
          `${groups["discharged-today"].length} discharged today. ` +
          `${base.datePassed.length} past the ward's date, ${base.bedDaysPast} bed days.`;
        copyTextToClipboard(text).then(
          () => base.setCopyNote("Summary copied."),
          () => base.setCopyNote("Copying is not available in this browser."),
        );
      }
    : base.copySummary;
  const s: typeof base = {
    ...base,
    highlightOn: highlightWithinView,
    copySummary: copyCounts,
    barrierCounts: nowView ? heldUpByReason(groups.blocked) : base.barrierCounts,
  };
  // Josh, 30 Oct: a row's button opens the release panel on the part it names.
  const openCounter = useRef(0);
  const [openOn, setOpenOn] = useState<{ releaseId: string; part: ReleasePanelPart; n: number } | null>(null);
  const openReleaseOn = (releaseId: string, opener: HTMLElement, part: ReleasePanelPart) => {
    base.selectRelease(releaseId, opener);
    openCounter.current += 1;
    setOpenOn({ releaseId, part, n: openCounter.current });
    // Confirm date's control ("New expected out") sits in the release's arrangements, beside its barriers.
    base.setDrawerTab(part === "date" ? "barriers" : part);
  };
  // D-64: rows show where criteria led discharge stands, behind its flag (off in production). L21 dropped
  // the Stage column, so the tag now sits in the Now list's Hold-up cell for a patient still in a bed.
  const criteriaLedOn = useWardFeatureFlag("top25-criteria-led-discharge");
  const {
    units,
    dayZero,
    dispatch,
    recordWardDeparture,
    now,
    population,
    status,
    setStatus,
    service,
    ward,
    identity,
    selected,
    releaseId,
    isPhone,
    phoneChart,
    setPhoneChart,
    phoneFiltersOpen,
    setPhoneFiltersOpen,
    phoneGroupsOpen,
    setPhoneGroupsOpen,
    phoneGroupsFolded,
    setPhoneGroupsFolded,
    highlight,
    setHighlight,
    copyNote,
    listRef,
    setDeparture,
    offerDeparture,
    guarded,
    records,
    releaseGroups,
    counts,
    releaseLit,
    dimmed,
    statusHighlight,
    litFirst,
    visibleRecords,
    visibleReleaseGroups,
    activeRecord,
    detailRelease,
    linkedReleaseRecord,
    selectedUnitId,
    canRecordDeparture,
    departureDestination,
    phoneClearBlocker,
    shown,
    total,
    closeDrawer,
    openRecord,
    drawerTab,
    setDrawerTab,
    filtersActive,
    openCount,
    openScopedRecords,
    barrierCounts,
    highlightOn,
    highlightedCount,
    bedDaysPast,
    copySummary,
  } = s;
  // ROLE BRANCHES (approved 31 Oct 2026). Nurse in charge: the own ward's name replaces the statewide
  // wording, and the ward line under each person (always this ward) is left out. Site bed manager: the
  // site's name, and each row names the ward alone (one site, one service).
  const { ownWard, siteName } = useDischargeDeskView(units);
  // Site bed manager: only the ward or the coordinator can change an expected date, so an expected
  // release offers Open (on its milestones), not Confirm date (Josh, 30 Oct).
  const canChangeDate = siteName === undefined;
  const placeLine = (unit: (typeof units)[number] | undefined, unitId: string) =>
    siteName ? unitLabel(unit, unitId) : `${unitLabel(unit, unitId)} · ${healthServiceLabel(unit)}`;
  const today = dayOf(now);
  const chartDays: DischargeDay[] = [
    {
      key: "past",
      // DC5 (Josh, 3 Nov 2026): the expected dates already gone by read "Overdue", not "Passed".
      label: "Overdue",
      name: "Overdue, expected date already passed",
      expected: 0,
      blocked: 0,
      weekend: false,
    },
    ...Array.from({ length: CHART_DAYS_AHEAD }, (_, index): DischargeDay => {
      const noon = (today + index) * MINUTES_PER_DAY + 12 * 60;
      const weekday = perthDay(noon, dayZero, { weekday: "short" });
      return {
        key: index,
        label: index === 0 ? "Today" : `${weekday} ${perthDay(noon, dayZero, { day: "numeric" })}`,
        name: perthDay(noon, dayZero, { weekday: "long", day: "numeric", month: "long" }),
        expected: 0,
        blocked: 0,
        weekend: weekday === "Sat" || weekday === "Sun",
      };
    }),
  ];
  const dayOfChart = (at: number | null) =>
    chartDays.find((candidate) => matchesHighlight({ kind: "day", day: candidate.key }, at, null, now));
  if (nowView) {
    // Now: every open bed release in scope by its expected day, as Capacity's forecast counts
    // recorded discharges; the red part is the held-up ones, as the list says. Closed wards are left
    // out, as Capacity's forecast leaves them out (Josh, 30 Oct 2026), so the two pages agree.
    const closedUnitIds = new Set(units.filter((unit) => unit.isClosed).map((unit) => unit.id));
    for (const release of openReleases) {
      if (closedUnitIds.has(release.unitId)) continue;
      const day = dayOfChart(release.expectedAt);
      if (!day) continue;
      if (release.blocker !== null) day.blocked += 1;
      else day.expected += 1;
    }
  } else {
    for (const record of openScopedRecords) {
      const day = dayOfChart(record.expectedDischargeAt);
      if (!day) continue;
      if (recordStatus(record) === "blocked") day.blocked += 1;
      else day.expected += 1;
    }
  }
  const phoneOverdue = chartDays[0] ? chartDays[0].expected + chartDays[0].blocked : 0;
  const phoneTodayDay = chartDays.find((candidate) => candidate.key === 0);
  const phoneToday = phoneTodayDay ? phoneTodayDay.expected + phoneTodayDay.blocked : 0;
  // A day two or more ahead also holds releases the list leaves out (due in 2+ days, not held up).
  // DC5 (Josh, 3 Nov 2026): choosing that day's bar opens its people, so they join the Expected
  // group, lit and first, while the day stays chosen.
  const dayExtra =
    nowView && highlight?.kind === "day"
      ? openReleases.filter(
          (release) =>
            matchesHighlight(highlight, release.expectedAt, null, now) &&
            !releaseGroups.blocked.includes(release) &&
            !releaseGroups.confirmed.includes(release) &&
            !releaseGroups.expected.includes(release),
        )
      : [];
  const shownGroups: typeof releaseGroups =
    dayExtra.length > 0 ? { ...releaseGroups, expected: [...releaseGroups.expected, ...dayExtra] } : releaseGroups;
  const shownHighlighted = highlightedCount + dayExtra.length;
  // A highlight shows every lit row of a group before its Show more row.
  const groupCap = (key: (typeof GROUP_ORDER)[number]) =>
    Math.max(GROUP_CAP, highlight === null ? 0 : shownGroups[key].filter(releaseLit).length);
  /* DC4 (Josh, 3 Nov 2026): Recorded, which replaces History, lists only the discharges recorded in
     the last 7 days, newest first, with where each person went and whether their 7 day follow-up is
     booked. Held up and expected people stay on Now alone, so the two tabs never repeat each other. */
  const recordedSince = now - RECORDED_DAYS * MINUTES_PER_DAY;
  const recorded = visibleRecords
    .filter((record) => recordStage(record) === "departed" && record.leftAt !== null && record.leftAt >= recordedSince)
    .sort((a, b) => (b.leftAt ?? 0) - (a.leftAt ?? 0));
  const followUpOf = (record: (typeof recorded)[number]) =>
    followUpWithinWindowCheck({
      followUp: record.followUp,
      careJourney: record.careJourney,
      leftAt: record.leftAt,
      expectedDischargeAt: record.expectedDischargeAt,
      now,
      onCto: false,
    });
  const followUpToCheck = recorded.filter((record) => followUpOf(record).warning).length;
  // Codex review (#1374): Recorded copies its own figures, the same ones its headline and list show.
  const copyRecorded = () => {
    const text =
      `Recorded discharges, last ${RECORDED_DAYS} days, as of ${formatSheetMoment(now, dayZero)}. ` +
      `${recorded.length} ${recorded.length === 1 ? "discharge" : "discharges"} recorded, ` +
      `${followUpToCheck} ${followUpToCheck === 1 ? "follow-up" : "follow-ups"} to check.`;
    copyTextToClipboard(text).then(
      () => base.setCopyNote("Summary copied."),
      () => base.setCopyNote("Copying is not available in this browser."),
    );
  };
  // Export (feature 44): the list on screen, never names; the builder loads on the click.
  const exportList = async () => {
    const exporter = await import("./discharge-export");
    const wardName = (unitId: string) =>
      unitLabel(
        units.find((unit) => unit.id === unitId),
        unitId,
      );
    const at = (instant: number) => formatSheetMoment(instant, dayZero);
    const what = nowView ? "Discharges, Now" : `Discharges, Recorded in the last ${RECORDED_DAYS} days`;
    const filters = [service, ward, status, base.blockerCategory, ...(nowView ? [] : [identity, base.destination])];
    const narrowed = filters.some((value) => value !== "all");
    // Now exports the release groups the list shows, not every record in scope; the header says so.
    const shownWords = nowView
      ? `the discharges by bed ${narrowed ? "the current filters show" : "the list shows"}, by status`
      : narrowed
        ? "the recorded discharges the current filters show"
        : "every recorded discharge in this desk's scope";
    const provenance = {
      asAt: formatSheetMoment(now, dayZero, { includeYearAndZone: true }),
      scope: `${what}; ${shownWords} (highlights do not narrow it)`,
    };
    if (!nowView) {
      exporter.downloadDischargeRecords(
        recorded,
        {
          wardName,
          destinationOf: (record) =>
            LEAVING_DESTINATIONS.find((item) => item.id === record.leavingDestination)?.label ?? "Not recorded",
          followUpOf: (record) => followUpOf(record).status,
          at,
        },
        provenance,
      );
      return;
    }
    const rows = visibleReleaseGroups.flatMap((key) =>
      shownGroups[key].map((release) => ({
        ...release,
        statusWord: WORK_STATUS_LABELS[key === "discharged-today" ? "departed" : key],
      })),
    );
    const umrnOf = (release: (typeof rows)[number]) => {
      const record = records.find((candidate) => candidate.admissionId === release.admissionId);
      return record?.identity.kind === "linked" ? record.identity.patient.umrn : "UMRN not recorded";
    };
    exporter.downloadDischargeReleases(rows, { umrnOf, wardName, statusOf: (row) => row.statusWord, at }, provenance);
  };
  const exportCount = nowView ? visibleReleaseGroups.reduce((n, k) => n + shownGroups[k].length, 0) : recorded.length;
  // Now and Recorded: in the hero on desktop and tablet, under it on a phone (v10).
  const populationSwitch = <DischargePopulationSwitch s={s} />;
  const filterCard = <DischargeFilterCard s={s} />;
  // Plan item 2i (proposal): the hero's next step, from the same status counts as the chips. Held up
  // first, as the list is ordered; with nothing held up, the confirmed ones are next to see out.
  const noun = (n: number) =>
    population === "releases" ? (n === 1 ? "discharge" : "discharges") : n === 1 ? "record" : "records";
  const nextKey: "blocked" | "confirmed" | null =
    counts.blocked > 0 ? "blocked" : counts.confirmed > 0 ? "confirmed" : null;
  // Desk and scope (role branches, 31 Oct 2026): the counts are already the desk's own (a ward desk's
  // ward, a site bed manager's site, or the chosen service), so the sentence names that place.
  const nextPlace = ownWard
    ? ` on ${ownWard.name}`
    : siteName
      ? ` at ${siteName}`
      : service === "all"
        ? ""
        : ` in ${service}`;
  const heroNext: HeroNextStep = {
    answer:
      nextKey === "blocked"
        ? `${counts.blocked} held-up ${noun(counts.blocked)}${nextPlace} ${counts.blocked === 1 ? "needs" : "need"} chasing`
        : nextKey === "confirmed"
          ? `Nothing held up${nextPlace} · ${counts.confirmed} confirmed ${noun(counts.confirmed)} to see out`
          : `Nothing held up${nextPlace}`,
    // CodeRabbit (#1380): the status counts are open records, not Recorded's list, so no action there.
    action:
      nextKey === null || !nowView
        ? undefined
        : {
            label:
              status === nextKey
                ? "Show all"
                : nextKey === "blocked"
                  ? `Show ${HELD_UP.toLowerCase()}`
                  : "Show confirmed",
            pressed: status === nextKey,
            testId: "ward-discharge-next-action",
            onClick: () => {
              setStatus(status === nextKey ? "all" : nextKey);
              s.clearSelection();
            },
          },
  };

  /* ---- detail drawer (drawer review, 6 Nov 2026) ---- */
  const drawerHead = activeRecord
    ? recordDrawerHead(s, activeRecord)
    : detailRelease
      ? releaseDrawerHead(s, detailRelease)
      : null;
  // The phone shows the release's panes together (no tabs); a record keeps its tabs at every width.
  const drawerTabs = drawerHead && (activeRecord || !isPhone) ? dischargeDrawerTabs(drawerHead.hasBlocker) : undefined;
  // "Going to" sits in the body, beside the facts, so the foot keeps one primary and one secondary.
  const departureField =
    canRecordDeparture && detailRelease ? (
      <Field label="Going to" className={pageStyles.departDest}>
        <Select
          aria-label="Where are they going?"
          data-testid="ward-discharge-departure-destination"
          value={departureDestination}
          onChange={(event) =>
            setDeparture({
              releaseId: detailRelease.id,
              destination: event.target.value as LeavingDestination,
            })
          }
        >
          {LEAVING_DESTINATIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    ) : null;
  const recordDeparture = (variant: "pri" | "sec") =>
    canRecordDeparture && detailRelease ? (
      <Button
        variant={variant}
        className={variant === "pri" ? pageStyles.drawerPrimary : undefined}
        data-testid="ward-discharge-record-departure"
        onClick={() => {
          const who = linkedReleaseRecord ? recordName(linkedReleaseRecord) : "The person";
          const admissionId = detailRelease.admissionId;
          const completion = recordWardDeparture(
            admissionId,
            detailRelease.unitId,
            departureDestination,
            s.releaseActor.role === "coordinator" ? "coordinator" : "ward",
          );
          // The completion carries this command's accepted Undo record, including shared saves.
          offerDeparture(
            {
              success: `Recorded: ${who} has left the ward.`,
              undo: (at) => ({
                type: "UNDO_DEPARTURE",
                role: s.releaseActor.role,
                now: at,
                admissionId,
                ...(s.releaseActor.role === "ward" ? { actingUnitId: s.releaseActor.actingUnitId } : {}),
              }),
              undone: `Undone. ${who} is back in their bed.`,
            },
            { completion },
          );
        }}
      >
        Record discharge
      </Button>
    ) : null;
  // The next step: Clear hold-up on a phone, Record discharge once confirmed, otherwise the row's own
  // action (Chase opens Held up, Confirm date the date control).
  const releaseAction =
    detailRelease && detailRelease.state !== "discharged" && !canRecordDeparture
      ? releaseActionLabel(detailRelease, canChangeDate)
      : null;
  const drawerPrimary =
    phoneClearBlocker && detailRelease ? (
      <Button
        variant="pri"
        className={pageStyles.drawerPrimary}
        data-testid="ward-discharge-clear-blocker"
        onClick={() =>
          dispatch({
            type: "CLEAR_BED_RELEASE_BLOCK",
            role: s.releaseActor.role,
            now,
            releaseId: detailRelease.id,
            actingUnitId: detailRelease.unitId,
          })
        }
      >
        Clear hold-up
      </Button>
    ) : canRecordDeparture ? (
      recordDeparture("pri")
    ) : detailRelease && releaseAction && releaseAction !== "Open" ? (
      <Button
        variant="pri"
        className={pageStyles.drawerPrimary}
        onClick={(e) =>
          openReleaseOn(detailRelease.id, e.currentTarget, releaseActionPart(detailRelease, canChangeDate))
        }
      >
        {releaseAction}
      </Button>
    ) : null;
  // Ward peek (8 Nov 2026): the ward's beds in a pop-up, the ward page one link further.
  const openWard = selectedUnitId ? (
    <WardPeekButton unitId={selectedUnitId} href={`/ward-flow/ward/${selectedUnitId}`} label="Open ward" />
  ) : null;
  const recordLink =
    detailRelease && linkedReleaseRecord ? (
      <Button
        variant="sec"
        icon={FileText}
        onClick={(e) => {
          s.setPopulation("records");
          openRecord(linkedReleaseRecord, e.currentTarget);
        }}
      >
        Discharge record
      </Button>
    ) : null;
  // Phone (drawer review): one primary and one secondary. A wider screen keeps the record link too.
  const drawerSecondary = isPhone ? (
    phoneClearBlocker && canRecordDeparture ? (
      recordDeparture("sec")
    ) : (
      openWard
    )
  ) : (
    <>
      {recordLink}
      {openWard}
    </>
  );
  const drawerFoot = selectedUnitId ? (
    <>
      {drawerPrimary}
      <DrawerFootRow className={pageStyles.drawerFootRow}>{drawerSecondary}</DrawerFootRow>
    </>
  ) : undefined;

  return (
    <div className={`${styles.screen} ${pageStyles.screen}`} data-testid="ward-discharge-board" data-ward-design="v6">
      <main id="main-content" className={pageStyles.main}>
        <h1 className={pageStyles.localTitle}>Discharges</h1>
        <p className={pageStyles.printScope}>
          {population === "records" ? "Admission records" : "Discharges by bed"} · Identifiers may be included
          {" · "}
          {ownWard ? ownWard.name : (siteName ?? (service === "all" ? "All services" : service))}
          {" · "}
          {ownWard
            ? "Own ward only"
            : ward === "all"
              ? "All wards"
              : unitLabel(
                  units.find((unit) => unit.id === ward),
                  ward,
                )}
          {" · "}
          {status === "all" ? "All statuses" : WORK_STATUS_LABELS[status]}
          {population === "records"
            ? ` · ${identity === "all" ? "All records" : identity === "linked" ? "Linked patient" : "Missing or unavailable"}`
            : ""}
          {" · "}As of {formatSheetMoment(now, dayZero, { includeYearAndZone: true })}
        </p>
        <Hero
          className={pageStyles.phoneHero}
          eyebrow={
            population === "releases"
              ? ownWard || siteName
                ? `Discharges · ${ownWard ? ownWard.name : siteName}`
                : isPhone
                  ? `Discharges · ${service === "all" ? "statewide" : service}`
                  : "Discharges · all services"
              : ownWard
                ? `Recorded · ${ownWard.name} · last ${RECORDED_DAYS} days`
                : `Recorded discharges · last ${RECORDED_DAYS} days`
          }
          // A4-22 (audit round 2): History counts admission records, not today's bed releases, so
          // its title says so rather than reading as the same figure jumping.
          title={
            population === "records"
              ? `${recorded.length} ${recorded.length === 1 ? "discharge" : "discharges"} recorded`
              : // Redesign (point 20): the headline counts the rows listed below it; the wider total
                // and what it adds sit beside it, so no two figures on the page disagree unexplained.
                `${openCount} to work now`
          }
          titleMeta={
            <span
              className={`${pageStyles.bedDaysPast} ${releaseList.meta}`}
              data-testid="ward-discharge-bed-days-past"
            >
              {/* Josh, 30 Oct: "59 to work now · of 207 open". Open is every release not yet discharged;
                  the 148 due in 2+ days are said once, in the list's footer. */}
              {population === "releases" ? (
                <>
                  {`${isPhone ? "" : "· "}of ${openReleases.length} open · `}
                  <strong>{bedDaysPast}</strong> bed {bedDaysPast === 1 ? "day" : "days"} past the ward&rsquo;s date
                </>
              ) : (
                <>
                  {isPhone ? "" : "· "}
                  <strong>{followUpToCheck}</strong> {followUpToCheck === 1 ? "follow-up" : "follow-ups"} to check
                </>
              )}
            </span>
          }
          next={heroNext}
          aside={
            <div className={pageStyles.heroTools}>
              <LiveChip state="live" onHero />
              {isPhone ? null : (
                <Button
                  size="sm"
                  variant="onHero"
                  icon={Copy}
                  onClick={nowView ? copySummary : copyRecorded}
                  data-testid="ward-discharge-copy"
                >
                  Copy counts
                </Button>
              )}
              <Button
                size="sm"
                variant="onHero"
                icon={Printer}
                className={pageStyles.desktopOnly}
                onClick={() => window.print()}
                data-testid="ward-discharge-print"
                aria-label="Print list (may include identifiers)"
              >
                Print list
              </Button>
              <span className={pageStyles.copyNote} role="status" aria-live="polite">
                {copyNote}
              </span>
            </div>
          }
          bar={
            population === "records" ? undefined : (
              <>
                <div
                  className={pageStyles.kpiStrip}
                  data-testid="ward-discharge-kpi-strip"
                  role="region"
                  aria-label="Discharge pipeline highlights"
                >
                  {WORK_ORDER.map((key) => (
                    <button
                      key={key}
                      type="button"
                      data-testid={`ward-discharge-kpi-${key}`}
                      className={pageStyles.kpi}
                      aria-pressed={statusHighlight === key}
                      // P082: the name starts with what the button shows (count, then label).
                      aria-label={`${counts[key]} ${key === "blocked" ? `${HELD_UP} (${kpiCardLabel(key, population)})` : kpiCardLabel(key, population)}`}
                      onClick={() => {
                        setHighlight(statusHighlight === key ? null : { kind: "status", status: key });
                        setStatus("all");
                      }}
                    >
                      <strong className={pageStyles.kpiValue}>{counts[key]}</strong>{" "}
                      <span className={pageStyles.kpiLabel}>
                        {key === "departed" ? null : <StatusGlyph tone={stageTone(key)} size={9} />}
                        <span>
                          {/* Josh, 30 Oct: one word for a release with a blocker, "Held up", at every width. */}
                          {key === "blocked" ? HELD_UP : kpiCardLabel(key, population)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                {/* Device audit, 11 Oct 2026: no desk tools in the phone hero, so Copy summary
                  is off phone (it stays in the tablet and desktop hero). */}
              </>
            )
          }
          barAside={isPhone ? undefined : populationSwitch}
        />
        {nowView && s.releaseActor.role === "coordinator" && overdueOpen.length > 0 ? (
          /* DC1 round 2 (3 Nov 2026): the coordinator's most common chase is one tap. The line says
             how many dates have passed on how many wards, and the button asks just those wards. */
          <div className={releaseList.chase} data-testid="ward-discharge-chase">
            <span className={releaseList.chaseText}>
              <StatusGlyph tone="warning" size={9} />
              <span>
                <strong>{overdueOpen.length}</strong> overdue {overdueOpen.length === 1 ? "date" : "dates"} on{" "}
                <strong>{overdueWards}</strong> {overdueWards === 1 ? "ward" : "wards"}
              </span>
            </span>
            <DischargeAskOverdueWards
              overdue={overdueOpen}
              wardName={(unitId) => units.find((unit) => unit.id === unitId)?.name ?? "Ward"}
              now={now}
              dispatch={dispatch}
            />
          </div>
        ) : null}
        {isPhone ? (
          <div className={`${pageStyles.phToolbar} ${wardPin.pinnedSwitch}`}>
            {populationSwitch}
            <button
              type="button"
              className={pageStyles.phFilterButton}
              aria-label={filtersActive ? "Filters, some applied" : "Filters"}
              aria-expanded={phoneFiltersOpen}
              data-active={filtersActive || undefined}
              onClick={() => setPhoneFiltersOpen(true)}
              data-testid="ward-discharge-phone-filters"
            >
              <Filter size={18} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {isPhone ? (
          <PhoneSheet
            open={phoneFiltersOpen}
            onClose={() => setPhoneFiltersOpen(false)}
            title="Filters"
            description="Filters narrow the list. Highlights never hide anyone."
          >
            {filterCard}
          </PhoneSheet>
        ) : null}
        {guarded.status === "allowed" && isPhone && nowView ? (
          /* v10 phone: the two charts are one tap away as cards; each opens a sheet that scrolls
             sideways with 48px tap columns. A tap highlights rows and closes the sheet. */
          <div className={pageStyles.phChartCards} data-testid="ward-discharge-phone-chart-cards">
            <button
              type="button"
              className={pageStyles.phChartCard}
              // CB-3: the name starts with the card's visible words (axe label-content-name-mismatch).
              aria-label={`Per day, ${phoneOverdue} overdue, ${phoneToday} today. Expected discharges per day, overdue and the next ${chartDays.filter((day) => day.key !== "past").length} days`}
              onClick={() => setPhoneChart("days")}
            >
              <TrendingUp size={16} aria-hidden="true" className={pageStyles.phChartIcon} />
              <span className={pageStyles.phChartText}>
                <span className={pageStyles.phChartTitle}>Per day</span>{" "}
                <span className={pageStyles.phChartMeta}>
                  <b>{phoneOverdue}</b> overdue · <b>{phoneToday}</b> today
                </span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className={pageStyles.phChartIcon} />
            </button>
            <button
              type="button"
              className={pageStyles.phChartCard}
              aria-label={`By reason, ${barrierCounts[0] && barrierCounts[0].count > 0 ? `Most: ${barrierCounts[0].label}` : "None held up"}. Held up by reason, ${barrierCounts.filter((barrier) => barrier.count > 0).length} reasons`}
              onClick={() => setPhoneChart("barriers")}
            >
              <OctagonAlert size={16} aria-hidden="true" className={pageStyles.phChartIcon} />
              <span className={pageStyles.phChartText}>
                <span className={pageStyles.phChartTitle}>By reason</span>{" "}
                <span className={`${pageStyles.phChartMeta} ${releaseList.phChartWrap}`}>
                  {barrierCounts[0] && barrierCounts[0].count > 0 ? `Most: ${barrierCounts[0].label}` : "None held up"}
                </span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className={pageStyles.phChartIcon} />
            </button>
            <PhoneSheet
              open={phoneChart !== null}
              onClose={() => setPhoneChart(null)}
              title={phoneChart === "barriers" ? "Held up by reason" : "Expected discharges per day"}
              description="Tap to highlight people in the list. Nobody is hidden."
              height="tall"
              className={pageStyles.phChartSheet}
              data-testid="ward-discharge-phone-chart-sheet"
            >
              {phoneChart === "barriers" ? (
                <DischargeBarrierBars
                  barriers={barrierCounts}
                  counts={nowView ? "releases" : "people"}
                  selected={highlight?.kind === "barrier" ? highlight.id : null}
                  onSelect={(id) => {
                    highlightOn({ kind: "barrier", id });
                    setPhoneChart(null);
                  }}
                  onClear={() => setHighlight(null)}
                />
              ) : (
                <DischargeDayChart
                  days={chartDays}
                  selected={highlight?.kind === "day" ? highlight.day : null}
                  onSelect={(day) => {
                    highlightOn({ kind: "day", day });
                    setPhoneChart(null);
                  }}
                  onClear={() => setHighlight(null)}
                />
              )}
            </PhoneSheet>
          </div>
        ) : null}
        {/* Josh, 30 Oct: the weekend and holiday cut-offs are a compact notice above the list, not a
            panel under about 60 rows. */}
        {guarded.status === "allowed" && population === "releases" ? (
          <DischargeWeekendPrep
            // DC3 (Josh, 3 Nov 2026): the card follows the Service and Ward filters, as the list does.
            releases={s.bedReleases.filter(
              (release) =>
                s.scopedUnits.some((unit) => unit.id === release.unitId) && (ward === "all" || release.unitId === ward),
            )}
            units={units}
            nameFor={(release) => {
              const record = records.find((candidate) => candidate.admissionId === release.admissionId);
              return record ? recordName(record) : null;
            }}
            umrnFor={(release) => {
              const record = records.find((candidate) => candidate.admissionId === release.admissionId);
              return record?.identity.kind === "linked" ? record.identity.patient.umrn : null;
            }}
            now={now}
            dayZero={dayZero}
            onOpen={(id, opener) => openReleaseOn(id, opener, "barriers")}
            foldable={isPhone}
          />
        ) : null}
        <div
          className={`${pageStyles.workspace} ${releaseList.workspace}`}
          data-recorded={population === "records" || undefined}
        >
          <Card className={`${pageStyles.register} ${releaseList.list}`} aria-labelledby="discharge-register-heading">
            <header className={pageStyles.panelHeader}>
              <h2 id="discharge-register-heading" className={isPhone ? pageStyles.localTitle : pageStyles.listTitle}>
                {population === "releases" ? "Discharges by bed" : "Recorded discharges"}
              </h2>
              {/* Redesign (Josh, 30 Oct): the List / Barriers switch is gone. Its Barriers view was a third
                  copy of the barrier counts; the one panel beside the list keeps that job. */}
              {/* Josh, 30 Oct: the order line is cut; the order itself (held up first, then by stage,
                  soonest time band first in each) stays. */}
              <span className={releaseList.headerSpacer} aria-hidden="true" />
              {highlight !== null ? (
                <span className={pageStyles.highlightNote} data-testid="ward-discharge-highlight-note">
                  <StatusGlyph tone="info" size={9} />
                  {shownHighlighted} of {nowView ? toWorkCount + dayExtra.length : shown} highlighted, all rows stay
                  <Button size="sm" variant="ghost" onClick={() => setHighlight(null)}>
                    Clear
                  </Button>
                </span>
              ) : null}
              <span
                className="sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                data-testid="discharge-pipeline-announcement"
              >
                {population === "releases" ? "Discharges by bed" : "Admission records"}: {counts.blocked} held up,{" "}
                {counts.confirmed} confirmed, {counts.expected} expected, {counts.departed} discharged.
              </span>
              {/* Not a live region: the screen-reader summary above (discharge-pipeline-announcement)
                  already speaks these counts as one sentence, so this badge is for the eye only. */}
              <span className={pageStyles.shownCountBadge}>
                {/* Device audit, 11 Oct 2026: the hero says 53 open and the list holds 57, so the
                    list names both parts rather than a bare "57 shown". */}
                {population === "records" && guarded.status === "denied"
                  ? "Unavailable"
                  : population === "records"
                    ? `Last ${RECORDED_DAYS} days`
                    : status === "all" && shown === total
                      ? `${toWorkCount} to work${counts.departed > 0 ? ` · ${counts.departed} discharged` : ""}`
                      : `${shown} shown`}
              </span>
              {/* Export (feature 44) sits with the list it exports, not in the page top (page-tops v6). */}
              {isPhone ? null : (
                <ListExportButton
                  load={exportList}
                  variant="ghost"
                  disabled={exportCount === 0}
                  testId="ward-discharge-export"
                />
              )}
            </header>
            {isPhone ? null : <DischargeFilterCard s={s} bare />}
            <div
              ref={listRef}
              className={pageStyles.listBody}
              role="region"
              aria-label="Discharge worklist"
              tabIndex={0}
            >
              {population === "records" && guarded.status === "denied" ? (
                <p className={pageStyles.emptyState}>Discharge records are unavailable for this role.</p>
              ) : population === "records" && recorded.length === 0 ? (
                <p className={pageStyles.emptyState}>
                  {filtersActive
                    ? "No recorded discharges match these filters."
                    : `No discharges recorded in the last ${RECORDED_DAYS} days.`}
                </p>
              ) : shown === 0 ? (
                <p className={pageStyles.emptyState}>
                  {/* Q277 (pre-launch review E5, 2 Nov 2026): with every filter on All, nothing is
                      filtered out, so the line says plainly what is there. Open discharges due later
                      than the worklist's window can leave it empty while some are still open. */}
                  {population === "releases" && !filtersActive
                    ? openReleases.length === 0
                      ? "No discharges open."
                      : "No discharges to work now."
                    : `No ${population === "releases" ? "discharges" : "records"} match these filters.`}
                </p>
              ) : (
                <table className={pageStyles.workTable}>
                  <caption className={pageStyles.localTitle}>
                    {population === "releases"
                      ? "Discharges by bed, held up first. Rows may include identifiers. Completed discharges cover the last 24 hours."
                      : `Discharges recorded in the last ${RECORDED_DAYS} days, newest first. Rows may include identifiers.`}
                  </caption>
                  {population === "releases" && !isPhone ? (
                    <thead>
                      <tr>
                        <th scope="col" className={pageStyles.colPerson}>
                          Person
                        </th>
                        <th scope="col" className={pageStyles.colOut}>
                          Expected out
                        </th>
                        {/* DC2 (Josh, 3 Nov 2026): the group heading already names the stage, so the
                            Stage column is gone; a held up row says its stage under the hold-up. */}
                        <th scope="col" className={pageStyles.colBlocker}>
                          Held up by
                        </th>
                        <th scope="col" className={releaseList.actionHead}>
                          <span className="sr-only">Next</span>
                        </th>
                      </tr>
                    </thead>
                  ) : (
                    <thead>
                      <tr>
                        <th scope="col">{ownWard ? "Patient" : "Patient / ward"}</th>
                        <th scope="col">{population === "releases" ? "Timing" : "Left"}</th>
                        <th scope="col">{population === "releases" ? "Stage / hold-up" : "Going to"}</th>
                        {population === "records" ? <th scope="col">7 day follow-up</th> : null}
                        {population === "releases" ? (
                          <th scope="col" className={releaseList.actionHead}>
                            <span className="sr-only">Next</span>
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                  )}
                  {population === "records" ? (
                    <tbody>
                      {recorded.map((record) => {
                        const unit = units.find((candidate) => candidate.id === record.unitId);
                        const isSelected = selected?.admissionId === record.admissionId;
                        const check = followUpOf(record);
                        return (
                          <tr
                            key={record.id}
                            /* Return to your place: Back focuses the row that was opened. */
                            data-record-key={record.id}
                            data-selected={isSelected}
                            onClick={(e) => openRecord(record, e.currentTarget)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openRecord(record, e.currentTarget);
                              }
                            }}
                            className={pageStyles.interactiveRow}
                            tabIndex={0}
                          >
                            <td data-label="Patient / ward">
                              <button
                                type="button"
                                className={pageStyles.recordButton}
                                aria-pressed={isSelected}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRecord(record, e.currentTarget);
                                }}
                              >
                                {recordName(record)}
                              </button>
                              <span className={pageStyles.secondaryMono}>
                                {record.identity.kind === "linked" ? record.identity.patient.umrn : record.admissionId}
                              </span>
                              {ownWard ? null : (
                                <span className={pageStyles.secondary}>{placeLine(unit, record.unitId)}</span>
                              )}
                            </td>
                            <td data-label="Left" className={pageStyles.timingCell}>
                              <strong className={pageStyles.due}>{recordedMoment(record.leftAt, dayZero)}</strong>
                            </td>
                            <td data-label="Going to">
                              {LEAVING_DESTINATIONS.find((item) => item.id === record.leavingDestination)?.label ??
                                "Not recorded"}
                            </td>
                            <td data-label="7 day follow-up">
                              <span className={releaseList.followUp} data-warning={check.warning || undefined}>
                                <StatusGlyph tone={check.warning ? "warning" : "success"} size={9} />
                                {check.status === "booked_within"
                                  ? "Booked"
                                  : check.status === "booked_outside"
                                    ? "Booked late"
                                    : check.status === "arranged_no_date"
                                      ? "No time yet"
                                      : "Not arranged"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  ) : (
                    visibleReleaseGroups.map((key) => (
                      <tbody
                        key={key}
                        data-testid={`ward-discharge-group-${key}`}
                        data-has-items={shownGroups[key].length > 0}
                      >
                        <tr className={pageStyles.groupRow}>
                          <th colSpan={4} scope="rowgroup">
                            {isPhone ? (
                              <button
                                type="button"
                                className={pageStyles.phGroupToggle}
                                aria-expanded={!phoneGroupsFolded[key]}
                                data-testid={`ward-discharge-group-toggle-${key}`}
                                onClick={() => setPhoneGroupsFolded((folded) => ({ ...folded, [key]: !folded[key] }))}
                              >
                                <StatusGlyph tone={PHONE_GROUP_TONES[key]} size={10} />
                                <h3>
                                  {PHONE_GROUP_TITLES[key]}{" "}
                                  <span className={pageStyles.phGroupCount}>{releaseGroups[key].length}</span>
                                </h3>
                                {phoneGroupsFolded[key] ? (
                                  <ChevronRight size={16} aria-hidden="true" className={pageStyles.phGroupChevron} />
                                ) : (
                                  <ChevronDown size={16} aria-hidden="true" className={pageStyles.phGroupChevron} />
                                )}
                              </button>
                            ) : (
                              <div className={pageStyles.groupHead}>
                                <StatusGlyph tone={PHONE_GROUP_TONES[key]} size={10} />
                                <h3>
                                  {GROUP_TITLES[key]}{" "}
                                  <span className={pageStyles.groupCount}>{releaseGroups[key].length}</span>
                                  {key === "expected" && dayExtra.length > 0 ? (
                                    <span className={pageStyles.groupCount}>+{dayExtra.length} that day</span>
                                  ) : null}
                                </h3>
                                {/* Josh, 30 Oct: the held-up and discharged groups lose their sentence. */}
                                {GROUP_NOTES[key] ? (
                                  <span className={pageStyles.groupSub}>{GROUP_NOTES[key]}</span>
                                ) : null}
                              </div>
                            )}
                          </th>
                        </tr>
                        {isPhone && phoneGroupsFolded[key] ? null : shownGroups[key].length === 0 ? (
                          <tr>
                            <td colSpan={4} className={pageStyles.emptyGroup}>
                              None
                            </td>
                          </tr>
                        ) : (
                          // Josh, 30 Oct: every width shows a group's first rows, then Show more, as the phone did.
                          (!phoneGroupsOpen[key]
                            ? litFirst(shownGroups[key], releaseLit).slice(0, groupCap(key))
                            : litFirst(shownGroups[key], releaseLit)
                          ).map((release, index) => {
                            const unit = units.find((candidate) => candidate.id === release.unitId);
                            const linked = records.find((candidate) => candidate.admissionId === release.admissionId);
                            const overdue = release.state !== "discharged" && release.expectedAt < now;
                            const criteriaChip =
                              criteriaLedOn && linked && release.state !== "discharged"
                                ? criteriaLedTileChip(
                                    dischargeCriteriaStatus(linked.dischargeCriteria, linked.criteriaEligibility, now),
                                  )
                                : null;
                            const criteriaTag = criteriaChip ? (
                              <span data-testid="ward-discharge-criteria-led">
                                <SrOnly>, </SrOnly>
                                <CriteriaLedTag chip={criteriaChip} />
                                <SrOnly>{criteriaChip.phrase}</SrOnly>
                              </span>
                            ) : null;
                            return (
                              <tr
                                key={release.id}
                                data-release-id={release.id}
                                data-selected={releaseId === release.id}
                                data-highlighted={releaseLit(release) || undefined}
                                data-dim={dimmed(releaseLit(release))}
                                // The first held-up row only takes the page's one tint, amber since the 4 Nov 2026
                                // audit (device audit, 11 Oct 2026; no side edge since the 31 Oct 2026 owner ruling).
                                data-act={(key === "blocked" && index === 0) || undefined}
                                onClick={(e) => openReleaseOn(release.id, e.currentTarget, "milestones")}
                                onKeyDown={(e) => {
                                  // Only the row's own key press: Enter on Chase or Confirm date must reach that button.
                                  if (e.target !== e.currentTarget) return;
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openReleaseOn(release.id, e.currentTarget, "milestones");
                                  }
                                }}
                                className={pageStyles.interactiveRow}
                                tabIndex={0}
                              >
                                {isPhone ? null : (
                                  <>
                                    <td className={pageStyles.colPerson}>
                                      <button
                                        type="button"
                                        className={pageStyles.recordButton}
                                        aria-pressed={releaseId === release.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openReleaseOn(release.id, e.currentTarget, "milestones");
                                        }}
                                      >
                                        {linked ? recordName(linked) : "Name not recorded"}
                                      </button>
                                      <span className={pageStyles.personMeta}>
                                        {linked?.identity.kind === "linked" ? (
                                          <span className={pageStyles.mono}>{linked.identity.patient.umrn}</span>
                                        ) : null}
                                        <span>
                                          {ownWard ? healthServiceLabel(unit) : unitLabel(unit, release.unitId)}
                                        </span>
                                      </span>
                                    </td>
                                    <td className={`${pageStyles.colOut} ${pageStyles.timingCell}`}>
                                      {overdue ? (
                                        <span className={pageStyles.outLate}>
                                          <StatusGlyph tone="danger" size={9} />
                                          {pastWords(now - release.expectedAt)}
                                        </span>
                                      ) : (
                                        <span className={pageStyles.outBand}>
                                          {/* Audit A2 (5 Nov 2026): as in the list cell, a discharge that has
                                              happened says "Left", never "Now". */}
                                          {release.state === "discharged"
                                            ? "Left"
                                            : BAND_LABELS[releaseBand(release, now) as ReleaseBand]}
                                        </span>
                                      )}
                                      <span className={pageStyles.outWhen}>
                                        {release.state === "discharged"
                                          ? recordedMoment(release.confirmedAt, dayZero)
                                          : overdue || releaseBand(release, now) === "beyond-today"
                                            ? recordedDate(release.expectedAt, dayZero)
                                            : recordedMoment(release.expectedAt, dayZero)}
                                      </span>
                                    </td>
                                    <td className={pageStyles.colBlocker}>
                                      {release.state !== "discharged" && release.blocker ? (
                                        <span className={pageStyles.blockerCell}>
                                          <span className={pageStyles.blockerTag}>
                                            {/* Icon rules (3 Nov 2026): the tag carries no triangle (red tint only); the one act-now mark is the overdue date. */}
                                            {release.blocker.replace(/^Awaiting (\w)/, (_, first: string) =>
                                              first.toUpperCase(),
                                            )}
                                          </span>
                                          <span className={pageStyles.personMeta}>
                                            {release.waitingOn ? (
                                              <>
                                                <Ambulance
                                                  size={12}
                                                  className={pageStyles.inlineIcon}
                                                  aria-hidden="true"
                                                />{" "}
                                                {release.waitingOn}
                                                {" · "}
                                              </>
                                            ) : null}
                                            {release.state === "confirmed" ? "Confirmed" : "Expected"}
                                          </span>
                                        </span>
                                      ) : release.state === "discharged" ? null : (
                                        <span className="sr-only">Not held up</span>
                                      )}
                                      {criteriaTag}
                                    </td>
                                  </>
                                )}
                                {isPhone ? (
                                  <>
                                    <td data-label={ownWard ? "Patient" : "Patient / ward"}>
                                      <button
                                        type="button"
                                        className={pageStyles.recordButton}
                                        aria-pressed={releaseId === release.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openReleaseOn(release.id, e.currentTarget, "milestones");
                                        }}
                                      >
                                        {/* Redesign: the person first, then the ward and service. */}
                                        {linked ? recordName(linked) : "Name not recorded"}
                                      </button>
                                      {ownWard ? null : (
                                        <span className={pageStyles.secondary}>{placeLine(unit, release.unitId)}</span>
                                      )}
                                    </td>
                                    <td
                                      data-label="Timing"
                                      className={`${pageStyles.timingCell} ${releaseList.timing}`}
                                    >
                                      {/* Device audit, 11 Oct 2026: a release past its date says how far
                                      past, with the date alone; "Now" and the clock time read as
                                      due this minute on rows one to four days late. */}
                                      {overdue ? (
                                        <>
                                          <strong className={pageStyles.band}>
                                            <StatusGlyph tone="danger" size={9} />
                                            {pastWords(now - release.expectedAt)}
                                          </strong>{" "}
                                          <span className={pageStyles.due}>
                                            {recordedDate(release.expectedAt, dayZero)}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <strong className={pageStyles.band}>
                                            {/* Review 5 Nov 2026: a completed discharge said "Now" beside
                                            the time it left. It says "Left" and keeps that time. */}
                                            {release.state === "discharged"
                                              ? "Left"
                                              : BAND_LABELS[releaseBand(release, now) as ReleaseBand]}
                                          </strong>{" "}
                                          <span className={pageStyles.due}>
                                            {/* Josh, 30 Oct: a Later row shows its date alone; its clock time
                                            only mirrored the board clock. */}
                                            {release.state !== "discharged" &&
                                            releaseBand(release, now) === "beyond-today"
                                              ? recordedDate(release.expectedAt, dayZero)
                                              : recordedMoment(
                                                  release.state === "discharged"
                                                    ? release.confirmedAt
                                                    : release.expectedAt,
                                                  dayZero,
                                                )}
                                          </span>
                                        </>
                                      )}
                                    </td>
                                    <td data-label="Hold-up">
                                      <div className={pageStyles.stageCluster}>
                                        {/* A stuck release keeps its own stage word, so a blocked confirmation
                                        still reads apart from a blocked prediction, but never with the
                                        green tick beside its blocker (UX audit, 21 Oct 2026). */}
                                        {release.state !== "discharged" && release.blocker !== null ? (
                                          <span className={pageStyles.badge} data-status="blocked">
                                            {/* Phone audit (Josh, 1 Nov 2026): one warning mark per row; a
                                            row already marked past its date keeps that mark alone. */}
                                            <span className="sr-only">Held up: </span>
                                            <span>{WORK_STATUS_LABELS[release.state]}</span>
                                          </span>
                                        ) : (
                                          /* DC2 round 2 (3 Nov 2026): the group heading already says
                                          Confirmed, Expected or Discharged, so a row without a hold-up
                                          no longer repeats it as a badge. Screen readers still hear it. */
                                          <SrOnly>
                                            {
                                              WORK_STATUS_LABELS[
                                                release.state === "discharged" ? "departed" : release.state
                                              ]
                                            }
                                          </SrOnly>
                                        )}
                                        {release.blocker && (
                                          <>
                                            {/* Q238: a hidden comma in place of the old "· " prefix. */}
                                            <SrOnly>, </SrOnly>
                                            <span className={pageStyles.blocker}>{release.blocker}</span>
                                          </>
                                        )}
                                        {release.waitingOn && (
                                          <>
                                            <SrOnly>, </SrOnly>
                                            <span className={pageStyles.secondary}>
                                              <Ambulance
                                                size={12}
                                                className={pageStyles.inlineIcon}
                                                aria-hidden="true"
                                              />{" "}
                                              {release.waitingOn}
                                            </span>
                                          </>
                                        )}
                                        {criteriaTag}
                                      </div>
                                    </td>
                                  </>
                                ) : null}
                                <td className={releaseList.actionCell}>
                                  {release.state === "discharged" ? null : (
                                    <Button
                                      size="sm"
                                      variant="sec"
                                      className={releaseList.rowAction}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openReleaseOn(
                                          release.id,
                                          e.currentTarget,
                                          releaseActionPart(release, canChangeDate),
                                        );
                                      }}
                                    >
                                      {releaseActionLabel(release, canChangeDate)}
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                        {!(isPhone && phoneGroupsFolded[key]) && shownGroups[key].length > groupCap(key) ? (
                          <tr className={releaseList.moreRow} data-testid={`ward-discharge-more-${key}`}>
                            <td colSpan={4}>
                              <ShowMoreRow
                                expanded={Boolean(phoneGroupsOpen[key])}
                                onClick={() => setPhoneGroupsOpen((open) => ({ ...open, [key]: !open[key] }))}
                              >
                                {phoneGroupsOpen[key]
                                  ? "Show fewer"
                                  : `Show ${shownGroups[key].length - groupCap(key)} more ${(key === "discharged-today" ? "discharged" : GROUP_TITLES[key]).toLowerCase()}`}
                              </ShowMoreRow>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    ))
                  )}
                </table>
              )}
            </div>
            <footer
              className={pageStyles.registerFooter}
              data-testid="ward-discharge-excluded"
              hidden={population === "records" && guarded.status === "denied"}
            >
              {population === "releases" ? (
                <>
                  <span>{releaseGroups.excludedBeyondToday} due in 2+ days, not listed</span>
                  <span data-testid="ward-discharge-completed-before-today">
                    {releaseGroups.completedBeforeToday} discharged 24h+ ago
                  </span>
                  <span className={pageStyles.footNote}>No expected bed counts as ready</span>
                </>
              ) : (
                <>
                  <span>
                    {followUpToCheck} of {recorded.length} follow-ups to check
                  </span>
                  <span className={pageStyles.footNote}>Held up and expected discharges are on Now</span>
                </>
              )}
            </footer>
          </Card>
          {/* Redesign (Josh, 30 Oct): the one barrier panel, and under it the day chart, beside the list on a
              wide screen, so "Choose a day" sits beside the rows it highlights. On a tablet both keep their
              place under the list. The Barriers view is gone. */}
          {guarded.status === "allowed" && !isPhone && nowView ? (
            <div className={releaseList.barrierSide}>
              <DischargeBarrierBars
                barriers={barrierCounts}
                counts={nowView ? "releases" : "people"}
                selected={highlight?.kind === "barrier" ? highlight.id : null}
                onSelect={(id) => highlightOn({ kind: "barrier", id })}
                onClear={() => setHighlight(null)}
              />
              <DischargeDayChart
                days={chartDays}
                layout="rows"
                selected={highlight?.kind === "day" ? highlight.day : null}
                onSelect={(day) => highlightOn({ kind: "day", day })}
                onClear={() => setHighlight(null)}
              />
            </div>
          ) : null}
        </div>
        {/* Drawer review (6 Nov 2026): the chosen discharge opens in the kit drawer at every width, as
            Home, Capacity and Transport do. The list keeps the page's one scroll and its full width;
            the drawer's body is the only scroll inside it. */}
        {selected || releaseId ? (
          <PanelDrawer
            open
            onClose={closeDrawer}
            title={drawerHead?.title ?? "Selected discharge"}
            titleId="discharge-detail-heading"
            subtitle={drawerHead?.subtitle}
            tag={drawerHead?.tag}
            tabs={drawerTabs}
            tab={drawerTab}
            onTabChange={setDrawerTab}
            tabsLabel="Discharge inspection sections"
            bodyLabel="Selected discharge details"
            testId="ward-discharge-detail"
            className={pageStyles.detailDrawer}
            bodyClassName={pageStyles.detailDrawerBody}
            foot={drawerFoot}
          >
            {activeRecord ? (
              <DischargeRecordDetail key={activeRecord.id} s={s} activeRecord={activeRecord} />
            ) : detailRelease ? (
              <DischargeReleaseDetail
                key={`${detailRelease.id}:${openOn?.n ?? 0}`}
                s={s}
                detailRelease={detailRelease}
                openOn={openOn?.releaseId === detailRelease.id ? openOn.part : null}
                departure={departureField}
              />
            ) : selected?.handle === null ? (
              // D-80 item 17: the coordinator says why before the ward's record opens.
              <OnBehalfReasonForm key={selected.admissionId} onOpen={s.openOnBehalf} />
            ) : (
              <p className={pageStyles.emptyState}>This record could not be opened. Select it again to retry.</p>
            )}
          </PanelDrawer>
        ) : null}
        {guarded.status === "allowed" && !isPhone && nowView ? (
          /* Tablet: the day chart and the barrier panel under the list. A wide screen has both beside the
             list instead, so CSS hides this pair there (one barrier panel on screen at any width). */
          <div className={`${pageStyles.flowCharts} ${releaseList.chartsBottom}`}>
            <DischargeDayChart
              days={chartDays}
              selected={highlight?.kind === "day" ? highlight.day : null}
              onSelect={(day) => highlightOn({ kind: "day", day })}
              onClear={() => setHighlight(null)}
            />
            <DischargeBarrierBars
              barriers={barrierCounts}
              counts={nowView ? "releases" : "people"}
              selected={highlight?.kind === "barrier" ? highlight.id : null}
              onSelect={(id) => highlightOn({ kind: "barrier", id })}
              onClear={() => setHighlight(null)}
            />
          </div>
        ) : null}
        <WardPrototypeFooter
          testId="ward-discharge-governance"
          note="This board shows only what a ward has recorded — a release expected, confirmed or discharged, and whether it is currently blocked — and it never adds an expected or unreleased bed into the Ready figure · Not approved for clinical use"
        />
      </main>
    </div>
  );
}
