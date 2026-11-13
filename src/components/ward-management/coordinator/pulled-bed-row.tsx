"use client";

// Wave 4 H5 (ruling item 3, D-191): after a pull the row stays in place for the Undo window, marked
// done, with a quiet "Undo pull · until HH:MM". Drawn with Home's own row classes so it sits in the
// list like its neighbours.

import alertStyles from "@/components/ward-management/alerts/alerts.module.css";
import { clockText, pullUndoUntil, type PulledBed } from "@/components/ward-management/referrals/pull-bed-facts";
import { PULLED_ROW_ATTRIBUTE } from "@/components/ward-management/referrals/pull-bed-step";
import { ORIGIN_NOT_RECORDED } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { Button, StatusGlyph } from "@/components/wf";

import styles from "./home-list.module.css";

export function PulledBedRow({
  pulled,
  phone,
  onUndo,
}: {
  pulled: PulledBed;
  phone: boolean;
  onUndo: (pulled: PulledBed) => void;
}) {
  const patientOf = usePatientOf();
  const { referral, unitName } = pulled.entry;
  const umrn = patientOf(referral).umrn;
  const until = clockText(pullUndoUntil(pulled));
  const tag = `Bed pulled at ${unitName}`;
  const line = `Movement started · ${referral.originSiteCode ?? ORIGIN_NOT_RECORDED} to ${unitName}`;
  const undo = (
    <Button
      size="sm"
      variant="ghost"
      aria-label={`Undo pull for ${pulled.name}, until ${until}`}
      onClick={() => onUndo(pulled)}
      data-testid="pulled-row-undo"
    >
      {`Undo pull · until ${until}`}
    </Button>
  );
  const data = {
    [PULLED_ROW_ATTRIBUTE]: referral.id,
    "data-referral-id": referral.id,
    "data-pull-unit-id": pulled.entry.unitId,
    "data-state": "pulled",
  };
  return phone ? (
    <li className={`${alertStyles.phoneRow} ${styles.compactRow}`} {...data}>
      <span className={alertStyles.phoneRowGlyph}>
        <StatusGlyph tone="success" />
      </span>
      <span className={`${alertStyles.phoneRowText} ${styles.compactText}`}>
        <span className={`${alertStyles.phoneRowLine} ${styles.compactWho}`}>
          <span className={alertStyles.who}>
            <strong className={alertStyles.name}>{pulled.name}</strong>{" "}
            <strong className={alertStyles.umrn}>{umrn}</strong>
          </span>
        </span>
        <span className={`${alertStyles.phoneRowLine} ${styles.compactWhere}`}>{tag}</span>
        <span className={`${alertStyles.phoneRowLine} ${styles.compactLine}`}>{line}</span>
      </span>
      <span className={`${alertStyles.phoneRowEnd} ${styles.compactEnd}`}>
        <span className={alertStyles.phoneRowAge}>{`${clockText(pulled.at)} pulled`}</span>
        <span className={styles.phoneRowAction}>{undo}</span>
      </span>
    </li>
  ) : (
    <li className={`${styles.hrow} ${styles.hrowStacked}`} {...data}>
      <span className={styles.hrowGlyph}>
        <StatusGlyph tone="success" />
      </span>
      <span className={styles.hrowMain}>
        <span className={styles.hrowWho}>
          <strong className={styles.hrowName}>{pulled.name}</strong> <span className={styles.hrowUmrn}>{umrn}</span>
        </span>
        <span className={styles.hrowTitle}>{tag}</span>
        <span className={styles.hrowLine}>{line}</span>
      </span>
      <span className={styles.hrowEnd}>
        <span className={styles.hrowAge}>
          <span className={styles.mono}>{clockText(pulled.at)}</span>
          <span>pulled</span>
        </span>
        <span className={styles.hrowAction}>{undo}</span>
      </span>
    </li>
  );
}
