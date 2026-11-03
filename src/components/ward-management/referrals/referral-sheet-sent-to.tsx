"use client";

// RQ9 (Josh, 3 Nov 2026): the Referral sheet's "Sent to" tab. One line per place the referral was
// sent, with that place's own answer and when it gave it. Shown only to the coordinator and the
// desk that sent the referral (`referralSentToVisible`). Read from the record; nothing inferred.

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Referral, ReferralAddressing, Unit } from "@/components/ward-management/ward-model";
import { referralDestinationLabel } from "@/components/ward-management/ward-referrals";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { Badge, type WfTone } from "@/components/wf";

import { declineReasonWords } from "./referral-board-parts";
import { destinationWords } from "./referral-ward-names";
import s from "./referral-sheet-tabs.module.css";

/** The place's own name: the ward, the ED or the community team, as the record names it. */
function placeName(addressing: ReferralAddressing, units: readonly Unit[]): string {
  const destination = addressing.destination;
  if (destination.kind === "emergency_department") {
    const ed = edById(destination.edId);
    return edShortName(ed) || ed?.name || "Emergency department not recorded";
  }
  if (destination.kind === "community_team") return destination.teamName.trim() || "Team not recorded";
  if (!destination.unitId) return "Any ward";
  return destinationWords(destination, units);
}

/** What kind of place, and what it was asked for. */
function placeKind(addressing: ReferralAddressing): string {
  const label = referralDestinationLabel(addressing.destination);
  return addressing.destination.kind === "psychiatric_ward" ? "Psychiatric ward" : label;
}

function answer(addressing: ReferralAddressing, units: readonly Unit[]): { word: string; tone: WfTone; note?: string } {
  if (addressing.withdrawnAt !== undefined)
    return { word: "Withdrawn", tone: "closed", note: "Taken back by the referrer." };
  switch (addressing.state) {
    case "accepted": {
      const unit = addressing.acceptedUnitId
        ? units.find((candidate) => candidate.id === addressing.acceptedUnitId)
        : undefined;
      const bed = addressing.heldBedNumber !== undefined ? `Bed ${addressing.heldBedNumber}` : undefined;
      const note = [unit && addressing.destination.kind === "psychiatric_ward" ? unit.name : undefined, bed]
        .filter(Boolean)
        .join(", ");
      return { word: "Accepted", tone: "success", ...(note ? { note } : {}) };
    }
    case "declined":
      return { word: "Declined", tone: "danger", note: `Reason: ${declineReasonWords(addressing.declineReason)}.` };
    case "cancelled":
      return { word: "Cancelled", tone: "closed", note: "Accepted somewhere else." };
    case "queued":
      return addressing.waitlistedAt !== undefined
        ? { word: "Waitlisted", tone: "info" }
        : { word: "Asked", tone: "warning", note: "No answer yet." };
  }
}

function whenLine(addressing: ReferralAddressing, referral: Referral, now: Instant): string {
  const parts = [`Asked ${formatInstantWithDay(addressing.referredAt ?? referral.raisedAt, now)}`];
  if (addressing.openedAt !== undefined) parts.push(`opened ${formatInstantWithDay(addressing.openedAt, now)}`);
  if (addressing.waitlistedAt !== undefined && addressing.state === "queued")
    parts.push(`waitlisted ${formatInstantWithDay(addressing.waitlistedAt, now)}`);
  if (addressing.withdrawnAt !== undefined)
    parts.push(`withdrawn ${formatInstantWithDay(addressing.withdrawnAt, now)}`);
  else if (addressing.decidedAt !== undefined)
    parts.push(
      `${addressing.state === "cancelled" ? "closed" : "answered"} ${formatInstantWithDay(addressing.decidedAt, now)}`,
    );
  return parts.join(" · ");
}

export function ReferralSentTo({ referral, units, now }: { referral: Referral; units: readonly Unit[]; now: Instant }) {
  const lines = referral.destinations;
  return (
    <div className={s.sent} data-testid="ward-referral-sent-to">
      <p className={s.sentLead}>
        Where this referral went and what each place answered. Only the coordinator and the desk that sent it see this.
      </p>
      {lines.length === 0 ? (
        <p className={s.sentEmpty}>No destinations recorded.</p>
      ) : (
        <ul className={s.sentList} aria-label="Sent to">
          {lines.map((addressing, index) => {
            const result = answer(addressing, units);
            const key = `${addressing.destination.kind}-${index}`;
            return (
              <li key={key} className={s.sentRow}>
                <div className={s.sentPlace}>
                  <b>{placeName(addressing, units)}</b>
                  <span>{placeKind(addressing)}</span>
                </div>
                <Badge tone={result.tone} size="sm">
                  {result.word}
                </Badge>
                <div className={s.sentDetail}>
                  {result.note ? <span>{result.note}</span> : null}
                  <span className={s.sentWhen}>{whenLine(addressing, referral, now)}</span>
                  {addressing.addedBy ? <span>Added after sending.</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
