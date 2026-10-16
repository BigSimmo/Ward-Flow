"use client";

import { useState } from "react";
import { Badge, Button, Checkbox } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  criteriaEligibilityRefusal,
  DISCHARGE_CRITERIA,
  dischargeCriteriaStatus,
  type CriteriaEligibility,
  type DischargeCriteriaRecord,
  type DischargeCriterion,
} from "@/components/ward-management/ward-discharge-criteria";
import drawerStyles from "./ward-bed-dossier-drawer.module.css";
import styles from "./ward-discharge-criteria-card.module.css";

export type DischargeCriteriaUpdate = {
  criteria: DischargeCriterion[] | null;
  met: DischargeCriterion[];
  /** A single tick or untick, applied to the criteria as they stand when the event is handled. */
  toggle?: { criterion: DischargeCriterion; met: boolean };
  setByTreatingPsychiatrist: boolean;
};

/**
 * Criteria led discharge on the bed panel's Plan to leave tab (Top 25 item 9, D-60, flag
 * `top25-criteria-led-discharge`). The ward records the criteria the treating psychiatrist set,
 * ticks them as they are met, and sees when the discharge can go ahead without another review.
 * Only a patient recorded as voluntary can have criteria. `onChange` is absent when the desk cannot
 * record criteria.
 */
export function WardDischargeCriteriaCard({
  record,
  eligibility,
  now,
  onChange,
}: {
  record: DischargeCriteriaRecord | null | undefined;
  eligibility: CriteriaEligibility;
  now: Instant;
  onChange?: (update: DischargeCriteriaUpdate) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [chosen, setChosen] = useState<DischargeCriterion[]>([]);
  const [attested, setAttested] = useState(false);
  const status = dischargeCriteriaStatus(record, eligibility, now);
  const ineligible = criteriaEligibilityRefusal(eligibility);
  const items = record?.items ?? [];
  const metList = items.filter((item) => item.metAt !== null).map((item) => item.criterion);

  const openEditor = () => {
    setChosen(items.map((item) => item.criterion));
    setAttested(false);
    setEditing(true);
  };

  const summary = (() => {
    switch (status.kind) {
      case "none":
        return ineligible ?? "No criteria set by the treating psychiatrist.";
      case "paused":
        return `Paused. ${ineligible ?? ""}`;
      case "lapsed":
        return "These criteria have lapsed. Ask the treating psychiatrist to review them before discharge.";
      case "in_progress":
        return `${status.met} of ${status.total} met. Review needed after ${formatInstantWithDay(status.lapsesAt, now)}.`;
      case "all_met":
        return "All criteria met. The ward can confirm the discharge without waiting for the next review.";
    }
  })();

  const canTick = onChange !== undefined && (status.kind === "in_progress" || status.kind === "all_met");
  const toggleMet = (criterion: DischargeCriterion, met: boolean) => {
    onChange?.({
      criteria: items.map((item) => item.criterion),
      met: met ? [...metList, criterion] : metList.filter((entry) => entry !== criterion),
      toggle: { criterion, met },
      setByTreatingPsychiatrist: false,
    });
  };

  return (
    <section className={drawerStyles.card} data-testid="ward-drawer-discharge-criteria">
      <h3 className={drawerStyles.cardTitle}>Criteria led discharge</h3>
      <div className={styles.body}>
        <p className={styles.summary} data-testid="ward-drawer-criteria-status">
          {status.kind === "all_met" ? (
            <Badge tone="success" size="sm">
              Ready
            </Badge>
          ) : status.kind === "lapsed" || status.kind === "paused" ? (
            <Badge tone="warning" size="sm">
              {status.kind === "lapsed" ? "Review" : "Paused"}
            </Badge>
          ) : null}
          <span>{summary}</span>
        </p>
        {eligibility === "voluntary" ? <p className={styles.hint}>Legal status recorded as voluntary.</p> : null}

        {!editing && items.length > 0 ? (
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.criterion}>
                {canTick ? (
                  <Checkbox
                    label={item.criterion}
                    className={styles.touchTarget}
                    checked={item.metAt !== null}
                    onChange={(event) => toggleMet(item.criterion, event.target.checked)}
                  />
                ) : (
                  <span className={styles.readOnly}>
                    {item.criterion}{" "}
                    <Badge size="sm" tone={item.metAt !== null ? "success" : "neutral"}>
                      {item.metAt !== null ? "Met" : "Not met"}
                    </Badge>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {editing && onChange ? (
          <fieldset className={styles.editor}>
            <legend className={styles.legend}>Criteria the treating psychiatrist set</legend>
            {DISCHARGE_CRITERIA.map((criterion) => (
              <Checkbox
                key={criterion}
                label={criterion}
                className={styles.touchTarget}
                checked={chosen.includes(criterion)}
                onChange={(event) =>
                  setChosen((current) =>
                    event.target.checked
                      ? DISCHARGE_CRITERIA.filter((entry) => entry === criterion || current.includes(entry))
                      : current.filter((entry) => entry !== criterion),
                  )
                }
              />
            ))}
            <Checkbox
              label="Set by the treating psychiatrist"
              className={styles.touchTarget}
              checked={attested}
              onChange={(event) => setAttested(event.target.checked)}
            />
            <div className={styles.actions}>
              <Button
                className={styles.touchTarget}
                variant="sec"
                disabled={chosen.length === 0 || !attested}
                onClick={() => {
                  onChange({
                    criteria: chosen,
                    met: metList.filter((criterion) => chosen.includes(criterion)),
                    setByTreatingPsychiatrist: true,
                  });
                  setEditing(false);
                }}
              >
                Save criteria
              </Button>
              <Button className={styles.touchTarget} variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
            {chosen.length === 0 || !attested ? (
              <p className={styles.hint}>
                Choose at least one criterion and confirm the treating psychiatrist set them.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {!editing && onChange ? (
          <div className={styles.actions}>
            {ineligible === null ? (
              <Button className={styles.touchTarget} variant="sec" onClick={openEditor}>
                {items.length === 0 ? "Set criteria" : status.kind === "lapsed" ? "Review criteria" : "Change criteria"}
              </Button>
            ) : null}
            {items.length > 0 ? (
              <Button
                className={styles.touchTarget}
                variant="ghost"
                onClick={() => onChange({ criteria: null, met: [], setByTreatingPsychiatrist: false })}
              >
                Clear criteria
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
