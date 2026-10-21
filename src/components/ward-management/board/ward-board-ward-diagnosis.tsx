"use client";

import { useState } from "react";

import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { TENTATIVE_DIAGNOSIS_BLOCKS, type TentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";

import styles from "./board.module.css";
import own from "./ward-board-ward-diagnosis.module.css";
import type { Occupant } from "./ward-board-model";

/**
 * FD-10 (owner, 29 Aug 2026): the ward records its own tentative diagnosis block beside the one the
 * stay arrived with. The other block is never changed, so this is a second record, not an edit.
 * Chosen from the eleven ICD-10-AM Chapter V blocks, never typed. Nothing prompts for it: it is a
 * correction a ward makes when it wants to, not a task.
 */
export function WardDiagnosisControl({
  occupant,
  unitId,
  raise,
  dispatchAndReport,
}: {
  occupant: Occupant;
  unitId: string;
  raise: WardRaise;
  dispatchAndReport: (record: () => ReturnType<WardCommandDispatch>, success: string, spoken: string) => void;
}) {
  const [block, setBlock] = useState<TentativeDiagnosisBlock | "">(occupant.wardDiagnosis?.block ?? "");
  const unchanged = block === "" || block === occupant.wardDiagnosis?.block;
  return (
    <form
      className={own.form}
      data-testid="ward-board-ward-diagnosis-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (block === "" || unchanged) return;
        dispatchAndReport(
          () => raise("RECORD_WARD_DIAGNOSIS", { actingUnitId: unitId, admissionId: occupant.key, block }),
          `Ward's tentative diagnosis recorded: ${block}. The diagnosis the stay arrived with is kept.`,
          "Ward's tentative diagnosis recorded.",
        );
      }}
    >
      <label className={styles.leavingLabel} htmlFor="ward-board-ward-diagnosis-select">
        Ward&apos;s tentative diagnosis
      </label>
      <select
        id="ward-board-ward-diagnosis-select"
        className={`${styles.leavingSelect} ${own.select}`}
        value={block}
        onChange={(event) => setBlock(event.target.value as TentativeDiagnosisBlock | "")}
        data-testid="ward-board-ward-diagnosis-select"
      >
        <option value="">Choose a block</option>
        {TENTATIVE_DIAGNOSIS_BLOCKS.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {`${entry.code} ${entry.label}`}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className={`${styles.detailSecondaryBtn} ${styles.fullWidthBtn}`}
        disabled={unchanged}
        data-testid="ward-board-ward-diagnosis-record"
      >
        Record the ward&apos;s diagnosis
      </button>
      <p className={styles.personLine}>Kept beside the diagnosis the stay arrived with, never in place of it.</p>
    </form>
  );
}
