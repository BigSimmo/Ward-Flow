"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ListChecks } from "lucide-react";

import { Button, Card, CardBody, CardHead, StatusGlyph } from "@/components/wf";
import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";

import { dailyCheckId, dailyCheckRecord } from "./daily-check";
import { MISSED_REQUEST_LABELS, missedRequestCheck } from "./missed-requests-check";
import styles from "./missed-requests-panel.module.css";

/**
 * THE DAILY "NOBODY MISSED" CHECK on Delays — coordinator only (F-19 ruling: duplicate warnings
 * never appear on ward screens). Lists what `missedRequestCheck` finds across the whole network,
 * whatever service filter the page has, with each person named and their UMRN beside the name so
 * the coordinator confirms who it is before acting. It links to the records; it changes nothing.
 *
 * Overall review (20 Oct 2026): once worked through, the coordinator taps "Checked, all accounted
 * for", which records the role and the time for today (`dailyCheckRecord`). The tap closes nothing
 * and hides nothing: the list keeps showing whatever the rules still find.
 */
export function MissedRequestsPanel() {
  const access = useEffectiveWardAccess();
  const enabled = useWardFeatureFlag("missed-requests-check");
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
  // Folded by default, so the check is one line above the board until the coordinator opens it.
  const [open, setOpen] = useState(false);
  // UX audit (21 Oct 2026): "Checked, all accounted for" waits until the list has been opened once,
  // so nobody confirms a list they have not looked at. It is kept per day, so a screen left open
  // past midnight asks again for the new day's list.
  const [seenDay, setSeenDay] = useState<string | undefined>(undefined);
  const today = dailyCheckId(now);
  const seen = seenDay === today;
  const items = useMemo(
    () => missedRequestCheck({ movements, referrals, patients, now }),
    [movements, referrals, patients, now],
  );

  if (!enabled || access.role !== "coordinator") return null;

  const checked = dailyCheckRecord(inboxCompletions, now);

  const who = (subject: Parameters<typeof patientOf>[0]) => {
    const person = patientOf(subject);
    return `${person.displayName} · ${person.umrn}`;
  };
  const referralWho = (referralId: string) => {
    const referral = referrals.find((candidate) => candidate.id === referralId);
    return referral ? who(referral) : "Referral";
  };

  return (
    <Card aria-labelledby="ward-missed-check-title" data-testid="ward-missed-check">
      <CardHead
        id="ward-missed-check-title"
        className={styles.head}
        icon={ListChecks}
        title="Daily check"
        meta={
          items.length === 0
            ? "Nobody missed: every open bed request has a ward asked, and none is doubled"
            : `${items.length} to confirm: missed or doubled bed requests`
        }
        action={
          items.length > 0 ? (
            // Overall review (20 Oct 2026): the card's own secondary button. "light" is for the dark
            // hero band, and on a dark-mode card it glared white.
            <Button
              variant="sec"
              size="sm"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => {
                setOpen((current) => !current);
                setSeenDay(today);
              }}
              data-testid="ward-missed-check-toggle"
            >
              {open ? "Hide" : "Show"}
            </Button>
          ) : undefined
        }
      />
      <CardBody>
        {items.length > 0 && open ? (
          <ul id={listId} className={styles.list} data-testid="ward-missed-check-list">
            {items.map((item) => (
              <li key={item.key} className={styles.item} data-kind={item.kind}>
                <span className={styles.kind}>
                  <StatusGlyph tone="warning" size={9} />
                  {MISSED_REQUEST_LABELS[item.kind]}
                  <span className={styles.since}> · for {splitDuration(Math.max(0, now - item.since))}</span>
                </span>
                <span className={styles.links}>
                  {item.referralIds.map((referralId) => (
                    <Link key={referralId} href={referralBoardHref(referralId)}>
                      {referralWho(referralId)}
                    </Link>
                  ))}
                  {item.movementIds.map((movementId) => (
                    <Link key={movementId} href={movementHref(movementId)}>
                      {who({ movementId })}
                    </Link>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className={styles.check} data-testid="ward-missed-check-confirmation">
          {checked ? (
            <>
              <StatusGlyph tone="success" size={9} />
              {`Checked, all accounted for · ${checked.by} at ${formatInstantWithDay(checked.at, now)}`}
            </>
          ) : (
            <Button
              variant="sec"
              size="sm"
              disabledReason={items.length > 0 && !seen ? "Show the list first" : undefined}
              reasonDisplay="tooltip"
              onClick={() => {
                raise("COMPLETE_INBOX_ITEM", { inboxItemId: dailyCheckId(now) });
              }}
              data-testid="ward-missed-check-done"
            >
              Checked, all accounted for
            </Button>
          )}
        </p>
      </CardBody>
    </Card>
  );
}
