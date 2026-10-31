"use client";

import { useId, useState } from "react";

import { Card, CardHead, Segmented } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";

import { wardShiftSummary } from "./ward-shift-summary";
import styles from "./ward-shift-summary.module.css";

/**
 * "This shift on the ward" — the recorded-only shift summary on the Shift brief (item 16). Counts,
 * never names. Outside a provider it shows nothing, since there are no live records to count.
 */
export function WardShiftSummaryCard({ unit, now }: { unit: Pick<Unit, "id" | "name">; now: Instant }) {
  const baseId = useId();
  const [which, setWhich] = useState<"current" | "previous">("current");
  const flow = useOptionalWardFlowSelect("admissions");
  if (!flow) return null;
  const summary = wardShiftSummary({
    unit,
    admissions: flow.admissions,
    now,
    which,
  });
  const { window } = summary;
  const span = `${formatInstantWithDay(window.from, now)} to ${formatInstantWithDay(window.to, now)}`;
  const facts: { label: string; value: number; testId: string }[] = [
    { label: "Arrived on the ward", value: summary.arrived, testId: "arrived" },
    { label: "Left the ward", value: summary.left, testId: "left" },
    { label: "Beds pulled for an incoming patient", value: summary.bedsPulled, testId: "pulled" },
    { label: "Discharges confirmed", value: summary.dischargesConfirmed, testId: "confirmed" },
    // Audit TC2-12: only the latest change is kept, so this counts dates whose last change fell in
    // the shift, and says so.
    { label: "Expected dates last changed this shift", value: summary.datesMoved, testId: "dates" },
    { label: "Observation levels changed", value: summary.observationChanges, testId: "observations" },
  ];

  return (
    <Card className={styles.card} aria-labelledby={`${baseId}-shift-heading`} data-testid="ward-shift-summary">
      <CardHead
        level={3}
        eyebrow
        id={`${baseId}-shift-heading`}
        // The dialog title already names the ward.
        title={window.label}
        meta={<span data-testid="ward-shift-summary-span">{window.inProgress ? `${span}, so far` : span}</span>}
      />
      <div className={styles.toggle} data-testid="ward-shift-summary-which">
        <Segmented
          label="Which shift"
          items={[
            { id: "current", label: "This shift" },
            { id: "previous", label: "Last shift" },
          ]}
          value={which}
          onChange={setWhich}
        />
      </div>
      <dl className={styles.facts}>
        {facts.map((fact) => (
          <div key={fact.testId} data-testid={`ward-shift-summary-${fact.testId}`}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.note}>
        Counts only, from times recorded in Ward Flow during this shift. Anything done but not recorded here does not
        show.
      </p>
    </Card>
  );
}
