"use client";

// The bed board's work band: the shift's Needs you tiles and the bed-release blocker dialog.
// Split out of ward-board.tsx to keep that file under the line cap; WardBoard still owns every
// value and passes it in.
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import type { BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import styles from "./board.module.css";
import { type ShiftTileItem } from "./ward-board-model";
import { WardBoardBlockerDialog } from "./ward-board-blocker-dialog";
import type { ActionToast } from "@/components/ward-management/ward-action-toast";

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";

export function WardBoardWorkBand({
  // `blockerCloseBtnRef` and `selectedBlocker` stay in the props so the page passes what it passes
  // today; the kit Dialog's own close takes first focus, and the dialog holds its own choice.
  blockerDialogItem,
  blockerDialogRef,
  closeBlockerDialog,
  dispatchAndReport,
  handleShiftAction,
  liveBedReleases,
  nameFor,
  raise,
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
  dispatchAndReport: (record: () => ReturnType<WardCommandDispatch>, success: string, who?: string) => void;
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
      {/* The heading sits outside the fold's control: a summary is read as a button, and a heading
          inside it is lost to screen readers. The summary shows the same words as plain text. */}
      <h2 id="ward-board-work-band-heading" className="sr-only">
        Before handover
      </h2>
      <details className={styles.workBandFold} data-testid="ward-board-work-band" open>
        <summary className={styles.workBandSummary}>
          <span className={styles.workBandTitle}>Before handover</span>
          <span className={styles.workBandDigest} data-testid="ward-board-work-band-digest">
            {shiftDigest}
          </span>
        </summary>
        {/* Device audit, 11 Oct 2026: the "Preview: a quiet shift" demo tab is gone from the
                  interface; the empty state below is the real one. */}
        {shiftTiles.length === 0 ? (
          <p className={styles.workBandEmpty}>Nothing out of service, closed, arriving or due for discharge today.</p>
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
                    {item.subject ? `${item.subject} · ` : null}
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
                      // The visible word leads the name (WCAG 2.5.3); the bed and person follow.
                      aria-label={item.subject ? `${act.word}, ${item.subject.replace(/ · /g, ", ")}` : undefined}
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
          // The kit Dialog, mounted per open so no reason carries over from the last one.
          <WardBoardBlockerDialog
            item={blockerDialogItem}
            blockerDialogRef={blockerDialogRef}
            closeBlockerDialog={closeBlockerDialog}
            dispatchAndReport={dispatchAndReport}
            liveBedReleases={liveBedReleases}
            nameFor={nameFor}
            raise={raise}
            setSelectedBlocker={setSelectedBlocker}
            setToastMessage={setToastMessage}
            unit={unit}
          />
        ) : null}
      </details>
    </section>
  );
}
