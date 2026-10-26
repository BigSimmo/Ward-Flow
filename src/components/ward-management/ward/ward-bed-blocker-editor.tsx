"use client";

import type { ReactNode, RefObject } from "react";
import { Button } from "@/components/wf";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import styles from "./ward-bed-dossier-drawer.module.css";

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
  const submit =
    onUpdateBlocker && admissionId
      ? (blocker: BedReleaseBlocker | null) =>
          save.submit(
            () => onUpdateBlocker(admissionId, blocker),
            () => setOpen(false),
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

/** Clear blocker, the reason list with Save blocker, and the save's answer, for both layouts. */
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
  selected: BedReleaseBlocker;
  setSelected: (blocker: BedReleaseBlocker) => void;
  selectRef: RefObject<HTMLSelectElement | null>;
}): ReactNode {
  const submit = save.submit;
  if (!submit) return null;
  const busy = save.pending ? "true" : undefined;
  return (
    <>
      {blockReason ? (
        <div className={styles.editor}>
          <Button variant="ghost" className={styles.pill} aria-disabled={busy} onClick={() => submit(null)}>
            Clear blocker
          </Button>
        </div>
      ) : null}
      {open ? (
        <div className={styles.editor}>
          <select
            ref={selectRef}
            className={styles.select}
            value={selected}
            aria-label="Discharge blocker"
            onChange={(e) => setSelected(e.target.value as BedReleaseBlocker)}
          >
            {BED_RELEASE_BLOCKERS.map((blocker) => (
              <option key={blocker} value={blocker}>
                {blocker}
              </option>
            ))}
          </select>
          <Button
            variant="sec"
            className={styles.pill}
            data-testid="ward-blocker-save"
            aria-disabled={busy}
            onClick={() => submit(selected)}
          >
            Save blocker
          </Button>
        </div>
      ) : null}
      {save.status}
    </>
  );
}
