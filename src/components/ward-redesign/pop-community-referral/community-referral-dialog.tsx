"use client";

// Preview copy of `CommunityScreenReferralModal` (with `AssignToTeam`) in
// src/components/ward-management/community/community-screen-modals.tsx: the Assign referral dialog on
// the kit Dialog. The command, its three answers, the text and the test ids are today's; the frame and
// layout are the redesign.

import { useCallback, useState } from "react";

import { Button, Dialog } from "@/components/wf";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { confirmedWardCommand } from "@/components/ward-management/ward-command-completion";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { referralOriginLabel } from "@/components/ward-management/community/community-screen-helpers";
import type { CommunityScreenView } from "@/components/ward-management/community/community-screen";

import styles from "./community-referral-dialog.module.css";

/** The fields of the page's view this dialog reads (the page passes its whole view). */
type ReferralDialogView = Pick<
  CommunityScreenView,
  "identityOf" | "activeModal" | "setActiveModal" | "referralModalRef" | "referralModalBackdropRef"
>;

/** Assign a referral to the team's desk. */
export function CommunityReferralDialog({ view }: { view: ReferralDialogView }) {
  const { identityOf, activeModal, setActiveModal, referralModalRef, referralModalBackdropRef } = view;
  const raise = useWardRaise("community");
  const [result, setResult] = useState<string | undefined>(undefined);
  const [resultFor, setResultFor] = useState(activeModal?.referral.id);
  // A new referral starts with no answer showing.
  if (resultFor !== activeModal?.referral.id) {
    setResultFor(activeModal?.referral.id);
    setResult(undefined);
  }
  // The page's own modal-focus hook (inert page, Tab wrap, Escape, focus return) holds these two
  // refs; they point at the kit Dialog's panel and scrim, so that hook keeps working round the new frame.
  const bindPage = useCallback(
    (node: HTMLDivElement | null) => {
      const panel = node?.closest<HTMLDivElement>('[role="dialog"]') ?? null;
      referralModalRef.current = panel;
      referralModalBackdropRef(panel?.parentElement ?? null);
    },
    [referralModalRef, referralModalBackdropRef],
  );
  if (activeModal === null) return null;
  const { referral } = activeModal;
  const close = () => setActiveModal(null);

  /**
   * Assign (fix plan item 4, 21 Oct 2026): the team takes the referral for its own desk
   * (`ASSIGN_REFERRAL`, owner `community`). It names the desk, never a clinician; clinician
   * assignment is not built, because the record holds desks rather than people. This team page reads
   * only its scoped referrals (FD-23), so it reports what the command's own outcome says rather than
   * the owner history; the reducer refuses a repeat and the referral board shows the owner.
   */
  const take = () => {
    setResult(undefined);
    void Promise.resolve(
      confirmedWardCommand(raise("ASSIGN_REFERRAL", { referralId: referral.id, owner: "community" })),
    )
      .then((outcome) =>
        setResult(
          outcome.status === "accepted"
            ? "Assigned to this team's desk."
            : outcome.status === "refused"
              ? "Not assigned. It may already be with this team's desk."
              : // Not a definite refusal: it may yet be saved by Retry, so never say "not saved".
                (outcome.message ?? SAVE_NOT_CONFIRMED),
        ),
      )
      .catch(() => setResult(SAVE_NOT_CONFIRMED));
  };

  return (
    <Dialog
      open
      onClose={close}
      // Redesign: the title is the step; the person (surname first, D-83) moves to the line under it.
      title="Assign referral"
      description={<strong className={styles.who}>{identityOf(referral)}</strong>}
      closeLabel="Close dialog"
      size="md"
    >
      <div ref={bindPage} className={styles.body} data-testid={`community-assign-${referral.id}`}>
        {/* Redesign: the referral's facts first, as label and value rows, then the one action. The person is
            named once, under the title, rather than again as the first row. */}
        <dl className={styles.facts}>
          <div className={styles.factRow}>
            <dt>Urgency</dt>
            <dd>{urgencyTierLabel(referral.urgency)}</dd>
          </div>
          <div className={styles.factRow}>
            <dt>Origin</dt>
            <dd>{referralOriginLabel(referral)}</dd>
          </div>
          <div className={styles.factRow}>
            <dt>Region</dt>
            <dd>{referral.homeRegion}</dd>
          </div>
        </dl>
        <p className={styles.note}>This names the team&apos;s desk, not a clinician.</p>
        {result ? (
          <p className={styles.result} role="status">
            {result}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
          <Button variant="pri" onClick={take} data-testid={`community-assign-take-${referral.id}`}>
            Take for this team
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
