"use client";

import { CircleHelp } from "lucide-react";

import { Card, CardHead, buttonClass } from "@/components/wf";

import { clearHelpFeedback, useHelpFeedback } from "./ward-help-feedback";
import { HOW_TOS, HOW_TO_IDS } from "./ward-help-howto";
import { clearHelpUsed, useHelpUsed } from "./ward-help-usage";
import styles from "./ward-help-usage-card.module.css";

const SHOWN = 8;

/**
 * Settings, Data: the Ask help answers used most on this device (`ward-help-usage.ts`), so the team
 * can see what staff look up, with each answer's "Was this helpful?" yes and no counts
 * (`ward-help-feedback.ts`). Answer titles and counts only; what anyone typed is never kept.
 */
export function WardHelpUsageCard() {
  const used = useHelpUsed(HOW_TO_IDS);
  const feedback = useHelpFeedback(HOW_TO_IDS);
  const titles = new Map(HOW_TOS.map((howTo) => [howTo.id, howTo.title]));
  return (
    <Card aria-labelledby="help-usage-title" data-testid="ward-settings-help-usage">
      <CardHead
        iconPlain
        id="help-usage-title"
        icon={CircleHelp}
        title="Help answers used on this device"
        action={
          used.length ? (
            <button
              type="button"
              className={buttonClass({ variant: "ghost", size: "sm" })}
              onClick={() => {
                clearHelpUsed();
                clearHelpFeedback();
              }}
              data-testid="ward-settings-help-usage-clear"
            >
              Clear
            </button>
          ) : undefined
        }
      />
      {used.length ? (
        <ol className={styles.list}>
          {used.slice(0, SHOWN).map((entry) => (
            <li key={entry.id} className={styles.row}>
              <span>
                {titles.get(entry.id)}
                {feedback.has(entry.id) ? (
                  <span className={styles.helpful} data-testid="ward-settings-help-usage-helpful">
                    Helpful {feedback.get(entry.id)!.yes}, not helpful {feedback.get(entry.id)!.no}
                  </span>
                ) : null}
              </span>
              <strong className={styles.count}>{entry.count}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.empty}>No answers used yet.</p>
      )}
      <p className={styles.note}>
        Counts an answer when it is opened, or its Show me or Go there is pressed, and each Was this helpful? answer.
        What anyone typed is never kept.
      </p>
    </Card>
  );
}
