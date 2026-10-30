// Preview copy of `ReferralSummaryRail` in src/components/ward-management/referrals/ward-referral-drawer-rail.tsx.
"use client";

import { Eye } from "lucide-react";
import Link from "next/link";
import styles from "@/components/ward-management/referrals/ward-referral-drawer.module.css";
import {
  discardReferralDraft,
  referralDraftAgeText,
} from "@/components/ward-management/referrals/referral-draft-store";
import { StatusGlyph } from "@/components/wf";
import redesign from "./new-referral-redesign.module.css";
import { drawerRailHeading } from "@/components/ward-management/referrals/referral-drawer-foot-status";
import type { WardReferralDrawerState } from "@/components/ward-management/referrals/use-ward-referral-drawer-state";

export function ReferralSummaryRail({
  s,
  alreadyOpen,
}: {
  s: WardReferralDrawerState;
  alreadyOpen: string | undefined;
}) {
  const {
    onClose,
    onRestart,
    kept,
    bodyRef,
    sectionId,
    previewOpen,
    setPreviewOpen,
    summaryOpen,
    setSummaryOpen,
    sentReferralId,
    draftKeptAt,
    draftNowMs,
    stopDraftAutosave,
    itemsTotal,
    itemsLeft,
    itemsReady,
    readyRows,
    needed,
    sectionIds,
    destType,
    communityNeeds,
  } = s;
  // Overall review (20 Oct 2026): "0 of 18" sat beside steps whose "needed" figures add to 13. The
  // difference is the contact details asked at Send, so the rail names them when any are still empty.
  const stepsLeft = sectionIds.reduce((sum, id) => sum + needed[id], 0);
  const contactLeft = itemsLeft - stepsLeft;
  return (
    <aside
      className={styles.rail}
      id={`${sectionId}-summary`}
      aria-label="Referral summary"
      data-open={summaryOpen}
      data-testid="ward-referral-summary-rail"
    >
      {sentReferralId ? (
        <section className={styles.railCard}>
          <p className={styles.eyebrow}>Next</p>
          <p className={styles.bodyMeta}>Follow {sentReferralId} on the Referrals board.</p>
          <Link className={styles.btn} href="/ward-flow/referrals" onClick={onClose}>
            Open Referrals board
          </Link>
        </section>
      ) : (
        <>
          <section className={styles.railCard}>
            <div className={styles.railHead}>
              <h3 className={styles.cardTitle}>{drawerRailHeading(itemsLeft)}</h3>
              {kept || draftKeptAt !== null ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={() => {
                    stopDraftAutosave();
                    discardReferralDraft();
                    onRestart();
                  }}
                >
                  Discard draft
                </button>
              ) : null}
            </div>
            {draftKeptAt !== null ? (
              <p className={styles.draftStatus} data-testid="ward-referral-draft-status">
                <StatusGlyph tone="success" size={8} />
                Draft kept in this tab · {referralDraftAgeText(draftKeptAt, draftNowMs)}
              </p>
            ) : null}
            {/* UX audit 21 Oct 2026: the drawer stated one count five ways. The footer keeps the count
                and the stepper keeps each step's share; the rail only adds what neither shows. */}
            {contactLeft > 0 ? (
              <p className={styles.railCount} data-testid="ward-referral-count-split">
                Your contact {contactLeft === 1 ? "detail is" : "details are"} asked at Send.
              </p>
            ) : null}
            <span className={styles.railProgress} aria-hidden="true">
              <i style={{ width: `${Math.round((itemsReady / itemsTotal) * 100)}%` }} />
            </span>
            {/* Redesign: a long value (a full ED name) wraps rather than ending in "…". */}
            <dl className={`${styles.railRows} ${redesign.railWrap}`}>
              {readyRows.map((row) => (
                <div key={row.label} data-state={row.state}>
                  <dt>
                    <StatusGlyph
                      tone={row.state === "done" ? "success" : row.state === "follow" ? "warning" : "neutral"}
                      size={9}
                    />
                    {row.label}
                  </dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          {/* Redesign: Urgency is already a Before you send row, and "Already open: None" was an
              empty cell, so this card shows only what the list does not: a community referral's
              first contact time, and an open referral to check. */}
          {destType === "community" || alreadyOpen ? (
            <section
              className={
                destType === "community" && alreadyOpen ? styles.railCard : `${styles.railCard} ${redesign.railSingle}`
              }
              data-layout="pair"
            >
              {destType === "community" ? (
                // D-77: a community referral's urgency is its first contact time (Josh, 23 Oct 2026).
                <div>
                  <p className={styles.eyebrow}>First contact</p>
                  <strong className={styles.mono}>{communityNeeds.firstContact ?? "Choose within"}</strong>
                  <small>Team sees it as the due time</small>
                </div>
              ) : null}
              {alreadyOpen ? (
                <div>
                  <p className={styles.eyebrow}>Already open</p>
                  <strong>Yes</strong>
                  <small title="Check before sending">Check before sending</small>
                </div>
              ) : null}
            </section>
          ) : null}
          <button
            type="button"
            className={styles.btn}
            data-testid="ward-referral-preview-letter"
            aria-pressed={previewOpen}
            onClick={() => {
              setPreviewOpen((open) => !open);
              setSummaryOpen(false);
              if (bodyRef.current) bodyRef.current.scrollTop = 0;
            }}
          >
            <Eye aria-hidden="true" />
            {previewOpen ? "Back to edit" : "Preview letter"}
          </button>
        </>
      )}
    </aside>
  );
}
