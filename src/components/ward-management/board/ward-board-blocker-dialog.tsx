"use client";

// The bed board's "Record a blocker" dialog, opened from a Needs you tile in the work band. Split
// out of ward-board-work-band.tsx; WardBoard still owns the page state and the save path.
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import type { ActionToast } from "@/components/ward-management/ward-action-toast";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import { Button, Dialog, Radio } from "@/components/wf";
import { useCallback, useState, type Dispatch, type RefObject, type SetStateAction } from "react";

import { type ShiftTileItem } from "./ward-board-model";
import blocker from "./ward-board-blocker-dialog.module.css";

/**
 * The bed board's "Record a blocker" dialog on the kit Dialog (redesign approved by Josh, 31 Oct
 * 2026), in place of the hand-built "Record a blocker for …" panel. The save is unchanged: the
 * blocker goes on this person's own live release (`BLOCK_BED_RELEASE`), or nothing is recorded.
 * No reason starts chosen: `chosen` is local, the page's `selectedBlocker` is set only on a tap, and
 * Confirm stays unavailable ("Choose a reason first") until then. Mount it per open, so no reason
 * carries over from the last one.
 */
export function WardBoardBlockerDialog({
  item,
  blockerDialogRef,
  closeBlockerDialog,
  dispatchAndReport,
  liveBedReleases,
  nameFor,
  raise,
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
      const msg = `No discharge is recorded for ${who}. Nothing was changed.`;
      setToastMessage({ warning: msg });
      announceToWardShell("No discharge is recorded for this patient. Nothing was changed.");
    } else {
      dispatchAndReport(
        () =>
          raise("BLOCK_BED_RELEASE", {
            releaseId: ownRelease.id,
            actingUnitId: unit.id,
            blocker: chosen,
          }),
        `Blocker recorded for ${who}: ${chosen}.`,
      );
    }
    closeBlockerDialog();
  };

  return (
    <Dialog
      open
      onClose={closeBlockerDialog}
      // The title is the tile's own action word; the person (not the tile's label) and the
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
