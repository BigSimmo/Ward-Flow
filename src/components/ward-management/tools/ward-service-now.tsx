"use client";

import { useMemo } from "react";

import { StatusGlyph } from "@/components/wf";
import { LegalLimitsNotChecked } from "../legal-limits-not-checked";
import { useWardFlow, useWardFlowClock } from "../ward-flow-provider";
import { standingFigures } from "../ward-standing-strip";
import { isOpen } from "../ward-derivations";
import { longestWait } from "./ward-network-figures";
import styles from "./ward-tools-sheet.module.css";

/** The standing figures a coordinator scans first, in this order. Only the two legal ones flag. */
const GLANCE_KEYS = ["ready", "waiting", "longest", "passed", "within-hour"] as const;

/**
 * Tools, Service now (Josh, 15 Oct 2026: "rapid review statistics across the service"). The
 * coordinator's standing figures across the whole network, at the top of the sheet, so a quick
 * look needs no extra tap. Every number comes from `standingFigures`, the same derivation the
 * header Figures use, so the two can never disagree. All figures (`ward-network-figures.tsx`)
 * opens the full set below it.
 */
export function WardServiceNow() {
  const { units, admissions, movements, bedReleases, leaveBeds } = useWardFlow();
  const now = useWardFlowClock();
  const figures = useMemo(() => {
    const all = standingFigures({
      units,
      admissions,
      movements,
      bedReleases,
      leaveBeds,
      now,
      chromeRole: "coordinator",
    });
    return GLANCE_KEYS.flatMap((key) =>
      key === "longest" ? [longestWait(movements.filter(isOpen), now)] : all.filter((figure) => figure.key === key),
    );
  }, [units, admissions, movements, bedReleases, leaveBeds, now]);

  return (
    <div className={styles.glance} data-testid="ward-tools-service-now">
      <dl className={styles.glanceGrid}>
        {figures.map((figure) => (
          <div key={figure.key} className={styles.glanceCell} data-flagged={figure.flagged || undefined}>
            <dt>{figure.label}</dt>
            <dd>
              <span className={styles.glanceValue}>
                {figure.flagged ? <StatusGlyph tone={figure.key === "passed" ? "danger" : "warning"} size={8} /> : null}
                {figure.value}
              </span>
              {figure.sub ? <small>{figure.sub}</small> : null}
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.glanceNote}>
        Whole network, synthetic figures. <LegalLimitsNotChecked variant="tag" />
      </p>
    </div>
  );
}
