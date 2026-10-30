"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ListChecks } from "lucide-react";

import { Button, StatusGlyph } from "@/components/wf";
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

  return (
    <section className={styles.checkLine} aria-labelledby="redesign-daily-check" data-testid="ward-missed-check">
      <div className={styles.checkRow}>
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
          ) : (
            `${requests} to check, missed or sent twice. Open the list to confirm them.`
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
            {items.map((item) => (
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
