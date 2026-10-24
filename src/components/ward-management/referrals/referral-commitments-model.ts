import type { Instant } from "@/components/ward-management/ward-clock";
import type { Referral, ReferralAddressing, ReferralContactEntry } from "@/components/ward-management/ward-model";

import type { ReferralCommitmentEntry, ReferralCommitmentStep } from "./referral-commitments";
import { REFERRAL_COMMITMENT_STEP_IDS } from "./referral-commitments";
import { openInformationNeeds } from "./referral-information-needs";
import { referralClosedForFollowUp } from "./referral-owner-and-calls-model";

/**
 * Read-only selectors over response commitments (`referral-commitments.ts`). Every one reads
 * recorded entries only: nothing here ranks a ward, suggests one or works out a time. Lists keep
 * the order the records were made in.
 */

/** Still waiting on this copy's answer: queued, not withdrawn. */
export function awaitingWardAnswer(addressing: ReferralAddressing): boolean {
  return addressing.state === "queued" && addressing.withdrawnAt === undefined;
}

/**
 * This referral's ward copy for `unitId`: the one named for that ward, else a copy naming no ward
 * (open to every ward). The same addressing rule the follow-up events use.
 */
export function wardCopyFor(referral: Referral, unitId: string): ReferralAddressing | undefined {
  const copies = referral.destinations.filter((arm) => arm.destination.kind === "psychiatric_ward");
  return (
    copies.find((arm) => arm.destination.kind === "psychiatric_ward" && arm.destination.unitId === unitId) ??
    copies.find((arm) => arm.destination.kind === "psychiatric_ward" && arm.destination.unitId === undefined)
  );
}

export type ReferralCommitmentStatus = {
  /** The latest step recorded, with who recorded it and when. */
  step?: { step: ReferralCommitmentStep; at: Instant; by: string };
  /** The latest promised time, while the latest step is `promised`. */
  promisedFor?: Instant;
  /** The latest next callback time recorded, unless the commitment is resolved. */
  nextCallbackAt?: { at: Instant; recordedAt: Instant; by: string };
  /** How many entries were recorded for this ward. */
  entries: number;
};

/** The entries on one copy that are about `unitId`, in recorded order. */
export function commitmentEntriesFor(
  addressing: Pick<ReferralAddressing, "commitments">,
  unitId: string,
): readonly ReferralCommitmentEntry[] {
  return (addressing.commitments ?? []).filter((entry) => entry.unitId === unitId);
}

/** What the recorded entries say now. Read from the last entries, never computed. */
export function commitmentStatus(entries: readonly ReferralCommitmentEntry[]): ReferralCommitmentStatus {
  let step: ReferralCommitmentStatus["step"];
  let promisedFor: Instant | undefined;
  let nextCallbackAt: ReferralCommitmentStatus["nextCallbackAt"];
  for (const entry of entries) {
    if (entry.step !== undefined) {
      step = { step: entry.step, at: entry.at, by: entry.by };
      promisedFor = entry.step === "promised" ? entry.promisedFor : undefined;
    }
    if (entry.nextCallbackAt !== undefined) {
      nextCallbackAt = { at: entry.nextCallbackAt, recordedAt: entry.at, by: entry.by };
    }
  }
  if (step?.step === "resolved") nextCallbackAt = undefined;
  return { step, promisedFor, nextCallbackAt, entries: entries.length };
}

/** The step index, or -1 before any step: steps only move forward. */
export function commitmentStepRank(step: ReferralCommitmentStep | undefined): number {
  return step === undefined ? -1 : REFERRAL_COMMITMENT_STEP_IDS.indexOf(step);
}

/** Recorded and not resolved. */
export function commitmentIsOpen(status: ReferralCommitmentStatus): boolean {
  return status.entries > 0 && status.step?.step !== "resolved";
}

/** The recorded promised time has passed and nothing later was recorded. From the record alone. */
export function promiseOverdue(status: ReferralCommitmentStatus, now: Instant): boolean {
  return status.step?.step === "promised" && status.promisedFor !== undefined && status.promisedFor < now;
}

/** The recorded next callback time has come. */
export function callbackDue(status: ReferralCommitmentStatus, now: Instant): boolean {
  return status.nextCallbackAt !== undefined && status.nextCallbackAt.at <= now;
}

/** Calls logged to this ward about this referral, in recorded order. */
export function callsToWard(referral: Pick<Referral, "contactLog">, unitId: string): readonly ReferralContactEntry[] {
  return (referral.contactLog ?? []).filter(
    (call) => call.contact.kind === "psychiatric_ward" && call.contact.unitId === unitId,
  );
}

/**
 * "Asked N times": every call logged to this ward about this referral, plus every time a response
 * was requested of it. A count of records, never a score.
 */
export function chaseCount(referral: Referral, unitId: string): number {
  const requests = referral.destinations.reduce(
    (total, arm) =>
      total + commitmentEntriesFor(arm, unitId).filter((entry) => entry.step === "response_requested").length,
    0,
  );
  return callsToWard(referral, unitId).length + requests;
}

export function chaseCountLabel(count: number): string {
  return `Asked ${count} time${count === 1 ? "" : "s"}`;
}

/** One referral waiting on one ward, with what was recorded about it. */
export type CommitmentItem = {
  referral: Referral;
  addressing: ReferralAddressing;
  unitId: string;
  status: ReferralCommitmentStatus;
  chases: number;
  /** Items the ward asked the referrer for that are still outstanding. */
  openNeeds: number;
  lastCall?: ReferralContactEntry;
};

/**
 * Every referral still waiting on a ward, one item per referral and ward, in recorded order. A copy
 * named for a ward is that ward's open request. A copy naming no ward joins a ward's list only once
 * a commitment about that ward is recorded on it. A resolved commitment leaves the list.
 */
export function openCommitmentItems(referrals: readonly Referral[]): CommitmentItem[] {
  const items: CommitmentItem[] = [];
  for (const referral of referrals) {
    if (referralClosedForFollowUp(referral)) continue;
    for (const addressing of referral.destinations) {
      if (addressing.destination.kind !== "psychiatric_ward" || !awaitingWardAnswer(addressing)) continue;
      const named = addressing.destination.unitId;
      const unitIds = [...new Set([...(named ? [named] : []), ...(addressing.commitments ?? []).map((e) => e.unitId)])];
      for (const unitId of unitIds) {
        // A copy naming another ward never carries this ward's entries; skip a stray one.
        if (named !== undefined && named !== unitId) continue;
        const status = commitmentStatus(commitmentEntriesFor(addressing, unitId));
        if (status.step?.step === "resolved") continue;
        items.push({
          referral,
          addressing,
          unitId,
          status,
          chases: chaseCount(referral, unitId),
          openNeeds: openInformationNeeds(addressing.informationNeeds).length,
          lastCall: callsToWard(referral, unitId).at(-1),
        });
      }
    }
  }
  return items;
}

export type CallSheetGroup = {
  unitId: string;
  items: CommitmentItem[];
  /** The latest call logged to this ward across its items. */
  lastCall?: ReferralContactEntry;
  /** Outstanding asks of the referrer, summed across its items. */
  openNeeds: number;
  /** The soonest next callback time recorded across its items. */
  nextCallbackAt?: Instant;
};

/**
 * The call sheet: open items grouped by ward. Wards follow the network's own unit order; items
 * keep their recorded order inside each group. Grouping only; nothing is ranked.
 */
export function callSheetGroups(
  referrals: readonly Referral[],
  unitOrder: readonly { id: string }[],
): CallSheetGroup[] {
  const byUnit = new Map<string, CommitmentItem[]>();
  for (const item of openCommitmentItems(referrals)) {
    byUnit.set(item.unitId, [...(byUnit.get(item.unitId) ?? []), item]);
  }
  const order = [...unitOrder.map((unit) => unit.id), ...byUnit.keys()];
  const seen = new Set<string>();
  const groups: CallSheetGroup[] = [];
  for (const unitId of order) {
    if (seen.has(unitId)) continue;
    seen.add(unitId);
    const items = byUnit.get(unitId);
    if (!items) continue;
    const calls = items.flatMap((item) => (item.lastCall ? [item.lastCall] : []));
    const lastCall = calls.reduce<ReferralContactEntry | undefined>(
      (latest, call) => (latest === undefined || call.at > latest.at ? call : latest),
      undefined,
    );
    const callbacks = items.flatMap((item) => (item.status.nextCallbackAt ? [item.status.nextCallbackAt.at] : []));
    groups.push({
      unitId,
      items,
      lastCall,
      openNeeds: items.reduce((total, item) => total + item.openNeeds, 0),
      nextCallbackAt: callbacks.length > 0 ? Math.min(...callbacks) : undefined,
    });
  }
  return groups;
}

/**
 * Handover carry-over: open commitments whose promised or callback time is already past or falls
 * before `until` (the end of the next shift). Recorded order.
 */
export function commitmentsDueBy(referrals: readonly Referral[], until: Instant): CommitmentItem[] {
  return openCommitmentItems(referrals).filter(
    (item) =>
      item.status.entries > 0 &&
      ((item.status.promisedFor !== undefined && item.status.promisedFor <= until) ||
        (item.status.nextCallbackAt !== undefined && item.status.nextCallbackAt.at <= until)),
  );
}
