"use client";

import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ORIGIN_NOT_RECORDED } from "@/components/ward-management/ward-model";
import Link from "next/link";
import { Check, Ellipsis, FileText, Plus, Search } from "lucide-react";

import {
  AppliedFilter,
  Button,
  buttonClass,
  Card,
  CardBody,
  CardHead,
  ChipGroup,
  DisabledReason,
  FilterChip,
  FolderTabs,
  Hero,
  HeroAct,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  Menu,
  SearchField,
  folderTabClasses,
  useIsPhone,
  Segmented,
  ShowMoreRow,
  StatusGlyph,
  TierTile,
  durMinutes,
  foldLimit,
  cx,
  SrOnly,
} from "@/components/wf";

import { bedMeetingSheet } from "../capacity/bed-meeting-derivations";
import pageTop from "../page-top-title.module.css";
import { BedMeetingSheetLauncher } from "../capacity/bed-meeting-sheet";
import { BedRoundAnswersCard } from "./bed-round-answers-card";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { useWardFeatureFlag } from "../shell/ward-feature-flag-store";
import { setServiceScope, useServiceScope } from "../shell/ward-service-store";
import type { Admission } from "../ward-admissions";
import type { Movement } from "../ward-model";
import { HEALTH_SERVICES, type HealthService } from "../ward-model-vocabulary";
import { referralQueueOrder } from "../ward-referrals";
import { healthServiceAcronym, movementBelongsToService, unitHealthService } from "../ward-service-scope";
import { siteByCode } from "../ward-sites";
import { unitHref } from "../shell/ward-facade";
import { useCanOpenHref, useDeskInScope } from "../shell/ward-access";
import { referralBoardHref } from "../ed/ed-bed-search-step";
import { askingForShort, waitWords } from "../referrals/referral-board-parts";
import { WardPrototypeFooter } from "../shell/ward-prototype-footer";
import { formatInstantWithDay, type Instant, isTimePassed } from "../ward-clock";
import { useDueSoonThresholds, useWardFlowSelect } from "../ward-flow-provider";
import { useWardFormSave, type WardFormSave } from "../use-ward-form-save";
import { WARD_FLOW_ROLE_LABELS } from "../ward-flow-roles";
import { bedMeetingTvHref } from "../ward-nav";
import { DONE_PAUSE_MS, LONG_WAIT_MINUTES, LONG_WAIT_TEXT } from "../ward-operational-defaults";
import { usePatientOf } from "../ward-patient-name";
import { sheetPatientLabel } from "../ward-patient-resolver";
import { fieldsMatchEveryWord } from "../search/search-text";
import { useRefocusAfterRowLeaves } from "../use-refocus-after-row-leaves";
import {
  BED_MEETING_ACTION_DUE_HOURS,
  BED_MEETING_ACTION_KINDS,
  BED_MEETING_ACTION_OWNERS,
  bedMeetingActionLabel,
  openMeetingAction,
  type BedMeetingAction,
  type BedMeetingActionKind,
  type BedMeetingActionOwner,
} from "./bed-meeting-actions";
import {
  bedMeetingAgenda,
  closedBedsReviewSection,
  meetingActionSummary,
  type AgendaItem,
  type MeetingActionRow,
} from "./bed-meeting-agenda";
import { AgendaReferralsCopy, agendaReferralsText } from "./agenda-referrals-copy";
import {
  actionsRecordedSince,
  MEETING_STEPS,
  MEETING_SUMMARY_PAGE_CLASS,
  MeetingRunControls,
  MeetingSummary,
  useMeetingRun,
} from "./bed-meeting-run";
import styles from "./bed-meeting-agenda.module.css";
import { AgendaGroupFilterControl, toggleGroup } from "./bed-meeting-group-filter";
import {
  AGENDA_GROUP_FACETS,
  agendaGroupFilterActive,
  agendaGroupOptions,
  agendaGroupValueLabel,
  agendaGroupFilterWords,
  agendaGroupHidesReferrals,
  inAgendaGroups,
  movementInAgendaGroups,
  referralInAgendaGroups,
  type AgendaGroupFilter,
} from "./bed-meeting-groups";
import {
  useBedMeetingDone,
  useBedMeetingRecord,
  type MarkBedMeetingActionDone,
  type RecordBedMeetingAction,
} from "./use-bed-meeting-done";

/**
 * Smart features idea 5 (19 Oct 2026): the bed meeting's agenda, built from fixed rules, and its
 * action log. The chair records an action from a pick-list against a person on the agenda, with an
 * owner and a due time; the next meeting opens with what was done and what is overdue. Coordinator
 * only (an address the access table does not list). Its feature switch was removed on 24 Oct 2026.
 */
export function BedMeetingAgendaScreen() {
  return <BedMeetingAgenda />;
}

/**
 * Core pages redesign (Josh, 31 Oct 2026): a hero counting each list with Bed meeting sheet and Start
 * meeting, the four lists two by two so the agenda fits one screen, people surname first (D-83), and
 * a small "+ Action" on each row with the urgency the record carries beside it.
 */
/**
 * The pulled-beds card says its order without "expire", the app's word for legal expiry
 * (D-81 calls this a pull time limit). The rows already read "Pull 20m left".
 */
const CARD_TITLES: Record<string, string> = {
  holds: "Pulled beds, least time left",
};

/** The hero's short names for the four lists; the cards keep their full titles. */
/** Services shown as tabs on a phone before More (as Home's three tabs). */
const PHONE_SERVICE_TABS = 3;

const SHORT_TITLES: Record<string, string> = {
  "ed-waits": "ED waits",
  holds: "Pulled beds",
  stranded: "Stranded",
  "out-of-area": "Out of area",
};

/** The chips that narrow the agenda to one or more lists. None pressed shows every list. */
type ListChip = "ed-waits" | "holds" | "stranded" | "out-of-area" | "referrals" | "actioned";

/** Each list shows this many people, then "Show N more" (DESIGN-SYSTEM section 4 folds at about eight). */
const ROWS_SHOWN = 5;

/** A search needs this many letters before it lists anyone, so one keystroke does not flood the page. */
const SEARCH_MIN = 2;

function BedMeetingAgenda() {
  const { movements, admissions, bedReleases, units, leaveBeds, referrals, configuration, now } = useWardFlowSelect(
    "movements",
    "admissions",
    "bedReleases",
    "units",
    "leaveBeds",
    "referrals",
    "configuration",
    "now",
  );
  const patientOf = usePatientOf();
  const thresholds = useDueSoonThresholds();
  // Decision 46 (Josh, 31 Oct 2026): the site bed manager reads its own site's agenda only, so the
  // chair's controls (Action and Done) are the bed coordinator's alone.
  const chairs = useEffectiveWardAccess().role === "coordinator";
  const bedMeetingTvOn = useWardFeatureFlag("bed-meeting-tv");
  // Diagnosed issues B1 (Josh, 3 Nov 2026): the agenda follows the header's service, and a chip row
  // under the hero changes it in one tap, so the meeting can go service by service.
  const service = useServiceScope();
  const [chips, setChips] = useState<ReadonlySet<ListChip>>(new Set());
  const [query, setQuery] = useState("");
  // Page tops (Josh, 9 Nov 2026): Find anyone is a chip in the top; it opens the search under the tabs.
  const [findOpen, setFindOpen] = useState(false);
  const isPhone = useIsPhone();
  // B1 extended (Josh, 4 Nov 2026): narrow every list to any group (ward, tier, legal status, age).
  const [groups, setGroups] = useState<AgendaGroupFilter>({});
  const grouped = agendaGroupFilterActive(groups);
  // Run meeting (six features build, Josh 9 Nov 2026): step through the services, then a summary.
  const [run, setRun] = useMeetingRun();
  const running = run !== null && !run.finished;

  const scopedMovements = useMemo(
    () =>
      service === null ? movements : movements.filter((movement) => movementBelongsToService(movement, service, units)),
    [movements, service, units],
  );
  const scopedAdmissions = useMemo(() => {
    if (service === null) return admissions;
    const inService = new Set(units.filter((unit) => unitHealthService(unit) === service).map((unit) => unit.id));
    return admissions.filter((admission) => inService.has(admission.unitId));
  }, [admissions, service, units]);
  const serviceQueue = useMemo(
    () =>
      referralQueueOrder([...referrals]).filter(
        (referral) => service === null || siteByCode(referral.originSiteCode)?.service === service,
      ),
    [referrals, service],
  );
  // A referral has a tier but no ward, legal status or age group recorded yet, so only the tier
  // filter keeps it; any other group filter leaves the referral list out.
  const queue = grouped ? serviceQueue.filter((referral) => referralInAgendaGroups(referral, groups)) : serviceQueue;
  const referralsHidden = grouped && agendaGroupHidesReferrals(groups);

  // The same printed sheet Capacity opens, built only while it is open, for the chosen service.
  const buildSheet = () =>
    bedMeetingSheet({
      units,
      movements,
      bedReleases,
      admissions,
      leaveBeds,
      now,
      thresholds,
      service,
      // M103 (Josh, 10 Nov 2026): the printed sheet shows initials and UMRN only.
      nameOf: (movement) => sheetPatientLabel(patientOf(movement)),
      referrals,
      referralLimitMinutes: configuration.referralDecisionTargetMinutes,
      // WF-FIG-017: named holds from the whole lists, so a group filter never frees a held bed.
      namedHolds: [...movements, ...referrals],
      // B1 extended (Josh, 4 Nov 2026): the printout matches the room. Bed figures stay whole.
      ...(grouped
        ? {
            movements: movements.filter((movement) => movementInAgendaGroups(movement, groups, groupContext)),
            referrals: referrals.filter((referral) => referralInAgendaGroups(referral, groups)),
            peopleFilter: agendaGroupFilterWords(groups, units),
            // D-MCA (Josh, 14 Nov 2026), audit M15: "short" stays whole, like the bed figures.
            wholeLists: { movements, referrals },
          }
        : {}),
    });

  const allSections = bedMeetingAgenda(
    { movements: scopedMovements, admissions: scopedAdmissions, bedReleases, units },
    now,
    Number.POSITIVE_INFINITY,
  );
  const groupContext = { units, movements: scopedMovements };
  const inGroups = (item: AgendaItem) => inAgendaGroups(item, groups, groupContext);
  const sections = grouped
    ? allSections.map((section) => {
        const items = section.items.filter(inGroups);
        return { ...section, items, total: items.length };
      })
    : allSections;
  const fullSummary = meetingActionSummary(scopedMovements, scopedAdmissions, now);
  // Item 6 (10 Nov 2026): beds, not people, so only the unfiltered agenda lists them. Decision 46: a
  // site bed manager's agenda is its own site's, so another site's beds are left out; a listed ward the
  // desk still cannot open shows no Open ward link.
  const canOpenHref = useCanOpenHref();
  const deskInScope = useDeskInScope();
  const closedReview = closedBedsReviewSection(
    units.filter(
      (unit) => (service === null || unitHealthService(unit) === service) && (!deskInScope || deskInScope(unit.id)),
    ),
    now,
  );
  // Offer every group the control can filter: the agenda lists, the actions from earlier meetings
  // and the waiting referrals, each person counted once.
  const groupOptions = agendaGroupOptions(
    [
      ...allSections.flatMap((section) => section.items),
      ...[...fullSummary.overdue, ...fullSummary.open].map((row) => ({
        subject: row.subject,
        record: row.record,
        detail: "",
      })),
    ],
    groupContext,
    serviceQueue,
  );
  // While a meeting runs or shows its summary, "From earlier meetings" leaves out what it recorded.
  const earlier = (row: MeetingActionRow) => !run || row.action.recordedAt < run.startedAt;
  const actionInGroups = (row: MeetingActionRow) =>
    earlier(row) && inGroups({ subject: row.subject, record: row.record, detail: "" });
  const summary = {
    ...fullSummary,
    overdue: fullSummary.overdue.filter(actionInGroups),
    open: fullSummary.open.filter(actionInGroups),
  };
  const unitName = (unitId: string | undefined) => units.find((unit) => unit.id === unitId)?.name;
  // A double click must close one action only. The list shifts up as an action closes, so a second
  // click lands on the next row, often another person's (Audit 7 NB-02). One Done per short pause.
  const lastDoneAt = useRef(Number.NEGATIVE_INFINITY);
  const claimDone = useCallback(() => {
    const at = performance.now();
    if (at - lastDoneAt.current < DONE_PAUSE_MS) return false;
    lastDoneAt.current = at;
    return true;
  }, []);
  // H-0150: held here, not in the row, so the toast's Undo outlives the row it closes.
  const markActionDone = useBedMeetingDone("coordinator");
  // Chase Undo (Josh, 3 Nov 2026): held here too, as a recorded row can move to another list.
  const recordAction = useBedMeetingRecord("coordinator");
  // NB-02 / RB-N01: the closed action's row leaves with it; focus goes to the row now in its place.
  const actionList = useRef<HTMLUListElement>(null);
  const actionSummary = useRef<HTMLParagraphElement>(null);
  const actionRows = [...summary.overdue, ...summary.open];
  const markDone = useRefocusAfterRowLeaves({
    list: actionList,
    selector: '[data-testid="bed-meeting-action-done"]',
    rowsKey: actionRows.map((row) => `${row.subject.id}-${row.action.kind}`).join("|"),
    fallback: actionSummary,
  });
  const ownerText = (action: BedMeetingAction) =>
    action.owner === "ward"
      ? (unitName(action.ownerUnitId) ?? WARD_FLOW_ROLE_LABELS.ward)
      : WARD_FLOW_ROLE_LABELS[action.owner];

  const hasOpenAction = (item: AgendaItem) =>
    (item.record.meetingActions ?? []).some((action) => action.doneAt === undefined);
  // "With an action": people already carrying an open action from this or an earlier meeting.
  const actioned = sections
    .flatMap((section) => section.items)
    .filter(
      (item, index, all) =>
        hasOpenAction(item) && all.findIndex((other) => other.subject.id === item.subject.id) === index,
    );
  // "With an action" narrows the agenda lists to those people; the other chips pick which lists show.
  const actionedOnly = chips.has("actioned");
  const listChips: readonly ListChip[] = [...chips].filter((id) => id !== "actioned");
  const shows = (id: ListChip) =>
    listChips.length === 0 ? !(actionedOnly && id === "referrals") : listChips.includes(id);
  const shownSections = sections
    .map((section) => (actionedOnly ? { ...section, items: section.items.filter(hasOpenAction) } : section))
    .filter((section) => !actionedOnly || section.items.length > 0);
  const toggleChip = (id: ListChip) =>
    setChips((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // B1 "any patient": the chair can find anyone open on the board and record an action against them.
  // Every typed word, folded, in any order: "smith john", "Smith, John" and "obrien" all find the
  // person, as the header search does (search audit, 8 Nov 2026).
  const needle = query.trim();
  const found: AgendaItem[] =
    needle.length < SEARCH_MIN
      ? []
      : [
          ...scopedMovements
            .filter((movement) => !movement.closure && movement.stage !== "arrived")
            .map((movement) => ({
              subject: { kind: "movement" as const, id: movement.id },
              record: movement as Movement | Admission,
              ...(movement.acceptedUnitId !== undefined ? { unitId: movement.acceptedUnitId } : {}),
              detail: `Open movement · ${durMinutes(now - movement.openedAt)}`,
            })),
          ...scopedAdmissions
            .filter((admission) => admission.leftAt === null)
            .map((admission) => ({
              subject: { kind: "admission" as const, id: admission.id },
              record: admission as Movement | Admission,
              unitId: admission.unitId,
              detail: `${unitName(admission.unitId) ?? "Ward not recorded"} · in for ${admission.arrivedAt === null ? "not recorded" : durMinutes(now - admission.arrivedAt)}`,
            })),
        ]
          .filter((item) => {
            if (!inGroups(item)) return false;
            const who = patientOf(item.record);
            return fieldsMatchEveryWord(needle, [who.formalName, who.displayName, who.umrn]);
          })
          .slice(0, 8);

  const stepTo = (step: number) => {
    if (!run) return;
    setRun({ startedAt: run.startedAt, step, finished: false });
    setServiceScope(MEETING_STEPS[step] ?? null);
  };
  const startRun = () => {
    setRun({ startedAt: now, step: 0, finished: false });
    setServiceScope(MEETING_STEPS[0]);
  };
  const recordedThisMeeting = run
    ? actionsRecordedSince({
        startedAt: run.startedAt,
        until: run.finishedAt,
        now,
        movements,
        admissions,
        units,
        nameOf: (record) => patientOf(record).formalName,
        ownerText,
      })
    : [];
  const itemsForService = (candidate: HealthService) => {
    const inService = new Set(units.filter((unit) => unitHealthService(unit) === candidate).map((unit) => unit.id));
    return bedMeetingAgenda(
      {
        movements: movements.filter((movement) => movementBelongsToService(movement, candidate, units)),
        admissions: admissions.filter((admission) => inService.has(admission.unitId)),
        bedReleases,
        units,
      },
      now,
      Number.POSITIVE_INFINITY,
    ).reduce((total, section) => total + section.total, 0);
  };

  return (
    <main
      id="main-content"
      className={run?.finished ? `${styles.main} ${MEETING_SUMMARY_PAGE_CLASS}` : styles.main}
      data-testid="bed-meeting-agenda"
    >
      <Hero
        level={1}
        className={cx(pageTop.hero, folderTabClasses.hero)}
        title={
          running ? (
            <>
              <SrOnly>Bed meeting running: </SrOnly>
              Meeting{" "}
              <span className={pageTop.soft}>
                {service ? healthServiceAcronym(service) : "Statewide"} · {run.step + 1} of {MEETING_STEPS.length}
              </span>
            </>
          ) : (
            <>
              <SrOnly>Bed meeting agenda: </SrOnly>
              Lists <span className={pageTop.soft}>for the meeting</span>
            </>
          )
        }
        aside={
          running ? (
            // Run meeting (six features, Josh 9 Nov 2026): the step controls take the pill's place.
            <div className={styles.heroPillGroup}>
              <MeetingRunControls
                step={run.step}
                onStep={stepTo}
                onFinish={() => {
                  setRun({ ...run, finished: true, finishedAt: now });
                  setServiceScope(null);
                }}
                onStop={() => {
                  setRun(null);
                  setServiceScope(null);
                }}
              />
            </div>
          ) : (
            // `data-wf-live` places the plain pill where the hero puts its Live pill.
            <span className={pageTop.pill} data-wf-live="" data-testid="agenda-as-at">
              As at {formatInstantWithDay(now, now)}
            </span>
          )
        }
      >
        <HeroTop
          figures={
            <HeroFigures
              items={[
                ...sections.slice(0, 3).map((section) => {
                  const short = SHORT_TITLES[section.id] ?? section.title;
                  const id = section.id as ListChip;
                  return {
                    id: section.id,
                    value: section.total,
                    // Lower case like every page's figures; "ED" keeps its capitals.
                    label: short.startsWith("ED") ? short : short.toLowerCase(),
                    // Each figure shows just that list (tap again for every list), as the list chips did.
                    onClick: () => toggleChip(id),
                    testId: `agenda-figure-${section.id}`,
                  };
                }),
                ...(running
                  ? [
                      {
                        id: "recorded",
                        value: recordedThisMeeting.length,
                        label: "recorded this meeting",
                        testId: "agenda-figure-recorded",
                      },
                    ]
                  : []),
              ]}
            />
          }
          act={
            <HeroAct
              tone={actionRows.length === 0 ? "calm" : summary.overdue.length > 0 ? "warning" : "calm"}
              title={
                actionRows.length === 0
                  ? isPhone
                    ? "No earlier actions waiting"
                    : "No actions waiting from earlier meetings"
                  : `${actionRows.length} ${actionRows.length === 1 ? "action" : "actions"} from earlier meetings`
              }
              sub={
                actionRows.length === 0
                  ? undefined
                  : `${summary.overdue.length} overdue · ${summary.open.length} still open · ${summary.doneLastDay} done in the last day`
              }
              testId="agenda-act"
              action={
                // The meeting room screen, behind the `bed-meeting-tv` flag as on Capacity; hidden while
                // a meeting runs, so Stop and Next are the only meeting controls.
                bedMeetingTvOn && !running
                  ? {
                      // C08: it opens the TV view, so it says so; the guided meeting is Run meeting.
                      label: "Open on TV",
                      href: bedMeetingTvHref(),
                      testId: "agenda-start-meeting",
                    }
                  : undefined
              }
            />
          }
          chips={
            <div className={styles.heroChips}>
              <HeroQuickChips
                label="Agenda tools"
                items={[
                  {
                    id: "find",
                    label: "Find anyone",
                    icon: <Search strokeWidth={1.75} aria-hidden="true" />,
                    pressed: findOpen,
                    testId: "agenda-find-anyone",
                    onClick: () => {
                      setFindOpen((open) => !open);
                      // Opening it puts the cursor in the search, so a name can be typed at once.
                      requestAnimationFrame(() =>
                        document
                          .querySelector<HTMLInputElement>(
                            'input[data-testid="bed-meeting-agenda-search"], [data-testid="bed-meeting-agenda-search"] input',
                          )
                          ?.focus(),
                      );
                    },
                  },
                  {
                    id: "referrals",
                    label: "Referrals",
                    icon: <FileText strokeWidth={1.75} aria-hidden="true" />,
                    count: queue.length,
                    countTone: "quiet",
                    pressed: chips.has("referrals"),
                    testId: "agenda-referrals-chip",
                    onClick: () => toggleChip("referrals"),
                  },
                  // Run meeting (six features, Josh 9 Nov 2026): the chair steps through the services.
                  ...(chairs && !run
                    ? [
                        {
                          id: "run",
                          label: "Run meeting",
                          testId: "bed-meeting-run-start",
                          onClick: startRun,
                        },
                      ]
                    : []),
                  // Shown only while someone carries an open action, so the row stays short.
                  ...(actioned.length > 0
                    ? [
                        {
                          id: "actioned",
                          label: "With an action",
                          count: actioned.length,
                          countTone: "quiet" as const,
                          pressed: actionedOnly,
                          testId: "agenda-actioned-chip",
                          onClick: () => toggleChip("actioned"),
                        },
                      ]
                    : []),
                ]}
              />
              <AgendaGroupFilterControl options={groupOptions} value={groups} onChange={setGroups} onHero />
              {bedMeetingTvOn ? null : (
                <BedMeetingSheetLauncher
                  now={now}
                  buttonClassName={styles.heroChip}
                  buildSheet={buildSheet}
                  actions={actionRows.map((row) => ({
                    id: `${row.subject.id}-${row.action.kind}`,
                    name: sheetPatientLabel(patientOf(row.record)),
                    action: bedMeetingActionLabel(row.action.kind),
                    owner: ownerText(row.action),
                    due: `${row.action.dueAt < now ? "was due" : "due"} ${formatInstantWithDay(row.action.dueAt, now)}`,
                    overdue: row.action.dueAt < now,
                  }))}
                />
              )}
            </div>
          }
        />
      </Hero>
      {/* B1 (Josh, 3 Nov 2026): the agenda follows the header's service, and these tabs change it in one tap,
          so the meeting can go service by service. */}
      <FolderTabs
        label="Service"
        value={service ?? "statewide"}
        testId="bed-meeting-agenda-filters"
        className={styles.folder}
        more={
          isPhone ? (
            <Menu
              label="More services"
              align="end"
              items={HEALTH_SERVICES.slice(PHONE_SERVICE_TABS).map((candidate) => ({
                id: candidate,
                label: healthServiceAcronym(candidate),
                checked: service === candidate,
                checkable: "radio" as const,
                onSelect: () => setServiceScope(candidate),
              }))}
              trigger={(props) => (
                <Button
                  {...props}
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={Ellipsis}
                  className={folderTabClasses.more}
                  aria-label="More services"
                />
              )}
            />
          ) : undefined
        }
      >
        {running ? (
          // While a meeting runs, the service tabs are its steps, each with its agenda count.
          <Segmented
            label="Meeting step"
            className={folderTabClasses.switch}
            value={MEETING_STEPS[run.step] ?? MEETING_STEPS[0]}
            onChange={(next) => stepTo(MEETING_STEPS.indexOf(next as HealthService))}
            items={MEETING_STEPS.map((candidate) => ({
              id: candidate,
              label: `${healthServiceAcronym(candidate)} ${itemsForService(candidate)}`,
            }))}
          />
        ) : (
          <Segmented
            label="Service"
            className={folderTabClasses.switch}
            value={service ?? "statewide"}
            onChange={(next) => setServiceScope(next === "statewide" ? null : (next as HealthService))}
            items={[
              { id: "statewide", label: "Statewide" },
              // A phone shows three services and More, as Home; a service chosen from More joins the row.
              ...HEALTH_SERVICES.filter(
                (candidate, index) => !isPhone || index < PHONE_SERVICE_TABS || candidate === service,
              ).map((candidate) => ({ id: candidate, label: healthServiceAcronym(candidate) })),
            ]}
          />
        )}
      </FolderTabs>
      {/* D-91 (Josh, 31 Oct 2026): a printed agenda keeps a small synthetic-data mark, in the TV's words. */}
      <p className={styles.printMark} data-testid="agenda-print-mark">
        Synthetic prototype, not for clinical use
      </p>

      {run?.finished ? (
        <MeetingSummary
          run={run}
          now={now}
          rows={recordedThisMeeting}
          onBack={() => stepTo(run.step)}
          onClose={() => {
            setRun(null);
            setServiceScope(null);
          }}
        />
      ) : null}

      {findOpen || grouped || (referralsHidden && serviceQueue.length > 0) ? (
        <div className={styles.filters}>
          {findOpen ? (
            <SearchField
              className={styles.search}
              value={query}
              onValueChange={setQuery}
              label="Find anyone to discuss"
              placeholder="Find anyone by name or UMRN"
              data-testid="bed-meeting-agenda-search"
            />
          ) : null}
          {grouped ? (
            <div className={styles.appliedLine} data-testid="bed-meeting-agenda-groups-applied">
              <ChipGroup label="Showing only" className={styles.chipRow}>
                {AGENDA_GROUP_FACETS.flatMap((facet) =>
                  [...(groups[facet] ?? [])].map((value) => (
                    <AppliedFilter
                      key={`${facet}-${value}`}
                      onRemove={() => setGroups((current) => toggleGroup(current, facet, value))}
                    >
                      {agendaGroupValueLabel(facet, value, units)}
                    </AppliedFilter>
                  )),
                )}
              </ChipGroup>
              <Button size="sm" variant="ghost" className={styles.clearGroups} onClick={() => setGroups({})}>
                Clear
              </Button>
            </div>
          ) : null}
          {referralsHidden && serviceQueue.length > 0 ? (
            <p className={styles.note} data-testid="bed-meeting-agenda-referrals-hidden">
              {serviceQueue.length === 1 ? "1 referral is" : `${serviceQueue.length} referrals are`} left out. A
              referral has a tier, but no ward, legal status or age group yet.
            </p>
          ) : null}
        </div>
      ) : null}

      {needle.length >= SEARCH_MIN ? (
        <Card data-testid="bed-meeting-agenda-found">
          <CardHead title="Found" meta={`${found.length}`} level={2} />
          <CardBody>
            {found.length === 0 ? (
              <p className={styles.note}>Nobody open matches. Check the spelling or the service.</p>
            ) : (
              <ul className={styles.list}>
                {found.map((item) => (
                  <AgendaRow
                    key={`found-${item.subject.id}`}
                    sectionId="found"
                    item={item}
                    now={now}
                    name={patientOf(item.record).formalName}
                    wardName={unitName(item.unitId)}
                    chairs={chairs}
                    onRecord={recordAction}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}

      {/* With nothing waiting, the actions are one quiet line under the hero, not an
          empty card (no empty panels). The line stays where focus lands when the last one closes. */}
      {actionRows.length === 0 ? (
        <p
          className={cx(styles.noActions, "sr-only")}
          data-testid="bed-meeting-action-summary"
          tabIndex={-1}
          ref={actionSummary}
        >{`No actions waiting from earlier meetings${summary.doneLastDay > 0 ? ` · ${summary.doneLastDay} done in the last day` : ""}`}</p>
      ) : (
        <Card>
          <CardHead title="Actions" meta="From earlier meetings" level={2} />
          <CardBody>
            <p className={styles.summary} data-testid="bed-meeting-action-summary" ref={actionSummary}>
              {`${summary.doneLastDay} done in the last day · ${summary.overdue.length} overdue · ${summary.open.length} still open`}
            </p>
            {actionRows.length === 0 ? null : (
              <ul className={styles.list} data-testid="bed-meeting-action-list" ref={actionList}>
                {actionRows.map((row, index) => (
                  <ActionRow
                    key={`${row.subject.id}-${row.action.kind}`}
                    row={row}
                    now={now}
                    name={patientOf(row.record).formalName}
                    owner={ownerText(row.action)}
                    onMarkDone={chairs ? markActionDone : undefined}
                    claimDone={() => {
                      if (!claimDone()) return false;
                      markDone(index);
                      return true;
                    }}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      <div className={styles.sections}>
        {shownSections.map((section) =>
          shows(section.id as ListChip) ? (
            <AgendaList
              key={section.id}
              id={section.id}
              title={CARD_TITLES[section.id] ?? section.title}
              count={section.items.length}
              meta={urgentMeta(section.id, section.items, now)}
            >
              {(limit) =>
                section.items
                  .slice(0, limit)
                  .map((item) => (
                    <AgendaRow
                      key={`${section.id}-${item.subject.id}`}
                      sectionId={section.id}
                      item={item}
                      now={now}
                      name={patientOf(item.record).formalName}
                      wardName={unitName(item.unitId)}
                      chairs={chairs}
                      onRecord={recordAction}
                    />
                  ))
              }
            </AgendaList>
          ) : null,
        )}
        {closedReview.total > 0 && chips.size === 0 && !grouped ? (
          <AgendaList id={closedReview.id} title={closedReview.title} count={closedReview.total}>
            {(limit) =>
              closedReview.items.slice(0, limit).map((item) => (
                <li key={`${item.unitId}-${item.bedNumber}`} className={styles.agendaRow}>
                  <div className={styles.row}>
                    <div className={styles.rowText}>
                      <span className={styles.name}>
                        {item.wardName} · Bed {item.bedNumber}
                      </span>
                      <span className={styles.detail}>
                        Closed since {formatInstantWithDay(item.closedAt, now)} · review was{" "}
                        {formatInstantWithDay(item.reviewAt, now)}
                      </span>
                    </div>
                    {canOpenHref(unitHref(item.unitId)) ? (
                      <Link
                        href={unitHref(item.unitId)}
                        className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.addAction}`}
                        aria-label={`Open ward: ${item.wardName}, to review bed ${item.bedNumber}`}
                      >
                        Open ward
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))
            }
          </AgendaList>
        ) : null}
        {shows("referrals") ? (
          <AgendaList
            id="referrals"
            title="Referrals awaiting decision"
            count={queue.length}
            action={
              queue.length > 0 ? (
                <AgendaReferralsCopy
                  className={styles.copyList}
                  text={() =>
                    agendaReferralsText(
                      queue,
                      (referral) => patientOf(referral).formalName,
                      now,
                      `Referrals awaiting decision · ${service ?? "Statewide"} · as at ${formatInstantWithDay(now, now)}`,
                    )
                  }
                />
              ) : undefined
            }
          >
            {(limit) =>
              queue.slice(0, limit).map((referral) => {
                const { waited, due, overdue } = waitWords(referral, now);
                return (
                  <li key={`referral-${referral.id}`} className={styles.agendaRow}>
                    <div className={styles.row}>
                      <div className={styles.rowText}>
                        <span className={styles.name}>
                          <TierTile tier={referral.urgency} />
                          {overdue ? <StatusGlyph tone="danger" size={8} /> : null}
                          {patientOf(referral).formalName}
                          {overdue ? <span className={styles.urgency}>Overdue</span> : null}
                        </span>
                        <span className={styles.detail}>
                          {waited} · {due} · {referral.originSiteCode ?? ORIGIN_NOT_RECORDED} ·{" "}
                          {askingForShort(referral)}
                        </span>
                      </div>
                      <Link
                        href={referralBoardHref(referral.id)}
                        className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.addAction}`}
                        aria-label={`Decide the referral for ${patientOf(referral).formalName}`}
                      >
                        Decide
                      </Link>
                    </div>
                  </li>
                );
              })
            }
          </AgendaList>
        ) : null}
        {/* Batch 3 item 12: each ward's bed round answer, in the fixed ward order (D-126). */}
        {listChips.length === 0 && !actionedOnly ? <BedRoundAnswersCard service={service} /> : null}
      </div>
      {chairs ? null : <p className={styles.note}>Read only. The bed coordinator records and completes actions.</p>}
      <WardPrototypeFooter testId="ward-bed-meeting-agenda-governance" />
    </main>
  );
}

/** One agenda list: its card, the first five people, then the kit's Show more row. */
function AgendaList({
  id,
  title,
  count,
  meta,
  action,
  children,
}: {
  id: string;
  title: string;
  count: number;
  /** The card head's count line, when it says more than the count. */
  meta?: string;
  /** A control at the card head's end (Copy list on Referrals). */
  action?: ReactNode;
  children: (limit: number) => ReactNode;
}) {
  const [all, setAll] = useState(false);
  const listId = useId();
  const limit = all ? count : foldLimit(count, ROWS_SHOWN);
  return (
    // `agenda-<id>` is the list's address: the Referrals page links to #agenda-referrals.
    <Card data-testid={`bed-meeting-agenda-${id}`} id={`agenda-${id}`} className={styles.anchored}>
      <CardHead title={title} meta={meta ?? `${count}`} level={2} action={action} />
      <CardBody>
        {count === 0 ? (
          <p className={styles.note}>Nobody here right now.</p>
        ) : (
          <>
            <ul className={styles.list} id={listId}>
              {children(limit)}
            </ul>
            {limit < count || all ? (
              <ShowMoreRow onClick={() => setAll((value) => !value)} expanded={all} controls={listId}>
                {all ? "Show fewer" : `Show ${count - limit} more`}
              </ShowMoreRow>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function ActionRow({
  row,
  now,
  name,
  owner,
  claimDone,
  onMarkDone,
}: {
  row: MeetingActionRow;
  now: Instant;
  name: string;
  owner: string;
  claimDone: () => boolean;
  /** Absent for a desk that reads the agenda only. */
  onMarkDone?: MarkBedMeetingActionDone;
}) {
  const overdue = row.action.dueAt < now;
  return (
    <li className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.name}>
          {overdue ? <StatusGlyph tone="warning" size={8} /> : null}
          {bedMeetingActionLabel(row.action.kind)} · {name}
        </span>
        <span className={styles.detail}>
          {owner} · {overdue ? "was due" : "due"} {formatInstantWithDay(row.action.dueAt, now)}
        </span>
      </div>
      {onMarkDone ? (
        <Button
          size="sm"
          variant="sec"
          aria-label={`Done: ${bedMeetingActionLabel(row.action.kind)} for ${name}`}
          onClick={(event) => {
            // The second click of a double click is never a fresh Done.
            if (event.detail > 1 || !claimDone()) return;
            onMarkDone(row.subject, row.action.kind);
          }}
          data-testid="bed-meeting-action-done"
        >
          Done
        </Button>
      ) : null}
    </li>
  );
}

function AgendaRow({
  sectionId,
  item,
  now,
  name,
  wardName,
  chairs,
  onRecord,
}: {
  sectionId: string;
  item: AgendaItem;
  now: Instant;
  name: string;
  wardName: string | undefined;
  /** Whether this desk chairs the meeting and so may add an action. */
  chairs: boolean;
  onRecord: RecordBedMeetingAction;
}) {
  const [adding, setAdding] = useState(false);
  const formId = useId();
  const save = useWardFormSave(formId);
  const toggle = useRef<HTMLButtonElement>(null);
  const openActions = (item.record.meetingActions ?? []).filter((action) => action.doneAt === undefined);
  const urgent = urgencyOf(sectionId, item, now) !== null;
  // Polish (Josh, 3 Nov 2026): a pulled bed's line names the ward holding it.
  const detail = sectionId === "holds" && wardName ? wardName : item.detail;
  return (
    <li className={styles.agendaRow}>
      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.name}>{name}</span>
          <span className={styles.detail}>{detail}</span>
          {openActions.length > 0 ? (
            <span className={styles.agreed}>
              <Check size={12} strokeWidth={2.5} aria-hidden="true" />
              <SrOnly>Agreed: </SrOnly>
              <span>{openActions.map((action) => bedMeetingActionLabel(action.kind)).join(", ")}</span>
            </span>
          ) : null}
        </div>
        {/* Polish (Josh, 3 Nov 2026): the time is quiet inline text with its word beside it, red with
            a small dot when it is past the mark; the colour is never the only cue, the words say it too. */}
        {item.value ? (
          <span className={cx(styles.figure, urgent && styles.figureUrgent)}>
            {urgent ? <StatusGlyph tone="danger" size={6} /> : null}
            <span className={styles.figureValue}>{item.value}</span>
            {/* Page tops (9 Nov 2026): an ED wait shows just its time; "waiting" stays for screen readers. */}
            {sectionId === "ed-waits" ? (
              <SrOnly>
                {item.caption}
                {urgent ? `, ${LONG_WAIT_TEXT}` : null}
              </SrOnly>
            ) : (
              <span className={styles.figureCaption}>{item.caption}</span>
            )}
          </span>
        ) : null}
        {chairs ? (
          <Button
            size="sm"
            variant="ghost"
            ref={toggle}
            className={styles.addAction}
            aria-expanded={adding}
            aria-controls={formId}
            icon={Plus}
            aria-label={adding ? `Cancel the action for ${name}` : `Add an action for ${name}`}
            onClick={() => {
              save.forget();
              setAdding((value) => !value);
            }}
            data-testid="bed-meeting-add-action"
          >
            {adding ? "Close" : "Action"}
          </Button>
        ) : null}
      </div>
      {chairs && adding ? (
        <ActionForm
          id={formId}
          sectionId={sectionId}
          save={save}
          item={item}
          now={now}
          wardName={wardName}
          onRecord={onRecord}
          onDone={() => {
            // RB-N01: the form and its Record button close, so focus goes back to Add action.
            setAdding(false);
            toggle.current?.focus();
          }}
        />
      ) : null}
    </li>
  );
}

/** Polish (Josh, 3 Nov 2026): the urgent count is said once in the card head, not on every row. */
function urgentMeta(sectionId: string, items: readonly AgendaItem[], now: Instant): string | undefined {
  const urgent = items.filter((item) => urgencyOf(sectionId, item, now) !== null).length;
  if (urgent === 0) return undefined;
  // Page tops (9 Nov 2026): the hero figure carries the total, so the ED head names only the long waits.
  if (sectionId === "ed-waits") return `${urgent} ${LONG_WAIT_TEXT}`;
  if (sectionId === "holds") return `${items.length} · ${urgent} expired`;
  return undefined;
}

/**
 * The urgency the record itself carries: an ED wait past the long-wait mark, or a pulled bed whose
 * pull has run out. Nothing else is judged here. A run-out pull keeps its red mark but no tag: its
 * detail line already says "Pull expired 10m ago".
 */
function urgencyOf(sectionId: string, item: AgendaItem, now: Instant): { tag: string | null } | null {
  const record = item.record;
  if (!("stage" in record)) return null;
  if (sectionId === "holds" && isTimePassed(record.pullExpiresAt, now)) return { tag: null };
  if (sectionId === "ed-waits" && now - record.openedAt >= LONG_WAIT_MINUTES)
    return { tag: LONG_WAIT_TEXT.charAt(0).toUpperCase() + LONG_WAIT_TEXT.slice(1) };
  return null;
}

const SUGGESTED_KINDS: Readonly<Record<string, readonly BedMeetingActionKind[]>> = {
  "ed-waits": ["seek_bed_elsewhere", "chase_ward", "review_legal_form"],
  holds: ["chase_ward", "book_transport"],
  stranded: ["chase_ndis", "call_guardianship", "family_meeting", "review_step_down"],
  "out-of-area": ["seek_bed_elsewhere", "book_transport", "review_step_down"],
};

const WARD_OWNED_KINDS: ReadonlySet<BedMeetingActionKind> = new Set([
  "chase_ward",
  "chase_ndis",
  "call_guardianship",
  "family_meeting",
  "review_step_down",
]);

function ActionForm({
  id,
  sectionId,
  save,
  item,
  now,
  wardName,
  onRecord,
  onDone,
}: {
  id: string;
  sectionId: string;
  save: WardFormSave;
  item: AgendaItem;
  now: Instant;
  wardName: string | undefined;
  onRecord: RecordBedMeetingAction;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<BedMeetingActionKind | "">("");
  const [owner, setOwner] = useState<BedMeetingActionOwner>("coordinator");
  const [dueHours, setDueHours] = useState<string>(String(BED_MEETING_ACTION_DUE_HOURS[1]));
  const owners = BED_MEETING_ACTION_OWNERS.filter((candidate) => candidate !== "ward" || item.unitId !== undefined);
  // One open action per kind per person, as the reducer insists: offer only the kinds still free.
  // An answer escalation is recorded from the referral response timer, for the ward it names, so the
  // agenda never offers it as a free choice on a row that has no ward answer outstanding.
  const kinds = BED_MEETING_ACTION_KINDS.filter(
    (entry) => entry.id !== "escalate_ward_answer" && !openMeetingAction(item.record.meetingActions, entry.id),
  );
  // Polish (Josh, 3 Nov 2026): the asks this list usually needs come first, the rest after.
  const fits: readonly string[] = SUGGESTED_KINDS[sectionId] ?? [];
  const suggested = fits.flatMap((fit) => kinds.filter((entry) => entry.id === fit));
  const others = kinds.filter((entry) => !fits.includes(entry.id));
  const pick = (next: BedMeetingActionKind | "") => {
    setKind(next);
    // The owner follows the ask (a ward's answer is the ward's to give); the chair can still change it.
    if (next !== "") setOwner(item.unitId !== undefined && WARD_OWNED_KINDS.has(next) ? "ward" : "coordinator");
  };
  const chip = (entry: (typeof BED_MEETING_ACTION_KINDS)[number]) => (
    <FilterChip
      key={entry.id}
      pressed={kind === entry.id}
      unavailable={save.pending}
      onPressedChange={(on) => {
        if (!save.pending) pick(on ? entry.id : "");
      }}
    >
      {entry.label}
    </FilterChip>
  );
  const dueAt = now + Number(dueHours) * 60;
  return (
    <div id={id} className={styles.form} data-testid="bed-meeting-action-form">
      {/* B1 (Josh, 3 Nov 2026): choices as chips and segments, never the browser's drop-down (Q319). */}
      <div data-testid="bed-meeting-action-kind" className={styles.formKindGroups}>
        {suggested.length > 0 ? (
          <div className={styles.formKindGroup}>
            <span className={styles.formLabel} aria-hidden="true">
              Suggested
            </span>
            <ChipGroup label="Suggested for this list" className={styles.formKinds}>
              {suggested.map(chip)}
            </ChipGroup>
          </div>
        ) : null}
        {others.length > 0 ? (
          <div className={styles.formKindGroup}>
            {suggested.length > 0 ? (
              <span className={styles.formLabel} aria-hidden="true">
                More
              </span>
            ) : null}
            <ChipGroup label={suggested.length > 0 ? "More actions" : "Action"} className={styles.formKinds}>
              {others.map(chip)}
            </ChipGroup>
          </div>
        ) : null}
      </div>
      <div className={styles.formLine}>
        <span className={styles.formLabel} aria-hidden="true">
          Owner
        </span>
        {/* Stress test (3 Nov 2026): chips that wrap, as the asks above do, so a long ward name never
            clips the owners on phone. One is always chosen. */}
        <ChipGroup label="Owner" className={styles.formKinds}>
          {owners.map((candidate) => (
            <FilterChip
              key={candidate}
              pressed={owner === candidate}
              unavailable={save.pending}
              onPressedChange={() => {
                if (!save.pending) setOwner(candidate);
              }}
            >
              {candidate === "ward" ? (wardName ?? WARD_FLOW_ROLE_LABELS.ward) : WARD_FLOW_ROLE_LABELS[candidate]}
            </FilterChip>
          ))}
        </ChipGroup>
      </div>
      <div className={styles.formLine}>
        <span className={styles.formLabel} aria-hidden="true">
          Due in
        </span>
        <Segmented
          label="Due in"
          value={dueHours}
          unavailable={save.pending}
          onChange={(next) => {
            if (!save.pending) setDueHours(next);
          }}
          items={BED_MEETING_ACTION_DUE_HOURS.map((hours) => ({ id: String(hours), label: `${hours}h` }))}
        />
      </div>
      <Button
        size="sm"
        variant="pri"
        loading={save.pending}
        aria-disabled={kind === "" || save.pending ? "true" : undefined}
        aria-describedby={kind === "" ? `${id}-reason` : undefined}
        onClick={() => {
          if (kind === "" || save.pending) return;
          // The form stays open with its choices until this command is accepted; Undo follows on the toast.
          save.submit(
            () =>
              onRecord({
                subject: item.subject,
                action: kind,
                owner,
                ...(owner === "ward" && item.unitId !== undefined ? { unitId: item.unitId } : {}),
                dueAt,
              }),
            onDone,
          );
        }}
        data-testid="bed-meeting-action-record"
      >
        {kind === "" ? "Record action" : `Record · due ${formatInstantWithDay(dueAt, now)}`}
      </Button>
      {kind === "" ? <DisabledReason id={`${id}-reason`}>Choose an action first.</DisabledReason> : null}
      {save.error ? (
        <p className={styles.note} role="alert">
          {save.error}
        </p>
      ) : null}
    </div>
  );
}
