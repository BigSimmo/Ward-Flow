"use client";

/**
 * TR1 (3 Nov 2026): a delivered job in History opens its movement record, so the officer can check
 * what was handed over without searching for it.
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { StatusGlyph } from "@/components/wf";
import { movementHref } from "@/components/ward-management/shell/ward-facade";

import styles from "./officer.module.css";
import own from "./officer-history-row.module.css";

export function OfficerDeliveredRow(props: {
  movementId: string;
  time: string;
  name: string;
  umrn: string | undefined;
  destination: string;
  provider: string;
}) {
  const { movementId, time, name, umrn, destination, provider } = props;
  return (
    <li className={`${styles.plainItem} ${own.row}`}>
      <StatusGlyph tone="success" size={9} />
      <Link
        className={own.historyLink}
        href={movementHref(movementId)}
        data-testid={`ward-officer-history-${movementId}`}
      >
        <span>
          <span className={styles.mono}>{time}</span> <strong>{name}</strong>{" "}
          {umrn ? <span className={styles.mono}>{umrn}</span> : null} · {destination}{" "}
          <span className={styles.muted}>({provider})</span>
        </span>
        <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </li>
  );
}
