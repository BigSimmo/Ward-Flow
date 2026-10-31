"use client";
// Settings round 3 (mock-up, 30 Oct 2026): Save rules opens this short review first. Each change
// says before and after, where it shows, and what it reaches on today's records where the app has a
// predicate for it. A loaded rules file lands here too, so a file never changes a rule unseen.

import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardConfiguration } from "@/components/ward-management/ward-configuration";
import type { Movement } from "@/components/ward-management/ward-model";
import { Dialog, SrOnly, StatusGlyph } from "@/components/wf";

import rx from "./settings-layout.module.css";
import { ruleChanges } from "./settings-rule-catalogue";
import { IMPACT_NOUNS, impactText, ruleImpact } from "./settings-rule-impact";

/** "Home, ED, Movements" reads "Home, ED and Movements". */
function pageList(pages: string): string {
  const list = pages.split(",").map((page) => page.trim());
  const last = list.pop();
  return list.length ? `${list.join(", ")} and ${last}` : (last ?? "");
}

export function SettingsReviewDialog({
  open,
  onClose,
  base,
  draft,
  movements,
  now,
  fromFile,
  saving,
  blockReason,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  /** The saved rules the draft started from. */
  base: WardConfiguration;
  draft: WardConfiguration;
  movements: readonly Movement[] | null;
  now: Instant;
  /** The draft came from a loaded rules file. */
  fromFile: boolean;
  saving: boolean;
  blockReason: string | undefined;
  onSave: () => void;
}) {
  const changes = ruleChanges(base, draft);
  const count = changes.length;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={count === 1 ? "Save 1 rule change?" : `Save ${count} rule changes?`}
      description={
        fromFile
          ? "From the rules file you loaded. Nothing changes until you save. Each save is recorded in the audit."
          : "Every screen that reads these rules changes when you save. Each save is recorded in the audit."
      }
      primary={{
        label: saving ? "Saving…" : count === 1 ? "Save change" : "Save changes",
        onAction: onSave,
        loading: saving,
        disabledReason: blockReason ?? (count === 0 ? "No rule has changed." : undefined),
      }}
      secondary={[{ label: "Keep editing", onAction: onClose }]}
    >
      {count === 0 ? (
        <p className={rx.calmLine}>
          <StatusGlyph tone="success" size={9} />
          {fromFile ? "The file holds the rules already saved." : "No rule has changed."}
        </p>
      ) : (
        <ul className={rx.reviewList} data-testid="ward-settings-review">
          {changes.map(({ entry, before, after }) => {
            const impactBefore = movements ? ruleImpact(entry.key, movements, now, base) : null;
            const impactAfter = movements ? ruleImpact(entry.key, movements, now, draft) : null;
            const noun = IMPACT_NOUNS[entry.key] ?? null;
            return (
              <li key={entry.key} className={rx.reviewRow}>
                <span className={rx.reviewName}>{entry.label}</span>
                <span className={rx.reviewValues}>
                  <span className={rx.reviewBefore}>{entry.display(before)}</span>
                  <span aria-hidden="true">→</span>
                  <SrOnly> to </SrOnly>
                  <strong>{entry.display(after)}</strong>
                </span>
                <span className={rx.reviewMeta}>
                  Shown on {pageList(entry.shownOn)}
                  {impactBefore && impactAfter
                    ? ` · ${impactText(impactAfter, noun)} after saving, ${impactBefore.count} now`
                    : entry.key === "hold"
                      ? " · applies from the next pull"
                      : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
