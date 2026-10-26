"use client";

// Home's "My list" (approved Home mock-up v7, 22 Oct 2026): the Alerts queue rows and
// the referrals awaiting a decision, in one card, built from the real Alerts row components.

import { useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

import {
  GroupHead,
  ownerShort,
  type QueueEntry,
  type QueueHandlers,
} from "@/components/ward-management/alerts/alerts-queue";
import { extractOverdue, minutesText } from "@/components/ward-management/alerts/alerts-model";
import alertStyles from "@/components/ward-management/alerts/alerts.module.css";
import { withSendingTeam } from "@/components/ward-management/referrals/referral-sending-team";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Referral, Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { isAwaitingAnswer } from "@/components/ward-management/ward-referrals";
import { Button, buttonClass, Card, Sheet, StatusGlyph } from "@/components/wf";
// Closing-the-loop package A (24 Oct 2026): chase count and overdue promise on a referral row, and
// the coordinated call sheet. The sheet's code loads only when it is opened.
import {
  chaseCountLabel,
  openCommitmentItems,
  promiseOverdue,
} from "@/components/ward-management/referrals/referral-commitments-model";

import styles from "./home-list.module.css";

const WAIT_ROWS_SHOWN = 3;

const CallSheet = dynamic(() => import("./call-sheet").then((m) => m.CallSheet), { loading: () => null });

/** "Asked 3 times · Promise overdue", from the records alone, or undefined when nothing is recorded. */
function followUpMarker(referral: Referral, now: Instant): string | undefined {
  const items = openCommitmentItems([referral]);
  const asked = items.reduce((total, item) => total + item.chases, 0);
  const parts = [
    asked > 0 ? chaseCountLabel(asked) : undefined,
    items.some((item) => promiseOverdue(item.status, now)) ? "Promise overdue" : undefined,
  ].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** Row text only: "Emergency Department" reads as "ED", as Placement's own header already does. */
function shortPlace(place: string): string {
  return place.replace(/\bEmergency Department\b/g, "ED");
}

/**
 * The signed-in coordinator is the bed coordinator, so an item owned by the bed coordinator is theirs.
 * Display wording only; ownership itself is unchanged.
 */
function isYours(entry: QueueEntry): boolean {
  return entry.mine || entry.owner === "Bed coordinator";
}

/** Clicking a row anywhere that is not itself a control opens it; the row's buttons are the keyboard route. */
function onRowClick(open: () => void) {
  return (event: MouseEvent<HTMLLIElement>) => {
    if ((event.target as HTMLElement).closest("a, button")) return;
    open();
  };
}

/**
 * Home's desktop row: glyph, a two-line body (what, then who and where), how long, one action. Text
 * wraps instead of being cut, and the owner shows only when it is someone other than you.
 */
function HomeRow({
  data,
  tone,
  act,
  selected,
  title,
  openLabel,
  onOpen,
  name,
  umrn,
  where,
  extra,
  age,
  ageNote,
  action,
}: {
  data: Record<string, string | undefined>;
  tone: "danger" | "warning" | "info" | "neutral";
  act: boolean;
  selected: boolean;
  title: string;
  openLabel: string;
  onOpen: () => void;
  name: string;
  umrn: string;
  where: string;
  extra?: string;
  age: string | undefined;
  ageNote: string;
  action: ReactNode;
}) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the row click is a pointer shortcut, and its own button is the keyboard route
    <li
      className={styles.hrow}
      data-act={act ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      onClick={onRowClick(onOpen)}
      {...data}
    >
      <span className={styles.hrowGlyph}>
        <StatusGlyph tone={tone} />
      </span>
      <span className={styles.hrowMain}>
        <button
          type="button"
          className={styles.hrowTitle}
          aria-current={selected ? "true" : undefined}
          aria-label={openLabel}
          onClick={onOpen}
        >
          {title}
        </button>
        <span className={styles.hrowLine}>
          <strong className={styles.hrowName}>{name}</strong> <span className={styles.mono}>{umrn}</span>
          <span className={styles.hrowWhere}>{` · ${where}`}</span>
        </span>
        {extra ? <span className={styles.hrowExtra}>{extra}</span> : null}
      </span>
      <span className={styles.hrowAge}>
        {age === undefined ? null : <span className={styles.mono}>{age}</span>}
        <span>{ageNote}</span>
      </span>
      <span className={styles.hrowAction}>{action}</span>
    </li>
  );
}

function AlertAction({ entry, handlers }: { entry: QueueEntry; handlers: QueueHandlers }) {
  const label = `${entry.snooze ? "Return now" : entry.action.label} for ${entry.subject.displayName}`;
  if (entry.snooze)
    return (
      <Button size="sm" variant="ghost" aria-label={label} onClick={() => handlers.onReturn(entry)}>
        Return now
      </Button>
    );
  if (entry.action.kind === "release")
    return (
      <Button size="sm" aria-label={label} onClick={() => handlers.onRelease(entry)}>
        {entry.action.label}
      </Button>
    );
  return (
    <Link className={buttonClass({ size: "sm" })} href={entry.action.href} aria-label={label}>
      {entry.action.label}
    </Link>
  );
}

function DeskAlertRow({ entry, now, handlers }: { entry: QueueEntry; now: Instant; handlers: QueueHandlers }) {
  const { subject } = entry;
  const where = subject.to ? `${subject.to}, from ${shortPlace(subject.from)}` : shortPlace(subject.from);
  const owner = isYours(entry) ? undefined : `With ${ownerShort(entry.owner)}`;
  const state = entry.seen ? `Acknowledged ${formatInstantWithDay(entry.seen.at, now)}` : undefined;
  const extra = [owner, state].filter(Boolean).join(" · ") || undefined;
  const age = entry.raised === undefined ? undefined : minutesText(Math.max(0, now - entry.raised));
  // "10m" over "10m overdue" says the time twice; the second line keeps only what it adds.
  const overdue = entry.raised === undefined ? null : extractOverdue(entry.item.detail);
  const ageNote =
    entry.raised === undefined
      ? "Time not recorded"
      : overdue
        ? overdue.startsWith(`${age} `)
          ? overdue.slice(age!.length + 1)
          : overdue
        : `since ${formatInstantWithDay(entry.raised, now)}`;
  return (
    <HomeRow
      data={{ "data-alert-id": entry.item.id, "data-movement-id": entry.item.movementId || undefined }}
      tone={entry.item.tone === "danger" || entry.group === "act" ? "danger" : "warning"}
      act={entry.group === "act" && !entry.snooze}
      selected={handlers.selectedId === entry.item.id}
      title={entry.item.title}
      openLabel={`Open ${entry.item.title} for ${subject.displayName}`}
      onOpen={() => handlers.onSelect(entry)}
      name={subject.displayName}
      umrn={subject.umrn}
      where={where}
      extra={extra}
      age={age}
      ageNote={ageNote}
      action={<AlertAction entry={entry} handlers={handlers} />}
    />
  );
}

function referralTo(referral: Referral, units: readonly Unit[]): string {
  const names = referral.destinations.filter(isAwaitingAnswer).map((arm) => {
    const destination = arm.destination;
    if (destination.kind !== "psychiatric_ward" || !destination.unitId) return "Any suitable ward";
    const unitId = destination.unitId;
    return units.find((unit) => unit.id === unitId)?.name ?? "Ward not recorded";
  });
  if (names.length === 0) return "No ward asked";
  return names.length === 1 ? names[0]! : `${names[0]} and ${names.length - 1} more`;
}

/** Home's phone row: the Alerts phone row layout, with the owner named only when it is not you. */
function PhoneRow({
  data,
  tone,
  act,
  selected,
  title,
  openLabel,
  onOpen,
  name,
  umrn,
  line,
  age,
  owner,
}: {
  data: Record<string, string | undefined>;
  tone: "danger" | "warning" | "info" | "neutral";
  act: boolean;
  selected: boolean;
  title: string;
  openLabel: string;
  onOpen: () => void;
  name: string;
  umrn: string;
  line: string;
  age: string | undefined;
  owner: string | undefined;
}) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the row click is a pointer shortcut, and its own button is the keyboard route
    <li
      className={alertStyles.phoneRow}
      data-act={act ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      onClick={onRowClick(onOpen)}
      {...data}
    >
      <span className={alertStyles.phoneRowGlyph}>
        <StatusGlyph tone={tone} />
      </span>
      <span className={alertStyles.phoneRowText}>
        <button
          type="button"
          className={alertStyles.rowOpen}
          aria-current={selected ? "true" : undefined}
          aria-label={openLabel}
          onClick={onOpen}
        >
          <span className={alertStyles.rowOpenText}>{title}</span>
        </button>
        <span className={alertStyles.phoneRowLine}>
          <span className={alertStyles.who}>
            <strong className={alertStyles.name}>{name}</strong> <strong className={alertStyles.umrn}>{umrn}</strong>
          </span>
        </span>
        <span className={alertStyles.phoneRowLine}>{line}</span>
        {/* The owner sits in the text, not the end column, so a long team name never squeezes the title. */}
        {owner ? <span className={alertStyles.phoneRowLine}>{`With ${owner}`}</span> : null}
      </span>
      <span className={alertStyles.phoneRowEnd}>
        <span className={alertStyles.phoneRowAge}>{age ?? ""}</span>
      </span>
    </li>
  );
}

function PhoneAlertRow({ entry, now, handlers }: { entry: QueueEntry; now: Instant; handlers: QueueHandlers }) {
  const { subject } = entry;
  return (
    <PhoneRow
      data={{ "data-alert-id": entry.item.id, "data-movement-id": entry.item.movementId || undefined }}
      tone={entry.item.tone === "danger" || entry.group === "act" ? "danger" : "warning"}
      act={entry.group === "act" && !entry.snooze}
      selected={handlers.selectedId === entry.item.id}
      title={entry.item.title}
      openLabel={`Open ${entry.item.title} for ${subject.displayName}`}
      onOpen={() => handlers.onSelect(entry)}
      name={subject.displayName}
      umrn={subject.umrn}
      line={subject.to ? `${shortPlace(subject.from)} to ${subject.to}` : shortPlace(subject.from)}
      age={entry.raised === undefined ? undefined : minutesText(Math.max(0, now - entry.raised))}
      owner={isYours(entry) ? undefined : ownerShort(entry.owner)}
    />
  );
}

export function MyListCard({
  act,
  wait,
  referrals,
  units,
  now,
  phone,
  handlers,
  selectedReferralId,
  onDecide,
  focus = "all",
  onShowAll,
}: {
  act: QueueEntry[];
  wait: QueueEntry[];
  referrals: Referral[];
  units: readonly Unit[];
  now: Instant;
  phone: boolean;
  handlers: QueueHandlers;
  selectedReferralId: string | undefined;
  onDecide: (referralId: string) => void;
  /** Hero counts narrow the list to one group; "all" shows every group. */
  focus?: "all" | "act" | "decide";
  onShowAll?: () => void;
}) {
  const [allWaiting, setAllWaiting] = useState(false);
  const [callSheetOpen, setCallSheetOpen] = useState(false);
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  const shownWait = allWaiting ? wait : wait.slice(0, WAIT_ROWS_SHOWN);
  const total = act.length + referrals.length + wait.length;

  const alertRows = (list: QueueEntry[]) =>
    phone ? (
      <ul className={alertStyles.phoneRows}>
        {list.map((entry) => (
          <PhoneAlertRow key={entry.item.id} entry={entry} now={now} handlers={handlers} />
        ))}
      </ul>
    ) : (
      <ul className={styles.hrows}>
        {list.map((entry) => (
          <DeskAlertRow key={entry.item.id} entry={entry} now={now} handlers={handlers} />
        ))}
      </ul>
    );

  // A referral row leads with what is being decided (tier and ward asked), not a repeated label.
  const referralRows = (
    <ul className={phone ? alertStyles.phoneRows : styles.hrows}>
      {referrals.map((referral) => {
        const who = patientOf(referral);
        const name = nameFor(who.formalName, who.umrn);
        const title = `Tier ${referral.urgency} · ${referralTo(referral, units)}`;
        const from = withSendingTeam(`from ${referral.originSiteCode}`, referral);
        const profile = referral.homeRegion ? `${referral.ageBand}, ${referral.homeRegion}` : referral.ageBand;
        const age = minutesText(Math.max(0, now - referral.raisedAt));
        const marker = followUpMarker(referral, now);
        const shared = {
          data: { "data-referral-id": referral.id },
          tone: "info" as const,
          act: false,
          selected: selectedReferralId === referral.id,
          title,
          openLabel: `Decide referral for ${name}`,
          onOpen: () => onDecide(referral.id),
          name,
          umrn: who.umrn,
        };
        return phone ? (
          <PhoneRow
            key={referral.id}
            {...shared}
            line={[from, profile, marker].filter(Boolean).join(" · ")}
            age={age}
            owner={undefined}
          />
        ) : (
          <HomeRow
            key={referral.id}
            {...shared}
            where={from}
            extra={marker ? `${profile} · ${marker}` : profile}
            age={age}
            ageNote="waiting"
            action={
              <Button size="sm" aria-label={`Decide referral for ${name}`} onClick={() => onDecide(referral.id)}>
                Decide
              </Button>
            }
          />
        );
      })}
    </ul>
  );

  const actGroup = (
    <section className={alertStyles.group} aria-label="Act now">
      <GroupHead tone="danger" label="Act now" count={act.length} aside="needs a person now" />
      {act.length > 0 ? (
        alertRows(act)
      ) : (
        <p className={alertStyles.groupEmpty}>None firing now. The checks run are named in the header.</p>
      )}
    </section>
  );
  const decideGroup = (
    <section className={alertStyles.group} aria-label="Referrals to decide">
      <GroupHead tone="info" label="Referrals to decide" count={referrals.length} aside="oldest first" />
      {referrals.length > 0 ? (
        referralRows
      ) : (
        <p className={alertStyles.groupEmpty}>No referral is waiting on a decision.</p>
      )}
    </section>
  );
  const waitGroup = (
    <section className={alertStyles.group} aria-label="Waiting on others">
      <GroupHead tone="warning" label="Waiting on others" count={wait.length} aside="you may need to chase" />
      {wait.length > 0 ? (
        alertRows(shownWait)
      ) : (
        <p className={alertStyles.groupEmpty}>Nothing is waiting on a transport leg or an arrival.</p>
      )}
      {wait.length > WAIT_ROWS_SHOWN ? (
        <button
          type="button"
          className={styles.showMore}
          aria-expanded={allWaiting}
          data-testid="home-list-show-more"
          onClick={() => setAllWaiting((open) => !open)}
        >
          {allWaiting ? "Show fewer" : `Show ${wait.length - WAIT_ROWS_SHOWN} more`}
        </button>
      ) : null}
    </section>
  );

  const body = (
    <div className={styles.needsBody}>
      {focus === "all" ? null : (
        <p className={styles.focusLine} data-testid="home-list-focus-line">
          <span>
            Showing {focus === "act" ? "Act now" : "Referrals to decide"} only.{" "}
            {total - (focus === "act" ? act.length : referrals.length)} more in the list.
          </span>
          <button type="button" className={styles.focusClear} onClick={onShowAll} data-testid="home-list-show-all">
            Show all {total}
          </button>
        </p>
      )}
      {focus === "decide" ? null : actGroup}
      {focus === "act" ? null : decideGroup}
      {focus === "all" ? waitGroup : null}
    </div>
  );

  return (
    <Card className={styles.needsCard} data-testid="home-my-list" aria-label={`My list, ${total} items`}>
      {body}
      <div className={styles.needsFoot}>
        <StatusGlyph tone="neutral" size={9} />
        <span>Oldest first within each group. Snoozed items return by themselves.</span>
        <button
          type="button"
          className={styles.footLink}
          aria-haspopup="dialog"
          onClick={() => setCallSheetOpen(true)}
          data-testid="home-call-sheet-open"
        >
          Call sheet
        </button>
      </div>
      {callSheetOpen ? (
        <Sheet
          open
          onClose={() => setCallSheetOpen(false)}
          title="Call sheet"
          description="Referrals waiting on each ward. Screen and print only."
          testId="home-call-sheet"
        >
          <CallSheet />
        </Sheet>
      ) : null}
    </Card>
  );
}
