"use client";

import { useId } from "react";
import { ChevronRight } from "lucide-react";

import { Card, CardHead } from "@/components/wf";
import { BedSquares, bedSquaresTag } from "@/components/ward-management/bed-squares/bed-squares";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { closedBedsPastReview } from "@/components/ward-management/ward-bed-closure-review";
import type { BedRelease } from "@/components/ward-management/ward-model";

import { isConfirmationFresh } from "./capacity-gap-words";
import { wardExtras, wardNotes, wardSquareCounts } from "./capacity-bed-map-cards";
import { ForecastCard } from "./capacity-forecast-card";
import { HeldUpCard } from "./capacity-held-up-rail";
import { ReadyByRoadTime } from "./capacity-road-time";
import type { CapacityModel } from "./capacity-model";
import styles from "./capacity-page.module.css";

/**
 * The phone's Overview (wave 4, notes item 6, D-191): three cards. Held up · by tomorrow first, then
 * Wards to check · now (no ready bed, a stale count, or a closed bed past review) in the bed-squares
 * phone form, then the Forecast. This shift, Closed beds, Intake windows and Nearest ready beds left
 * the phone Overview: a closed bed past review and tonight's intake hours are on each ward's note
 * line, and the Wards tab holds every ward.
 */
export function PhoneOverview({
  model,
  executive,
  heldUpReleases,
  onForecast,
  onWard,
  onAskWard,
  onAllWards,
  networkWide = false,
}: {
  model: CapacityModel;
  /** The executive desk sees bed counts only: no held-up names. */
  executive: boolean;
  /** The bed releases the held-up card reads, already narrowed to the wards shown. */
  heldUpReleases: readonly BedRelease[];
  onForecast: () => void;
  onWard: (unitId: string) => void;
  onAskWard?: (unitId: string) => void;
  /** Shows every ward (the Wards tab). */
  onAllWards?: () => void;
  /** A service is chosen: the forecast still counts the whole network, and says so. */
  networkWide?: boolean;
}) {
  const { wardsToCheck, networkRows, mapGroups, now } = model;
  const wardOf = new Map(mapGroups.flatMap((group) => group.wards).map((ward) => [ward.unit.id, ward]));
  const rowOf = new Map(networkRows.map((row) => [row.unit.id, row]));
  const units = networkRows.map((row) => row.unit);
  const pastReview = new Set(closedBedsPastReview(units, now).map(({ unit }) => unit.id));
  const checkIds = new Set([...wardsToCheck.map((row) => row.unit.id), ...pastReview]);
  const toCheck = networkRows.filter((row) => checkIds.has(row.unit.id));
  const extras = wardExtras(units, model.bedReleases ?? [], now);
  const detailIdBase = useId();
  return (
    <div className={styles.phoneOverview}>
      {executive ? null : <HeldUpCard releases={heldUpReleases} now={now} />}
      <Card aria-labelledby="phone-check" data-testid="capacity-wards-to-check">
        {/* PR E swap: WindowWord for the "· window" count title. */}
        <CardHead
          id="phone-check"
          title={
            <span className={styles.countTitle}>
              <b className={styles.countN}>{toCheck.length}</b> Wards to check{" "}
              <span className={styles.countWin}>· now</span>
            </span>
          }
        />
        {toCheck.length === 0 ? (
          <p className={styles.railEmpty}>Every open ward has a ready bed and a fresh count.</p>
        ) : (
          <ul className={styles.railRows}>
            {toCheck.slice(0, 8).map((row) => {
              const ward = wardOf.get(row.unit.id);
              const stale = !isConfirmationFresh(row.unit, now);
              return (
                <li key={row.unit.id}>
                  <button
                    type="button"
                    className={`${styles.wardCard} ${styles.wardTile}`}
                    aria-haspopup="dialog"
                    // FA-4: a short spoken name; the figures and note line are its description.
                    aria-label={`Open ${row.unit.name}`}
                    aria-describedby={ward ? `${detailIdBase}-${row.unit.id}` : undefined}
                    data-testid={`capacity-check-ward-${row.unit.id}`}
                    data-stale={stale ? "" : undefined}
                    onClick={() => onWard(row.unit.id)}
                  >
                    <span className={styles.wardName}>
                      <SpelledCodes text={row.unit.name} />
                    </span>
                    {ward ? (
                      <span id={`${detailIdBase}-${row.unit.id}`} className={styles.cardDetail}>
                        <BedSquares
                          counts={wardSquareCounts(ward, extras.get(ward.unit.id)?.dischargesToday ?? 0)}
                          readyFigure={ward.ready}
                          tag={bedSquaresTag(ward.unit)}
                          notes={wardNotes(ward, rowOf.get(ward.unit.id), now, extras.get(ward.unit.id), false)}
                        />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {onAllWards ? (
          <button type="button" className={styles.railFoot} onClick={onAllWards}>
            All {networkRows.length} wards · bed map
            <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : null}
      </Card>
      <ForecastCard
        model={model}
        networkWide={networkWide}
        onOpen={onForecast}
        onWard={onWard}
        onAskWard={onAskWard}
        testId="capacity-phone-forecast"
      />
      {model.site ? (
        // Site bed manager (D-80): the one way this desk reaches another site's ready bed on a
        // phone, by road time; another site's ward page is not its to open, so a choice shows that
        // site's counts. The coordinator's phone keeps the three cards above.
        <ReadyByRoadTime
          rows={[...networkRows, ...model.otherSiteRows]}
          defaultEdId={model.roadTimeFromEdId}
          selectedUnitId={undefined}
          onSelectUnit={onWard}
        />
      ) : null}
    </div>
  );
}
