"use client";

import { Badge, Segmented } from "@/components/wf";
import {
  DISCHARGE_CHECK_STATE_LABELS,
  DISCHARGE_CHECK_STATES,
  dischargeChecklistTally,
  type DischargeCheckItem,
  type DischargeChecklistRow,
  type DischargeCheckState,
} from "@/components/ward-management/ward-discharge-checklist";
import drawerStyles from "./ward-bed-dossier-drawer.module.css";
import styles from "./ward-discharge-checklist-card.module.css";

const STATE_ITEMS = DISCHARGE_CHECK_STATES.map((id) => ({ id, label: DISCHARGE_CHECK_STATE_LABELS[id] }));

/**
 * Feature 37 (9 Nov 2026): the discharge checklist on the bed drawer's Leaving tab. Four items, each
 * done, not needed or outstanding. Advisory: it never stops "Record that they have left". The
 * follow-up and medicines items show what the discharge list already says until the ward ticks them.
 * `onRecord` is absent when this desk cannot tick: the states then read only.
 */
export function WardDischargeChecklistCard({
  rows,
  onRecord,
}: {
  rows: readonly DischargeChecklistRow[];
  onRecord?: (item: DischargeCheckItem, state: DischargeCheckState) => void;
}) {
  const { settled, total } = dischargeChecklistTally(rows);
  return (
    <section className={drawerStyles.card} data-testid="ward-drawer-discharge-checklist">
      <h3 className={drawerStyles.cardTitle}>Discharge checklist</h3>
      <div className={styles.body}>
        <p className={styles.tally} data-testid="ward-drawer-checklist-tally">
          <span className={styles.figure}>
            {settled} of {total}
          </span>{" "}
          settled. It does not stop the discharge.
        </p>
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.item} className={styles.item} data-testid={`ward-drawer-check-${row.item}`}>
              <span className={styles.text}>
                <span className={styles.label}>{row.label}</span>
                <span className={styles.detail}>{row.detail}</span>
              </span>
              {onRecord ? (
                <Segmented
                  label={row.label}
                  size="sm"
                  items={STATE_ITEMS}
                  value={row.state}
                  onChange={(state) => {
                    if (state !== row.state || row.source !== "ticked") onRecord(row.item, state);
                  }}
                />
              ) : (
                <Badge size="sm" tone={row.state === "outstanding" ? "warning" : "neutral"}>
                  {DISCHARGE_CHECK_STATE_LABELS[row.state]}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
