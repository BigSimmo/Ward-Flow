"use client";

import type { ReactNode, RefObject } from "react";
import { Button, cx, useOptionalToast } from "@/components/wf";
import { savedAtToast } from "@/components/ward-management/ward-saved-at-toast";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import styles from "./ward-bed-dossier-drawer.module.css";
import { ChoiceChips } from "./ward-bed-dossier-bits";

const BLOCKER_CHOICES = BED_RELEASE_BLOCKERS.map((blocker) => ({ id: blocker, label: blocker }));

/**
 * The bed drawer's discharge blocker save (live test, 26 Oct 2026: a bed manager's Save closed the
 * form and sent nothing). It exists only where this desk has a handler, and the form stays open with
 * its choice until the save is accepted, saying why when it is not (audit 24-3 SV-1 to SV-4).
 */
export function useBlockerSave(
  stayKey: string | undefined,
  admissionId: string | undefined,
  onUpdateBlocker: ((admissionId: string, blocker: string | null) => ReturnType<WardCommandDispatch>) | undefined,
  setOpen: (open: boolean) => void,
) {
  const save = useWardFormSave(`blocker:${stayKey ?? ""}`);
  const toast = useOptionalToast();
  const submit =
    onUpdateBlocker && admissionId
      ? (blocker: BedReleaseBlocker | null) =>
          save.submit(
            () => onUpdateBlocker(admissionId, blocker),
            () => {
              setOpen(false);
              // a clear on-screen confirmation with the time of the save.
              savedAtToast(toast, blocker ? `Hold-up saved: ${blocker}` : "Hold-up cleared");
            },
          )
      : undefined;
  return {
    submit,
    pending: save.pending,
    setOpen: (open: boolean) => {
      if (open) save.forget();
      setOpen(open);
    },
    status: save.error ? (
      <p className={styles.meta} role="alert" data-testid="ward-blocker-error">
        {save.error}
      </p>
    ) : save.pending ? (
      <p className={styles.meta} role="status">
        Saving…
      </p>
    ) : null,
  };
}

export type BlockerSave = ReturnType<typeof useBlockerSave>;

/** Clear blocker, the reason chips with Save blocker, and the save's answer, for both layouts. */
export function BlockerEditor({
  save,
  blockReason,
  open,
  selected,
  setSelected,
  selectRef,
}: {
  save: BlockerSave;
  blockReason: string | undefined;
  open: boolean;
  selected: BedReleaseBlocker | "";
  setSelected: (blocker: BedReleaseBlocker | "") => void;
  /** The reason chips, focused when the editor opens. */
  selectRef: RefObject<HTMLDivElement | null>;
}): ReactNode {
  const submit = save.submit;
  if (!submit) return null;
  const busy = save.pending ? "true" : undefined;
  return (
    <>
      {blockReason ? (
        <div className={styles.editor}>
          <Button variant="ghost" className={styles.pill} aria-disabled={busy} onClick={() => submit(null)}>
            Clear hold-up
          </Button>
        </div>
      ) : null}
      {open ? (
        <div className={cx(styles.editor, styles.editorStack)}>
          <ChoiceChips
            label="Held up by"
            items={BLOCKER_CHOICES}
            value={selected}
            onChange={setSelected}
            groupRef={selectRef}
            testId="ward-blocker-choice"
          />
          <Button
            variant="sec"
            className={styles.pill}
            data-testid="ward-blocker-save"
            aria-disabled={busy}
            disabledReason={selected ? undefined : "Choose what is holding them up first."}
            onClick={() => {
              if (selected) submit(selected);
            }}
          >
            Save hold-up
          </Button>
        </div>
      ) : null}
      {save.status}
    </>
  );
}
