"use client";

/**
 * Mock-up fork of `AskMoreWardsCard` (`ward-management/referrals/referral-ask-more-wards.tsx`). The
 * one change (D-91): the open list is the one Find a ward list (`./find-a-ward.tsx`), the same search,
 * groups and rows as the patient record's Destination sheet. The hook (`useAskMoreWards`) and the
 * footer (`AskMoreWardsFoot`) stay the real ones, so Ask is wired exactly as before, with its hard cap.
 * Build note: the real build swaps the list in the real card and deletes this fork.
 */
import { useId, useState } from "react";
import { Button } from "@/components/wf";
import type { AskMoreWards } from "./referral-ask-more-wards";
import { type ReferralAddressing } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import styles from "./referral-ask-more-wards.module.css";

import { FindAWard } from "./find-a-ward";

function answerOf(addressing: ReferralAddressing): string {
  if (addressing.withdrawnAt !== undefined) return "Withdrawn";
  if (addressing.state === "accepted") return "Accepted";
  if (addressing.state === "declined") return "Declined";
  if (addressing.state === "cancelled") return "Cancelled";
  return addressing.waitlistedAt !== undefined ? "On waiting list" : "Waiting";
}

export function AskMoreWardsCard({ ask }: { ask: AskMoreWards }) {
  const baseId = useId();
  if (!ask.applies) return null;
  const full = ask.slots === 0;
  return (
    <section className={styles.card} aria-labelledby={`${baseId}-title`} data-testid="ward-referral-ask-more-wards">
      <div className={styles.head}>
        <h3 id={`${baseId}-title`}>Wards asked</h3>
        <span className={styles.pill} data-full={full ? "true" : undefined} data-testid="ward-referral-ask-waiting">
          {ask.waiting} of {ask.cap} waiting
        </span>
      </div>
      <ul className={styles.asked}>
        {ask.asked.map(({ addressing, unit }) => {
          const site = unit ? siteByCode(unit.siteCode)?.name : undefined;
          return (
            <li key={addressing.destination.unitId}>
              <b>{unit?.name ?? "Ward not in this network"}</b>
              <small>
                {[site, addressing.addedBy ? `asked by ${addressing.addedBy.toLowerCase()}` : undefined]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
              <em>{answerOf(addressing)}</em>
            </li>
          );
        })}
      </ul>
      {ask.rejection ? (
        <p className={styles.hint} role="alert" data-testid="ward-referral-ask-rejection">
          Not asked: {ask.rejection.reason}
        </p>
      ) : null}
      {ask.failure ? (
        <p className={styles.hint} role="alert" data-testid="ward-referral-ask-failure">
          {ask.failure}
        </p>
      ) : null}
      {ask.open ? (
        // D-91: the one Find a ward list, shared with the patient record's Destination sheet.
        <AskMoreWardsList ask={ask} />
      ) : (
        <>
          <p className={styles.hint}>
            {full
              ? `${ask.waiting} wards are waiting, the most at once. You can ask another when one of them answers.`
              : `Up to ${ask.cap} wards can be waiting at once. A ward that declines frees its place.`}
          </p>
          <Button
            variant="sec"
            size="md"
            type="button"
            className={styles.open}
            data-testid="ward-referral-ask-open"
            disabledReason={full ? `${ask.cap} wards are already waiting.` : undefined}
            reasonDisplay="tooltip"
            onClick={full ? undefined : ask.start}
          >
            Ask more wards
          </Button>
        </>
      )}
    </section>
  );
}

/**
 * The open list. Its search words live here, so closing the list (Cancel, or an accepted ask) clears
 * them; the hook's own query stays empty, so its rows reach the list unfiltered and the list filters.
 */
function AskMoreWardsList({ ask }: { ask: AskMoreWards }) {
  const [query, setQuery] = useState("");
  return (
    <div className={styles.list} data-testid="ward-referral-ask-list">
      <FindAWard
        query={query}
        onQueryChange={setQuery}
        rows={[...ask.fits, ...ask.review]}
        chosen={ask.chosen}
        onToggle={ask.toggle}
        canTick={() => ask.chosen.length < ask.slots}
        note="Each ward asked gets the same referral and bed details, with its own clock."
        testIdPrefix="ward-referral-ask-ward"
      />
    </div>
  );
}
