"use client";

// Wave 4 H10 (notes item 5, A5-21(c)): the phone act-now row for an accepted referral. Tapping the
// name opens the patient; Pull the bed is its own full 48 px placement button under the lines. Tags
// and lines wrap, never "…"; the age sits top right.

import Link from "next/link";

import alertStyles from "@/components/ward-management/alerts/alerts.module.css";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { Badge, Button, StatusGlyph } from "@/components/wf";

import styles from "./accepted-pull-phone-row.module.css";

export function AcceptedPullPhoneRow({
  data,
  selected,
  name,
  umrn,
  patientId,
  line,
  age,
  ageNote,
  openLabel,
  onPull,
}: {
  data: Record<string, string | undefined>;
  selected: boolean;
  name: string;
  umrn: string;
  /** The person's record; absent when the referral names no patient yet (the name is then plain). */
  patientId: string | undefined;
  line: string;
  age: string | undefined;
  ageNote: string;
  openLabel: string;
  onPull: () => void;
}) {
  return (
    <li className={styles.row} data-act="true" data-selected={selected ? "true" : undefined} {...data}>
      <span className={styles.glyph}>
        <StatusGlyph tone="danger" />
      </span>
      <span className={styles.main}>
        <span className={styles.head}>
          <span className={styles.who}>
            {patientId === undefined ? (
              <strong className={styles.name}>{name}</strong>
            ) : (
              <Link href={patientHref(patientId)} className={styles.name}>
                {name}
              </Link>
            )}{" "}
            <span className={alertStyles.umrn}>{umrn}</span>
          </span>
          <span className={styles.age}>
            {age === undefined ? null : <b className={styles.mono}>{age}</b>} {ageNote}
          </span>
        </span>
        <Badge size="sm" className={styles.tag}>
          Accepted, bed not pulled
        </Badge>
        <span className={styles.line}>{line}</span>
        <span className={styles.action}>
          <Button
            variant="pri"
            data-placement-action
            aria-current={selected ? "true" : undefined}
            aria-label={openLabel}
            onClick={onPull}
          >
            Pull the bed
          </Button>
        </span>
      </span>
    </li>
  );
}
