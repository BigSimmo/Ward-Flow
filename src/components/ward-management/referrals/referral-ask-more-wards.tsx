"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import { candidateReason, referralEligibility } from "@/components/ward-management/ward-eligibility";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import {
  type Referral,
  type ReferralAddressing,
  type ReferralDestination,
  type Rejection,
  type Unit,
} from "@/components/ward-management/ward-model";
import { isAwaitingAnswer, referralWithdrawn } from "@/components/ward-management/ward-referrals";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import { useHoldOpenForm } from "@/components/ward-management/use-hold-open-form";
import { referralClosedForFollowUp } from "./referral-owner-and-calls-model";
import ph from "./referral-match-phone.module.css";

/**
 * Fix plan item 16 (D-76, mock-up version 2 locked in by Josh on 22 Oct 2026): the coordinator asks
 * more wards about an open community referral from the decision pane. The card lists every ward
 * asked and its answer, how many are waiting out of the cap, and one control. The list it opens is
 * A to Z and never ranked (D-71); only a ward that fits can be ticked. While it is open the pane's
 * footer shows Cancel and Ask instead of Decline and Accept, so there is only one set of actions.
 */

type WardArm = ReferralAddressing & { destination: Extract<ReferralDestination, { kind: "psychiatric_ward" }> };

export type AskMoreWards = ReturnType<typeof useAskMoreWards>;

export function useAskMoreWards({
  referral,
  units,
  now,
  dispatch,
  rejections,
}: {
  referral: Referral;
  units: Unit[];
  now: Instant;
  dispatch: WardCommandDispatch;
  rejections: Rejection[];
}) {
  const configuration = useOptionalWardFlowSelect("configuration")?.configuration;
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [attemptedAt, setAttemptedAt] = useState<number | null>(null);
  // Audit 24-3 SV-3: the list and its ticks stay until the ask is accepted, with the reason if not.
  const save = useWardFormSave(referral.id);
  // Audit CS3-01: the open ward list is checked against the board it opened on, so another desk's
  // answer meanwhile is reported, not asked over. Not scoped to the card: its Ask button can sit in
  // a footer outside it.
  useHoldOpenForm(open);

  const wardArms = referral.destinations.filter(
    (addressing): addressing is WardArm => addressing.destination.kind === "psychiatric_ward",
  );
  const template = wardArms[0]?.destination;
  // The cap is the network's own setting, so outside a provider (some screen tests) there is no card.
  const cap = configuration?.parallelReferralCap ?? 0;
  // The engine's own preconditions, so the card never offers what ASK_MORE_WARDS would refuse.
  const applies =
    configuration !== undefined &&
    referral.source === "community" &&
    template !== undefined &&
    wardArms.every((addressing) => addressing.destination.unitId !== undefined) &&
    referralClosedForFollowUp(referral) === undefined &&
    !referralWithdrawn(referral);
  const waiting = wardArms.filter((addressing) => isAwaitingAnswer(addressing)).length;
  const slots = Math.max(0, cap - waiting);

  const askedIds = new Set(wardArms.map((addressing) => addressing.destination.unitId));
  const unitsByWardId = new Map(units.map((unit) => [unit.id, unit]));
  const asked = wardArms.map((addressing) => ({
    addressing,
    unit: unitsByWardId.get(addressing.destination.unitId ?? ""),
  }));

  const others =
    applies && template
      ? units
          .filter((unit) => !askedIds.has(unit.id))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((unit) => {
            const verdict = referralEligibility(referral, { ...template, unitId: unit.id }, unit, now);
            // The engine refuses a ward closed to admissions, so it is never offered as a fit.
            const fit = verdict.eligible && !unit.isClosed;
            return { unit, fit, reason: unit.isClosed ? "Closed to admissions" : candidateReason(verdict) };
          })
      : [];
  // Ticks come from every fitting ward, so a ward the search hides still counts and is still asked.
  const chosen = picked.filter((id) => others.some((row) => row.fit && row.unit.id === id));
  const q = query.trim().toLowerCase();
  const shown = others.filter((row) => !q || row.unit.name.toLowerCase().includes(q));
  const fits = shown.filter((row) => row.fit);
  const review = shown.filter((row) => !row.fit);

  const rejection =
    attemptedAt === null
      ? undefined
      : rejections
          .slice(attemptedAt)
          .findLast((entry) => entry.attempted === "ASK_MORE_WARDS" && entry.movementId === referral.id);

  // Each opening of the list is its own form: an answer to an ask from an earlier opening, after
  // Cancel, must not close and clear the ticks of the current one.
  const opening = useRef(0);
  function close() {
    opening.current += 1;
    save.clearError();
    setOpen(false);
    setPicked([]);
    setQuery("");
    setShowReview(false);
  }

  return {
    referral,
    applies,
    open,
    cap,
    waiting,
    slots,
    asked,
    fits,
    review,
    chosen,
    query,
    showReview,
    rejection,
    // A refusal this desk already lists as a rejection is said once, by that line.
    failure: rejection ? undefined : save.error,
    pending: save.pending,
    setQuery,
    setShowReview,
    start() {
      setAttemptedAt(null);
      setOpen(true);
    },
    close,
    toggle(unitId: string, on: boolean) {
      setPicked((current) => (on ? [...current, unitId] : current.filter((id) => id !== unitId)));
    },
    ask() {
      if (chosen.length === 0 || chosen.length > slots || save.pending) return;
      setAttemptedAt(rejections.length);
      const asked = opening.current;
      save.submit(
        () => wardRaise(dispatch, "coordinator", now)("ASK_MORE_WARDS", { referralId: referral.id, unitIds: chosen }),
        () => {
          if (opening.current === asked) close();
        },
      );
    },
  };
}

const plural = (n: number) => (n === 1 ? "" : "s");

/** The pane footer while the list is open: Cancel first and Ask second, as `.foot` expects. */
export function AskMoreWardsFoot({ ask }: { ask: AskMoreWards }) {
  const n = ask.chosen.length;
  // A ward can start waiting elsewhere while the list is open, so the ticks can outgrow the slots.
  const over = n > ask.slots;
  const reason =
    n === 0
      ? "Tick at least one ward that fits."
      : over
        ? `Only ${ask.slots} more can be waiting now.`
        : ask.pending
          ? "Still asking the wards ticked."
          : undefined;
  return (
    <>
      <Button variant="sec" size="md" type="button" data-testid="ward-referral-ask-cancel" onClick={ask.close}>
        Cancel
      </Button>
      <Button
        variant="pri"
        size="md"
        type="button"
        data-testid="ward-referral-ask-submit"
        disabledReason={reason}
        reasonDisplay="tooltip"
        onClick={reason ? undefined : ask.ask}
      >
        <span className={ph.ell}>
          {n === 0 ? `Pick up to ${ask.slots} ward${plural(ask.slots)}` : `Ask ${n} ward${plural(n)}`}
        </span>
      </Button>
    </>
  );
}
