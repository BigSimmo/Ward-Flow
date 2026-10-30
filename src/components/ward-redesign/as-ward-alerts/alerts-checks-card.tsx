"use client";

// Split from this folder's alerts-redesign.tsx (line limit): the one-tap Checking card, phone and iPad portrait.
import { Activity, ChevronRight } from "lucide-react";

import styles from "@/components/ward-management/alerts/alerts.module.css";

export function ChecksCard({
  total,
  firing,
  className,
  onOpen,
}: {
  total: number;
  firing: number;
  className?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={className ? `${styles.phoneCard} ${className}` : styles.phoneCard}
      onClick={onOpen}
    >
      <Activity size={18} aria-hidden="true" />
      <span className={styles.phoneCardText}>
        <span className={styles.phoneCardTitle}>
          Checking <span className={styles.mono}>{total}</span> conditions
        </span>
        <span className={styles.phoneCardMeta}>
          <b className={styles.mono}>{firing}</b> firing · handover sheets not checked
        </span>
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  );
}
