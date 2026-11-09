"use client";

/**
 * Decide a referral on Home (friction pass item 6a, Josh's approval, 9 Nov 2026). The Referrals
 * board's own decision view (`ReferralMatchView`), not a copy: the same wards, the same Accept and
 * Decline with the same role rules and the same Undo, drawn in Home's placement drawer so the
 * coordinator stays on Home. Accept and Decline land in the drawer's pinned foot.
 */
import { useState, type ReactNode } from "react";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Referral } from "@/components/ward-management/ward-model";
import { HistoryFoldProvider } from "@/components/ward-management/referrals/folded-history-context";
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match-lazy";
import { useReferralDecisionUndo } from "@/components/ward-management/referrals/use-referral-decision-undo";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import styles from "./home-referral-decision.module.css";

export function HomeReferralDecision({
  referral,
  patientInfo,
  footSlot,
  otherDesk,
}: {
  referral: Referral;
  patientInfo: { displayName: string; umrn: string };
  /** The placement drawer's pinned foot, where Accept and Decline render. */
  footSlot: HTMLElement | null | undefined;
  /** What a desk other than the coordinator sees instead: the Decide link to the board (WS-04). */
  otherDesk: ReactNode;
}) {
  return useRouteRole() === "coordinator" ? (
    <Decision referral={referral} patientInfo={patientInfo} footSlot={footSlot} />
  ) : (
    <>{otherDesk}</>
  );
}

function Decision({
  referral,
  patientInfo,
  footSlot,
}: {
  referral: Referral;
  patientInfo: { displayName: string; umrn: string };
  footSlot: HTMLElement | null | undefined;
}) {
  const { units, dispatch, rejections } = useWardFlowSelect("units", "dispatch", "rejections");
  const now = useWardFlowClock();
  // Home's decisions are the coordinator's, as on the board (CO-D2), so Undo is too.
  const watchDecision = useReferralDecisionUndo("coordinator");
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <section
      className={styles.decision}
      aria-label={`Decide on this referral for ${patientInfo.displayName}`}
      data-testid="ward-referral-placement-decide"
    >
      <HistoryFoldProvider value={{ open: historyOpen, onToggle: () => setHistoryOpen((open) => !open) }}>
        <ReferralMatchView
          key={referral.id}
          referral={referral}
          units={units}
          now={now}
          dispatch={dispatch}
          rejections={rejections}
          patientInfo={patientInfo}
          hideDossierHeader
          onDecision={(title, completion) =>
            watchDecision(referral.id, `${title} · ${patientInfo.displayName}`, completion)
          }
          footSlot={footSlot ?? undefined}
        />
      </HistoryFoldProvider>
    </section>
  );
}
