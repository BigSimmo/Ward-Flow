"use client";

import { Check } from "lucide-react";

import { Button, CountCircle, cx } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "./settings-layout.module.css";

/**
 * The redesign's sticky save bar: what is unsaved, Discard and Save rules. Round 3: Full audit moved to
 * the last-change line at the top of Rules (one place), the change list wraps, and Save opens the review.
 * Simplify Settings (Josh, 8 Nov 2026): the bar shows only while a rule is unsaved, so there are no
 * greyed Discard and Save buttons on a page with nothing to save. The last save is the line at the top
 * of Rules.
 */
export function SettingsSaveBar({
  diffs,
  onRulesTab,
  onReview,
  saving,
  blockReason,
  onDiscard,
  onSave,
}: {
  diffs: readonly string[];
  onRulesTab: boolean;
  onReview: () => void;
  saving: boolean;
  blockReason: string | undefined;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const unsavedCount = diffs.length;
  if (unsavedCount === 0) return null;
  return (
    <div
      className={cx(styles.saveBar, rx.saveBar)}
      role="region"
      data-wf-foot-bar=""
      aria-label="Unsaved rule changes"
      data-testid="unsaved-draft-inspector"
    >
      <span className={rx.saveCount}>
        <CountCircle n={unsavedCount} label="unsaved" />
        {unsavedCount === 1 ? "unsaved change" : "unsaved changes"}
      </span>
      <span className={cx(styles.saveText, rx.wrapText)}>{diffs.join(", ")}</span>
      {!onRulesTab ? (
        <button type="button" className={styles.saveLink} onClick={onReview}>
          Review
        </button>
      ) : null}
      <Button
        variant="sec"
        size="sm"
        className={styles.pill}
        reasonDisplay="tooltip"
        onClick={onDiscard}
        disabledReason={saving ? "Saving the rule change." : undefined}
        data-testid="btn-discard-draft"
      >
        Discard
      </Button>
      <Button
        variant="pri"
        size="sm"
        icon={Check}
        className={styles.pill}
        reasonDisplay="tooltip"
        onClick={onSave}
        disabledReason={blockReason ?? (saving ? "Saving the rule change." : undefined)}
        data-testid="btn-save-draft"
      >
        {saving ? "Saving…" : unsavedCount === 1 ? "Save 1 change" : `Save ${unsavedCount} changes`}
      </Button>
    </div>
  );
}
