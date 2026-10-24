"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState } from "react";

import { Button, Card, CardBody, CardHead, DisabledReason, Field, Select, StatusGlyph } from "@/components/wf";

import { useWardFeatureFlag, useWardFeatureFlags } from "../shell/ward-feature-flag-store";
import { WardPrototypeFooter } from "../shell/ward-prototype-footer";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import { useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import { WARD_FLOW_ROLE_LABELS } from "../ward-flow-roles";
import { WARD_CAPACITY_HREF } from "../ward-nav";
import { DONE_PAUSE_MS } from "../ward-operational-defaults";
import { usePatientOf } from "../ward-patient-name";
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

/**
 * Smart features idea 5 (19 Oct 2026): the bed meeting's agenda, built from fixed rules, and its
 * action log. The chair records an action from a pick-list against a person on the agenda, with an
 * owner and a due time; the next meeting opens with what was done and what is overdue. Behind the
 * `bed-meeting-actions` switch, and coordinator only (an address the access table does not list).
 */
export function BedMeetingAgendaScreen() {
  const enabled = useWardFeatureFlag("bed-meeting-actions");
  const deviceCanChange = useWardFeatureFlags()[0]?.deviceCanChange ?? false;
  if (!enabled) {
    return (
      <main id="main-content" className={styles.off} data-testid="bed-meeting-agenda-off">
        <h1 className={styles.title}>The bed meeting agenda is switched off</h1>
        <p>
          {deviceCanChange
            ? "Turn it on in Settings, under Data and about, Feature flags."
            : "It is switched off on this site."}
        </p>
        <Link href={WARD_CAPACITY_HREF}>Open Capacity</Link>
      </main>
    );
  }
  return <BedMeetingAgenda />;
}

function BedMeetingAgenda() {
  const { movements, admissions, bedReleases, units, now } = useWardFlowSelect(
    "movements",
    "admissions",
    "bedReleases",
    "units",
    "now",
  );
  const patientOf = usePatientOf();
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
  const ownerText = (action: BedMeetingAction) =>
    action.owner === "ward"
      ? (unitName(action.ownerUnitId) ?? WARD_FLOW_ROLE_LABELS.ward)
      : WARD_FLOW_ROLE_LABELS[action.owner];

  return (
    <main id="main-content" className={styles.main} data-testid="bed-meeting-agenda">
      <header className={styles.header}>
        <h1 className={styles.title}>Bed meeting agenda</h1>
        <span className={styles.meta}>as at {formatInstantWithDay(now, now)}</span>
      </header>

      <Card>
        <CardHead title="Actions" meta="From earlier meetings" level={2} />
        <CardBody>
          {/* One line when nothing is waiting, not a row of zeros and a sentence saying the same (UX audit, 21 Oct 2026). */}
          <p className={styles.summary} data-testid="bed-meeting-action-summary">
            {summary.overdue.length + summary.open.length === 0
              ? `No actions are waiting${summary.doneLastDay > 0 ? ` · ${summary.doneLastDay} done in the last day` : ""}.`
              : `${summary.doneLastDay} done in the last day · ${summary.overdue.length} overdue · ${summary.open.length} still open`}
          </p>
          {summary.overdue.length + summary.open.length === 0 ? null : (
            <ul className={styles.list} data-testid="bed-meeting-action-list">
              {[...summary.overdue, ...summary.open].map((row) => (
                <ActionRow
                  key={`${row.subject.id}-${row.action.kind}`}
                  row={row}
                  now={now}
                  name={patientOf(row.record).displayName}
                  owner={ownerText(row.action)}
                  claimDone={claimDone}
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {sections.map((section) => (
        <Card key={section.id} data-testid={`bed-meeting-agenda-${section.id}`}>
          <CardHead title={section.title} meta={`${section.items.length}`} level={2} />
          <CardBody>
            {section.items.length === 0 ? (
              <p className={styles.note}>Nobody here right now.</p>
            ) : (
              <ul className={styles.list}>
                {section.items.map((item) => (
                  <AgendaRow
                    key={`${section.id}-${item.subject.id}`}
                    item={item}
                    now={now}
                    name={patientOf(item.record).displayName}
                    wardName={unitName(item.unitId)}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ))}
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
}: {
  row: MeetingActionRow;
  now: Instant;
  name: string;
  owner: string;
  claimDone: () => boolean;
}) {
  const raise = useWardRaise("coordinator");
  const overdue = row.action.dueAt < now;
  return (
    <li className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.name}>
          <StatusGlyph tone={overdue ? "warning" : "info"} size={8} /> {bedMeetingActionLabel(row.action.kind)} · {name}
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
          raise("COMPLETE_BED_MEETING_ACTION", { subject: row.subject, action: row.action.kind });
        }}
        data-testid="bed-meeting-action-done"
      >
        Done
      </Button>
    </li>
  );
}

function AgendaRow({
  item,
  now,
  name,
  wardName,
}: {
  item: AgendaItem;
  now: Instant;
  name: string;
  wardName: string | undefined;
}) {
  const [adding, setAdding] = useState(false);
  const formId = useId();
  const openActions = (item.record.meetingActions ?? []).filter((action) => action.doneAt === undefined);
  return (
    <li className={styles.agendaRow}>
      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.name}>{name}</span>
          <span className={styles.detail}>{item.detail}</span>
          {openActions.length > 0 ? (
            <span className={styles.detail}>
              Agreed: {openActions.map((action) => bedMeetingActionLabel(action.kind)).join(", ")}
            </span>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="light"
          aria-expanded={adding}
          aria-controls={formId}
          onClick={() => setAdding((value) => !value)}
          data-testid="bed-meeting-add-action"
        >
          {adding ? "Cancel" : "Add action"}
        </Button>
      </div>
      {adding ? (
        <ActionForm id={formId} item={item} now={now} wardName={wardName} onDone={() => setAdding(false)} />
      ) : null}
    </li>
  );
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
