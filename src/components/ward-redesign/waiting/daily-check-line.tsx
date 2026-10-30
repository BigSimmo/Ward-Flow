"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ListChecks } from "lucide-react";

import { Button, StatusGlyph, useIsPhone } from "@/components/wf";
import { ShowMoreRow } from "@/components/ward-redesign/parts/show-more-row";
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
import { markAllLabel } from "@/components/ward-management/coordinator/missed-requests-panel";
import panel from "@/components/ward-management/coordinator/missed-requests-panel.module.css";

import styles from "./waiting-redesign.module.css";

/**
 * The daily check, redesigned as one notice line (October 2026 design review). The same check as
 * `coordinator/missed-requests-panel.tsx`, with the same rule that the list is opened before it can
 * be marked checked (UX audit, 21 Oct 2026); while folded, the line itself says so, so the reason
 * stays written down (design review, 22 Oct 2026) without a card and a disabled button.
 */
const CHECK_LIMIT = 8;

export function DailyCheckLine() {
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
  const [open, setOpen] = useState(false);
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
  const toCheck = `${requests} to check, missed or sent twice. Open the list to confirm them.`;
  const shownItems = all ? items : items.slice(0, CHECK_LIMIT);

  return (
    <section className={styles.checkLine} aria-labelledby="redesign-daily-check" data-testid="ward-missed-check">
      <div className={styles.checkRow} data-phone={isPhone || undefined}>
        <ListChecks size={16} aria-hidden="true" className={styles.checkIcon} />
        <p id="redesign-daily-check" className={styles.checkText}>
          <b>Daily check:</b>{" "}
          {items.length === 0 ? (
            "nobody missed. Every open bed request has a ward asked, and none is doubled."
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
          <ul id={listId} className={panel.list}>
            {shownItems.map((item) => (
              <li key={item.key} className={panel.item} data-kind={item.kind}>
                <span className={panel.kind}>
                  <StatusGlyph tone="warning" size={9} />
                  {MISSED_REQUEST_LABELS[item.kind]}
                  <span className={panel.since}> · for {splitDuration(Math.max(0, now - item.since))}</span>
                </span>
                <span className={panel.links}>
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
