"use client";

import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";

import {
  Button,
  buttonClass,
  Card,
  CardBody,
  CardHead,
  ChipGroup,
  DisabledReason,
  FilterChip,
  Hero,
  HeroStat,
  SearchField,
  Segmented,
  ShowMoreRow,
  StatusGlyph,
  TierTile,
  durMinutes,
  foldLimit,
  phoneRows,
  cx,
  Avatar,
  SrOnly,
} from "@/components/wf";

import { bedMeetingSheet } from "../capacity/bed-meeting-derivations";
import { BedMeetingSheetLauncher } from "../capacity/bed-meeting-sheet";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { useWardFeatureFlag } from "../shell/ward-feature-flag-store";
import { setServiceScope, useServiceScope } from "../shell/ward-service-store";
import type { Admission } from "../ward-admissions";
import type { Movement } from "../ward-model";
import { HEALTH_SERVICES, type HealthService } from "../ward-model-vocabulary";
import { referralQueueOrder } from "../ward-referrals";
import { healthServiceAcronym, movementBelongsToService, unitHealthService } from "../ward-service-scope";
import { siteByCode } from "../ward-sites";
import { referralBoardHref } from "../ed/ed-bed-search-step";
import { askingForShort, waitWords } from "../referrals/referral-board-parts";
import { WardPrototypeFooter } from "../shell/ward-prototype-footer";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import { useDueSoonThresholds, useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import { WARD_FLOW_ROLE_LABELS } from "../ward-flow-roles";
import { bedMeetingTvHref } from "../ward-nav";
import { DONE_PAUSE_MS, LONG_WAIT_MINUTES, LONG_WAIT_TEXT } from "../ward-operational-defaults";
import { usePatientOf } from "../ward-patient-name";
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
import { bedMeetingAgenda, meetingActionSummary, type AgendaItem, type MeetingActionRow } from "./bed-meeting-agenda";
import styles from "./bed-meeting-agenda.module.css";
import { useBedMeetingDone, type MarkBedMeetingActionDone } from "./use-bed-meeting-done";

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
  const queue = useMemo(
    () =>
      referralQueueOrder([...referrals]).filter(
        (referral) => service === null || siteByCode(referral.originSiteCode)?.service === service,
      ),
    [referrals, service],
  );

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
      nameOf: (movement) => patientOf(movement).formalName,
      referrals,
      referralLimitMinutes: configuration.referralDecisionTargetMinutes,
    });

  const sections = bedMeetingAgenda(
    { movements: scopedMovements, admissions: scopedAdmissions, bedReleases, units },
    now,
    Number.POSITIVE_INFINITY,
  );
  const summary = meetingActionSummary(scopedMovements, scopedAdmissions, now);
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
  const listCount = (id: ListChip) =>
    id === "referrals"
      ? queue.length
      : id === "actioned"
        ? actioned.length
        : (sections.find((section) => section.id === id)?.items.length ?? 0);
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
  const needle = query.trim().toLowerCase();
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
            const who = patientOf(item.record);
            return who.formalName.toLowerCase().includes(needle) || who.umrn.toLowerCase().includes(needle);
          })
          .slice(0, 8);

  return (
    <main id="main-content" className={styles.main} data-testid="bed-meeting-agenda">
      <Hero
        level={1}
        eyebrow="Bed meeting"
        title="Agenda"
        titleMeta={`${service ?? "Statewide"} · as at ${formatInstantWithDay(now, now)}`}
        stats={
          <>
            {sections.map((section) => (
              <HeroStat
                key={section.id}
                value={section.items.length}
                label={SHORT_TITLES[section.id] ?? section.title}
              />
            ))}
            <HeroStat value={queue.length} label="Referrals" />
            <HeroStat
              value={summary.overdue.length + summary.open.length}
              label={summary.overdue.length > 0 ? `Actions, ${summary.overdue.length} overdue` : "Actions"}
              tone={summary.overdue.length > 0 ? "warning" : undefined}
            />
          </>
        }
        aside={
          // Phone (Josh, 31 Oct 2026): Home's hero pills, side by side.
          <div className={`${styles.heroPillGroup} ${phoneRows.heroPills}`}>
            <BedMeetingSheetLauncher
              now={now}
              buttonClassName={`${buttonClass({ variant: "onHero", size: "sm" })} ${phoneRows.heroPill}`}
              buildSheet={buildSheet}
              actions={actionRows.map((row) => ({
                id: `${row.subject.id}-${row.action.kind}`,
                name: patientOf(row.record).formalName,
                action: bedMeetingActionLabel(row.action.kind),
                owner: ownerText(row.action),
                due: `${row.action.dueAt < now ? "was due" : "due"} ${formatInstantWithDay(row.action.dueAt, now)}`,
                overdue: row.action.dueAt < now,
              }))}
            />
            {/* The meeting room screen, behind the `bed-meeting-tv` flag as on Capacity. */}
            {bedMeetingTvOn ? (
              <Link
                href={bedMeetingTvHref()}
                className={`${buttonClass({ variant: "light", size: "sm" })} ${phoneRows.heroPill}`}
                data-testid="agenda-start-meeting"
              >
                Start meeting
              </Link>
            ) : null}
          </div>
        }
      />
      {/* D-91 (Josh, 31 Oct 2026): a printed agenda keeps a small synthetic-data mark, in the TV's words. */}
      <p className={styles.printMark} data-testid="agenda-print-mark">
        Synthetic prototype, not for clinical use
      </p>

      {/* B1 (Josh, 3 Nov 2026): one filter bar. Service first, then the lists, then find anyone. */}
      <div className={styles.filters} data-testid="bed-meeting-agenda-filters">
        <div className={styles.filterLine}>
          <Segmented
            label="Service"
            className={styles.serviceTrack}
            value={service ?? "statewide"}
            onChange={(next) => setServiceScope(next === "statewide" ? null : (next as HealthService))}
            items={[
              { id: "statewide", label: "Statewide" },
              ...HEALTH_SERVICES.map((candidate) => ({ id: candidate, label: healthServiceAcronym(candidate) })),
            ]}
          />
          <SearchField
            className={styles.search}
            value={query}
            onValueChange={setQuery}
            label="Find anyone to discuss"
            placeholder="Find anyone by name or UMRN"
            data-testid="bed-meeting-agenda-search"
          />
        </div>
        <ChipGroup label="Lists" className={styles.chipRow}>
          {LIST_CHIPS.map(([id, label]) =>
            listCount(id) === 0 && !chips.has(id) ? null : (
              <FilterChip key={id} pressed={chips.has(id)} count={listCount(id)} onPressedChange={() => toggleChip(id)}>
                {label}
              </FilterChip>
            ),
          )}
        </ChipGroup>
      </div>

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
          className={styles.noActions}
          data-testid="bed-meeting-action-summary"
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
                    />
                  ))
              }
            </AgendaList>
          ) : null,
        )}
        {shows("referrals") ? (
          <AgendaList id="referrals" title="Referrals awaiting decision" count={queue.length}>
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
                          {waited} · {due} · {referral.originSiteCode} · {askingForShort(referral)}
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
      </div>
      {chairs ? null : <p className={styles.note}>Read only. The bed coordinator records and completes actions.</p>}
      <WardPrototypeFooter testId="ward-bed-meeting-agenda-governance" />
    </main>
  );
}

const LIST_CHIPS: readonly (readonly [ListChip, string])[] = [
  ["ed-waits", "ED waits"],
  ["holds", "Pulled beds"],
  ["stranded", "Stranded"],
  ["out-of-area", "Out of area"],
  ["referrals", "Referrals"],
  ["actioned", "With an action"],
];

/** One agenda list: its card, the first five people, then the kit's Show more row. */
function AgendaList({
  id,
  title,
  count,
  meta,
  children,
}: {
  id: string;
  title: string;
  count: number;
  /** The card head's count line, when it says more than the count. */
  meta?: string;
  children: (limit: number) => ReactNode;
}) {
  const [all, setAll] = useState(false);
  const listId = useId();
  const limit = all ? count : foldLimit(count, ROWS_SHOWN);
  return (
    <Card data-testid={`bed-meeting-agenda-${id}`}>
      <CardHead title={title} meta={meta ?? `${count}`} level={2} />
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
}: {
  sectionId: string;
  item: AgendaItem;
  now: Instant;
  name: string;
  wardName: string | undefined;
  /** Whether this desk chairs the meeting and so may add an action. */
  chairs: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const formId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const openActions = (item.record.meetingActions ?? []).filter((action) => action.doneAt === undefined);
  const urgent = urgencyOf(sectionId, item, now) !== null;
  // Polish (Josh, 3 Nov 2026): a pulled bed's line names the ward holding it.
  const detail = sectionId === "holds" && wardName ? wardName : item.detail;
  return (
    <li className={styles.agendaRow}>
      <div className={styles.row}>
        <Avatar name={name} decorative className={styles.rowAvatar} />
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
            <span className={styles.figureCaption}>
              {item.caption}
              {urgent && sectionId === "ed-waits" ? <SrOnly>, {LONG_WAIT_TEXT}</SrOnly> : null}
            </span>
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
            onClick={() => setAdding((value) => !value)}
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
          item={item}
          now={now}
          wardName={wardName}
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
  if (sectionId === "ed-waits") return `${items.length} · ${urgent} ${LONG_WAIT_TEXT}`;
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
  if (sectionId === "holds" && record.pullExpiresAt !== undefined && record.pullExpiresAt <= now) return { tag: null };
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
  item,
  now,
  wardName,
  onDone,
}: {
  id: string;
  sectionId: string;
  item: AgendaItem;
  now: Instant;
  wardName: string | undefined;
  onDone: () => void;
}) {
  const raise = useWardRaise("coordinator");
  const [kind, setKind] = useState<BedMeetingActionKind | "">("");
  const [owner, setOwner] = useState<BedMeetingActionOwner>("coordinator");
  const [dueHours, setDueHours] = useState<string>(String(BED_MEETING_ACTION_DUE_HOURS[1]));
  const owners = BED_MEETING_ACTION_OWNERS.filter((candidate) => candidate !== "ward" || item.unitId !== undefined);
  // One open action per kind per person, as the reducer insists: offer only the kinds still free.
  const kinds = BED_MEETING_ACTION_KINDS.filter((entry) => !openMeetingAction(item.record.meetingActions, entry.id));
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
    <FilterChip key={entry.id} pressed={kind === entry.id} onPressedChange={(on) => pick(on ? entry.id : "")}>
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
        <Segmented
          label="Owner"
          value={owner}
          onChange={(next) => setOwner(next as BedMeetingActionOwner)}
          items={owners.map((candidate) => ({
            id: candidate,
            label: candidate === "ward" ? (wardName ?? WARD_FLOW_ROLE_LABELS.ward) : WARD_FLOW_ROLE_LABELS[candidate],
          }))}
        />
      </div>
      <div className={styles.formLine}>
        <span className={styles.formLabel} aria-hidden="true">
          Due in
        </span>
        <Segmented
          label="Due in"
          value={dueHours}
          onChange={(next) => setDueHours(next)}
          items={BED_MEETING_ACTION_DUE_HOURS.map((hours) => ({ id: String(hours), label: `${hours}h` }))}
        />
      </div>
      <Button
        size="sm"
        variant="pri"
        aria-disabled={kind === "" ? "true" : undefined}
        aria-describedby={kind === "" ? `${id}-reason` : undefined}
        onClick={() => {
          if (kind === "") return;
          raise("RECORD_BED_MEETING_ACTION", {
            subject: item.subject,
            action: kind,
            owner,
            ...(owner === "ward" && item.unitId !== undefined ? { unitId: item.unitId } : {}),
            dueAt,
          });
          onDone();
        }}
        data-testid="bed-meeting-action-record"
      >
        {kind === "" ? "Record action" : `Record · due ${formatInstantWithDay(dueAt, now)}`}
      </Button>
      {kind === "" ? <DisabledReason id={`${id}-reason`}>Choose an action first.</DisabledReason> : null}
    </div>
  );
}
