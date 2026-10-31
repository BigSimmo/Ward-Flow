"use client";

// Preview copy of `board/ward-board-work-band.tsx` (WardBoardWorkBand). The Needs you tiles are
// unchanged; only the "Record a blocker" dialog is redesigned, on the kit Dialog.
// The bed board's work band: the shift's Needs you tiles and the bed-release blocker dialog.
// Split out of ward-board.tsx to keep that file under the line cap; WardBoard still owns every
// value and passes it in.
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import styles from "@/components/ward-management/board/board.module.css";
import { type ShiftTileItem } from "@/components/ward-management/board/ward-board-model";
import type { ActionToast } from "@/components/ward-management/ward-action-toast";

import { useCallback, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import { Button, Dialog, Radio } from "@/components/wf";

import blocker from "./board-blocker.module.css";

export function WardBoardWorkBand({
  // `blockerCloseBtnRef` stays in the props so the page passes what it passes today; the kit
  // Dialog's own close button takes first focus instead.
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
          // Redesign: the kit Dialog, mounted per open so no reason carries over from the last one.
          <BlockerDialog
            item={blockerDialogItem}
            blockerDialogRef={blockerDialogRef}
            closeBlockerDialog={closeBlockerDialog}
            dispatchAndReport={dispatchAndReport}
            liveBedReleases={liveBedReleases}
            nameFor={nameFor}
            raise={raise}
            selectedBlocker={selectedBlocker}
            setSelectedBlocker={setSelectedBlocker}
            setToastMessage={setToastMessage}
            unit={unit}
          />
        ) : null}
      </details>
    </section>
  );
}

/**
 * Redesign of the hand-built "Record a blocker for …" dialog. The save is today's: the blocker goes
 * on this person's own live release (`BLOCK_BED_RELEASE`), or nothing is recorded. New: no reason
 * starts chosen. `chosen` is local, the page's `selectedBlocker` is set only on a tap, and Confirm
 * stays unavailable until then.
 */
function BlockerDialog({
  item,
  blockerDialogRef,
  closeBlockerDialog,
  dispatchAndReport,
  liveBedReleases,
  nameFor,
  raise,
  selectedBlocker,
  setSelectedBlocker,
  setToastMessage,
  unit,
}: {
  item: ShiftTileItem;
  blockerDialogRef: RefObject<HTMLDivElement | null>;
  closeBlockerDialog: () => void;
  dispatchAndReport: (record: () => ReturnType<WardCommandDispatch>, success: string) => void;
  liveBedReleases: BedRelease[];
  nameFor: (admissionId: string | undefined) => string;
  raise: WardRaise;
  selectedBlocker: BedReleaseBlocker;
  setSelectedBlocker: Dispatch<SetStateAction<BedReleaseBlocker>>;
  setToastMessage: Dispatch<SetStateAction<ActionToast | null>>;
  unit: Unit;
}) {
  const [chosen, setChosen] = useState<BedReleaseBlocker | null>(null);
  // Surname first (D-83): `nameFor` gives the resolved patient's formal name.
  const who = item.who || nameFor(item.selectableKey);
  // The page's own modal-focus hook (inert page, Tab wrap, Escape) holds `blockerDialogRef`; it
  // points at the kit Dialog's panel, so that hook keeps working round the new frame.
  const panelRef = useCallback(
    (node: HTMLDivElement | null) => {
      blockerDialogRef.current = node?.closest<HTMLDivElement>('[role="dialog"]') ?? null;
    },
    [blockerDialogRef],
  );

  const confirm = () => {
    if (chosen === null) return;
    // Walkthrough D3 (25 Sept 2026): a release names its stay (owner ruling),
    // so the blocker goes on THIS person's own live release, never the ward's
    // first release or a made-up id. With none, nothing is recorded.
    const ownRelease = liveBedReleases?.find((r) => r.admissionId === item.selectableKey && r.state !== "discharged");
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
  };

  return (
    <Dialog
      open
      onClose={closeBlockerDialog}
      // Redesign: the title is the tile's own action word; the person (not the tile's label) and the
      // tile's tag move to the line under it.
      title="Record a blocker"
      description={
        <>
          <strong className={blocker.name}>{who}</strong> · {item.label}
          {item.chip ? ` · ${item.chip}` : null}
        </>
      }
      closeLabel="Close dialog"
      size="md"
      data-testid="ward-board-blocker-dialog"
    >
      <div ref={panelRef} className={blocker.body}>
        {item.text ? <p className={blocker.subject}>{item.text}</p> : null}
        <fieldset className={blocker.options}>
          <legend className={blocker.legend}>What is holding up the bed release?</legend>
          {BED_RELEASE_BLOCKERS.map((b) => (
            <Radio
              key={b}
              className={blocker.option}
              name="ward-board-blocker-reason"
              value={b}
              checked={chosen === b}
              onChange={() => {
                setChosen(b);
                setSelectedBlocker(b);
              }}
              label={b}
            />
          ))}
        </fieldset>
        {/* One footer row, as the other popups: Cancel, then the reason and the one filled button. */}
        <div className={blocker.actions}>
          <Button variant="ghost" onClick={closeBlockerDialog}>
            Cancel
          </Button>
          <Button
            variant="pri"
            disabledReason={chosen === null ? "Choose a reason first" : undefined}
            onClick={confirm}
          >
            Confirm blocker
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
