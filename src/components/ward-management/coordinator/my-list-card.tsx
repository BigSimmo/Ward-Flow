"use client";

// Home's "My list" (approved Home mock-up v7, 22 Oct 2026): the Alerts queue rows and
// the referrals awaiting a decision, in one card, built from the real Alerts row components.

import { useState, type MouseEvent, type ReactNode } from "react";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";

import {
  GroupHead,
  ownerShort,
  type QueueEntry,
  type QueueHandlers,
} from "@/components/ward-management/alerts/alerts-queue";
import {
  extractOverdue,
  legalTypedEnd,
  minutesText,
  shownAgeFrom,
} from "@/components/ward-management/alerts/alerts-model";
import { typedTimeLine } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import alertStyles from "@/components/ward-management/alerts/alerts.module.css";
import { withSendingTeam } from "@/components/ward-management/referrals/referral-sending-team";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Referral, Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { isAwaitingAnswer } from "@/components/ward-management/ward-referrals";
import type { AcceptedAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { ACT_NOW_TARGET_ID } from "@/components/ward-management/shell/ward-skip-to-act-now";
import { Button, buttonClass, Card, Sheet, StatusGlyph } from "@/components/wf";
// Closing-the-loop package A (24 Oct 2026): chase count and overdue promise on a referral row, and
// the coordinated call sheet. The sheet's code loads only when it is opened.
import {
  chaseCountLabel,
  openCommitmentItems,
  promiseOverdue,
} from "@/components/ward-management/referrals/referral-commitments-model";

import { AcceptedPullRows, useAcceptedPull } from "./accepted-pull-rows";
import { HomeRow, PhoneRow } from "./home-rows";
import styles from "./home-list.module.css";
import { originPlace, shortPlace } from "@/components/ward-management/origin-place";

const CallSheet = dynamic(
  withLoadRetry(() => import("./call-sheet").then((m) => m.CallSheet)),
  { loading: () => null },
);

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

/**
 * The signed-in coordinator is the bed coordinator, so an item owned by the bed coordinator is theirs.
 * Display wording only; ownership itself is unchanged.
 */
function isYours(entry: QueueEntry): boolean {
  return entry.mine || entry.owner === "Bed coordinator";
}

/**
 * Empty state (pop-state-empty, approved by Josh 31 Oct 2026): an empty group is one calm line with
 * a green tick under its heading, not a blank box. The tick is decoration; the words carry it.
 */
function CalmEmpty({ children }: { children: ReactNode }) {
  return (
    <p className={`${alertStyles.groupEmpty} ${styles.calmEmpty}`}>
      <StatusGlyph tone="success" size={10} />
      <span>{children}</span>
    </p>
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

/**
 * Wave 4 (home mock-up): an alert row's place line, "Bentley Adult Secure · from St John of God
 * Midland ED", the same on the desk and the phone.
 */
function alertWhere({ subject }: QueueEntry): string {
  return subject.to ? `${subject.to} · from ${shortPlace(subject.from)}` : shortPlace(subject.from);
}

/**
 * The time beside an alert row: the age ("10m"), then only what the words add ("overdue", "since
 * 10:37", "Time not recorded"). A passed legal form shows its typed time, never an age since it.
 */
function alertAge(
  entry: QueueEntry,
  now: Instant,
  dayZero: Date | undefined,
): { age: string | undefined; ageNote: string } {
  const legalEnded = legalTypedEnd(entry.item);
  const ageFrom = shownAgeFrom(entry.item, entry.raised);
  const age = ageFrom === undefined ? undefined : minutesText(Math.max(0, now - ageFrom));
  // "10m" over "10m overdue" says the time twice; the second line keeps only what it adds.
  const overdue = entry.raised === undefined ? null : extractOverdue(entry.item.detail);
  const ageNote =
    legalEnded !== undefined
      ? typedTimeLine(legalEnded, now, dayZero)
      : entry.raised === undefined
        ? "Time not recorded"
        : overdue
          ? overdue.startsWith(`${age} `)
            ? overdue.slice(age!.length + 1)
            : overdue
          : `since ${formatInstantWithDay(entry.raised, now)}`;
  return { age, ageNote };
}

function DeskAlertRow({ entry, now, handlers }: { entry: QueueEntry; now: Instant; handlers: QueueHandlers }) {
  const dayZero = useOptionalWardFlowSelect("dayZero")?.dayZero;
  const { subject } = entry;
  const where = alertWhere(entry);
  const owner = isYours(entry) ? undefined : `With ${ownerShort(entry.owner)}`;
  const state = entry.seen ? `Acknowledged ${formatInstantWithDay(entry.seen.at, now)}` : undefined;
  const extra = [owner, state].filter(Boolean).join(" · ") || undefined;
  const { age, ageNote } = alertAge(entry, now, dayZero);
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

function PhoneAlertRow({ entry, now, handlers }: { entry: QueueEntry; now: Instant; handlers: QueueHandlers }) {
  const dayZero = useOptionalWardFlowSelect("dayZero")?.dayZero;
  const { subject } = entry;
  const legalEnded = legalTypedEnd(entry.item);
  // FS-8 (home-390 mock): the age keeps its words ("10m overdue", "5m since 10:37", "Time not
  // recorded"), as on the desk. A passed legal form's typed time still takes a line of its own.
  const { age, ageNote } = legalEnded === undefined ? alertAge(entry, now, dayZero) : { age: undefined, ageNote: "" };
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
      line={alertWhere(entry)}
      age={age}
      ageNote={ageNote || undefined}
      note={legalEnded !== undefined ? typedTimeLine(legalEnded, now, dayZero) : undefined}
      owner={isYours(entry) ? undefined : ownerShort(entry.owner)}
      // FS-8: the row's own step (Release pulled bed, Find a bed), the same as the desk row's.
      action={<AlertAction entry={entry} handlers={handlers} />}
    />
  );
}

export function MyListCard({
  act,
  toPull = [],
  since,
  referrals,
  units,
  now,
  phone,
  handlers,
  selectedReferralId,
  onSelectReferral,
  decideHref,
  focus = "all",
  onShowAll,
  referralCap,
}: {
  act: QueueEntry[];
  /** WS-02: referrals a ward has accepted with no bed pulled yet. They sit in Act now. */
  toPull?: readonly AcceptedAwaitingPull[];
  /**
   * Wave 4 (D-191, notes item 7): the "Since 07:00 · … Review" line, folded into the top of this
   * card so Needs you is one card, not two.
   */
  since?: ReactNode;
  referrals: Referral[];
  units: readonly Unit[];
  now: Instant;
  phone: boolean;
  handlers: QueueHandlers;
  selectedReferralId: string | undefined;
  /**
   * D-92 (Josh, 31 Oct 2026): a referral row opens that referral in the right-hand panel, as the
   * Waiting rows do. Only its Decide button goes to the Referrals board.
   */
  onSelectReferral: (referralId: string) => void;
  /**
   * WS-04 (workflow speed audit, 26 Oct 2026): where Decide goes, the referral on the Referrals
   * board with Accept and Decline in view. It used to open a read-only preview with neither.
   */
  decideHref: (referralId: string) => string;
  /** Hero counts narrow the list to one group; "all" shows every group. */
  focus?: "all" | "act" | "decide";
  onShowAll?: () => void;
  /** Home flow mock-up: show this many referral rows, then Show all (8 rows then Show more). */
  referralCap?: number;
}) {
  const [allReferrals, setAllReferrals] = useState(false);
  // Friction pass item 6a (Josh, 9 Nov 2026): the coordinator decides in Home's panel, so a plain
  // click on Decide opens the referral there. The href stays for a new tab or middle click, and
  // every other desk still goes to the Referrals board.
  const decidesHere = useRouteRole() === "coordinator";
  const decideHere = (referralId: string) =>
    decidesHere
      ? {
          "aria-haspopup": "dialog" as const,
          onClick: (event: MouseEvent<HTMLAnchorElement>) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onSelectReferral(referralId);
          },
        }
      : {};
  const shownReferrals = referralCap === undefined || allReferrals ? referrals : referrals.slice(0, referralCap);
  const [callSheetOpen, setCallSheetOpen] = useState(false);
  const pull = useAcceptedPull();
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  const actCount = act.length + toPull.length;
  // Ruling 2 (D-191): Needs you is Act now and Referrals to decide only. "Waiting on others" is gone:
  // a late planned arrival is in Later today's Past planned time, discharge notices stay in Alerts,
  // and a waiting alert on a person is a mark on their Flow row (Q340).
  const total = actCount + referrals.length;

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
      {shownReferrals.map((referral) => {
        const who = patientOf(referral);
        const name = nameFor(who.formalName, who.umrn);
        const title = `Tier ${referral.urgency} · ${referralTo(referral, units)}`;
        const from = withSendingTeam(`from ${originPlace(referral)}`, referral);
        const profile = referral.homeRegion ? `${referral.ageBand}, ${referral.homeRegion}` : referral.ageBand;
        const age = minutesText(Math.max(0, now - referral.raisedAt));
        const marker = followUpMarker(referral, now);
        const shared = {
          data: { "data-referral-id": referral.id },
          tone: "info" as const,
          act: false,
          selected: selectedReferralId === referral.id,
          title,
          openLabel: `Open referral for ${name}`,
          onOpen: () => onSelectReferral(referral.id),
          name,
          umrn: who.umrn,
        };
        return phone ? (
          <PhoneRow
            key={referral.id}
            {...shared}
            line={[from, profile, marker].filter(Boolean).join(" · ")}
            inlineTitle
            age={age}
            ageNote="waiting"
            owner={undefined}
            endAction
            action={
              // Wave 4 (notes item 5): on a phone Decide is a quiet end link with a 40 px cover, so the
              // row's text keeps the width.
              <Link
                href={decideHref(referral.id)}
                className={styles.decideQuiet}
                aria-label={`Decide referral for ${name}`}
                {...decideHere(referral.id)}
              >
                Decide
                <ChevronRight aria-hidden="true" size={14} />
              </Link>
            }
          />
        ) : (
          <HomeRow
            key={referral.id}
            {...shared}
            // Wave 4 (notes item 6, A16-23): one plain line, "Tier 3 · Any suitable ward · from Royal
            // Perth ED · Adult, Perth Metropolitan", in place of three stacked lines.
            inlineTitle
            where={[from, profile, marker].filter(Boolean).join(" · ")}
            age={age}
            ageNote="waiting"
            action={
              <Link
                href={decideHref(referral.id)}
                className={buttonClass({ size: "sm" })}
                aria-label={`Decide referral for ${name}`}
                {...decideHere(referral.id)}
              >
                Decide
              </Link>
            }
          />
        );
      })}
    </ul>
  );

  const actGroup = (
    // WS-18: the target of the shell's "Skip to Act now" link (shell/ward-skip-to-act-now.tsx).
    <section className={alertStyles.group} aria-label="Act now" id={ACT_NOW_TARGET_ID} tabIndex={-1}>
      {/* Home mock-up (390 to 1440): Act now has no right-hand note; the hero says "need a person now". */}
      <GroupHead tone="danger" label="Act now" count={actCount} />
      {/* Wave 4 H5 (ruling item 3): a bed just pulled keeps its row, with Undo, until its window ends. */}
      {toPull.length > 0 || pull.kept.length > 0 ? (
        <AcceptedPullRows
          toPull={toPull}
          now={now}
          phone={phone}
          testId="home-accepted-to-pull"
          pulling={pull.pulling}
          setPulling={pull.setPulling}
          kept={pull.kept}
          onUndo={pull.undo}
        />
      ) : null}
      {act.length > 0 ? (
        alertRows(act)
      ) : toPull.length > 0 || pull.kept.length > 0 ? null : (
        <CalmEmpty>None firing now. The checks run are named in the header.</CalmEmpty>
      )}
    </section>
  );
  const decideGroup = (
    <section className={alertStyles.group} aria-label="Referrals to decide">
      <GroupHead tone="info" label="Referrals to decide" count={referrals.length} aside="oldest first" />
      {referrals.length > 0 ? referralRows : <CalmEmpty>No referral is waiting on a decision.</CalmEmpty>}
      {referralCap !== undefined && referrals.length > referralCap ? (
        <button
          type="button"
          className={styles.showMore}
          aria-expanded={allReferrals}
          onClick={() => setAllReferrals((open) => !open)}
        >
          {allReferrals ? "Show fewer" : `Show ${referrals.length - referralCap} more`}
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
            {total - (focus === "act" ? actCount : referrals.length)} more in the list.
          </span>
          <button type="button" className={styles.focusClear} onClick={onShowAll} data-testid="home-list-show-all">
            Show all {total}
          </button>
        </p>
      )}
      {focus === "decide" ? null : actGroup}
      {focus === "act" ? null : decideGroup}
    </div>
  );

  return (
    <Card className={styles.needsCard} data-testid="home-my-list" aria-label={`Needs you, ${total} items`}>
      {since}
      {body}
      {pull.sheet}
      <div className={styles.needsFoot}>
        {/* Home mock-up: one quiet line; each group's head already says "oldest first". */}
        <span>Snoozed items come back by themselves.</span>
        {/* Design audit A26 (5 Nov 2026): the kit small button, so it keeps the 40px phone size. */}
        <Button
          variant="ghost"
          size="sm"
          className={styles.footAction}
          aria-haspopup="dialog"
          onClick={() => setCallSheetOpen(true)}
          data-testid="home-call-sheet-open"
        >
          Ward calls
        </Button>
      </div>
      {callSheetOpen ? (
        <Sheet
          open
          onClose={() => setCallSheetOpen(false)}
          title="Ward calls"
          description="Wards to ring about waiting referrals, in call order. Screen and print only."
          testId="home-call-sheet"
        >
          <CallSheet />
        </Sheet>
      ) : null}
    </Card>
  );
}
