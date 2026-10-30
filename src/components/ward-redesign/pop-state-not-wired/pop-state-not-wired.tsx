"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { NOT_WIRED } from "@/components/ward-management/referrals/referral-board-parts";
import { Button, buttonClass, Card, CardHead } from "@/components/wf";

import styles from "./pop-state-not-wired.module.css";

/**
 * The Not wired mock-up (owner decision D4): how a control that is drawn but not connected looks.
 * It uses the wf kit Button's own unavailable state (`disabledReason`): `aria-disabled` so it keeps
 * its tab stop, the dashed grey style, a lock and the exact sentence, "Not wired in this
 * prototype.", from the app's one constant (referrals/referral-board-parts.tsx). It sits in a small
 * panel of referral actions, beside a wired action for contrast: Intake board opens the referral
 * board, while Contact referrer (an action the record preview drew before it was hidden for not
 * working) does nothing when pressed. The panel is docked to the corner of the page, over Home.
 */
export function PopStateNotWired({ page }: { page: ReactNode }) {
  return (
    <>
      {page}
      <Card
        as="section"
        className={styles.panel}
        aria-labelledby="pop-not-wired-title"
        data-testid="pop-state-not-wired"
      >
        <CardHead id="pop-not-wired-title" title="Referral actions" meta="Example of a control that is not wired" />
        <div className={styles.actions}>
          <Link href="/ward-flow/referrals" className={buttonClass({ variant: "pri", className: styles.action })}>
            Intake board
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
          <Button variant="sec" className={styles.action} disabledReason={NOT_WIRED}>
            Contact referrer
          </Button>
        </div>
      </Card>
    </>
  );
}
