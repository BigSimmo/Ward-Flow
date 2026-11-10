"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCheck, ChevronDown, ChevronRight, ChevronUp, ListChecks } from "lucide-react";

import { Button, StatusGlyph, useIsPhone } from "@/components/wf";
import { ShowMoreRow } from "@/components/wf";
import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { dailyCheckId, dailyCheckRecord } from "@/components/ward-management/coordinator/daily-check";
import {
  MISSED_REQUEST_LABELS,
  missedRequestCheck,
} from "@/components/ward-management/coordinator/missed-requests-check";
import panel from "./daily-check-panel.module.css";
import phonePanel from "./daily-check-list.module.css";

import styles from "./waiting.module.css";
import polish from "./waiting-polish.module.css";

/**
 * THE DAILY "NOBODY MISSED" CHECK on Waiting, coordinator only (F-19 ruling: duplicate warnings
 * never appear on ward screens). Lists what `missedRequestCheck` finds across the whole network,
 * whatever service filter the page has, with each person named and their UMRN beside the name so
 * the coordinator confirms who it is before acting. It links to the records; it changes nothing.
 *
 * Once worked through, the coordinator taps "Mark all checked" (P027 wording), which records the
 * role and the time for today (`dailyCheckRecord`). The tap closes nothing and hides nothing.
 * The list is opened before it can be marked checked (UX audit, 21 Oct 2026): the button only
 * shows inside the opened list. Waiting redesign (Josh, 30 and 31 Oct 2026): on a phone the check
 * is one line; on a laptop it is a tile in the header strip whose list opens under the header.
 */

/** P027 (Josh, 27 Oct 2026, 10:32 PM): "Mark all {n} checked" from 2; "Mark all checked" for 0 or 1. */
export function markAllLabel(count: number): string {
  return count >= 2 ? `Mark all ${count} checked` : "Mark all checked";
}

const CHECK_LIMIT = 8;

/**
 * Diagnosed issues W4 (Josh, 3 Nov 2026): each rule says in one line what it found and what to do,
 * so the list explains itself. The links only open the records; nothing here changes them.
 */
const KIND_HELP: Record<keyof typeof MISSED_REQUEST_LABELS, string> = {
  no_ward_asked: "Bed requests still open with no ward asked. Open each one and ask a ward.",
  no_bed_request: "An ED accepted the referral for a bed, but no bed request was raised. Open it and raise one.",
  two_requests: "One recorded person has two open requests. Open both and keep the right one.",
  bed_held_twice: "One numbered bed is pulled for two people. Open both and release one.",
};
const KIND_ORDER = ["bed_held_twice", "two_requests", "no_bed_request", "no_ward_asked"] as const;
/** Round 8: the laptop grid shows three rows of three before Show more; W4: per reason. */
const GRID_LIMIT = 6;

/** The daily check's items and record, shared by the header tile and the list under it. */
function useDailyCheck() {
  const { movements, referrals, patients, inboxCompletions } = useWardFlowSelect(
    "movements",
    "referrals",
    "patients",
    "inboxCompletions",
  );
  const now = useWardFlowClock();
  const items = useMemo(
    () => missedRequestCheck({ movements, referrals, patients, now }),
    [movements, referrals, patients, now],
  );
  return { items, checked: dailyCheckRecord(inboxCompletions, now), now, referrals };
}

/**
 * Waiting redesign, round 4 (Josh, 31 Oct 2026): on a laptop the daily check moves into the dark
 * header as one tile with its own icon, so the page opens on the work instead of a notice strip.
 * The rule stays: the list is opened before it can be marked checked.
 */
export function DailyCheckHeroTile({
  open,
  onToggle,
  listId,
}: {
  open: boolean;
  onToggle: () => void;
  listId: string;
}) {
  const access = useEffectiveWardAccess();
  const { items, checked, now } = useDailyCheck();
  if (access.role !== "coordinator") return null;
  const state = items.length === 0 ? "clear" : checked ? "done" : "todo";
  return (
    <div className={polish.strip} data-testid="ward-missed-check">
      {state === "todo" ? (
        <ListChecks size={14} aria-hidden="true" className={polish.stripIcon} data-tone="warning" />
      ) : (
        <CheckCheck size={14} aria-hidden="true" className={polish.stripIcon} data-tone="success" />
      )}
      <span className={polish.stripLabel} title="Bed requests missed or sent twice">
        Daily check
      </span>
      <span className={polish.stripValue}>
        {state === "clear" ? (
          "nobody missed"
        ) : state === "done" ? (
          `all checked by ${checked?.by} at ${checked ? formatInstantWithDay(checked.at, now) : ""}`
        ) : (
          <>
            <b className={polish.heroNum}>{items.length}</b>
            {` to check`}
          </>
        )}
      </span>
      {items.length > 0 ? (
        <button
          type="button"
          className={polish.stripAct}
          aria-expanded={open}
          aria-controls={listId}
          onClick={onToggle}
        >
          {open ? "Hide list" : "Show list"}
          {open ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
        </button>
      ) : null}
    </div>
  );
}

/** Note 8, issue 4: the fix each reason asks for, as the row's button names it. */
const KIND_ACTION: Record<keyof typeof MISSED_REQUEST_LABELS, string> = {
  no_ward_asked: "Ask a ward",
  no_bed_request: "Raise request",
  two_requests: "Review both",
  bed_held_twice: "Release one",
};

/**
 * The daily check's opened list, under the header on a laptop (see `DailyCheckHeroTile`).
 * Note 8, issue 4 (Josh, 8 Nov 2026): one plain head (what it is, today's status, Hide); each reason
 * as a short section with what to do; each person as one row whose button names the fix and opens
 * them in this page's drawer when they are on the list (the Wards tab for "ask a ward"), else their
 * record; and a foot that says what "Mark all checked" records. Fixed rows drop off by themselves,
 * because the check recomputes from the records. The list is open before it can be marked checked.
 */
export function DailyCheckList({
  open,
  listId,
  onClose,
  onBoardIds,
  onOpenPerson,
}: {
  open: boolean;
  listId: string;
  onClose: () => void;
  /** Movements on this page's list, which open in its drawer instead of navigating away. */
  onBoardIds?: ReadonlySet<string>;
  onOpenPerson?: (movementId: string, tab: "summary" | "wards") => void;
}) {
  const access = useEffectiveWardAccess();
  const { items, checked, now, referrals } = useDailyCheck();
  const raise = useWardRaise("coordinator");
  const patientOf = usePatientOf();
  const [all, setAll] = useState(false);
  if (access.role !== "coordinator" || !open || items.length === 0) return null;
  const kinds = KIND_ORDER.filter((kind) => items.some((item) => item.kind === kind));
  const hidden = kinds.reduce(
    (sum, kind) => sum + Math.max(0, items.filter((item) => item.kind === kind).length - GRID_LIMIT),
    0,
  );
  return (
    <section className={panel.panel} aria-labelledby={`${listId}-title`}>
      <div className={panel.head}>
        <span className={panel.icon} aria-hidden="true">
          <ListChecks size={18} aria-hidden="true" />
        </span>
        <div className={panel.headText}>
          <h2 id={`${listId}-title`} className={panel.title}>
            Daily check
          </h2>
          <p className={panel.sub}>
            Bed requests across the network that may have been missed or sent twice. Coordinator only.
          </p>
        </div>
        {checked ? (
          <span className={panel.status} data-tone="success">
            <StatusGlyph tone="success" size={9} />
            {`Checked by ${checked.by} at ${formatInstantWithDay(checked.at, now)}`}
          </span>
        ) : (
          <span className={panel.status} data-tone="warning">
            <StatusGlyph tone="warning" size={9} />
            Not checked today
          </span>
        )}
        <Button variant="ghost" size="sm" iconEnd={ChevronUp} onClick={onClose}>
          Hide
        </Button>
      </div>
      <div id={listId} className={panel.groups}>
        {kinds.map((kind) => {
          const ofKind = items.filter((item) => item.kind === kind);
          const visible = all ? ofKind : ofKind.slice(0, GRID_LIMIT);
          return (
            <section key={kind} className={panel.group} aria-labelledby={`${listId}-${kind}`}>
              <div className={panel.groupHead}>
                <h3 id={`${listId}-${kind}`} className={panel.groupName}>
                  {MISSED_REQUEST_LABELS[kind]}
                  <b className={`${styles.num} ${panel.count}`}>{ofKind.length}</b>
                </h3>
                <p className={panel.help}>{KIND_HELP[kind]}</p>
              </div>
              <ul className={panel.rows}>
                {visible.map((item) => {
                  const referralId = item.referralIds[0];
                  const movementId = item.movementIds[0];
                  const referral = referralId ? referrals.find((candidate) => candidate.id === referralId) : undefined;
                  const person = movementId ? patientOf({ movementId }) : referral ? patientOf(referral) : undefined;
                  const href = movementId
                    ? movementHref(movementId)
                    : referralId
                      ? referralBoardHref(referralId)
                      : undefined;
                  const extra = item.referralIds.length + item.movementIds.length - 1;
                  const here = movementId !== undefined && onOpenPerson !== undefined && onBoardIds?.has(movementId);
                  const action = (
                    <>
                      {KIND_ACTION[kind]}
                      <ChevronRight size={14} aria-hidden="true" />
                    </>
                  );
                  return (
                    <li key={item.key} className={panel.row} data-kind={item.kind}>
                      <span className={panel.who}>
                        <b>{person?.formalName ?? "Referral"}</b>
                        <small className={styles.num}>{person?.umrn}</small>
                        {extra > 0 ? <small>{`+${extra} more record`}</small> : null}
                      </span>
                      <span className={`${styles.num} ${panel.for}`}>
                        {splitDuration(Math.max(0, now - item.since))}
                      </span>
                      {here ? (
                        <button
                          type="button"
                          className={panel.act}
                          aria-label={`${KIND_ACTION[kind]}: ${person?.formalName ?? "referral"}`}
                          onClick={() => onOpenPerson(movementId, kind === "no_ward_asked" ? "wards" : "summary")}
                        >
                          {action}
                        </button>
                      ) : href ? (
                        <Link
                          href={href}
                          className={panel.act}
                          aria-label={`${KIND_ACTION[kind]}: ${person?.formalName ?? "referral"}`}
                        >
                          {action}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      {hidden > 0 || all ? (
        <ShowMoreRow onClick={() => setAll((current) => !current)} expanded={all} controls={listId}>
          {all ? "Show fewer" : `Show ${hidden} more`}
        </ShowMoreRow>
      ) : null}
      {checked ? null : (
        <div className={panel.foot}>
          <span className={panel.footText}>
            <b>Worked through the list?</b>
            <small>Records your role and the time for today. It closes and hides nothing.</small>
          </span>
          <Button
            variant="pri"
            size="sm"
            icon={CheckCheck}
            onClick={() => raise("COMPLETE_INBOX_ITEM", { inboxItemId: dailyCheckId(now) })}
          >
            {markAllLabel(items.length)}
          </Button>
        </div>
      )}
    </section>
  );
}

/** `initiallyOpen`: the list starts open (Waiting's hero chip opens it, page tops 9 Nov 2026). */
export function DailyCheckLine({ initiallyOpen = false }: { initiallyOpen?: boolean } = {}) {
  const access = useEffectiveWardAccess();
  const { movements, referrals, patients, inboxCompletions } = useWardFlowSelect(
    "movements",
    "referrals",
    "patients",
    "inboxCompletions",
  );
  const raise = useWardRaise("coordinator");
  const now = useWardFlowClock();
  const patientOf = usePatientOf();
  const listId = useId();
  const [open, setOpen] = useState(initiallyOpen);
  // Josh, 30 Oct 2026: the opened list shows its first 8, then the shared Show more row.
  const [all, setAll] = useState(false);
  // Josh, 30 Oct 2026: on a phone the check is one line, "Daily check: 17 to check", with the full
  // sentence kept for a screen reader.
  const isPhone = useIsPhone();
  const items = useMemo(
    () => missedRequestCheck({ movements, referrals, patients, now }),
    [movements, referrals, patients, now],
  );
  if (access.role !== "coordinator") return null;
  const checked = dailyCheckRecord(inboxCompletions, now);
  const who = (subject: Parameters<typeof patientOf>[0]) => {
    const person = patientOf(subject);
    return `${person.formalName} · ${person.umrn}`;
  };
  const requests = `${items.length} ${items.length === 1 ? "bed request" : "bed requests"}`;
  const toCheck = `${requests} to check, missed or sent twice.`;
  const shownItems = all ? items : items.slice(0, CHECK_LIMIT);

  return (
    <section className={styles.checkLine} aria-labelledby="redesign-daily-check" data-testid="ward-missed-check">
      <div className={styles.checkRow} data-phone={isPhone || undefined}>
        <ListChecks size={16} aria-hidden="true" className={styles.checkIcon} />
        <p id="redesign-daily-check" className={styles.checkText}>
          <b>Daily check:</b>{" "}
          {items.length === 0 ? (
            "nobody missed or doubled."
          ) : checked ? (
            <>
              <StatusGlyph tone="success" size={9} /> all checked by {checked.by} at{" "}
              {formatInstantWithDay(checked.at, now)}.
            </>
          ) : isPhone ? (
            <>
              <span aria-hidden="true">{`${items.length} to check`}</span>
              <span className="sr-only">{toCheck}</span>
            </>
          ) : (
            toCheck
          )}
        </p>
        {items.length > 0 ? (
          <Button
            variant="sec"
            size="sm"
            aria-expanded={open}
            aria-controls={listId}
            iconEnd={open ? ChevronUp : ChevronDown}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Hide list" : "Show list"}
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className={styles.checkList}>
          {/* W4: the phone list says what it is before the people. */}
          <p className={polish.dcAbout}>
            Bed requests across the network that may have been missed or sent twice. Open each one, then mark the list
            checked.
          </p>
          <ul id={listId} className={phonePanel.list}>
            {shownItems.map((item) => (
              <li key={item.key} className={phonePanel.item} data-kind={item.kind}>
                <span className={phonePanel.kind}>
                  <StatusGlyph tone="warning" size={9} />
                  {MISSED_REQUEST_LABELS[item.kind]}
                  <span className={phonePanel.since}> · for {splitDuration(Math.max(0, now - item.since))}</span>
                </span>
                <span className={phonePanel.links}>
                  {item.referralIds.map((referralId) => {
                    const referral = referrals.find((candidate) => candidate.id === referralId);
                    return (
                      <Link key={referralId} href={referralBoardHref(referralId)}>
                        {referral ? who(referral) : "Referral"}
                      </Link>
                    );
                  })}
                  {item.movementIds.map((movementId) => (
                    <Link key={movementId} href={movementHref(movementId)}>
                      {who({ movementId })}
                    </Link>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          {items.length > CHECK_LIMIT ? (
            <ShowMoreRow onClick={() => setAll((current) => !current)} expanded={all} controls={listId}>
              {all ? "Show fewer" : `Show ${items.length - CHECK_LIMIT} more`}
            </ShowMoreRow>
          ) : null}
          {checked ? null : (
            <Button
              variant="sec"
              size="sm"
              onClick={() => raise("COMPLETE_INBOX_ITEM", { inboxItemId: dailyCheckId(now) })}
            >
              {markAllLabel(items.length)}
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
