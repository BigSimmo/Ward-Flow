"use client";

import { ArrowRight, Car, ChevronRight, Clock, Map as MapIcon, Plane } from "lucide-react";

import { Button, Card, CardHead, Icon, StatusGlyph, cx } from "@/components/wf";

import { TRAVEL_SHORT, confirmedAgeText, shortSiteName, type HomeRegionBeds } from "./out-of-area-model";
import styles from "./out-of-area-board.module.css";

/**
 * The right column at rest: This shift, Home regions and beds, and Ready to go home. A person
 * picked in the register swaps all three out for their return plan. Each card renders rows the
 * page has already read; none derives a figure of its own.
 */

export type ShiftReturnRow = { id: string; name: string; to: string; mode: string; time: string; day: string };

export function ShiftCard({
  idPrefix,
  label,
  returns,
  leaving,
  dueSoon,
  onPick,
}: {
  idPrefix: string;
  label: string;
  returns: ShiftReturnRow[];
  leaving: number;
  dueSoon: number;
  onPick: (id: string) => void;
}) {
  return (
    <Card className={styles.sideCard} aria-labelledby={`${idPrefix}-shift-title`}>
      <CardHead
        id={`${idPrefix}-shift-title`}
        icon={Clock}
        title="This shift"
        aside={<span className={cx(styles.headNote, styles.mono)}>{label}</span>}
      />
      <dl className={styles.mini3}>
        <div>
          <dd>{returns.length}</dd>
          <dt>Returns</dt>
        </div>
        <div>
          <dd>{leaving}</dd>
          <dt title="Departing today">Leaving</dt>
        </div>
        <div>
          <dd>{dueSoon}</dd>
          <dt title="Discharge date today or tomorrow">Due soon</dt>
        </div>
      </dl>
      {returns.length ? (
        <ul className={styles.rowList}>
          {returns.map((row) => (
            <li key={row.id}>
              <button type="button" className={styles.listRow} onClick={() => onPick(row.id)}>
                <span className={styles.two}>
                  <b>{row.name}</b>
                  <span>
                    {row.to} · {row.mode}
                  </span>
                </span>
                <span className={cx(styles.two, styles.end)}>
                  <b className={styles.mono}>{row.time}</b>
                  <span>{row.day}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyLine}>
          <StatusGlyph tone="closed" size={9} />
          No returns recorded yet
        </p>
      )}
    </Card>
  );
}

export function HomeBedsCard({
  idPrefix,
  rows,
  region,
  onRegion,
  notBanded,
}: {
  idPrefix: string;
  rows: HomeRegionBeds[];
  region: string | null;
  onRegion: (region: string) => void;
  notBanded: number;
}) {
  const max = Math.max(1, ...rows.map((row) => row.away));
  return (
    <Card className={styles.sideCard} aria-labelledby={`${idPrefix}-beds-title`}>
      <CardHead
        id={`${idPrefix}-beds-title`}
        icon={MapIcon}
        title="Home regions and beds"
        aside={
          <span
            className={styles.headNote}
            title="People away by home region, then the adult beds each nearest ward has confirmed"
          >
            Highlights rows
          </span>
        }
      />
      {rows.length === 0 ? (
        <p className={styles.emptyLine}>
          <StatusGlyph tone="closed" size={9} />
          Nobody is away from a recorded home region.
        </p>
      ) : (
        rows.map((row) => (
          <div key={row.region} className={styles.regionGroup}>
            <button
              type="button"
              className={styles.regionRow}
              aria-pressed={region === row.region}
              aria-label={`Highlight people from ${row.region}: ${row.away} away`}
              onClick={() => onRegion(row.region)}
            >
              <span className={styles.regionName}>{row.region}</span>
              <span className={styles.track} aria-hidden="true">
                <span style={{ width: `${(row.away / max) * 100}%` }} />
              </span>
              <span className={styles.count}>{row.away}</span>
              <span className={styles.sub}>away</span>
              {row.band ? (
                <span className={styles.regionBand}>
                  <Icon icon={row.band === "air_transport_only" ? Plane : Car} size={14} />
                  {TRAVEL_SHORT[row.band]}
                </span>
              ) : null}
            </button>
            {row.options.length ? (
              <ul className={styles.rowList}>
                {row.options.map((option) => (
                  <li key={option.unit.id} className={styles.bedRow}>
                    <span className={styles.two} title={option.unit.name}>
                      <b>{shortSiteName(option.siteCode)}</b>
                      <span>{option.unit.name}</span>
                    </span>
                    <span className={styles.bedFigure}>
                      <span className={styles.count} aria-label={`${option.beds} confirmed beds`}>
                        {option.beds}
                      </span>
                      <span className={cx(styles.mono, styles.sub, option.stale && styles.inkWarning)}>
                        {option.stale ? "stale " : ""}
                        {confirmedAgeText(option.ageMinutes)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyLine}>
                <StatusGlyph tone="closed" size={9} />
                No travel band recorded
              </p>
            )}
          </div>
        ))
      )}
      <p className={styles.gapRow}>
        <StatusGlyph tone="closed" size={9} />
        <b className={styles.mono}>{notBanded}</b> records with no travel band
        <Button
          variant="sec"
          size="sm"
          className={styles.gapButton}
          disabledReason="Not wired in this prototype."
          reasonDisplay="tooltip"
        >
          List
        </Button>
      </p>
    </Card>
  );
}

export type ReadyRow = {
  id: string;
  name: string;
  detail: string;
  detailIsReason: boolean;
  overdue: string;
  returnShort: string;
};

export function ReadyCard({
  idPrefix,
  testId,
  bodyTestId,
  rows,
  started,
  onPick,
}: {
  idPrefix: string;
  testId?: string;
  bodyTestId?: string;
  rows: ReadyRow[];
  started: { id: string; name: string; left: number }[];
  onPick: (id: string) => void;
}) {
  return (
    <Card className={styles.sideCard} aria-labelledby={`${idPrefix}-ready-title`} data-testid={testId}>
      <CardHead
        id={`${idPrefix}-ready-title`}
        title={
          <span className={styles.titleGlyph}>
            <StatusGlyph tone="warning" size={9} />
            Ready to go home
          </span>
        }
        aside={<span className={styles.count}>{rows.length}</span>}
      />
      <div data-testid={bodyTestId}>
        <p className={styles.cardNote}>Discharge date passed, longest past first</p>
        {rows.length ? (
          <ul className={styles.rowList}>
            {rows.map((row) => (
              <li key={row.id}>
                <button type="button" className={styles.listRow} onClick={() => onPick(row.id)}>
                  <span className={styles.two}>
                    <b>{row.name}</b>
                    <span className={row.detailIsReason ? styles.inkWarning : undefined}>{row.detail}</span>
                  </span>
                  <span className={cx(styles.two, styles.end)}>
                    <b className={styles.inkWarning}>{row.overdue}</b>
                    <span>{row.returnShort}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyLine}>
            <StatusGlyph tone="closed" size={9} />
            Nobody is past their discharge date
          </p>
        )}
        {started.length ? (
          <>
            <p className={styles.subHead}>
              Plans started <span className={styles.count}>{started.length}</span>
            </p>
            <ul className={styles.rowList}>
              {started.map((row) => (
                <li key={row.id}>
                  <button type="button" className={styles.listRow} onClick={() => onPick(row.id)}>
                    <span className={styles.two}>
                      <b>{row.name}</b>
                      <span>{row.left ? `${row.left} to answer` : "Ready to record"}</span>
                    </span>
                    <Icon icon={ChevronRight} size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className={styles.gapRow}>
          <Icon icon={ArrowRight} size={14} />
          Pick anyone in the register to plan a return
        </p>
      </div>
    </Card>
  );
}
