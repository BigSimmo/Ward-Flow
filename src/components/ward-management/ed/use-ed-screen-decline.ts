"use client";

// The inbox decline: its panel, its draft, and the check that tells a refused decline from a
// recorded one. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import { useEffect, useRef, useState } from "react";
import type { WardFlowContextValue } from "@/components/ward-management/ward-flow-provider";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { ReferralDeclineReason, Rejection } from "@/components/ward-management/ward-model";
import type { useUndoableStep } from "@/components/ward-management/use-undoable-step";

export function useEdInboxDecline({
  rejections,
  raise,
  offerStep,
}: {
  rejections: WardFlowContextValue["rejections"];
  raise: WardRaise;
  offerStep: ReturnType<typeof useUndoableStep>["offer"];
}) {
  /*
   * THE INBOX DECLINE, wired 2026-09-01. `EVENT_ROLE.DECLINE_REFERRAL` gained `"ed"`, so this
   * screen may answer a referral addressed to it as itself and the reducer records
   * `decidedBy: "ED mental health"` — the correct team, not a ward standing in for one.
   *
   * ⚠️ **ONE `openFor` id AND ONE DRAFT, never a keyed map** — the same shape the four controls in
   * the patients section below already use. Only one panel is open at a time, so one draft can
   * never be read against the wrong referral; a map would additionally keep a reason a clinician
   * chose for a row they have since closed and moved on from.
   *
   * ⚠️ **THE DRAFT IS `undefined`, NOT `REFERRAL_DECLINE_REASONS[0]`** — see
   * `NO_DECLINE_REASON_VALUE` above for why a pre-selected reason is a fabricated clinical fact
   * here even though `referral-match.tsx` may safely seed one.
   */
  const [declineOpenFor, setDeclineOpenFor] = useState<string | undefined>(undefined);
  const [declineDraft, setDeclineDraft] = useState<ReferralDeclineReason | undefined>(undefined);
  /*
   * ⚠️ **NO PATH FROM THIS SCREEN CAN CURRENTLY PRODUCE A REFUSAL. THIS BRANCH IS WRITTEN AGAINST A
   * FUTURE DISPATCHER, NOT A LIVE ONE — do not read it as covering something that happens today.**
   *
   * Checked branch by branch against the reducer's `DECLINE_REFERRAL` case on 2026-09-01, and every
   * one of its six refusals is closed from here:
   *
   *   `no referral found`              — nothing ever removes a referral from state.
   *   role/kind mismatch               — both are fixed literals in `submitDecline` below.
   *   `not addressed to …`             — the row exists BECAUSE this ED addressing exists.
   *   `already accepted elsewhere`     — an acceptance on any sibling arm CANCELS this one
   *                                      (`ACCEPT_REFERRAL`'s FD-22 loop), and `edReferralsFor`
   *                                      keeps only `queued`, so the row is gone before it could be
   *                                      pressed. Verified by running it, not by reading it.
   *   `has already answered (state)`   — the row renders only while `queued`, and `RECEIVE_REFERRAL`
   *                                      refuses two destinations of the same kind, so one referral
   *                                      can never have a second ED arm to answer out of order.
   *   reason not a member              — `declineDraft` is drawn from `ED_DECLINE_REASONS`, a subset
   *                                      of the list the reducer checks against, and `undefined`
   *                                      returns early.
   *
   * It is kept rather than deleted because the spec requires a refusal to be surfaced and scoped,
   * and a dispatcher that can be refused is a change away — the ED gaining its own producer, or a
   * second screen sharing this provider. `tests/ward-ed-psychiatry-hub.dom.test.tsx` drives a real
   * reducer refusal through the provider to pin the mechanism and, above all, the SCOPING, which is
   * otherwise the half nothing would notice going wrong.
   *
   * ⚠️ **WHY IT IS SCOPED TO THE ROW.** `dispatch` never reports whether the reducer accepted, so
   * the only way to know is to compare `rejections` before and after — the same
   * `checkToken`/`priorRejectionCountRef` pair `referral-match.tsx` uses.
   * **What does NOT port from `referral-match.tsx` is holding one `lastRejection` for the whole
   * component.** That is safe there only because that screen renders exactly ONE referral. This is
   * a LIST, so an unscoped refusal would be displayed against whichever row happened to render it.
   * The referral id is therefore carried alongside, taken from `Rejection.movementId` — which holds
   * the REFERRAL id for `DECLINE_REFERRAL` (`subjectId` in `ward-flow-reducer.ts`) rather than a
   * movement id — so the pairing comes from the rejection itself and cannot be misattributed.
   */
  const [declineRejection, setDeclineRejection] = useState<{ referralId: string; rejection: Rejection } | undefined>(
    undefined,
  );
  const priorRejectionCountRef = useRef(rejections.length);
  const [declineCheckToken, setDeclineCheckToken] = useState(0);
  const pendingDeclineRef = useRef<{ id: string; completion: ReturnType<WardRaise> } | undefined>(undefined);

  useEffect(() => {
    // Nothing has been dispatched from this screen yet, so a rejection already in state belongs to
    // somebody else and must not be surfaced here.
    if (declineCheckToken === 0) return;
    if (rejections.length > priorRejectionCountRef.current) {
      const newest = rejections[rejections.length - 1];
      setDeclineRejection(
        newest.attempted === "DECLINE_REFERRAL" ? { referralId: newest.movementId, rejection: newest } : undefined,
      );
    } else {
      setDeclineRejection(undefined);
    }
    const declined = pendingDeclineRef.current;
    // A confirmed command owns its result. An unrelated refusal in the same render must not
    // suppress it; rejection-count inference is only for legacy callers returning void.
    if (declined && (declined.completion !== undefined || rejections.length <= priorRejectionCountRef.current)) {
      offerStep(
        {
          success: "Referral declined",
          undo: (at) => ({ type: "UNDO_REFERRAL_DECISION", role: "ed", now: at, referralId: declined.id }),
          undone: "Decline undone",
        },
        { completion: declined.completion },
      );
    }
    pendingDeclineRef.current = undefined;
    priorRejectionCountRef.current = rejections.length;
    // `offerStep` is read at the moment the check runs; the check itself is keyed
    // on the dispatch token so it runs once per decline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejections, declineCheckToken]);

  function toggleDecline(referralId: string) {
    setDeclineOpenFor((current) => (current === referralId ? undefined : referralId));
    // Blanked on every OPEN as well as every close, the same ruling `toggleBookTransport` records:
    // the previous row's reason carried into this panel would be a remembered value standing in
    // for an unmade decision, and this list is one row per patient.
    setDeclineDraft(undefined);
    setDeclineRejection(undefined);
  }

  function submitDecline(referralId: string) {
    // Never dispatched without a reason. The reducer refuses one by membership check — that is the
    // rule's real home — but a refusal raised from here would be invisible to whoever pressed the
    // button, so the control declines to advertise a decline it knows would be rejected.
    if (declineDraft === undefined) return;
    priorRejectionCountRef.current = rejections.length;
    const completion = raise("DECLINE_REFERRAL", {
      referralId,
      // Named, never defaulted: this screen is the emergency department's own inbox, so the
      // destination answering here is the emergency department. The reducer must not have to guess
      // which destination replied — and naming it is what keeps its `answerableBy` guard meaningful.
      destinationKind: "emergency_department",
      reason: declineDraft,
    });
    pendingDeclineRef.current = { id: referralId, completion };
    setDeclineCheckToken((token) => token + 1);
    // ⚠️ **THE PANEL IS DELIBERATELY NOT CLOSED AND THE DRAFT NOT CLEARED HERE.** `dispatch` does
    // not say whether the reducer accepted, so closing on dispatch would discard a clinician's
    // chosen reason on a REFUSAL. On acceptance the row leaves the inbox — `edReferralsFor` keeps
    // only `queued` addressings — and the panel goes with it; on a refusal the panel stays open,
    // beside the stated reason it was refused for.
  }

  return { declineOpenFor, declineDraft, setDeclineDraft, declineRejection, toggleDecline, submitDecline };
}
