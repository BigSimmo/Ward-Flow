"use client";

import { ChevronRight } from "lucide-react";

import { Button, Card, CardHead, StatusGlyph, durMinutes } from "@/components/wf";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";

import { isConfirmationFresh } from "./capacity-gap-words";
import type { CapacityModel } from "./capacity-model";
import { gapWords } from "./capacity-range-line";
import { ReadyByRoadTime } from "./capacity-road-time";
import { ShiftChecks } from "./capacity-shift-checks";
import styles from "./capacity-page.module.css";

/**
 * The phone's first tab: the forecast in three figures, then wards to check. The forecast starts at
 * tomorrow (Josh, 30 Oct 2026). Page tops (Josh, 9 Nov 2026): the mismatch rows are the hero's band
 * now, each cell opening the same pop-up, so this tab no longer repeats them.
 */
export function PhoneOverview({
  model,
  executive,
  onForecast,
  onWard,
  onAskWard,
  networkWide = false,
}: {
  model: CapacityModel;
  /** The executive desk opens no ward page, so Ready beds by road time lists without links. */
  executive: boolean;
  onForecast: () => void;
  onWard: (unitId: string) => void;
  /** The coordinator's "Ask" on This shift; absent for a desk that may not ask a ward. */
  onAskWard?: (unitId: string) => void;
  /** A service is chosen: the mismatch and forecast still count the whole network, and say so. */
  networkWide?: boolean;
}) {
  const { forecast, week, wardsToCheck, networkRows, roadTimeFromEdId, now } = model;
  const canOpen = useCanOpenHref();
  const [tomorrow, ...laterDays] = forecast.horizons;
  const weekOut = week.total.out.reduce((sum, value) => sum + value, 0);
  return (
    <>
      <Card aria-labelledby="phone-forecast">
        <CardHead
          id="phone-forecast"
          title="Bed forecast"
          meta={networkWide ? "Network-wide" : undefined}
          action={
            <Button size="sm" variant="ghost" iconEnd={ChevronRight} onClick={onForecast} aria-haspopup="dialog">
              Open
            </Button>
          }
        />
        <ul className={styles.phoneRows}>
          {tomorrow ? (
            <li className={styles.phoneRow}>
              <div>
                <b className={styles.small}>Tomorrow</b>
                <span className={styles.mutedXs}>
                  Range {gapWords(tomorrow.low)} to {gapWords(tomorrow.high)}
                </span>
              </div>
              <span className={`${styles.small} ${tomorrow.likely < 0 ? styles.warnInk : styles.okInk}`}>
                {gapWords(tomorrow.likely)}
              </span>
            </li>
          ) : null}
          {/* Feature 21 polish (9 Nov 2026): 48 and 72 hours read like Tomorrow (likely figure on the
              right, range under the label), muted with the hatched swatch because their dates may move. */}
          {laterDays.slice(0, 2).map((day, index) => (
            <li key={day.hours} className={styles.phoneRow}>
              <div>
                <b className={`${styles.small} ${styles.fcKpiSoftLabel}`}>
                  <span className={`${styles.fcSoftSwatch} ${styles.swHatch}`} aria-hidden="true" />
                  In {index + 2} days
                </b>
                <span className={styles.mutedXs}>
                  Range {gapWords(day.low)} to {gapWords(day.high)} · may move
                </span>
              </div>
              <span className={`${styles.small} ${styles.muted}`}>Likely {gapWords(day.likely)}</span>
            </li>
          ))}
          <li className={styles.phoneRow}>
            <div>
              <b className={styles.small}>Next 7 days</b>
              <span className={styles.mutedXs}>Beds going out</span>
            </div>
            <span className={styles.small}>{weekOut}</span>
          </li>
        </ul>
      </Card>
      <Card aria-labelledby="phone-check">
        <CardHead id="phone-check" title="Wards to check" meta={String(wardsToCheck.length)} />
        {wardsToCheck.length === 0 ? (
          <p className={styles.sideBody}>Every open ward has a ready bed and a fresh count.</p>
        ) : (
          <ul className={styles.phoneRows}>
            {wardsToCheck.slice(0, 5).map((row) => (
              <li key={row.unit.id} className={styles.phoneRow}>
                <div>
                  <b className={styles.small}>
                    <SpelledCodes text={row.unit.name} />
                  </b>
                  <span className={styles.mutedXs}>
                    {row.ready === 0 ? "No ready bed" : `${row.ready} ready`}
                    {row.pendingPreparation ? `, ${row.pendingPreparation} being made ready` : ""} · count{" "}
                    {durMinutes(Math.max(0, now - row.confirmedAt))} old
                  </span>
                </div>
                <span className={`${styles.small} ${styles.warnInk}`}>
                  <StatusGlyph tone="warning" size={9} /> {isConfirmationFresh(row.unit, now) ? "No bed" : "Stale"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ShiftChecks model={model} onAskWard={onAskWard} siteName={model.site?.name} />
      {model.site ? (
        // Site bed manager: every site's ready beds by road time, opened in the ward drawer or the
        // Other sites counts, because another site's ward page is not this desk's to open.
        <ReadyByRoadTime
          rows={[...networkRows, ...model.otherSiteRows]}
          defaultEdId={roadTimeFromEdId}
          selectedUnitId={undefined}
          onSelectUnit={onWard}
        />
      ) : (
        <ReadyByRoadTime
          rows={networkRows}
          defaultEdId={roadTimeFromEdId}
          selectedUnitId={undefined}
          onSelectUnit={() => {}}
          // Only a ward this desk may open (access audit, 31 Oct 2026); the executive opens none.
          wardHref={
            executive
              ? undefined
              : (unitId) => (canOpen(`/ward-flow/ward/${unitId}`) ? `/ward-flow/ward/${unitId}` : undefined)
          }
        />
      )}
    </>
  );
}
