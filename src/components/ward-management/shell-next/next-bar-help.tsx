"use client";

import { CircleHelp } from "lucide-react";

import { useWardHelpRow } from "@/components/ward-management/help/ward-help-link";
import styles from "@/components/ward-management/shell/ward-bar.module.css";
import polish from "@/components/ward-management/shell-next/next-bar.module.css";

/**
 * Help beside the header search (Josh, 15 Nov 2026, D-244): one tap opens Help at How do I…, as the
 * rail's Help row does, on every width, so phones and tablets (no rail) find it in the header too.
 * An icon on the drawer buttons' face; its name is "Help" (or "Help, new" until the tour is seen).
 * Used by the shared bar (`next-bar.tsx`) and the executive desk's bar (`ward-executive-chrome.tsx`).
 */
export function WardBarHelpButton() {
  const help = useWardHelpRow();
  return (
    <button
      type="button"
      className={`${styles.drawerTrigger} ${polish.helpBeside}`}
      data-testid="ward-bar-help-trigger"
      aria-haspopup="dialog"
      aria-label={help.label}
      onClick={help.open}
    >
      <CircleHelp className={styles.triggerIcon} aria-hidden="true" strokeWidth={1.75} />
      {help.isNew ? (
        <span className={`${styles.unread} ${polish.helpNewDot}`} aria-hidden="true" data-testid="ward-bar-help-new" />
      ) : null}
    </button>
  );
}
