"use client";

// The bed board's work band: the shift's Needs you tiles and the bed-release blocker dialog.
// Split out of ward-board.tsx to keep that file under the line cap; WardBoard still owns every
// value and passes it in.
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import styles from "./board.module.css";
import { type ShiftTileItem } from "./ward-board-model";
import type { ActionToast } from "@/components/ward-management/ward-action-toast";

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";

export function WardBoardWorkBand({
  blockerCloseBtnRef,
  blockerDialogItem,
  blockerDialogRef,
  closeBlockerDialog,
  dispatchAndReport,
  handleShiftAction,
  liveBedReleases,
  nameFor,
  raise,
  selectedBlocker,
  setSelectedBlocker,
  setSelectedKey,
  setShiftExpanded,
  setToastMessage,
  shiftDigest,
  shiftExpanded,
  shiftTiles,
  unit,
}: {
  blockerCloseBtnRef: RefObject<HTMLButtonElement | null>;
  blockerDialogItem: ShiftTileItem | null;
  blockerDialogRef: RefObject<HTMLDivElement | null>;
  closeBlockerDialog: () => void;
  dispatchAndReport: (record: () => ReturnType<WardCommandDispatch>, success: string) => void;
  handleShiftAction: (item: ShiftTileItem, word: string) => void;
  liveBedReleases: BedRelease[];
  nameFor: (admissionId: string | undefined) => string;
  raise: WardRaise;
  selectedBlocker: BedReleaseBlocker;
  setSelectedBlocker: Dispatch<SetStateAction<BedReleaseBlocker>>;
  setSelectedKey: Dispatch<SetStateAction<string | null>>;
  setShiftExpanded: Dispatch<SetStateAction<boolean>>;
  setToastMessage: Dispatch<SetStateAction<ActionToast | null>>;
  shiftDigest: string;
  shiftExpanded: boolean;
  shiftTiles: ShiftTileItem[];
  unit: Unit;
}) {
  return (
    <section
      className={`${styles.workBand} ${styles.workZone}`}
      aria-labelledby="ward-board-work-band-heading"
      data-wf-rail="1121"
    >
      <details className={styles.workBandFold} data-testid="ward-board-work-band" open>
        <summary className={styles.workBandSummary}>
          <h2 id="ward-board-work-band-heading" className={styles.workBandTitle}>
            Before handover
          </h2>
          <span className={styles.workBandDigest} data-testid="ward-board-work-band-digest">
            {shiftDigest}
          </span>
        </summary>
        {/* Device audit, 11 Oct 2026: the "Preview: a quiet shift" demo tab is gone from the
                  interface; the empty state below is the real one. */}
        {shiftTiles.length === 0 ? (
          <p className={styles.workBandEmpty}>
            No bed is out of service or closed; nobody is travelling here or due out today.
          </p>
        ) : (
          <div
            className={styles.shiftGrid}
            data-testid="ward-board-work-band-list"
            data-expanded={shiftExpanded ? "true" : undefined}
          >
            {shiftTiles.map((item) => (
              <div
                key={item.key}
                className={styles.shiftTile}
                data-tone={item.tone ?? undefined}
                data-testid={`ward-board-shift-${item.key}`}
              >
                <div className={styles.shiftTop}>
                  <button
                    type="button"
                    className={styles.shiftBedLink}
                    onClick={() => {
                      if (item.selectableKey) {
                        setSelectedKey(item.selectableKey);
                      }
                    }}
                  >
                    {item.label}
                  </button>
                  <span className={styles.shiftTag}>{item.chip}</span>
                  {item.when ? <span className={styles.shiftWhen}>{item.when}</span> : null}
                </div>
                <span className={styles.shiftSub}>{item.text}</span>
                <div className={styles.shiftRowActs}>
                  {item.acts.map((act, actIdx) => (
                    <button
                      key={actIdx}
                      type="button"
                      className={styles.shiftCtl}
                      data-tone={act.tone ?? undefined}
                      onClick={() => handleShiftAction(item, act.word)}
                    >
                      {act.word}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {shiftTiles.length > 3 ? (
          <button
            type="button"
            className={styles.shiftMore}
            aria-expanded={shiftExpanded}
            onClick={() => setShiftExpanded((open) => !open)}
          >
            {shiftExpanded ? "Show fewer" : `Show ${shiftTiles.length - 3} more`}
          </button>
        ) : null}
        {blockerDialogItem ? (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- a backdrop click closes it for the pointer, and the shared modal focus helper closes it on Escape
          <div
            ref={blockerDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="blocker-dialog-title"
            aria-describedby="blocker-dialog-description"
            id="ward-board-blocker-dialog"
            tabIndex={-1}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeBlockerDialog();
            }}
            className={styles.modalBackdrop}
          >
            <div className={styles.blockerDialogPanel}>
              <div className={styles.modalHeader}>
                <h3 id="blocker-dialog-title" className={styles.blockerDialogTitle}>
                  Record a blocker for {blockerDialogItem.label}
                </h3>
                <button
                  ref={blockerCloseBtnRef}
                  type="button"
                  onClick={closeBlockerDialog}
                  aria-label="Close dialog"
                  className={styles.blockerCloseBtn}
                >
                  ✕
                </button>
              </div>

              <div className={styles.blockerSubjectCard}>
                <div className={styles.blockerSubjectRow}>
                  <span className={styles.blockerSubjectLabel}>Bed / Subject: {blockerDialogItem.label}</span>
                  {blockerDialogItem.chip ? (
                    <span className={styles.blockerSubjectChip}>{blockerDialogItem.chip}</span>
                  ) : null}
                </div>
                {blockerDialogItem.when ? (
                  <span className={styles.blockerSubjectWhen}>Timing indicator: {blockerDialogItem.when}</span>
                ) : null}
                {blockerDialogItem.text ? (
                  <span className={styles.blockerSubjectText}>{blockerDialogItem.text}</span>
                ) : null}
              </div>

              <div className={styles.blockerReasonGroup}>
                <p id="blocker-dialog-description" className={styles.blockerReasonPrompt}>
                  Select the reason preventing bed release:
                </p>
                <div
                  role="radiogroup"
                  aria-labelledby="blocker-dialog-description"
                  className={styles.blockerReasonList}
                >
                  {BED_RELEASE_BLOCKERS.map((b) => {
                    const isSelected = selectedBlocker === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSelectedBlocker(b)}
                        style={{
                          minHeight: "var(--ward-tap, 48px)",
                          minWidth: "var(--ward-tap, 48px)",
                          padding: "0.625rem 0.875rem",
                          borderRadius: "var(--r1, 0.25rem)",
                          border: isSelected
                            ? "2px solid var(--accent, var(--primary))"
                            : "1px solid var(--line-strong)",
                          background: isSelected ? "var(--accent-soft, var(--surface-2))" : "var(--surface)",
                          color: "var(--ink)",
                          fontWeight: isSelected ? 600 : 400,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          textAlign: "left",
                          fontVariantNumeric: "tabular-nums",
                          fontSize: "0.875rem",
                          lineHeight: "1.3",
                          boxShadow: isSelected ? "var(--lift)" : "none",
                        }}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={`${styles.shiftCtl} ${styles.blockerCancelBtn}`}
                  onClick={closeBlockerDialog}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${styles.shiftCtl} ${styles.blockerConfirmBtn}`}
                  data-tone="warn"
                  onClick={() => {
                    // Walkthrough D3 (25 Sept 2026): a release names its stay (owner ruling),
                    // so the blocker goes on THIS person's own live release, never the ward's
                    // first release or a made-up id. With none, nothing is recorded.
                    const ownRelease = liveBedReleases?.find(
                      (r) => r.admissionId === blockerDialogItem.selectableKey && r.state !== "discharged",
                    );
                    const who = blockerDialogItem.who || nameFor(blockerDialogItem.selectableKey);
                    if (!ownRelease) {
                      const msg = `No discharge is recorded for ${who}, so there is nothing to hold up. Nothing was changed.`;
                      setToastMessage({ warning: msg });
                      announceToWardShell(
                        "No discharge is recorded for this patient, so there is nothing to hold up. Nothing was changed.",
                      );
                    } else {
                      dispatchAndReport(
                        () =>
                          raise("BLOCK_BED_RELEASE", {
                            releaseId: ownRelease.id,
                            actingUnitId: unit.id,
                            blocker: selectedBlocker,
                          }),
                        `Blocker recorded for ${who}: ${selectedBlocker}.`,
                      );
                    }
                    closeBlockerDialog();
                  }}
                >
                  Confirm blocker
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </details>
    </section>
  );
}
