"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { Button, Card, CardHead, StatusGlyph, cx, durMinutes } from "@/components/wf";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";

import type { BedKindGap } from "./capacity-derivations";
import { isConfirmationFresh } from "./capacity-gap-words";
import type { CapacityModel } from "./capacity-model";
import { shortNeed } from "./capacity-mismatch-band";
import { MismatchPopup } from "./capacity-mismatch-popup";
import { gapWords } from "./capacity-range-line";
import { ReadyByRoadTime } from "./capacity-road-time";
import { ShiftChecks } from "./capacity-shift-checks";
import styles from "./capacity-page.module.css";

/**
 * The phone's first tab: the mismatch as rows, the forecast in three figures, then wards to check.
 * The network total is the hero's line, so the mismatch lists the four bed types only and the
 * forecast starts at tomorrow (Josh, 30 Oct 2026). Stress test (3 Nov 2026): each mismatch row opens
 * the same pop-up as the desktop card, and This shift sits here as it does under the desktop bed map.
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
  const [openKind, setOpenKind] = useState<BedKindGap["id"] | null>(null);
  const { gapRows, tomorrowByKind, forecast, week, wardsToCheck, networkRows, roadTimeFromEdId, now } = model;
  const canOpen = useCanOpenHref();
  const byId = new Map(tomorrowByKind.kinds.map((kind) => [kind.id, kind]));
  const [tomorrow, twoDays] = forecast.horizons;
  const weekOut = week.total.out.reduce((sum, value) => sum + value, 0);
  const openRow = gapRows.find((row) => row.id === openKind) ?? null;
  return (
    <>
      <Card aria-labelledby="phone-mismatch" data-testid="capacity-mismatch">
        <CardHead id="phone-mismatch" title="Mismatch" meta={networkWide ? "Network-wide" : undefined} />
        <ul className={styles.phoneRows}>
          {gapRows.map((row) => {
            const likely = byId.get(row.id)?.likely;
            const title = shortNeed(row.need);
            return (
              <li key={row.id} className={styles.phoneRowItem}>
                <button
                  type="button"
                  className={cx(styles.phoneRow, styles.phoneRowButton)}
                  aria-haspopup="dialog"
                  onClick={() => setOpenKind(row.id)}
                >
                  <div>
                    <b className={styles.small}>{title}</b>
                    <span className={styles.mutedXs}>
                      {row.waiting} waiting · {row.bedsThatFit} fit
                      {likely !== undefined ? ` · tomorrow ${gapWords(likely)}` : ""}
                    </span>
                  </div>
                  <span className={`${styles.small} ${row.gap < 0 ? styles.warnInk : styles.okInk}`}>
                    <StatusGlyph tone={row.gap < 0 ? "warning" : "success"} size={9} /> {gapWords(row.gap)}
                    <ChevronRight strokeWidth={1.75} size={14} aria-hidden="true" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <MismatchPopup
          row={openRow}
          title={shortNeed(openRow?.need ?? "")}
          tomorrow={openKind ? byId.get(openKind) : undefined}
          now={now}
          onClose={() => setOpenKind(null)}
          units={model.gapUnits}
          onWard={(unitId) => {
            setOpenKind(null);
            onWard(unitId);
          }}
        />
      </Card>
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
          {twoDays ? (
            <li className={styles.phoneRow}>
              <div>
                <b className={`${styles.small} ${styles.fcKpiSoftLabel}`}>
                  <span className={`${styles.fcSoftSwatch} ${styles.swHatch}`} aria-hidden="true" />
                  In 2 days
                </b>
                <span className={styles.mutedXs}>Likely {gapWords(twoDays.likely)} · may move</span>
              </div>
              <span className={`${styles.small} ${styles.muted}`}>
                {gapWords(twoDays.low)} to {gapWords(twoDays.high)}
              </span>
            </li>
          ) : null}
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
