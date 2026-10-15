"use client";

// Phone (v10) Capacity Overview, under the mismatch list: "Needs you" (the wards whose bed count is
// stale, oldest first), then two rows that open the bed forecast and today's discharges as sheets.
// Rendered only on phone; the larger screen keeps the network aside these rows stand in for.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ChevronRight, Clock, DoorOpen } from "lucide-react";

import type { Instant } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import { PhoneSheet, StatusGlyph, durMinutes } from "@/components/wf";

import type { NetworkWardRow } from "./capacity-derivations";
import type { BedsForecast } from "./beds-forecast";
import { BedsForecastPanel } from "./beds-forecast-panel";
import styles from "./capacity.module.css";

const NEEDS_YOU_LIMIT = 4;

export function CapacityPhoneOverview({
  rows,
  isFresh,
  now,
  forecast,
  freeingTracked,
  totalFreeing,
  freeingWards,
}: {
  rows: NetworkWardRow[];
  isFresh: (unit: Unit) => boolean;
  now: Instant;
  forecast: BedsForecast;
  freeingTracked: boolean;
  totalFreeing: number;
  freeingWards: NetworkWardRow[];
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<"forecast" | "freeing" | null>(null);
  // Stale counts first, oldest first; then wards with no ready bed.
  const stale = rows.filter((row) => !isFresh(row.unit)).sort((a, b) => a.confirmedAt - b.confirmedAt);
  const noBed = rows.filter((row) => isFresh(row.unit) && row.ready === 0);
  const needing = [...stale, ...noBed];
  const needsYou = needing.slice(0, NEEDS_YOU_LIMIT);
  const tomorrow = forecast.horizons[0];

  return (
    <div className={styles.phoneOverview}>
      <p className={styles.phoneDotKey} data-testid="capacity-phone-dot-key">
        <StatusGlyph tone="warning" size={9} />
        <span>Amber dot: short of beds, or no ready bed.</span>
        <Clock size={12} aria-hidden="true" className={styles.phoneStaleIcon} />
        <span>Stale: count not confirmed in time.</span>
      </p>
      <section aria-labelledby="capacity-phone-needs-you">
        <h2 id="capacity-phone-needs-you" className={styles.phoneOverviewHead}>
          <span>Needs you</span>
          <span className={styles.phoneOverviewCount}>
            {needsYou.length} of {needing.length}
          </span>
        </h2>
        {needsYou.length === 0 ? (
          <p className={styles.phoneOverviewEmpty}>Every ward has a recent count and a ready bed.</p>
        ) : (
          <ul className={styles.phoneOverviewList}>
            {needsYou.map((row) => (
              <li key={row.unit.id}>
                <button
                  type="button"
                  className={styles.phoneWardRow}
                  onClick={() => router.push(unitHref(row.unit.id))}
                >
                  <span className={styles.phoneWardText}>
                    <span className={styles.phoneWardName}>{row.unit.name}</span>
                    <span className={styles.phoneWardSub}>
                      <span>
                        {row.ready === 0 ? "No ready bed, count " : "Bed count "}
                        {durMinutes(Math.max(0, now - row.confirmedAt))} old
                        {(row.pendingPreparation ?? 0) > 0 ? ` · ${row.pendingPreparation} still being made ready` : ""}
                      </span>
                    </span>
                  </span>
                  {/* Phone review F-25: a stale count takes a clock, so it never reads as "Short". */}
                  <span className={styles.phoneOverviewTag}>
                    {isFresh(row.unit) ? (
                      <StatusGlyph tone="warning" size={9} />
                    ) : (
                      <Clock size={12} aria-hidden="true" className={styles.phoneStaleIcon} />
                    )}
                    {isFresh(row.unit) ? "No bed" : "Stale"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" className={styles.phoneLinkRow} aria-haspopup="dialog" onClick={() => setSheet("forecast")}>
        <Activity size={18} aria-hidden="true" />
        <span className={styles.phoneWardText}>
          <span className={styles.phoneWardName}>Bed forecast</span>
          <span className={styles.phoneWardSub}>
            {/* Device audit option A: "About 13 fewer beds ready tomorrow", never a negative count. */}
            {tomorrow
              ? tomorrow.likely < 0
                ? `About ${Math.abs(tomorrow.likely)} fewer beds ready tomorrow`
                : `About ${tomorrow.likely} more beds ready tomorrow`
              : "Forecast not available"}
          </span>
        </span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>

      <button type="button" className={styles.phoneLinkRow} aria-haspopup="dialog" onClick={() => setSheet("freeing")}>
        <DoorOpen size={18} aria-hidden="true" />
        <span className={styles.phoneWardText}>
          <span className={styles.phoneWardName}>Due out today</span>
          <span className={styles.phoneWardSub}>
            {freeingTracked
              ? `${totalFreeing} freeing across ${freeingWards.length} ${freeingWards.length === 1 ? "ward" : "wards"}`
              : "Not tracked here"}
          </span>
        </span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>

      <PhoneSheet
        open={sheet === "forecast"}
        onClose={() => setSheet(null)}
        title="Bed forecast"
        description="Whole network, estimate"
      >
        <BedsForecastPanel forecast={forecast} />
      </PhoneSheet>

      <PhoneSheet
        open={sheet === "freeing"}
        onClose={() => setSheet(null)}
        title="Due out today"
        description={freeingTracked ? `${totalFreeing} beds freeing today` : "Not tracked here"}
        primary={{ label: "Open discharges", onAction: () => router.push("/mockups/ward-flow/discharges") }}
      >
        {freeingWards.length === 0 ? (
          <p className={styles.phoneOverviewEmpty}>No ward reports a bed freeing today.</p>
        ) : (
          <ul className={styles.phoneOverviewList}>
            {freeingWards.map((row) => (
              <li key={row.unit.id}>
                <button
                  type="button"
                  className={styles.phoneWardRow}
                  onClick={() => router.push(unitHref(row.unit.id))}
                >
                  <span className={styles.phoneWardText}>
                    <span className={styles.phoneWardName}>{row.unit.name}</span>
                  </span>
                  <span className={styles.phoneOverviewTag}>{row.freeing} freeing</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PhoneSheet>
    </div>
  );
}
