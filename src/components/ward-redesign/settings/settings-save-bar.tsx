"use client";

import { Check } from "lucide-react";

import { Button, CountCircle, StatusGlyph, cx } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "./settings-redesign.module.css";

/**
 * The redesign's sticky save bar: what is unsaved, Discard and Save rules. Round 3: Full audit moved to
 * the last-change line at the top of Rules (one place), the change list wraps, and Save opens the review. With nothing
 * unsaved it says so and names the last save; Discard and Save are greyed (not dashed) with their
 * reason on hover and for screen readers.
 */
export function SettingsSaveBar({
  diffs,
  onRulesTab,
  onReview,
  lastSave,
  saving,
  blockReason,
  onDiscard,
  onSave,
}: {
  diffs: readonly string[];
  onRulesTab: boolean;
  onReview: () => void;
  lastSave: string;
  saving: boolean;
  blockReason: string | undefined;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const unsavedCount = diffs.length;
  const dirty = unsavedCount > 0;
  return (
    <div
      className={cx(styles.saveBar, rx.saveBar)}
      role="region"
      aria-label={dirty ? "Unsaved rule changes" : "Rule changes"}
      data-testid={dirty ? "unsaved-draft-inspector" : "ward-settings-save-bar"}
    >
      {dirty ? (
        <>
          <span className={rx.saveCount}>
            <CountCircle n={unsavedCount} label="unsaved" />
            {unsavedCount === 1 ? "unsaved change" : "unsaved changes"}
          </span>
          <span className={cx(styles.saveText, rx.wrapText)}>{diffs.join(", ")}</span>
        </>
      ) : (
        <span className={cx(styles.saveText, rx.saveClean)}>
          <StatusGlyph tone="success" size={9} />
          No unsaved changes
          <span className={rx.saveMeta}>{lastSave}</span>
        </span>
      )}
      {dirty && !onRulesTab ? (
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
        disabledReason={dirty ? (saving ? "Saving the rule change." : undefined) : "Nothing to discard."}
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
        disabledReason={
          blockReason ?? (saving ? "Saving the rule change." : dirty ? undefined : "No rule has changed.")
        }
        data-testid="btn-save-draft"
      >
        {saving ? "Saving…" : unsavedCount > 1 ? `Save ${unsavedCount} rules` : "Save rules"}
      </Button>
    </div>
  );
}
