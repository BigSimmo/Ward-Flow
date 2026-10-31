"use client";

import { useRef, useState } from "react";

import { Sheet } from "@/components/wf/sheet";
import shell from "@/components/ward-management/shell/ward-bar.module.css";

import styles from "./new-referral-redesign.module.css";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { ReferralDrawerRedesign } from "./referral-drawer-redesign";

/**
 * New referral, redesigned: the Referrals board with the referral slide-out open over it, as the
 * app's `/ward-flow/referrals/new` does. The slide-out is a copy of today's with the calmer
 * Catchment card, mounted here in the same Sheet and classes the app bar uses, so it opens,
 * closes and asks before discarding a draft exactly as now.
 */
export function NewReferralRedesign() {
  const [open, setOpen] = useState(true);
  const [round, setRound] = useState(0);
  const closeRef = useRef<(() => void) | null>(null);
  const close = () => setOpen(false);
  return (
    <>
      <ReferralBoard defaultSelectFirst />
      {!open ? (
        <button
          type="button"
          className={styles.reopen}
          onClick={() => {
            setRound((current) => current + 1);
            setOpen(true);
          }}
        >
          Open the new referral again
        </button>
      ) : null}
      <Sheet
        id="redesign-referral-drawer"
        open={open}
        onClose={() => (closeRef.current ? closeRef.current() : close())}
        ariaLabel="Referrals"
        headerHidden
        placement="right"
        testId="redesign-referral-sheet"
        desktopBackdropClassName={shell.drawerBackdrop}
        contentClassName={`${shell.drawerSheet} ${shell.drawerSheetReferral}`}
        bodyClassName={shell.referralCarrierBody}
      >
        {open ? (
          <ReferralDrawerRedesign key={round} initialCategory="ward" closeRequestRef={closeRef} onClose={close} />
        ) : null}
      </Sheet>
    </>
  );
}
