"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import {
  Button,
  Card,
  CardBody,
  CardHead,
  DisabledReason,
  Field,
  Hero,
  HeroStat,
  Select,
  StatusGlyph,
} from "@/components/wf";

import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { BedMeetingSheetDialog } from "@/components/ward-redesign/capacity/bed-meeting-sheet-dialog";

import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useDueSoonThresholds, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import {
  DONE_PAUSE_MS,
  LONG_WAIT_MINUTES,
  LONG_WAIT_TEXT,
} from "@/components/ward-management/ward-operational-defaults";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { useRefocusAfterRowLeaves } from "@/components/ward-management/use-refocus-after-row-leaves";
import {
  BED_MEETING_ACTION_DUE_HOURS,
  BED_MEETING_ACTION_KINDS,
  BED_MEETING_ACTION_OWNERS,
  bedMeetingActionLabel,
  openMeetingAction,
  type BedMeetingAction,
  type BedMeetingActionKind,
  type BedMeetingActionOwner,
} from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import {
  bedMeetingAgenda,
  meetingActionSummary,
  type AgendaItem,
  type MeetingActionRow,
} from "@/components/ward-management/bed-meeting/bed-meeting-agenda";
import styles from "./agenda-redesign.module.css";
import {
  useBedMeetingDone,
  type MarkBedMeetingActionDone,
} from "@/components/ward-management/bed-meeting/use-bed-meeting-done";

/**
 * Smart features idea 5 (19 Oct 2026): the bed meeting's agenda, built from fixed rules, and its
 * action log. The chair records an action from a pick-list against a person on the agenda, with an
 * owner and a due time; the next meeting opens with what was done and what is overdue. Coordinator
 * only (an address the access table does not list). Its feature switch was removed on 24 Oct 2026.
 */
export function AgendaRedesign() {
  return <BedMeetingAgenda />;
}

/**
 * Redesign (review notes, Meeting agenda): a hero counting each list with Bed meeting sheet and Start
 * meeting, the four lists two by two so the agenda fits one screen, people surname first (D-83), and
 * a small "+ Action" on each row with the urgency the record carries beside it.
 */
/**
 * Redesign: the pulled-beds card says its order without "expire", the app's word for legal expiry
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
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  // The same printed sheet Capacity opens, built only while it is open.
  const sheet = useMemo(
    () =>
      sheetOpen
        ? bedMeetingSheet({
            units,
            movements,
            bedReleases,
            admissions,
            leaveBeds,
            now,
            thresholds,
            service: null,
            nameOf: (movement) => patientOf(movement).formalName,
            referrals,
            referralLimitMinutes: configuration.referralDecisionTargetMinutes,
          })
        : null,
    [
      sheetOpen,
      units,
      movements,
      bedReleases,
      admissions,
      leaveBeds,
      now,
      thresholds,
      patientOf,
      referrals,
      configuration,
    ],
  );
  const sections = bedMeetingAgenda({ movements, admissions, bedReleases, units }, now);
  const summary = meetingActionSummary(movements, admissions, now);
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

  return (
    <main id="main-content" className={styles.main} data-testid="bed-meeting-agenda">
      <Hero
        level={1}
        eyebrow="Bed meeting"
        title="Agenda"
        titleMeta={`as at ${formatInstantWithDay(now, now)}`}
        stats={
          <>
            {sections.map((section) => (
              <HeroStat
                key={section.id}
                value={section.items.length}
                label={SHORT_TITLES[section.id] ?? section.title}
              />
            ))}
            <HeroStat
              value={summary.overdue.length + summary.open.length}
              label={summary.overdue.length > 0 ? `Actions, ${summary.overdue.length} overdue` : "Actions"}
              tone={summary.overdue.length > 0 ? "warning" : undefined}
            />
          </>
        }
        aside={
          <>
            <Button variant="onHero" size="sm" onClick={() => setSheetOpen(true)} data-testid="agenda-open-sheet">
              Bed meeting sheet
            </Button>
            <Button
              variant="light"
              size="sm"
              onClick={() => router.push("/ward-flow/bed-meeting")}
              data-testid="agenda-start-meeting"
            >
              Start meeting
            </Button>
          </>
        }
      />
      {sheet ? <BedMeetingSheetDialog open onClose={() => setSheetOpen(false)} sheet={sheet} now={now} /> : null}

      {/* Redesign: with nothing waiting, the actions are one quiet line under the hero, not an
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
                    onMarkDone={markActionDone}
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
        {sections.map((section) => (
          <Card key={section.id} data-testid={`bed-meeting-agenda-${section.id}`}>
            <CardHead title={CARD_TITLES[section.id] ?? section.title} meta={`${section.items.length}`} level={2} />
            <CardBody>
              {section.items.length === 0 ? (
                <p className={styles.note}>Nobody here right now.</p>
              ) : (
                <ul className={styles.list}>
                  {section.items.map((item) => (
                    <AgendaRow
                      key={`${section.id}-${item.subject.id}`}
                      sectionId={section.id}
                      item={item}
                      now={now}
                      name={patientOf(item.record).formalName}
                      wardName={unitName(item.unitId)}
                    />
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
      <p className={styles.note}>
        Actions are tasks for people. Recording or completing one changes nothing else, and an overdue action is shown
        here, never escalated.
      </p>
      <WardPrototypeFooter testId="ward-bed-meeting-agenda-governance" />
    </main>
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
  onMarkDone: MarkBedMeetingActionDone;
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
    </li>
  );
}

function AgendaRow({
  sectionId,
  item,
  now,
  name,
  wardName,
}: {
  sectionId: string;
  item: AgendaItem;
  now: Instant;
  name: string;
  wardName: string | undefined;
}) {
  const [adding, setAdding] = useState(false);
  const formId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const openActions = (item.record.meetingActions ?? []).filter((action) => action.doneAt === undefined);
  const urgency = urgencyOf(sectionId, item, now);
  return (
    <li className={styles.agendaRow}>
      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.name}>
            {urgency ? <StatusGlyph tone="danger" size={8} /> : null}
            {name}
            {urgency?.tag ? <span className={styles.urgency}>{urgency.tag}</span> : null}
          </span>
          <span className={styles.detail}>{item.detail}</span>
          {openActions.length > 0 ? (
            <span className={styles.detail}>
              Agreed: {openActions.map((action) => bedMeetingActionLabel(action.kind)).join(", ")}
            </span>
          ) : null}
        </div>
        {/* Redesign: a small link-weight control on every row, rather than about 20 equal buttons. */}
        <Button
          size="sm"
          variant="ghost"
          ref={toggle}
          className={styles.addAction}
          aria-expanded={adding}
          aria-controls={formId}
          icon={adding ? undefined : Plus}
          aria-label={adding ? `Cancel the action for ${name}` : `Add an action for ${name}`}
          onClick={() => setAdding((value) => !value)}
          data-testid="bed-meeting-add-action"
        >
          {adding ? "Cancel" : "Action"}
        </Button>
      </div>
      {adding ? (
        <ActionForm
          id={formId}
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

function ActionForm({
  id,
  item,
  now,
  wardName,
  onDone,
}: {
  id: string;
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
  return (
    <div id={id} className={styles.form} data-testid="bed-meeting-action-form">
      <Field label="Action">
        <Select
          value={kind}
          onChange={(event) => setKind(event.target.value as BedMeetingActionKind | "")}
          data-testid="bed-meeting-action-kind"
        >
          <option value="">Choose an action</option>
          {kinds.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Owner">
        <Select
          value={owner}
          onChange={(event) => setOwner(event.target.value as BedMeetingActionOwner)}
          data-testid="bed-meeting-action-owner"
        >
          {owners.map((candidate) => (
            <option key={candidate} value={candidate}>
              {candidate === "ward" ? (wardName ?? WARD_FLOW_ROLE_LABELS.ward) : WARD_FLOW_ROLE_LABELS[candidate]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Due">
        <Select
          value={dueHours}
          onChange={(event) => setDueHours(event.target.value)}
          data-testid="bed-meeting-action-due"
        >
          {BED_MEETING_ACTION_DUE_HOURS.map((hours) => (
            <option key={hours} value={String(hours)}>
              In {hours} hours
            </option>
          ))}
        </Select>
      </Field>
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
            dueAt: now + Number(dueHours) * 60,
          });
          onDone();
        }}
        data-testid="bed-meeting-action-record"
      >
        Record action
      </Button>
      {kind === "" ? <DisabledReason id={`${id}-reason`}>Choose an action first.</DisabledReason> : null}
    </div>
  );
}
